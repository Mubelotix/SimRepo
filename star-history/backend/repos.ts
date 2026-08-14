import Database from "better-sqlite3";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import type { RepoData, RepoMeta, RepoRadarAttributes, StarRecord } from "../shared/types/chart";

// Radar axes stored as raw columns in repos.sqlite, keyed by the RepoRadarAttributes
// field they populate. `pushes`/`issues_closed` are intentionally excluded as
// unreliable, and `contributors` is entirely -1 (missing).
const RADAR_COLS: Record<keyof RepoRadarAttributes, string> = {
  stars: "stars",
  new_stars: "new_stars",
  forks: "forks",
  open_issues: "open_issues_count",
  size: "size",
  pushes: "pushes",
};

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
      db.exec("CREATE INDEX IF NOT EXISTS idx_repos_lower_name ON repos(lower(name))");
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

// Minimum number of star-history datapoints required for a repo to be considered
// valuable enough to plot. Repos with fewer points are treated as missing so they
// are reported to the client and never counted against a rate limit.
export const MIN_DATAPOINTS = 5;

// --- Radar attribute normalization -------------------------------------------------
// The DB stores raw values per axis (stars, forks, weekly pushes, etc.). The radar
// needs 0-99 values per axis, normalized independently (units differ). We use a log
// transform against each axis's global max so a wide range of raw values maps into
// 0-99. Per-axis maxes are computed once and memoized.

let radarMaxes: Record<string, number> | null = null;

function getRadarMaxes(db: Database.Database): Record<string, number> {
  if (radarMaxes) return radarMaxes;
  radarMaxes = {};
  for (const col of Object.values(RADAR_COLS)) {
    const row = db.prepare(`SELECT MAX(${col}) AS m FROM repos`).get() as { m: number | null };
    radarMaxes[col] = row?.m ?? 0;
  }
  return radarMaxes;
}

// Raw -> normalized 0-99. Returns -1 for missing (negative) sentinels.
function normalizeAttr(raw: number, max: number): number {
  if (raw < 0) return -1;
  if (max <= 0) return 0;
  return Math.min(99, Math.round((99 * Math.log10(raw + 1)) / Math.log10(max + 1)));
}

// Recency score for the "Last Push" axis. The raw value is days since the last
// push (lower = more recent), so we invert it: a very recent push scores near 99,
// a stale repo near 0. Returns -1 for missing (negative) sentinels.
function normalizeRecency(rawDays: number, maxDays: number): number {
  if (rawDays < 0) return -1;
  if (maxDays <= 0) return 99;
  const d = Math.max(0, Math.min(rawDays, maxDays));
  const t = Math.log10(d + 1) / Math.log10(maxDays + 1); // 0 recent .. 1 stale
  return Math.round(99 * (1 - t));
}

// --- Accurate "Top N %" from axis_percentiles ---------------------------------
// `axis_percentiles` maps each radar axis's raw value to the cumulative number
// of repos with a value <= it. This lets us report the true "top N %" a repo
// falls into, instead of the log-scale proxy (100 - normalized). `pushes` is
// days-since-last-push (lower = better), so it's inverted.

let percentileTotals: Record<string, number> | null = null;

function getPercentileTotal(db: Database.Database, axis: string): number {
  if (!percentileTotals) percentileTotals = {};
  if (percentileTotals[axis] === undefined) {
    const row = db
      .prepare("SELECT MAX(count_le) AS t FROM axis_percentiles WHERE axis = ?")
      .get(axis) as { t: number | null };
    percentileTotals[axis] = row?.t ?? 0;
  }
  return percentileTotals[axis];
}

// Returns the "top N %" (0-100, rounded) for a repo's raw value on `axis`, or
// undefined when the value is missing or the table has no applicable data.
function topPercentile(
  db: Database.Database,
  axis: string,
  rawValue: number
): number | undefined {
  if (rawValue < 0) return undefined;
  const row = db
    .prepare(
      "SELECT count_le FROM axis_percentiles WHERE axis = ? AND value <= ? ORDER BY value DESC LIMIT 1"
    )
    .get(axis, rawValue) as { count_le: number } | undefined;
  if (!row) return undefined;
  const total = getPercentileTotal(db, axis);
  if (total <= 0) return undefined;
  const fracBelowOrEqual = row.count_le / total; // 0..1
  // Higher-is-better axes: top N % = share of repos with a higher value.
  // pushes (recency): top N % = share of repos pushed more recently (lower days).
  const topN = axis === "pushes" ? 100 * fracBelowOrEqual : 100 * (1 - fracBelowOrEqual);
  return Math.max(1, Math.round(topN));
}

type RawRow = Pick<RepoRow, "stars" | "new_stars" | "forks" | "open_issues_count" | "size" | "pushes">;

