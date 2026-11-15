import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { buildRepoSummary } from "../../shared/common/repo-summary.js";
import { createRepoPageRenderer } from "../repo-page.js";

const facts = {
  name: "owner/repo",
  language: "Rust",
  stars_total: 12450,
  forks_count: 830,
  rank: 420,
  total_repos: 14000,
};
const history = (before: number, after: number) => [
  { date: "2026-10-16", count: before },
  { date: "2026-11-15", count: after },
];

test("summary includes dataset ranking, percentage growth and a similar project", () => {
  assert.equal(buildRepoSummary(facts, history(10000, 10500), "owner/alternative").description,
    "owner/repo is a Rust project with 12,450 stars and 830 forks, ranking #420 among the 14,000 repositories in our dataset (top 3%). It grew by 5% over the last 30 days (as of 2026-11-15). Explore its star history chart and discover similar projects such as owner/alternative.");
});

test("zero growth has a dedicated phrase; small changes do not round to zero", () => {
  assert.match(buildRepoSummary(facts, history(10000, 10000)).description, /Its star count remained unchanged/);
  assert.match(buildRepoSummary(facts, history(10000, 10001)).description, /grew by less than 0\.1%/);
  assert.match(buildRepoSummary(facts, history(10000, 9999)).description, /shrank by less than 0\.1%/);
  assert.match(buildRepoSummary(facts, history(10000, 9500)).description, /shrank by 5%/);
});

test("zero starting count does not produce infinite percentage growth", () => {
  assert.match(buildRepoSummary(facts, history(0, 50)).description, /rose from 0 to 50/);
});

test("missing facts and insufficient history are omitted", () => {
  const summary = buildRepoSummary({
    ...facts, language: null, rank: -1, total_repos: 0, forks_count: -1,
  }, [{ date: "2026-11-15", count: 12450 }]).description;
  assert.match(summary, /is a GitHub project with 12,450 stars/);
  assert.doesNotMatch(summary, /ranking|forks|last 30 days|such as|null|-1/);
  assert.doesNotMatch(buildRepoSummary(facts, [
    { date: "2026-10-20", count: 10000 },
    { date: "2026-11-15", count: 12450 },
  ]).description, /last 30 days/);
});

test("null and non-finite counts are omitted rather than crashing or producing invalid text", () => {
  for (const value of [null, NaN, Infinity, -Infinity]) {
    const summary = buildRepoSummary({
      ...facts, stars_total: value, forks_count: value, rank: value, total_repos: value,
    }, []).description;
    assert.match(summary, /owner\/repo is a Rust project\./);
    assert.doesNotMatch(summary, /stars|forks|ranking|NaN|Infinity|null/);
  }
  assert.match(buildRepoSummary({ ...facts, stars_total: 0, forks_count: 0 }, []).description,
    /with 0 stars and 0 forks/);
});

test("sparse histories interpolate the 30-day baseline and label estimates", () => {
  const summary = buildRepoSummary(facts, [
    { date: "2026-10-06", count: 9000 },
    { date: "2026-10-26", count: 11000 },
    { date: "2026-11-15", count: 10500 },
  ]).description;
  assert.match(summary, /grew by approximately 5% over the last 30 days/);
});

test("interpolated declines, small changes and flat histories are handled", () => {
  const sparse = (latest: number) => [
    { date: "2026-10-06", count: 9000 },
    { date: "2026-10-26", count: 11000 },
    { date: "2026-11-15", count: latest },
  ];
  assert.match(buildRepoSummary(facts, sparse(9500)).description, /shrank by approximately 5%/);
  assert.match(buildRepoSummary(facts, sparse(10001)).description, /grew by less than 0\.1%/);
  assert.match(buildRepoSummary(facts, sparse(10000)).description, /was approximately unchanged/);
  assert.match(buildRepoSummary(facts, [
    { date: "2026-10-06", count: 10000 },
    { date: "2026-11-15", count: 10000 },
  ]).description, /remained unchanged/);
});

test("HTML contains metadata and hydration props without visible summary text, safely escaped", () => {
  const html = `<!DOCTYPE html><html><head>
    <title>GitHub Star History</title>
    <meta name="description" content="generic">
    <meta property="og:description" content="generic">
    <meta name="twitter:description" content="generic">
    <meta property="og:title" content="generic">
    <meta name="twitter:title" content="generic">
    <meta property="og:url" content="https://example.com">
    <meta name="twitter:url" content="https://example.com">
    <link rel="canonical" href="https://example.com">
    </head><body><div id="__next"><p>Existing page content</p></div>
    <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{}}}</script>
    </body></html>`;
  const summary = buildRepoSummary({ ...facts, language: '</script><script>alert("x")</script>' }, history(10, 10));
  const render = createRepoPageRenderer(html, "https://example.com");
  const rendered = render(summary);
  const dom = new JSDOM(rendered);
  const document = dom.window.document;
  assert.equal(document.querySelector("#repo-summary"), null);
  assert.equal(document.querySelector("#__next")?.textContent, "Existing page content");
  for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) {
    assert.equal(document.querySelector(selector)?.getAttribute("content"), summary.description);
  }
  assert.equal(document.title, "owner/repo - GitHub Star History");
  assert.equal(document.querySelector('link[rel="canonical"]')?.getAttribute("href"), "https://example.com/owner/repo");
  assert.deepEqual(JSON.parse(document.getElementById("__NEXT_DATA__")!.textContent!).props.pageProps.initialSummary, summary);
  assert.equal(document.querySelectorAll("script").length, 1);
  assert.equal(render(summary), rendered);
  const other = { repo: "another/repo", description: 'A different & "quoted" description.' };
  const otherDom = new JSDOM(render(other));
  assert.equal(otherDom.window.document.querySelector('meta[name="description"]')?.getAttribute("content"), other.description);
  assert.equal(otherDom.window.document.querySelector("#__next")?.textContent, "Existing page content");
  otherDom.window.close();
  assert.equal(render(summary), rendered);
  dom.window.close();
});
