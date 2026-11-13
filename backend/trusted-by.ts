import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import logger from "./logger.js";

const DOMAIN = "star-history.dera.page";
const CHECK_INTERVAL_MS = 2 * 60_000;
const README_NAMES = ["README.md", "readme.md", "Readme.md", "README.rst", "README"];

export class TrustedByStore {
  private readonly repos = new Map<string, number | null>();

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
      if (verified !== null && (typeof verified !== "number" || !Number.isFinite(verified))) {
        throw new Error(`Invalid verification date for ${name}`);
      }
      this.repos.set(name.toLowerCase(), verified);
    }
  }

  private save(): void {
    mkdirSync(path.dirname(this.filename), { recursive: true });
    const temporary = `${this.filename}.tmp`;
    writeFileSync(temporary, JSON.stringify(Object.fromEntries(this.repos), null, 2) + "\n");
    renameSync(temporary, this.filename);
  }

  observe(names: string[]): void {
    let changed = false;
    for (const value of names) {
      const name = value.trim().toLowerCase();
      if (/^[a-z0-9](?:[a-z0-9-]{0,38})\/[a-z0-9_.-]{1,100}$/.test(name) && !this.repos.has(name)) {
        this.repos.set(name, null);
        changed = true;
      }
    }
    if (changed) this.save();
  }

  verified(): string[] {
    return [...this.repos].filter(([, verified]) => verified !== null).map(([name]) => name).sort();
  }

  async verifyOldest(fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<void> {
    const oldest = [...this.repos].sort((a, b) =>
      (a[1] ?? -Infinity) - (b[1] ?? -Infinity) || a[0].localeCompare(b[0])
    )[0];
    if (!oldest) return;
    const [name] = oldest;

    // The raw host silently serves old names, whereas repo pages redirect.
    const repository = await fetchImpl(`https://github.com/${name}`, {
      method: "HEAD",
      signal: AbortSignal.timeout(15_000),
    });
    if (repository.status === 404) {
      this.repos.delete(name);
      this.save();
      return;
    }
    if (!repository.ok) throw new Error(`GitHub repository lookup for ${name}: ${repository.status}`);
    const canonicalName = repository.redirected
      ? new URL(repository.url).pathname.slice(1).toLowerCase()
      : name;

    for (const filename of README_NAMES) {
      const response = await fetchImpl(`https://raw.githubusercontent.com/${canonicalName}/HEAD/${filename}`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (response.status === 404) continue;
      if (!response.ok) throw new Error(`GitHub README fetch for ${name}: ${response.status}`);

      const readme = await response.text();
      this.repos.delete(name);
      if (readme.toLowerCase().includes(DOMAIN)) {
        this.repos.set(canonicalName, now);
      } else {
        this.repos.delete(canonicalName);
      }
      this.save();
      return;
    }
    this.repos.delete(name);
    this.repos.delete(canonicalName);
    this.save();
  }

  start(): void {
    // Schedule only after completion so slow requests never overlap. Failures
    // leave the oldest row in place and retry after the same cooldown.
    const check = async () => {
      try {
        await this.verifyOldest();
      } catch (error) {
        logger.warn(`Trusted-by verification failed: ${error}`);
      } finally {
        setTimeout(check, CHECK_INTERVAL_MS).unref();
      }
    };
    setTimeout(check, CHECK_INTERVAL_MS).unref();
  }
}
