import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Hono } from "hono";
import { createRepoPageHandler } from "../repo-page.js";

const html = `<!DOCTYPE html><html><head><title>GitHub Star History</title></head>
<body><div id="__next">App</div>
<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{}}}</script>
</body></html>`;

test("repo pages return 404/noindex for missing data, without falling through to static HTML", async (t) => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "repo-page-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(path.join(directory, "assets"));
  writeFileSync(path.join(directory, "assets", "file.js"), "asset");
  const app = new Hono();
  const handler = createRepoPageHandler(directory, html, "https://example.com", (repo) =>
    repo === "owner/available" ? { repo, description: "Repository with chart data" } : null);
  app.get("/:owner/:repo", handler);
  app.get("/:owner/:repo/", handler);
  app.use("*", (c) => c.text("static fallback"));

  for (const repo of ["martijnhe/OCTR-NitroFueled-PC-EU", "owner/insufficient-history"]) {
    const response = await app.request(`/${repo}`);
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex");
    assert.match(response.headers.get("Content-Type")!, /text\/html/);
    assert.equal(await response.text(), html);
  }

  const available = await app.request("/owner/available");
  assert.equal(available.status, 200);
  assert.equal(available.headers.get("X-Robots-Tag"), null);
  assert.match(await available.text(), /owner\/available - GitHub Star History/);

  for (const repo of ["owner/available", "owner/missing"]) {
    const redirect = await app.request(`/${repo}/?type=timeline`);
    assert.equal(redirect.status, 308);
    assert.equal(redirect.headers.get("Location"), `/${repo}?type=timeline`);
  }
  for (const url of ["/", "/privacy", "/assets/file.js", "/invalid!/repo"]) {
    const response = await app.request(url);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("X-Robots-Tag"), null);
    assert.equal(await response.text(), "static fallback");
  }
});

test("unavailable repos stay 404/noindex when the frontend export is absent", async () => {
  const app = new Hono();
  app.get("/:owner/:repo", createRepoPageHandler(
    "/nonexistent-frontend", null, "https://example.com", () => null,
  ));
  const response = await app.request("/owner/missing");
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex");
});
