import GH_LANG_COLORS from 'gh-lang-colors';
import octicons from "@primer/octicons";
import { getSimilarReposV2, formatNumber, loadingSpinner, setupSettingsListener } from './common.js';
import { optionsStorage } from './options-storage.js';
import { reportEvent } from './analytics.js';

var loading = false;
var nextPage = 1;
var similarReposSection = null;
var similarReposSidebar = null;
// Snapshot of the section HTML we most recently rendered, so we can recreate it
// if GitHub React fully removes our node from the DOM.
var sectionHtml = null;

function setSection(section) {
    similarReposSection = section;
}

function findSidebar() {
    return (
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
        document.querySelector('[data-testid="repository-sidebar"]')
    );
}

// Render a fresh section, either replacing the current one or inserting a new
// one, and keep tracking the new element so GitHub's re-renders can't orphan it.
// If the current section was detached from the DOM by GitHub while we were
// fetching, fall back to inserting a fresh section into a live sidebar instead
// of replacing (and losing) a node that is no longer displayed.
function renderSection(html) {
    if (similarReposSection && similarReposSection.isConnected) {
        similarReposSection.outerHTML = html;
    } else if (similarReposSidebar && similarReposSidebar.isConnected) {
        similarReposSidebar.insertAdjacentHTML('beforeend', html);
    } else {
        const sidebar = findSidebar();
        if (!sidebar) {
            console.warn('💈 SimRepo: no sidebar mount point to render the section');
            return;
        }
        similarReposSidebar = sidebar;
        sidebar.insertAdjacentHTML('beforeend', html);
    }
    setSection(document.querySelector('#similar-repos-container'));
    sectionHtml = html;
    keepContainerAtBottom();
}

// Disable the section entirely (github should not restore it later).
function removeSection() {
    if (similarReposSection) {
        similarReposSection.remove();
        setSection(null);
        sectionHtml = null;
    }
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
        let [owner, repoName] = result.repo.split('/');
        innerHtml += getHtml(
            owner,
            repoName,
            result.repo,
            result.meta.description,
            result.meta.language,
            result.meta.stars_total,
            result.meta.forks_count,
            result.meta.archived,
            result.score
        );
    }
    return innerHtml;
}

// Match the new (2026) Github sidebar section markup (e.g. the "Releases"
// section). Use stable class names only — never GitHub's hashed CSS-module
// classes, which change on every deploy. Styling lives in content.css.
const SECTION_HEADER_HTML = `
    <h2 class="prc-Heading-Heading SidebarSection-module__sectionHeading" data-variant="small" data-component="Heading">
        <span>Similar repositories</span>
        <a href="#" id="simrepo-settings-btn" class="Link--secondary" title="Settings" aria-label="SimRepo settings">
            ${octicons.gear.toSVG()}
        </a>
    </h2>`;

function getContainerHtml(results) {
    let innerHtml = getContainerInnerHtml(results);

    return `
    <div class="SidebarSection-module__sidebarSection" id="similar-repos-container">
        ${SECTION_HEADER_HTML}

        <div id="similar-repos-inner-container">${innerHtml}</div>

        <div class="mt-2">
            <a class="Link--muted" id="similar-repos-view-more">View more</a>
        </div>
    </div>`;
}

function getLoadingContainerHtml() {
    return `
    <div class="SidebarSection-module__sidebarSection" id="similar-repos-container">
        ${SECTION_HEADER_HTML}

        <div class="d-flex align-items-center justify-content-star mt-3">
            <p class="color-fg-muted mb-0 min-width-0">
                Loading
            </p>
            <span class="flex-shrink-0 d-inline-flex align-items-center" style="height: 1.5rem;">
                ${loadingSpinner("", "height: 1rem; margin: .25rem 0 .25rem 0;")}
            </span>
        </div>
    </div>`;
}

function getErrorContainerHtml(error = "No similar repositories found.") {
    return `
    <div class="SidebarSection-module__sidebarSection" id="similar-repos-container">
        ${SECTION_HEADER_HTML}

        <div class="text-small color-fg-muted">
            ${error}
        </div>
    </div>`;
}

// Turn a raw error (e.g. from the backend or background) into a user-friendly
// message. Overwrites the backend's "only the first page" notice, which only
// fires for extensions the server doesn't recognize as an official install.
function getErrorMessage(raw) {
    if (typeof raw !== 'string') {
        return "No similar repositories found. Try on older repositories.";
    }
    if (raw === "This repository is not covered by the similar-repositories dataset yet.") {
        return "This repository got popular too recently! It will be included in the dataset soon.";
    }
    if (raw.includes("Only the first page of similar repositories")) {
        return "Your SimRepo extension isn't recognized as an official install. Please make sure you installed it from an official store to view more than three similar repositories.";
    }
    return raw;
}

// Show an error, but keep already-loaded items intact when paginating ("view
// more"): replace the section only on the first page, otherwise append a notice.
function renderError(message, page) {
    const display = getErrorMessage(message);

    if (page > 1 && similarReposSection) {
        const viewMore = similarReposSection.querySelector('#similar-repos-view-more');
        const note = document.createElement('div');
        note.className = 'text-small color-fg-muted mt-2';
        note.textContent = display;
        if (viewMore) {
            viewMore.closest('div').insertAdjacentElement('beforebegin', note);
        } else {
            similarReposSection.appendChild(note);
        }
    } else {
        renderSection(getErrorContainerHtml(display));
    }
    setupSettingsListener();
}

let containerObserver = null;

