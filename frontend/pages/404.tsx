import Link from "next/link"

export default function NotFound() {
    return (
        <div className="relative w-full min-h-screen flex flex-col justify-center items-center">
            <p className="text-lg font-medium">404, Not Found.</p>
            <p className="text-sm text-neutral-500 mt-2">
                <Link href="/" className="link-action">Go to star-history</Link>
            </p>
        </div>
    )
}
