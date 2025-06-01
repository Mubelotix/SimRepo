const CACHE_MAX_SIZE = 500;
const CACHE_PREFIX = 'cache:';

function cleanupExpiredCache() {
    chrome.storage.local.get(null, (items) => {
        const cached = [];

        for (const [key, value] of Object.entries(items)) {
            if (key.startsWith(CACHE_PREFIX)) {
                cached.push({ key, timestamp: value.timestamp });
            }
        }

        if (cached.length <= CACHE_MAX_SIZE) {
            return
        }

        cached.sort((a, b) => b.timestamp - a.timestamp);
        const expired = cached.slice(CACHE_MAX_SIZE);
        const expiredKeys = expired.map(item => item.key);
        
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
