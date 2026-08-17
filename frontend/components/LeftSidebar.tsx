import React, { useEffect, useState } from "react"
import { useAppStore } from "../store"
import { REPO_DATA_API_URL } from "@shared/common/config"
import { formatNumber } from "../helpers/format"

type Tab = "weekly" | "alltime" | "pyramid" | "random"

interface LeaderboardEntry {
    name: string
    stars_total: number
    new_stars: number
    logo_url: string
}

interface LeaderboardTier {
    threshold: number
    label: string
    count: number
}

interface LeaderboardData {
    updated_at: string
    all_time: LeaderboardEntry[]
    weekly: LeaderboardEntry[]
    random: LeaderboardEntry[]
    tiers: LeaderboardTier[]
}

const tabs: { key: Tab; label: string }[] = [
    { key: "weekly", label: "Weekly" },
    { key: "alltime", label: "All-time" },
    { key: "random", label: "Random" },
    { key: "pyramid", label: "Pyramid" },
]

const LeftSidebar: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>("weekly")
    const [data, setData] = useState<LeaderboardData | null>(null)
    const [failed, setFailed] = useState(false)
    const store = useAppStore()

    useEffect(() => {
        let disposed = false
        const load = async () => {
            try {
                const res = await fetch(`${REPO_DATA_API_URL}/leaderboard`, { signal: AbortSignal.timeout(10000) })
                const data = await res.json()
                if (!disposed) setData(data)
            } catch {
                if (!disposed) setFailed(true)
            }
        }
        load()
        return () => {
            disposed = true
        }
    }, [])

    const handleClick = (e: React.MouseEvent, repoName: string) => {
        e.preventDefault()
        store.actions.setRepos([repoName])
        window.location.hash = repoName
    }

    if (failed) {
        return (
            <div className="sidebar-sticky">
                <div className="pt-4">
                    <div className="flex justify-center gap-4 mb-3">
                        <span className="text-xs font-medium pb-1 border-b-2 text-gray-900 border-gray-900">
                            Leaderboard
                        </span>
                    </div>
                    <div className="text-xs text-gray-500 leading-relaxed">
                        <p>Couldn&apos;t load the leaderboard.</p>
                    </div>
                </div>
            </div>
        )
    }

    const items =
        activeTab === "weekly"
            ? (data?.weekly ?? []).map((r) => ({
                  name: r.name,
                  logo_url: r.logo_url,
                  metric: `+${formatNumber(r.new_stars)}`,
                  metricClass: "accent-text",
              }))
            : activeTab === "random"
            ? (data?.random ?? []).map((r) => ({
                  name: r.name,
                  logo_url: r.logo_url,
                  metric: formatNumber(r.stars_total),
                  metricClass: "text-gray-400",
              }))
            : (data?.all_time ?? []).map((r) => ({
                  name: r.name,
                  logo_url: r.logo_url,
                  metric: formatNumber(r.stars_total),
                  metricClass: "text-gray-400",
              }))

    return (
        <div className="sidebar-sticky">
            <div className="pt-4">
                <div className="flex justify-center gap-4 mb-3">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`text-xs font-medium pb-1 border-b-2 transition-colors ${
                                activeTab === tab.key
                                    ? "text-gray-900 border-gray-900"
                                    : "text-gray-400 border-transparent hover:text-gray-600"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                {activeTab === "pyramid" ? (
                    <div className="space-y-2 mt-1">
                        {(data?.tiers ?? []).map((tier, _, filtered) => {
                            const total = filtered[filtered.length - 1].count
                            const widthPct = total > 0 ? (tier.count / total) * 100 : 0
                            const pct = total > 0 ? (tier.count / total) * 100 : 0
                            const pctLabel =
                                pct < 0.0001
                                    ? `${pct.toFixed(5)}%`
                                    : pct < 0.001
                                    ? `${pct.toFixed(4)}%`
                                    : pct < 0.01
                                    ? `${pct.toFixed(3)}%`
                                    : pct < 0.1
                                    ? `${pct.toFixed(2)}%`
                                    : `${pct.toFixed(1)}%`
                            return (
                                <div key={tier.threshold}>
                                    <div className="flex items-baseline justify-between text-xs mb-0.5">
                                        <span className="text-gray-700 font-medium">★ {tier.label}</span>
                                        <span className="text-gray-400">
                                            {formatNumber(tier.count)}{" "}
                                            <span className="text-gray-300">({pctLabel})</span>
                                        </span>
                                    </div>
                                    <div
                                        className="h-3 rounded-sm"
                                        style={{
                                            width: `${widthPct}%`,
                                            backgroundColor: "#16a34a",
                                        }}
                                    />
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <ol className="space-y-0.5">
                        {items.map((item, i) => {
                            const repoName = item.name.split("/")[1] ?? item.name
                            return (
                                <li key={item.name} className="relative group">
                                    <a
                                        href={`/#${item.name}`}
                                        onClick={(e) => handleClick(e, item.name)}
                                        className="flex items-center gap-2 py-1 text-sm cursor-pointer"
                                    >
                                        {activeTab !== "random" && (
                                        <span className="text-xs text-gray-400 w-4 shrink-0">{i + 1}</span>
                                    )}
                                        <img
                                            src={item.logo_url}
                                            alt=""
                                            width={16}
                                            height={16}
                                            className="rounded-full shrink-0"
                                        />
                                        <span className="truncate text-gray-700 group-hover:text-blue-600">
                                            {repoName}
                                        </span>
                                        <span className="flex-1 min-w-0" />
                                        <span className={`text-xs shrink-0 ${item.metricClass}`}>
                                            {item.metric}
                                        </span>
                                    </a>
                                    <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden group-hover:block whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white shadow z-10">
                                        {item.name} {item.metric}
                                    </span>
                                </li>
                            )
                        })}
                    </ol>
                )}
                {data && <p className="text-[10px] text-gray-300 mt-3">Updated {data.updated_at}</p>}
            </div>
        </div>
    )
}

export default LeftSidebar