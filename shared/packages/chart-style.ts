import type { ChartStyle } from "../types/chart"

// Unknown values fall back to the default xkcd style.
export const parseChartStyle = (value: string | undefined | null): ChartStyle =>
    value === "github" ? "github" : "xkcd"
