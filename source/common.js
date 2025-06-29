export function getSimilarRepos(repoIds, offset = 0, limit = 10) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'getSimilarRepos', repoIds, offset, limit }, (response) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            resolve(response);
        });
    });
}

export function formatNumber(num) {
    if (num >= 1e9) {
        return parseFloat((num / 1e9).toFixed(1)) + 'G';
    } else if (num >= 1e6) {
        return parseFloat((num / 1e6).toFixed(1)) + 'M';
    } else if (num >= 1e3) {
        return parseFloat((num / 1e3).toFixed(1)) + 'k';
    }
    return num.toString();
}

export function loadingSpinner(customClass = "", customStyle = "") {
	return `<svg style="box-sizing: content-box; color: var(--color-icon-primary); ${customStyle}" width="32" viewBox="0 0 16 16" fill="none" aria-hidden="true" class="${customClass} flex-1 anim-rotate" height="32"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke" fill="none"></circle><path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"></path></svg>`;
}
