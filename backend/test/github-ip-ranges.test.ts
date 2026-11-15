import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { GithubIpRangeStore } from "../github-ip-ranges.js";

const ranges = {
  web: ["192.30.252.0/22", "2606:50c0::/32"],
  hooks: ["9.234.98.160/28", "9.234.98.176/28", "9.234.106.48/28"],
};

function filename(t: TestContext): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "github-ip-ranges-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, "state", "github-ip-ranges.json");
}

test("fetches only web/hooks, persists and loads immediately", async (t) => {
  const file = filename(t);
  const fetchImpl = (async (url, options) => {
    assert.equal(url, "https://api.github.com/meta");
    assert.ok(options?.signal);
    return Response.json({ ...ranges, actions: ["1.0.0.0/8"] });
  }) as typeof fetch;
  const store = new GithubIpRangeStore(file);
  assert.equal(store.has("9.234.98.178"), false);
  await store.refresh(fetchImpl);
  assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), ranges);
  const cached = new GithubIpRangeStore(file);
  for (const ip of ["192.30.255.254", "2606:50c0::123", "9.234.98.160", "9.234.98.187", "9.234.106.62"]) {
    assert.equal(cached.has(ip), true, ip);
  }
  for (const ip of ["1.2.3.4", "9.234.98.159", "9.234.98.192", "9.234.106.64", "2606:50c1::1", "", "invalid"]) {
    assert.equal(cached.has(ip), false, ip);
  }
});

test("replaces removed ranges rather than accumulating them", async (t) => {
  let data = ranges;
  const store = new GithubIpRangeStore(filename(t));
  const fetchImpl = (async () => Response.json(data)) as typeof fetch;
  await store.refresh(fetchImpl);
  data = { web: ["185.199.108.0/22"], hooks: ["140.82.112.0/20"] };
  await store.refresh(fetchImpl);
  assert.equal(store.has("9.234.98.178"), false);
  assert.equal(store.has("185.199.108.1"), true);
});

test("failed or malformed refreshes retain the last valid memory and disk cache", async (t) => {
  const file = filename(t);
  let response = () => Response.json(ranges);
  const store = new GithubIpRangeStore(file);
  const fetchImpl = (async () => response()) as typeof fetch;
  await store.refresh(fetchImpl);
  const saved = readFileSync(file, "utf8");
  for (const next of [
    () => new Response(null, { status: 403 }),
    () => new Response(null, { status: 429 }),
    () => { throw new Error("network failure"); },
    () => Response.json({ web: ranges.web }),
    () => Response.json({ ...ranges, hooks: [] }),
    () => Response.json({ ...ranges, hooks: ["invalid/24"] }),
    () => Response.json({ ...ranges, hooks: ["0.0.0.0/0"] }),
    () => Response.json({ ...ranges, hooks: ["9.234.98.160/33"] }),
  ]) {
    response = next;
    await assert.rejects(store.refresh(fetchImpl));
    assert.equal(store.has("9.234.98.178"), true);
    assert.equal(readFileSync(file, "utf8"), saved);
  }
  writeFileSync(file, "{broken");
  assert.equal(new GithubIpRangeStore(file).has("9.234.98.178"), false);
});

test("keeps fresh in-memory ranges if persistence fails", async (t) => {
  const file = filename(t);
  const store = new GithubIpRangeStore(file);
  // A file where the parent directory should be prevents saving.
  writeFileSync(path.dirname(file), "not a directory");
  await store.refresh((async () => Response.json(ranges)) as typeof fetch);
  assert.equal(store.has("9.234.98.178"), true);
});
