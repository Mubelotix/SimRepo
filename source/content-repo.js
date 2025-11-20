import GH_LANG_COLORS from 'gh-lang-colors';
import octicons from "@primer/octicons";
import { getSimilarRepos, formatNumber, loadingSpinner } from './common.js';
import { optionsStorage } from './options-storage.js';

var loading = false;
var nextOffset = 0;

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
                <span class="repo-language-color" style="background-color: ${GH_LANG_COLORS[language]}"></span>
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

function getContainerInnerHtml(results) {
    let innerHtml = '';
    console.log('💈 Repos:', results);
    for (const result of results) {
        let repo = result.payload;
        let owner = repo.full_name.split('/')[0];
        let repoName = repo.full_name.split('/')[1];
        innerHtml += getHtml(owner, repoName, repo.full_name, repo.description, repo.language, repo.stargazers_count, repo.forks_count, repo.archived, result.score);
    }
    return innerHtml;
}

function getContainerHtml(results) {
    let innerHtml = getContainerInnerHtml(results);

    return `
    <div class="BorderGrid-row" id="similar-repos-container">
    <div class="BorderGrid-cell">
        <h2 class="h4 mb-3">
            Similar repositories
            <!-- <span title="${results.length}" data-view-component="true" class="Counter">${formatNumber(results.length)}</span> -->
        </h2>

        <div id="similar-repos-inner-container">${innerHtml}</div>

        <div class="mt-2">
            <a class="Link--muted" id="similar-repos-view-more">View more</a>
        </div>
    </div></div>`;
}

function getLoadingContainerHtml() {
    return `
    <div class="BorderGrid-row" id="similar-repos-container">
        <div class="BorderGrid-cell">
            <h2 class="h4 mb-3">
                Similar repositories
            </h2>

            <div class="d-flex align-items-center justify-content-star mt-3">
                <p class="color-fg-muted mb-0 min-width-0">
                    Loading
                </p>
                <span class="flex-shrink-0 d-inline-flex align-items-center" style="height: 1.5rem;">
                    ${loadingSpinner("", "height: 1rem; margin: .25rem 0 .25rem 0;")}
                </span>
            </div>
        </div>
    </div>`;
}

function getErrorContainerHtml(error = "No similar repositories found.") {
    return `
    <div class="BorderGrid-row" id="similar-repos-container">
        <div class="BorderGrid-cell">
            <h2 class="h4 mb-3">
                Similar repositories
            </h2>

            <div class="text-small color-fg-muted">
                ${error}
            </div>
        </div>
    </div>`;
}

function setupCallback() {
    const viewMoreLink = document.querySelector('#similar-repos-view-more');
    if (viewMoreLink) {
        viewMoreLink.addEventListener('click', async () => {
            if (!loading) {
                let newSpinner = document.createElement("span");
                viewMoreLink.appendChild(newSpinner);
                newSpinner.innerHTML = loadingSpinner("", "height: 1rem;margin: 0 0 0 0;position: relative;top: 3px;");
                await loadMoreRepos();
                newSpinner.remove();
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
    return Number(repoId);
}

export async function loadMoreRepos(resetOffset = false) {
    let options = await optionsStorage.getAll();
    if (!options.similarEnabled) {
        console.log("Similar repositories are disabled");
        return;
    }

    if (resetOffset) {
        nextOffset = 0;
    }

    let repoId = await getRepoId();
    console.log('💈 Repo ID:', repoId);

    // Ensure the container exists
    let container = document.querySelector('#similar-repos-container');
    if (!container) {
        const sidebar = document.querySelector('.Layout-sidebar > div');
        sidebar.insertAdjacentHTML('beforeend', getLoadingContainerHtml());
        container = document.querySelector('#similar-repos-container');
    }

    // Don't fetch if private
    const isPrivate = document.querySelector('.Label.Label--secondary')?.textContent.trim() === 'Private';
    if (isPrivate) {
        if (options.similarShowUnavailable) {
            container.outerHTML = getErrorContainerHtml("Unavailable for private repositories.");
        } else {
            container.remove();
        }
        return;
    }

    // Don't fetch if less than 150 stars
    try {
        let starSpan = document.querySelector("span[id=\"repo-stars-counter-star\"]");
        let starsCount = starSpan ? parseInt(starSpan.getAttribute("title").replace(/,/g, '')) : 0;
        if (starsCount < 150) {
            if (options.similarShowUnavailable) {
                container.outerHTML = getErrorContainerHtml("Unavailable for repositories with less than 150 stars.");
            } else {
                container.remove();
            }
            return;
        }
    } catch (error) {
        console.error('Error fetching stars count:', error);
    }

    try {
        loading = true;
        let offset = nextOffset;
        let limit = offset == 0 ? options.similarCount : 5;
        nextOffset += 5;
        let response = await getSimilarRepos([repoId], offset, limit);
        loading = false;

        if (response.status === "success" && response.data !== undefined) {
            console.log('💈 Found similar repos for repoId:', repoId, ', data:', response.data);

            if (repoId != await getRepoId()) {
                console.log('💈 Repo ID changed during fetch, aborting update.');
                loadMoreRepos();
                return;
            }

            let innerContainer = document.getElementById("similar-repos-inner-container");
            if (innerContainer) {
                if (offset === 0) {
                    innerContainer.innerHTML = getContainerInnerHtml(response.data);
                } else {
                    innerContainer.insertAdjacentHTML('beforeend', getContainerInnerHtml(response.data));
                }
            } else {
                container.outerHTML = getContainerHtml(response.data);
                setupCallback();
            }
        } else {
            console.log('No similar repos found');

            if (response.status === "error" && response.message) {
                if (response.message === "All provided IDs were invalid or caused errors.") {
                    container.outerHTML = getErrorContainerHtml("This repository got popular too recently! It will be included in the dataset soon.");
                } else {
                    container.outerHTML = getErrorContainerHtml(`Error fetching similar repositories. Details:<br><code>${response.message}</code>`);
                }
            } else {
                container.outerHTML = getErrorContainerHtml("No similar repositories found. Try on older repositories.");
            }
        }
    } catch (error) {
        console.error('Error fetching similar repos:', error);
        loading = false;
        container.outerHTML = getErrorContainerHtml(`Error fetching similar repositories. Details:<br><code> ${error.message}</code>`);
    }
}
