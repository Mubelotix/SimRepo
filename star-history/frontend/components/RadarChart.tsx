import React, { useMemo, useState } from "react"
import type { RepoRadarAttributes } from "@shared/types/chart"

const LABELS: Record<keyof RepoRadarAttributes, string> = {
    stars: "Stars",
    new_stars: "New Stars",
    forks: "Forks",
    open_issues: "Open Issues",
    size: "Size",
    pushes: "Last Push",
}

// Only render axes we trust. `issues_closed` and `contributors` are excluded
// because the sqlite values are missing or unreliable.
const AXIS_ORDER: (keyof RepoRadarAttributes)[] = [
    "stars",
    "new_stars",
    "forks",
    "open_issues",
    "size",
    "pushes",
]

const SIZE = 400
const MARGIN = 70
const RADIUS = (SIZE - MARGIN * 2) / 2
const CX = SIZE / 2
const CY = SIZE / 2
const DATA_COLOR = "#16a34a"

// Seeded PRNG so the wobble is deterministic across renders.
function createRng(seed: number) {
    let s = seed | 0
    return () => {
        s = (s * 1664525 + 1013904223) | 0
        return (s >>> 0) / 4294967296
    }
}

function sketchyPolygonPath(points: [number, number][], jitter: number, rng: () => number, closed = true): string {
    if (points.length < 2) return ""
    const segments: string[] = []
    const len = closed ? points.length : points.length - 1

    for (let i = 0; i < len; i++) {
        const [x0, y0] = points[i]
        const [x1, y1] = points[(i + 1) % points.length]
        const dx = x1 - x0
        const dy = y1 - y0
        const dist = Math.sqrt(dx * dx + dy * dy)
        const nx = -dy / (dist || 1)
        const ny = dx / (dist || 1)
        const steps = Math.max(Math.round(dist / 8), 3)

        for (let s = 0; s <= steps; s++) {
            const t = s / steps
            const px = x0 + dx * t
            const py = y0 + dy * t
            const wobbleScale = Math.sin(t * Math.PI)
            const offset = (rng() - 0.5) * 2 * jitter * wobbleScale
            const fx = px + nx * offset
            const fy = py + ny * offset

            if (i === 0 && s === 0) {
                segments.push(`M ${fx.toFixed(1)},${fy.toFixed(1)}`)
            } else {
                segments.push(`L ${fx.toFixed(1)},${fy.toFixed(1)}`)
            }
        }
    }

    if (closed) segments.push("Z")
    return segments.join(" ")
}

interface RadarChartProps {
    attributes: RepoRadarAttributes
    rawText?: Partial<Record<keyof RepoRadarAttributes, string>>
    percentiles?: Partial<Record<keyof RepoRadarAttributes, number>>
}

