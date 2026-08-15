export type ChartMode = "Date" | "Timeline"

export type LegendPosition = "top-left" | "bottom-right"

export interface StarRecord {
    date: string
    count: number
}

export interface RepoStarData {
    repo: string
    starRecords: StarRecord[]
}

export interface RepoData extends RepoStarData {
    logoUrl: string
    meta?: RepoMeta
}

// Repo metadata + radar attributes served from repos.sqlite for the stats card.
// `attributes` are normalized 0-99 (higher = better) for radar rendering; a value
// of -1 means the axis has no data and should be omitted from the radar.
export interface RepoMeta {
    owner: string
    stars_total: number
    description: string | null
    language: string | null
    license: string | null
    homepage: string | null
    forks_count: number
    open_issues_count: number
    created_at: string | null
    archived: boolean
    size: number
    topics: string[]
    rank: number
    total_repos: number
    attributes: RepoRadarAttributes
    raw: RepoRadarAttributes
    // Accurate "top N %" (0-100) per axis, derived from axis_percentiles.
    // A key is absent when the repo's value isn't covered by the table.
    percentiles: Partial<Record<keyof RepoRadarAttributes, number>>
}

export interface RepoRadarAttributes {
    stars: number
    new_stars: number
    forks: number
    open_issues: number
    size: number
    pushes: number
}
