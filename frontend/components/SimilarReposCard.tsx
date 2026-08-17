/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useState } from "react"
import { useAppStore } from "../store"
import { REPO_DATA_API_URL } from "@shared/common/config"
import { SimilarRepo } from "@shared/types/chart"
import SimilarRepoList from "./SimilarRepoList"
import { countEvent } from "../helpers/analytics"

const SimilarReposCard: React.FC = () => {
    const store = useAppStore()
    const repo = store.repos.length === 1 ? store.repos[0] : null

    const [repos, setRepos] = useState<SimilarRepo[]>([])
    const [loading, setLoading] = useState(false)
    const [limited, setLimited] = useState(false)

    useEffect(() => {
        let disposed = false
        if (!repo) {
            setRepos([])
            setLimited(false)
            return
        }
        setLoading(true)
        setLimited(false)
        fetch(`${REPO_DATA_API_URL}/similar-repos?repo=${encodeURIComponent(repo)}`, {
                signal: AbortSignal.timeout(10000),
            })
            .then(async (res) => {
                if (disposed) return
                if (res.status === 429) {
                    setRepos([])
                    setLimited(true)
                    return
                }
                const data = await res.json()
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
        countEvent("similar-repo-click", { source: repo, target: repoName })
        store.actions.setRepos([repoName])
        window.location.hash = repoName
    }

    const handleExtensionClick = (e: React.MouseEvent) => {
        e.preventDefault()
        countEvent("extension-click")
        window.open(getExtensionStoreUrl(), "_blank", "noopener,noreferrer")
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
                ) : limited ? (
                    <div className="text-xs text-gray-500 leading-relaxed">
                        You&apos;ve reached the limit for similar-repository lookups on the website.{" "}
                        <a
                            href="#"
                            onClick={handleExtensionClick}
                            className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
                        >
                            Install the SimRepo browser extension
                        </a>{" "}
                        to keep exploring similar repositories without limits.
                    </div>
                ) : repos.length === 0 ? null : (
                    <>
                    <SimilarRepoList repos={repos} onItemClick={handleClick} />
                    <a
                        href="#"
                        onClick={handleExtensionClick}
                        className="mt-3 block text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                    >
                        Explore more than three similar repositories using the browser extension
                    </a>
                    </>
                )}
            </div>
        </div>
    )
}

// --- GitHub octicons (16x16), rendered inline ---

const EXTENSION_STORES = {
    firefox: "https://addons.mozilla.org/en-US/firefox/addon/simrepo/",
    edge: "https://microsoftedge.microsoft.com/addons/detail/simrepo/hepnmbpflckgenbalbaebckhpncaabid",
    chrome:
        "https://chromewebstore.google.com/detail/simrepo/jieoogmcigenidbkgnkaakagdnlnieap",
}

export const getExtensionStoreUrl = (): string => {
    const ua = navigator.userAgent.toLowerCase()
    if (ua.includes("firefox")) return EXTENSION_STORES.firefox
    if (ua.includes("edg")) return EXTENSION_STORES.edge
    return EXTENSION_STORES.chrome
}

export const EXTENSION_STORE_URL = EXTENSION_STORES.chrome

export default SimilarReposCard