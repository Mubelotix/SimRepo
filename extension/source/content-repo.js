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
    const headings = Array.from(document.querySelectorAll('h2'));
    const about = headings.filter(heading => heading.textContent.trim() === 'About');
    const anchor = headings.find(heading => heading.textContent.trim() === 'Languages') ||
        headings.find(heading => heading.querySelector('a')?.textContent.trim() === 'Contributors' ||
            heading.textContent.trim() === 'Contributors');
    if (!anchor) return null;

    // Sidebar sections share a parent; their generated class names can change.
    for (let parent = anchor.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        if (about.some(heading => parent.contains(heading))) return parent;
    }
    return null;
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

// See https://github.com/Mubelotix/SimRepo/issues/25
const forkIcon = octicons['repo-forked'].toSVG({ class: 'simrepo-fork' }).replace('octicon-repo-forked', 'octicon-simrepo-fork');

function getHtml(owner, repo, fullname, description, language, stars, forks, archived, similarity) {
    return `
<div class="Box d-flex p-2 width-full public source">
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
                ${forkIcon}
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

function getErrorContainerHtml(error = "No similar repositories found.", code = null) {
    return `
    <div class="SidebarSection-module__sidebarSection" id="similar-repos-container">
        ${SECTION_HEADER_HTML}

        <div class="text-small color-fg-muted">
            ${getErrorHtml(error, code)}
        </div>
    </div>`;
}

const STAR_REQUIRED_MESSAGE = "Star SimRepo on GitHub to view more than three similar repositories.";

function getErrorMessage(raw) {
    if (typeof raw !== 'string') {
        return "Repo not included in the dataset yet";
    }
    return raw;
}

function escapeHtml(text) {
    return text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function getErrorHtml(message, code) {
    if (code === 'star-required') {
        return '<a class="simrepo-star-link" href="https://github.com/Mubelotix/SimRepo" target="_blank" rel="noopener noreferrer">Star SimRepo on GitHub</a> to view more than three similar repositories.';
    }
    if (code === 'star-required-rate-limit') {
        return 'You\'ve reached the limit for similar-repositories lookups. <a class="simrepo-star-link" href="https://github.com/Mubelotix/SimRepo" target="_blank" rel="noopener noreferrer">Star SimRepo on GitHub</a> to increase your usage limits.';
    }
    return escapeHtml(message);
}

// Show an error, but keep already-loaded items intact when paginating ("view
// more"): replace the section only on the first page, otherwise append a notice.
function renderError(message, page, code = null, repoName = null) {
    const display = code === 'star-required' ? STAR_REQUIRED_MESSAGE : getErrorMessage(message);
    if (code === 'star-required' || code === 'star-required-rate-limit') {
        void reportEvent('star-required', { context: 'repository', page });
    }

    if (page > 1 && similarReposSection) {
        const viewMore = similarReposSection.querySelector('#similar-repos-view-more');
        const note = document.createElement('div');
        note.className = 'text-small color-fg-muted mt-2';
        note.innerHTML = getErrorHtml(display, code);
        if (viewMore) {
            viewMore.closest('div').insertAdjacentElement('beforebegin', note);
        } else {
            similarReposSection.appendChild(note);
        }
    } else {
        renderSection(getErrorContainerHtml(display, code));
    }
    if (similarReposSection) {
        if (repoName !== null) {
            similarReposSection.dataset.simrepoRepo = repoName;
        }
        similarReposSection.dataset.simrepoTerminal = code === 'not-in-dataset' ? 'not-in-dataset' : '';
        sectionHtml = similarReposSection.outerHTML;
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
            setupCallback();
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

function getGithubUserId() {
    const avatar = document.querySelector('img[data-testid="github-avatar"]');
    const match = avatar?.src.match(/\/u\/(\d+)(?:[/?#]|$)/);
    return match?.[1] || null;
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
    if (container) {
        // Adopt a section left behind by a previous content-script instance.
        similarReposSection = container;
        similarReposSidebar = container.parentElement;
        sectionHtml = container.outerHTML;
        if (
            container.dataset.simrepoRepo === repoName &&
            container.dataset.simrepoTerminal === 'not-in-dataset'
        ) {
            keepContainerAtBottom();
            setupSettingsListener();
            return;
        }
    }
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
    similarReposSection.dataset.simrepoRepo = repoName;
    delete similarReposSection.dataset.simrepoTerminal;

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

    let page = nextPage;
    nextPage += 1;
    const githubUserId = getGithubUserId();

    try {
        loading = true;
        let response = await getSimilarReposV2(repoName, page, githubUserId);
        loading = false;

        if (response.status === "success" && response.data !== undefined) {
            console.log('💈 Found similar repos for repo:', repoName, ', data:', response.data);

            if (response.data.length === 0) {
                renderError("No more similar repositories found.", page);
                return;
            }

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
                sectionHtml = similarReposSection?.outerHTML ?? sectionHtml;
            } else {
                renderSection(getContainerHtml(response.data));
                setupCallback();
            }
        } else {
            console.log('No similar repos found');

            if (response.status === "error" && response.message) {
                renderError(response.message, page, response.code, repoName);
            } else {
                renderError("Repo not included in the dataset yet", page, "not-in-dataset", repoName);
            }
        }
    } catch (error) {
        console.error('Error fetching similar repos:', error);
        loading = false;
        renderError(error.message, page, error.code, repoName);
    }
}
