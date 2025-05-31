import { optionsStorage, modelReady } from './options-storage.js';
import npyjs from "npyjs";
import ghColors from '@scdev/github-languages-colors';
import octicons from "@primer/octicons"

console.log('💈 Content script loaded for', chrome.runtime.getManifest().name);
var loading = false;

function getSimilarRepos(repoIds, min, max, threshold) {
	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage({ type: 'getSimilarRepos', repoIds, min, max, threshold }, (response) => {
			if (chrome.runtime.lastError) {
				return reject(chrome.runtime.lastError);
			}
			resolve(response);
		});
	});
}

function formatNumber(num) {
	if (num >= 1e9) {
		return parseFloat((num / 1e9).toFixed(1)) + 'G';
	} else if (num >= 1e6) {
		return parseFloat((num / 1e6).toFixed(1)) + 'M';
	} else if (num >= 1e3) {
		return parseFloat((num / 1e3).toFixed(1)) + 'k';
	}
	return num.toString();
}

function getHtml(owner, repo, fullname, description, language, stars, forks, archived, similarity) {
	return `
<div class="Box d-flex p-3 width-full public source">
	<div class="pinned-item-list-item-content">
		<div class="d-flex width-full position-relative">
			<div class="flex-1">
				${octicons.repo.toSVG({ "class": "mr-1 color-fg-muted" })}
				<span data-view-component="true" class="position-relative"><a href="/${fullname}" data-view-component="true" class="Link mr-1 text-bold wb-break-word"><span class="owner text-normal">${owner}/</span><span class="repo">${repo}</span></a></span>
				
				${archived ? `
				<span class="Label Label--attention v-align-middle mt-1 no-wrap v-align-baseline Label--inline">Public archive</span>
				` : ''}
			</div>
		</div>


		<p class="pinned-item-desc color-fg-muted text-small mt-2 mb-0">
			${description}
		</p>

      	<p class="mb-0 mt-2 f6 color-fg-muted">
        	${language ? `
			<span class="d-inline-block mr-3">
				<span class="repo-language-color" style="background-color: ${ghColors[language]}"></span>
  				<span itemprop="programmingLanguage">${language}</span>
			</span>` : ''}

			${stars > 0 ? `
    		<a href="/${fullname}/stargazers" class="pinned-item-meta Link--muted">
				${octicons.star.toSVG()}
            	${formatNumber(stars)}
          	</a>
			` : ''}
          
			${forks > 0 ? `
			<a href="/${fullname}/forks" class="pinned-item-meta Link--muted">
				${octicons['repo-forked'].toSVG()}
				${formatNumber(forks)}
			</a>
			` : ''}

			<a class="pinned-item-meta Link--muted">
				${octicons['flame'].toSVG()}
				${Math.floor(similarity * 100)}%
			</a>
		</p>
    </div>
  </div>`;
}

function getContainerHtml(repos) {
	let innerHtml = '';
	console.log('💈 Repos:', repos);
	for (const repo of repos) {
		let owner = repo.full_name.split('/')[0];
		let repoName = repo.full_name.split('/')[1];
		innerHtml += getHtml(owner, repoName, repo.full_name, repo.description, repo.language, repo.stargazers_count, repo.forks_count, repo.archived, repo.similarity);
	}

	return `
	<div class="BorderGrid-row" id="similar-repos-container">
    <div class="BorderGrid-cell">
  		<h2 class="h4 mb-3">
  			Similar repositories
			<span title="${repos.length}" data-view-component="true" class="Counter">${formatNumber(repos.length)}</span>
		</h2>

		${innerHtml}

		<div class="mt-2">
			<a class="Link--muted" id="similar-repos-view-more">View more</a>
		</div>
    </div></div>`;
}

function setupCallback(nextMin) {
	const viewMoreLink = document.querySelector('#similar-repos-view-more');
	if (viewMoreLink) {
		viewMoreLink.addEventListener('click', () => {
			if (!loading) {
				viewMoreLink.parentElement.insertAdjacentHTML('beforeend', `<span class="loading-spinner"></span>`);
				initRepo(nextMin);
			}
		});
	}
}

async function getRepoId() {
	let repoId = null;
	while (!repoId) {
		document.querySelectorAll('meta[name="octolytics-dimension-repository_id"]').forEach((el) => {
			repoId = el.getAttribute('content');
		});
		await new Promise(resolve => setTimeout(resolve, 100));
	}
	return repoId;
}

async function initRepo(min = 3) {
	let repoId = await getRepoId();
	console.log('💈 Repo ID:', repoId);

	const options = await optionsStorage.getAll();
	loading = true;
	let response = await getSimilarRepos([repoId], min, 10, 0.9);
	loading = false;

	if (response.status === "success" && response.data !== undefined) {
		console.log('💈 Found similar repos for repoId:', repoId, ', data:', response.data);

		if (repoId != await getRepoId()) {
			console.log('💈 Repo ID changed during fetch, aborting update.');
			init();
			return;
		}

		const similarReposContainer = document.querySelector('#similar-repos-container');
		if (similarReposContainer) {
			similarReposContainer.outerHTML = getContainerHtml(response.data);
			setupCallback(response.data.length + 5);
			return;
		}

		const sidebar = document.querySelector('.Layout-sidebar > div');
		sidebar.insertAdjacentHTML('beforeend', getContainerHtml(response.data));
		setupCallback(response.data.length + 5);
	} else {
		console.log('💈 No similar repos found for repoId:', repoId);
	}
}

async function initHome() {
	console.log("Producing recommendations on the homepage");
	let login = document.querySelector('meta[name="user-login"]').getAttribute('content');
	console.log("User login:", login);

	let latestStars = 10;
	let after = null;
	let stars = new Set();

	while (stars.size < latestStars) {
		let url = `https://github.com/${login}?tab=stars`;
		if (after) {
			url += `&after=${after}`;
		}

		let response = await fetch(url);
		let text = await response.text();

		// Extract starred repository IDs from the HTML
		let regex = /details-user-list-(\d+)-unstarred/g;
		while ((matches = regex.exec(text)) !== null) {
			let id = matches[1];
			if (id) {
				stars.add(Number(id));
				if (stars.size >= latestStars) {
					break;
				}
			}
		}

		// Get the next "after" parameter from the pagination link
		let nextMatch = text.match(/\?after=([^&]+)&amp;tab=stars">Next<\/a>/);
		if (nextMatch && nextMatch[1]) {
			after = nextMatch[1];
			console.log("Next after:", after);
		} else {
			break;
		}

		await new Promise(resolve => setTimeout(resolve, 1000));
	}

	console.log("Collected stars:", stars);

	let response = await getSimilarRepos(Array.from(stars), 10, 20, 0.9);
	console.log('💈 Found similar repos for homepage:', response);
}

async function initStarsList() {
	let documentHtml = document.documentElement.innerHTML;
	let regex = /details-user-list-(\d+)-unstarred/g;
	let stars = new Set();
	while ((matches = regex.exec(documentHtml)) !== null) {
		let id = matches[1];
		if (id) {
			stars.add(Number(id));
		}
	}

	console.log("Collected stars:", stars);

	let response = await getSimilarRepos(Array.from(stars), 20, 20, 0.9);
	console.log('💈 Found similar repos for homepage:', response);
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
