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
    const [result, setResult] = useState<(RepoStats & { repo: string }) | null>(null)

    useEffect(() => {
        if (!repo) return
        let disposed = false
        getRepoData([repo])
            .then(({ data }) => {
                if (disposed) return
                const meta = data[0]?.meta ?? null
                setResult({
                    repo,
                    meta,
                    avatar: data[0]?.logoUrl ?? "",
                    loading: false,
                    error: meta ? null : "No stats available for this repo.",
                })
            })
            .catch(() => {
                if (!disposed) setResult({ repo, meta: null, avatar: "", loading: false, error: "Failed to load stats." })
            })
        return () => {
            disposed = true
        }
    }, [repo])

    // Never show the previous repo's trust notice or stats during navigation.
    return result?.repo === repo ? result : { meta: null, avatar: "", loading: repo !== null, error: null }
}
