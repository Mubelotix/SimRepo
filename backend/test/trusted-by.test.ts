import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { TrustedByStore } from "../trusted-by.js";

const TEN_DAYS = 10 * 24 * 60 * 60_000;
function fixture(t: TestContext) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "trusted-by-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const filename = path.join(dir, "trusted-by.json");
  return { filename, store: new TrustedByStore(filename), saved: () => JSON.parse(readFileSync(filename, "utf8")) };
}

const readme = (body = "star-history.dera.page", status = 200) =>
  (async (_url, options) => options?.method === "HEAD"
    ? new Response(null)
    : new Response(body, { status })) as typeof fetch;

test("verification accepts current and legacy embed hostnames", async (t) => {
  const { store } = fixture(t);
  store.observe(["owner/repo"]);
  for (const domain of ["simrepo.dera.page", "star-history.dera.page"]) {
    await store.verifyNext(readme(`https://${domain.toUpperCase()}/svg`), 100);
    assert.deepEqual(store.verified(), ["owner/repo"]);
  }
});

test("candidates are normalized, deduplicated and hidden until verified", async (t) => {
  const { store, filename, saved } = fixture(t);
  store.observe([" Owner/Repo ", "owner/repo", "invalid", "../bad/repo", "x/repo?query"]);
  assert.deepEqual(store.verified(), []);
  assert.deepEqual(saved(), { "owner/repo": null });
  await store.verifyNext(readme(), 100);
  store.observe(["OWNER/REPO"]);
  assert.deepEqual(saved(), { "owner/repo": 100 });
  assert.deepEqual(new TrustedByStore(filename).verified(), ["owner/repo"]);
});

test("random rounds give each repo one turn, including after failures", async (t) => {
  const { store } = fixture(t);
  t.mock.method(Math, "random", () => 0.99);
  store.observe(["a/repo", "b/repo", "c/repo"]);
  const requested: string[] = [];
  const fetchImpl = (async (url, options) => {
    if (options?.method === "HEAD") {
      requested.push(String(url));
      if (String(url).endsWith("c/repo")) throw new Error("offline");
    }
    return new Response("star-history.dera.page");
  }) as typeof fetch;
  await assert.rejects(store.verifyNext(fetchImpl));
  await store.verifyNext(fetchImpl);
  await store.verifyNext(fetchImpl);
  assert.deepEqual(requested, ["c", "b", "a"].map((owner) => `https://github.com/${owner}/repo`));
  await assert.rejects(store.verifyNext(fetchImpl));
});

test("transient errors retain verification and persisted state", async (t) => {
  const { store, filename } = fixture(t);
  store.observe(["owner/repo"]);
  await store.verifyNext(readme(), 100);
  const saved = readFileSync(filename, "utf8");
  for (const status of [403, 429, 500]) {
    await assert.rejects(store.verifyNext(readme("error", status)));
    await assert.rejects(store.verifyNext((async () => new Response(null, { status })) as typeof fetch));
    assert.equal(readFileSync(filename, "utf8"), saved);
  }
  await assert.rejects(store.verifyNext((async () => { throw new Error("offline"); }) as typeof fetch));
  assert.deepEqual(store.verified(), ["owner/repo"]);
});

test("mismatches persist and only a new observation after ten days enables retry", async (t) => {
  const { store, filename, saved } = fixture(t);
  store.observe(["owner/repo"]);
  await store.verifyNext(readme(), 100);
  await store.verifyNext(readme("no embed"), 200);
  assert.deepEqual(store.verified(), []);
  assert.deepEqual(saved(), { "owner/repo": { retryAfter: 200 + TEN_DAYS } });
  const reloaded = new TrustedByStore(filename);
  const noFetch = (async () => { assert.fail("mismatch must not be checked automatically"); }) as typeof fetch;
  reloaded.observe(["owner/repo"], 200 + TEN_DAYS - 1);
  await reloaded.verifyNext(noFetch, 200 + TEN_DAYS - 1);
  await reloaded.verifyNext(noFetch, 200 + TEN_DAYS + 1);
  reloaded.observe(["owner/repo"], 200 + TEN_DAYS);
  assert.deepEqual(saved(), { "owner/repo": null });
  await reloaded.verifyNext(readme());
  assert.deepEqual(reloaded.verified(), ["owner/repo"]);
});

