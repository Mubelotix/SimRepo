import { loadMoreRepos } from './content-repo.js';
import { initHome, initStarsList } from './content-stars.js';

console.log('💈 Content script loaded for', chrome.runtime.getManifest().name);

async function init() {
    if (window.location.pathname === '/' || window.location.pathname === '/feed') {
        await initHome();
    } else if (window.location.pathname.startsWith('/stars/') && window.location.pathname.includes('/lists/')) {
        await initStarsList();
    } else if (window.location.pathname.split('/').length === 3 || (window.location.pathname.split('/').length === 4 && window.location.pathname.endsWith('/'))) {
        await loadMoreRepos(true);
    }
}

init();

// Periodically check for url changes
let lastUrl = window.location.href;
setInterval(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        console.log('💈 URL changed, re-initializing...');
        init();
    }
}, 1000);
