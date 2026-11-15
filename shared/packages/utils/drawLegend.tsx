import { D3Selection, LegendPosition } from "../types"
import { measureXkcdText } from "./measureXkcdText"

interface DrawLegendConfig {
    items: {
        color: string
        text: string
        logo: string
    }[]
    strokeColor: string
    backgroundColor: string
    legendPosition: LegendPosition
    chartWidth: number
    chartHeight: number
}

const drawLegend = (selection: D3Selection, { items, strokeColor, backgroundColor, legendPosition, chartWidth, chartHeight }: DrawLegendConfig) => {
    const legendXPadding = 7
    const legendYPadding = 6
    const fontSize = 15
    const xkcdCharHeight = 20
    const colorBlockWidth = 8
    const logoSize = 14

    const legend = selection.append("svg")
    const backgroundLayer = legend.append("svg")
    const textLayer = legend.append("svg")
    // If repos have more than one unique owner, draw logo before legend.
    const shouldDrawLogo = new Set(items.map((i) => i.text.split("/")[0])).size > 1

    const maxTextWidth = Math.max(0, ...items.map((item) => measureXkcdText(item.text, fontSize)))
    const backgroundWidth = Math.ceil(maxTextWidth) + colorBlockWidth + legendXPadding * 2 + 6 + (shouldDrawLogo ? legendXPadding + logoSize : 0)
    const backgroundHeight = items.length * xkcdCharHeight + legendYPadding * 2

    // Calculate position based on legendPosition
    let legendX = 8
    let legendY = 5

    if (legendPosition === "bottom-right") {
        legendX = chartWidth - backgroundWidth - 8
        legendY = chartHeight - backgroundHeight - 15
    }

    items.forEach((item, i) => {
        // draw color dot
        textLayer
            .append("rect")
            .style("fill", item.color)
            .attr("width", colorBlockWidth)
            .attr("height", colorBlockWidth)
            .attr("rx", 2)
            .attr("ry", 2)
            .attr("filter", "url(#xkcdify)")
            .attr("x", legendX + legendXPadding)
            .attr("y", legendY + 12 + xkcdCharHeight * i)
        if (shouldDrawLogo) {
            textLayer
                .append("defs")
                .append("clipPath")
                .attr("id", `clip-circle-title-${item.text}`)
                .append("circle")
                .attr("r", logoSize / 2)
                .attr("cx", legendX + legendXPadding + colorBlockWidth + legendXPadding + logoSize / 2)
                .attr("cy", legendY + 12 + xkcdCharHeight * i - 4 + logoSize / 2)
            textLayer
                .append("image")
                .attr("x", legendX + legendXPadding + colorBlockWidth + legendXPadding)
                .attr("y", legendY + 12 + xkcdCharHeight * i - 4)
                .attr("height", logoSize)
                .attr("width", logoSize)
                .attr("href", item.logo)
                .attr("clip-path", `url(#clip-circle-title-${item.text})`)
        }
        // draw text
        textLayer
            .append("text")
            .style("font-size", `${fontSize}px`)
            .style("fill", strokeColor)
            // Keep SVG image rendering consistent with the font metrics used
            // for layout, even when the browser rounds individual advances.
            .attr("textLength", measureXkcdText(item.text, fontSize))
            .attr("lengthAdjust", "spacingAndGlyphs")
            .attr("x", legendX + legendXPadding + colorBlockWidth + (shouldDrawLogo ? legendXPadding + logoSize : 0) + 6)
            .attr("y", legendY + 12 + xkcdCharHeight * i + 8)
            .text(item.text)
    })

    // add background
    backgroundLayer
        .append("rect")
        .style("fill", backgroundColor)
        .attr("fill-opacity", 0.85)
        .attr("stroke", strokeColor)
        .attr("stroke-width", 2)
        .attr("rx", 5)
        .attr("ry", 5)
        .attr("filter", "url(#xkcdify)")
        .attr("width", backgroundWidth)
        .attr("height", backgroundHeight)
        .attr("x", legendX)
        .attr("y", legendY)
}

export default drawLegend