function buildAttributes(
  db: Database.Database,
  row: RawRow
): { attributes: RepoRadarAttributes; raw: RepoRadarAttributes } {
  const maxes = getRadarMaxes(db);
  const raw = {} as RepoRadarAttributes;
  const attributes = {} as RepoRadarAttributes;
  for (const key of Object.keys(RADAR_COLS) as (keyof RepoRadarAttributes)[]) {
    const col = RADAR_COLS[key];
    const value = row[col as keyof RawRow] as number;
    raw[key] = value;
    // `pushes` is days-since-last-push (recency), scored differently from counts.
    attributes[key] =
      key === "pushes" ? normalizeRecency(value, maxes[col]) : normalizeAttr(value, maxes[col]);
  }
  return { attributes, raw };
}

interface RepoRow {
  logo_url: string | null;
  points: Buffer | null;
  owner: string;
  stars_total: number;
  description: string | null;
  language: string | null;
  license: string | null;
  homepage: string | null;
  forks_count: number;
  open_issues_count: number;
  created_at: string | null;
  archived: number;
  size: number;
  topics: string;
  stars: number;
  new_stars: number;
  forks: number;
  pushes: number;
  rank: number;
  total_repos: number;
}

export interface RepoStarResult {
  found: RepoData[];
  missing: string[];
}

/**
 * Retrieve star history + logo URL + repo metadata/attributes for repos from
 * repos.sqlite. Repos that don't exist in the DB, or that have fewer than
 * MIN_DATAPOINTS records (i.e. insufficient data to plot), are reported in
 * `missing`.
 */
export function fetchRepoData(repos: string[]): RepoStarResult {
  const d = getDb();
  const stmt = d.prepare(`
    SELECT logo_url, points, owner, stars_total, description, language, license,
           homepage, forks_count, open_issues_count, created_at, archived, size,
           topics, stars, new_stars, forks, pushes, rank, total_repos
    FROM repos WHERE lower(name) = lower(?)
  `);
  const found: RepoData[] = [];
  const missing: string[] = [];

  for (const repo of repos) {
    const row = stmt.get(repo) as RepoRow | undefined;
    if (!row || !row.points) {
      missing.push(repo);
      continue;
    }
    const starRecords = decodePoints(row.points);
    if (starRecords.length < MIN_DATAPOINTS) {
      missing.push(repo);
      continue;
    }
    const { attributes, raw } = buildAttributes(d, row);
    const percentiles: Partial<Record<keyof RepoRadarAttributes, number>> = {};
    for (const key of Object.keys(RADAR_COLS) as (keyof RepoRadarAttributes)[]) {
      const p = topPercentile(d, key, raw[key]);
      if (p !== undefined) percentiles[key] = p;
    }
    const meta: RepoMeta = {
      owner: row.owner,
      stars_total: row.stars_total,
      description: row.description,
      language: row.language,
      license: row.license,
      homepage: row.homepage,
      forks_count: row.forks_count,
      open_issues_count: row.open_issues_count,
      created_at: row.created_at,
      archived: !!row.archived,
      size: row.size,
      topics: parseTopics(row.topics),
      rank: row.rank,
      total_repos: row.total_repos,
      attributes,
      raw,
      percentiles,
    };
    found.push({
      repo,
      starRecords,
      logoUrl: row.logo_url ?? "",
      meta,
    });
  }

  return { found, missing };
}

function parseTopics(topics: string | null): string[] {
  if (!topics) return [];
  try {
    const parsed = JSON.parse(topics);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

export interface RepoSearchEntry {
  name: string;
  stars_total: number;
}

export interface TrustedByEntry {
  name: string;
  logoUrl: string;
  stars: number | null;
}

/**
 * Resolve a fixed list of repo names into lightweight trust indicators (icon +
 * current star count) for the homepage "Trusted by" section. Repos missing from
 * the dataset fall back to the GitHub owner avatar with unknown star count.
 */
export function fetchTrustedBy(repoNames: string[]): TrustedByEntry[] {
  const { found, missing } = fetchRepoData(repoNames);
  const foundMap = new Map(found.map((d) => [d.repo.toLowerCase(), d]));
  return repoNames
    .map((name) => {
      const d = foundMap.get(name.toLowerCase());
      if (d) {
        const last = d.starRecords[d.starRecords.length - 1];
        return { name, logoUrl: d.logoUrl, stars: last ? last.count : null };
      }
      return { name, logoUrl: `https://github.com/${name.split("/")[0]}.png?size=64`, stars: null };
    })
    .sort((a, b) => (b.stars ?? -1) - (a.stars ?? -1));
}

/**
 * Search repos by a (case-insensitive) prefix of their name, returning up to
 * `limit` matches ordered by the repo with the most stars first. Uses the
 * existing lower(name) index for the prefix lookup.
 */
export function searchRepos(query: string, limit = 8): RepoSearchEntry[] {
  const q = query.trim();
  if (!q) return [];

  const d = getDb();
  const stmt = d.prepare(
    "SELECT name, points FROM repos WHERE lower(name) LIKE ? ORDER BY length(name) LIMIT ?"
  );
  const rows = stmt.all(`${q.toLowerCase()}%`, limit + 50) as {
    name: string;
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
      return { name: row.name, stars_total };
    })
    .sort((a, b) => b.stars_total - a.stars_total)
    .slice(0, limit);
}
