import type { RepoSummary } from "@shared/common/repo-summary"
import { SITE_URL } from "./consts"

export function getRepoMetadata(initialSummary: RepoSummary | undefined, repos: string[], urlInitialized: boolean) {
    // The store starts empty during SSR/hydration; retain the injected metadata
    // until it has read the URL. Afterwards, store changes are authoritative.
    const selectedRepo = urlInitialized
        ? (repos.length === 1 ? repos[0] : undefined)
        : initialSummary?.repo
    const summary = selectedRepo?.toLowerCase() === initialSummary?.repo.toLowerCase() ? initialSummary : undefined
    const repo = summary?.repo ?? selectedRepo
    return {
        title: repo ? `${repo} - GitHub Star History` : "GitHub Star History",
        description: summary?.description ?? "GitHub star history graphs, no token required.",
        url: repo && repo.split("/").length === 2
            ? `${SITE_URL}/${repo.split("/").map(encodeURIComponent).join("/")}`
            : SITE_URL,
    }
}
