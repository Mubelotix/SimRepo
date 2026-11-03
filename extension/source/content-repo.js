import GH_LANG_COLORS from 'gh-lang-colors';
import octicons from "@primer/octicons";
import { getSimilarReposV2, formatNumber, loadingSpinner, setupSettingsListener } from './common.js';
import { optionsStorage } from './options-storage.js';
import { reportEvent } from './analytics.js';

var loading = false;
var nextPage = 1;
var similarReposSection = null;
var sectionPath = null;

function findSidebar() {
    // Inspect GitHub's section titles, not its generated CSS classes. README
    // headings can have the same titles, so never use them as sidebar anchors.
    const headings = Array.from(document.querySelectorAll('h2')).filter((heading) => {
        if (heading.closest('article, [itemprop="text"], #readme, [data-testid="readme"], nav, header, footer, #similar-repos-container')) return false;
        const title = heading.textContent.replace(/\s+/g, ' ').trim();
        return /^(Releases|Contributors|Languages)(?:\s*[\d,.kKmM+]+(?:\s*\([\d,.kKmM+]+\))?)?$/.test(title);
    });

    for (const heading of headings) {
        // The nearest shared parent also handles layouts with extra wrappers
        // around individual sections. Never climb into the overall page.
        let sidebar = heading.parentElement.parentElement;
        while (sidebar && !sidebar.matches('main, body, html')) {
            if (headings.some((other) => other !== heading && sidebar.contains(other))) return sidebar;
            sidebar = sidebar.parentElement;
        }
    }
    // Some repositories have only one of these sections.
    const sidebar = headings[0]?.parentElement.parentElement;
    return sidebar && !sidebar.matches('main, body, html') ? sidebar : null;
}

// Keep the actual node, even before the sidebar exists or after GitHub removes
// it. Retrying can then reattach it without snapshots or rebinding listeners.
function renderSection(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    const section = template.content.firstElementChild;
    similarReposSection?.replaceWith(section);
    similarReposSection = section;
    sectionPath = window.location.pathname;
    setupCallback();
    restoreContainer();
}

// Disable the section entirely (github should not restore it later).
function removeSection() {
    similarReposSection?.remove();
    similarReposSection = null;
    sectionPath = null;
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

// Styling lives in content.css; no GitHub CSS-module classes are needed.
const SECTION_HEADER_HTML = `
    <h2>
        <span>Similar repositories</span>
        <a href="#" id="simrepo-settings-btn" class="Link--secondary" title="Settings" aria-label="SimRepo settings">
            ${octicons.gear.toSVG()}
        </a>
    </h2>`;

function getContainerHtml(results) {
    let innerHtml = getContainerInnerHtml(results);

    return `
    <div id="similar-repos-container">
        ${SECTION_HEADER_HTML}

        <div id="similar-repos-inner-container">${innerHtml}</div>

        <div class="mt-2">
            <a class="Link--muted" id="similar-repos-view-more">View more</a>
        </div>
    </div>`;
}

function getLoadingContainerHtml() {
    return `
    <div id="similar-repos-container">
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
    <div id="similar-repos-container">
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
    }
}

// The same retry handles initial rendering, removal, replacement and ordering.
function restoreContainer() {
    if (!similarReposSection) return;
    if (sectionPath !== window.location.pathname) {
        removeSection();
        return;
    }
    const sidebar = findSidebar();
    if (sidebar && (similarReposSection.parentElement !== sidebar || sidebar.lastElementChild !== similarReposSection)) {
        sidebar.appendChild(similarReposSection);
    }
}

setInterval(restoreContainer, 1000);

function setupCallback() {
    const viewMoreLink = similarReposSection.querySelector('#similar-repos-view-more');
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

    similarReposSection.addEventListener('click', (event) => {
        const link = event.target.closest('a[href^="/"]');
        if (link) {
            reportEvent('recommended-repo-click', { context: 'repository', repo: link.getAttribute('href') });
        }
    });

    setupSettingsListener(similarReposSection);
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
        removeSection();
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
        sectionPath = window.location.pathname;
        if (
            container.dataset.simrepoRepo === repoName &&
            container.dataset.simrepoTerminal === 'not-in-dataset'
        ) {
            restoreContainer();
            return;
        }
    }
    if (!container) {
        renderSection(getLoadingContainerHtml());
    }
    similarReposSection.dataset.simrepoRepo = repoName;
    delete similarReposSection.dataset.simrepoTerminal;

    // Don't fetch if private
    const isPrivate = document.querySelector('.Label.Label--secondary')?.textContent.trim() === 'Private';
    if (isPrivate) {
        if (options.similarShowUnavailable) {
            renderSection(getErrorContainerHtml("Unavailable for private repositories."));
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

            let innerContainer = similarReposSection?.querySelector('#similar-repos-inner-container');
            if (innerContainer) {
                if (page === 1) {
                    innerContainer.innerHTML = getContainerInnerHtml(response.data);
                } else {
                    innerContainer.insertAdjacentHTML('beforeend', getContainerInnerHtml(response.data));
                }
            } else {
                renderSection(getContainerHtml(response.data));
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
