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
    // Estimated share (0-1) of stars that appear to be fake/purchased, per the
    // spam model. Null when the ingest pipeline hasn't scored the repo yet.
    spam_ratio: number | null
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

// A similar repository recommendation, served from the similar_repos table.
// `score` is the raw similarity score (higher = more similar); `meta` holds the
// lightweight metadata used to display the recommendation in the UI.
export interface SimilarRepo {
    repo: string
    score: number
    meta: {
        owner: string
        description: string | null
        language: string | null
        license: string | null
        homepage: string | null
        stars_total: number
        forks_count: number
        open_issues_count: number
        topics: string[]
        rank: number
        archived: boolean
    }
    logoUrl: string
}
