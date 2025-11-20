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
let lastPathname = window.location.pathname;
setInterval(() => {
    const currentPathname = window.location.pathname;
    if (currentPathname !== lastPathname) {
        lastPathname = currentPathname;
        console.log('💈 URL changed, re-initializing...');
        init();
    }
}, 1000);
