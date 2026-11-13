import assert from "node:assert/strict"
import test from "node:test"
import { buildChartHref, parseChartUrl, type ChartUrlState } from "./urls"

const state: ChartUrlState = {
    repos: ["123", "456"],
    chartMode: "Timeline",
    chartStyle: "github",
    useLogScale: true,
    legendPosition: "bottom-right",
}

test("ID chart links preserve repositories and chart options", () => {
    const href = buildChartHref(state)
    assert.equal(href, "/?repos=123,456&type=timeline&logscale&legend=bottom-right&style=github")
    assert.deepEqual(parseChartUrl(new URL(href, "https://example.com")), state)
})

test("name-based paths and legacy hash links remain supported", () => {
    const namedState = { ...state, repos: ["owner/repo", "other/project"] }
    assert.deepEqual(parseChartUrl(new URL(buildChartHref(namedState), "https://example.com")), namedState)
    assert.deepEqual(parseChartUrl(new URL("https://example.com/#owner/repo&other/project&timeline&logscale&legend=bottom-right&style=github")), namedState)
})

test("mixed names and IDs round trip", () => {
    const mixedState = { ...state, repos: ["owner/repo", "456"] }
    assert.deepEqual(parseChartUrl(new URL(buildChartHref(mixedState), "https://example.com")), mixedState)
})
