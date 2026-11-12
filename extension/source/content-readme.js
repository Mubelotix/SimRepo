import { optionsStorage } from './options-storage.js';
import octicons from '@primer/octicons';
import { isPrivateRepo } from './common.js';

const CHART_CONTAINER_ID = 'simrepo-readme-chart';
const DUPLICATE_CHART_HOSTS = ['star-history.dera.page', 'star-history.com'];
const systemColorScheme = window.matchMedia('(prefers-color-scheme: dark)');

let observer = null;
let themeObserver = null;
let scheduled = false;

function getGitHubTheme() {
    const { colorMode, lightTheme, darkTheme } = document.documentElement.dataset;
    const mode = colorMode === 'light' || colorMode === 'dark'
        ? colorMode
        : systemColorScheme.matches ? 'dark' : 'light';
    const theme = mode === 'dark' ? darkTheme : lightTheme;
    return theme?.startsWith('dark') ? 'dark' : theme?.startsWith('light') ? 'light' : mode;
}

function showChartRateLimit(image, repo, code) {
    const section = image.closest(`#${CHART_CONTAINER_ID}`);
    if (!section) return;
    const readme = section.parentElement;
    readme.dataset.simrepoChartUnavailable = repo;

    const notice = document.createElement('p');
    notice.className = 'simrepo-readme-rate-limit';
    notice.setAttribute('role', 'status');
    notice.textContent = 'Star History is rate limited. ';
    if (code === 'star-required-rate-limit') {
        const link = document.createElement('a');
        link.className = 'simrepo-star-link';
        link.href = 'https://github.com/Mubelotix/SimRepo';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Star SimRepo on GitHub';
        notice.append(link, ' to increase your usage limits.');
    } else {
        notice.append('Please try again later.');
    }
    section.replaceChildren(notice);
}

async function updateChartImage(image, repo, style) {
    const theme = getGitHubTheme();
    if (image.dataset.theme === theme) return;
    image.dataset.theme = theme;
    try {
        // GitHub blocks third-party image URLs. Fetch with the extension's host
        // permission and embed a data URL, which GitHub explicitly permits.
        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ type: 'loadReadmeChart', repo, style, theme }, (result) => {
                if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                else resolve(result);
            });
        });
        if (!image.isConnected || image.dataset.theme !== theme) return;
        if (response?.httpStatus === 429) {
            showChartRateLimit(image, repo, response.code);
            return;
        }
        if (response?.status !== 'success') throw new Error(response?.message || 'Chart unavailable');
        image.src = response.dataUrl;
    } catch {
        if (image.isConnected && image.dataset.theme === theme) image.dispatchEvent(new Event('error'));
    }
}

function updateChartTheme() {
    const section = document.getElementById(CHART_CONTAINER_ID);
    const image = section?.querySelector('img');
    if (!image) return;
    void updateChartImage(image, section.dataset.repo, section.dataset.style);
}

function getRepoName() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
}

// GitHub has changed README classes and wrappers repeatedly. `itemprop="text"`
// is semantic markup around the rendered README and is more stable than CSS-module
// names or a particular layout's class names.
function findReadme() {
    return document.querySelector('main article[itemprop="text"]') ||
        document.querySelector('article[itemprop="text"]') ||
        document.querySelector('[data-testid="readme"]');
}

function containsExistingChart(readme) {
    const content = `${readme.textContent || ''} ${Array.from(readme.querySelectorAll('[href], [src], [srcset]'))
        .map((element) => `${element.getAttribute('href') || ''} ${element.getAttribute('src') || ''} ${element.getAttribute('srcset') || ''}`)
        .join(' ')}`.toLowerCase();
    return DUPLICATE_CHART_HOSTS.some((host) => content.includes(host));
}

function hasEmojiInHeading(readme) {
    return Array.from(readme.querySelectorAll('h1, h2, h3, h4, h5, h6'))
        .some((heading) => /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(heading.textContent || ''));
}

function makeChartSection(repo, style, readme) {
    const section = document.createElement('section');
    section.id = CHART_CONTAINER_ID;
    section.className = 'simrepo-readme-chart';
    section.dataset.repo = repo;
    section.dataset.style = style;
    section.setAttribute('aria-label', 'Star History');

    const heading = document.createElement('h2');
    const title = document.createElement('span');
    title.textContent = `${hasEmojiInHeading(readme) ? '⭐ ' : ''}Star History`;

    const settingsButton = document.createElement('button');
    settingsButton.type = 'button';
    settingsButton.className = 'simrepo-readme-settings Link--secondary';
    settingsButton.title = 'Settings';
    settingsButton.setAttribute('aria-label', 'SimRepo settings');
    settingsButton.innerHTML = octicons.gear.toSVG();
    settingsButton.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'openOptionsPage' });
    });
    heading.append(title, settingsButton);

    const link = document.createElement('a');
    link.href = `https://star-history.dera.page/#${repo}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    const image = document.createElement('img');
    image.alt = `Star History Chart for ${repo}`;
    image.loading = 'lazy';
    image.addEventListener('error', () => {
        readme.dataset.simrepoChartUnavailable = repo;
        section.remove();
    }, { once: true });
    void updateChartImage(image, repo, style);

    link.append(image);
    section.append(heading, link);
    return section;
}

async function addReadmeChart() {
    const repo = getRepoName();
    if (!repo || isPrivateRepo()) return;

    const options = await optionsStorage.getAll();
    if (!options.readmeChartEnabled || isPrivateRepo() || repo !== getRepoName()) return;

    const readme = findReadme();
    if (!readme || containsExistingChart(readme)) return;
    if (readme.dataset.simrepoChartUnavailable === repo) return;
    if (readme.dataset.simrepoChartAttempted === repo && readme.querySelector(`#${CHART_CONTAINER_ID}`)) return;

    readme.dataset.simrepoChartAttempted = repo;
    document.querySelectorAll(`#${CHART_CONTAINER_ID}`).forEach((chart) => chart.remove());

    const style = options.readmeChartStyle === 'github' ? 'github' : 'xkcd';
    readme.append(makeChartSection(repo, style, readme));
}

function scheduleChart() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
        scheduled = false;
        void addReadmeChart().catch((error) => console.error('SimRepo: failed to add README chart', error));
    });
}

export function initReadmeChart() {
    if (!themeObserver) {
        themeObserver = new MutationObserver(updateChartTheme);
        themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-color-mode', 'data-light-theme', 'data-dark-theme'],
        });
        systemColorScheme.addEventListener('change', updateChartTheme);
    }
    if (!observer && document.body) {
        observer = new MutationObserver(scheduleChart);
        observer.observe(document.body, { childList: true, subtree: true });
    }
    scheduleChart();
}
