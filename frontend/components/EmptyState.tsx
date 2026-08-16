/* eslint-disable @next/next/no-img-element */
import React from "react"
import { useAppStore } from "../store"
import { formatNumber } from "../helpers/format"
import { FaSpinner } from "react-icons/fa"

const STAR_HISTORY_COM_URL = "https://www.star-history.com"
const API_RESTRICTION_BLOG_URL = "https://www.star-history.com/blog/github-stargazer-api-restriction"

const EmptyState: React.FC = () => {
    const store = useAppStore()

    const handleRepoClick = (e: React.MouseEvent, repoName: string) => {
        e.preventDefault()
        store.actions.setRepos([repoName])
        window.location.hash = repoName
    }

    return (
        <div className="w-full max-w-3xl 2xl:max-w-4xl mx-auto sm:px-4 mt-6 px-3">
            <div className="w-full border border-solid border-amber-300 rounded bg-amber-50 p-6 sm:p-8 shadow-sm">
                <h2 className="text-xl font-semibold text-dark mb-3">Welcome!</h2>
                <p className="text-dark leading-7">
                    Migrating here from{" "}
                    <a className="link" href={STAR_HISTORY_COM_URL} target="_blank" rel="noreferrer">
                        star-history.com
                    </a>
                    ? You&apos;re at the right place.{" "}
                    <a className="link" href={API_RESTRICTION_BLOG_URL} target="_blank" rel="noreferrer">
                        GitHub&apos;s Stargazer API shutdown
                    </a>{" "}
                    doomed the original, but this fork keeps star history alive from a different data source. And
                    we&apos;re the only service that&apos;s simple to use <em>and</em> doesn&apos;t beg for a
                    write-enabled API token.
                </p>
            </div>

            <div className="w-full mt-10">
                <div className="flex justify-center gap-4 mb-5">
                    <h2 className="text-xs font-medium pb-1 border-b-2 text-gray-900 border-gray-900">Trusted by</h2>
                </div>
                {!store.trustedByLoaded ? (
                    <div className="w-full flex flex-row justify-center items-center text-sm text-gray-400">
                        <FaSpinner className="animate-spin mr-2" /> Loading migrated repositories...
                    </div>
                ) : (
                    <ul className="flex flex-row flex-wrap justify-center gap-3">
                        {store.trustedBy.map((repo) => (
                            <li key={repo.name}>
                                <a
                                    href={`#${repo.name}`}
                                    onClick={(e) => handleRepoClick(e, repo.name)}
                                    className="flex flex-row justify-center items-center gap-2 px-3 py-1.5 text-sm text-dark bg-gray-100 rounded-lg shadow-sm hover:bg-gray-200"
                                >
                                    <img src={repo.logoUrl} alt={`${repo.name} logo`} className="w-5 h-5 rounded-full" />
                                    <span className="whitespace-nowrap">{repo.name}</span>
                                    {repo.stars !== null && (
                                        <span className="text-xs font-medium text-amber-600 whitespace-nowrap flex items-center gap-1">
                                            <i className="fas fa-star text-amber-500 text-sm" aria-hidden="true"></i>
                                            {formatNumber(repo.stars)}
                                        </span>
                                    )}
                                </a>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}

export default EmptyState