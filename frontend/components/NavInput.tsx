import { useState } from "react"
import RepoSearchInput from "./RepoSearchInput"
import { GITHUB_REPO_URL_REG } from "../helpers/consts"
import { buildRepoHref } from "../helpers/urls"

export default function NavInput() {
    const [navInput, setNavInput] = useState("")

    const submit = () => {
        let raw = navInput.trim()
        if (!raw) return

        if (GITHUB_REPO_URL_REG.test(raw)) {
            const match = raw.match(GITHUB_REPO_URL_REG)
            if (match) raw = match[1]
        }

        const parts = raw.split("/").filter(Boolean)
        const name = parts.length === 1 ? `${parts[0]}/${parts[0]}` : `${parts[0]}/${parts[1]}`
        window.location.assign(buildRepoHref(name))
    }

    const navigateToRepo = (repoName: string) => {
        setNavInput(repoName)
        window.location.assign(buildRepoHref(repoName))
    }

    return (
        <div className="w-full max-w-2xl mb-4">
            <RepoSearchInput
                value={navInput}
                onChange={setNavInput}
                onSelect={navigateToRepo}
                onSubmit={submit}
                buttonLabel="Go"
            />
        </div>
    )
}
