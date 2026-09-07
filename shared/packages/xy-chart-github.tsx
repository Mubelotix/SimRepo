import { scaleLinear, scaleTime, scaleSymlog } from "d3-scale"
import { select } from "d3-selection"
import { line, curveLinear } from "d3-shape"
import { axisBottom, axisLeft, AxisScale } from "d3-axis"
import dayjs from "dayjs"
import { monaSansVFFontUrl } from "./utils/monaFontData"
import getFormatTimeline, { getTimestampFormatUnit } from "./utils/getFormatTimeline"
import { drawWatermark } from "./utils/drawWatermark"
import type { XYChartData } from "./xy-chart"

interface XYPoint {
    x: Date | number
    y: number
}

/**
 * GitHub-styled star history chart — a standalone renderer, intentionally kept
 * separate from the xkcd/sketch xy-chart. Visual spec:
 *   - Font: Mona Sans VF
 *   - Smooth solid lines in rgb(9, 105, 218)
 *   - Title wrapped in a 1px rgb(209, 217, 224) box with 6px radius
 *   - Legend text in rgb(89, 99, 110)
 */

const LINE_COLOR = "rgb(9, 105, 218)"
const SERIES_COLORS = [
    LINE_COLOR,
    "rgb(207, 34, 46)",
    "rgb(26, 127, 55)",
    "rgb(130, 80, 223)",
    "rgb(191, 135, 0)",
    "rgb(5, 80, 174)",
]
const TITLE_BORDER_COLOR = "rgb(209, 217, 224)"
const LEGEND_TEXT_COLOR = "rgb(89, 99, 110)"
const FONT_FAMILY = "Mona Sans VF"

const seriesColor = (index: number) => SERIES_COLORS[index % SERIES_COLORS.length]

type XTickLabelType = "Date" | "Number"

export interface XYChartGithubConfig {
    title: string
    xLabel: string
    yLabel: string
    data: XYChartData
    showDots: boolean
    transparent: boolean
    theme?: "light" | "dark"
}

export interface XYChartGithubOptions {
    envType: "browser" | "node"
    xTickLabelType: XTickLabelType
    dateFormat?: string

    xTickCount: number
    yTickCount: number
    showLine: boolean
    dotSize: number
    backgroundColor: string
    strokeColor: string
    legendPosition: "top-left" | "bottom-right"
    chartWidth?: number
    useLogScale?: boolean
}

const getDefaultOptions = (transparent: boolean) => ({
    envType: "node" as const,
    xTickLabelType: "Date" as XTickLabelType,
    dateFormat: "MMM DD, YYYY",
    xTickCount: 5,
    yTickCount: 5,
    showLine: true,
    dotSize: 0.5,
    backgroundColor: transparent ? "transparent" : "white",
    strokeColor: "#1f2328",
    legendPosition: "top-left" as const
})

const getDarkThemeDefaultOptions = (transparent: boolean) => ({
    ...getDefaultOptions(transparent),
    backgroundColor: transparent ? "transparent" : "#0d1117",
    strokeColor: "white"
})

interface TipPosition {
    x: number
    y: number
    type: "up_left" | "up_right" | "down_left" | "down_right"
}

// Minimal hover tooltip: flat card, thin border, no sketch filter.
class Tooltip {
    private svg: any
    private bg: any
    private titleText: any
    private row: any = null
    private position: TipPosition = { x: 0, y: 0, type: "up_left" }
    private lastText = ""
    private strokeColor: string

    constructor(selection: any, backgroundColor: string, strokeColor: string) {
        this.strokeColor = strokeColor
        this.svg = selection.append("svg").style("visibility", "hidden")
        this.bg = this.svg
            .append("rect")
            .attr("x", 5)
            .attr("y", 5)
            .attr("rx", 6)
            .attr("ry", 6)
            .style("fill", backgroundColor)
            .attr("fill-opacity", 0.95)
            .attr("stroke", strokeColor === "white" ? "#444c56" : TITLE_BORDER_COLOR)
            .attr("stroke-width", 1)
            .attr("width", 10)
            .attr("height", 10)
        this.titleText = this.svg
            .append("text")
            .style("font-size", "14px")
            .style("font-weight", "600")
            .style("fill", strokeColor)
            .attr("x", 15)
            .attr("y", 24)
            .text("")
    }

