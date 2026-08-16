import React, { useState } from "react"
import Header from "../components/header"
import Footer from "../components/footer"
import LeftSidebar from "../components/LeftSidebar"
import RepoInputer from "../components/RepoInputer"
import type { NextPage } from "next"
import StarChartViewer from "../components/StarChartViewer"
import RepoStatsCard from "../components/RepoStatsCard"
import EmptyState from "../components/EmptyState"
import SimilarReposCard from "../components/SimilarReposCard"
import Head from "next/head"
import { SITE_URL } from "../helpers/consts"

const Index: NextPage = () => {
    const [isChartVisible, setChartVisibility] = useState(false) // Start with false since chart is not visible by default

    const metadata = {
		title:       "GitHub Star History",
		description: "GitHub star history graphs, no token required.",
		imageURL:    `${SITE_URL}/assets/star-history-preview.webp`,
	}

    return (
        <>
            <Head>
                <title>{metadata.title}</title>
                <meta name="description" content={metadata.description} />

                {/* Open Graph / Facebook */}
                <meta property="og:type" content="website" />
                <meta property="og:url" content={SITE_URL} />
                <meta property="og:title" content={metadata.title} />
                <meta property="og:description" content={metadata.description} />
                <meta property="og:image" content={metadata.imageURL} />

                {/* Twitter */}
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:url" content={SITE_URL} />
                <meta name="twitter:title" content={metadata.title} />
                <meta name="twitter:description" content={metadata.description} />
                <meta name="twitter:image" content={metadata.imageURL} />
            </Head>
            <div className="relative w-full h-auto min-h-screen flex flex-col overflow-x-hidden">
                <Header />
                <div className="w-full h-auto grow flex flex-row justify-center">
                    <div className="w-full max-w-screen-2xl mx-auto px-4 h-auto flex flex-col lg:flex-row items-center lg:items-start lg:justify-center lg:gap-8 xl:gap-16">
                        <div className="hidden xl:block xl:w-60 shrink-0">
                            <LeftSidebar />
                        </div>

                        <div className="w-full min-w-0 lg:flex-1 flex flex-col justify-start items-center">
                            <RepoInputer isChartVisible={isChartVisible} setChartVisibility={setChartVisibility} />
                            {isChartVisible ? (
                                <>
                                    <RepoStatsCard />
                                    <StarChartViewer />
                                </>
                            ) : (
                                <EmptyState />
                            )}
                        </div>

                        <div className="w-full lg:w-72 shrink-0">
                            <SimilarReposCard />
                        </div>
                    </div>
                </div>

                <Footer />
            </div>
        </>
    )
}

export default Index
