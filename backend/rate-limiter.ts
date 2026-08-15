import { BlockList, isIPv6 } from "node:net";
import logger from "./logger.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Per-IP limits expressed in number of repositories fetched.
const MAX_REPOS_PER_HOUR = 10;
const MAX_REPOS_PER_DAY = 25;

// Per-IP limits for the /similar-repos endpoint, expressed in number of
// requests (each request counts once, regardless of how many recommendations it
// returns).
const MAX_SIMILAR_REPOS_PER_HOUR = 5;
const MAX_SIMILAR_REPOS_PER_DAY = 7;

// Higher per-IP limits for /similar-repos requests that come from the official
// SimRepo browser extension (identified by its Origin header).
const MAX_SIMILAR_REPOS_PER_HOUR_EXTENSION = 40;
const MAX_SIMILAR_REPOS_PER_DAY_EXTENSION = 65;

// Origin headers of the official SimRepo browser extension (Chrome and Firefox).
export const EXTENSION_ORIGINS = new Set([
  "chrome-extension://jieoogmcigenidbkgnkaakagdnlnieap",
  "moz-extension://c157d40e-631c-4a1a-b63b-04a6f331eea8",
]);

export function isExtensionOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  return EXTENSION_ORIGINS.has(origin.toLowerCase());
}

// Human-readable message sent when a non-whitelisted client is throttled.
// Deliberately avoids exposing the exact numeric limits.
export const RATE_LIMIT_MESSAGE =
  "We're a new project with limited resources and we're getting a lot of traffic " +
  "right now, so we had to temporarily reduce how much data a single visitor can " +
  "receive. Please consider sponsoring us at https://github.com/sponsors/Mubelotix " +
  "so we can keep the lights on and scale up. Note: requests made through GitHub's " +
  "CDN proxies are not rate-limited, so it's safe to embed chart images directly in " +
  "your READMEs.";

// Message sent when a non-whitelisted client is throttled on /similar-repos.
// Points to the browser extension, which fetches recommendations through a
// separate (non-rate-limited) pipeline. Deliberately avoids the exact limits.
export const SIMILAR_REPOS_RATE_LIMIT_MESSAGE =
  "You've reached the limit for similar-repositories lookups on the website. " +
  "Install the SimRepo browser extension to keep exploring similar repositories " +
  "without limits.";

// The window buckets per IP. We only keep events for the daily window since it is
// the largest; the hourly total is derived from the same list.
const ipEvents = new Map<string, { ts: number; count: number }[]>();

// Request timestamps for the /similar-repos endpoint, keyed by IP. Only kept for
// the daily window; the hourly total is derived from the same list.
const similarRepoEvents = new Map<string, number[]>();

// --- Whitelist ---

// Configured in RATE_LIMIT_WHITELIST_IPS as a comma-separated list of IPs that are
// either fully qualified (e.g. "192.168.1.1") or CIDR ranges (e.g. "10.0.0.0/8",
// "2001:db8::/32").
const whitelist = new BlockList();

function addWhitelistEntry(entry: string): void {
  const trimmed = entry.trim();
  if (!trimmed) return;

  const slash = trimmed.indexOf("/");
  if (slash === -1) {
    // Fully qualified IP (v4 or v6). addAddress needs an explicit family for v6.
    whitelist.addAddress(trimmed, isIPv6(trimmed) ? "ipv6" : "ipv4");
    logger.info(`rate limit: whitelisted IP ${trimmed}`);
    return;
  }

  const address = trimmed.slice(0, slash);
  const prefix = Number(trimmed.slice(slash + 1));
  if (Number.isNaN(prefix)) {
    logger.warn(`rate limit: ignoring invalid whitelist entry "${trimmed}"`);
    return;
  }

  // net.BlockList requires adding v4 vs v6 subnets separately, and v6 subnets need
  // an explicit family (otherwise it throws ERR_INVALID_ADDRESS).
  whitelist.addSubnet(address, prefix, isIPv6(address) ? "ipv6" : "ipv4");
  logger.info(`rate limit: whitelisted subnet ${trimmed}`);
}

const whitelistEnv = process.env.RATE_LIMIT_WHITELIST_IPS;
if (whitelistEnv) {
  whitelistEnv.split(",").forEach(addWhitelistEntry);
} else {
  logger.info("rate limit: no whitelist configured (RATE_LIMIT_WHITELIST_IPS unset)");
}

export function isWhitelisted(ip: string): boolean {
  if (!ip) return false;
  return whitelist.check(ip);
}

// --- Core limit logic ---

function pruneOld(events: { ts: number; count: number }[]): { ts: number; count: number }[] {
  const cutoff = Date.now() - DAY_MS;
  let i = 0;
  while (i < events.length && events[i].ts < cutoff) i++;
  return events.slice(i);
}

function sumSince(events: { ts: number; count: number }[], since: number): number {
  let total = 0;
  for (const e of events) {
    if (e.ts >= since) total += e.count;
  }
  return total;
}

/**
 * Register an attempt to fetch `count` repositories for the given IP.
 * Returns true if allowed (consuming the quota) or false if it would exceed a limit.
 * Whitelisted IPs are handled by the caller and never reach here.
 */
export function tryFetchRepos(ip: string, count: number): boolean {
  const now = Date.now();
  const events = ipEvents.get(ip) ?? [];
  const pruned = pruneOld(events);
  ipEvents.set(ip, pruned);

  if (count <= 0) return true;

  const hourSince = now - HOUR_MS;
  const hourly = sumSince(pruned, hourSince);
  const daily = sumSince(pruned, now - DAY_MS);

  if (hourly + count > MAX_REPOS_PER_HOUR || daily + count > MAX_REPOS_PER_DAY) {
    return false;
  }

  pruned.push({ ts: now, count });
  return true;
}

/**
 * Register an attempt to fetch similar repos for the given IP.
 * Returns true if allowed (consuming the quota) or false if it would exceed a limit.
 * Whitelisted IPs are handled by the caller and never reach here. Requests from
 * a recognized browser extension (`isExtension`) get a higher quota.
 */
export function tryFetchSimilarRepos(ip: string, isExtension = false): boolean {
  const now = Date.now();
  const events = (similarRepoEvents.get(ip) ?? []).filter((ts) => now - ts < DAY_MS);
  similarRepoEvents.set(ip, events);

  const hourly = events.filter((ts) => now - ts < HOUR_MS).length;
  const maxPerHour = isExtension ? MAX_SIMILAR_REPOS_PER_HOUR_EXTENSION : MAX_SIMILAR_REPOS_PER_HOUR;
  const maxPerDay = isExtension ? MAX_SIMILAR_REPOS_PER_DAY_EXTENSION : MAX_SIMILAR_REPOS_PER_DAY;
  if (hourly >= maxPerHour || events.length >= maxPerDay) {
    return false;
  }

  events.push(now);
  return true;
}
