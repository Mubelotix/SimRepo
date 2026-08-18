import React from "react"
import { FaSkullCrossbones, FaTriangleExclamation, FaCircleCheck, FaCircleInfo } from "react-icons/fa6"

interface FakeStarNoticeProps {
    // Estimated share (0-1) of stars that appear to be fake. null hides the notice.
    ratio: number | null
}

interface TierConfig {
    min: number
    icon: React.ComponentType<{ className?: string }>
    body: string
    box: string
    iconCls: string
    pctCls: string
}

// Tiers are checked top-down; the first whose `min` the ratio meets wins.
// `box`/`pctCls`/`iconCls` are Tailwind classes tuned per severity, from an
// alarming deep red for near-certain fake stars down to a quiet green box.
const TIERS: TierConfig[] = [
    {
        min: 0.95,
        icon: FaSkullCrossbones,
        body: "This repository shows extreme signs of fake or purchased stars.",
        box: "bg-red-700 border-red-900 text-red-50",
        iconCls: "text-red-50",
        pctCls: "text-red-50",
    },
    {
        min: 0.8,
        icon: FaTriangleExclamation,
        body: "A large share of this repository's stars appear to be fake or purchased.",
        box: "bg-orange-100 border-orange-400 text-orange-900",
        iconCls: "text-orange-600",
        pctCls: "text-orange-700",
    },
    {
        min: 0.6,
        icon: FaTriangleExclamation,
        body: "A significant share of this repository's stars may be fake or purchased.",
        box: "bg-amber-50 border-amber-300 text-amber-900",
        iconCls: "text-amber-600",
        pctCls: "text-amber-700",
    },
    {
        min: 0.25,
        icon: FaCircleInfo,
        body: "This repository's stars show possible signs of faking.",
        box: "bg-white border-neutral-200 text-neutral-800",
        iconCls: "text-neutral-400",
        pctCls: "text-neutral-700",
    },
    {
        min: 0,
        icon: FaCircleCheck,
        body: "Few or no fake stars detected.",
        box: "bg-green-50 border-green-300 text-green-900",
        iconCls: "text-green-600",
        pctCls: "text-green-700",
    },
]

const DISCLAIMER =
    "These figures are statistical estimates. False positives are possible, and only a high share of suspicious accounts is meaningful. Fake stars do not necessarily mean the maintainers are at fault, as they may have nothing to do with them."

export default function FakeStarNotice({ ratio }: FakeStarNoticeProps) {
    if (ratio === null || ratio === undefined) return null

    const tier = TIERS.find((t) => ratio >= t.min) ?? TIERS[TIERS.length - 1]
    const Icon = tier.icon
    const pct = Math.round(ratio * 100)

    return (
        <div role="alert" className={`w-full rounded-xl border-2 ${tier.box}`}>
            <div className="flex flex-col gap-1.5 px-4 py-3">
                <div className="flex items-baseline gap-x-2 flex-wrap">
                    <Icon className={`text-xl shrink-0 ${tier.iconCls}`} aria-hidden="true" />
                    <span className={`text-2xl font-extrabold leading-none ${tier.pctCls}`}>{pct}%</span>
                    <span className="text-sm font-semibold">Suspicious stars</span>
                </div>
                <div className="text-sm">
                    {tier.body}
                </div>
                <div className="text-xs leading-relaxed opacity-90">
                    {DISCLAIMER}
                </div>
            </div>
        </div>
    )
}