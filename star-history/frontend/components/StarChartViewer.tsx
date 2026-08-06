/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useRef } from "react"
import StarXYChart from "./Charts/StarXYChart"
import TokenSettingDialog from "./TokenSettingDialog"
import GenerateEmbedCodeDialog from "./GenerateEmbedCodeDialog"
import EmbedMarkdownSection from "./EmbedMarkdownSection"
import { useAppStore } from "store"
import { FaSpinner } from "react-icons/fa"
import { XYChartData } from "@shared/packages/xy-chart"
import { convertDataToChartData, getRepoData } from "@shared/common/chart"
import toast from "helpers/toast"
import { RepoData, LegendPosition } from "@shared/types/chart"
import NoticeBanner from "./NoticeBanner"

interface Notice {
    kind: "warn" | "error"
    title?: string
    message: string
}

const VALID_LEGEND_POSITIONS: LegendPosition[] = ["top-left", "bottom-right"]
import utils from "@shared/common/utils"

interface State {
    chartMode: "Date" | "Timeline"
    useLogScale: boolean
    legendPosition: LegendPosition
    repoCacheMap: Map<
        string,
        {
            starData: {
                date: string
                count: number
            }[]
            logoUrl: string
        }
    >
    chartData: XYChartData | undefined
    isGeneratingImage: boolean
    showSetTokenDialog: boolean
    showGenEmbedCodeDialog: boolean
    showEmbedCodeDialog: boolean
}

interface StarChartViewerProps {
    compact?: boolean
}

