import { useEffect, useState } from "react"
import { getRepoData } from "@shared/common/chart"
import type { RepoMeta } from "@shared/types/chart"

export interface RepoStats {
    meta: RepoMeta | null
    avatar: string
    loading: boolean
    error: string | null
}

export function useRepoStats(repo: string | null): RepoStats {
    const [meta, setMeta] = useState<RepoMeta | null>(null)
    const [avatar, setAvatar] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let disposed = false
        if (!repo) {
            setMeta(null)
            setAvatar("")
            setError(null)
            return
        }
        setLoading(true)
        setError(null)
        getRepoData([repo])
            .then(({ data }) => {
                if (disposed) return
                setMeta(data[0]?.meta ?? null)
                setAvatar(data[0]?.logoUrl ?? "")
                if (!data[0]?.meta) setError("No stats available for this repo.")
            })
            .catch(() => {
                if (disposed) return
                setError("Failed to load stats.")
            })
            .finally(() => {
                if (!disposed) setLoading(false)
            })
        return () => {
            disposed = true
        }
    }, [repo])

    return { meta, avatar, loading, error }
}
