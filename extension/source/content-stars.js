import octicons from "@primer/octicons";
import GH_LANG_COLORS from 'gh-lang-colors';
import { formatNumber, getSimilarRepos, loadingSpinner, setupSettingsListener } from './common.js';
import { optionsStorage } from "./options-storage.js";
import { reportEvent } from './analytics.js';

const MAX_BATCH_REPO_IDS = 120;
const DEFAULT_STARS_TO_LOAD = 30;

function getStarsToLoad(options) {
    const requested = Number(options.homepageStarsToLoad);
    if (!Number.isFinite(requested)) {
        return DEFAULT_STARS_TO_LOAD;
    }
    return Math.min(Math.max(1, Math.floor(requested)), MAX_BATCH_REPO_IDS);
}

export async function initHome() {
    let options = await optionsStorage.getAll();
    const starsToLoad = getStarsToLoad(options);

    if (options.homepageHideChangelog) {
        hideGitHubChangelog();
    }

    if (!options.homepageEnabled) {
        console.log("Homepage recommendations are disabled in options.");
        return;
    }

    if (options.homepageRedirectToFeed && window.location.pathname === '/') {
        window.location.replace('/feed');
        return;
    }

    console.log("Producing recommendations on the homepage");

    let aside = document.querySelector('aside.feed-right-column');
    let outerContainer = document.createElement('div');
    outerContainer.setAttribute("class", "mb-3 dashboard-changelog color-bg-default border color-border-muted p-3 rounded-3");
    let title = document.createElement('h2');
    title.setAttribute("class", "f5 text-bold mb-3 width-full dashboard-changelog__title");
    title.innerHTML = `For you
    <a href="#" id="simrepo-settings-btn" class="Link--secondary pt-1 pl-2" title="Settings" style="float: right;">
        ${octicons.gear.toSVG()}
    </a>`;
    outerContainer.appendChild(title);
    let container = document.createElement('div');
    outerContainer.appendChild(container);

    aside.appendChild(outerContainer);

    container.innerHTML = getLoadingHtml(starsToLoad);
    container.style.height = 'unset';
    container.style.overflow = 'unset';

    setupSettingsListener();

    try {
        await run(container, options, starsToLoad);
    } catch (error) {
        console.error("Error during homepage recommendations:", error);
        container.innerHTML = `<div class="color-fg-muted">Failed to load recommendations. Please try again later or <a href="https://github.com/Mubelotix/SimRepo/issues">open an issue</a>.<br/>Details: <code>${error.message}</code></div>`;
    }
}

// GitHub's own "Latest from our changelog" box. The extension's "For you" box
// reuses the same CSS classes, so match by the exact title text.
function hideGitHubChangelog() {
    const hide = () => {
        for (const heading of document.querySelectorAll('.dashboard-changelog__title')) {
            if (heading.textContent.includes('Latest from our changelog')) {
                heading.closest('.dashboard-changelog').style.display = 'none';
                return true;
            }
        }
        return false;
    };

    if (!hide()) {
        // GitHub renders the changelog asynchronously; retry until it appears.
        const attempts = 200;
        let count = 0;
        const interval = setInterval(() => {
            count += 1;
            if (hide() || count >= attempts) {
                clearInterval(interval);
            }
        }, 100);
    }
}

