// eslint-disable-next-line import/no-unassigned-import
import { optionsStorage } from './options-storage.js';
import npyjs from 'npyjs';
import { BiMap } from '@rimbu/bimap';

var model = null;
var repoIds = null;

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
	let data = [];
	for (let i = 1; i < lines.length; i++) {
		const [repo_id, index, /* name */] = lines[i].split(',');
		data.push([Number(repo_id), Number(index)]);
	}

	repoIds = BiMap.of(...data);

	console.log('Repo ID to index map loaded:', repoIds);
}

var ready = (async () => {
    try {
        await initModel();
        await initRepoIds();
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

function getClosestNIndexes(index, n) {
	if (!model || !model.data || !model.shape) {
		throw new Error('Model not initialized or invalid');
	}

	const totalVectors = model.shape[0];
	const vectorSize = model.shape[1];

	const targetVector = getVector(index);

	const scores = [];

	for (let i = 0; i < totalVectors; i++) {
		if (i === index) continue; // skip self
		const compareVector = getVector(i);
		const similarity = cosineSimilarity(targetVector, compareVector);
		scores.push({ index: i, similarity });
	}

	scores.sort((a, b) => b.similarity - a.similarity);

	return scores.slice(0, n);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === 'getSimilarRepos') {
        (async () => {
			console.log('Received message to get similar repos:', message);

			await ready;

			const repoId = Number(message.repoId);
			const index = repoIds.getValue(repoId);
			console.log('Received request for similar repos for repoId:', repoId, 'Index:', index);
			
			if (index == null) {
				sendResponse({ found: false });
				return;
			}

			let vector = getVector(index);
			console.log('Vector for repoId', repoId, 'at index', index, ':', vector);

			let similarIndexes = getClosestNIndexes(index, 5);
			console.log('Similar indexes for repoId', repoId, ':', similarIndexes);


			sendResponse({
				found: index != null,
				index,
				// include more data as needed
			});
		})();

		// Tell Chrome this is a synchronous response
		return true;
	}
});
