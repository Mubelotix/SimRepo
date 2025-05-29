import OptionsSync from 'webext-options-sync';
import npyjs from 'npyjs';

const optionsStorage = new OptionsSync({
	defaults: {
		colorRed: 244,
		colorGreen: 67,
		colorBlue: 54,
		text: 'Set a text!',
	},
	migrations: [
		OptionsSync.migrations.removeUnused,
	],
	logging: true,
});

// Create a function to load the model and attach it to optionsStorage
async function loadModelAndAttach() {
	const modelUrl = chrome.runtime.getURL('embeddings.npy');
	const n = new npyjs();
	const model = await n.load(modelUrl);

	if (!model || !model.data || !model.shape) {
		throw new Error('Failed to load model data');
	}

	console.log('Model loaded:', model);

	optionsStorage.model = model;

	return model;
}

// Export a promise that resolves after model is loaded and attached
const modelReady = loadModelAndAttach();

export { optionsStorage, modelReady };