export default function RadarChart({ attributes, rawText, percentiles }: RadarChartProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

    const validAxes = useMemo(
        () => AXIS_ORDER.filter((key) => (attributes[key] ?? -1) >= 0),
        [attributes]
    )

    const numAxes = validAxes.length
    const angleSlice = (Math.PI * 2) / numAxes
    // Fresh seed each render so the wobble is deterministic (same on every
    // hover/re-render) instead of continuing from the previous frame's stream.
    const rng = createRng(42)

    const scaleR = (value: number) => (value / 99) * RADIUS

    // Place each data point by its percentile ranking (higher = better = farther
    // out), so a top-1% repo sits near the outer ring. Falls back to the log-
    // normalized attribute value when no accurate percentile is available.
    const placementFor = (key: keyof RepoRadarAttributes): number => {
        const p = percentiles?.[key]
        if (p !== undefined) return Math.max(0, Math.min(99, 100 - p))
        return attributes[key]
    }

    const pointAt = (axisIndex: number, radius: number): [number, number] => {
        const angle = angleSlice * axisIndex - Math.PI / 2
        return [CX + Math.cos(angle) * radius, CY + Math.sin(angle) * radius]
    }

    // Data polygon points (0-99 placement -> radius)
    const dataPts: [number, number][] = validAxes.map((key, i) => {
        const radius = scaleR(placementFor(key))
        return pointAt(i, radius)
    })

    // Per-axis data values for the data dots
    const axisPoints = validAxes.map((key, i) => {
        const value = placementFor(key)
        const radius = scaleR(value)
        const [x, y] = pointAt(i, radius)
        return { key, label: LABELS[key], x, y, value, percentile: percentiles?.[key], raw: rawText?.[key] ?? String(attributes[key]) }
    })

    const hovered = hoveredIndex !== null ? axisPoints[hoveredIndex] : null

    const levels = [25, 50, 75]

    return (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ width: "100%", height: "100%", display: "block" }}>
                <defs>
                    <filter id="xkcdify-radar" x="-5%" y="-5%" width="110%" height="110%">
                        <feTurbulence type="fractalNoise" baseFrequency="0.05" result="noise" />
                        <feDisplacementMap scale="3" xChannelSelector="R" yChannelSelector="G" in="SourceGraphic" in2="noise" />
                    </filter>
                </defs>

                {/* Concentric level polygons */}
                {levels.map((level) => {
                    const pts = validAxes.map((_, i) => pointAt(i, scaleR(level)))
                    return (
                        <path
                            key={level}
                            d={sketchyPolygonPath(pts, 1.5, rng)}
                            fill="none"
                            stroke="#ccc"
                            strokeWidth="1"
                            strokeDasharray="6,4"
                        />
                    )
                })}

                {/* Outer ring */}
                {(() => {
                    const pts = validAxes.map((_, i) => pointAt(i, RADIUS))
                    return (
                        <path
                            d={sketchyPolygonPath(pts, 2, rng)}
                            fill="none"
                            stroke="#999"
                            strokeWidth="1.5"
                            strokeDasharray="8,5"
                        />
                    )
                })()}

                {/* Axis lines */}
                {validAxes.map((_, i) => {
                    const [x, y] = pointAt(i, RADIUS)
                    return (
                        <path
                            key={i}
                            d={sketchyPolygonPath([[CX, CY], [x, y]], 1.5, rng, false)}
                            fill="none"
                            stroke="#bbb"
                            strokeWidth="1"
                        />
                    )
                })}

                {/* Data polygon */}
                {dataPts.length >= 2 && (
                    <path
                        d={sketchyPolygonPath(dataPts, 3, rng)}
                        fill={DATA_COLOR}
                        fillOpacity="0.15"
                        stroke={DATA_COLOR}
                        strokeWidth="3.5"
                        strokeLinejoin="round"
                    />
                )}

                {/* Level number labels */}
                {levels.map((level) => (
                    <text key={level} x={(CX + 4).toFixed(1)} y={(CY - scaleR(level) - 2).toFixed(1)} fontSize="9" fill="#999">
                        {level}
                    </text>
                ))}

                {/* Axis labels */}
                {validAxes.map((key, i) => {
                    const labelRadius = RADIUS + (i === 1 || i === 2 ? 40 : 28)
                    const [x, y] = pointAt(i, labelRadius)
                    return (
                        <text
                            key={key}
                            x={x.toFixed(1)}
                            y={y.toFixed(1)}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize="17"
                            fill="#555"
                        >
                            {LABELS[key]}
                        </text>
                    )
                })}

                {/* Data dots + hit areas */}
                {axisPoints.map((dot, i) => (
                    <g key={dot.key}>
                        <circle cx={dot.x.toFixed(1)} cy={dot.y.toFixed(1)} r="4" fill={DATA_COLOR} stroke="white" strokeWidth="2" />
                        <circle
                            cx={dot.x}
                            cy={dot.y}
                            r="20"
                            fill="transparent"
                            style={{ cursor: "pointer", pointerEvents: "all" }}
                            onMouseEnter={() => setHoveredIndex(i)}
                            onMouseLeave={() => setHoveredIndex(null)}
                        />
                    </g>
                ))}
            </svg>

            {hovered && (
                <div
                    style={{
                        position: "absolute",
                        left: `${(hovered.x / SIZE) * 100}%`,
                        top: `${(hovered.y / SIZE) * 100}%`,
                        transform: "translate(-50%, -100%) translateY(-12px)",
                        pointerEvents: "none",
                        zIndex: 10,
                    }}
                >
                    <svg width="200" height="60" style={{ margin: "-5px" }}>
                        <defs>
                            <filter id="xkcdify-tip-radar" x="-5%" y="-5%" width="110%" height="110%">
                                <feTurbulence type="fractalNoise" baseFrequency="0.05" result="noise" />
                                <feDisplacementMap scale="5" xChannelSelector="R" yChannelSelector="G" in="SourceGraphic" in2="noise" />
                            </filter>
                        </defs>
                        <rect
                            x="5"
                            y="5"
                            width="190"
                            height="50"
                            fill="white"
                            fillOpacity="0.9"
                            stroke="black"
                            strokeWidth="2"
                            rx="5"
                            ry="5"
                            filter="url(#xkcdify-tip-radar)"
                        />
                        <rect x="15" y="16" width="8" height="8" fill={DATA_COLOR} rx="2" ry="2" />
                        <text
                            x="27"
                            y="24"
                            fontSize="15px"
                            fontWeight="bold"
                            fill="black"
                            style={{ fontFamily: '"xkcd", cursive' }}
                        >
                            {hovered.label}: {hovered.raw}
                        </text>
                        {hovered.percentile !== undefined && (
                            <text
                                x="15"
                                y="44"
                                fontSize="15px"
                                fill="black"
                                style={{ fontFamily: '"xkcd", cursive' }}
                            >
                                Top {hovered.percentile}%
                            </text>
                        )}
                    </svg>
                </div>
            )}
        </div>
    )
}
