import { useState } from "react"
import { useRouter } from "next/router"
import RepoSearchInput from "./RepoSearchInput"
import { GITHUB_REPO_URL_REG } from "../helpers/consts"

export default function NavInput() {
    const router = useRouter()
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
        router.push(`/#${name}`)
    }

    const navigateToRepo = (repoName: string) => {
        setNavInput(repoName)
        router.push(`/#${repoName}`)
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