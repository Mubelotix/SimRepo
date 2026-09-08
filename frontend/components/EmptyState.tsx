/* eslint-disable @next/next/no-img-element */
import React from "react"
import { useAppStore } from "../store"
import { formatNumber } from "../helpers/format"
import { FaSpinner } from "react-icons/fa"
import { buildRepoHref } from "../helpers/urls"

const EmptyState: React.FC = () => {
    const store = useAppStore()

    const handleRepoClick = (e: React.MouseEvent, repoName: string) => {
        e.preventDefault()
        store.actions.setRepos([repoName])
    }

    return (
        <div className="w-full max-w-3xl 2xl:max-w-4xl mx-auto sm:px-4 mt-6 px-3">
            <div className="w-full">
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
                                    href={buildRepoHref(repo.name)}
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
