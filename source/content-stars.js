import { getSimilarRepos } from './content.js';

export async function initHome() {
    console.log("Producing recommendations on the homepage");
    let login = document.querySelector('meta[name="user-login"]').getAttribute('content');
    console.log("User login:", login);

    let latestStars = 10;
    let after = null;
    let stars = new Set();

    while (stars.size < latestStars) {
        let url = `https://github.com/${login}?tab=stars`;
        if (after) {
            url += `&after=${after}`;
        }

        let response = await fetch(url);
        let text = await response.text();

        // Extract starred repository IDs from the HTML
        let regex = /details-user-list-(\d+)-unstarred/g;
        while ((matches = regex.exec(text)) !== null) {
            let id = matches[1];
            if (id) {
                stars.add(Number(id));
                if (stars.size >= latestStars) {
                    break;
                }
            }
        }

        // Get the next "after" parameter from the pagination link
        let nextMatch = text.match(/\?after=([^&]+)&amp;tab=stars">Next<\/a>/);
        if (nextMatch && nextMatch[1]) {
            after = nextMatch[1];
            console.log("Next after:", after);
        } else {
            break;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log("Collected stars:", stars);

    let response = await getSimilarRepos(Array.from(stars), 10, 20, 0.9);
    console.log('💈 Found similar repos for homepage:', response);
}

export async function initStarsList() {
    let documentHtml = document.documentElement.innerHTML;
    let regex = /details-user-list-(\d+)-unstarred/g;
    let stars = new Set();
    while ((matches = regex.exec(documentHtml)) !== null) {
        let id = matches[1];
        if (id) {
            stars.add(Number(id));
        }
    }

    console.log("Collected stars:", stars);

    let response = await getSimilarRepos(Array.from(stars), 20, 20, 0.9);
    console.log('💈 Found similar repos for homepage:', response);
}
