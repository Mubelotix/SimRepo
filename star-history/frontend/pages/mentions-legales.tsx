import type { NextPage } from "next"
import Head from "next/head"
import Link from "next/link"
import Header from "../components/header"
import Footer from "../components/footer"
import PageShell from "../components/PageShell"
import { SITE_URL } from "../helpers/consts"

const Legal: NextPage = () => {
    return (
        <>
            <Head>
                <title>Mentions légales · GitHub Star History</title>
                <meta name="description" content="Mentions légales de GitHub Star History (conformité LCEN)." />
                <meta property="og:type" content="website" />
                <meta property="og:url" content={`${SITE_URL}/mentions-legales`} />
                <meta property="og:title" content="Mentions légales · GitHub Star History" />
            </Head>
            <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-slate-100 text-neutral-900 antialiased">
                <Header />
                <PageShell>
                    <div className="w-full max-w-2xl px-4 py-4 mb-6 rounded-xl bg-blue-50 border-2 border-blue-300 text-blue-900 text-base leading-relaxed">
                        This page is written in French, as required by French law (Loi n° 2004-575 du 21 juin 2004 pour la
                        confiance dans l&apos;économie numérique), which mandates that legal notices be available in French.
                    </div>
                    <article className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden">
                        <header className="px-6 py-5 border-b border-neutral-100">
                            <h1 className="text-xl font-semibold text-neutral-900">Mentions légales</h1>
                        </header>

                        <div className="px-6 py-6 space-y-8 text-sm leading-relaxed text-neutral-700">
                            <section>
                                <h2 className="text-base font-semibold text-neutral-900 mb-2">Éditeur du site</h2>
                                <p>
                                    Le site GitHub Star History est édité par{" "}
                                    <a className="link-action" target="_blank" rel="noopener noreferrer" href="https://github.com/Mubelotix">
                                        @Mubelotix
                                    </a>.
                                </p>
                                <p>
                                    Contact :{" "}
                                    <a className="link-action" href="mailto:mubelotix@gmail.com">mubelotix@gmail.com</a>
                                    <br />
                                    Directeur de la publication :{" "}
                                    <a className="link-action" target="_blank" rel="noopener noreferrer" href="https://github.com/Mubelotix">
                                        @Mubelotix
                                    </a>
                                </p>
                                <p>
                                    Site non professionnel. Conformément à l&apos;article 6-III-2 de la loi n° 2004-575 du 21 juin
                                    2004, l&apos;éditeur a choisi de préserver son anonymat ; ses coordonnées personnelles ont été
                                    transmises au fournisseur de service.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-base font-semibold text-neutral-900 mb-2">Hébergeur</h2>
                                <p>
                                    Le site est auto-hébergé et accessible via la connexion internet fournie par BOUYGUES
                                    TELECOM, Société Anonyme au capital de 929 207 595,48 €.
                                </p>
                                <p>
                                    SIREN : 397 480 930
                                    <br />
                                    R.C.S. Nanterre
                                    <br />
                                    Siège social : Le Technopôle – 13-15 avenue du Maréchal Juin – 92360 Meudon-la-Forêt
                                    <br />
                                    Téléphone : 1064 (prix d&apos;un appel local)
                                    <br />
                                    N° TVA intracommunautaire : FR74397480930
                                </p>
                            </section>

                            <section>
                                <h2 className="text-base font-semibold text-neutral-900 mb-2">Propriété intellectuelle</h2>
                                <p>
                                    L&apos;ensemble des contenus présents sur ce site (textes, code, éléments graphiques) est, sauf
                                    mention contraire sur GitHub, la propriété de{" "}
                                    <a className="link-action" target="_blank" rel="noopener noreferrer" href="https://github.com/Mubelotix">
                                        @Mubelotix
                                    </a>. Toute reproduction non autorisée est interdite.
                                </p>
                                <p className="mt-2">
                                    Le code du site est ouvert et publié sur{" "}
                                    <a className="link-action" target="_blank" rel="noopener noreferrer" href="https://github.com/Mubelotix/star-history">
                                        GitHub
                                    </a>{" "}
                                    : une partie est licenciée sous MIT, l&apos;autre partie sous GPLv3 (voir{" "}
                                    <a className="link-action" target="_blank" rel="noopener noreferrer" href="https://github.com/Mubelotix/star-history">
                                        le dépôt
                                    </a>{" "}
                                    pour le détail). Les données fournies par le serveur ne sont quant à elles pas licenciées :
                                    elles sont privées et toute utilisation en dehors du site requiert une autorisation préalable.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-base font-semibold text-neutral-900 mb-2">Données personnelles</h2>
                                <p>
                                    Le traitement des données personnelles est décrit dans notre{" "}
                                    <Link className="link-action" href="/privacy">politique de confidentialité</Link>. Conformément au
                                    RGPD, aucune déclaration préalable à la CNIL n&apos;est requise depuis 2018 pour ce type de site.
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

export default Legal
