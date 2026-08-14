/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useState } from "react"
import { useAppStore } from "store"
import { getRepoData } from "@shared/common/chart"
import type { RepoMeta } from "@shared/types/chart"
import RadarChart from "./RadarChart"
import { formatNumber } from "../helpers/format"
import { languageColor } from "../helpers/language-colors"
import { FaStar, FaCodeFork, FaCircleExclamation, FaScaleBalanced, FaCalendarDays, FaTrophy } from "react-icons/fa6"

function toK(value: number): string {
    if (value < 1000) return String(value)
    return `${(value / 1000).toFixed(1)}k`
}

function formatStars(value: number): string {
    return toK(value)
}

function lastPushText(days: number): string {
    if (days < 0) return "unknown"
    if (days === 0) return "today"
    if (days === 1) return "yesterday"
    if (days < 30) return `${days} days ago`
    if (days < 365) return `${Math.round(days / 30)} months ago`
    return `${(days / 365).toFixed(1)} years ago`
}

export default function RepoStatsCard() {
    const store = useAppStore()
    const repo = store.repos.length === 1 ? store.repos[0] : null

    const [meta, setMeta] = useState<RepoMeta | null>(null)
    const [avatar, setAvatar] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let disposed = false
        if (!repo) {
            setMeta(null)
            setAvatar("")
            setError(null)
            return
        }
        setLoading(true)
        setError(null)
        getRepoData([repo])
            .then(({ data }) => {
                if (disposed) return
                setMeta(data[0]?.meta ?? null)
                setAvatar(data[0]?.logoUrl ?? "")
                if (!data[0]?.meta) setError("No stats available for this repo.")
            })
            .catch(() => {
                if (disposed) return
                setError("Failed to load stats.")
            })
            .finally(() => {
                if (!disposed) setLoading(false)
            })
        return () => {
            disposed = true
        }
    }, [repo])

    if (!repo) return null

    const rawText = meta
        ? {
              stars: formatNumber(meta.raw.stars),
              new_stars: `+${formatNumber(meta.raw.new_stars)}`,
              forks: formatNumber(meta.raw.forks),
              open_issues: formatNumber(meta.raw.open_issues),
              size: `${formatNumber(meta.raw.size)} KB`,
              pushes: lastPushText(meta.raw.pushes),
          }
        : undefined

    return (
        <div className="w-full max-w-3xl 2xl:max-w-4xl mx-auto sm:px-4 mb-6">
            <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden">
                <div className="flex flex-row flex-wrap">
                    {/* Radar / stats chart */}
                    <div className="w-full md:w-2/5 flex items-center justify-center p-4">
                        <div className="w-full max-w-[380px] aspect-square">
                            {loading && <div className="w-full h-full flex items-center justify-center text-neutral-400">Loading…</div>}
                            {!loading && error && <div className="w-full h-full flex items-center justify-center text-neutral-400 text-sm px-4 text-center">{error}</div>}
                            {!loading && !error && meta && <RadarChart attributes={meta.attributes} rawText={rawText} percentiles={meta.percentiles} />}
                        </div>
                    </div>

                    {/* Text stats */}
                    <div className="w-full md:w-3/5 p-6 md:pl-2 flex">
                        {!meta && !loading && <p className="text-sm text-neutral-500">{error ?? "Loading stats…"}</p>}
                        {meta && (
                            <div className="text-sm flex flex-col w-full">
                                <div className="flex items-start justify-between gap-4 mb-3">
                                    <div className="flex items-center gap-4 min-w-0">
                                    {(avatar || meta.owner) && (
                                        <img
                                            src={avatar || `https://github.com/${meta.owner}.png?size=160`}
                                            alt={repo}
                                            width={72}
                                            height={72}
                                            className="w-16 h-16 rounded-xl border border-neutral-200 shadow-sm"
                                        />
                                    )}
                                    <div className="min-w-0">
                                        <h2 className="text-xl font-bold text-neutral-800">
                                            <a href={`https://github.com/${repo}`} target="_blank" rel="noopener" className="hover:underline">
                                                {repo}
                                            </a>
                                        </h2>
                                        {meta.homepage ? (
                                            <a
                                                href={meta.homepage}
                                                target="_blank"
                                                rel="noopener"
                                                className="text-xs text-neutral-400 hover:text-neutral-600 hover:underline truncate block max-w-full"
                                            >
                                                {meta.homepage}
                                            </a>
                                        ) : (
                                            <a
                                                href={`https://github.com/${repo}`}
                                                target="_blank"
                                                rel="noopener"
                                                className="text-xs text-neutral-400 hover:text-neutral-600 hover:underline"
                                            >
                                                github.com/{repo}
                                            </a>
                                        )}
                                    </div>
                                    </div>
                                    <div className="inline-flex flex-col items-end shrink-0">
                                        <span className="inline-flex items-center gap-1 text-2xl font-bold text-neutral-600">
                                            <FaTrophy className="text-amber-500" />
                                            #{formatNumber(meta.rank)}
                                        </span>
                                        <span className="text-xs text-neutral-400">of {formatNumber(meta.total_repos)} repos</span>
                                    </div>
                                </div>
                                {meta.description && <p className="text-neutral-800 mb-2">{meta.description}</p>}

                                <div className="flex items-center gap-5 mb-2">
                                    <LanguageValue language={meta.language} />
                                    {meta.license && (
                                        <span className="inline-flex items-center gap-1.5 text-sm text-neutral-800">
                                            <FaScaleBalanced className="text-neutral-500" />
                                            {meta.license}
                                        </span>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4">
                                <StatRow label="Stars" icon={<FaStar className="text-neutral-500" />} value={formatStars(meta.stars_total)} />
                                <StatRow label="Forks" icon={<FaCodeFork className="text-neutral-500" />} value={formatStars(meta.forks_count)} />
                                <StatRow label="Open issues" icon={<FaCircleExclamation className="text-neutral-500" />} value={formatNumber(meta.open_issues_count)} />
                                {meta.created_at && <StatRow label="Created" icon={<FaCalendarDays className="text-neutral-500" />} value={meta.created_at.slice(0, 10)} />}
                                </div>
                                {meta.archived && <div className="pt-1 text-amber-700 font-semibold">Archived</div>}
                                {meta.topics.length > 0 && (
                                    <div className="mt-auto pt-2 flex flex-row flex-wrap gap-1">
                                        {meta.topics.slice(0, 8).map((t) => (
                                            <a
                                                key={t}
                                                href={`https://github.com/topics/${encodeURIComponent(t)}`}
                                                target="_blank"
                                                rel="noopener"
                                                className="px-2 py-0.5 text-xs bg-neutral-100 border border-neutral-200 rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200"
                                            >
                                                {t}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

function LanguageValue({ language }: { language: string | null }) {
    if (!language) return <span>—</span>
    return (
        <span className="inline-flex items-center gap-1.5 text-sm text-neutral-800">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: languageColor(language) }} />
            {language}
        </span>
    )
}

function StatRow({ label, icon, value }: { label: string; icon?: React.ReactNode; value: React.ReactNode }) {
    return (
        <div className="py-0.5 min-w-0">
            <div className="text-neutral-800 text-sm truncate">{value}</div>
            <div className="text-neutral-400 text-xs flex items-center gap-1">
                {icon}
                {label}
            </div>
        </div>
    )
}
