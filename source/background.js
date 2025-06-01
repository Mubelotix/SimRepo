// eslint-disable-next-line import/no-unassigned-import
import { optionsStorage } from './options-storage.js';
import npyjs from 'npyjs';
import { Decompress } from 'fflate';
import { repo } from '@primer/octicons';
import { initCache } from './cache.js';

var model = null;
var repoIdsMap = new Map();
var repoIndexesMap = new Map();

async function initModel() {
    const modelUrl = chrome.runtime.getURL('embeddings.npy');
    const n = new npyjs();
    model = await n.load(modelUrl);

    if (!model || !model.data || !model.shape) {
        throw new Error('Failed to load model data');
    }

    console.log('Model loaded:', model);
}

async function initRepoIds() {
    const csvUrl = chrome.runtime.getURL('repo_ids.csv');
    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error('Failed to fetch repo index CSV');

    const text = await response.text();

    // Parse CSV: expect header line, then lines like `repo_id,index,name`
    // We want a Map from repo_id (string or number) to index (number)
    const lines = text.trim().split('\n');
    for (let i = 1; i < lines.length; i++) {
        repoIdsMap.set(i-1, Number(lines[i]));
        repoIndexesMap.set(Number(lines[i]), i-1);
    }

    console.log('Repo ID to index map loaded:', repoIdsMap, repoIndexesMap);
}

var ready = (async () => {
    try {
        await initModel();
        await initRepoIds();
        initCache();
    } catch (error) {
        console.error('Error initializing model or repo IDs:', error);
    }
})();

function getVector(index) {
    if (!model || !model.data || !model.shape) {
        throw new Error('Model not initialized or invalid');
    }

    if (index < 0 || index >= model.shape[0]) {
        throw new Error('Index out of bounds for model data');
    }

    const vectorSize = model.shape[1];
    const start = index * vectorSize;
    const end = start + vectorSize;
    return model.data.slice(start, end);
}

function cosineSimilarity(vecA, vecB) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function getClosestNIndexes(indexes, max, min, threshold) {
    if (!model || !model.data || !model.shape) {
        throw new Error('Model not initialized or invalid');
    }

  const totalVectors = model.shape[0];
    const vectors = indexes.map(getVector);
    const vectorLength = vectors[0].length;
    const targetVector = new Array(vectorLength).fill(0);

    for (const vec of vectors) {
        for (let i = 0; i < vectorLength; i++) {
            targetVector[i] += vec[i];
        }
    }
    // for (let i = 0; i < vectorLength; i++) {
    //     targetVector[i] /= indexes.length;
    // }

    let aboveThreshold = 0;
    const scores = [];
    for (let i = 0; i < totalVectors; i++) {
        if (indexes.includes(i)) {
            continue;
        }
        const compareVector = getVector(i);
        const similarity = cosineSimilarity(targetVector, compareVector);

        if (similarity >= threshold) {
            aboveThreshold++;
        } else if (aboveThreshold >= min) {
            continue;
        }

        scores.push({ index: i, similarity });
    }

    scores.sort((a, b) => b.similarity - a.similarity);

    let n = Math.min(max, aboveThreshold);
    n = Math.max(n, min);

    return scores.slice(0, n);
}

async function findReposInfo(repoIds) {
    const url = chrome.runtime.getURL('repos.json.gz');
    const response = await fetch(url);

    if (!response.body) throw new Error('Streaming not supported');

    const decompress = new Decompress();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';
    const keySet = new Set(repoIds.map(String)); // repo IDs as strings for lookup
    const foundRepos = new Map();

    return new Promise((resolve, reject) => {
        decompress.ondata = (chunk, final) => {
            buffer += decoder.decode(chunk, { stream: !final });

            // Try to find all repo keys in the buffer
            for (const repoId of [...keySet]) {
                const key = `"${repoId}":`;
                const keyIndex = buffer.indexOf(key);

                if (keyIndex !== -1) {
                    let objStart = keyIndex + key.length;

                    // Parse the JSON object for repo
                    let braceCount = 0;
                    let objEnd = -1;

                    for (let i = objStart; i < buffer.length; i++) {
                        if (buffer[i] === '{') braceCount++;
                        else if (buffer[i] === '}') {
                            braceCount--;
                            if (braceCount === 0) {
                                objEnd = i + 1;
                                break;
                            }
                        }
                    }

                    if (objEnd !== -1) {
                        const objStr = buffer.slice(objStart, objEnd);
                        try {
                            const repoObj = JSON.parse(objStr);
                            foundRepos.set(repoId, repoObj);
                            keySet.delete(repoId);
                        } catch (e) {
                            // Partial JSON, wait for more data
                        }
                    }
                }
            }

            // Trim buffer to avoid memory blowup
            if (buffer.length > 1_000_000) {
                buffer = buffer.slice(buffer.length - 500_000);
            }

            // Resolve early if all found
            if (keySet.size === 0) {
                reader.cancel();
                resolve(foundRepos);
            }

            // If final chunk & some not found, resolve anyway with what we have
            if (final) {
                resolve(foundRepos.values());
            }
        };

        decompress.onerror = (err) => {
            reject(err);
        };

        function pump() {
            reader.read().then(({ done, value }) => {
                if (done) {
                    resolve(Array.from(foundRepos.values()));
                    return;
                }
                decompress.push(value);
                pump();
            }).catch(reject);
        }

        pump();
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'getSimilarRepos') { (async () => {
        console.log('Received message to get similar repos:', message);

        await ready;

        const ids = message.repoIds;
        const min = Number(message.min) || 3;
        const max = Number(message.max) || 10;
        const threshold = Number(message.threshold) || 0.95;

        const cacheKey = `cache:getSimilarRepos:${ids.sort().join(',')}:${min}:${max}:${threshold}`;

        // Check cache first
        chrome.storage.local.get([cacheKey], async (result) => {
            const cached = result[cacheKey];
            if (cached) {
                console.log('Serving from cache');
                sendResponse({ status: 'success', cached: cached.timestamp, data: cached.data });
                return;
            }

            // Not in cache: compute results
            const indexes = ids.map(id => repoIndexesMap.get(Number(id))).filter(i => i !== undefined);

            if (!indexes || indexes.length === 0) {
                sendResponse({ status: "unknown" });
                return;
            }

            let similarIndexes = getClosestNIndexes(indexes, max, min, threshold);
            let similarIds = similarIndexes.map(i => repoIdsMap.get(i.index));
            let similarityMap = new Map(similarIndexes.map(i => [repoIdsMap.get(i.index), i.similarity]));

            let similarInfos = await findReposInfo(similarIds);

            const similarInfosWithSimilarity = [];
            for (const [repoId, info] of similarInfos.entries()) {
                similarInfosWithSimilarity.push({
                    ...info,
                    repo_id: repoId,
                    similarity: similarityMap.get(Number(repoId)) || 0,
                });
            }
            similarInfosWithSimilarity.sort((a, b) => b.similarity - a.similarity);

            console.log('Computed and caching repo informations:', similarInfosWithSimilarity);

            // Cache the result
            chrome.storage.local.set({
                [cacheKey]: {
                    data: similarInfosWithSimilarity,
                    timestamp: Date.now()
                }
            });

            sendResponse({
                status: similarInfosWithSimilarity.length > 0 ? "success" : "error",
                data: similarInfosWithSimilarity,
            });
        });
        })();

        // Tell Chrome this is a synchronous response
        return true;
    }
});