// Keep the "Similar repositories" section at the bottom of the sidebar. GitHub
// re-renders and appends its own sections asynchronously, and occasionally
// replaces the entire sidebar element. So:
//   - if our section was dropped into a detached sidebar, re-insert it into a
//     live one (findSidebar) and re-attach the observer;
//   - otherwise, move it to the end whenever GitHub inserts anything after it.
function keepContainerAtBottom() {
    const container = document.querySelector('#similar-repos-container');
    if (!container || !container.parentElement) return;

    const sidebar = container.parentElement;
    if (containerObserver && containerObserver.__sidebar === sidebar) {
        return; // already watching this parent
    }
    if (containerObserver) {
        containerObserver.disconnect();
        containerObserver = null;
    }

    containerObserver = new MutationObserver(() => {
        restoreContainer();
    });
    containerObserver.__sidebar = sidebar;
    containerObserver.observe(sidebar, { childList: true });
}

// Make sure the section is present in a live sidebar, at the bottom. Handles:
//   - section fully removed by React: recreate it from the stored snapshot;
//   - section moved into a detached/wrong parent: re-insert it into a live
//     sidebar;
//   - section present but not last: move it to the end.
function restoreContainer() {
    const live = findSidebar();
    if (!live || !live.isConnected) return;

    let c = document.querySelector('#similar-repos-container');

    if (!c) {
        // Removed entirely — recreate from the snapshot.
        if (sectionHtml) {
            live.insertAdjacentHTML('beforeend', sectionHtml);
            c = document.querySelector('#similar-repos-container');
            setSection(c);
            setupSettingsListener();
            keepContainerAtBottom();
        }
        return;
    }

    if (!live.contains(c)) {
        live.appendChild(c);
        setSection(document.querySelector('#similar-repos-container'));
        keepContainerAtBottom();
        return;
    }

    if (c !== c.parentElement.lastElementChild) {
        c.parentElement.appendChild(c);
    }
}

// Safety net for GitHub's async sidebar re-renders.
setInterval(restoreContainer, 2000);

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

async function getRepoName() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
}

export async function loadMoreRepos(resetPage = false) {
    let options = await optionsStorage.getAll();
    if (!options.similarEnabled) {
        console.log("Similar repositories are disabled");
        return;
    }

    if (resetPage) {
        nextPage = 1;
    }

    let repoName = await getRepoName();
    console.log('💈 Repo:', repoName);

    // Ensure the container exists
    let container = document.querySelector('#similar-repos-container');
    if (!container) {
        const sidebar = findSidebar();

        if (!sidebar) {
            console.warn('💈 SimRepo: no sidebar mount point (new GitHub layout)');
            return;
        }

        sidebar.insertAdjacentHTML('beforeend', getLoadingContainerHtml());
        sectionHtml = getLoadingContainerHtml();
        setupSettingsListener();
        similarReposSidebar = sidebar;
        setSection(document.querySelector('#similar-repos-container'));
        // Github appends sidebar sections asynchronously.
        // Move SimRepo back to the bottom whenever that happens.
        keepContainerAtBottom();
    }

    // Don't fetch if private
    const isPrivate = document.querySelector('.Label.Label--secondary')?.textContent.trim() === 'Private';
    if (isPrivate) {
        if (options.similarShowUnavailable) {
            renderSection(getErrorContainerHtml("Unavailable for private repositories."));
            setupSettingsListener();
        } else {
            removeSection();
        }
        return;
    }

    // Don't fetch if less than 100 stars
    try {
        const starElement =
            document.querySelector('[data-testid="star-button"] [data-component="CounterLabel"]') ||
            document.querySelector('[data-testid="star-button"]');

        let starsCount = parseCount(starElement?.textContent || '');

        if (starsCount === null) {
            console.warn('💈 SimRepo: star button element not found, falling back to innerText');
            const line = document.body.innerText
                .split('\n')
                .map(l => l.trim())
                .find(l => /^Star\s*[\d.]+[kKmM]?/.test(l));
            if (line) {
                starsCount = parseCount(line.replace(/^Star\s*/, ''));
            }
        }

        if (starsCount === null) {
            console.warn('💈 SimRepo: unable to determine stars count, proceeding with fetch anyway');
        }

        if (starsCount !== null && starsCount < 100) {
            if (options.similarShowUnavailable) {
                renderSection(getErrorContainerHtml("Unavailable for repositories with less than 100 stars."));
                setupSettingsListener();
            } else {
                removeSection();
            }
            return;
        }
    } catch (error) {
        console.error('Error fetching stars count:', error);
    }

    let page = nextPage;
    nextPage += 1;

    try {
        loading = true;
        let response = await getSimilarReposV2(repoName, page);
        loading = false;

        if (response.status === "success" && response.data !== undefined) {
            console.log('💈 Found similar repos for repo:', repoName, ', data:', response.data);

            if (repoName != await getRepoName()) {
                console.log('💈 Repo changed during fetch, aborting update.');
                loadMoreRepos();
                return;
            }

            let innerContainer = document.getElementById("similar-repos-inner-container");
            if (innerContainer) {
                if (page === 1) {
                    innerContainer.innerHTML = getContainerInnerHtml(response.data);
                } else {
                    innerContainer.insertAdjacentHTML('beforeend', getContainerInnerHtml(response.data));
                }
            } else {
                renderSection(getContainerHtml(response.data));
                setupCallback();
            }
        } else {
            console.log('No similar repos found');

            if (response.status === "error" && response.message) {
                renderError(response.message, page);
            } else {
                renderError("No similar repositories found. Try on older repositories.", page);
            }
        }
    } catch (error) {
        console.error('Error fetching similar repos:', error);
        loading = false;
        renderError(error.message, page);
    }
}
