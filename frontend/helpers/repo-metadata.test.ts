import assert from "node:assert/strict"
import test from "node:test"
import { getRepoMetadata } from "./repo-metadata"
import { SITE_URL } from "./consts"

const initial = { repo: "owner/A", description: "A's generated description." }

test("server metadata survives hydration while the URL store is initializing", () => {
    assert.equal(getRepoMetadata(initial, [], false).description, initial.description)
    assert.equal(getRepoMetadata(initial, ["owner/A"], true).description, initial.description)
    assert.equal(getRepoMetadata(initial, ["OWNER/a"], true).description, initial.description)
})

test("case variants retain the stored repository name and canonical after hydration", () => {
    const server = getRepoMetadata(initial, [], false)
    const hydrated = getRepoMetadata(initial, ["OWNER/a"], true)
    assert.deepEqual(hydrated, server)
    assert.equal(hydrated.url, `${SITE_URL}/owner/A`)
    assert.equal(hydrated.title, "owner/A - GitHub Star History")
})

test("selecting another repository updates title/canonical and drops the old description", () => {
    const metadata = getRepoMetadata(initial, ["owner/B"], true)
    assert.equal(metadata.title, "owner/B - GitHub Star History")
    assert.equal(metadata.url, `${SITE_URL}/owner/B`)
    assert.notEqual(metadata.description, initial.description)
})

test("comparing or clearing repositories drops repository-specific metadata", () => {
    for (const repos of [[], ["owner/A", "owner/B"]]) {
        const metadata = getRepoMetadata(initial, repos, true)
        assert.equal(metadata.title, "GitHub Star History")
        assert.equal(metadata.url, SITE_URL)
        assert.notEqual(metadata.description, initial.description)
    }
})

test("returning to the original repository restores its generated description", () => {
    getRepoMetadata(initial, ["owner/B"], true)
    assert.equal(getRepoMetadata(initial, ["owner/A"], true).description, initial.description)
})
