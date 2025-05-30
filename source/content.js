import { optionsStorage, modelReady } from './options-storage.js';
import npyjs from "npyjs";

console.log('💈 Content script loaded for', chrome.runtime.getManifest().name);

// Find the repo id from the element "<meta name="octolytics-dimension-repository_id" content="192725951" />"
let repoId = null;
document.querySelectorAll('meta[name="octolytics-dimension-repository_id"]').forEach((el) => {
	repoId = el.getAttribute('content');
});

console.log('💈 Repo ID:', repoId);

function getSimilarRepos(repoId) {
	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage({ type: 'getSimilarRepos', repoId }, (response) => {
			if (chrome.runtime.lastError) {
				return reject(chrome.runtime.lastError);
			}
			resolve(response);
		});
	});
}

getSimilarRepos(repoId)
	.then((response) => {
		if (response.status === "success" && response.data !== undefined) {
			console.log('💈 Found similar repos for repoId:', repoId, ', data:', response.data);
		} else {
			console.log('💈 No similar repos found for repoId:', repoId);
		}
	})
	.catch((error) => {
		console.error('💈 Error finding similar repos:', error);
	});

async function init() {
	const options = await optionsStorage.getAll();
	const color = `rgb(${options.colorRed}, ${options.colorGreen},${options.colorBlue})`;
	const text = options.text;
	const notice = document.createElement('div');
	notice.innerHTML = text;
	document.body.prepend(notice);
	notice.id = 'text-notice';
	notice.style.border = '2px solid ' + color;
	notice.style.color = color;
}

init();
