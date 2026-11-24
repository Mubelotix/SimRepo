export function formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k"
    return n.toString()
}

const trustScoreFormat = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 2 })
export const formatTrustScore = (score: number): string => trustScoreFormat.format(score)
