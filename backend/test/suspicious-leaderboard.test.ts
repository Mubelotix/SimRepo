import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

test("suspicious leaderboard returns every repo below the trust threshold, most suspicious first", async (t) => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "suspicious-leaderboard-"));
  const cwd = process.cwd();
  mkdirSync(path.join(directory, "backend"));
  const db = new DatabaseSync(path.join(directory, "repos.sqlite"));
  db.exec(`
    CREATE TABLE repos (
      id INTEGER PRIMARY KEY, name TEXT, points BLOB, logo_url TEXT,
      owner TEXT DEFAULT 'owner', stars_total INTEGER DEFAULT 10,
      stars INTEGER DEFAULT 0, new_stars INTEGER DEFAULT 0,
      trust_p REAL
    );
  `);
  const insert = db.prepare(
    "INSERT INTO repos (name, stars_total, stars, trust_p, logo_url) VALUES (?, ?, ?, ?, ?)"
  );
  insert.run("owner/unscored", 9500, 9500, null, null); // no score: excluded
  insert.run("owner/excellent", 9000, 9000, 1, "https://example.com/e.png");
  insert.run("owner/low-tier", 8000, 7000, 0.05, null); // "Low" tier, not suspicious
  insert.run("owner/boundary", 7000, 7000, 0.01, null); // exactly at the threshold: not suspicious
  insert.run("owner/tiny-suspicious", 500, 10, 0.0001, null); // suspicious but exactly 500 stars: excluded
  insert.run("owner/tie-small", 501, 10, 0.005, null); // just above the star minimum: included
  insert.run("owner/tie-big", 6000, 500, 0.005, "https://example.com/big.png"); // same trust, more stars
  insert.run("owner/most-suspicious", 40000, 5, 0.0001, null);
  db.close();
  process.chdir(path.join(directory, "backend"));
  t.after(() => {
    process.chdir(cwd);
    rmSync(directory, { recursive: true, force: true });
  });

  const { fetchSuspiciousLeaderboard, SUSPICIOUS_MIN_STARS } = await import("../repos.js");
  const { SUSPICIOUS_TRUST_THRESHOLD } = await import("../../shared/common/trust.js");

  // Guard against the thresholds drifting away from the intended values.
  assert.equal(SUSPICIOUS_TRUST_THRESHOLD, 0.01);
  assert.equal(SUSPICIOUS_MIN_STARS, 500);

  const data = fetchSuspiciousLeaderboard();
  assert.match(data.updated_at, /^\d{4}-\d{2}-\d{2}$/);

  // Complete list, most suspicious first; trust ties break by stars_total DESC.
  // Repos at/below the star minimum (owner/tiny-suspicious: 500 stars) are excluded.
  assert.deepEqual(
    data.suspicious.map((r) => r.name),
    ["owner/most-suspicious", "owner/tie-big", "owner/tie-small"]
  );

  const [most, big] = data.suspicious;
  assert.equal(most.trust_p, 0.0001);
  assert.equal(most.stars_total, 40000);
  assert.equal(most.stars, 5);
  // Missing logo falls back to the owner avatar, like fetchTrustedBy.
  assert.equal(most.logo_url, "https://github.com/owner.png?size=64");
  assert.equal(big.trust_p, 0.005);
  assert.equal(big.stars_total, 6000);
  assert.equal(big.stars, 500);
  assert.equal(big.logo_url, "https://example.com/big.png");
  // Everything listed is suspicious and above the star minimum.
  for (const r of data.suspicious) {
    assert.ok(r.trust_p < SUSPICIOUS_TRUST_THRESHOLD);
    assert.ok(r.stars_total > SUSPICIOUS_MIN_STARS);
  }
});
