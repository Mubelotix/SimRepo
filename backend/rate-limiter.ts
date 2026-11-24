import { isIPv6 } from "node:net";
import { githubIpRanges } from "./github-ip-ranges.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Per-IP limits expressed in number of repositories fetched.
const MAX_REPOS_PER_HOUR = 10;
const MAX_REPOS_PER_DAY = 25;

// Per-IP limits for the /similar-repos endpoints, expressed in number of
// requests (each request counts once, regardless of how many recommendations it
// returns).
const MAX_SIMILAR_REPOS_PER_HOUR = 6;
const MAX_SIMILAR_REPOS_PER_DAY = 8;

// Higher limits for /similar-repos requests from users who starred SimRepo.
const MAX_SIMILAR_REPOS_PER_HOUR_STARRED = 60;
const MAX_SIMILAR_REPOS_PER_DAY_STARRED = 100;

// Human-readable message sent when a non-whitelisted client is throttled.
// Deliberately avoids exposing the exact numeric limits.
export const RATE_LIMIT_MESSAGE =
  "We're a new project with limited resources and we're getting a lot of traffic " +
  "right now, so we had to temporarily reduce how much data a single visitor can " +
  "receive. Please consider sponsoring us at https://github.com/sponsors/Mubelotix " +
  "so we can keep the lights on and scale up. Note: requests made through GitHub's " +
  "CDN proxies are not rate-limited, so it's safe to embed chart images directly in " +
  "your READMEs.";

// Message sent when a client is throttled on /similar-repos. Deliberately avoids
// exposing the exact limits.
export const SIMILAR_REPOS_RATE_LIMIT_MESSAGE =
  "You've reached the limit for similar-repositories lookups. " +
  "Star SimRepo on GitHub to increase your usage limits.";

export const STARRED_SIMILAR_REPOS_RATE_LIMIT_MESSAGE =
  "You've reached the increased limit for similar-repositories lookups. Please try again later.";

// Repository fetches by IPv4 address or IPv6 /64.
const ipEvents = new Map<string, { ts: number; count: number }[]>();

// Similar-repo requests by IP bucket or GitHub user ID.
const similarRepoEvents = new Map<string, number[]>();

// --- Whitelist ---

export function isWhitelisted(ip: string): boolean {
  return githubIpRanges.has(ip);
}

export function isGithubCamoUserAgent(userAgent: string | undefined): boolean {
  return userAgent ? /^github-camo(?:\s|\(|$)/i.test(userAgent) : false;
}

// --- Core limit logic ---

export function ipBucket(ip: string): string {
  if (!isIPv6(ip)) return ip;

  const address = new URL(`http://[${ip.split("%", 1)[0]}]`).hostname.slice(1, -1);
  const mapped = /^::ffff:([\da-f]+):([\da-f]+)$/.exec(address);
  if (mapped) {
    return mapped.slice(1).flatMap((group) => {
      const word = parseInt(group, 16);
      return [word >> 8, word & 255];
    }).join(".");
  }

  // Expand omitted zero groups before retaining the first 64 bits.
  const [head, tail] = address.split("::");
  const groups = head ? head.split(":") : [];
  if (tail !== undefined) {
    const suffix = tail ? tail.split(":") : [];
    groups.push(...Array(8 - groups.length - suffix.length).fill("0"), ...suffix);
  }
  return `${groups.slice(0, 4).join(":")}::/64`;
}

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
  const key = ipBucket(ip);
  const events = ipEvents.get(key) ?? [];
  const pruned = pruneOld(events);
  ipEvents.set(key, pruned);

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
 * Register an attempt to fetch similar repos for the given rate-limit key.
 * Returns true if allowed (consuming the quota) or false if it would exceed a limit.
 * Known stargazers get a higher quota.
 */
export function tryFetchSimilarRepos(client: { ip: string } | { githubUserId: string }): boolean {
  const isStarred = "githubUserId" in client;
  const key = isStarred ? `github:${client.githubUserId}` : `ip:${ipBucket(client.ip)}`;
  const now = Date.now();
  const events = (similarRepoEvents.get(key) ?? []).filter((ts) => now - ts < DAY_MS);
  similarRepoEvents.set(key, events);

  const hourly = events.filter((ts) => now - ts < HOUR_MS).length;
  const maxPerHour = isStarred ? MAX_SIMILAR_REPOS_PER_HOUR_STARRED : MAX_SIMILAR_REPOS_PER_HOUR;
  const maxPerDay = isStarred ? MAX_SIMILAR_REPOS_PER_DAY_STARRED : MAX_SIMILAR_REPOS_PER_DAY;
  if (hourly >= maxPerHour || events.length >= maxPerDay) {
    return false;
  }

  events.push(now);
  return true;
}
