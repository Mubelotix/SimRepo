import { optionsStorage, modelReady } from './options-storage.js';
import npyjs from "npyjs";
import ghColors from '@scdev/github-languages-colors';

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

function formatNumber(num) {
	if (num >= 1e9) {
		return (num / 1e9).toFixed(1) + 'G';
	} else if (num >= 1e6) {
		return (num / 1e6).toFixed(1) + 'M';
	} else if (num >= 1e3) {
		return (num / 1e3).toFixed(1) + 'k';
	}
	return num.toString();
}

function getHtml(owner, repo, fullname, description, language, stars, forks, archived) {
	return `
	<div class="Box d-flex p-3 width-full public source">
		<div class="pinned-item-list-item-content">
			<div class="d-flex width-full position-relative">
				<div class="flex-1">
					<svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-repo mr-1 color-fg-muted">
						<path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"></path>
					</svg>
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
            	<svg aria-label="stars" role="img" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-star">
    				<path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Zm0 2.445L6.615 5.5a.75.75 0 0 1-.564.41l-3.097.45 2.24 2.184a.75.75 0 0 1 .216.664l-.528 3.084 2.769-1.456a.75.75 0 0 1 .698 0l2.77 1.456-.53-3.084a.75.75 0 0 1 .216-.664l2.24-2.183-3.096-.45a.75.75 0 0 1-.564-.41L8 2.694Z"></path>
				</svg>
            	${formatNumber(stars)}
          	</a>
			` : ''}
          
			${forks > 0 ? `
			<a href="/${fullname}/forks" class="pinned-item-meta Link--muted">
				<svg aria-label="forks" role="img" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-repo-forked">
					<path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z"></path>
				</svg>
				${formatNumber(forks)}
			</a>
			` : ''}
		</p>
    </div>
  </div>`;
}

function getContainerHtml(similarReposCount, repos) {
	let innerHtml = '';
	for (const repo of repos) {
		let owner = repo.full_name.split('/')[0];
		let repoName = repo.full_name.split('/')[1];
		innerHtml += getHtml(owner, repoName, repo.full_name, repo.description, repo.language, repo.stargazers_count, repo.forks_count);
	}

	return `
	<div class="BorderGrid-row" id="similar-repos-container">
    <div class="BorderGrid-cell">
  		<h2 class="h4 mb-3">
  			Similar repositories
			<span title="${similarReposCount}" data-view-component="true" class="Counter">${formatNumber(similarReposCount)}</span>
		</h2>

		${innerHtml}
    </div></div>`;
}

getSimilarRepos(repoId)
	.then((response) => {
		if (response.status === "success" && response.data !== undefined) {
			console.log('💈 Found similar repos for repoId:', repoId, ', data:', response.data);

			const similarReposContainer = document.querySelector('#similar-repos-container');
			if (similarReposContainer) {
				similarReposContainer.outerHTML = getContainerHtml(response.data.length, response.data);
				return;
			}

			const sidebar = document.querySelector('.Layout-sidebar > div');
			sidebar.insertAdjacentHTML('beforeend', getContainerHtml(response.data.length, response.data));
		} else {
			console.log('💈 No similar repos found for repoId:', repoId);
		}
	})
	.catch((error) => {
		console.error('💈 Error finding similar repos:', error);
	});

async function init() {
	const options = await optionsStorage.getAll();

}

init();
