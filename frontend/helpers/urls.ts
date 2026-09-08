import { parseChartStyle } from "@shared/packages/chart-style"
import type { ChartMode, ChartStyle, LegendPosition } from "@shared/types/chart"

export interface ChartUrlState {
    repos: string[]
    chartMode: ChartMode
    chartStyle: ChartStyle
    useLogScale: boolean
    legendPosition: LegendPosition
}

const validLegendPositions: LegendPosition[] = ["top-left", "bottom-right"]

const decode = (value: string) => {
    try {
        return decodeURIComponent(value)
    } catch {
        return value
    }
}

const parseValues = (values: string[]): ChartUrlState => {
    const repos: string[] = []
    let chartMode: ChartMode = "Date"
    let chartStyle: ChartStyle = "xkcd"
    let useLogScale = false
    let legendPosition: LegendPosition = "top-left"

    for (const rawValue of values) {
        const value = decode(rawValue)
        if (!value) continue

        const [key, ...rest] = value.split("=")
        const optionValue = rest.join("=")
        if (key === "type") {
            if (optionValue.toLowerCase() === "date") chartMode = "Date"
            if (optionValue.toLowerCase() === "timeline") chartMode = "Timeline"
        } else if (value === "date" || value === "Date") {
            chartMode = "Date"
        } else if (value === "timeline" || value === "Timeline") {
            chartMode = "Timeline"
        } else if (key === "style") {
            chartStyle = parseChartStyle(optionValue)
        } else if (value === "logscale" || value === "LogScale") {
            useLogScale = true
        } else if (key === "legend" && validLegendPositions.includes(optionValue as LegendPosition)) {
            legendPosition = optionValue as LegendPosition
        } else if (key !== "compare") {
            repos.push(value)
        }
    }

    return { repos, chartMode, chartStyle, useLogScale, legendPosition }
}

const decodeRepoPath = (pathname: string): string | null => {
    const segments = pathname.split("/").filter(Boolean)
    if (segments.length !== 2 || segments[0].startsWith("_")) return null
    return `${decode(segments[0])}/${decode(segments[1])}`
}

export function isChartRoute(url: URL): boolean {
    return url.pathname === "/" || decodeRepoPath(url.pathname) !== null
}

export function parseChartUrl(url: URL): ChartUrlState {
    const repo = decodeRepoPath(url.pathname)
    if (repo) {
        const values = [repo, ...url.searchParams.getAll("compare")]
        const type = url.searchParams.get("type")
        const style = url.searchParams.get("style")
        const legend = url.searchParams.get("legend")
        if (type) values.push(`type=${type}`)
        if (style) values.push(`style=${style}`)
        if (url.searchParams.has("logscale") && url.searchParams.get("logscale")?.toLowerCase() !== "false") {
            values.push("logscale")
        }
        if (legend) values.push(`legend=${legend}`)
        return parseValues(values)
    }

    return parseValues(url.hash.replace(/^#/, "").split("&"))
}

const encodeQueryValue = (value: string) => encodeURIComponent(value).replace(/%2F/g, "/")

export function buildChartHref(state: Pick<ChartUrlState, "repos" | "chartMode" | "chartStyle" | "useLogScale" | "legendPosition">): string {
    if (state.repos.length === 0) return "/"

    const [owner, repo] = state.repos[0].split("/")
    if (!owner || !repo) return "/"

    const path = `/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
    const query = state.repos.slice(1).map((comparison) => `compare=${encodeQueryValue(comparison)}`)
    if (state.chartMode === "Timeline") query.push("type=timeline")
    if (state.useLogScale) query.push("logscale")
    if (state.legendPosition === "bottom-right") query.push("legend=bottom-right")
    if (state.chartStyle === "github") query.push("style=github")
    return query.length > 0 ? `${path}?${query.join("&")}` : path
}

export function buildRepoHref(repo: string): string {
    return buildChartHref({
        repos: [repo],
        chartMode: "Date",
        chartStyle: "xkcd",
        useLogScale: false,
        legendPosition: "top-left",
    })
}
