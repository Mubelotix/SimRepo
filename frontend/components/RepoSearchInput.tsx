import React, { useEffect, useRef, useState } from "react"
import { REPO_DATA_API_URL } from "@shared/common/config"
import { formatNumber } from "../helpers/format"

export interface Suggestion {
    name: string
    stars_total: number
}

export const REPO_SEARCH_EXAMPLES = [
    "linux",
    "jellyfin",
    "immich",
    "bitcoin",
    "home-assistant",
    "nextcloud",
    "qbittorrent",
    "aria2",
]

const randomExample = () => REPO_SEARCH_EXAMPLES[Math.floor(Math.random() * REPO_SEARCH_EXAMPLES.length)]

interface RepoSearchInputProps {
    value: string
    onChange: (value: string) => void
    onSelect: (repoName: string) => void
    onSubmit: () => void
    placeholder?: string
    buttonLabel?: string
    className?: string
    inputClassName?: string
}

export default function RepoSearchInput({
    value,
    onChange,
    onSelect,
    onSubmit,
    placeholder,
    buttonLabel,
    className = "",
    inputClassName = "",
}: RepoSearchInputProps) {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [highlightIndex, setHighlightIndex] = useState(-1)
    const [randomPlaceholder] = useState(randomExample)
    const containerRef = useRef<HTMLDivElement>(null)
    const inputElRef = useRef<HTMLInputElement>(null)
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const closeSuggestions = () => {
        setShowSuggestions(false)
        setHighlightIndex(-1)
    }

    const selectSuggestion = (repoName: string) => {
        closeSuggestions()
        onSelect(repoName)
    }

    const runSearch = (value: string) => {
        const query = value.trim()
        if (!query) {
            setSuggestions([])
            closeSuggestions()
            return
        }

        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current)
        }
        searchTimerRef.current = setTimeout(async () => {
            try {
                const res = await fetch(
                    `${REPO_DATA_API_URL}/repo-search?q=${encodeURIComponent(query)}&limit=8`,
                    { signal: AbortSignal.timeout(5000) }
                )
                const data = await res.json()
                const list = (data?.repos ?? []) as Suggestion[]
                setSuggestions(list)
                setShowSuggestions(list.length > 0)
                setHighlightIndex(-1)
            } catch {
                closeSuggestions()
            }
        }, 200)
    }

    const handleInputChange = (value: string) => {
        onChange(value)
        runSearch(value)
    }

    const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
        const inputEl = inputElRef.current
        if (!inputEl) return
        event.preventDefault()
        const text = event.clipboardData.getData("text").replace(/(?:\r\n|\r|\n| )/g, "")
        const prevStr = value.slice(0, Math.min(inputEl.selectionStart || 0, inputEl.selectionEnd || 0))
        const nextStr = value.slice(Math.max(inputEl.selectionStart || 0, inputEl.selectionEnd || 0))
        const combined = `${prevStr}${text}${nextStr}`
        onChange(combined)
        runSearch(combined)
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (!showSuggestions) {
            if (event.key === "Enter") onSubmit()
            return
        }

        switch (event.key) {
            case "ArrowDown":
                event.preventDefault()
                setHighlightIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev))
                break
            case "ArrowUp":
                event.preventDefault()
                setHighlightIndex((prev) => (prev > 0 ? prev - 1 : -1))
                break
            case "Enter":
                event.preventDefault()
                if (highlightIndex >= 0) {
                    selectSuggestion(suggestions[highlightIndex].name)
                } else {
                    onSubmit()
                }
                break
            case "Escape":
                closeSuggestions()
                break
        }
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
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
        }
    }, [])

    const displayPlaceholder = placeholder ?? randomPlaceholder

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <div className="flex items-center rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden">
                <input
                    ref={inputElRef}
                    type="text"
                    value={value}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    onFocus={() => {
                        if (suggestions.length > 0) setShowSuggestions(true)
                    }}
                    placeholder={displayPlaceholder}
                    className={`flex-1 h-10 px-4 text-sm outline-none placeholder:text-neutral-400 box-border max-w-full ${inputClassName}`}
                />
                <button
                    onClick={onSubmit}
                    className="h-10 px-4 text-sm text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 border-l border-neutral-200 transition-colors"
                >
                    {buttonLabel ?? "View star history"}
                </button>
            </div>
            {showSuggestions && suggestions.length > 0 && (
                <ul role="listbox" className="absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden">
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
    )
}