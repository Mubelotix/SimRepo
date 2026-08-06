import Database from "better-sqlite3";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import type { RepoData, StarRecord } from "../shared/types/chart";

// repos.sqlite sits at the repo root (one level above this backend/ dir).
const DB_PATH = path.join(process.cwd(), "..", "repos.sqlite");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    // The DB may be bind-mounted read-only, so only apply these write
    // optimizations when the file is actually writable. They are not
    // required for reads.
    try {
      db.pragma("journal_mode = WAL");
      db.pragma("busy_timeout = 5000");
      // Case-insensitive lookup index (idempotent; safe if the DB is regenerated).
      db.exec("CREATE INDEX IF NOT EXISTS idx_repos_lower_repo ON repos(lower(repo))");
    } catch {
      // Read-only database: skip optimizations.
    }
  }
  return db;
}

/**
 * Decode the gzip-compressed `points` blob from repos.sqlite.
 * Each 8-byte point is: uint32 days since epoch + uint32 cumulative star count.
 */
function decodePoints(buf: Buffer): StarRecord[] {
  const data = gunzipSync(buf as unknown as Uint8Array);
  const records: StarRecord[] = [];
  for (let i = 0; i + 8 <= data.length; i += 8) {
    const days = data.readUInt32LE(i);
    const count = data.readUInt32LE(i + 4);
    const date = new Date(Date.UTC(1970, 0, 1) + days * 86400000).toISOString().slice(0, 10);
    records.push({ date, count });
  }
  return records;
}

export interface RepoStarResult {
  found: RepoData[];
  missing: string[];
}

/**
 * Retrieve star history + logo URL for repos from repos.sqlite.
 * Repos that don't exist in the DB are reported in `missing`.
 */
export function fetchRepoData(repos: string[]): RepoStarResult {
  const d = getDb();
  const stmt = d.prepare("SELECT logo_url, points FROM repos WHERE lower(repo) = lower(?)");
  const found: RepoData[] = [];
  const missing: string[] = [];

  for (const repo of repos) {
    const row = stmt.get(repo) as { logo_url: string | null; points: Buffer | null } | undefined;
    if (!row || !row.points) {
      missing.push(repo);
      continue;
    }
    found.push({
      repo,
      starRecords: decodePoints(row.points),
      logoUrl: row.logo_url ?? "",
    });
  }

  return { found, missing };
}

export interface RepoSearchEntry {
  name: string;
  stars_total: number;
}

/**
 * Search repos by a (case-insensitive) prefix of their name, returning up to
 * `limit` matches ordered by the repo with the most stars first. Uses the
 * existing lower(repo) index for the prefix lookup.
 */
export function searchRepos(query: string, limit = 8): RepoSearchEntry[] {
  const q = query.trim();
  if (!q) return [];

  const d = getDb();
  const stmt = d.prepare(
    "SELECT repo, points FROM repos WHERE lower(repo) LIKE ? ORDER BY length(repo) LIMIT ?"
  );
  const rows = stmt.all(`${q.toLowerCase()}%`, limit + 50) as {
    repo: string;
    points: Buffer | null;
  }[];

  return rows
    .map((row) => {
      // star count = last cumulative point in the gzip blob (if present)
      let stars_total = 0;
      if (row.points) {
        try {
          const data = gunzipSync(row.points as unknown as Uint8Array);
          if (data.length >= 8) {
            stars_total = data.readUInt32LE(data.length - 4);
          }
        } catch {
          // skip malformed points
        }
      }
      return { name: row.repo, stars_total };
    })
    .sort((a, b) => b.stars_total - a.stars_total)
    .slice(0, limit);
}
