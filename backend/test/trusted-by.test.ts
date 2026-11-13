import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { TrustedByStore } from "../trusted-by.js";

function fixture(t: TestContext) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "trusted-by-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const filename = path.join(dir, "trusted-by.json");
  return { filename, store: new TrustedByStore(filename) };
}

const readme = (body: string, status = 200) =>
  (async (_url, options) => options?.method === "HEAD"
    ? new Response(null)
    : new Response(body, { status })) as typeof fetch;

test("candidates are normalized, deduplicated and hidden until verified", async (t) => {
  const { store, filename } = fixture(t);
  store.observe([" Owner/Repo ", "owner/repo", "invalid", "../bad/repo", "x/repo?query"]);
  assert.deepEqual(store.verified(), []);
  assert.deepEqual(JSON.parse(readFileSync(filename, "utf8")), { "owner/repo": null });
  await store.verifyOldest(readme("https://STAR-HISTORY.DERA.PAGE/svg"), 100);
  assert.deepEqual(store.verified(), ["owner/repo"]);
  store.observe(["OWNER/REPO"]);
  assert.deepEqual(JSON.parse(readFileSync(filename, "utf8")), { "owner/repo": 100 });
  await store.verifyOldest(readme("no domain"));
  assert.deepEqual(new TrustedByStore(filename).verified(), []);
});

test("unverified entries come first, then the oldest verification", async (t) => {
  const { store } = fixture(t);
  store.observe(["a/repo", "b/repo"]);
  await store.verifyOldest(readme("star-history.dera.page"), 100);
  await store.verifyOldest(readme("star-history.dera.page"), 200);
  store.observe(["c/repo", "a/repo"]);
  const requested: string[] = [];
  const fetchImpl = (async (url, options) => {
    if (options?.method === "HEAD") return new Response(null);
    requested.push(String(url));
    return new Response("star-history.dera.page");
  }) as typeof fetch;
  await store.verifyOldest(fetchImpl, 300);
  await store.verifyOldest(fetchImpl, 400);
  await store.verifyOldest(fetchImpl, 500);
  assert.deepEqual(requested, ["c", "a", "b"].map((owner) => `https://raw.githubusercontent.com/${owner}/repo/HEAD/README.md`));
});

test("transient errors retain verification; absent READMEs remove entries", async (t) => {
  const { store, filename } = fixture(t);
  store.observe(["owner/repo"]);
  await store.verifyOldest(readme("star-history.dera.page"), 100);
  const saved = readFileSync(filename, "utf8");
  for (const status of [403, 429, 500]) {
    await assert.rejects(store.verifyOldest(readme("error", status)));
    assert.equal(readFileSync(filename, "utf8"), saved);
  }
  await assert.rejects(store.verifyOldest((async () => { throw new Error("offline"); }) as typeof fetch));
  assert.deepEqual(store.verified(), ["owner/repo"]);
  await store.verifyOldest(readme("not found", 404));
  assert.deepEqual(JSON.parse(readFileSync(filename, "utf8")), {});
});

test("verification persists across reloads", async (t) => {
  const { store, filename } = fixture(t);
  store.observe(["owner/repo"]);
  await store.verifyOldest(readme("star-history.dera.page"), 100);
  assert.deepEqual(new TrustedByStore(filename).verified(), ["owner/repo"]);
});

test("the previous JSON array can seed candidates", async (t) => {
  const { filename } = fixture(t);
  writeFileSync(filename, JSON.stringify(["Owner/Repo", "another/repo"]));
  const store = new TrustedByStore(filename);
  assert.deepEqual(store.verified(), []);
  await store.verifyOldest(readme("star-history.dera.page"), 100);
  assert.deepEqual(JSON.parse(readFileSync(filename, "utf8")), {
    "owner/repo": null,
    "another/repo": 100,
  });
});

test("malformed files are rejected, not silently replaced", (t) => {
  const { filename } = fixture(t);
  for (const contents of ["{", "null", '{"owner/repo":"invalid"}']) {
    writeFileSync(filename, contents);
    assert.throws(() => new TrustedByStore(filename));
    assert.equal(readFileSync(filename, "utf8"), contents);
  }
});

test("common README filenames are tried in order until one exists", async (t) => {
  const { store } = fixture(t);
  const filenames = ["README.md", "readme.md", "Readme.md", "README.rst", "README"];
  for (const [index, filename] of filenames.entries()) {
    store.observe(["owner/repo"]);
    const requested: string[] = [];
    await store.verifyOldest((async (url, options) => {
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

test("all missing README filenames remove a repo, but fallback errors retain it", async (t) => {
  const { store, filename } = fixture(t);
  store.observe(["owner/repo"]);
  await store.verifyOldest(readme("star-history.dera.page"), 100);
  const saved = readFileSync(filename, "utf8");
  await assert.rejects(store.verifyOldest((async (url, options) =>
    options?.method === "HEAD" ? new Response(null) : String(url).endsWith("/README.md")
      ? new Response("not found", { status: 404 })
      : new Response("unavailable", { status: 503 })
  ) as typeof fetch));
  assert.equal(readFileSync(filename, "utf8"), saved);
  const requested: string[] = [];
  await store.verifyOldest((async (url, options) => {
    if (options?.method === "HEAD") return new Response(null);
    requested.push(String(url));
    return new Response("not found", { status: 404 });
  }) as typeof fetch);
  assert.equal(requested.length, 5);
  assert.deepEqual(JSON.parse(readFileSync(filename, "utf8")), {});
});

test("renames replace the old name and merge an existing canonical entry", async (t) => {
  const { store, filename } = fixture(t);
  store.observe(["old/repo", "new/repo"]);
  await store.verifyOldest(readme("star-history.dera.page"), 100);
  const requested: string[] = [];
  await store.verifyOldest((async (url, options) => {
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
  assert.deepEqual(JSON.parse(readFileSync(filename, "utf8")), { "new/repo": 200 });
});

test("repository lookup failures preserve the old name; 404 removes it", async (t) => {
  const { store, filename } = fixture(t);
  store.observe(["old/repo"]);
  await store.verifyOldest(readme("star-history.dera.page"), 100);
  const saved = readFileSync(filename, "utf8");
  await assert.rejects(store.verifyOldest((async () => new Response(null, { status: 429 })) as typeof fetch));
  assert.equal(readFileSync(filename, "utf8"), saved);
  await store.verifyOldest((async () => new Response(null, { status: 404 })) as typeof fetch);
  assert.deepEqual(JSON.parse(readFileSync(filename, "utf8")), {});
});
