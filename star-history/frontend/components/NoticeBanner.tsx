import React from "react"

interface NoticeBannerProps {
    kind?: "warn" | "error"
    title?: string
    message: string
}

// Persistent, non-dismissable message banner. Unlike a toast it does not
// auto-dismiss and does not go away on click; it stays until the chart is
// reloaded or the underlying problem is resolved.
function NoticeBanner({ kind = "warn", title, message }: NoticeBannerProps) {
    const isError = kind === "error"
    return (
        <div
            className={`w-full my-3 px-4 py-3 text-sm rounded ${isError ? "bg-red-100 text-red-800 border-red-400" : "bg-amber-100 text-amber-800 border-amber-400"}`}
            style={{ borderWidth: "2px" }}
            role="alert"
        >
            {title && <div className="font-bold mb-1">{title}</div>}
            <div>{message}</div>
        </div>
    )
}

export default NoticeBanner
