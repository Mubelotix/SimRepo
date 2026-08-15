import axios from "axios"
import { XYChartData, XYData } from "../packages/xy-chart"
import { ChartMode, RepoStarData, RepoData } from "../types/chart"
import { REPO_DATA_API_URL } from "./config"
import utils from "./utils"

export interface ChartDataOptions {
    insertZeroPoint?: boolean
}

export interface RepoDataResult {
    data: RepoData[]
    missing: string[]
}

export const getRepoData = async (repos: string[]): Promise<RepoDataResult> => {
    if (repos.length === 0) {
        return { data: [], missing: [] }
    }

    const { data } = await axios.get(`${REPO_DATA_API_URL}/repo-data`, {
        params: { repos: repos.join(",") },
        timeout: 15000,
    })

    const found: RepoData[] = data?.data ?? []
    const missing: string[] = data?.missing ?? []

    found.sort((d1, d2) => {
        return Math.max(...d2.starRecords.map((s) => s.count)) - Math.max(...d1.starRecords.map((s) => s.count))
    })

    return { data: found, missing }
}

export const convertStarDataToChartData = (reposStarData: RepoStarData[], chartMode: ChartMode, options?: ChartDataOptions): XYChartData => {
    if (chartMode === "Date") {
        const datasets: XYData[] = reposStarData.map((item) => {
            const { repo, starRecords } = item
            const chartData = starRecords.map((item) => {
                return {
                    x: new Date(item.date),
                    y: Number(item.count)
                }
            })

            // Add initial zero point at the beginning
            if (options?.insertZeroPoint && chartData.length > 0 && chartData[0].y > 0) {
                const firstDate = new Date(chartData[0].x)
                firstDate.setDate(firstDate.getDate() - 1) // One day before first star
                chartData.unshift({
                    x: firstDate,
                    y: 0
                })
            }

            return {
                label: repo,
                logo: "",
                data: chartData
            }
        })

        return {
            datasets
        }
    } else {
        const datasets: XYData[] = reposStarData.map((item) => {
            const { repo, starRecords } = item

            const started = starRecords[0].date
            const chartData = starRecords.map((item) => {
                return {
                    x: utils.getTimeStampByDate(new Date(item.date)) - utils.getTimeStampByDate(new Date(started)),
                    y: Number(item.count)
                }
            })

            // Add initial zero point at the beginning
            if (options?.insertZeroPoint && chartData.length > 0 && chartData[0].y > 0) {
                chartData.unshift({
                    x: -1, // One day before in timeline mode
                    y: 0
                })
            }

            return {
                label: repo,
                logo: "",
                data: chartData
            }
        })

        return {
            datasets
        }
    }
}

export const convertDataToChartData = (repoData: RepoData[], chartMode: ChartMode, options?: ChartDataOptions): XYChartData => {
    if (chartMode === "Date") {
        const datasets: XYData[] = repoData.map(({ repo, starRecords, logoUrl }) => {
            const chartData = starRecords.map((item) => {
                return {
                    x: new Date(item.date),
                    y: Number(item.count)
                }
            })

            // Add initial zero point at the beginning
            if (options?.insertZeroPoint && chartData.length > 0 && chartData[0].y > 0) {
                const firstDate = new Date(chartData[0].x)
                firstDate.setDate(firstDate.getDate() - 1) // One day before first star
                chartData.unshift({
                    x: firstDate,
                    y: 0
                })
            }

            return {
                label: repo,
                logo: logoUrl,
                data: chartData
            }
        })

        return { datasets }
    } else {
        const datasets: XYData[] = repoData.map(({ repo, starRecords, logoUrl }) => {
            const chartData = starRecords.map((item) => {
                return {
                    x: utils.getTimeStampByDate(new Date(item.date)) - utils.getTimeStampByDate(new Date(starRecords[0].date)),
                    y: Number(item.count)
                }
            })

            // Add initial zero point at the beginning
            if (options?.insertZeroPoint && chartData.length > 0 && chartData[0].y > 0) {
                chartData.unshift({
                    x: -1, // One day before in timeline mode
                    y: 0
                })
            }

            return {
                label: repo,
                logo: logoUrl,
                data: chartData
            }
        })

        return { datasets }
    }
}
