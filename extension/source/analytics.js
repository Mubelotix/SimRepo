import { optionsStorage } from './options-storage.js';

export const TELEMETRY_WEBSITE_ID = "28a193cd-8e9c-4c5b-857a-59b233853903";
export const TELEMETRY_ENDPOINT = "https://simrepo.dera.page/u/api/send";

async function sendReport(payload) {
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
                ...payload,
            },
        },
        () => void chrome.runtime.lastError,
    );
}

export async function reportEvent(eventName, eventData = {}) {
    await sendReport({
        name: eventName,
        data: eventData,
    });
}

export async function reportRepoVisit() {
    // No `name`, so umami records this as a regular page view, not a custom event.
    await sendReport({});
}
