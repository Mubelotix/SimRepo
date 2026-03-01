import Database from "better-sqlite3";
import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from "fs";
import { createGunzip } from "zlib";
import { get } from "https";
import { pipeline } from "stream/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "archive-data");
const DB_PATH = path.join(__dirname, "archive.db");
const BATCH_SIZE = 10_000;

// --- Argument parsing ---

function parseArgs(): { date: string; hour: number } {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const y = yesterday.getUTCFullYear();
    const m = String(yesterday.getUTCMonth() + 1).padStart(2, "0");
    const d = String(yesterday.getUTCDate()).padStart(2, "0");
    return { date: `${y}-${m}-${d}`, hour: 0 };
  }
  const date = args[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
  }
  const hour = args.length >= 2 ? parseInt(args[1], 10) : 0;
  if (isNaN(hour) || hour < 0 || hour > 23) {
    throw new Error(`Invalid hour: ${args[1]}. Expected 0-23`);
  }
  return { date, hour };
}

// --- Download ---

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        unlinkSync(dest);
        download(response.headers.location!, dest).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        file.close();
        unlinkSync(dest);
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }
      response.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", (err) => {
      file.close();
      try { unlinkSync(dest); } catch {}
      reject(err);
    });
  });
}

// --- Decompress ---

async function decompress(gzPath: string, outPath: string): Promise<void> {
  await pipeline(
    createReadStream(gzPath),
    createGunzip(),
    createWriteStream(outPath),
  );
}

// --- Schema registry ---
// Single source of truth: each event type's table, columns, indexes, and extraction logic.

function json(v: any): string | null {
  return v != null ? JSON.stringify(v) : null;
}

interface EventSchema {
  table: string;
  columns: string; // DDL fragment: "col TYPE, col TYPE, ..."
  extraIndexes?: string[];
  extract: (p: any) => any[];
}

const EVENT_SCHEMAS: Record<string, EventSchema> = {
  PushEvent: {
    table: "push_events",
    columns: "repository_id INTEGER, push_id INTEGER, ref TEXT, head TEXT, before_sha TEXT",
    extract: (p) => [p.repository_id ?? null, p.push_id ?? null, p.ref ?? null, p.head ?? null, p.before ?? null],
  },
  PullRequestEvent: {
    table: "pull_request_events",
    columns: "action TEXT, number INTEGER, pull_request TEXT, label TEXT, labels TEXT, assignee TEXT, assignees TEXT",
    extraIndexes: ["CREATE INDEX idx_pull_request_events_action ON pull_request_events(action)"],
    extract: (p) => [p.action ?? null, p.number ?? null, json(p.pull_request), json(p.label), json(p.labels), json(p.assignee), json(p.assignees)],
  },
  IssuesEvent: {
    table: "issues_events",
    columns: "action TEXT, issue TEXT, label TEXT, labels TEXT, assignee TEXT, assignees TEXT",
    extraIndexes: ["CREATE INDEX idx_issues_events_action ON issues_events(action)"],
    extract: (p) => [p.action ?? null, json(p.issue), json(p.label), json(p.labels), json(p.assignee), json(p.assignees)],
  },
  IssueCommentEvent: {
    table: "issue_comment_events",
    columns: "action TEXT, issue TEXT, comment TEXT",
    extract: (p) => [p.action ?? null, json(p.issue), json(p.comment)],
  },
  CreateEvent: {
    table: "create_events",
    columns: "ref TEXT, ref_type TEXT, full_ref TEXT, master_branch TEXT, description TEXT, pusher_type TEXT",
    extraIndexes: ["CREATE INDEX idx_create_events_ref_type ON create_events(ref_type)"],
    extract: (p) => [p.ref ?? null, p.ref_type ?? null, p.full_ref ?? null, p.master_branch ?? null, p.description ?? null, p.pusher_type ?? null],
  },
  DeleteEvent: {
    table: "delete_events",
    columns: "ref TEXT, ref_type TEXT, full_ref TEXT, pusher_type TEXT",
    extract: (p) => [p.ref ?? null, p.ref_type ?? null, p.full_ref ?? null, p.pusher_type ?? null],
  },
  WatchEvent: {
    table: "watch_events",
    columns: "action TEXT",
    extract: (p) => [p.action ?? null],
  },
  ForkEvent: {
    table: "fork_events",
    columns: "action TEXT, forkee TEXT",
    extract: (p) => [p.action ?? null, json(p.forkee)],
  },
  ReleaseEvent: {
    table: "release_events",
    columns: "action TEXT, release TEXT",
    extract: (p) => [p.action ?? null, json(p.release)],
  },
  MemberEvent: {
    table: "member_events",
    columns: "action TEXT, member TEXT",
    extract: (p) => [p.action ?? null, json(p.member)],
  },
  CommitCommentEvent: {
    table: "commit_comment_events",
    columns: "action TEXT, comment TEXT",
    extract: (p) => [p.action ?? null, json(p.comment)],
  },
  PublicEvent: {
    table: "public_events",
    columns: "",
    extract: () => [],
  },
  GollumEvent: {
    table: "gollum_events",
    columns: "pages TEXT",
    extract: (p) => [json(p.pages)],
  },
  PullRequestReviewEvent: {
    table: "pull_request_review_events",
    columns: "action TEXT, review TEXT, pull_request TEXT",
    extract: (p) => [p.action ?? null, json(p.review), json(p.pull_request)],
  },
  PullRequestReviewCommentEvent: {
    table: "pull_request_review_comment_events",
    columns: "action TEXT, comment TEXT, pull_request TEXT",
    extract: (p) => [p.action ?? null, json(p.comment), json(p.pull_request)],
  },
  DiscussionEvent: {
    table: "discussion_events",
    columns: "action TEXT, discussion TEXT",
    extract: (p) => [p.action ?? null, json(p.discussion)],
  },
};

