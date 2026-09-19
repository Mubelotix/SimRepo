export const CHART_SIZES = ["mobile", "laptop", "desktop"];

// Maximum number of repos allowed per /svg request.
export const MAX_REPOS_PER_REQUEST = 20;

// Page size for /similar-repos pagination: every page returns at most this many
// similar-repo recommendations. Untrusted website requests are limited to the
// first page (the default); extension requests may paginate through all results.
export const MAX_SIMILAR_REPOS = 3;

// Batch recommendation sizes. The backend chooses the size from the caller's
// access level; clients do not provide a requested result count.
export const MAX_BATCH_SIMILAR_REPOS = 20;
export const MAX_BATCH_SIMILAR_REPOS_UNAUTHENTICATED = 3;
export const DEFAULT_BATCH_RANK_PROBABILITY = 0.5;

// The extension currently loads at most this many starred repositories as batch
// recommendation seeds. Keeping the same bound also prevents oversized public
// requests from causing unbounded database work.
export const MAX_BATCH_REPO_IDS = 120;
