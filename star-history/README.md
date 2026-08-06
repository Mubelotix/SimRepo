<div align="center">

# :sparkles: Star History :sparkles:
 
[**star-history.dera.page**](https://star-history.dera.page), **GitHub star history, revived.**
</div>

> [!IMPORTANT]
> **This is a fork.** It is not affiliated with the original developers. Star History was originally built by [@tim_qian](https://github.com/timqian) and [Bytebase](https://github.com/bytebase). The original [star-history.com](https://www.star-history.com) project is being killed off by GitHub's decision to sunset the GitHub API it relied on ([GitHub Stargazer API restriction](https://www.star-history.com/blog/github-stargazer-api-restriction)). This fork fills that gap by serving star history from a different data source.

> 💖 Star History is maintained by [@Mubelotix](https://github.com/Mubelotix). If you find it useful, please consider contributing to the projects via GitHub Sponsors: **[sponsor Mubelotix](https://github.com/sponsors/Mubelotix)**.

> 👉 Consider checking out **[SimRepo](https://github.com/Mubelotix/SimRepo)**: a browser extension that embeds a recommendation engine into GitHub to help you discover related projects and alternative libraries.

---

👇 **THIS** is a **`live`** chart. Follow [instruction](https://star-history.dera.page/torvalds/linux) to embed yours.

<a href="https://star-history.dera.page/#torvalds/linux&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://star-history.dera.page/svg?repos=torvalds%2Flinux&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://star-history.dera.page/svg?repos=torvalds%2Flinux&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://star-history.dera.page/svg?repos=torvalds%2Flinux&type=date&legend=top-left" />
 </picture>
</a>

## ✨ Features

- **Doesn't require API tokens;**
- Unique `sketch xkcd` feeling chart;
- One-click generation of high-quality image for chart;
- Support multiple chart view mode based on date or timeline;
- Embed the real-time chart into GitHub readme or other websites (like the one we embed here on the top);
- And various useful functions:
  - toggle repo visibility;
  - shortcut to input repo;
  - support input multiple repos;
  - ...waiting for you to find out!

## 🌠 Screenshots

<a href="https://star-history.dera.page"><img width="800px" src="https://user-images.githubusercontent.com/24653555/154391264-312b448b-f851-41bf-bb8d-4c21ec6795b6.gif" />
</a>

## 🏗 Development

> We do not accept external contribution.

**`Star-history`** is built using a **modern tech stack**: **`Next.js`** + **`TailwindCSS`**.

### Prerequisites

- [Node.js](https://nodejs.org/en/download/)
- [pnpm](https://pnpm.io/)

### Homepage

**Homepage** of star-history with most of useful features.

```shell
cd frontend && pnpm i && pnpm dev
```

The website will be served at http://localhost:3000.

### API Server

**API server** is an **`experimental feature`**. It's mainly used to **generate chart `SVG`** image file that can be embeded into **`GitHub readme`**.

```shell
cd backend && pnpm i && pnpm dev
```

The API server will be running on http://localhost:8080.
