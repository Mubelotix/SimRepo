import { useEffect, useState } from "react"
import { getSuspiciousStarRatio } from "@shared/common/chart"

export interface SuspiciousStarsState {
    ratio: number | null
    loading: boolean
}

export function useSuspiciousStars(repo: string | null): SuspiciousStarsState {
    const [ratio, setRatio] = useState<number | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        let disposed = false
        if (!repo) {
            setRatio(null)
            setLoading(false)
            return
        }
        setLoading(true)
        getSuspiciousStarRatio(repo)
            .then((r) => {
                if (disposed) return
                setRatio(r)
            })
            .catch(() => {
                if (disposed) return
                setRatio(null)
            })
            .finally(() => {
                if (!disposed) setLoading(false)
            })
        return () => {
            disposed = true
        }
    }, [repo])

    return { ratio, loading }
}
