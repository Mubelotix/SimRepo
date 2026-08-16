/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useState } from "react"
import Head from "next/head"
import { useRouter } from "next/router"
import Header from "../components/header"
import Footer from "../components/footer"
import RepoSearchInput from "../components/RepoSearchInput"
import SimilarRepoList from "../components/SimilarRepoList"
import { REPO_DATA_API_URL } from "@shared/common/config"
import { SITE_URL } from "../helpers/consts"
import { countEvent } from "../helpers/analytics"
import type { SimilarRepo } from "@shared/types/chart"

// Every engine the extension supports, matching the store links used in the README.
const BROWSER_INSTALLS = [
    { name: "Firefox", url: "https://addons.mozilla.org/en-US/firefox/addon/simrepo/", icon: "https://imgur.com/ihXsdDO.png" },
    { name: "Brave", url: "https://chromewebstore.google.com/detail/simrepo/jieoogmcigenidbkgnkaakagdnlnieap", icon: "https://imgur.com/z8yjLZ2.png" },
    { name: "Chrome", url: "https://chromewebstore.google.com/detail/simrepo/jieoogmcigenidbkgnkaakagdnlnieap", icon: "https://imgur.com/3C4iKO0.png" },
    { name: "Edge", url: "https://microsoftedge.microsoft.com/addons/detail/simrepo/hepnmbpflckgenbalbaebckhpncaabid", icon: "https://imgur.com/vMcaXaw.png" },
    { name: "Vivaldi", url: "https://chromewebstore.google.com/detail/simrepo/jieoogmcigenidbkgnkaakagdnlnieap", icon: "https://imgur.com/EuDp4vP.png" },
    { name: "Opera", url: "https://chromewebstore.google.com/detail/simrepo/jieoogmcigenidbkgnkaakagdnlnieap", icon: "https://imgur.com/nSJ9htU.png" },
    { name: "Tor", url: "https://addons.mozilla.org/en-US/firefox/addon/simrepo/", icon: "https://imgur.com/MQYBSrD.png" },
]

// --- v1: the recommendation engine used by the browser extension, backed by a
// live Qdrant recommendation query. It matches the extension's request verbatim.
const QDRANT_RECOMMEND_URL = "https://simrepo.dera.page/collections/repos/points/recommend"
const QDRANT_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJyIn0.drJ8F-oa_6UfCpmKdv4Mbng_E8p71UrZAR895gKOOAk"
const V1_LIMIT = 3

// --- v2: the recommendation engine already live on the site (/similar-repos).
// Requesting through the existing endpoint means the normal per-IP rate limits
// apply, exactly like the rest of the site. Untrusted requests only get the
// first page (up to 3 recommendations).

// Example repos shown in the empty state so visitors can try the demo with one click.
const EXAMPLE_REPOS = [
    "filebrowser/filebrowser",
    "anddea/revanced-patches",
    "Leaflet/Leaflet",
    "mitmproxy/mitmproxy",
    "anthropics/claude-code",
]

interface V1Repo {
    id: number
    score: number
    payload: {
        full_name: string
        description: string | null
        language: string | null
        stargazers_count: number
        forks_count: number
        archived: boolean
    }
}

// Map a raw Qdrant result to the shared SimilarRepo shape so both engines can be
// rendered with the same SimilarRepoList layout.
function toSimilarRepo(r: V1Repo): SimilarRepo {
    const [owner] = r.payload.full_name.split("/")
    return {
        repo: r.payload.full_name,
        score: r.score,
        logoUrl: "",
        meta: {
            owner,
            description: r.payload.description,
            language: r.payload.language,
            license: null,
            homepage: null,
            stars_total: r.payload.stargazers_count,
            forks_count: r.payload.forks_count,
            open_issues_count: 0,
            topics: [],
            rank: 0,
            archived: r.payload.archived,
        },
    }
}

interface CompareResult {
    v1: SimilarRepo[]
    v2: SimilarRepo[]
    v1Limited: boolean
    v2Limited: boolean
    v1Error: string | null
    v2Error: string | null
    notFound: boolean
}

