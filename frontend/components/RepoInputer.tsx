import React, { useEffect, useState } from "react"
import { GITHUB_REPO_URL_REG } from "../helpers/consts"
import toast from "../helpers/toast"
import { useAppStore } from "../store"
import { SketchExternalLinkIcon } from "./SketchIcons"
import RepoSearchInput from "./RepoSearchInput"

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
            repo = rawRepo.split("#")[0] as string
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
            rawRepos = "Mubelotix/simrepo"
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

    const handleRepoSelect = (repoName: string) => {
        if (store.isFetching) {
            return
        }
        addRepos(repoName)
    }

    const handleRepoSubmit = () => {
        handleAddRepoBtnClick()
    }

    return (
        <div className="w-full px-3 shrink-0 flex flex-col justify-start items-center">
            <div className="w-auto sm:w-full grow max-w-3xl 2xl:max-w-4xl mt-4 relative">
                <RepoSearchInput
                    value={state.repo}
                    onChange={(value) => setState((prev) => ({ ...prev, repo: value }))}
                    onSelect={handleRepoSelect}
                    onSubmit={handleRepoSubmit}
                    placeholder={state.repos.length > 0 ? "...add next repository" : undefined}
                    buttonLabel="View star history"
                    className="shadow-inner border border-solid border-black rounded"
                    inputClassName="h-9 bg-transparent"
                />
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