function StarChartViewer({ compact = false }: StarChartViewerProps) {
    const store = useAppStore()

    const [state, setState] = useState<State>({
        chartMode: "Date",
        useLogScale: false,
        legendPosition: "top-left",
        repoCacheMap: new Map(),
        chartData: undefined,
        isGeneratingImage: false,
        showEmbedCodeDialog: false,
        showSetTokenDialog: false,
        showGenEmbedCodeDialog: false,
    })

    const [notice, setNotice] = useState<Notice | null>(null)

    const containerElRef = useRef<HTMLDivElement>(null)

    const fetchReposData = React.useCallback(
        async (repos: string[]) => {
            store.actions.setIsFetching(true)
            const notCachedRepos = repos.filter((repo) => !state.repoCacheMap.get(repo))

            try {
                const { data, missing } = await getRepoData(notCachedRepos)
                for (const repo of missing) {
                    store.actions.delRepo(repo)
                }
                setState((prevState) => {
                    const repoCacheMap = new Map(prevState.repoCacheMap)
                    for (const { repo, starRecords, logoUrl } of data) {
                        repoCacheMap.set(repo, { starData: starRecords, logoUrl })
                    }
                    return { ...prevState, repoCacheMap }
                })
                if (missing.length > 0) {
                    setNotice({
                        kind: "warn",
                        title: "Some repositories couldn't be displayed",
                        message:
                            `Sorry, we don't have enough star-history data for: ${missing.join(", ")}. ` +
                            "Please double-check that the name is spelled correctly, or that the repo has enough activity.",
                    })
                } else if (notCachedRepos.length > 0) {
                    // A fresh, fully-successful fetch clears any previous persistent notice.
                    setNotice(null)
                }
            } catch (error: any) {
                const isRateLimited = error?.response?.status === 429
                const message =
                    isRateLimited && error?.response?.data
                        ? error.response.data
                        : error?.message ?? "Something went wrong while loading the chart."
                setNotice({
                    kind: "error",
                    title: isRateLimited ? "You've been rate limited" : "Unable to load data",
                    message,
                })
            }
            store.actions.setIsFetching(false)
        },
        [state.repoCacheMap, store]
    )

    // Recompute the chart from the cached repo data whenever the repo list, display
    // mode, or cache changes. No network request here.
    useEffect(() => {
        const repoData: RepoData[] = []
        for (const repo of store.repos) {
            const cachedRepo = state.repoCacheMap.get(repo)
            if (cachedRepo) {
                repoData.push({
                    repo,
                    starRecords: cachedRepo.starData,
                    logoUrl: cachedRepo.logoUrl,
                })
            }
        }
        setState((prevState) => ({
            ...prevState,
            chartData:
                repoData.length === 0
                    ? undefined
                    : convertDataToChartData(repoData, state.chartMode, { insertZeroPoint: true }),
        }))
    }, [store.repos, state.chartMode, state.repoCacheMap])

    // Fetch repo data when the repo list changes (and on mount). The store already
    // parses the URL hash into store.repos, so this is the single source of fetches;
    // fetchReposData skips the network for already-cached repos.
    useEffect(() => {
        if (store.repos.length > 0) {
            fetchReposData(store.repos)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [store.repos])

    // Keep local display options (chartMode/legend/logscale) in sync with the URL
    // hash without triggering a refetch. Switching modes re-transforms cached data
    // (fetchReposData only hits the network for repos not yet in the cache).
    useEffect(() => {
        const syncFromHash = () => {
            const hash = window.location.hash
            const alignTimeline = hash.includes("timeline") || hash.includes("Timeline")
            const useLogScale = hash.includes("logscale") || hash.includes("LogScale")

            let legendPosition: LegendPosition = "top-left"
            const legendRegex = new RegExp(`legend=(${VALID_LEGEND_POSITIONS.join("|")})`)
            const legendMatch = hash.match(legendRegex)
            if (legendMatch) {
                const position = legendMatch[1] as LegendPosition
                if (VALID_LEGEND_POSITIONS.includes(position)) {
                    legendPosition = position
                }
            }

            setState(prev => ({
                ...prev,
                chartMode: alignTimeline ? "Timeline" : "Date",
                useLogScale,
                legendPosition,
            }))
        }

        syncFromHash()

        window.addEventListener("hashchange", syncFromHash)
        return () => window.removeEventListener("hashchange", syncFromHash)
    }, [])

    const handleCopyLinkBtnClick = async () => {
        try {
            await utils.copyTextToClipboard(window.location.href)
            toast.succeed("Link copied")
        } catch (error) {
            console.error("Error copying link:", error)
            toast.error("Failed to copy link")
        }
    }

    const handleGenerateImageBtnClick = async () => {
        if (state.isGeneratingImage) {
            return
        }

        const svgElement = containerElRef.current?.querySelector("svg")?.cloneNode(true) as SVGSVGElement
        svgElement.querySelectorAll(".chart-tooltip-dot").forEach((d) => d.remove())
        svgElement.querySelectorAll(".browser-only").forEach((d) => d.remove())
        // convert images from url href to data url href
        for (const i of Array.from(svgElement.querySelectorAll("image"))) {
            const url = i.getAttribute("href")
            if (url) {
                const dataUrl = await utils.getBase64Image(url)
                i.setAttribute("href", dataUrl)
            }
        }
        svgElement.setAttribute("class", "fixed -z-10")
        document.body.append(svgElement)

        if (!svgElement || !containerElRef.current) {
            toast.warn("Chart element not found, please try later")
            return
        }

        state.isGeneratingImage = true

        let destoryGeneratingToast = () => {
            // do nth
        }
        setTimeout(() => {
            if (state.isGeneratingImage) {
                const cbs = toast.warn(`<i class="fas fa-spinner animate-spin text-2xl mr-3"></i>Generating image`, -1)
                destoryGeneratingToast = cbs.destroy
            }
        }, 2000)

        try {
            // Get image's width and height from the container, because the svg's width is set to 100%
            const { width: imgWidth, height: imgHeight } = containerElRef.current.getBoundingClientRect()
            const canvas = document.createElement("canvas")
            const scale = Math.floor(window.devicePixelRatio * 2)
            canvas.width = (imgWidth + 20) * scale
            canvas.height = (imgHeight + 30) * scale
            const ctx = canvas.getContext("2d")
            if (!ctx) {
                toast.warn("Get canvas context failed.")
                return
            }
            ctx.fillStyle = "white"
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            // draw chart image
            const chartDataURL = utils.convertSVGToDataURL(svgElement)
            const chartImage = new Image()
            chartImage.src = chartDataURL
            await utils.waitImageLoaded(chartImage)
            ctx.drawImage(chartImage, 10 * scale, 10 * scale, imgWidth * scale, imgHeight * scale)

            const link = document.createElement("a")
            link.download = `star-history-${utils.getDateString(Date.now(), "yyyyMMdd")}.png`
            link.href = canvas.toDataURL()
            link.click()
            state.isGeneratingImage = false
            destoryGeneratingToast()
            toast.succeed("Image Downloaded")
        } catch (error) {
            console.error(error)
            toast.error("Generate image failed")
        }
        svgElement.remove()
    }

    const getShareContent = () => {
        const repos = store.repos

        if (repos.length === 0) {
            toast.error("No repo found")
            return null
        }

        const starhistoryLink = window.location.href
        let title = ""
        let text = ""

        if (repos.length === 1) {
            const repo = repos[0]
            const cached = state.repoCacheMap.get(repo)
            const records = cached?.starData ?? []
            const starCount = records.length > 0 ? records[records.length - 1].count : 0

            let starText = ""
            if (starCount > 0) {
                starText = `${starCount < 1000 ? starCount : (starCount / 1000).toFixed(1) + "K"} ⭐️`
            }

            title = `${starText} ${repo} star history`
            text = `${starText} Thank you! 🙏%0A${encodeURIComponent(starhistoryLink)}%0A%0A`
        } else {
            title = "GitHub star history across multiple repos"
            text = `Check out my GitHub star history across multiple repos: ${encodeURIComponent(starhistoryLink)}%0A%0A`
        }

        const addtionLink = repos.length === 1 ? `github.com/${repos[0]}` : encodeURIComponent(starhistoryLink)
        text += `${addtionLink}%0A%0A`
        text += `${encodeURIComponent("#starhistory #GitHub #OpenSource ")} via @StarHistoryHQ`

        return { title, url: starhistoryLink, text }
    }

    const handleLemmyShareBtnClick = () => {
        const content = getShareContent()
        if (!content) return

        window.open(
            `https://lemmy.ml/create_post?url=${encodeURIComponent(content.url)}&title=${encodeURIComponent(content.title)}`,
            "_blank"
        )
    }

    const handleMastodonShareBtnClick = () => {
        const content = getShareContent()
        if (!content) return

        window.open(`https://mastodon.social/share?text=${content.text}`, "_blank")
    }

    const handleGenerateCSVBtnClick = () => {
        if (state.chartData) {
            const currentDate = new Date()
            const formattedDate = `${currentDate.getFullYear()}${currentDate.getMonth() + 1}${currentDate.getDate()}`
            const filename = `star-history-${formattedDate}.csv`

            const csvContent =
                "data:text/csv;charset=utf-8," +
                state.chartData.datasets.reduce((acc: string, dataset: any) => {
                    dataset.data.forEach((dataPoint: any) => {
                        acc += `${dataset.label},${new Date(dataPoint.x).toString()},${dataPoint.y}\n`
                    })
                    return acc
                }, "Repository,Date,Stars\n")

            const encodedUri = encodeURI(csvContent)
            const link = document.createElement("a")
            link.setAttribute("href", encodedUri)
            link.setAttribute("download", filename)
            document.body.appendChild(link)
            link.click()
            toast.succeed("CSV Downloaded")
            document.body.removeChild(link)
        } else {
            toast.error("No chart data available to export")
        }
    }

    const handleGenEmbedCodeDialogBtnClick = () => {
        setState((prevState) => ({ ...prevState, showEmbedCodeDialog: true }))
    }

    const handleGenEmbedCodeDialogClose = () => {
        setState((prevState) => ({ ...prevState, showEmbedCodeDialog: false }))
    }

    const handleToggleChartBtnClick = React.useCallback(() => {
        const newChartMode = state.chartMode === "Date" ? "Timeline" : "Date"
        store.actions.setChartMode(newChartMode)
        setState((prevState) => {
            return { ...prevState, chartMode: newChartMode }
        })
    }, [state.chartMode, store.actions])

    const handleToggleLogScaleBtnClick = React.useCallback(() => {
        const newUseLogScale = !state.useLogScale
        store.actions.setUseLogScale(newUseLogScale)
        setState((prevState) => {
            return { ...prevState, useLogScale: newUseLogScale }
        })
    }, [state.useLogScale, store.actions])

    const handleLegendPositionChange = React.useCallback((position: LegendPosition) => {
        store.actions.setLegendPosition(position)
        setState((prevState) => {
            return { ...prevState, legendPosition: position }
        })
    }, [store.actions])

    const handleSetTokenDialogClose = () => {
        setState((prevState) => ({ ...prevState, showSetTokenDialog: false }))
    }
    return (
        <>
            <div className="w-full max-w-3xl 2xl:max-w-4xl mx-auto sm:px-4">
                {notice && <NoticeBanner kind={notice.kind} title={notice.title} message={notice.message} />}
            </div>
            <div ref={containerElRef} className="relative w-full h-auto min-h-400px self-center max-w-3xl 2xl:max-w-4xl sm:p-4 pt-0">
                {store.isFetching && (
                    <div className="absolute w-full h-full flex justify-center items-center z-10 top-0">
                        <div className="absolute w-full h-full blur-md bg-white bg-opacity-80"></div>
                        <FaSpinner className="animate-spin text-4xl z-10" />
                    </div>
                )}
                {!compact && state.chartData && (
                    <>
                        <div className="absolute top-0 left-1 p-2 flex flex-row">
                            <div className="flex flex-row justify-center items-center rounded leading-8 text-sm px-3 z-10 text-dark select-none">
                                <span className="mr-2">Legend</span>
                                <label className="mr-2 cursor-pointer hover:opacity-80 flex items-center">
                                    <input
                                        className="mr-1"
                                        type="radio"
                                        name="legendPosition"
                                        checked={state.legendPosition === "top-left"}
                                        onChange={() => handleLegendPositionChange("top-left")}
                                    />
                                    Top left
                                </label>
                                <label className="cursor-pointer hover:opacity-80 flex items-center">
                                    <input
                                        className="mr-1"
                                        type="radio"
                                        name="legendPosition"
                                        checked={state.legendPosition === "bottom-right"}
                                        onChange={() => handleLegendPositionChange("bottom-right")}
                                    />
                                    Bottom right
                                </label>
                            </div>
                        </div>
                        <div className="absolute top-0 right-1 p-2 flex flex-row">
                            <div
                                className="flex flex-row justify-center items-center rounded leading-8 text-sm px-3 cursor-pointer z-10 text-dark select-none hover:bg-gray-100"
                                onClick={handleToggleLogScaleBtnClick}
                            >
                                <input className="mr-2" type="checkbox" checked={state.useLogScale} />
                                Log scale
                            </div>
                            <div
                                className="flex flex-row justify-center items-center rounded leading-8 text-sm px-3 cursor-pointer z-10 text-dark select-none hover:bg-gray-100"
                                onClick={handleToggleChartBtnClick}
                            >
                                <input className="mr-2" type="checkbox" checked={state.chartMode === "Timeline"} />
                                {state.chartMode === "Timeline" ? "Align timeline" : "Align timeline"}
                            </div>
                        </div>
                    </>
                )}
                <div id="capture">{state.chartData && state.chartData.datasets.length > 0 && <StarXYChart classname={`w-full h-auto ${compact ? "" : "mt-6"}`} data={state.chartData} chartMode={state.chartMode} useLogScale={state.useLogScale} legendPosition={state.legendPosition} />}</div>
                {/* ... rest of the JSX here */}
                {state.showSetTokenDialog && (
                    <TokenSettingDialog
                        onClose={handleSetTokenDialogClose}
                        show={state.showSetTokenDialog}
                    />
                )}

                {state.showEmbedCodeDialog && <GenerateEmbedCodeDialog onClose={handleGenEmbedCodeDialogClose} show={state.showEmbedCodeDialog} />}
            </div>

            {!compact && state.chartData && state.chartData.datasets.length > 0 && (
                <>
                    <div>
                        <div className="relative mt-4 mb-4 w-full px-3 mx-auto max-w-4xl flex flex-row flex-wrap justify-between items-center">
                            <div className="flex flex-row flex-wrap justify-end items-center mb-2">
                                <button className="ml-2 mb-2 btn-secondary" onClick={handleGenerateImageBtnClick}>
                                    <i className="fas fa-download"></i> Image
                                </button>

                                <button className="ml-2 mb-2 btn-secondary" onClick={handleGenerateCSVBtnClick}>
                                    <i className="fas fa-download"></i> CSV
                                </button>

                                <button className="ml-2 mb-2 btn-secondary" onClick={handleGenEmbedCodeDialogBtnClick}>
                                    <i className="fas fa-code"></i> Embed
                                </button>
                                <button className="ml-2 mb-2 btn-secondary" onClick={handleCopyLinkBtnClick}>
                                    <i className="far fa-copy"></i> Link{" "}
                                </button>
                                <button
                                    className="ml-2 mb-2 btn-secondary"
                                    onClick={handleLemmyShareBtnClick}
                                >
                                    <img src="/assets/lemmy.svg" className="h-4 w-4 inline-block" alt="Lemmy" />{" "}
                                    Share{" "}
                                </button>
                                <button
                                    className="ml-2 mb-2 btn-secondary"
                                    onClick={handleMastodonShareBtnClick}
                                >
                                    <i className="fa-brands fa-mastodon"></i>{" "}
                                    Toot{" "}
                                </button>
                            </div>
                        </div>

                        <EmbedMarkdownSection />
                    </div>
                </>
            )}
        </>
    )
}

export default StarChartViewer
