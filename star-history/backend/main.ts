import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { compress } from "hono/compress";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { optimize } from 'svgo';
import { JSDOM } from "jsdom";
import XYChart from "../shared/packages/xy-chart.js";
import { convertDataToChartData } from "../shared/common/chart.js";
import { ChartMode } from "../shared/types/chart.js";
import logger from "./logger.js";
import cache, { svgCache, recordCacheHit, recordCacheMiss, getAllCacheStats } from "./cache.js";
import {
  getChartWidthWithSize,
  fixJsdomSvgCasing,
  getBase64Image,
} from "./utils.js";
import { CHART_SIZES, MAX_REPOS_PER_REQUEST } from "./const.js";
import { fetchRepoData } from "./repos.js";
import { isWhitelisted, tryFetchRepos, RATE_LIMIT_MESSAGE } from "./rate-limiter.js";

const FRONTEND_DIR = process.env.FRONTEND_DIR || "/app/www";

const SVG_HEADERS = {
  "Content-Type": "image/svg+xml;charset=utf-8",
  "Cache-Control": "public, s-maxage=86400, max-age=86400",
} as const;

// Applies per-IP rate limiting based on the number of repos being fetched.
// The IP is read from the X-Real-IP header (set by the reverse proxy). Whitelisted
// IPs (e.g. GitHub's CDN proxies) are never limited. Returns a 429 Response when
// the limit is exceeded, otherwise null. Note: the numeric limits are deliberately
// not advertised in the response (no X-RateLimit-* headers, no exact numbers).
function checkRateLimit(c: Context, count: number): Response | null {
  const ip = c.req.header("X-Real-IP") ?? "";
  // Without an IP we can't attribute the request to a client; allow it through.
  if (!ip || isWhitelisted(ip)) return null;
  if (tryFetchRepos(ip, count)) return null;
  return c.text(RATE_LIMIT_MESSAGE, 429);
}

