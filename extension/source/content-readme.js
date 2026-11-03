import { optionsStorage } from './options-storage.js';

const CHART_CONTAINER_ID = 'simrepo-readme-chart';
const DUPLICATE_CHART_HOSTS = ['star-history.dera.page', 'star-history.com'];

let observer = null;
let scheduled = false;

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
    section.setAttribute('aria-label', 'Star History');

    const heading = document.createElement('h2');
    heading.textContent = `${hasEmojiInHeading(readme) ? '⭐ ' : ''}Star History`;

    const link = document.createElement('a');
    link.href = `https://star-history.dera.page/#${repo}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    const picture = document.createElement('picture');
    const darkSource = document.createElement('source');
    const darkParams = new URLSearchParams({ repos: repo, style, theme: 'dark' });
    darkSource.media = '(prefers-color-scheme: dark)';
    darkSource.srcset = `https://simrepo.dera.page/svg?${darkParams.toString()}`;

    const image = document.createElement('img');
    const lightParams = new URLSearchParams({ repos: repo, style });
    image.src = `https://simrepo.dera.page/svg?${lightParams.toString()}`;
    image.alt = `Star History Chart for ${repo}`;
    image.loading = 'lazy';
    image.addEventListener('error', () => {
        readme.dataset.simrepoChartUnavailable = repo;
        section.remove();
    }, { once: true });

    picture.append(darkSource, image);
    link.append(picture);
    section.append(heading, link);
    return section;
}

async function addReadmeChart() {
    const repo = getRepoName();
    if (!repo) return;

    const options = await optionsStorage.getAll();
    if (!options.readmeChartEnabled) return;

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
    if (!observer && document.body) {
        observer = new MutationObserver(scheduleChart);
        observer.observe(document.body, { childList: true, subtree: true });
    }
    scheduleChart();
}
