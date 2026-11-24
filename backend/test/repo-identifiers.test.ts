import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import test from "node:test";

test("repository IDs resolve current names and fetch the same chart data as names", async (t) => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "repo-identifiers-"));
  const cwd = process.cwd();
  mkdirSync(path.join(directory, "backend"));
  const db = new DatabaseSync(path.join(directory, "repos.sqlite"));
  db.exec(`
    CREATE TABLE repos (
      id INTEGER PRIMARY KEY, name TEXT, points BLOB, logo_url TEXT,
      owner TEXT DEFAULT 'owner', stars_total INTEGER DEFAULT 10,
      description TEXT, language TEXT, license TEXT, homepage TEXT,
      forks_count INTEGER DEFAULT 0, open_issues_count INTEGER DEFAULT 0,
      created_at TEXT, archived INTEGER DEFAULT 0, size INTEGER DEFAULT 0,
      topics TEXT DEFAULT '[]', stars INTEGER DEFAULT 0,
      new_stars INTEGER DEFAULT 0, forks INTEGER DEFAULT 0,
      pushes INTEGER DEFAULT 0, rank INTEGER DEFAULT 1,
      total_repos INTEGER DEFAULT 1, trust_p REAL
    );
    CREATE TABLE axis_percentiles (axis TEXT, value INTEGER, count_le INTEGER);
    CREATE TABLE similar_repos (repo INTEGER, similar_repo INTEGER, score BLOB);
  `);
  const points = Buffer.alloc(5 * 8);
  for (let i = 0; i < 5; i++) {
    points.writeUInt32LE(20000 + i, i * 8);
    points.writeUInt32LE(i + 1, i * 8 + 4);
  }
  db.prepare("INSERT INTO repos (id, name, points) VALUES (?, ?, ?)")
    .run(123, "new-owner/renamed", gzipSync(points));
  db.prepare("INSERT INTO repos (id, name) VALUES (?, ?)").run(124, "owner/alternative");
  db.prepare("INSERT INTO repos (id, name, stars_total, forks_count) VALUES (?, ?, NULL, NULL)")
    .run(125, "owner/null-counts");
  db.prepare("UPDATE repos SET points = ? WHERE id = 125").run(gzipSync(points));
  db.prepare("INSERT INTO repos (id, name, points) VALUES (?, ?, ?)")
    .run(126, "owner/insufficient-history", gzipSync(points.subarray(0, 4 * 8)));
  const insertScoredRepo = db.prepare(
    "INSERT INTO repos (name, points, stars_total, stars, trust_p) VALUES (?, ?, ?, ?, ?)"
  );
  insertScoredRepo.run("owner/high-trust", gzipSync(points), 1000, 900, 1);
  insertScoredRepo.run("owner/low-trust", gzipSync(points), 1000, 250, 0.005);
  const score = Buffer.alloc(4);
  score.writeFloatLE(1);
  db.prepare("INSERT INTO similar_repos (repo, similar_repo, score) VALUES (?, ?, ?)")
    .run(123, 124, score);
  for (let i = 0; i <= 10; i++) {
    db.prepare("INSERT INTO repos (name, stars_total) VALUES (?, ?)")
      .run(`ranked/repo-${String(i).padStart(2, "0")}`, i);
  }
  db.prepare("INSERT INTO repos (name, stars_total) VALUES (?, ?)").run("other/zero", 0);
  db.close();
  process.chdir(path.join(directory, "backend"));
  t.after(() => {
    process.chdir(cwd);
    rmSync(directory, { recursive: true, force: true });
  });

  const { fetchRepoData, fetchRepoSummary, fetchTrustedBy, resolveRepoId, resolveRepoName, selectTrustedByRepos } = await import("../repos.js");

  assert.equal(resolveRepoName("123"), "new-owner/renamed");
  assert.equal(resolveRepoId("NEW-OWNER/Renamed"), 123);
  assert.equal(resolveRepoName("999"), null);
  for (const invalid of ["0", "-1", "1.2", "1e2", "9007199254740993"]) {
    assert.equal(resolveRepoName(invalid), null);
  }
  assert.deepEqual(fetchRepoData(["123"]), fetchRepoData(["new-owner/renamed"]));
  assert.equal(fetchRepoData(["123"]).found[0].repo, "new-owner/renamed");
  assert.deepEqual(fetchRepoData(["999", "missing/repo"]).missing, ["999", "missing/repo"]);

  const [low, high, unscored] = fetchRepoData(["owner/low-trust", "owner/high-trust", "123"]).found.map(({ meta }) => meta!);
  assert.equal(low.trust_p, 0.005);
  assert.equal(low.stars_total, 1000);
  assert.equal(low.raw.stars, 250);
  assert.equal(low.raw.trust, 0.5);
  assert.equal(low.attributes.trust, 0.495);
  assert.equal(high.attributes.trust, 99);
  assert.equal(unscored.trust_p, null);
  assert.equal(unscored.attributes.trust, -1);
  for (const { percentiles } of [low, high, unscored]) {
    assert.equal(percentiles.trust, undefined);
  }

  const ranked = Array.from({ length: 11 }, (_, i) => `ranked/repo-${String(i).padStart(2, "0")}`);
  const unknown = Array.from({ length: 11 }, (_, i) => `other/unknown-${String(i).padStart(2, "0")}`);
  const selected = selectTrustedByRepos(["ranked/unknown", ...unknown.reverse(), ...ranked, "other/zero"]);
  assert.deepEqual(selected.filter((name) => name.startsWith("ranked/")), ranked.slice(1).reverse());
  assert.deepEqual(selected.filter((name) => name.startsWith("other/")), ["other/zero", ...unknown.reverse().slice(0, 9)]);
  assert.deepEqual(selectTrustedByRepos(["missing/repo"]), ["missing/repo"]);
  assert.deepEqual(fetchTrustedBy(["owner/alternative", "missing/repo"]), [
    { name: "owner/alternative", logoUrl: "https://github.com/owner.png?size=64", stars: 10 },
    { name: "missing/repo", logoUrl: "https://github.com/missing.png?size=64", stars: null },
  ]);
  assert.equal(fetchRepoSummary("missing/repo"), null);
  assert.equal(fetchRepoSummary("owner/alternative"), null);
  assert.equal(fetchRepoSummary("owner/insufficient-history"), null);
  const summary = fetchRepoSummary("NEW-OWNER/Renamed");
  assert.equal(summary?.repo, "new-owner/renamed");
  assert.match(summary!.description, /such as owner\/alternative/);
  assert.doesNotThrow(() => fetchRepoSummary("owner/null-counts"));
  assert.doesNotMatch(fetchRepoSummary("owner/null-counts")!.description, /with|null stars|null forks/);
});
