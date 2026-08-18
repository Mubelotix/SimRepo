import type { NextPage } from "next"
import Head from "next/head"
import Link from "next/link"
import Header from "../components/header"
import Footer from "../components/footer"
import PageShell from "../components/PageShell"
import { SITE_URL } from "../helpers/consts"
import { countEvent } from "../helpers/analytics"

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
                        <section>
                            <h2 className="text-base font-semibold text-neutral-900 mb-2">No token required</h2>
                            <p>
                                Many star history services (including the original star-history.com) ask you to create a
                                GitHub token with <strong>write access</strong> just to look at a chart. We believe that level
                                of trust shouldn&apos;t be necessary for generating a simple chart. That&apos;s why this fork collects
                                and uses its own data, so you don&apos;t need a token at all.
                            </p>
                        </section>

                        <p>
                            GitHub stars are a useful signal when choosing a tool, but the raw count alone won&apos;t tell you if a
                            project is gaining traction, in decline, or simply dormant. SimRepo&apos;s Star History shows you how a project&apos;s
                            stars grow over the years - and it&apos;s free and{" "}
                            <a className="link-action" target="_blank" rel="noopener noreferrer" href="https://github.com/Mubelotix/simrepo">
                                open-source
                            </a>
                            .
                        </p>

                        <section>
                            <h2 className="text-base font-semibold text-neutral-900 mb-2">User Manual</h2>
                            <img className="w-full rounded-lg border border-neutral-400 shadow-xl my-2" src={`${BASE}/search.png`} alt="User manual" />
                            <p>
                                It&apos;s just a simple search box, how hard could it be? Simplicity is indeed Star History&apos;s No 1
                                design principal. On the other hand, it also provides some handy features for power users. Below we
                                will show you:
                            </p>
                            <ul className="list-disc list-inside space-y-1 mt-2">
                                <li>How to discover similar repositories.</li>
                                <li>How to add a repo using 3 different formats.</li>
                                <li>How to add multiple repos.</li>
                                <li>How to align the timeline to compare multiple repos.</li>
                                <li>How to temporarily show/hide a repo in the chart.</li>
                                <li>How to embed a live star history chart inside your GitHub project README.md.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-base font-semibold text-neutral-900 mb-2">How to discover similar repositories</h2>
                            <p>
                                Searching for a single repo also surfaces <strong>similar repositories</strong> on the website,
                                so you can spot adjacent tools worth considering:
                            </p>
                            <img className="w-full rounded-lg border border-neutral-400 shadow-xl my-2" src={`${BASE}/similar-directly-onsite.png`} alt="Similar repositories on the website" />
                            <p>
                                Only three similar repos are shown on the website. For unlimited lookups
                                and to see similar repositories directly in the GitHub sidebar, install the SimRepo browser
                                extension:
                            </p>
                            <div className="flex justify-center gap-4 py-2">
                                <a className="hover:opacity-80" href="https://addons.mozilla.org/en-US/firefox/addon/simrepo/" target="_blank" rel="noopener noreferrer" onClick={() => countEvent("extension-click", { browser: "firefox" })}>
                                    <img src="https://imgur.com/ihXsdDO.png" width="48" height="48" alt="Firefox" />
                                </a>
                                <a className="hover:opacity-80" href="https://chromewebstore.google.com/detail/simrepo/jieoogmcigenidbkgnkaakagdnlnieap" target="_blank" rel="noopener noreferrer" onClick={() => countEvent("extension-click", { browser: "chrome" })}>
                                    <img src="https://imgur.com/3C4iKO0.png" width="48" height="48" alt="Chrome" />
                                </a>
                                <a className="hover:opacity-80" href="https://chromewebstore.google.com/detail/simrepo/jieoogmcigenidbkgnkaakagdnlnieap" target="_blank" rel="noopener noreferrer" onClick={() => countEvent("extension-click", { browser: "brave" })}>
                                    <img src="https://imgur.com/z8yjLZ2.png" width="48" height="48" alt="Brave" />
                                </a>
                                <a className="hover:opacity-80" href="https://microsoftedge.microsoft.com/addons/detail/simrepo/hepnmbpflckgenbalbaebckhpncaabid" target="_blank" rel="noopener noreferrer" onClick={() => countEvent("extension-click", { browser: "edge" })}>
                                    <img src="https://imgur.com/vMcaXaw.png" width="48" height="48" alt="Edge" />
                                </a>
                                <a className="hover:opacity-80" href="https://chromewebstore.google.com/detail/simrepo/jieoogmcigenidbkgnkaakagdnlnieap" target="_blank" rel="noopener noreferrer" onClick={() => countEvent("extension-click", { browser: "vivaldi" })}>
                                    <img src="https://imgur.com/EuDp4vP.png" width="48" height="48" alt="Vivaldi" />
                                </a>
                                <a className="hover:opacity-80" href="https://chromewebstore.google.com/detail/simrepo/jieoogmcigenidbkgnkaakagdnlnieap" target="_blank" rel="noopener noreferrer" onClick={() => countEvent("extension-click", { browser: "opera" })}>
                                    <img src="https://imgur.com/nSJ9htU.png" width="48" height="48" alt="Opera" />
                                </a>
                                <a className="hover:opacity-80" href="https://addons.mozilla.org/en-US/firefox/addon/simrepo/" target="_blank" rel="noopener noreferrer" onClick={() => countEvent("extension-click", { browser: "tor" })}>
                                    <img src="https://imgur.com/MQYBSrD.png" width="48" height="48" alt="Tor" />
                                </a>
                            </div>
                            <img className="w-full rounded-lg border border-neutral-400 shadow-xl my-2" src={`${BASE}/similar-on-github-sidebar.png`} alt="Similar repositories in the extension sidebar" />
                        </section>

                        <section>
                            <h2 className="text-base font-semibold text-neutral-900 mb-2">How to add a repo using 3 different formats</h2>
                            <img className="w-full rounded-lg border border-neutral-400 shadow-xl my-2" src={`${BASE}/search-bar.webp`} alt="Search bar" />
                            <p>To add a repo, you can:</p>
                            <ol className="list-decimal list-inside space-y-2">
                                <li>
                                    Paste its whole URL in the search bar. e.g.{" "}
                                    <code className="font-mono text-xs bg-neutral-100 px-1 rounded">https://github.com/Mubelotix/simrepo</code>
                                </li>
                                <li>
                                    If you are feeling lazy, skip the{" "}
                                    <code className="font-mono text-xs bg-neutral-100 px-1 rounded">https://github.com/</code> part. e.g{" "}
                                    <code className="font-mono text-xs bg-neutral-100 px-1 rounded">Mubelotix/simrepo</code>
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
                            <img className="w-full rounded-lg border border-neutral-400 shadow-xl my-2" src={`${BASE}/multiple-repos.webp`} alt="Multiple repos" />
                            <p>
                                For example, if you were wondering about which database change management tool to use, here we have
                                the history of their growth. You can not naively choose the project based on mere
                                stars, while stars and its trajectory give you a hint about those projects worth looking at.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-base font-semibold text-neutral-900 mb-2">How to align the timeline to compare multiple repos</h2>
                            <p>
                                By checking <strong>Align timeline</strong>, the chart will be rerendered.
                            </p>
                            <img className="w-full rounded-lg border border-neutral-400 shadow-xl my-2" src={`${BASE}/align-timeline.webp`} alt="Align timeline" />
                        </section>

                        <section>
                            <h2 className="text-base font-semibold text-neutral-900 mb-2">How to temporarily show/hide a repo in the chart</h2>
                            <p>
                                Instead of removing a repo from the chart, you can switch visibility of it by clicking the name in
                                its label box.
                            </p>
                            <img className="w-full rounded-lg border border-neutral-400 shadow-xl my-2" src={`${BASE}/hide-show.webp`} alt="Hide/show repo" />
                        </section>

                        <section>
                            <h2 className="text-base font-semibold text-neutral-900 mb-2">How to embed a live star history chart inside your GitHub project README.md</h2>
                            <p>Copy the markdown snippet and paste it into your README.md:</p>
                            <ul className="list-disc list-inside space-y-1 mt-2">
                                <li>
                                    <strong>Light theme</strong>: plain markdown with broad support.
                                </li>
                                <li>
                                    <strong>Dynamic Theme</strong>: GitHub-flavored markdown with HTML, which gives your
                                    chart an automatic dark/light theme switch.
                                </li>
                            </ul>
                            <img className="w-full rounded-lg border border-neutral-400 shadow-xl my-2" src={`${BASE}/copy-markdown.png`} alt="Copy markdown embed code" />
                            <p>
                                GitHub proxies embedded images through its own servers, so no data from visitors of your
                                pages ever reaches us.
                            </p>
                            <img className="w-full rounded-lg border border-neutral-400 shadow-xl my-2" src={`${BASE}/gh-readme.webp`} alt="Chart in README" />
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
