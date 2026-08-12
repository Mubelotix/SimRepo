import { useState, useEffect } from "react"
import { useAppStore } from "../store"
import utils from "@shared/common/utils"
import toast from "../helpers/toast"
import { SketchStarIcon } from "./SketchIcons"
import { SITE_URL } from "../helpers/consts"

const EmbedChart: React.FC = () => {
    const store = useAppStore()
    const [singleRepo, setSingleRepo] = useState<string | null>(null)

    useEffect(() => {
        setSingleRepo(store.repos.length === 1 ? store.repos[0] : null)
    }, [store.repos])

    const repoText = singleRepo ? singleRepo.split("/")[1] : "your repository's"

    const buildQueryParams = (theme?: string) => {
        const type = store.chartMode === "Date" ? "date" : "timeline"
        let params = `repos=${store.repos.join(",")}`
        if (type === "timeline") params += `&type=timeline`
        if (theme) params += `&theme=${theme}`
        if (store.useLogScale) params += `&logscale`
        if (store.legendPosition === "bottom-right") params += `&legend=bottom-right`
        return params
    }

    const buildLink = () => {
        const parts = [...store.repos]
        if (store.chartMode === "Timeline") parts.push("type=timeline")
        if (store.useLogScale) parts.push("logscale")
        if (store.legendPosition === "bottom-right") parts.push("legend=bottom-right")
        return parts.join("&")
    }

    const currentUrl =
        typeof window !== "undefined" ? `${window.location.href.split("#")[0]}#${buildLink()}` : ""
    const svgUrl = `${SITE_URL}/svg?${buildQueryParams()}`
    const darkSvgUrl = `${SITE_URL}/svg?${buildQueryParams("dark")}`

    const embedCode = `## Star History\n\n[![Star History Chart](${svgUrl})](${currentUrl})`

    const embedDarkModeCode = `## Star History\n\n<a href="${currentUrl}">\n <picture>\n   <source media="(prefers-color-scheme: dark)" srcset="${darkSvgUrl}" />\n   <source media="(prefers-color-scheme: light)" srcset="${svgUrl}" />\n   <img alt="Star History Chart" src="${svgUrl}" />\n </picture>\n</a>`

    const handleCopyBtnClick = () => {
        utils.copyTextToClipboard(embedCode)
        toast.succeed("Embed markdown code copied")
    }

    const handleDarkModeCopyBtnClick = () => {
        utils.copyTextToClipboard(embedDarkModeCode)
        toast.succeed("Embed markdown code copied")
    }

    const punct = (s: string) => <span className="md-punct">{s}</span>
    const tag = (s: string) => <span className="md-tag">{s}</span>
    const attr = (s: string) => <span className="md-attr">{s}</span>
    const str = (s: string) => <span className="md-string">{s}</span>

    const lightCode = (
        <>
            <span className="md-heading">## Star History</span>
            {"\n\n"}
            {punct("[")}
            {punct("![")}
            <span className="md-alt">Star History Chart</span>
            {punct("]")}
            {punct("(")}
            <span className="md-url">{svgUrl}</span>
            {punct(")")}
            {punct("]")}
            {punct("(")}
            <span className="md-url">{currentUrl}</span>
            {punct(")")}
        </>
    )

    const darkCode = (
        <>
            <span className="md-heading">## Star History</span>
            {"\n\n"}
            {tag("<a ")}
            {attr("href")}
            {tag("=")}
            {str(`"${currentUrl}"`)}
            {tag(">")}
            {"\n "}
            {tag("<picture>")}
            {"\n   "}
            {tag("<source ")}
            {attr("media")}
            {tag("=")}
            {str(`"(prefers-color-scheme: dark)"`)}
            {tag(" ")}
            {attr("srcset")}
            {tag("=")}
            {str(`"${darkSvgUrl}"`)}
            {tag(" />")}
            {"\n   "}
            {tag("<source ")}
            {attr("media")}
            {tag("=")}
            {str(`"(prefers-color-scheme: light)"`)}
            {tag(" ")}
            {attr("srcset")}
            {tag("=")}
            {str(`"${svgUrl}"`)}
            {tag(" />")}
            {"\n   "}
            {tag("<img ")}
            {attr("alt")}
            {tag("=")}
            {str(`"Star History Chart"`)}
            {tag(" ")}
            {attr("src")}
            {tag("=")}
            {str(`"${svgUrl}"`)}
            {tag(" />")}
            {"\n "}
            {tag("</picture>")}
            {"\n"}
            {tag("</a>")}
        </>
    )

    const CodeBlock: React.FC<{ title: string; onCopy: () => void; children: React.ReactNode }> = ({ title, onCopy, children }) => (
        <div className="w-full bg-gray-100 text-dark rounded-md shadow overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
                <span className="font-mono text-sm font-semibold text-gray-600">{title}</span>
                <button type="button" className="px-4 py-1.5 rounded-md cursor-pointer font-mono text-sm text-dark bg-gray-200 hover:bg-gray-300" onClick={onCopy}>
                    <span className="inline-block translate-y-[2px]">Copy</span>
                </button>
            </div>
            <pre className="w-full p-4 font-mono break-all whitespace-pre-wrap text-sm">
                <code>{children}</code>
            </pre>
        </div>
    )

    return (
        <div className="w-full h-auto mb-12 px-3 mx-auto max-w-4xl flex flex-col justify-start items-center">
            <p className="leading-8 mb-3">
                <SketchStarIcon size={18} /> Show real-time chart on {repoText}{" "}
                {singleRepo ? (
                    <a className="link-mono" href={`https://github.com/${singleRepo}/blob/HEAD/README.md`} target="_blank">
                        README.md
                    </a>
                ) : (
                    <span className="font-mono text-gray-500">README.md</span>
                )}{" "}
                with the following code (
                <a className="link-mono" href="https://github.com/Mubelotix/star-history?tab=readme-ov-file#sparkles-star-history-sparkles" target="_blank">
                    example
                </a>
                ):
            </p>
            <div className="w-full flex flex-col gap-8">
                <CodeBlock title="Dynamic Theme" onCopy={handleDarkModeCopyBtnClick}>
                    {darkCode}
                </CodeBlock>
                <CodeBlock title="Light theme" onCopy={handleCopyBtnClick}>
                    {lightCode}
                </CodeBlock>
            </div>
        </div>
    )
}

export default EmbedChart