const startServer = async () => {
  const app = new Hono();
  app.use(cors());
  app.use(compress());

  // Request logging middleware
  app.use(async (c, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    logger.info(`${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms`);
  });

  app.onError((err, c) => {
    logger.error(`server error: ${err.stack || err}`);
    return c.text("Internal Server Error", 500);
  });

  // Health check endpoint with cache stats
  app.get("/healthz", (c) => {
    return c.json({
      status: "OK",
      commit: process.env.GIT_COMMIT || "unknown",
      cache: getAllCacheStats(),
    }, 200);
  });

  // Serve star history + logo data sourced from repos.sqlite.
  // `/svg?repos=a,b,c` returns { data: RepoData[], missing: string[] }.
  app.get("/repo-data", (c) => {
    const reposParam = c.req.query("repos");
    const repos = (reposParam ?? "")
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);

    if (repos.length === 0) {
      return c.json({ data: [], missing: [] });
    }
    if (repos.length > MAX_REPOS_PER_REQUEST) {
      return c.text(`Too many repos: max ${MAX_REPOS_PER_REQUEST} per request`, 400);
    }

    const limited = checkRateLimit(c, repos.length);
    if (limited) return limited;

    const { found, missing } = fetchRepoData(repos);
    return c.json({ data: found, missing });
  });

  // Normalize /svg query params for CDN cache efficiency.
  // Redirects to the canonical URL so Cloudflare caches one entry per unique chart.
  app.get("/svg", async (c, next) => {
    const url = new URL(c.req.url);
    const params = url.searchParams;
    const repos = params.get("repos");
    if (!repos) {
      return await next();
    }

    // Lowercase repo names (GitHub is case-insensitive)
    const normalized = repos.split(",").map((r) => r.trim().toLowerCase()).filter(Boolean).join(",");
    if (normalized !== repos) {
      params.set("repos", normalized);
      return c.redirect(`${url.pathname}?${params.toString()}`, 301);
    }

    return await next();
  });

  // Example request link:
  // /svg?repos=star-history/star-history&type=timeline&logscale&legend=bottom-right
  app.get("/svg", async (c) => {
    const reposParam = c.req.query("repos");
    if (!reposParam) {
      return c.text("Repo name required", 400);
    }
    const repos = reposParam.split(",").filter(Boolean);
    if (repos.length > MAX_REPOS_PER_REQUEST) {
      return c.text(`Too many repos: max ${MAX_REPOS_PER_REQUEST} per request`, 400);
    }

    const limited = checkRateLimit(c, repos.length);
    if (limited) return limited;

    // Landscape1 card: previously returned a 1200x630 SVG with radar chart and
    // attributes, but it required live GitHub API metadata. That call has been
    // removed, so the feature is no longer available.
    const style = c.req.query("style") ?? "";
    if (style === "landscape1") {
      return c.text("OG cards are unavailable: GitHub API access has been disabled", 503);
    }

    // --- Star history chart params (only relevant when style is not set) ---
    const theme = c.req.query("theme") ?? "";
    const transparent = c.req.query("transparent") ?? "";
    const typeParam = c.req.query("type") ?? "";
    const logscaleParam = c.req.query("logscale");
    const legendParam = c.req.query("legend") ?? "";
    let type: ChartMode = "Date";
    let size = c.req.query("size") ?? "";

    if (typeParam) {
      const lowerType = typeParam.toLowerCase();
      if (lowerType === "timeline") {
        type = "Timeline";
      } else if (lowerType === "date") {
        type = "Date";
      }
    } else if (c.req.query("timeline") !== undefined) {
      type = "Timeline";
    } else if (c.req.query("date") !== undefined) {
      type = "Date";
    }

    const useLogScale = logscaleParam !== undefined && logscaleParam !== "false";

    let legendPosition: "top-left" | "bottom-right" = "top-left";
    if (legendParam === "bottom-right") {
      legendPosition = "bottom-right";
    }

    if (!CHART_SIZES.includes(size)) {
      size = "laptop";
    }

    // Check rendered SVG cache before any data fetching or rendering.
    const svgCacheKey = `${repos.join(",")}|${type}|${size}|${theme}|${transparent}|${legendPosition}|${useLogScale}`;
    const cachedSvg = svgCache.get(svgCacheKey);
    if (cachedSvg) {
      recordCacheHit("svgChart");
      return c.body(cachedSvg, 200, SVG_HEADERS);
    }
    recordCacheMiss("svgChart");

    const repoData = [];
    const nodataRepos = [];

    for (const repo of repos) {
      const cacheData = cache.get(repo);

      if (cacheData) {
        recordCacheHit("starData");
        repoData.push({
          repo,
          starRecords: cacheData.starRecords,
          logoUrl: cacheData.logoUrl,
        });
      } else {
        recordCacheMiss("starData");
        nodataRepos.push(repo);
      }
    }

    if (nodataRepos.length > 0) {
      const { found, missing } = fetchRepoData(nodataRepos);

      if (missing.length > 0) {
        return c.text(`Repo not found in dataset: ${missing[0]}`, 404);
      }

      // Embed all logos in parallel (bounded by MAX_REPOS_PER_REQUEST)
      await Promise.all(found.map(async (d) => {
        d.logoUrl = await getBase64Image(`${d.logoUrl}&size=22`);
        cache.set(d.repo, {
          starRecords: d.starRecords,
          starAmount: d.starRecords[d.starRecords.length - 1].count,
          logoUrl: d.logoUrl,
        });
        repoData.push(d);
      }));
    }

    const dom = new JSDOM(`<!DOCTYPE html><body></body>`);
    const body = dom.window.document.querySelector("body");
    const svg = dom.window.document.createElement(
      "svg"
    ) as unknown as SVGSVGElement;

    if (!dom || !body || !svg) {
      return c.text("Failed to mock dom with JSDOM", 500);
    }

    body.append(svg);
    svg.setAttribute("width", `${getChartWidthWithSize(size)}`);
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    try {
      XYChart(
        svg,
        {
          title: "Star History",
          xLabel: type === "Date" ? "Date" : "Timeline",
          yLabel: "GitHub Stars",
          data: convertDataToChartData(repoData, type),
          showDots: false,
          transparent: transparent.toLowerCase() === "true",
          theme: theme === "dark" ? "dark" : "light",
        },
        {
          xTickLabelType: type === "Date" ? "Date" : "Number",
          chartWidth: getChartWidthWithSize(size),
          useLogScale: useLogScale,
          legendPosition: legendPosition,
        }
      );
    } catch (error) {
      return c.text(`Failed to generate chart, ${error}`, 500);
    }

    const svgContent = fixJsdomSvgCasing(svg.outerHTML);
    const optimized = optimize(svgContent, { multipass: true }).data;
    svgCache.set(svgCacheKey, optimized);

    return c.body(optimized, 200, SVG_HEADERS);
  });

  // Serve the static frontend export (Next.js "output: export"). Registered last
  // so API routes above take precedence. No external nginx / volume sharing needed:
  // the container ships the files and serves them itself.
  app.use("*", serveStatic({ root: FRONTEND_DIR }));

  const banner = `
     _______.___________.    ___      .______          __    __   __       _______.___________.  ______   .______     ____    ____
    /       |           |   /   \\     |   _  \\        |  |  |  | |  |     /       |           | /  __  \\  |   _  \\    \\   \\  /   /
   |   (----\`---|  |----\`  /  ^  \\    |  |_)  |       |  |__|  | |  |    |   (----\`---|  |----\`|  |  |  | |  |_)  |    \\   \\/   /
    \\   \\       |  |      /  /_\\  \\   |      /        |   __   | |  |     \\   \\       |  |     |  |  |  | |      /      \\_    _/
.----)   |      |  |     /  _____  \\  |  |\\  \\----.   |  |  |  | |  | .----)   |      |  |     |  \`--'  | |  |\\  \\----.   |  |
|_______/       |__|    /__/     \\__\\ | _| \`._____|   |__|  |__| |__| |_______/       |__|      \\______/  | _| \`._____|   |__|
`;
  serve({ fetch: app.fetch, port: 8080 }, () => {
    console.log(banner);
    console.log(`  commit: ${process.env.GIT_COMMIT || "unknown"}\n`);
    logger.info("server running on port 8080");
  });
};

startServer();
