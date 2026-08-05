import axios from "axios"

const REQUEST_TIMEOUT_MS = 15000  // 15s timeout for GitHub API calls

namespace api {
    // Used by the backend to validate GitHub tokens (still needed for OG card
    // metadata that is not stored in repos.sqlite).
    export async function getRepoStargazersCount(repo: string, token?: string) {
        const { data } = await axios.get(`https://api.github.com/repos/${repo}`, {
            headers: {
                Accept: "application/vnd.github.v3.star+json",
                Authorization: token ? `token ${token}` : ""
            },
            timeout: REQUEST_TIMEOUT_MS,
        })

        return data.stargazers_count
    }
}

export default api
