import { optionsStorage, modelReady } from './options-storage.js';
import npyjs from "npyjs";
import { initRepo } from './content-repo.js';
import { initHome, initStarsList } from './content-stars.js';

console.log('💈 Content script loaded for', chrome.runtime.getManifest().name);

export function getSimilarRepos(repoIds, min, max, threshold) {
	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage({ type: 'getSimilarRepos', repoIds, min, max, threshold }, (response) => {
			if (chrome.runtime.lastError) {
				return reject(chrome.runtime.lastError);
			}
			resolve(response);
		});
	});
}

export function formatNumber(num) {
	if (num >= 1e9) {
		return parseFloat((num / 1e9).toFixed(1)) + 'G';
	} else if (num >= 1e6) {
		return parseFloat((num / 1e6).toFixed(1)) + 'M';
	} else if (num >= 1e3) {
		return parseFloat((num / 1e3).toFixed(1)) + 'k';
	}
	return num.toString();
}

async function init() {
	if (window.location.pathname === '/') {
		await initHome();
	} else if (window.location.pathname.startsWith('/stars/') && window.location.pathname.includes('/lists/')) {
		await initStarsList();
	} else if (window.location.pathname.split('/').length === 3) {
		await initRepo();
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