// --- Common event columns shared by all tables ---

function columnNames(ddl: string): string[] {
  if (!ddl) return [];
  return ddl.split(",").map(col => col.trim().split(/\s+/)[0]);
}

const COMMON_DDL = `
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  public INTEGER NOT NULL DEFAULT 1,
  actor_id INTEGER,
  actor_login TEXT,
  actor_display_login TEXT,
  actor_gravatar_id TEXT,
  actor_avatar_url TEXT,
  actor_url TEXT,
  repo_id INTEGER,
  repo_name TEXT,
  repo_url TEXT,
  org_id INTEGER,
  org_login TEXT,
  org_gravatar_id TEXT,
  org_avatar_url TEXT,
  org_url TEXT,
  other TEXT`;

const COMMON_COLS = columnNames(COMMON_DDL).join(", ");
const COMMON_PLACEHOLDERS = columnNames(COMMON_DDL).map(() => "?").join(", ");

const KNOWN_EVENT_KEYS = new Set(["id", "type", "public", "created_at", "actor", "repo", "org", "payload"]);

function commonValues(event: any): any[] {
  const actor = event.actor || {};
  const repo = event.repo || {};
  const org = event.org || {};

  const otherFields: Record<string, any> = {};
  for (const key of Object.keys(event)) {
    if (!KNOWN_EVENT_KEYS.has(key)) {
      otherFields[key] = event[key];
    }
  }

  return [
    String(event.id),
    event.created_at,
    event.public === false ? 0 : 1,
    actor.id ?? null, actor.login ?? null, actor.display_login ?? null, actor.gravatar_id ?? null, actor.avatar_url ?? null, actor.url ?? null,
    repo.id ?? null, repo.name ?? null, repo.url ?? null,
    org.id ?? null, org.login ?? null, org.gravatar_id ?? null, org.avatar_url ?? null, org.url ?? null,
    Object.keys(otherFields).length > 0 ? JSON.stringify(otherFields) : null,
  ];
}

// --- Database creation (driven by EVENT_SCHEMAS) ---

function createArchiveDatabase(): Database.Database {
  for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
    try { unlinkSync(f); } catch {}
  }
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  for (const schema of Object.values(EVENT_SCHEMAS)) {
    const extraCols = schema.columns ? `,\n      ${schema.columns}` : "";
    const extraIdx = (schema.extraIndexes || []).map(s => s + ";").join("\n    ");
    db.exec(`
      CREATE TABLE ${schema.table} (${COMMON_DDL}${extraCols});
      CREATE INDEX idx_${schema.table}_repo ON ${schema.table}(repo_name);
      CREATE INDEX idx_${schema.table}_actor ON ${schema.table}(actor_login);
      CREATE INDEX idx_${schema.table}_created ON ${schema.table}(created_at);
      ${extraIdx}
    `);
  }

  return db;
}

