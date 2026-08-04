import GH_LANG_COLORS from 'gh-lang-colors';
import octicons from "@primer/octicons";
import { getSimilarRepos, formatNumber, loadingSpinner, setupSettingsListener } from './common.js';
import { optionsStorage } from './options-storage.js';
import { reportEvent } from './analytics.js';

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
            <a href="#" id="simrepo-settings-btn" class="Link--secondary pt-1 pl-2" title="Settings">
                ${octicons.gear.toSVG()}
            </a>
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
                <a href="#" id="simrepo-settings-btn" class="Link--secondary pt-1 pl-2" title="Settings">
                    ${octicons.gear.toSVG()}
                </a>
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
                <a href="#" id="simrepo-settings-btn" class="Link--secondary pt-1 pl-2" title="Settings">
                    ${octicons.gear.toSVG()}
                </a>
            </h2>

            <div class="text-small color-fg-muted">
                ${error}
            </div>
        </div>
    </div>`;
}

function keepContainerAtBottom(sidebar) {
    const observer = new MutationObserver(() => {
        const container = document.querySelector('#similar-repos-container');
        if (container &&
            container.parentElement === sidebar &&
            container !== sidebar.lastElementChild
        ) {
            sidebar.appendChild(container);
        }
    });
    observer.observe(sidebar, {
        childList: true,
    });
}

// Convert GitHub counts like "1,234" or "1.2k" to numbers.
function parseCount(text) {
    const match = text
        .trim()
        .replace(/,/g, '')
        .match(/^(\d+(?:\.\d+)?)\s*([kKmM]?)$/);

    if (!match) {
        return null;
    }

    const multipliers = {
        '': 1,
        k: 1_000,
        m: 1_000_000,
    };

    return Number(match[1]) * multipliers[match[2].toLowerCase()];
}

function setupCallback() {
    const viewMoreLink = document.querySelector('#similar-repos-view-more');
    if (viewMoreLink) {
        viewMoreLink.addEventListener('click', async () => {
            reportEvent('see-more', { context: 'repository' });
            if (!loading) {
                let newSpinner = document.createElement("span");
                viewMoreLink.appendChild(newSpinner);
                newSpinner.innerHTML = loadingSpinner("", "height: 1rem;margin: 0 0 0 0;position: relative;top: 3px;");
                await loadMoreRepos();
                newSpinner.remove();
            }
        });
    }

    const container = document.querySelector('#similar-repos-container');
    if (container) {
        container.addEventListener('click', (event) => {
            const link = event.target.closest('a[href^="/"]');
            if (link) {
                reportEvent('recommended-repo-click', { context: 'repository', repo: link.getAttribute('href') });
            }
        });
    }

    setupSettingsListener();
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
        const sidebar =
            // New Github sidebar (2026/07~).
            document.querySelector(
                '[data-component="SplitPageLayout.Pane"] ' +
                '[class*="CodeViewSidebar-module__borderGrid__"]'
            ) ||
            // Previous Github sidebar.
            document.querySelector(
              'rails-partial[data-partial-name="codeViewRepoRoute.Sidebar"] .BorderGrid'
            ) ||
            document.querySelector('.Layout-sidebar > div') ||
            document.querySelector('.Layout-sidebar') ||
            document.querySelector('[data-testid="repository-sidebar"]');

        if (!sidebar) {
            console.warn('💈 SimRepo: no sidebar mount point (new GitHub layout)');
            return;
        }

        sidebar.insertAdjacentHTML('beforeend', getLoadingContainerHtml());
        setupSettingsListener();
        container = document.querySelector('#similar-repos-container');
        // Github appends sidebar sections asynchronously.
        // Move SimRepo back to the bottom whenever that happens.
        keepContainerAtBottom(sidebar);
    }

    // Don't fetch if private
    const isPrivate = document.querySelector('.Label.Label--secondary')?.textContent.trim() === 'Private';
    if (isPrivate) {
        if (options.similarShowUnavailable) {
            container.outerHTML = getErrorContainerHtml("Unavailable for private repositories.");
            setupSettingsListener();
        } else {
            container.remove();
        }
        return;
    }

    // Don't fetch if less than 100 stars
    try {
        // Build the current repository path for the star-count link.
        const repoPath = '/' + window.location.pathname
            .split('/')
            .filter(Boolean)
            .slice(0, 2)
            .join('/');

        // Support both githubs' previous and current star-count markup.
        const starElement =
            document.querySelector('#repo-stars-counter-star') ||
            document.querySelector(
                `a[href="${repoPath}/stargazers"] strong`
            );

        // Read the old numeric title or the new visible abbreviated count.
        const starsCount = parseCount(
            starElement?.getAttribute('title') ||
            starElement?.textContent ||
            ''
        );

        if (starsCount === null) {
            console.warn('💈 SimRepo: repository star count not found');
            // Avoid leaving the panel stuck on "Loading".
            container.outerHTML = getErrorContainerHtml(
                "Unable to determine repository star count."
            );
            setupSettingsListener();
            return;
        }


        if (starsCount < 100) {
            if (options.similarShowUnavailable) {
                container.outerHTML = getErrorContainerHtml("Unavailable for repositories with less than 100 stars.");
                setupSettingsListener();
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
        let limit = options.similarCount;
        nextOffset += limit;
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
            setupSettingsListener();
        }
    } catch (error) {
        console.error('Error fetching similar repos:', error);
        loading = false;
        container.outerHTML = getErrorContainerHtml(`Error fetching similar repositories. Details:<br><code> ${error.message}</code>`);
        setupSettingsListener();
    }
}
