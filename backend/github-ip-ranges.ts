import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { BlockList, isIPv6 } from "node:net";
import path from "node:path";
import logger from "./logger.js";

const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

function parseRanges(data: { web: string[]; hooks: string[] }): BlockList {
  const whitelist = new BlockList();
  for (const entries of [data.web, data.hooks]) {
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error("Missing GitHub web/hooks IP ranges");
    }
    for (const entry of entries) {
      const [address, prefix, extra] = entry.split("/");
      if (extra !== undefined || !/^\d+$/.test(prefix) || Number(prefix) === 0) {
        throw new Error(`Invalid GitHub IP range: ${entry}`);
      }
      whitelist.addSubnet(address, Number(prefix), isIPv6(address) ? "ipv6" : "ipv4");
    }
  }
  return whitelist;
}

export class GithubIpRangeStore {
  private whitelist = new BlockList();
  constructor(private readonly filename = path.join(process.cwd(), "state", "github-ip-ranges.json")) {
    try {
      this.whitelist = parseRanges(JSON.parse(readFileSync(filename, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        logger.warn(`Failed to load cached GitHub IP ranges: ${error}`);
      }
    }
  }

  has(ip: string): boolean {
    return this.whitelist.check(ip, isIPv6(ip) ? "ipv6" : "ipv4");
  }

  async refresh(fetchImpl: typeof fetch = fetch): Promise<void> {
    const token = process.env.GITHUB_TOKEN ?? process.env.GITHUB_API_TOKEN;
    const response = await fetchImpl("https://api.github.com/meta", {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`GitHub Meta returned HTTP ${response.status}`);
    const { web, hooks } = await response.json();
    const ranges = { web, hooks };
    this.whitelist = parseRanges(ranges);
    try {
      mkdirSync(path.dirname(this.filename), { recursive: true });
      const temporary = `${this.filename}.tmp`;
      writeFileSync(temporary, JSON.stringify(ranges, null, 2) + "\n");
      renameSync(temporary, this.filename);
    } catch (error) {
      logger.warn(`Failed to persist GitHub IP ranges: ${error}`);
    }
    logger.info("rate limit: refreshed GitHub web and hooks IP ranges");
  }

  start(): void {
    // Refresh in the background; schedule after completion to avoid overlap.
    const check = async () => {
      try {
        await this.refresh();
      } catch (error) {
        logger.warn(`Failed to refresh GitHub IP ranges; retaining previous ranges: ${error}`);
      } finally {
        setTimeout(check, REFRESH_INTERVAL_MS).unref();
      }
    };
    void check();
  }
}

export const githubIpRanges = new GithubIpRangeStore();
