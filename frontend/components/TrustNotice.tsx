import React from "react"
import { FaSkullCrossbones, FaTriangleExclamation, FaCircleExclamation, FaCircleCheck, FaCircleInfo } from "react-icons/fa6"
import type { RepoMeta } from "@shared/types/chart"
import { SUSPICIOUS_TRUST_THRESHOLD } from "@shared/common/trust"
import { formatNumber, formatTrustScore } from "../helpers/format"

interface TierConfig {
    min: number
    label: string
    icon: React.ComponentType<{ className?: string }>
    box: string
}

// Tiers are checked top-down; the first whose `min` the trust score meets wins.
const TIERS: TierConfig[] = [
    {
        min: 0.5,
        label: "Excellent",
        icon: FaCircleCheck,
        box: "bg-green-50 border-green-300 text-green-900",
    },
    {
        min: 0.25,
        label: "Good",
        icon: FaCircleInfo,
        box: "bg-lime-50 border-lime-300 text-lime-900",
    },
    {
        min: 0.05,
        label: "Average",
        icon: FaCircleExclamation,
        box: "bg-gray-50 border-gray-300 text-gray-900",
    },
    {
        min: SUSPICIOUS_TRUST_THRESHOLD,
        label: "Low",
        icon: FaTriangleExclamation,
        box: "bg-orange-100 border-orange-400 text-orange-900",
    },
    {
        min: 0,
        label: "Suspicious",
        icon: FaSkullCrossbones,
        box: "bg-red-700 border-red-900 text-red-50",
    },
]

export default function TrustNotice({ meta }: { meta: RepoMeta }) {
    const trust = meta.trust_p
    if (trust == null || trust > 1) return null
    const tier = TIERS.find((t) => trust >= t.min)
    if (!tier) return null
    const Icon = tier.icon
    const corrected = meta.raw.stars
    const showCorrection =
        trust < 0.25 && corrected != null && corrected >= 0 && meta.stars_total != null && corrected !== meta.stars_total

    return (
        <div className={`w-full rounded-lg border px-3 py-2 ${tier.box}`}>
            <div className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="shrink-0" aria-hidden="true" />
                <span>{formatTrustScore(trust)} trust score · {tier.label}</span>
            </div>
            <p className="mt-0.5 text-xs">
                {showCorrection && <><strong>{formatNumber(corrected)} corrected stars</strong> · </>}
                <span className="opacity-80">Based on a statistical model and may be inaccurate.</span>
            </p>
        </div>
    )
}
