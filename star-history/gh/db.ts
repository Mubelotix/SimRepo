import Database from "better-sqlite3";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Minimum star count a repo must have to be included in the dataset.
export const MIN_STARS = 50000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
mkdirSync(DATA_DIR, { recursive: true });

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Format a Date to "Mar 1, 2026" style. */
export function formatDate(d: Date): string {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** Convert ISO week "2026-W09" to Monday of that week as a Date. */
function weekToMonday(week: string): Date {
  const match = week.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return new Date();
  const year = parseInt(match[1]);
  const weekNum = parseInt(match[2]);
  // Jan 4 is always in ISO week 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (weekNum - 1) * 7);
  return monday;
}

/** Format ISO week "2026-W08" as "Feb 16 – 22, 2026" date range. */
function formatWeekRange(week: string): string {
  const monday = weekToMonday(week);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const monMonth = MONTHS[monday.getUTCMonth()];
  const sunMonth = MONTHS[sunday.getUTCMonth()];
  const year = sunday.getUTCFullYear();

  if (monday.getUTCMonth() === sunday.getUTCMonth()) {
    return `${monMonth} ${monday.getUTCDate()} – ${sunday.getUTCDate()}, ${year}`;
  }
  return `${monMonth} ${monday.getUTCDate()} – ${sunMonth} ${sunday.getUTCDate()}, ${year}`;
}

export function getWeeklyDate(db: Database.Database): string {
  const { week } = db.prepare(
    "SELECT MAX(week) AS week FROM weekly_stats"
  ).get() as { week: string };
  return week ? formatWeekRange(week) : "";
}

export function exportLeaderboard(db: Database.Database, updatedAt: string, limit = 20): void {
  const rows = db.prepare(
    "SELECT name, stars_total FROM repos ORDER BY stars_total DESC LIMIT ?"
  ).all(limit) as { name: string; stars_total: number }[];

  const output = { updated_at: updatedAt, repos: rows };
  const outPath = path.join(DATA_DIR, "leaderboard.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n");
  console.log(`Exported top ${rows.length} repos to leaderboard.json`);
}

export function exportWeeklyRanking(db: Database.Database, updatedAt: string, limit = 20): void {
  const rows = db.prepare(`
    SELECT w.repo_name AS name, w.new_stars, r.stars_total
    FROM weekly_stats w
    JOIN repos r ON r.name = w.repo_name
    WHERE w.week = (SELECT MAX(week) FROM weekly_stats)
    ORDER BY w.new_stars DESC
    LIMIT ?
  `).all(limit) as { name: string; new_stars: number; stars_total: number }[];

  const output = { updated_at: updatedAt, repos: rows };
  const outPath = path.join(DATA_DIR, "weekly-ranking.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n");
  console.log(`Exported top ${rows.length} repos by weekly stars to weekly-ranking.json`);
}

export function exportRepos(db: Database.Database): void {
  // Aggregate weekly_stats over last 8 weeks per repo
  const rows = db.prepare(`
    WITH recent AS (
      SELECT week FROM weekly_stats GROUP BY week ORDER BY week DESC LIMIT 8
    ),
    agg AS (
      SELECT
        w.repo_name,
        SUM(w.new_stars) AS agg_new_stars,
        SUM(w.pushes) AS agg_pushes,
        SUM(w.unique_contributors) AS agg_contributors,
        SUM(w.issues_closed) AS agg_issues_closed
      FROM weekly_stats w
      WHERE w.week IN (SELECT week FROM recent)
      GROUP BY w.repo_name
    )
    SELECT
      r.name,
      r.owner,
      r.stars_total,
      r.description,
      r.language,
      r.topics,
      r.license,
      r.homepage,
      r.forks_count,
      r.open_issues_count,
      r.created_at,
      r.archived,
      r.size,
      COALESCE(a.agg_new_stars, 0) AS agg_new_stars,
      COALESCE(a.agg_pushes, 0) AS agg_pushes,
      COALESCE(a.agg_contributors, 0) AS agg_contributors,
      COALESCE(a.agg_issues_closed, 0) AS agg_issues_closed,
      ROW_NUMBER() OVER (ORDER BY r.stars_total DESC) AS rank
    FROM repos r
    LEFT JOIN agg a ON a.repo_name = r.name
    ORDER BY r.stars_total DESC
  `).all() as any[];

  const totalRepos = rows.length;

  // Compute raw values for percentile ranking
  const rawValues = {
    stars: rows.map((r) => r.stars_total as number),
    new_stars: rows.map((r) => r.agg_new_stars as number),
    pushes: rows.map((r) => r.agg_pushes as number),
    contributors: rows.map((r) => r.agg_contributors as number),
    issues_closed: rows.map((r) => r.agg_issues_closed as number),
    forks: rows.map((r) => r.forks_count as number),
  };

  // Percentile: fraction of values strictly less than this value, scaled to 0-99
  function percentile(sorted: number[], value: number): number {
    let count = 0;
    for (const v of sorted) {
      if (v < value) count++;
    }
    return Math.round((count / sorted.length) * 99);
  }

  const sorted = {
    stars: [...rawValues.stars].sort((a, b) => a - b),
    new_stars: [...rawValues.new_stars].sort((a, b) => a - b),
    pushes: [...rawValues.pushes].sort((a, b) => a - b),
    contributors: [...rawValues.contributors].sort((a, b) => a - b),
    issues_closed: [...rawValues.issues_closed].sort((a, b) => a - b),
    forks: [...rawValues.forks].sort((a, b) => a - b),
  };

  const cards = rows.map((r, i) => {
    let topics: string[] = [];
    try {
      topics = r.topics ? JSON.parse(r.topics) : [];
    } catch {
      topics = [];
    }

    return {
      name: r.name,
      owner: r.owner,
      stars_total: r.stars_total,
      description: r.description,
      language: r.language,
      topics,
      license: r.license,
      homepage: r.homepage,
      forks_count: r.forks_count,
      open_issues_count: r.open_issues_count,
      created_at: r.created_at,
      archived: r.archived === 1,
      size: r.size,
      rank: r.rank,
      total_repos: totalRepos,
      attributes: {
        stars: percentile(sorted.stars, rawValues.stars[i]),
        new_stars: percentile(sorted.new_stars, rawValues.new_stars[i]),
        pushes: percentile(sorted.pushes, rawValues.pushes[i]),
        contributors: percentile(sorted.contributors, rawValues.contributors[i]),
        issues_closed: percentile(sorted.issues_closed, rawValues.issues_closed[i]),
        forks: percentile(sorted.forks, rawValues.forks[i]),
      },
    };
  });

  const output = { min_stars: MIN_STARS, repos: cards };
  const outPath = path.join(DATA_DIR, "repos.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n");
  console.log(`Exported ${cards.length} repos to repos.json`);
}

export function exportStarCounts(db: Database.Database, updatedAt: string): void {
  const rows = db.prepare(
    "SELECT threshold, label, count FROM star_counts ORDER BY threshold DESC"
  ).all() as { threshold: number; label: string; count: number }[];

  const output = { updated_at: updatedAt, tiers: rows };
  const outPath = path.join(DATA_DIR, "star-count.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n");
  console.log(`Exported ${rows.length} star count tiers to star-count.json`);
}
