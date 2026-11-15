import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import logger from "./logger.js";

// Existing README embeds remain valid after the hostname migration.
const DOMAINS = ["simrepo.dera.page", "star-history.dera.page"];
const CHECK_INTERVAL_MS = 40_000;
const MISMATCH_RETRY_MS = 10 * 24 * 60 * 60_000;
const README_NAMES = ["README.md", "readme.md", "Readme.md", "README.rst", "README"];
type Entry = number | null | { retryAfter: number };
const isMismatch = (entry: Entry | undefined): entry is { retryAfter: number } =>
  entry !== null && typeof entry === "object";

export class TrustedByStore {
  private readonly repos = new Map<string, Entry>();
  private queue: string[] = [];

  constructor(private readonly filename = process.env.TRUSTED_BY_PATH ?? path.join(process.cwd(), "state", "trusted-by.json")) {
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(filename, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    // Accept the previous hardcoded array as an initial set of candidates.
    if (Array.isArray(data) && data.every((name) => typeof name === "string")) {
      data = Object.fromEntries(data.map((name) => [name, null]));
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error(`Invalid trusted-by file: ${filename}`);
    }
    for (const [name, verified] of Object.entries(data)) {
      if (verified !== null && !(typeof verified === "number" && Number.isFinite(verified))
        && !(typeof verified === "object" && verified !== null
          && "retryAfter" in verified && typeof verified.retryAfter === "number" && Number.isFinite(verified.retryAfter))) {
        throw new Error(`Invalid verification date for ${name}`);
      }
      this.repos.set(name.toLowerCase(), verified as Entry);
    }
  }

  private save(): void {
    mkdirSync(path.dirname(this.filename), { recursive: true });
    const temporary = `${this.filename}.tmp`;
    writeFileSync(temporary, JSON.stringify(Object.fromEntries(this.repos), null, 2) + "\n");
    renameSync(temporary, this.filename);
  }

  observe(names: string[], now = Date.now()): void {
    let changed = false;
    for (const value of names) {
      const name = value.trim().toLowerCase();
      const entry = this.repos.get(name);
      if (/^[a-z0-9](?:[a-z0-9-]{0,38})\/[a-z0-9_.-]{1,100}$/.test(name)
        && (entry === undefined || (isMismatch(entry) && now >= entry.retryAfter))) {
        this.repos.set(name, null);
        changed = true;
      }
    }
    if (changed) this.save();
  }

  verified(): string[] {
    return [...this.repos].filter(([, verified]) => typeof verified === "number").map(([name]) => name).sort();
  }

  async verifyNext(fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<void> {
    // Random rounds: every eligible repo gets a turn, even if earlier checks fail.
    this.queue = this.queue.filter((name) => !isMismatch(this.repos.get(name)));
    if (!this.queue.length) {
      this.queue = [...this.repos].filter(([, entry]) => !isMismatch(entry)).map(([name]) => name);
    }
    if (!this.queue.length) return;
    const [name] = this.queue.splice(Math.floor(Math.random() * this.queue.length), 1);
    const mismatch = { retryAfter: now + MISMATCH_RETRY_MS };

    // The raw host silently serves old names, whereas repo pages redirect.
    const repository = await fetchImpl(`https://github.com/${name}`, {
      method: "HEAD",
      signal: AbortSignal.timeout(15_000),
    });
    if (!repository.ok && repository.status !== 404) throw new Error(`GitHub repository lookup for ${name}: ${repository.status}`);
    const canonicalName = repository.redirected
      ? new URL(repository.url).pathname.slice(1).toLowerCase()
      : name;
    const finish = (valid = false) => {
      // Remember old names too, so old embeds cannot continually requeue aliases.
      if (name !== canonicalName) this.repos.set(name, mismatch);
      this.repos.set(canonicalName, valid ? now : mismatch);
      this.save();
    };
    if (repository.status === 404) return finish();

    for (const filename of README_NAMES) {
      const response = await fetchImpl(`https://raw.githubusercontent.com/${canonicalName}/HEAD/${filename}`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (response.status === 404) continue;
      if (!response.ok) throw new Error(`GitHub README fetch for ${name}: ${response.status}`);

      const readme = await response.text();
      return finish(DOMAINS.some((domain) => readme.toLowerCase().includes(domain)));
    }
    finish();
  }

  start(): void {
    // Schedule only after completion so slow requests never overlap.
    const check = async () => {
      try {
        await this.verifyNext();
      } catch (error) {
        logger.warn(`Trusted-by verification failed: ${error}`);
      } finally {
        setTimeout(check, CHECK_INTERVAL_MS).unref();
      }
    };
    setTimeout(check, CHECK_INTERVAL_MS).unref();
  }
}