const Compare: React.FC = () => {
    const router = useRouter()
    const [repo, setRepo] = useState("")
    const [result, setResult] = useState<CompareResult | null>(null)
    const [loading, setLoading] = useState(false)

    // Load (or reload) the comparison from a shareable ?repo= param.
    useEffect(() => {
        const fromUrl = typeof router.query.repo === "string" ? router.query.repo : ""
        if (fromUrl) {
            setRepo(fromUrl)
            runCompare(fromUrl)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.query.repo])

    const runCompare = async (nameOverride?: string) => {
        const name = (nameOverride ?? repo).trim()
        if (!name) return

        // Keep the selected repo shareable in the URL.
        const url = new URL(window.location.href)
        const current = url.searchParams.get("repo")
        if (current !== name) {
            url.searchParams.set("repo", name)
            window.history.replaceState(null, "", url.toString())
        }

        setLoading(true)
        setResult(null)

        let repoId: number | null = null
        try {
            const res = await fetch(`${REPO_DATA_API_URL}/repo-id?repo=${encodeURIComponent(name)}`, {
                signal: AbortSignal.timeout(10000),
            })
            const data = await res.json()
            repoId = data?.id ?? null
        } catch {
            repoId = null
        }

        if (repoId === null) {
            setLoading(false)
            setResult({
                v1: [],
                v2: [],
                v1Limited: false,
                v2Limited: false,
                v1Error: null,
                v2Error: null,
                notFound: true,
            })
            return
        }

        // v1: live Qdrant recommendation (same call the browser extension makes).
        let v1: SimilarRepo[] = []
        let v1Limited = false
        let v1Error: string | null = null
        try {
            const res = await fetch(QDRANT_RECOMMEND_URL, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "api-key": QDRANT_API_KEY,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    limit: V1_LIMIT,
                    positive: [repoId],
                    filter: { must: [] },
                    offset: 0,
                    with_payload: true,
                    with_vector: false,
                }),
                signal: AbortSignal.timeout(15000),
            })
            if (res.status === 404) {
                v1Error = "This repository is not covered by the v1 (TruncatedSVD) dataset."
            } else {
                const data = await res.json()
                const raw = data?.result ?? []
                v1 = raw
                    .filter((r: { payload?: { full_name?: string } }) => r?.payload?.full_name)
                    .map(toSimilarRepo)
            }
        } catch {
            v1Error = "The v1 (TruncatedSVD) engine could not be reached."
        }

        // v2: existing site endpoint (rate-limited per IP).
        let v2: SimilarRepo[] = []
        let v2Limited = false
        let v2Error: string | null = null
        try {
            const res = await fetch(`${REPO_DATA_API_URL}/similar-repos?repo=${encodeURIComponent(name)}`, {
                signal: AbortSignal.timeout(10000),
            })
            if (res.status === 429) {
                v2Limited = true
            } else {
                const data = await res.json()
                v2 = data?.repos ?? []
            }
        } catch {
            v2Error = "The v2 (site) engine could not be reached."
        }

        setLoading(false)
        setResult({ v1, v2, v1Limited, v2Limited, v1Error, v2Error, notFound: false })
    }

    const handleSubmit = () => {
        runCompare()
    }

    const handleSelect = (repoName: string) => {
        setRepo(repoName)
        runCompare(repoName)
    }

    return (
        <>
            <Head>
                <title>New Model Demo – SimRepo</title>
                <meta name="description" content="See how the new SimRepo similarity model recommends repositories, compared to the previous engine." />
                <meta property="og:type" content="website" />
                <meta property="og:url" content={`${SITE_URL}/v1-vs-v2`} />
                <meta property="og:title" content="New Model Demo – SimRepo" />
                <meta property="og:description" content="See how the new SimRepo similarity model recommends repositories, compared to the previous engine." />
            </Head>
            <div className="relative w-full h-auto min-h-screen flex flex-col overflow-x-hidden">
                <Header />
                <div className="w-full h-auto grow flex flex-row justify-center">
                    <div className="w-full max-w-5xl mx-auto px-4 pt-8 flex flex-col items-center">
                        <h1 className="text-2xl font-bold text-center mb-2">
New Model Demo
                        </h1>
                        <p className="text-sm text-gray-500 text-center mb-6 max-w-xl">
                            Enter a repository to see which similar repositories each engine
                            recommends, side by side. <span className="font-medium text-green-600">The new model (right)</span> powers
                            this website and is the recommended engine.
                        </p>

                        <div className="w-full max-w-2xl mb-8">
                            <RepoSearchInput
                                value={repo}
                                onChange={setRepo}
                                onSelect={handleSelect}
                                onSubmit={handleSubmit}
                                placeholder="e.g. torvalds/linux"
                                buttonLabel={loading ? "Comparing…" : "Compare engines"}
                                className="border border-gray-300 rounded"
                            />
                        </div>

                        {loading && (
                            <div className="text-sm text-gray-500 py-10">Comparing engines…</div>
                        )}

                        {!loading && !result && (
                            <div className="w-full max-w-2xl mb-8">
                                <div className="flex justify-center mb-4">
                                    <span className="text-xs font-medium pb-1 border-b-2 text-gray-900 border-gray-900">
                                        No idea? Try one of these
                                    </span>
                                </div>
                                <ul className="flex flex-row flex-wrap justify-center gap-3">
                                    {EXAMPLE_REPOS.map((repoName) => (
                                        <li key={repoName}>
                                            <a
                                                href={`/v1-vs-v2?repo=${encodeURIComponent(repoName)}`}
                                                onClick={(e) => {
                                                    e.preventDefault()
                                                    handleSelect(repoName)
                                                }}
                                                className="flex flex-row justify-center items-center px-3 py-1.5 text-sm text-dark bg-gray-100 rounded-lg shadow-sm hover:bg-gray-200"
                                            >
                                                <span className="whitespace-nowrap">{repoName}</span>
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {result?.notFound && (
                            <div className="w-full text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-4 py-3 text-center">
                                Repository not found in the dataset. Try a more popular repository.
                            </div>
                        )}

                        {result && !result.notFound && (
                            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                <ComparePanel
                                    title="v1 · TruncatedSVD"
                                    subtitle="Cosine similarity over 100-dim embeddings (Qdrant)"
                                    repos={result.v1}
                                    limited={result.v1Limited}
                                    error={result.v1Error}
                                    onRepoClick={handleSelect}
                                    scoreFormat="percent"
                                />
                                <ComparePanel
                                    title="v2 · Collaborative Filtering"
                                    subtitle="Time-decayed shared-stargazer overlap, precomputed"
                                    repos={result.v2}
                                    limited={result.v2Limited}
                                    error={result.v2Error}
                                    onRepoClick={handleSelect}
                                    recommended
                                    scoreFormat="raw"
                                />
                            </div>
                        )}

                        <div className="w-full max-w-2xl mt-10 flex flex-col items-center gap-4">
                            <p className="text-sm text-gray-600 text-center">
                                Want more? Get the <span className="font-medium text-gray-800">SimRepo browser extension</span> to unlock
                                unlimited similar-repository lookups, right on GitHub.
                            </p>
                            <div className="flex flex-row flex-wrap justify-center items-center gap-5">
                                {BROWSER_INSTALLS.map((browser) => (
                                    <a
                                        key={browser.name}
                                        href={browser.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={`Install SimRepo on ${browser.name}`}
                                        aria-label={`Install SimRepo on ${browser.name}`}
                                        className="hover:opacity-80 transition-opacity"
                                        onClick={() => countEvent("extension-click")}
                                    >
                                        <img src={browser.icon} width={48} height={48} alt={browser.name} />
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <Footer />
            </div>
        </>
    )
}

interface ComparePanelProps {
    title: string
    subtitle: string
    repos: SimilarRepo[]
    limited: boolean
    error: string | null
    onRepoClick?: (_repoName: string) => void
    recommended?: boolean
    scoreFormat?: "percent" | "raw"
}

const ComparePanel: React.FC<ComparePanelProps> = ({
    title,
    subtitle,
    repos,
    limited,
    error,
    onRepoClick,
    recommended,
    scoreFormat,
}) => {
    const borderClass = recommended
        ? "border-green-500 ring-2 ring-green-200 shadow-lg shadow-green-100"
        : "border-gray-300 shadow-sm"
    const accentText = recommended ? "text-green-700" : "text-gray-500"

    return (
        <div className={`rounded-xl border-2 ${borderClass} p-5 flex flex-col bg-white`}>
            <div className="flex items-center justify-between mb-1">
                <span className={`text-lg font-bold ${recommended ? "text-green-700" : "text-gray-700"}`}>
                    {title}
                </span>
                {recommended && (
                    <span className="text-xs font-semibold bg-green-500 text-white rounded-full px-2.5 py-1">
                        New
                    </span>
                )}
            </div>
            <p className={`text-xs mb-4 ${accentText}`}>{subtitle}</p>

            {error ? (
                <div className="text-sm text-gray-500">{error}</div>
            ) : limited ? (
                <div className="text-sm text-gray-500">
                    Reached the rate limit for this lookup on the website. Try again later.
                </div>
            ) : repos.length === 0 ? (
                <div className="text-sm text-gray-400">No similar repositories returned.</div>
            ) : (
                <SimilarRepoList
                    repos={repos}
                    showScore={scoreFormat}
                    onItemClick={(e, repoName) => {
                        e.preventDefault()
                        onRepoClick?.(repoName)
                    }}
                    repoUrl={(r) => `/v1-vs-v2?repo=${encodeURIComponent(r)}`}
                />
            )}
        </div>
    )
}

export default Compare