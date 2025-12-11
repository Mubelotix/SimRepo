const CACHE_PREFIX = 'cache:';
const CACHE_EXPIRATION_MS = 86400 * 1000; // 24 hours

function cleanupExpiredCache() {
    chrome.storage.local.get(null, (items) => {
        const expiredKeys = [];
        const now = Date.now();

        for (const [key, value] of Object.entries(items)) {
            if (key.startsWith(CACHE_PREFIX)) {
                if (value.timestamp && (now - value.timestamp > CACHE_EXPIRATION_MS)) {
                    expiredKeys.push(key);
                }
            }
        }

        if (expiredKeys.length === 0) {
            return;
        }
        
        console.log(`Cleaning up ${expiredKeys.length} expired cache entries...`);
        chrome.storage.local.remove(expiredKeys, () => {
            if (chrome.runtime.lastError) {
                console.error("Error removing expired cache entries:", chrome.runtime.lastError);
            }
        });
    });
}

export function initCache() {
    cleanupExpiredCache();

    setInterval(cleanupExpiredCache, 86400 * 1000);
}
