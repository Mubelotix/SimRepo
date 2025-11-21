import octicons from "@primer/octicons";
import GH_LANG_COLORS from 'gh-lang-colors';
import { formatNumber, getSimilarRepos, loadingSpinner, setupSettingsListener } from './common.js';
import { optionsStorage } from "./options-storage.js";

export async function initHome() {
    let options = await optionsStorage.getAll();
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

    container.innerHTML = getLoadingHtml(options.homepageStarsToLoad);
    container.style.height = 'unset';
    container.style.overflow = 'unset';

    setupSettingsListener();

    try {
        await run(container, options);
    } catch (error) {
        console.error("Error during homepage recommendations:", error);
        container.innerHTML = `<div class="color-fg-muted">Failed to load recommendations. Please try again later or <a href="https://github.com/Mubelotix/SimRepo/issues">open an issue</a>.<br/>Details: <code>${error.message}</code></div>`;
    }
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

    let response = await getSimilarRepos(Array.from(stars), 0, 20);
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

async function run(container, options) {
    let login = document.querySelector('meta[name="user-login"]').getAttribute('content');
    console.log("User login:", login);

    let after = null;
    let stars = new Set();

    while (stars.size < options.homepageStarsToLoad) {
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
                if (stars.size >= options.homepageStarsToLoad) {
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

    let recommendationCount = Math.round(options.homepageCount * options.homepagePoolSize);
    let response = await getSimilarRepos(Array.from(stars), 0, recommendationCount);
    console.log('💈 Found similar repos for homepage:', response);
    if (options.homepagePoolSize > 1) {
        response.data = getRandomSubsetInOrder(response.data, options.homepageCount);
        console.log('💈 Created a subset of', options.homepageCount, 'repositories');
    }

    let innerHtml = '';
    for (let i = 0; i < response.data.length; i++) {
        const last = i === response.data.length - 1;
        innerHtml += getHtml(response.data[i], last);
    }

    console.log("Container for recommendations:", container);
    container.innerHTML = innerHtml;
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

function getHtml(result, lasts) {
    let repo = result.payload;
    return `
    <div ${lasts ? 'class="pt-3"' : 'class="py-3 border-bottom"'}>
        <div class="Truncate d-flex flex-justify-between">
            <span style="word-wrap:normal;max-width: 300px;" class="Truncate-text ws-normal flex-1">
            <img src="https://avatars.githubusercontent.com/u/${repo.owner.id}?s=40&amp;v=4" alt="@${repo.owner.login} profile" size="20" height="20" width="20" class="avatar avatar-small circle box-shadow-none mr-1">
            <a href="/${repo.full_name}" class="Link color-fg-default text-bold">${repo.owner.login} <span class="color-fg-muted text-light">/</span> ${repo.name}</a></span>
        </div>
        <p class="text-small color-fg-muted mt-2">
            ${repo.description}
        </p>

        <div class="color-fg-muted d-inline-block mr-4 mt-1 f6">
            ${octicons.star.toSVG()}
            ${formatNumber(repo.stargazers_count)}
        </div>
        <div class="color-fg-muted d-inline-block mr-4 mt-1 f6">
            ${octicons.flame.toSVG()}
            ${Math.floor(result.score * 100)}%
        </div>
        <div class="color-fg-muted d-inline-block f6 mt-1">
            <span class="">
            <span class="repo-language-color" style="background-color: ${GH_LANG_COLORS[repo.language]}"></span>
            <span itemprop="programmingLanguage">${repo.language}</span>
            </span>
        </div>
    </div>`
}
