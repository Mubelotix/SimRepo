import React, { useEffect, useState } from "react"
import { SketchGitHubIcon } from "./SketchIcons"

const GitHubStarButton = () => {
    const [starCount, setStarCount] = useState<number | null>(null)

    useEffect(() => {
        const getRepoStarCount = async () => {
            try {
                const res = await fetch(`https://api.github.com/repos/Mubelotix/simrepo`, {
                    headers: {
                        Accept: "application/vnd.github.v3.star+json",
                    }
                })
                const data = await res.json()
                setStarCount(data.stargazers_count)
            } catch (error) {
                console.error('Failed to fetch GitHub star', error)
            }
        }

        getRepoStarCount()
    }, [])

    return (
        <a
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            href="https://github.com/Mubelotix/simrepo"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Star Mubelotix/simrepo on GitHub"
            style={{ fontFamily: '"xkcd", cursive' }}
        >
            <SketchGitHubIcon />
            {starCount !== null && (
                <span className="text-lg">{starCount.toLocaleString()}</span>
            )}
        </a>
    )
}

export default GitHubStarButton
