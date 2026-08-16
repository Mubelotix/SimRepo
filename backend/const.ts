export const CHART_SIZES = ["mobile", "laptop", "desktop"];

// Maximum number of repos allowed per /svg request.
export const MAX_REPOS_PER_REQUEST = 20;

// Page size for /similar-repos pagination: every page returns at most this many
// similar-repo recommendations. Untrusted website requests are limited to the
// first page (the default); extension requests may paginate through all results.
export const MAX_SIMILAR_REPOS = 3;
