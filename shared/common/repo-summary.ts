import type { StarRecord } from "../types/chart";

export interface RepoSummary {
    repo: string;
    description: string;
}

export interface RepoSummaryFacts {
    name: string;
    language: string | null;
    stars_total: number | null;
    forks_count: number | null;
    rank: number | null;
    total_repos: number | null;
}

export function buildRepoSummary(
    facts: RepoSummaryFacts,
    history: StarRecord[],
    similarRepo?: string,
): RepoSummary {
    const number = (value: number) => value.toLocaleString("en-US");
    const validCount = (value: number | null): value is number =>
        typeof value === "number" && Number.isFinite(value) && value >= 0;
    let description = `${facts.name} is ${facts.language ? `a ${facts.language} project` : "a GitHub project"}`;
    const counts: string[] = [];
    if (validCount(facts.stars_total)) counts.push(`${number(facts.stars_total)} stars`);
    if (validCount(facts.forks_count)) counts.push(`${number(facts.forks_count)} forks`);
    if (counts.length) description += ` with ${counts.join(" and ")}`;
    if (validCount(facts.rank) && facts.rank > 0 && validCount(facts.total_repos) && facts.total_repos >= facts.rank) {
        // This is the dataset's overall ranking, not the separate stars percentile.
        const top = Math.max(0.1, Math.ceil(1000 * facts.rank / facts.total_repos) / 10);
        description += `, ranking #${number(facts.rank)} among the ${number(facts.total_repos)} repositories in our dataset (top ${top}%)`;
    }
    description += ".";

    const latest = history.at(-1);
    if (latest) {
        const cutoff = Date.parse(latest.date) - 30 * 86400000;
        let baseline: number | undefined;
        let estimated = false;
        for (let i = 0; i < history.length; i++) {
            const point = history[i];
            const time = Date.parse(point.date);
            if (time === cutoff) {
                baseline = point.count;
                break;
            }
            if (time > cutoff) {
                const before = history[i - 1];
                if (before) {
                    const beforeTime = Date.parse(before.date);
                    baseline = before.count + (point.count - before.count) * (cutoff - beforeTime) / (time - beforeTime);
                    estimated = before.count !== point.count;
                }
                break;
            }
        }
        if (baseline !== undefined) {
            const change = latest.count - baseline;
            if (change === 0) {
                description += ` Its star count ${estimated ? "was approximately unchanged" : "remained unchanged"} over the last 30 days`;
            } else if (baseline > 0) {
                const percent = Math.abs(change) / baseline * 100;
                const growth = percent < 0.1 ? "less than 0.1%" : `${Number(percent.toFixed(1))}%`;
                const qualifier = estimated && percent >= 0.1 ? "approximately " : "";
                description += ` It ${change > 0 ? "grew" : "shrank"} by ${qualifier}${growth} over the last 30 days`;
            } else {
                description += ` Its star count rose from 0 to ${number(latest.count)} over the last 30 days`;
            }
            description += ` (as of ${latest.date}).`;
        }
    }
    description += ` Explore its star history chart${similarRepo ? ` and discover similar projects such as ${similarRepo}` : " and discover similar projects"}.`;
    return { repo: facts.name, description };
}
