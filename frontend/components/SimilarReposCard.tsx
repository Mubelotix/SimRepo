/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useState } from "react"
import axios from "axios"
import { useAppStore } from "../store"
import { REPO_DATA_API_URL } from "@shared/common/config"
import { SimilarRepo } from "@shared/types/chart"
import { formatNumber } from "../helpers/format"
import { languageColor } from "../helpers/language-colors"

// Max recommendations the backend will serve today. Keep in sync with the
// backend's MAX_SIMILAR_REPOS so we never request more than is allowed.
const MAX_SIMILAR_REPOS = 3

const SimilarReposCard: React.FC = () => {
    const store = useAppStore()
    const repo = store.repos.length === 1 ? store.repos[0] : null

    const [repos, setRepos] = useState<SimilarRepo[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        let disposed = false
        if (!repo) {
            setRepos([])
            return
        }
        setLoading(true)
        axios
            .get(`${REPO_DATA_API_URL}/similar-repos`, {
                params: { repo, limit: MAX_SIMILAR_REPOS },
                timeout: 10000,
            })
            .then(({ data }) => {
                if (disposed) return
                setRepos(data?.repos ?? [])
            })
            .catch(() => {
                if (disposed) return
                setRepos([])
            })
            .finally(() => {
                if (disposed) return
                setLoading(false)
            })
        return () => {
            disposed = true
        }
    }, [repo])

    if (!repo) return null

    const handleClick = (e: React.MouseEvent, repoName: string) => {
        e.preventDefault()
        store.actions.setRepos([repoName])
        window.location.hash = repoName
    }

    return (
        <div className="sidebar-sticky">
            <div className="pt-4">
                <div className="flex justify-center gap-4 mb-3">
                    <span className="text-xs font-medium pb-1 border-b-2 text-gray-900 border-gray-900">
                        Similar repositories
                    </span>
                </div>
                {loading ? (
                    <div className="text-xs text-gray-500 leading-relaxed">Loading…</div>
                ) : repos.length === 0 ? null : (
                    <ul className="space-y-3">
                        {repos.map((item) => {
                            const [owner, repoName] = item.repo.split("/")
                            return (
                                <li key={item.repo}>
                                    <a
                                        href={`/#${item.repo}`}
                                        onClick={(e) => handleClick(e, item.repo)}
                                        className="block text-sm cursor-pointer group rounded-md border px-3 py-2.5 transition-colors hover:bg-gray-50"
                                        style={{ borderColor: "rgb(209, 217, 224)" }}
                                    >
                                        <span className="flex items-center text-blue-600 leading-5">
                                            <OcticonRepo className="shrink-0 text-gray-500 mr-1.5" />
                                            <span className="truncate">{owner}/</span>
                                            <span className="truncate font-bold">{repoName}</span>
                                            {item.meta.archived && (
                                                <span className="ml-1 shrink-0 text-yellow-600 border border-yellow-500 rounded px-1 py-px text-[10px] font-medium leading-tight">
                                                    archived
                                                </span>
                                            )}
                                        </span>
                                        {item.meta.description && (
                                            <span className="block text-xs leading-5 mt-1 line-clamp-2" style={{ color: "rgb(89, 99, 110)" }}>
                                                {item.meta.description}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-3 text-xs leading-5 mt-1" style={{ color: "rgb(89, 99, 110)" }}>
                                            {item.meta.language && (
                                                <span className="inline-flex items-center gap-1">
                                                    <span
                                                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                                                        style={{ backgroundColor: languageColor(item.meta.language) }}
                                                    />
                                                    {item.meta.language}
                                                </span>
                                            )}
                                            <span className="inline-flex items-center gap-1">
                                                <OcticonStar className="text-gray-400" />
                                                {formatNumber(item.meta.stars_total)}
                                            </span>
                                            <span className="inline-flex items-center gap-1">
                                                <OcticonRepoForked className="text-gray-400" />
                                                {formatNumber(item.meta.forks_count)}
                                            </span>
                                        </span>
                                    </a>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </div>
        </div>
    )
}

// --- GitHub octicons (16x16), rendered inline ---

const iconProps = (props: React.SVGProps<SVGSVGElement>) => ({
    viewBox: "0 0 16 16",
    width: "1rem",
    height: "1rem",
    fill: "currentColor",
    ...props,
})

const OcticonRepo = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...iconProps(props)}>
        <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z" />
    </svg>
)

const OcticonStar = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...iconProps(props)}>
        <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Zm0 2.445L6.615 5.5a.75.75 0 0 1-.564.41l-3.097.45 2.24 2.184a.75.75 0 0 1 .216.664l-.528 3.084 2.769-1.456a.75.75 0 0 1 .698 0l2.77 1.456-.53-3.084a.75.75 0 0 1 .216-.664l2.24-2.183-3.096-.45a.75.75 0 0 1-.564-.41L8 2.694Z" />
    </svg>
)

const OcticonRepoForked = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...iconProps(props)}>
        <path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z" />
    </svg>
)

export default SimilarReposCard