function getGithubUserId() {
    const avatar = document.querySelector('img[data-testid="github-avatar"]');
    const match = avatar?.src.match(/\/u\/(\d+)(?:[/?#]|$)/);
    return match?.[1] || null;
}

export async function initStarsList() {
    let documentHtml = document.documentElement.innerHTML;
    let regex = /details-user-list-(\d+)-unstarred/g;
    let stars = new Set();
    let matches;
    while ((matches = regex.exec(documentHtml)) !== null) {
        let id = matches[1];
        if (id) {
            stars.add(Number(id));
        }
    }

    console.log("Collected stars:", stars);

    let response = await getSimilarRepos(
        Array.from(stars).slice(0, MAX_BATCH_REPO_IDS),
        0.5,
        getGithubUserId(),
    );
    console.log('💈 Found similar repos for homepage:', response);
}

function getRandomSubsetInOrder(array, count) {
    const actualCount = Math.min(count, array.length);
    const indices = new Set();
    while (indices.size < actualCount) {
        const i = Math.floor(Math.random() * array.length);
        indices.add(i);
    }

    const sortedIndices = Array.from(indices).sort((a, b) => a - b);
    return sortedIndices.map(i => array[i]);
}

async function run(container, options, starsToLoad) {
    let login = document.querySelector('meta[name="user-login"]').getAttribute('content');
    console.log("User login:", login);

    let after = null;
    let stars = new Set();

    while (stars.size < starsToLoad) {
        let url = `https://github.com/${login}?tab=stars`;
        if (after) {
            url += `&after=${after}`;
        }

        let response = await fetch(url);
        let text = await response.text();

        // Extract starred repository IDs from the HTML
        let regex = /details-user-list-(\d+)-unstarred/g;
        let matches;
        while ((matches = regex.exec(text)) !== null) {
            let id = matches[1];
            if (id) {
                stars.add(Number(id));
                if (stars.size >= starsToLoad) {
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

    let response = await getSimilarRepos(Array.from(stars), 0.5, getGithubUserId());
    if (response.status !== "success") {
        throw new Error(response.message || "Repo not included in the dataset yet");
    }

    let recommendations = Array.isArray(response.data) ? response.data : [];
    console.log('💈 Found similar repos for homepage:', response);
    if (options.homepagePoolSize > 1) {
        recommendations = getRandomSubsetInOrder(recommendations, options.homepageCount);
        console.log('💈 Created a subset of', options.homepageCount, 'repositories');
    } else {
        recommendations = recommendations.slice(0, options.homepageCount);
    }

    let innerHtml = '';
    for (let i = 0; i < recommendations.length; i++) {
        const last = i === recommendations.length - 1;
        innerHtml += getHtml(recommendations[i], last);
    }

    console.log("Container for recommendations:", container);
    container.innerHTML = innerHtml;

    container.addEventListener('click', (event) => {
        const link = event.target.closest('a[href^="/"]');
        if (link) {
            reportEvent('recommended-repo-click', { context: 'homepage', repo: link.getAttribute('href') });
        }
    });
}

function getLoadingHtml(latestStars) {
    return `
    <div class="d-flex align-items-center justify-between mt-3">
        <p class="text-small color-fg-muted mb-0 flex-1 min-width-0">
            Analyzing your ${latestStars} latest stars to provide recommendations...
        </p>
        <span class="ml-2 flex-shrink-0 d-inline-flex align-items-center">
            ${loadingSpinner("")}
        </span>
    </div>`
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function getHtml(result, lasts) {
    const fullName = String(result.repo ?? "");
    const separator = fullName.indexOf('/');
    const owner = separator === -1 ? "" : fullName.slice(0, separator);
    const repoName = separator === -1 ? fullName : fullName.slice(separator + 1);
    const meta = result.meta ?? {};
    const logoUrl = String(result.logoUrl || `https://github.com/${owner}.png?size=40`);
    const avatarUrl = logoUrl.includes('?') ? `${logoUrl}&s=40` : `${logoUrl}?s=40`;
    const language = meta.language ? String(meta.language) : "";
    const score = Number(result.score);
    const scoreText = Number.isFinite(score) ? score.toFixed(2) : "";

    return `
    <div ${lasts ? 'class="pt-3"' : 'class="py-3 border-bottom"'}>
        <div class="Truncate d-flex flex-justify-between">
            <span style="word-wrap:normal;max-width: 300px;" class="Truncate-text ws-normal flex-1">
            <img src="${escapeHtml(avatarUrl)}" alt="@${escapeHtml(owner)} profile" size="20" height="20" width="20" class="avatar avatar-small circle box-shadow-none mr-1">
            <a href="/${escapeHtml(fullName)}" class="Link color-fg-default text-bold">${escapeHtml(owner)} <span class="color-fg-muted text-light">/</span> ${escapeHtml(repoName)}</a></span>
        </div>
        <p class="text-small color-fg-muted mt-2">
            ${escapeHtml(meta.description)}
        </p>

        <div class="color-fg-muted d-inline-block mr-4 mt-1 f6">
            ${octicons.star.toSVG()}
            ${formatNumber(meta.stars_total ?? 0)}
        </div>
        <div class="color-fg-muted d-inline-block mr-4 mt-1 f6" title="Similarity score">
            ${octicons.flame.toSVG()}
            ${escapeHtml(scoreText)}
        </div>
        <div class="color-fg-muted d-inline-block f6 mt-1">
            <span class="">
            <span class="repo-language-color" style="background-color: ${escapeHtml(GH_LANG_COLORS[language] || '')}"></span>
            <span itemprop="programmingLanguage">${escapeHtml(language)}</span>
            </span>
        </div>
    </div>`
}