test("missing repositories and READMEs are also retained as mismatches", async (t) => {
  for (const fetchImpl of [
    (async () => new Response(null, { status: 404 })) as typeof fetch,
    readme("not found", 404),
  ]) {
    const { store, saved } = fixture(t);
    store.observe(["owner/repo"]);
    await store.verifyNext(fetchImpl, 100);
    assert.deepEqual(saved(), { "owner/repo": { retryAfter: 100 + TEN_DAYS } });
    assert.deepEqual(store.verified(), []);
  }
});

test("the previous JSON array and numeric/null state remain readable", async (t) => {
  const { filename } = fixture(t);
  for (const data of [["Owner/Repo"], { "Owner/Repo": null, "verified/repo": 100 }]) {
    writeFileSync(filename, JSON.stringify(data));
    const store = new TrustedByStore(filename);
    await store.verifyNext(readme(), 200);
    await store.verifyNext(readme(), 300);
    assert.deepEqual(store.verified(), Array.isArray(data) ? ["owner/repo"] : ["owner/repo", "verified/repo"]);
  }
});

test("malformed files are rejected, not silently replaced", (t) => {
  const { filename } = fixture(t);
  for (const contents of ["{", "null", '{"owner/repo":"invalid"}', '{"owner/repo":{}}', '{"owner/repo":{"retryAfter":"bad"}}']) {
    writeFileSync(filename, contents);
    assert.throws(() => new TrustedByStore(filename));
    assert.equal(readFileSync(filename, "utf8"), contents);
  }
});

test("common README filenames are tried in order until one exists", async (t) => {
  const { store } = fixture(t);
  const filenames = ["README.md", "readme.md", "Readme.md", "README.rst", "README"];
  store.observe(["owner/repo"]);
  for (const [index, filename] of filenames.entries()) {
    const requested: string[] = [];
    await store.verifyNext((async (url, options) => {
      if (options?.method === "HEAD") return new Response(null);
      const file = String(url).split("/").at(-1)!;
      requested.push(file);
      return file === filename
        ? new Response("star-history.dera.page")
        : new Response("not found", { status: 404 });
    }) as typeof fetch);
    assert.deepEqual(requested, filenames.slice(0, index + 1));
    assert.deepEqual(store.verified(), ["owner/repo"]);
  }
});

test("fallback README errors retain verification", async (t) => {
  const { store, filename } = fixture(t);
  store.observe(["owner/repo"]);
  await store.verifyNext(readme(), 100);
  const saved = readFileSync(filename, "utf8");
  await assert.rejects(store.verifyNext((async (url, options) =>
    options?.method === "HEAD" ? new Response(null) : String(url).endsWith("/README.md")
      ? new Response("not found", { status: 404 })
      : new Response("unavailable", { status: 503 })
  ) as typeof fetch));
  assert.equal(readFileSync(filename, "utf8"), saved);
});

test("renames merge canonical entries and suppress old names for ten days", async (t) => {
  const { store, saved } = fixture(t);
  t.mock.method(Math, "random", () => 0.99);
  store.observe(["new/repo"]);
  await store.verifyNext(readme(), 100);
  store.observe(["old/repo"]);
  const requested: string[] = [];
  await store.verifyNext((async (url, options) => {
    requested.push(String(url));
    if (options?.method === "HEAD") {
      const response = new Response(null);
      Object.defineProperties(response, {
        redirected: { value: true },
        url: { value: "https://github.com/New/Repo" },
      });
      return response;
    }
    return new Response("star-history.dera.page");
  }) as typeof fetch, 200);
  assert.deepEqual(requested, [
    "https://github.com/old/repo",
    "https://raw.githubusercontent.com/new/repo/HEAD/README.md",
  ]);
  store.observe(["old/repo"], 201);
  assert.deepEqual(saved(), { "new/repo": 200, "old/repo": { retryAfter: 200 + TEN_DAYS } });
  assert.deepEqual(store.verified(), ["new/repo"]);
});

test("the scheduler uses a forty-second interval without overlapping checks", async (t) => {
  const { store } = fixture(t);
  const scheduled: { callback: () => Promise<void>; delay: number }[] = [];
  t.mock.method(globalThis, "setTimeout", (callback: () => Promise<void>, delay: number) => {
    scheduled.push({ callback, delay });
    return { unref() {} };
  });
  t.mock.method(store, "verifyNext", async () => {
    assert.equal(scheduled.length, 1);
  });
  store.start();
  assert.equal(scheduled[0].delay, 40_000);
  await scheduled[0].callback();
  assert.equal(scheduled.length, 2);
  assert.equal(scheduled[1].delay, 40_000);
});
