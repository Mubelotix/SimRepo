import { initCache } from './cache.js';
import { TELEMETRY_ENDPOINT, TELEMETRY_WEBSITE_ID } from './analytics.js';
import { optionsStorage } from './options-storage.js';

async function handleReportMessage(message) {
    try {
        await fetch(TELEMETRY_ENDPOINT, {
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
    if (!options.telemetryEnabled) {
        return;
    }

    try {
        await fetch(TELEMETRY_ENDPOINT, {
            method: "POST",
            credentials: "omit",
            mode: "cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                type: "event",
                payload: {
                    website: TELEMETRY_WEBSITE_ID,
                    name: "rate-limit",
                    data: { repo, page },
                },
            }),
        });
    } catch (error) {
        console.error("Failed to send rate-limit event:", error);
    }
}


async function getClosestN(ids, offset = 0, limit = 10) {
    const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJyIn0.drJ8F-oa_6UfCpmKdv4Mbng_E8p71UrZAR895gKOOAk";
    const url = "https://simrepo.dera.page/collections/repos/points/recommend";

    let remainingIds = [...ids];

    // TODO: Fork Qdrant to support ignoring invalid IDs
    while (remainingIds.length > 0) {
        const payload = {
            limit: limit,
            positive: remainingIds,
            filter: { must: [] },
            offset: offset,
            with_payload: true,
            with_vector: false
        };

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "api-key": apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const text = await response.text();

        try {
            const data = JSON.parse(text);

            if (data.status?.error) {
                const match = data.status.error.match(/No point with id (\d+) found/);
                if (match) {
                    const badId = match[1];
                    remainingIds = remainingIds.filter(id => id !== badId && id !== Number(badId));
                    continue; // Retry without the problematic ID
                } else {
                    throw new Error(`Unhandled error: ${data.status.error}`);
                }
            }

            return data.result;

        } catch (err) {
            throw new Error(`Failed to fetch recommendations: ${text} ${err.message}`);
        }
    }

    throw new Error("All provided IDs were invalid or caused errors.");
}

// v2 model: similar repositories for a single repo, served by the site's
// /similar-repos endpoint. Returns the SimilarRepo[] array (or throws).
async function getSimilarReposV2(repo, page = 1) {
    const url = `https://simrepo.dera.page/similar-repos?repo=${encodeURIComponent(repo)}&page=${page}`;
    const response = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" },
    });

    if (response.status === 429) {
        void reportRateLimitEvent(repo, page);
        throw new Error("Rate limited. Please try again later.");
    }

    if (!response.ok) {
        // Surface the backend's own message (e.g. pagination restrictions) so
        // the user isn't left with a bare HTTP status code.
        const body = await response.text().catch(() => "");
        const detail = body && !body.startsWith("<") ? body.trim() : "";
        throw new Error(
            detail
                ? `HTTP ${response.status}: ${detail}`
                : `Failed to fetch similar repositories (HTTP ${response.status}).`
        );
    }

    const data = await response.json();
    return data.repos ?? [];
}

async function handleGetSimilarReposV2Message(message, sender, sendResponse) {
    console.log('Received message to get similar repos (v2):', message);

    const repo = message.repo;
    const page = Number(message.page) || 1;

    const cacheKey = `cache:getSimilarReposV2:${repo}:${page}`;

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
            repos = await getSimilarReposV2(repo, page);
        } catch (error) {
            console.error('Error fetching similar repos (v2):', error);
            sendResponse({ status: "error", message: error.message });
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
            sendResponse({ status: "error", message: "This repository is not covered by the similar-repositories dataset yet." });
        } else {
            sendResponse({ status: "success", data: repos });
        }
    });
}

async function handleGetSimilarReposMessage(message, sender, sendResponse) {
    console.log('Received message to get similar repos:', message);

    const ids = message.repoIds;
    const offset = Number(message.offset) || 0;
    const limit = Number(message.limit) || 10;

    const cacheKey = `cache:getSimilarRepos:${ids.sort().join(',')}:${offset}:${limit}`;

    // Check cache first
    chrome.storage.local.get([cacheKey], async (result) => {
        const cached = result[cacheKey];
        if (cached) {
            console.log('Serving from cache');
            sendResponse({ status: 'success', cached: cached.timestamp, data: cached.data });
            return;
        }

        if (!ids || ids.length === 0) {
            sendResponse({ status: "unknown" });
            return;
        }

        let similarRepos;
        try {
            similarRepos = await getClosestN(ids, offset, limit);
        } catch (error) {
            console.error('Error fetching similar repos:', error);
            sendResponse({ status: "error", message: error.message });
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
