import { initCache } from './cache.js';

async function getClosestN(ids, offset = 0, limit = 10) {
    const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJyIn0.drJ8F-oa_6UfCpmKdv4Mbng_E8p71UrZAR895gKOOAk";
    const url = "https://simrepo.mub.lol/collections/repos/points/recommend";

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
            throw new Error(`Failed to fetch recommendations: ${text}`);
        }
    }

    throw new Error("All provided IDs were invalid or caused errors.");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'getSimilarRepos') { (async () => {
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

            let similarRepos = await getClosestN(ids, offset, limit);

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
        })();

        // Tell Chrome this is a synchronous response
        return true;
    }
});
