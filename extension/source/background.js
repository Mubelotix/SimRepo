import { initCache } from './cache.js';
import { METRICS_ENDPOINT, METRICS_WEBSITE_ID } from './analytics.js';
import { optionsStorage } from './options-storage.js';

async function handleReportMessage(message) {
    try {
        await fetch(METRICS_ENDPOINT, {
            method: "POST",
            credentials: "omit",
            mode: "cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                type: "event",
                payload: message.payload,
            }),
        });
    } catch (error) {
        console.error("Failed to send usage statistics:", error);
    }
}

async function reportRateLimitEvent(repo, page) {
    const options = await optionsStorage.getAll();
    if (!options.metricsEnabled) {
        return;
    }

    try {
        await fetch(METRICS_ENDPOINT, {
            method: "POST",
            credentials: "omit",
            mode: "cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                type: "event",
                payload: {
                    website: METRICS_WEBSITE_ID,
                    name: "rate-limit",
                    data: { repo, page },
                },
            }),
        });
    } catch (error) {
        console.error("Failed to send rate-limit event:", error);
    }
}


const BATCH_RECOMMENDATIONS_URL = "https://simrepo.dera.page/similar-repos/batch";
const DEFAULT_RANK_PROBABILITY = 0.5;

async function getBatchSimilarRepos(ids, rankProbability = DEFAULT_RANK_PROBABILITY, githubUserId = null) {
    const params = new URLSearchParams();
    if (githubUserId) {
        params.set("user_id", githubUserId);
    }

    const url = `${BATCH_RECOMMENDATIONS_URL}${params.toString() ? `?${params}` : ""}`;
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            repo_ids: ids,
            rank_probability: rankProbability,
        }),
    });

    const text = await response.text();
    const contentType = response.headers.get("Content-Type") || "";
    const hasJsonResponse = contentType.toLowerCase().includes("json");
    if (!response.ok || !hasJsonResponse) {
        const trimmedText = text.trim();
        const detail = response.ok || trimmedText.startsWith("<") ? "" : trimmedText;
        const error = new Error(
            detail || (
                response.ok
                    ? "Batch recommendations API returned a non-JSON response."
                    : `Failed to fetch recommendations (HTTP ${response.status}).`
            )
        );
        error.code = response.headers.get("X-SimRepo-Error");

        if (response.status === 429) {
            void reportRateLimitEvent("batch", 1);
        }

        throw error;
    }

    try {
        const data = JSON.parse(text);
        return Array.isArray(data.repos) ? data.repos : [];
    } catch (error) {
        throw new Error(`Failed to parse recommendations: ${error.message}`);
    }
}

// v2 model: similar repositories for a single repo, served by the site's
// /similar-repos endpoint. Returns the SimilarRepo[] array (or throws).
async function getSimilarReposV2(repo, page = 1, githubUserId = null) {
    const params = new URLSearchParams({ repo, page: String(page) });
    if (githubUserId) {
        params.set('user_id', githubUserId);
    }
    const url = `https://simrepo.dera.page/similar-repos?${params}`;
    const response = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" },
    });

    if (!response.ok) {
        const body = await response.text().catch(() => "");
        const detail = body && !body.startsWith("<") ? body.trim() : "";
        const error = new Error(
            detail || `Failed to fetch similar repositories (HTTP ${response.status}).`
        );
        error.code = response.headers.get("X-SimRepo-Error");

        if (response.status === 429) {
            void reportRateLimitEvent(repo, page);
        }

        throw error;
    }

    const data = await response.json();
    return data.repos ?? [];
}

async function handleGetSimilarReposV2Message(message, sender, sendResponse) {
    console.log('Received message to get similar repos (v2):', message);

    const repo = message.repo;
    const page = Number(message.page) || 1;
    const githubUserId = message.githubUserId || null;

    const cacheKey = `cache:getSimilarReposV2:${repo}:${page}:${githubUserId || 'anonymous'}`;

    // Check cache first
    chrome.storage.local.get([cacheKey], async (result) => {
        const cached = result[cacheKey];
        if (cached) {
            console.log('Serving from cache');
            sendResponse({ status: 'success', cached: cached.timestamp, data: cached.data });
            return;
        }

        if (!repo) {
            sendResponse({ status: "unknown" });
            return;
        }

        let repos;
        try {
            repos = await getSimilarReposV2(repo, page, githubUserId);
        } catch (error) {
            console.error('Error fetching similar repos (v2):', error);
            sendResponse({ status: "error", code: error.code, message: error.message });
            return;
        }

        // Cache the result
        chrome.storage.local.set({
            [cacheKey]: {
                data: repos,
                timestamp: Date.now()
            }
        });

        if (repos.length === 0) {
            sendResponse({ status: "error", code: "not-in-dataset", message: "Repo not included in the dataset yet" });
        } else {
            sendResponse({ status: "success", data: repos });
        }
    });
}

async function handleGetSimilarReposMessage(message, sender, sendResponse) {
    console.log('Received message to get similar repos:', message);

    const ids = Array.isArray(message.repoIds) ? message.repoIds : [];
    const rankProbability = message.rankProbability ?? DEFAULT_RANK_PROBABILITY;
    const githubUserId = message.githubUserId || null;

    if (ids.length === 0) {
        sendResponse({ status: "unknown" });
        return;
    }

    const cacheKey = `cache:getBatchSimilarRepos:${[...ids].sort((a, b) => Number(a) - Number(b)).join(',')}:${rankProbability}:${githubUserId || 'anonymous'}`;

    // Check cache first
    chrome.storage.local.get([cacheKey], async (result) => {
        const cached = result[cacheKey];
        if (cached) {
            console.log('Serving from cache');
            sendResponse({ status: 'success', cached: cached.timestamp, data: cached.data });
            return;
        }

        let similarRepos;
        try {
            similarRepos = await getBatchSimilarRepos(ids, rankProbability, githubUserId);
        } catch (error) {
            console.error('Error fetching similar repos:', error);
            sendResponse({ status: "error", code: error.code, message: error.message });
            return;
        }

        // Cache the result
        chrome.storage.local.set({
            [cacheKey]: {
                data: similarRepos,
                timestamp: Date.now()
            }
        });

        sendResponse({
            status: similarRepos.length > 0 ? "success" : "error",
            code: similarRepos.length > 0 ? undefined : "not-in-dataset",
            message: similarRepos.length > 0 ? undefined : "Repo not included in the dataset yet",
            data: similarRepos,
        });
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'openOptionsPage') {
        chrome.runtime.openOptionsPage();
        return;
    }

    if (message.type === 'getSimilarRepos') {
        (async () => {
            await handleGetSimilarReposMessage(message, sender, sendResponse);
        })();

        // Tell Chrome this is a synchronous response
        return true;
    }

    if (message.type === 'getSimilarReposV2') {
        (async () => {
            await handleGetSimilarReposV2Message(message, sender, sendResponse);
        })();

        // Tell Chrome this is a synchronous response
        return true;
    }

    if (message.type === 'report') {
        handleReportMessage(message);
        return;
    }
});

initCache();
