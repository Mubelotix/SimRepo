import type { NextPage } from "next"
import Head from "next/head"
import Link from "next/link"
import Header from "../components/header"
import Footer from "../components/footer"
import PageShell from "../components/PageShell"
import { SITE_URL } from "../helpers/consts"

const BASE = "/assets/blog/how-to-use-github-star-history"

const HowToUse: NextPage = () => {
    return (
        <>
            <Head>
                <title>How to use GitHub Star History</title>
                <meta name="description" content="How to add, compare, and embed GitHub star history charts." />
                <meta property="og:type" content="website" />
                <meta property="og:url" content={`${SITE_URL}/how-to-use`} />
                <meta property="og:title" content="How to use GitHub Star History" />
            </Head>
            <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-slate-100 text-neutral-900 antialiased">
                <Header />
                <PageShell>
                    <article className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden">
                    <header className="px-6 py-5 border-b border-neutral-100">
                        <h1 className="text-xl font-semibold text-neutral-900">📕 How to use GitHub Star History</h1>
                    </header>

                    <div className="px-6 py-6 space-y-8 text-sm leading-relaxed text-neutral-700">
                        <p>
                            When choosing a tool (especially an open-source one) to use, what&apos;s your thought process? What
                            are the factors that matter to you?
                        </p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Any other users out there?</li>
                            <li>Is it the most popular in this category?</li>
                            <li>Is this technology in decline?</li>
                        </ul>
                        <p>
                            Here&apos;s one obvious metric I&apos;m sure you will also investigate: its GitHub stars.
                        </p>
                        <p>
                            We know, you can&apos;t fully trust a project&apos;s GitHub stars alone. It is, however, a good way to
                            determine if a tool is an adequate one and if it&apos;s likely to grow, if you use it correctly.
                        </p>
                        <p>
                            Even if a project has hundreds of millions of stars now, doesn&apos;t mean that it&apos;s still gaining
                            popularity or maintained. Or if the project had an explosive breakout in the past? There&apos;s no way
                            of knowing these simply from gazing at the stars count. Here&apos;s when Star History comes in handy:
                            it shows how the number of GitHub stars of a project is increasing over the years. And - it&apos;s free
                            and{" "}
                            <a className="link-action" target="_blank" rel="noopener noreferrer" href="https://github.com/Mubelotix/star-history">
                                open-source
                            </a>
                            .
                        </p>

                        <section>
                            <h2 className="text-base font-semibold text-neutral-900 mb-2">User Manual</h2>
                            <img className="w-full rounded-lg border border-neutral-200 my-2" src={`${BASE}/user-manual.webp`} alt="User manual" />
                            <p>
                                It&apos;s just a simple search box, how hard could it be? Simplicity is indeed Star History&apos;s No 1
                                design principal. On the other hand, it also provides some handy features for power users. Below we
                                will show you:
                            </p>
                            <ul className="list-disc list-inside space-y-1 mt-2">
                                <li>How to add a repo using 3 different formats.</li>
                                <li>How to add multiple repos.</li>
                                <li>How to align the timeline to compare multiple repos.</li>
                                <li>How to temporarily show/hide a repo in the chart.</li>
                                <li>How to embed a live star history chart inside your GitHub project README.md.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-base font-semibold text-neutral-900 mb-2">How to add a repo using 3 different formats</h2>
                            <img className="w-full rounded-lg border border-neutral-200 my-2" src={`${BASE}/search-bar.webp`} alt="Search bar" />
                            <p>To add a repo, you can:</p>
                            <ol className="list-decimal list-inside space-y-2">
                                <li>
                                    Paste its whole URL in the search bar. e.g.{" "}
                                    <code className="font-mono text-xs bg-neutral-100 px-1 rounded">https://github.com/Mubelotix/star-history</code>
                                </li>
                                <li>
                                    If you are feeling lazy, skip the{" "}
                                    <code className="font-mono text-xs bg-neutral-100 px-1 rounded">https://github.com/</code> part. e.g{" "}
                                    <code className="font-mono text-xs bg-neutral-100 px-1 rounded">Mubelotix/star-history</code>
                                </li>
                                <li>
                                    When the repo name matches the organization&apos;s, writing once is enough, e.g.{" "}
                                    <code className="font-mono text-xs bg-neutral-100 px-1 rounded">star-history</code>. However, for
                                    something like <code className="font-mono text-xs bg-neutral-100 px-1 rounded">hashicorp/terraform</code>{" "}
                                    you can&apos;t do <code className="font-mono text-xs bg-neutral-100 px-1 rounded">hashicorp</code> nor{" "}
                                    <code className="font-mono text-xs bg-neutral-100 px-1 rounded">terraform</code>, cuz they don&apos;t
                                    match and you need to specify{" "}
                                    <code className="font-mono text-xs bg-neutral-100 px-1 rounded">hashicorp/terraform</code>.
                                </li>
                            </ol>
                        </section>

                        <section>
                            <h2 className="text-base font-semibold text-neutral-900 mb-2">How to add multiple repos</h2>
                            <p>
                                After adding one repo, you can continue adding more by just typing the next repo in the input box.
                                They will be rendered in the same chart.
                            </p>
                            <img className="w-full rounded-lg border border-neutral-200 my-2" src={`${BASE}/multiple-repos.webp`} alt="Multiple repos" />
                            <p>
                                For example, if you were wondering about which database change management tool to use, here we have
                                the history of their growth. Both <a className="link-action" target="_blank" rel="noopener noreferrer" href="https://flywaydb.org">Flyway</a> and{" "}
                                <a className="link-action" target="_blank" rel="noopener noreferrer" href="https://liquibase.com">Liquibase</a> started way
                                back and are gaining popularity over the years, but in recent years,{" "}
                                <a className="link-action" target="_blank" rel="noopener noreferrer" href="https://bytebase.com">Bytebase</a> is picking up
                                rapidly and has already bypassed Liquibase. You can not naively choose the project based on mere
                                stars, while stars and its trajectory give you a hint about those projects worth looking at.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-base font-semibold text-neutral-900 mb-2">How to align the timeline to compare multiple repos</h2>
                            <p>
                                By checking <strong>Align timeline</strong>, the chart will be rerendered.
                            </p>
                            <img className="w-full rounded-lg border border-neutral-200 my-2" src={`${BASE}/align-timeline.webp`} alt="Align timeline" />
                        </section>

                        <section>
                            <h2 className="text-base font-semibold text-neutral-900 mb-2">How to temporarily show/hide a repo in the chart</h2>
                            <p>
                                Instead of removing a repo from the chart, you can switch visibility of it by clicking the name in
                                its label box.
                            </p>
                            <img className="w-full rounded-lg border border-neutral-200 my-2" src={`${BASE}/hide-show.webp`} alt="Hide/show repo" />
                        </section>

                        <section>
                            <h2 className="text-base font-semibold text-neutral-900 mb-2">How to embed a live star history chart inside your GitHub project README.md</h2>
                            <ol className="list-decimal list-inside space-y-2">
                                <li>Click <strong>Embed</strong> below the chart.</li>
                                <li>Copy the iframe snippet and paste it into your README.md.</li>
                            </ol>
                            <img className="w-full rounded-lg border border-neutral-200 my-2" src={`${BASE}/embed.webp`} alt="Embed menu" />
                            <img className="w-full rounded-lg border border-neutral-200 my-2" src={`${BASE}/copy-iframe-readme.webp`} alt="Copy iframe" />
                            <img className="w-full rounded-lg border border-neutral-200 my-2" src={`${BASE}/gh-readme.webp`} alt="Chart in README" />
                        </section>

                        <p className="pt-2 border-t border-neutral-100 text-neutral-400 text-xs">
                            Play around and let us know what you think! Want to start fresh?{" "}
                            <Link href="/" className="link-action">Go to the homepage</Link>.
                        </p>
                    </div>
                    </article>
                </PageShell>
                <Footer />
            </div>
        </>
    )
}

export default HowToUse
