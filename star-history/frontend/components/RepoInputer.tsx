import React, { useEffect, useMemo, useRef, useState } from "react"
import { head } from "lodash"
import axios from "axios"
import { GITHUB_REPO_URL_REG } from "../helpers/consts"
import { REPO_DATA_API_URL } from "@shared/common/config"
import { formatNumber } from "../helpers/format"
import toast from "../helpers/toast"
import { useAppStore } from "../store"
import { SketchExternalLinkIcon } from "./SketchIcons"

interface Suggestion {
    name: string
    stars_total: number
}

interface State {
    repo: string
    repos: {
        name: string
        visible: boolean
    }[]
}

interface RepoInputerProps {
    isChartVisible: boolean
    setChartVisibility: React.Dispatch<React.SetStateAction<boolean>>
}

export default function RepoInputer({ setChartVisibility }: RepoInputerProps) {
    const store = useAppStore()
    const [state, setState] = useState<State>({
        repo: "",
        repos: []
    })

    const inputElRef = useRef<HTMLInputElement | null>(null)
    const containerRef = useRef<HTMLDivElement | null>(null)
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [suggestions, setSuggestions] = useState<Suggestion[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [highlightIndex, setHighlightIndex] = useState(-1)

    const randomPlaceholder = useMemo(() => {
        const examples = ["torvalds/linux", "jellyfin/jellyfin", "immich-app/immich", "bitcoin/bitcoin", "home-assistant/core", "nextcloud/server", "qbittorrent/qBittorrent", "aria2/aria2"]
        return examples[Math.floor(Math.random() * examples.length)]
    }, [])

    useEffect(() => {
        setChartVisibility(store.state.repos.length > 0)
    }, [store.state.repos, setChartVisibility])

    
    useEffect(() => {
        const hash = window.location.hash;
        if (hash) {
           
            const reposFromHash = hash.substring(1).split('&');
            setState(prev => ({ ...prev, repos: reposFromHash.map(name => ({ name, visible: true })) }));

        }
    }, []);

    

    // Sync local state when store repos change (e.g. from sidebar click)
    useEffect(() => {
        const localNames = state.repos.map(r => r.name)
        const newRepos = store.state.repos.filter(name => !localNames.includes(name))
        if (newRepos.length > 0) {
            setState(prev => ({
                ...prev,
                repos: [
                    ...prev.repos,
                    ...newRepos.map(name => ({ name, visible: true }))
                ]
            }))
        }
    }, [store.state.repos])

    useEffect(() => {
        const handleWatch = () => {
            for (const r of state.repos) {
                if (r.visible && !store.state.repos.includes(r.name)) {
                    setState((prev) => ({
                        ...prev,
                        repos: prev.repos.filter((repo) => repo.name !== r.name)
                    }))
                }
            }

            let hash = ""
            if (store.state.repos.length > 0) {
                const chartModeParam = store.state.chartMode === "Date" ? "date" : "timeline"
                hash = `#${store.state.repos.join("&")}&type=${chartModeParam}`
                if (store.state.useLogScale) {
                    hash += "&logscale"
                }
                hash += `&legend=${store.state.legendPosition}`
            }
            // Sync location hash only right here
            window.location.hash = hash
        }

        handleWatch()
    }, [store.state.repos, store.state.chartMode, store.state.useLogScale, store.state.legendPosition, state.repos])

    const addRepos = (rawRepos: string) => {
        for (const rawRepo of rawRepos.split(",")) {
            let repo = ""

            if (GITHUB_REPO_URL_REG.test(rawRepo)) {
                repo = (rawRepo.match(GITHUB_REPO_URL_REG) as string[])[1]
            }
            repo = head(rawRepo.split("#")) as string
            if (repo === "") {
                continue
            }

            if (GITHUB_REPO_URL_REG.test(repo)) {
                const regResult = GITHUB_REPO_URL_REG.exec(repo)
                if (regResult && regResult[1]) {
                    repo = regResult[1]
                }
            }

            const valueList = repo.split("/")
            if (valueList.length === 1) {
                repo = `${valueList[0]}/${repo}`
            } else if (valueList.length >= 2) {
                repo = `${valueList[0]}/${valueList[1]}`
            }

            for (const r of state.repos) {
                if (r.name === repo) {
                    if (r.visible) {
                        toast.warn(`Repo ${repo} is already on the chart`)
                    } else {
                        r.visible = true
                        store.actions.setRepos(state.repos.filter((r) => r.visible).map((r) => r.name))
                        setChartVisibility(true)
                    }
                    setState((prev) => ({ ...prev, repo: "" }))
                    return
                }
            }
            setState((prev) => ({
                ...prev,
                repos: [
                    ...prev.repos,
                    {
                        name: repo,
                        visible: true
                    }
                ]
            }))
            store.actions.addRepo(repo)
            setChartVisibility(true)
        }
        setState((prev) => ({ ...prev, repo: "" }))
    }

    const handleAddRepoBtnClick = () => {
        if (store.isFetching) {
            return
        }
        let rawRepos = state.repo
        if (rawRepos === "" && state.repos.length === 0) {
            rawRepos = "Mubelotix/star-history"
        }

        if (rawRepos === "") {
            toast.warn("Please input the repo name")
            return
        }

        addRepos(rawRepos)
    }

    const handleToggleRepoItemVisible = React.useCallback(
        (repo: string) => {
            const prevRepos = state.repos
            const newRepos = prevRepos.map((r) => (r.name === repo ? { ...r, visible: !r.visible } : r))
            setState((prev) => ({
                ...prev,
                repos: newRepos
            }))

            // Determine if any repo is visible
            const anyRepoVisible = newRepos.some((r) => r.visible)

            // Set the chart visibility based on whether any repo is visible
            setChartVisibility(anyRepoVisible)

            store.actions.setRepos(newRepos.filter((r) => r.visible).map((r) => r.name))
        },
        [state.repos, store.actions, setChartVisibility]
    )

    const handleDeleteRepoBtnClick = (repo: string) => {
        setState((prev) => ({
            ...prev,
            repos: prev.repos.filter((r) => r.name !== repo)
        }))
        store.actions.delRepo(repo)

        if (state.repos.length === 1) {
            setChartVisibility(false)
        }
    }

    const handleClearAllRepoBtnClick = () => {
        setState((prev) => ({
            ...prev,
            repos: []
        }))
        store.actions.setRepos([])
        setChartVisibility(false)
    }

    const handleInputerPasted = async (event: React.ClipboardEvent<HTMLInputElement>) => {
        if (!inputElRef.current) {
            return
        }
        const inputEl = inputElRef.current
        if (event.clipboardData) {
            event.preventDefault()
            const text = event.clipboardData.getData("text").replace(/(?:\r\n|\r|\n| )/g, "")
            const value = state.repo
            const prevStr = value.slice(0, Math.min(inputEl.selectionStart || 0, inputEl.selectionEnd || 0))
            const nextStr = value.slice(Math.max(inputEl.selectionStart || 0, inputEl.selectionEnd || 0))
            setState((prev) => ({ ...prev, repo: `${prevStr}${text}${nextStr}` }))
        }
    }

    const handleInputerKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault()
            if (showSuggestions && highlightIndex >= 0) {
                selectSuggestion(suggestions[highlightIndex].name)
            } else {
                handleAddRepoBtnClick()
            }
        } else if (showSuggestions) {
            switch (event.key) {
                case "ArrowDown":
                    event.preventDefault()
                    setHighlightIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev))
                    break
                case "ArrowUp":
                    event.preventDefault()
                    setHighlightIndex((prev) => (prev > 0 ? prev - 1 : prev))
                    break
                case "Escape":
                    event.preventDefault()
                    setShowSuggestions(false)
                    setHighlightIndex(-1)
                    break
            }
        }
    }

    const closeSuggestions = () => {
        setShowSuggestions(false)
        setHighlightIndex(-1)
    }

    const selectSuggestion = (repoName: string) => {
        closeSuggestions()
        if (store.isFetching) {
            return
        }
        addRepos(repoName)
    }

    const handleInputerChange = (value: string) => {
        setState((prev) => ({ ...prev, repo: value }))

        const query = value.trim()
        if (!query) {
            closeSuggestions()
            return
        }

        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current)
        }
        searchTimerRef.current = setTimeout(async () => {
            try {
                const { data } = await axios.get(`${REPO_DATA_API_URL}/repo-search`, {
                    params: { q: query, limit: 8 },
                    timeout: 5000,
                })
                const list = (data?.repos ?? []) as Suggestion[]
                setSuggestions(list)
                setShowSuggestions(list.length > 0)
                setHighlightIndex(-1)
            } catch {
                closeSuggestions()
            }
        }, 200)
    }

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                closeSuggestions()
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
            if (searchTimerRef.current) {
                clearTimeout(searchTimerRef.current)
            }
        }
    }, [])

    return (
        <div ref={containerRef} className="w-full px-3 shrink-0 flex flex-col justify-start items-center">
            <div className="w-auto sm:w-full grow max-w-3xl 2xl:max-w-4xl mt-4 relative">
                <div className="flex flex-row justify-center items-center shadow-inner border border-solid border-black rounded">
                    <input
                        ref={inputElRef}
                        value={state.repo}
                        onChange={(e) => handleInputerChange(e.target.value)}
                        onFocus={() => {
                            if (suggestions.length > 0) setShowSuggestions(true)
                        }}
                        className="w-auto h-9 px-2 grow shrink text-dark outline-none rounded rounded-r-none placeholder:text-gray-300 focus:shadow-focus"
                        type="text"
                        placeholder={state.repos.length > 0 ? "...add next repository" : randomPlaceholder}
                        onPaste={handleInputerPasted}
                        onKeyDown={handleInputerKeyDown}
                    />
                    <button
                        className={`h-9 pl-4 pr-4 whitespace-nowrap w-auto text-black border-l border-black hover:bg-zinc-700 hover:text-white ${store.isFetching ? "cursor-wait" : ""}`}
                        onClick={handleAddRepoBtnClick}
                    >
                        View star history
                    </button>
                </div>
                {showSuggestions && suggestions.length > 0 && (
                    <ul
                        role="listbox"
                        className="absolute z-20 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden"
                    >
                        {suggestions.map((suggestion, i) => (
                            <li
                                role="option"
                                aria-selected={i === highlightIndex}
                                key={suggestion.name}
                                onMouseDown={(e) => {
                                    e.preventDefault()
                                    selectSuggestion(suggestion.name)
                                }}
                                onMouseEnter={() => setHighlightIndex(i)}
                                className={`flex items-center justify-between px-4 py-2 text-sm cursor-pointer ${
                                    i === highlightIndex ? "bg-neutral-100" : "hover:bg-neutral-50"
                                }`}
                            >
                                <span className="text-neutral-800 truncate">{suggestion.name}</span>
                                {suggestion.stars_total > 0 && (
                                    <span className="text-neutral-400 text-xs ml-2 shrink-0">
                                        &#9733; {formatNumber(suggestion.stars_total)}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {state.repos.length === 0 && (
                <div className="w-full mt-8 mb-2 flex flex-row justify-center items-center">
                    <span className="text-sm text-gray-400">☝️ Enter a GitHub repo name to get started</span>
                </div>
            )}
            {state.repos.length > 0 && (
                <div className="w-full mt-4 flex flex-row justify-center items-center">
                    <div className="w-full max-w-2xl flex flex-row flex-wrap justify-center items-center">
                        {state.repos.map((item) => (
                        <div key={item.name} className="leading-8 px-3 pr-2 mb-2 text-dark rounded flex flex-row justify-center items-center border mr-3 last:mr-0">
                            <span className="relative w-3 h-3 mr-1 flex flex-row justify-center items-center cursor-pointer hover:opacity-60" onClick={() => handleDeleteRepoBtnClick(item.name)}>
                                <span className="w-3 rotate-45 h-px bg-[black] absolute top-1/2"></span>
                                <span className="w-3 -rotate-45 h-px bg-black absolute top-1/2"></span>
                            </span>
                            <span
                                className={`mr-1 cursor-pointer hover:line-through select-none ${item.visible ? "" : "line-through text-gray-400"}`}
                                onClick={() => handleToggleRepoItemVisible(item.name)}
                            >
                                {item.name}
                            </span>
                            <a href={`https://github.com/${item.name}`} target="_blank" className="flex items-center text-gray-400 hover:text-green-600">
                                <SketchExternalLinkIcon />
                            </a>
                        </div>
                    ))}
                    <button className="leading-8 mb-2 text-black hover:bg-gray-100 px-3 rounded border border-transparent" onClick={handleClearAllRepoBtnClick}>
                        Clear all
                    </button>
                </div>
            </div>
        )}
        </div>
    )
}
