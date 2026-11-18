const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../source/content-readme.js'), 'utf8')
    .replace(/^import .*;\n/gm, '')
    .replace('export function initReadmeChart', 'function initReadmeChart');

function createElement(tagName) {
    const events = new Map();
    const attributes = new Map();
    const element = {
        tagName,
        dataset: {},
        children: [],
        isConnected: true,
        setAttribute: (name, value) => attributes.set(name, value),
        getAttribute: (name) => attributes.get(name),
        removeAttribute: (name) => attributes.delete(name),
        addEventListener: (name, callback) => events.set(name, callback),
        dispatchEvent: (event) => events.get(event.type)?.(),
        append: (...children) => element.children.push(...children),
        remove: () => { element.isConnected = false; },
        querySelector: (selector) => element.children.find(child => child.tagName === selector) ||
            element.children.map(child => child.querySelector(selector)).find(Boolean),
        classList: {
            remove: (name) => {
                element.className = element.className.split(' ').filter(value => value !== name).join(' ');
            },
        },
    };
    return element;
}

function setup() {
    const requests = [];
    const observers = [];
    const image = { dataset: {}, isConnected: true };
    const section = {
        dataset: { repo: 'owner/repo', style: 'xkcd' },
        isConnected: true,
        querySelector: () => image,
    };
    const document = {
        documentElement: { dataset: { colorMode: 'light' } },
        getElementById: () => section,
        createElement,
    };
    const window = {
        location: { pathname: '/owner/repo' },
        matchMedia: () => ({ matches: false }),
    };
    const context = vm.createContext({
        document,
        window,
        Event,
        isPrivateRepo: () => false,
        octicons: { gear: { toSVG: () => '<svg></svg>' } },
        optionsStorage: { getAll: async () => ({ readmeChartEnabled: false }) },
        chrome: {
            runtime: {
                sendMessage(message, callback) {
                    requests.push(message);
                    callback({ status: 'success', dataUrl: 'data:image/png;base64,chart' });
                },
            },
        },
        IntersectionObserver: class {
            constructor(callback, options) {
                this.callback = callback;
                this.options = options;
                observers.push(this);
            }
            observe(target) { this.target = target; }
            disconnect() { this.target = null; }
        },
    });
    vm.runInContext(source, context);
    return { context, requests, observers, image, section, document, window };
}

test('creating the chart does not start a request', () => {
    const { context, requests } = setup();
    context.makeChartSection('owner/repo', 'xkcd', { querySelectorAll: () => [] });
    assert.equal(requests.length, 0);
});

test('keeps the skeleton until image load, then reveals the chart', async () => {
    const { context } = setup();
    const section = context.makeChartSection('owner/repo', 'xkcd', { querySelectorAll: () => [] });
    const link = section.querySelector('a');
    const image = section.querySelector('img');
    assert.equal(link.className, 'simrepo-readme-loading');
    assert.equal(link.getAttribute('aria-busy'), 'true');
    assert.equal(image.width / image.height, 1.5);
    await context.updateChartImage(image, 'owner/repo', 'xkcd');
    assert.equal(link.className, 'simrepo-readme-loading', 'fetch completion is not image load');
    image.dispatchEvent(new Event('load'));
    assert.equal(link.className, '');
    assert.equal(link.getAttribute('aria-busy'), undefined);
    assert.equal(link.getAttribute('aria-label'), undefined);
    assert.equal(section.isConnected, true);
});

test('removes the section and prevents retries after fetch or image failure', async () => {
    for (const fetchFails of [true, false]) {
        const { context } = setup();
        const readme = { dataset: {}, querySelectorAll: () => [] };
        const section = context.makeChartSection('owner/repo', 'xkcd', readme);
        const image = section.querySelector('img');
        if (fetchFails) {
            context.chrome.runtime.sendMessage = (_, callback) => callback({ status: 'error' });
            await context.updateChartImage(image, 'owner/repo', 'xkcd');
        } else {
            image.dispatchEvent(new Event('error'));
        }
        assert.equal(section.isConnected, false);
        assert.equal(readme.dataset.simrepoChartUnavailable, 'owner/repo');
    }
});

test('waits for proximity, then fetches once using the current theme', async () => {
    const state = setup();
    const { context, requests, observers, image, section, document } = state;
    context.observeChart(section);
    assert.equal(observers[0].options.rootMargin, '600px');
    assert.equal(requests.length, 0);

    document.documentElement.dataset.colorMode = 'dark';
    context.updateChartTheme();
    observers[0].callback([{ target: section, isIntersecting: false }]);
    assert.equal(requests.length, 0);

    observers[0].callback([{ target: section, isIntersecting: true }]);
    await Promise.resolve();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].theme, 'dark');
    assert.equal(image.src, 'data:image/png;base64,chart');
    assert.equal(observers[0].target, null);
    observers[0].callback([{ target: section, isIntersecting: true }]);
    assert.equal(requests.length, 1);

    document.documentElement.dataset.colorMode = 'light';
    context.updateChartTheme();
    await Promise.resolve();
    assert.equal(requests.length, 2);
    assert.equal(requests[1].theme, 'light');
});

test('ignores removed charts and charts from the previous repository', () => {
    for (const removed of [true, false]) {
        const { context, requests, observers, section, window } = setup();
        context.observeChart(section);
        if (removed) section.isConnected = false;
        else window.location.pathname = '/other/repo';
        observers[0].callback([{ target: section, isIntersecting: true }]);
        assert.equal(requests.length, 0);
        assert.equal(observers[0].target, null);
    }
});

test('does not fetch when the current repository becomes private', () => {
    const { context, requests, observers, section } = setup();
    context.observeChart(section);
    context.isPrivateRepo = () => true;
    observers[0].callback([{ target: section, isIntersecting: true }]);
    assert.equal(requests.length, 0);
});

test('cleans up removed pending charts and ignores stale observer entries', async () => {
    const { context, requests, observers, section, image } = setup();
    context.observeChart(section);
    section.isConnected = false;
    await context.addReadmeChart();
    assert.equal(observers[0].target, null);

    const replacement = {
        dataset: section.dataset,
        isConnected: true,
        querySelector: () => image,
    };
    context.observeChart(replacement);
    observers[0].callback([{ target: section, isIntersecting: true }]);
    assert.equal(requests.length, 0);
    assert.equal(observers[0].target, replacement);
    observers[0].callback([{ target: replacement, isIntersecting: true }]);
    assert.equal(requests.length, 1);
});