// --- Insert preparation (driven by EVENT_SCHEMAS) ---

function prepareInserts(db: Database.Database): Record<string, Database.Statement> {
  const stmts: Record<string, Database.Statement> = {};
  for (const [eventType, schema] of Object.entries(EVENT_SCHEMAS)) {
    const names = columnNames(schema.columns);
    const extraCols = names.length > 0 ? ", " + names.join(", ") : "";
    const extraPh = names.length > 0 ? ", " + names.map(() => "?").join(", ") : "";
    stmts[eventType] = db.prepare(
      `INSERT OR IGNORE INTO ${schema.table} (${COMMON_COLS}${extraCols}) VALUES (${COMMON_PLACEHOLDERS}${extraPh})`
    );
  }
  return stmts;
}

// --- Load JSON into SQLite ---

async function loadEvents(jsonPath: string, db: Database.Database): Promise<number> {
  const stmts = prepareInserts(db);
  const typeCounts: Record<string, number> = {};

  let count = 0;
  let batch: { type: string; values: any[] }[] = [];

  const flush = db.transaction((rows: typeof batch) => {
    for (const row of rows) {
      stmts[row.type].run(...row.values);
    }
  });

  const processLine = (line: string) => {
    if (!line.trim()) return;
    let event: any;
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }

    const schema = EVENT_SCHEMAS[event.type];
    if (!schema) return;

    batch.push({ type: event.type, values: [...commonValues(event), ...schema.extract(event.payload || {})] });
    typeCounts[event.type] = (typeCounts[event.type] || 0) + 1;

    count++;
    if (batch.length >= BATCH_SIZE) {
      flush(batch);
      batch = [];
      process.stdout.write(`\r  Loaded ${count.toLocaleString()} events...`);
    }
  };

  // Split on \n only (not \r\n) to avoid breaking JSON strings that contain literal \r\n.
  const stream = createReadStream(jsonPath, { encoding: "utf-8" });
  let remainder = "";

  for await (const chunk of stream) {
    const data = remainder + chunk;
    const lines = data.split("\n");
    remainder = lines.pop()!;
    for (const line of lines) processLine(line);
  }
  processLine(remainder);

  if (batch.length > 0) {
    flush(batch);
  }
  process.stdout.write(`\r  Loaded ${count.toLocaleString()} events.   \n`);

  const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  console.log(`\nEvent types:`);
  for (const [type, cnt] of sorted) {
    console.log(`  ${type}: ${cnt.toLocaleString()}`);
  }

  return count;
}

// --- Main ---

async function main() {
  const { date, hour } = parseArgs();
  const filename = `${date}-${hour}`;
  const gzPath = path.join(DATA_DIR, `${filename}.json.gz`);
  const jsonPath = path.join(DATA_DIR, `${filename}.json`);
  const url = `https://data.gharchive.org/${filename}.json.gz`;

  mkdirSync(DATA_DIR, { recursive: true });

  if (existsSync(gzPath)) {
    console.log(`Using cached ${filename}.json.gz`);
  } else {
    console.log(`Downloading ${url} ...`);
    await download(url, gzPath);
    const size = statSync(gzPath).size;
    console.log(`  Downloaded ${(size / 1024 / 1024).toFixed(1)} MB`);
  }

  if (existsSync(jsonPath)) {
    console.log(`Using cached ${filename}.json`);
  } else {
    console.log(`Decompressing to ${filename}.json ...`);
    await decompress(gzPath, jsonPath);
    const size = statSync(jsonPath).size;
    console.log(`  Decompressed to ${(size / 1024 / 1024).toFixed(1)} MB`);
  }

  console.log(`Creating archive.db ...`);
  const db = createArchiveDatabase();

  console.log(`Loading events from ${filename}.json ...`);
  const count = await loadEvents(jsonPath, db);

  console.log(`\nTotal events: ${count.toLocaleString()}`);
  const dbSize = statSync(DB_PATH).size;
  console.log(`Database size: ${(dbSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Tables: ${Object.keys(EVENT_SCHEMAS).length}`);

  db.close();
  console.log(`\nDone! Data is in gh/archive.db — query with: sqlite3 gh/archive.db`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
