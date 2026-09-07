import logger from "./logger.js";

const GITHUB_REPOSITORY = "Mubelotix/SimRepo";
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPOSITORY}`;
const PAGE_SIZE = 100;
const REFRESH_COOLDOWN_MS = 10_000;
const FULL_RECONCILE_INTERVAL_MS = 60 * 60 * 1000;

type FetchImpl = typeof fetch;
type SleepImpl = (ms: number) => Promise<void>;

interface StargazerPage {
  ids: string[];
  etag?: string;
  notModified: boolean;
}

export interface GithubStargazerCacheOptions {
  token?: string;
  fetchImpl?: FetchImpl;
  now?: () => number;
  sleep?: SleepImpl;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeGithubUserId(value: string | undefined): string | undefined {
  if (!value || !/^\d{1,20}$/.test(value)) return undefined;
  return value.replace(/^0+(?=\d)/, "");
}

function getStargazerIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("GitHub stargazers response was not an array");
  }

  const ids: string[] = [];
  for (const entry of value) {
    const user = (entry as { user?: { id?: number | string } }).user ?? entry;
    const id = normalizeGithubUserId(String((user as { id?: number | string }).id ?? ""));
    if (id) ids.push(id);
  }
  return ids;
}

export class GithubStargazerCache {
  private readonly token: string;
  private readonly fetchImpl: FetchImpl;
  private readonly now: () => number;
  private readonly sleep: SleepImpl;
  private ids = new Set<string>();
  private stargazerCount = 0;
  private lastPage = 0;
  private lastPageEtag: string | undefined;
  private lastFullReconcileAt = 0;
  private lastRefreshFinishedAt: number | null = null;
  private initialized = false;
  private refreshPromise: Promise<void> | null = null;

  constructor(options: GithubStargazerCacheOptions = {}) {
    this.token = options.token ?? process.env.GITHUB_TOKEN ?? process.env.GITHUB_API_TOKEN ?? "";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? defaultSleep;
  }

  hasCached(userId: string): boolean {
    return this.ids.has(userId);
  }

  async refreshAndHas(userId: string): Promise<boolean> {
    if (!this.token) {
      return false;
    }

    await this.refresh();
    return this.ids.has(userId);
  }

  private async refresh(): Promise<void> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const promise = this.refreshWithCooldown();
    this.refreshPromise = promise;
    try {
      await promise;
    } finally {
      if (this.refreshPromise === promise) {
        this.refreshPromise = null;
      }
    }
  }

  private async refreshWithCooldown(): Promise<void> {
    const wait = this.lastRefreshFinishedAt === null
      ? 0
      : Math.max(0, this.lastRefreshFinishedAt + REFRESH_COOLDOWN_MS - this.now());
    if (wait > 0) {
      await this.sleep(wait);
    }

    try {
      await this.sync();
    } catch (error) {
      logger.warn(`Failed to refresh GitHub stargazers: ${error}`);
    } finally {
      // Failed refreshes are cooled down too, so an upstream outage cannot cause
      // every incoming request to retry GitHub immediately.
      this.lastRefreshFinishedAt = this.now();
    }
  }

  private githubHeaders(etag?: string): HeadersInit {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/vnd.github.star+json",
      "X-GitHub-Api-Version": "2026-03-10",
      ...(etag ? { "If-None-Match": etag } : {}),
    };
  }

  private async fetchStargazerCount(): Promise<number> {
    const response = await this.fetchImpl(`${GITHUB_API}/stargazers/count`, {
      headers: this.githubHeaders(),
    });
    if (!response.ok) {
      throw new Error(`GitHub stargazer count returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as { count?: number };
    if (!Number.isInteger(data.count) || (data.count ?? 0) < 0) {
      throw new Error("GitHub stargazer count response was invalid");
    }
    return data.count as number;
  }

  private async fetchStargazerPage(page: number, etag?: string): Promise<StargazerPage> {
    const response = await this.fetchImpl(
      `${GITHUB_API}/stargazers?per_page=${PAGE_SIZE}&page=${page}`,
      { headers: this.githubHeaders(etag) },
    );
    if (response.status === 304) {
      return { ids: [], etag, notModified: true };
    }
    if (!response.ok) {
      throw new Error(`GitHub stargazers page ${page} returned HTTP ${response.status}`);
    }

    return {
      ids: getStargazerIds(await response.json()),
      etag: response.headers.get("etag") ?? undefined,
      notModified: false,
    };
  }

  private async sync(): Promise<void> {
    const count = await this.fetchStargazerCount();
    const pageCount = Math.ceil(count / PAGE_SIZE);
    const fullReconcileDue =
      !this.initialized ||
      count < this.stargazerCount ||
      this.now() - this.lastFullReconcileAt >= FULL_RECONCILE_INTERVAL_MS;

    if (fullReconcileDue) {
      await this.fullReconcile(count, pageCount);
      return;
    }

    await this.refreshNewestPages(count, pageCount);
  }

  private async fullReconcile(count: number, pageCount: number): Promise<void> {
    const ids = new Set<string>();
    let lastPageEtag: string | undefined;

    for (let page = 1; page <= pageCount; page++) {
      const result = await this.fetchStargazerPage(page);
      for (const id of result.ids) ids.add(id);
      if (page === pageCount) lastPageEtag = result.etag;
    }

    this.ids = ids;
    this.stargazerCount = count;
    this.lastPage = pageCount;
    this.lastPageEtag = lastPageEtag;
    this.lastFullReconcileAt = this.now();
    this.initialized = true;
  }

  private async refreshNewestPages(count: number, pageCount: number): Promise<void> {
    if (pageCount === 0) {
      this.ids.clear();
      this.stargazerCount = 0;
      this.lastPage = 0;
      this.lastPageEtag = undefined;
      return;
    }

    const sameLastPage = pageCount === this.lastPage;
    const newestPage = await this.fetchStargazerPage(
      pageCount,
      sameLastPage ? this.lastPageEtag : undefined,
    );

    if (newestPage.notModified) {
      this.stargazerCount = count;
      return;
    }

    let page = pageCount;
    let containsKnownUser = false;
    this.lastPageEtag = newestPage.etag;
    this.lastPage = pageCount;

    while (true) {
      const idsBeforePage = this.ids;
      containsKnownUser = newestPage.ids.some((id) => idsBeforePage.has(id));
      for (const id of newestPage.ids) this.ids.add(id);

      // GitHub returns stargazers oldest-first. Once a backwards page contains
      // a previously seen user, older pages cannot contain newly added stars.
      if (containsKnownUser || page === 1) break;
      page--;
      const previousPage = await this.fetchStargazerPage(page);
      newestPage.ids = previousPage.ids;
    }

    this.stargazerCount = count;
  }
}

export const githubStargazers = new GithubStargazerCache();

export function isCachedGithubUserStarred(userId: string | undefined): boolean {
  const normalized = normalizeGithubUserId(userId);
  return normalized ? githubStargazers.hasCached(normalized) : false;
}

export async function refreshGithubUserStarred(userId: string | undefined): Promise<boolean> {
  const normalized = normalizeGithubUserId(userId);
  return normalized ? githubStargazers.refreshAndHas(normalized) : false;
}
