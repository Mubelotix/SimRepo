import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/router"
import axios from "axios"
import { GITHUB_REPO_URL_REG } from "../helpers/consts"
import { REPO_DATA_API_URL } from "@shared/common/config"
import { formatNumber } from "../helpers/format"

interface Suggestion {
    name: string
    stars_total: number
}

export default function NavInput() {
    const router = useRouter()
    const [navInput, setNavInput] = useState("")
    const [results, setResults] = useState<Suggestion[]>([])
    const [highlightIndex, setHighlightIndex] = useState(-1)
    const [showDropdown, setShowDropdown] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const handleNavSubmit = () => {
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

    const closeDropdown = () => {
        setShowDropdown(false)
        setHighlightIndex(-1)
    }

    const navigateToRepo = (repoName: string) => {
        setNavInput(repoName)
        closeDropdown()
        router.push(`/#${repoName}`)
    }

    const handleInputChange = (value: string) => {
        setNavInput(value)
        const query = value.trim().toLowerCase()
        if (!query) {
            setResults([])
            closeDropdown()
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
                setResults((data?.repos ?? []) as Suggestion[])
                setShowDropdown((data?.repos?.length ?? 0) > 0)
                setHighlightIndex(-1)
            } catch {
                closeDropdown()
            }
        }, 200)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showDropdown) {
            if (e.key === "Enter") handleNavSubmit()
            return
        }

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault()
                setHighlightIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev))
                break
            case "ArrowUp":
                e.preventDefault()
                setHighlightIndex((prev) => (prev > 0 ? prev - 1 : -1))
                break
            case "Enter":
                e.preventDefault()
                if (highlightIndex >= 0) {
                    navigateToRepo(results[highlightIndex].name)
                } else {
                    handleNavSubmit()
                }
                break
            case "Escape":
                closeDropdown()
                break
        }
    }

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                closeDropdown()
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
        }
    }, [])

    return (
        <div ref={containerRef} className="w-full max-w-2xl mb-4 relative">
            <div className="flex items-center rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden">
                <input
                    type="text"
                    value={navInput}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        if (results.length > 0) setShowDropdown(true)
                    }}
                    placeholder="star-history or Mubelotix/simrepo or https://github.com/Mubelotix/simrepo"
                    className="flex-1 h-10 px-4 text-sm outline-none placeholder:text-neutral-400"
                />
                <button
                    onClick={handleNavSubmit}
                    className="h-10 px-4 text-sm text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 border-l border-neutral-200 transition-colors"
                >
                    Go
                </button>
            </div>
            {showDropdown && results.length > 0 && (
                <ul role="listbox" className="absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden">
                    {results.map((repo, i) => (
                        <li
                            role="option"
                            aria-selected={i === highlightIndex}
                            key={repo.name}
                            onMouseDown={(e) => {
                                e.preventDefault()
                                navigateToRepo(repo.name)
                            }}
                            onMouseEnter={() => setHighlightIndex(i)}
                            className={`flex items-center justify-between px-4 py-2 text-sm cursor-pointer ${
                                i === highlightIndex ? "bg-neutral-100" : "hover:bg-neutral-50"
                            }`}
                        >
                            <span className="text-neutral-800 truncate">{repo.name}</span>
                            <span className="text-neutral-400 text-xs ml-2 shrink-0">
                                &#9733; {formatNumber(repo.stars_total)}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
