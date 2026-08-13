import { useEffect } from "react"
import { useRouter } from "next/router"
import Link from "next/link"
import PageShell from "../components/PageShell"

// The dedicated /:owner/:repo pages were removed in favor of the single homepage
// app, which shows any repo on the fly via hash URLs (#owner/repo). Old path URLs
// are redirected here client-side so existing links keep working.
export default function NotFound() {
    const router = useRouter()
    const pathname = router.asPath.split("?")[0].split("#")[0]
    const segments = pathname.split("/").filter(Boolean)

    const isRepoPath = segments.length === 2 && !segments[0].startsWith("_")

    useEffect(() => {
        if (isRepoPath) {
            const target = `/#${segments[0]}/${segments[1]}`
            if (window.location.hash !== target.split("#")[1]) {
                window.location.replace(target)
            }
        }
    }, [isRepoPath, pathname])

    if (isRepoPath) {
        // Keep rendering something minimal while the redirect happens.
        return (
            <PageShell>
                <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden">
                    <div className="px-5 py-16 text-center">
                        <p className="text-4xl mb-3" role="img" aria-label="Redirecting">🔭</p>
                        <h1 className="text-lg font-semibold text-neutral-800">Redirecting…</h1>
                        <p className="text-sm text-neutral-500 mt-2">
                            This repository page has moved to the star history app.
                        </p>
                    </div>
                </div>
            </PageShell>
        )
    }

    return (
        <div className="relative w-full min-h-screen flex flex-col justify-center items-center">
            <p className="text-lg font-medium">404, Not Found.</p>
            <p className="text-sm text-neutral-500 mt-2">
                <Link href="/" className="link-action">Go to star-history</Link>
            </p>
        </div>
    )
}