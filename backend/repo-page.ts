import { JSDOM } from "jsdom";
import type { RepoSummary } from "../shared/common/repo-summary.js";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]!));
const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

/** Prepare the static template once. No DOM parsing or page cache per request. */
export function createRepoPageRenderer(html: string, siteUrl: string) {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  document.title = "__REPO_TITLE__";
  for (const [selector, token] of [
    ['meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]', "__REPO_DESCRIPTION__"],
    ['meta[property="og:title"], meta[name="twitter:title"]', "__REPO_TITLE__"],
    ['meta[property="og:url"], meta[name="twitter:url"], link[rel="canonical"]', "__REPO_URL__"],
  ]) {
    for (const element of document.querySelectorAll(selector)) {
      element.setAttribute(element.tagName === "LINK" ? "href" : "content", token);
    }
  }
  const nextData = document.getElementById("__NEXT_DATA__")!;
  const data = JSON.parse(nextData.textContent!);
  data.props.pageProps.initialSummary = "__REPO_SUMMARY__";
  nextData.textContent = scriptJson(data);
  const template = dom.serialize().replace('"__REPO_SUMMARY__"', "__REPO_SUMMARY__");
  dom.window.close();
  const parts = template.split(/(__REPO_(?:TITLE|DESCRIPTION|URL|SUMMARY)__)/);
  return (summary: RepoSummary): string => {
    const values: Record<string, string> = {
      __REPO_TITLE__: escapeHtml(`${summary.repo} - GitHub Star History`),
      __REPO_DESCRIPTION__: escapeHtml(summary.description),
      __REPO_URL__: escapeHtml(`${siteUrl.replace(/\/$/, "")}/${summary.repo.split("/").map(encodeURIComponent).join("/")}`),
      __REPO_SUMMARY__: scriptJson(summary),
    };
    return parts.map((part, index) => index % 2 ? values[part] : part).join("");
  };
}
