import { optionsStorage } from './options-storage.js';

export const TELEMETRY_WEBSITE_ID = "28a193cd-8e9c-4c5b-857a-59b233853903";
export const TELEMETRY_ENDPOINT = "https://simrepo.dera.page/u/api/sync";

export async function reportRepoVisit() {
    const options = await optionsStorage.getAll();
    if (!options.telemetryEnabled) {
        return;
    }

    chrome.runtime.sendMessage(
        {
            type: 'report',
            payload: {
                website: TELEMETRY_WEBSITE_ID,
                hostname: window.location.hostname,
                url: window.location.href,
                title: document.title,
            },
        },
        () => void chrome.runtime.lastError,
    );
}