    update({ title, text, position }: { title: string; text: string; position: TipPosition }) {
        if (this.titleText.text() !== title) {
            this.titleText.text(title)
        }
        if (this.lastText !== text) {
            if (this.row) this.row.remove()
            this.row = this.svg.append("g")
            this.row
                .append("rect")
                .attr("width", 8)
                .attr("height", 8)
                .attr("rx", 2)
                .attr("ry", 2)
                .style("fill", LINE_COLOR)
                .attr("x", 15)
                .attr("y", 36)
            this.row
                .append("text")
                .style("font-size", "14px")
                .style("fill", this.strokeColor)
                .attr("x", 29)
                .attr("y", 44)
                .text(text)
            this.lastText = text

            const titleWidth = this.titleText.node().getBBox ? this.titleText.node().getBBox().width : title.length * 8
            const width = Math.max(titleWidth, text.length * 7.5) + 25
            this.bg.attr("width", width).attr("height", 58)
        }
        this.position = position
        const bgWidth = Number(this.bg.attr("width"))
        const bgHeight = Number(this.bg.attr("height"))
        let x = position.x + 5
        let y = position.y + 5
        if (position.type.startsWith("up")) {
            y = position.y - bgHeight - 20
        }
        if (position.type.endsWith("left")) {
            x = position.x - bgWidth - 15
        }
        this.svg.attr("x", x).attr("y", y)
    }

    show() {
        this.svg.style("visibility", "visible")
    }

    hide() {
        this.svg.style("visibility", "hidden")
    }
}

