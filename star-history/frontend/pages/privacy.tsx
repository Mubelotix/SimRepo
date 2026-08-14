import type { NextPage } from "next"
import Head from "next/head"
import Header from "../components/header"
import Footer from "../components/footer"
import PageShell from "../components/PageShell"
import { SITE_URL } from "../helpers/consts"

const Privacy: NextPage = () => {
    return (
        <>
            <Head>
                <title>Privacy Policy · GitHub Star History</title>
                <meta name="description" content="Privacy policy for GitHub Star History: what data is processed, why, and your rights." />
                <meta property="og:type" content="website" />
                <meta property="og:url" content={`${SITE_URL}/privacy`} />
                <meta property="og:title" content="Privacy Policy · GitHub Star History" />
            </Head>
            <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-slate-100 text-neutral-900 antialiased">
                <Header />
                <PageShell>
                    <article className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden">
                        <header className="px-6 py-5 border-b border-neutral-100">
                            <h1 className="text-xl font-semibold text-neutral-900">Privacy Policy</h1>
                        </header>

                        <div className="px-6 py-6 space-y-8 text-sm leading-relaxed text-neutral-700">
                            <p className="text-xs text-neutral-400">
                                Last updated: 2026-08-14
                            </p>
                            <p>
                                This page explains what data GitHub Star History processes when you visit, why, and what
                                rights you have. It is written to satisfy GDPR (EU/France) and CalOPPA/CCPA-style
                                disclosure expectations for a small, non-commercial site.
                            </p>

                            <section>
                                <h2 className="text-base font-semibold text-neutral-900 mb-2">1. Who is responsible for your data</h2>
                                <p>
                                    <a className="link-action" target="_blank" rel="noopener noreferrer" href="https://github.com/Mubelotix">
                                        @Mubelotix
                                    </a>{" "}
                                    operates GitHub Star History and is the data controller for the processing
                                    described here. Contact:{" "}
                                    <a className="link-action" href="mailto:mubelotix@gmail.com">mubelotix@gmail.com</a>{" "}
                                    (also acting as data protection contact / &quot;DPO&quot; for this site:{" "}
                                    <a className="link-action" href="mailto:mubelotix@gmail.com">mubelotix@gmail.com</a>).
                                </p>
                            </section>

                            <section>
                                <h2 className="text-base font-semibold text-neutral-900 mb-2">2. What we process</h2>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="border-b border-neutral-200">
                                                <th className="py-2 pr-3 font-semibold">Data</th>
                                                <th className="py-2 pr-3 font-semibold">Source</th>
                                                <th className="py-2 font-semibold">Detail</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="border-b border-neutral-100 align-top">
                                                <td className="py-2 pr-3 font-medium">Analytics visit data</td>
                                                <td className="py-2 pr-3">Self-hosted analytics (s.dera.page)</td>
                                                <td className="py-2">
                                                    Page views, referrer, and browser/device type. IP addresses are anonymized
                                                    before storage, so no individual visitor is identifiable from stored data. When
                                                    the &quot;Do Not Track&quot; (DNT) signal is set in your browser, analytics are
                                                    completely ignored and no data is collected.
                                                </td>
                                            </tr>
                                            <tr className="border-b border-neutral-100 align-top">
                                                <td className="py-2 pr-3 font-medium">Server request logs</td>
                                                <td className="py-2 pr-3">Web server / reverse proxy</td>
                                                <td className="py-2">
                                                    Method, path, and status code only. No query strings containing personal data,
                                                    no full IP retained beyond transient rate-limiting (see §5).
                                                </td>
                                            </tr>
                                            <tr className="align-top">
                                                <td className="py-2 pr-3 font-medium">GitHub public data</td>
                                                <td className="py-2 pr-3">Public data from our server; avatar images from GitHub&apos;s CDN</td>
                                                <td className="py-2">
                                                    Public repository, user, and avatar-image data you explicitly search for. This
                                                    is public data GitHub already serves; we don&apos;t store search history tied to
                                                    you.
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <p className="mt-3">
                                    We do <strong>not</strong> use cookies for tracking, do <strong>not</strong> sell data, and
                                    do <strong>not</strong> build user profiles.
                                </p>
                                <p className="mt-3">
                                    We cache metadata for almost all public GitHub repositories that have gained some traction.
                                    This metadata is public data served by GitHub, stored on our servers so the site works
                                    faster and reliably. It may include the repository owner&apos;s username, but it is not tied to
                                    you as a visitor in any way.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-base font-semibold text-neutral-900 mb-2">3. Why we process it, and our legal basis</h2>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>
                                        <strong>Analytics &amp; server logs</strong>: legitimate interest (GDPR Art. 6(1)(f)):
                                        understanding traffic and keeping the site reliable and secure, done in the least
                                        intrusive way possible (anonymized/aggregated). Analytics is handled by the
                                        privacy-friendly, self-hosted{" "}
                                        <a className="link-action" target="_blank" rel="noopener noreferrer" href="https://github.com/umami-software/umami">
                                            Umami software
                                        </a>
                                        . When the &quot;Do Not Track&quot; (DNT) signal is set in your browser, analytics are
                                        completely ignored and no data is collected. No consent banner is required for this
                                        because no tracking cookies or cross-site identifiers are used.
                                    </li>
                                    <li>
                                        <strong>Repository metadata caching</strong>: legitimate interest (Art. 6(1)(f)) — improving
                                        site performance and reliability using data GitHub already makes public, with no additional
                                        profiling.
                                    </li>
                                    <li>
                                        <strong>GitHub images</strong>: loading avatar images requires contacting GitHub&apos;s CDN
                                        (Art. 6(1)(b)-adjacent / legitimate interest), triggered only by the data you view.
                                    </li>
                                    <li>
                                        <strong>Google Fonts</strong>: fonts are still loaded from Google&apos;s servers rather
                                        than self-hosted, which involves your IP address being sent to Google, a third-party
                                        transfer requiring its own legal basis and disclosure (see §4).
                                    </li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="text-base font-semibold text-neutral-900 mb-2">4. Third parties</h2>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="border-b border-neutral-200">
                                                <th className="py-2 pr-3 font-semibold">Third party</th>
                                                <th className="py-2 pr-3 font-semibold">Purpose</th>
                                                <th className="py-2 font-semibold">Data shared</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="border-b border-neutral-100 align-top">
                                                <td className="py-2 pr-3 font-medium">Google Fonts</td>
                                                <td className="py-2 pr-3">Web font delivery</td>
                                                <td className="py-2">Visitor IP address, sent to Google when the font loads</td>
                                            </tr>
                                            <tr className="align-top">
                                                <td className="py-2 pr-3 font-medium">GitHub</td>
                                                <td className="py-2 pr-3">Public data search feature</td>
                                                <td className="py-2">Avatar images loaded directly from GitHub&apos;s CDN</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </section>

                            <section>
                                <h2 className="text-base font-semibold text-neutral-900 mb-2">5. Retention</h2>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>No persistent logs tied to individual users.</li>
                                    <li>
                                        Rate-limiting IP data is held in memory only, for the duration needed to enforce rate
                                        limits, and is never written to disk or a database.
                                    </li>
                                    <li>
                                        Analytics data is retained only in anonymized/aggregated form.
                                    </li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="text-base font-semibold text-neutral-900 mb-2">6. Your rights</h2>
                                <p>
                                    Under GDPR (and equivalent rights under CCPA if applicable to you), you can:
                                </p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li><strong>Access</strong>: ask what data we hold about you</li>
                                    <li><strong>Rectification</strong>: correct inaccurate data</li>
                                    <li><strong>Erasure</strong>: ask us to delete data</li>
                                    <li><strong>Portability</strong>: receive your data in a portable format</li>
                                    <li><strong>Object</strong>: object to processing based on legitimate interest</li>
                                </ul>
                                <p className="mt-2">
                                    Since we don&apos;t maintain individual visitor profiles, most requests will simply confirm we
                                    hold no identifiable data about you. To exercise any right, contact{" "}
                                    <a className="link-action" href="mailto:mubelotix@gmail.com">mubelotix@gmail.com</a>. You can
                                    also lodge a complaint with your national data protection authority (in France: the CNIL,{" "}
                                    <a className="link-action" target="_blank" rel="noopener noreferrer" href="https://www.cnil.fr">www.cnil.fr</a>).
                                </p>
                            </section>

                            <section>
                                <h2 className="text-base font-semibold text-neutral-900 mb-2">7. Changes to this policy</h2>
                                <p>
                                    We&apos;ll update the &quot;Last updated&quot; date above when this policy changes materially.
                                </p>
                            </section>
                        </div>
                    </article>
                </PageShell>
                <Footer />
            </div>
        </>
    )
}

export default Privacy
