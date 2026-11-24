import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"
import type { RepoMeta } from "@shared/types/chart"
import TrustNotice from "./TrustNotice"

function notice(trust_p: number | null, stars = 94228) {
    const meta = { trust_p, stars_total: 459247, raw: { stars } } as RepoMeta
    return renderToStaticMarkup(<TrustNotice meta={meta} />)
}

test("trust tiers use the exact score boundaries and show a correction only for Average and below", () => {
    for (const [score, tier, correction] of [
        [0.5, "Excellent", false],
        [0.4999, "Good", false],
        [0.25, "Good", false],
        [0.2499, "Average", true],
        [0.05, "Average", true],
        [0.0499, "Low", true],
        [0.01, "Low", true],
        [0.0099, "Suspicious", true],
        [0, "Suspicious", true],
    ] as const) {
        const markup = notice(score)
        assert.ok(markup.includes(`trust score · ${tier}`), `score ${score}`)
        assert.equal(markup.includes("94.2k corrected stars"), correction)
        assert.doesNotMatch(markup, /459.2k/)
    }
})

test("Average is gray, unscored repos have no notice, and unchanged counts are not repeated", () => {
    assert.match(notice(0.1), /bg-gray-50/)
    assert.equal(notice(null), "")
    assert.doesNotMatch(notice(0.1, 459247), /corrected stars/)
    assert.match(notice(0.001, 0), /0 corrected stars/)
})

test("a correction can be higher than GitHub's count", () => {
    assert.match(notice(0.1, 460000), /460k corrected stars/)
})
