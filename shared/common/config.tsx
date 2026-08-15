// Base URL of the backend API that serves repo data sourced from repos.sqlite.
// Defaults to same-origin (""): the backend serves both the frontend and the
// /repo-data API from one container on a single domain. Override in local dev via
// NEXT_PUBLIC_REPO_DATA_API_URL (Next.js inlines it at build time for the frontend),
// or REPO_DATA_API_URL (backend reads at runtime).
const DEFAULT_REPO_DATA_API_URL = "";

function resolveRepoDataApiUrl(): string {
  if (typeof process !== "undefined" && process.env) {
    const override =
      process.env.REPO_DATA_API_URL || process.env.NEXT_PUBLIC_REPO_DATA_API_URL;
    if (override) return override;
  }
  return DEFAULT_REPO_DATA_API_URL;
}

export const REPO_DATA_API_URL: string = resolveRepoDataApiUrl();
