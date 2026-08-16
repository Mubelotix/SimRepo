import { DatabaseSync } from "node:sqlite";
import { gunzipSync } from "node:zlib";
import { statSync } from "node:fs";
import path from "node:path";
import type { RepoData, RepoMeta, RepoRadarAttributes, SimilarRepo, StarRecord } from "../shared/types/chart";

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

// Opened with `immutable=1`: the file is treated as read-only and never-changing,
// so SQLite skips the WAL/shm machinery entirely. This avoids reading/recovering
// a potentially large WAL at startup (the source of the CPU spike) and never
// attempts to write or checkpoint. Safe because repos.sqlite is produced by an
// external ingest pipeline and swapped in atomically. Applied in prod and dev.
const DB_URI = `file:${DB_PATH}?immutable=1`;

let db: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (!db) {
    db = new DatabaseSync(DB_URI, { readOnly: true });
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

function getRadarMaxes(db: DatabaseSync): Record<string, number> {
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
// `axis_percentiles` maps each radar axis's raw value to `count_le`, the number
// of repos with a value <= it (cumulative). Reading count_le of the largest
// bucket at-or-below a repo's value yields the number of repos with a value
// <= it, which is what we need to report the true "top N %" the repo falls
// into. `pushes` is days-since-last-push (lower = better), so it's inverted.
// `size` is stored negated (smaller repo = higher value), so lookups use -size.

let percentileTotal: number | null = null;

function getPercentileTotal(db: DatabaseSync): number {
  if (percentileTotal === null) {
    const row = db
      .prepare("SELECT MAX(total_repos) AS t FROM repos")
      .get() as { t: number | null };
    percentileTotal = row?.t ?? 0;
  }
  return percentileTotal;
}

// Returns the "top N %" (0-100, rounded) for a repo's raw value on `axis`, or
// undefined when the value is missing or the table has no applicable data.
function topPercentile(
  db: DatabaseSync,
  axis: string,
  rawValue: number
): number | undefined {
  if (rawValue === null || rawValue === undefined || Number.isNaN(rawValue)) return undefined;
  // `pushes`/`open_issues` use -1 as a "no data" sentinel; `size` is always >= 0.
  if (rawValue < 0) return undefined;
  // `size` is stored negated (smaller repo = higher value), so invert the lookup.
  const lookup = axis === "size" ? -rawValue : rawValue;
  // Count of repos with a value `<= lookup`, read from the largest bucket
  // at-or-below `lookup`. Falls back to the axis max (i.e. every repo ranks
  // at-or-below it) when `lookup` is at/above the top bucket.
  const row = db
    .prepare(
      "SELECT count_le FROM axis_percentiles WHERE axis = ? AND value <= ? ORDER BY value DESC LIMIT 1"
    )
    .get(axis, lookup) as { count_le: number } | undefined;
  const countBelowOrEqual =
    row?.count_le ??
    (db
      .prepare("SELECT MAX(count_le) AS c FROM axis_percentiles WHERE axis = ?")
      .get(axis) as { c: number | null })?.c ??
    0;
  const total = getPercentileTotal(db);
  if (total <= 0) return undefined;
  const fracBelowOrEqual = countBelowOrEqual / total; // 0..1
  // Higher-is-better axes: top N % = share of repos with a higher value.
  // pushes (recency): top N % = share of repos pushed more recently (lower days).
  const topN = axis === "pushes" ? 100 * fracBelowOrEqual : 100 * (1 - fracBelowOrEqual);
  return Math.max(1, Math.round(topN));
}

type RawRow = Pick<RepoRow, "stars" | "new_stars" | "forks" | "open_issues_count" | "size" | "pushes">;

function buildAttributes(
  db: DatabaseSync,
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

/**
 * Resolve a repo name (e.g. "torvalds/linux") to its GitHub numeric repository id
 * as stored in repos.sqlite. The id doubles as the Qdrant point id used by the
 * v1 (browser-extension) recommendation engine, so this is what the comparison
 * page needs to query Qdrant's recommend endpoint for a given repo.
 */
export function resolveRepoId(repoName: string): number | null {
  const d = getDb();
  const row = d
    .prepare("SELECT id FROM repos WHERE lower(name) = lower(?)")
    .get(repoName) as { id: number } | undefined;
  return row?.id ?? null;
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

/**
 * Fetch up to `limit` most similar repositories to `repoName`, skipping the
 * first `offset` candidates, from the similar_repos table. Scores are stored as
 * little-endian f32 blobs, so they are decoded and sorted in JS. Returns the
 * recommendations (with their display metadata) ordered by descending similarity.
 */
export function fetchSimilarRepos(repoName: string, offset: number, limit: number): SimilarRepo[] {
  const d = getDb();
  const repoRow = d
    .prepare("SELECT id FROM repos WHERE lower(name) = lower(?)")
    .get(repoName) as { id: number } | undefined;
  if (!repoRow) return [];

  const candidates = d
    .prepare("SELECT similar_repo, score FROM similar_repos WHERE repo = ?")
    .all(repoRow.id) as { similar_repo: number; score: Uint8Array | null }[];

  if (candidates.length === 0) return [];

  const similar = candidates
    .map((c) => {
      const buf = c.score ? Buffer.from(c.score) : null;
      return {
        id: c.similar_repo,
        score: buf && buf.length >= 4 ? buf.readFloatLE(0) : 0,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(offset, offset + limit);

  const metaStmt = d.prepare(`
    SELECT name, owner, stars_total, description, language, license, homepage,
           forks_count, open_issues_count, topics, rank, logo_url, archived
    FROM repos WHERE id = ?
  `);

  const results: SimilarRepo[] = [];
  for (const s of similar) {
    const row = metaStmt.get(s.id) as
      | {
          name: string;
          owner: string;
          stars_total: number;
          description: string | null;
          language: string | null;
          license: string | null;
          homepage: string | null;
          forks_count: number;
          open_issues_count: number;
          topics: string;
          rank: number;
          logo_url: string | null;
          archived: number;
        }
      | undefined;
    if (!row) continue;
    results.push({
      repo: row.name,
      score: s.score,
      logoUrl: row.logo_url ?? "",
      meta: {
        owner: row.owner,
        description: row.description,
        language: row.language,
        license: row.license,
        homepage: row.homepage,
        stars_total: row.stars_total,
        forks_count: row.forks_count,
        open_issues_count: row.open_issues_count,
        topics: parseTopics(row.topics),
        rank: row.rank,
        archived: !!row.archived,
      },
    });
  }

  return results;
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

// Lower bound terminator used to turn a prefix match into an indexed range
// scan. U+FFFF is invalid in UTF-8 so no real repo name ever contains it,
// making `[q, q || '\uffff')` an exact match for "starts with q".
const PREFIX_TERMINATOR = "\uffff";

/** Indexed prefix search over `expr`. Requires a matching expression index. */
const RANGE_SQL = (expr: string) =>
  `SELECT name, stars_total FROM repos WHERE ${expr} >= ? AND ${expr} < ? ORDER BY stars_total DESC LIMIT ?`;

/**
 * Search repos by a (case-insensitive) prefix of their name, returning up to
 * `limit` matches ordered by the repo with the most stars first. A repo matches
 * if either its owner (`owner/...`) or its repo name (`owner/name`) starts with
 * the query. Each prefix lookup is a range scan over its own expression index,
 * truncated to the top `limit` by stars -- the global top-N is always a subset
 * of the union of the two per-list top-Ns, so truncating before the merge keeps
 * results correct while bounding work on short queries.
 */
export function searchRepos(query: string, limit = 8): RepoSearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const d = getDb();
  const upper = q + PREFIX_TERMINATOR;
  const rows = [
    ...d.prepare(RANGE_SQL("lower(name)")).all(q, upper, limit),
    ...d.prepare(RANGE_SQL("lower(substr(name, instr(name, '/') + 1))")).all(q, upper, limit),
  ] as unknown as RepoSearchEntry[];

  const seen = new Set<string>();
  const byName = new Map<string, RepoSearchEntry>();
  for (const row of rows) {
    if (seen.has(row.name)) continue;
    seen.add(row.name);
    byName.set(row.name, row);
  }

  return Array.from(byName.values())
    .sort((a, b) => b.stars_total - a.stars_total)
    .slice(0, limit);
}

export interface LeaderboardEntry {
  name: string;
  stars_total: number;
  new_stars: number;
  logo_url: string;
}

export interface LeaderboardTier {
  threshold: number;
  label: string;
  count: number;
}

export interface LeaderboardData {
  updated_at: string;
  all_time: LeaderboardEntry[];
  weekly: LeaderboardEntry[];
  tiers: LeaderboardTier[];
}

// Star-count buckets for the pyramid tab, highest first. Mirrors the thresholds
// the old arena pipeline used when this data was fetched from the GitHub API.
const TIER_THRESHOLDS: { threshold: number; label: string }[] = [
  { threshold: 100000, label: "100K+" },
  { threshold: 50000, label: "50K+" },
  { threshold: 20000, label: "20K+" },
  { threshold: 10000, label: "10K+" },
  { threshold: 5000, label: "5K+" },
  { threshold: 3000, label: "3K+" },
  { threshold: 1000, label: "1K+" },
  { threshold: 500, label: "500+" },
  { threshold: 100, label: "100+" },
];

/**
 * Leaderboard data for the sidebar: top repos by total stars ("All-time"), top
 * repos by recent star growth ("Weekly"), and a tier histogram of star counts
 * ("Pyramid"). All read from repos.sqlite.
 */
export function fetchLeaderboard(limit = 20): LeaderboardData {
  const d = getDb();

  const allTimeStmt = d.prepare(
    "SELECT name, stars_total, new_stars, logo_url FROM repos ORDER BY stars_total DESC LIMIT ?"
  );
  const weeklyStmt = d.prepare(
    "SELECT name, stars_total, new_stars, logo_url FROM repos ORDER BY new_stars DESC LIMIT ?"
  );

  const tierSelect = TIER_THRESHOLDS.map(
    (t, i) => `SUM(CASE WHEN stars_total >= ${t.threshold} THEN 1 ELSE 0 END) AS t${i}`
  ).join(", ");
  const tierRow = d.prepare(`SELECT ${tierSelect} FROM repos`).get() as Record<string, number>;
  const tiers: LeaderboardTier[] = TIER_THRESHOLDS.map((t, i) => ({
    ...t,
    count: tierRow[`t${i}`] ?? 0,
  }));

  let updated_at: string;
  try {
    updated_at = new Date(statSync(DB_PATH).mtime).toISOString().slice(0, 10);
  } catch {
    updated_at = new Date().toISOString().slice(0, 10);
  }

  return {
    updated_at,
    all_time: allTimeStmt.all(limit).map((r) => ({
      name: String(r.name),
      stars_total: Number(r.stars_total),
      new_stars: Number(r.new_stars),
      logo_url: String(r.logo_url),
    })),
    weekly: weeklyStmt.all(limit).map((r) => ({
      name: String(r.name),
      stars_total: Number(r.stars_total),
      new_stars: Number(r.new_stars),
      logo_url: String(r.logo_url),
    })),
    tiers,
  };
}