const XYChartGithub = (
    svg: SVGSVGElement,
    { title, xLabel, yLabel, data: { datasets }, showDots, theme, transparent }: XYChartGithubConfig,
    initialOptions: Partial<XYChartGithubOptions>
) => {
    const options: XYChartGithubOptions = {
        ...(theme === "dark" ? getDarkThemeDefaultOptions(transparent) : getDefaultOptions(transparent)),
        ...initialOptions
    }
    const margin = {
        top: 20,
        right: 30,
        bottom: 50,
        left: 50
    }

    const clientWidth = Number(svg.clientWidth || svg.getAttribute("width") || "") || 600
    const clientHeight = (clientWidth * 2) / 3

    const d3Selection = select(svg)
        .style("stroke-width", 1)
        .style("font-family", FONT_FAMILY)
        .style("background", options.backgroundColor)
        .attr("width", clientWidth)
        .attr("height", clientHeight)
        .attr("preserveAspectRatio", "xMidYMid meet") as any

    if (options.envType === "browser") {
        d3Selection
            .attr("width", clientWidth <= 600 ? 600 : "100%")
            .attr("viewBox", `0 0 ${clientWidth <= 600 ? 600 : clientWidth} ${clientHeight}`)
    }
    d3Selection.selectAll("*").remove()

    // Embed the font inline so the SVG stays self-contained when served as an
    // <img> src (README embeds) or serialized for PNG export.
    d3Selection
        .append("defs")
        .append("style")
        .attr("type", "text/css")
        .text(`@font-face { font-family: "${FONT_FAMILY}"; src: url(${monaSansVFFontUrl}) format("woff2"); }`)

    const chart = d3Selection.append("g").attr("transform", `translate(${margin.left},${margin.top})`)

    const tooltip = new Tooltip(d3Selection, options.backgroundColor, options.strokeColor)

    if (options.xTickLabelType === "Date") {
        datasets.forEach((dataset) => {
            dataset.data.forEach((d: XYPoint) => {
                d.x = dayjs(d.x) as any
            })
        })
    }

    const allData: XYPoint[] = []
    datasets.forEach((d) => allData.push(...d.data))

    const allXData = allData.map((d) => d.x)
    const allYData = allData.map((d) => d.y)

    const chartWidth = clientWidth - margin.left - margin.right
    const chartHeight = clientHeight - margin.top - margin.bottom

    let xScale: AxisScale<number | Date> = scaleTime()
        .domain([
            Math.min(...allXData.map((d) => Number(d))),
            Math.max(...allXData.map((d) => Number(d)))
        ])
        .range([0, chartWidth])

    if (options.xTickLabelType === "Number") {
        xScale = scaleLinear()
            .domain([0, Math.max(...allXData.map((d) => Number(d)))])
            .range([0, chartWidth])
    }

    let yScale: AxisScale<number>
    if (options.useLogScale) {
        yScale = scaleSymlog()
            .domain([0, Math.max(...allYData)])
            .range([chartHeight, 0])
            .constant(10)
    } else {
        yScale = scaleLinear()
            .domain([0, Math.max(...allYData)])
            .range([chartHeight, 0])
    }

    // Axes — clean 1px lines and ticks, no distortion filter.
    const formatXTick = (d: any) => {
        if (options.xTickLabelType === "Date") {
            return dayjs(d).format("MMM DD, YYYY")
        }
        // Timeline mode: x values are raw timestamps — render them as
        // human-readable durations ("30 days", "12 months") like the sketch chart.
        const timestamp = Number(d)
        if (timestamp === 0) {
            return " "
        }
        return getFormatTimeline(timestamp, getTimestampFormatUnit(timestamp))
    }

    chart
        .append("g")
        .attr("class", "gh-xaxis")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(axisBottom(xScale as any).ticks(options.xTickCount).tickFormat(formatXTick as any).tickSize(6))
        .call((g: any) => {
            g.select(".domain").attr("stroke", options.strokeColor).attr("stroke-width", 2).attr("stroke-opacity", 0.5)
            g.selectAll(".tick > line").attr("stroke", options.strokeColor).attr("stroke-width", 2).attr("stroke-opacity", 0.4)
            g.selectAll(".tick > text")
                .style("font-family", FONT_FAMILY)
                .style("font-size", "13px")
                .style("fill", options.strokeColor)
        })

    chart
        .append("g")
        .attr("class", "gh-yaxis")
        .call(axisLeft(yScale as any).ticks(options.yTickCount).tickSize(6))
        .call((g: any) => {
            g.select(".domain").attr("stroke", options.strokeColor).attr("stroke-width", 2).attr("stroke-opacity", 0.5)
            g.selectAll(".tick > line").attr("stroke", options.strokeColor).attr("stroke-width", 2).attr("stroke-opacity", 0.4)
            g.selectAll(".tick > text")
                .style("font-family", FONT_FAMILY)
                .style("font-size", "13px")
                .style("fill", options.strokeColor)
        })

    const svgChart = chart.append("g").attr("pointer-events", "all")

    // Straight solid lines.
    if (options.showLine !== false) {
        const drawLine = line<XYPoint>()
            .x((d) => xScale(d.x) || 0)
            .y((d) => yScale(d.y) || 0)
            .curve(curveLinear)

        svgChart
            .selectAll(".gh-chart-xyline")
            .data(datasets)
            .enter()
            .append("path")
            .attr("class", "gh-chart-xyline")
            .attr("d", (d: any) => drawLine(d.data))
            .attr("fill", "none")
            .attr("stroke", (_: any, i: number) => seriesColor(i))
            .attr("stroke-width", 3)
    }

    // Dots + tooltip. Dots are invisible until hovered, and are never drawn
    // server-side (/svg output must stay clean).
    if (showDots && options.envType !== "node") {
        const scale = options.dotSize === undefined ? 1 : options.dotSize

        const dotGroups = svgChart
            .selectAll(".gh-chart-xycircle-group")
            .data(datasets)
            .enter()
            .append("g")
            .attr("class", "gh-chart-xycircle-group")
            .attr("gh-group-index", (_: any, i: number) => i)
            .attr("gh-series-color", (_: any, i: number) => seriesColor(i))
            .selectAll(".chart-tooltip-dot")
            .data((dataset: any) => dataset.data)
            .enter()
            .append("g")
            .attr("class", "chart-tooltip-dot")
            .attr("gh-group-index", function (this: any) {
                return select(this.parentElement).attr("gh-group-index")
            })
            .attr("gh-point-index", (_: any, i: number) => i)
            .attr("transform", (d: XYPoint) => `translate(${xScale(d.x) || 0},${yScale(d.y) || 0})`)
            // Large blue halo…
            .each(function (this: any) {
                const g = select(this)
                const color = select(this.parentElement).attr("gh-series-color")
                g.append("circle")
                    .attr("class", "gh-dot-halo")
                    .attr("r", 9 * scale)
                    .style("fill", color)
                    .style("fill-opacity", 0)
                // …with a little white-bordered blue dot inside.
                g.append("circle")
                    .attr("class", "gh-dot-core")
                    .attr("r", 3.5 * scale)
                    .style("fill", color)
                    .style("stroke", "#fff")
                    .style("stroke-width", 2)
                    .style("opacity", 0)
                // Invisible hit target for the tooltip.
                g.append("circle")
                    .attr("class", "gh-dot-hit")
                    .attr("r", Math.max(10 * scale, 9 * scale))
                    .style("fill", "transparent")
                    .attr("pointer-events", "all")
            })
        dotGroups
            .on("mouseover", (event: any, d: XYPoint) => {
                if (typeof window === "undefined") return

                const tipX = (xScale(d.x) || 0) + margin.left + 5
                const tipY = (yScale(d.y) || 0) + margin.top + 5
                let positionType: TipPosition["type"]
                if (tipX > chartWidth / 2 && tipY < chartHeight / 2) {
                    positionType = "down_left"
                } else if (tipX > chartWidth / 2 && tipY > chartHeight / 2) {
                    positionType = "up_left"
                } else if (tipX < chartWidth / 2 && tipY > chartHeight / 2) {
                    positionType = "up_right"
                } else {
                    positionType = "down_right"
                }

                const dotGroup = select(event.currentTarget)
                const groupIndex = Number(dotGroup.attr("gh-group-index"))
                const pointIndex = Number(dotGroup.attr("gh-point-index"))

                let tipTitle = dayjs(datasets[groupIndex]?.data[pointIndex]?.x ?? d.x).format(options.dateFormat)
                if (options.xTickLabelType === "Number") {
                    const type = getTimestampFormatUnit(Number(d.x))
                    tipTitle = getFormatTimeline(Number(d.x), type)
                }

                tooltip.update({
                    title: tipTitle,
                    text: `${datasets[groupIndex]?.label || ""}: ${d.y}`,
                    position: { x: tipX, y: tipY, type: positionType }
                })
                tooltip.show()
            })
            .on("mouseout", () => {
                tooltip.hide()
            })

        // Reveal every point as soon as any part of the chart is hovered, and
        // hide them all again once the pointer leaves the chart.
        const setDotsVisible = (visible: boolean) => {
            dotGroups
                .selectAll(".gh-dot-halo")
                .style("fill-opacity", visible ? 1 : 0)
            dotGroups
                .selectAll(".gh-dot-core")
                .style("opacity", visible ? 1 : 0)
        }
        d3Selection
            .on("mouseenter", () => setDotsVisible(true))
            .on("mouseleave", () => {
                setDotsVisible(false)
                tooltip.hide()
            })
    }

    // Legend — gray label text on the theme background.
    const legendItems = datasets.map((dataset, i) => ({
        text: dataset.label,
        logo: dataset.logo,
        color: seriesColor(i)
    }))
    if (legendItems.length > 0) {
        const legendXPadding = 8
        const legendYPadding = 6
        const charHeight = 22
        const colorBlockWidth = 10
        const logoSize = 14
        const shouldDrawLogo = new Set(legendItems.map((i) => i.text.split("/")[0])).size > 1

        // Measure the widest label when possible (jsdom has no layout, so we
        // fall back to a rough per-character estimate).
        let maxLabelWidth = 0
        const probe = svgChart.append("text").style("font-size", "14px").style("fill", "none")
        legendItems.forEach((item) => {
            probe.text(item.text)
            const width = probe.node()?.getComputedTextLength
                ? (probe.node().getComputedTextLength() as number)
                : item.text.length * 7.5
            maxLabelWidth = Math.max(width, maxLabelWidth)
        })
        probe.remove()
        const backgroundWidth = Math.ceil(maxLabelWidth) + colorBlockWidth + legendXPadding * 3 + 6 + (shouldDrawLogo ? legendXPadding + logoSize : 0)
        const backgroundHeight = legendItems.length * charHeight + legendYPadding * 2

        let legendX = 8
        let legendY = 5
        if (options.legendPosition === "bottom-right") {
            legendX = chartWidth - backgroundWidth - 8
            legendY = chartHeight - backgroundHeight - 12
        }

        const legend = svgChart.append("svg")
        const backgroundLayer = legend.append("svg")

        backgroundLayer
            .append("rect")
            .style("fill", options.backgroundColor)
            .attr("fill-opacity", 0.85)
            .attr("stroke", TITLE_BORDER_COLOR)
            .attr("stroke-width", 1)
            .attr("rx", 6)
            .attr("ry", 6)
            .attr("width", backgroundWidth)
            .attr("height", backgroundHeight)
            .attr("x", legendX)
            .attr("y", legendY)

        legendItems.forEach((item, i) => {
            legend
                .append("rect")
                .style("fill", item.color)
                .attr("width", colorBlockWidth)
                .attr("height", colorBlockWidth)
                .attr("rx", 2)
                .attr("ry", 2)
                .attr("x", legendX + legendXPadding)
                .attr("y", legendY + 13 + charHeight * i)
            if (shouldDrawLogo) {
                legend
                    .append("defs")
                    .append("clipPath")
                    .attr("id", `gh-clip-legend-${i}`)
                    .append("circle")
                    .attr("r", logoSize / 2)
                    .attr("cx", legendX + legendXPadding + colorBlockWidth + legendXPadding + logoSize / 2)
                    .attr("cy", legendY + 13 + charHeight * i - 3 + logoSize / 2)
                legend
                    .append("image")
                    .attr("x", legendX + legendXPadding + colorBlockWidth + legendXPadding)
                    .attr("y", legendY + 13 + charHeight * i - 3)
                    .attr("height", logoSize)
                    .attr("width", logoSize)
                    .attr("href", item.logo)
                    .attr("clip-path", `url(#gh-clip-legend-${i})`)
            }
            legend
                .append("text")
                .style("font-size", "14px")
                .style("fill", LEGEND_TEXT_COLOR)
                .attr("x", legendX + legendXPadding + colorBlockWidth + (shouldDrawLogo ? legendXPadding + logoSize : 0) + 6)
                // Vertically centered against the color block: baseline sits
                // ~0.35em below the block's middle.
                .attr("y", legendY + 13 + charHeight * i + colorBlockWidth / 2 + 5)
                .text(item.text)
        })
    }

    // Watermark — project branding pinned to the bottom-right corner. Trimmed
    // slightly so the logo stays inside the SVG bounds.
    const watermarkSelection = d3Selection.append("g").attr(
        "transform",
        `translate(${margin.left},${margin.top})`
    )
    drawWatermark(watermarkSelection, chartWidth, chartHeight)
}

export default XYChartGithub
