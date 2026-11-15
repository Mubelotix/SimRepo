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
      total_repos INTEGER DEFAULT 1
    );
    CREATE TABLE axis_percentiles (axis TEXT, value INTEGER, count_le INTEGER);
  `);
  const points = Buffer.alloc(5 * 8);
  for (let i = 0; i < 5; i++) {
    points.writeUInt32LE(20000 + i, i * 8);
    points.writeUInt32LE(i + 1, i * 8 + 4);
  }
  db.prepare("INSERT INTO repos (id, name, points) VALUES (?, ?, ?)")
    .run(123, "new-owner/renamed", gzipSync(points));
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

  const { fetchRepoData, resolveRepoId, resolveRepoName, selectTrustedByRepos } = await import("../repos.js");

  assert.equal(resolveRepoName("123"), "new-owner/renamed");
  assert.equal(resolveRepoId("NEW-OWNER/Renamed"), 123);
  assert.equal(resolveRepoName("999"), null);
  for (const invalid of ["0", "-1", "1.2", "1e2", "9007199254740993"]) {
    assert.equal(resolveRepoName(invalid), null);
  }
  assert.deepEqual(fetchRepoData(["123"]), fetchRepoData(["new-owner/renamed"]));
  assert.equal(fetchRepoData(["123"]).found[0].repo, "new-owner/renamed");
  assert.deepEqual(fetchRepoData(["999", "missing/repo"]).missing, ["999", "missing/repo"]);

  const ranked = Array.from({ length: 11 }, (_, i) => `ranked/repo-${String(i).padStart(2, "0")}`);
  const unknown = Array.from({ length: 11 }, (_, i) => `other/unknown-${String(i).padStart(2, "0")}`);
  const selected = selectTrustedByRepos(["ranked/unknown", ...unknown.reverse(), ...ranked, "other/zero"]);
  assert.deepEqual(selected.filter((name) => name.startsWith("ranked/")), ranked.slice(1).reverse());
  assert.deepEqual(selected.filter((name) => name.startsWith("other/")), ["other/zero", ...unknown.reverse().slice(0, 9)]);
  assert.deepEqual(selectTrustedByRepos(["missing/repo"]), ["missing/repo"]);
});
