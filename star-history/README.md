<div align="center">

<a href="https://star-history.dera.page/Mubelotix/star-history">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/badge?repo=Mubelotix/star-history&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/badge?repo=Mubelotix/star-history" />
   <img alt="Star History Rank" src="https://api.star-history.com/badge?repo=Mubelotix/star-history" />
 </picture>
</a>

# :sparkles: Star History :sparkles:
 
[**star-history.dera.page**](https://star-history.dera.page), **the de facto GitHub star history graph.**

</div>

---

👇 **THIS** is a **`live`** chart. Follow [instruction](https://star-history.dera.page/Mubelotix/star-history) to embed yours.

<a href="https://star-history.dera.page/?repos=Mubelotix%2Fstar-history&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=Mubelotix/star-history&type=date&theme=dark&legend=top-left&sealed_token=DYeTWCAopiiE2umbQNPumg8YbPnyodS4lGzIhhCvVVvIuGqF2y_EHByyowTpVnmds-frpmYYKc_awzVeAxZ7O3gT7Mu6l8V7DlZ8BaIkBoGcWPhLwZrdWA" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=Mubelotix/star-history&type=date&legend=top-left&sealed_token=DYeTWCAopiiE2umbQNPumg8YbPnyodS4lGzIhhCvVVvIuGqF2y_EHByyowTpVnmds-frpmYYKc_awzVeAxZ7O3gT7Mu6l8V7DlZ8BaIkBoGcWPhLwZrdWA" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=Mubelotix/star-history&type=date&legend=top-left&sealed_token=DYeTWCAopiiE2umbQNPumg8YbPnyodS4lGzIhhCvVVvIuGqF2y_EHByyowTpVnmds-frpmYYKc_awzVeAxZ7O3gT7Mu6l8V7DlZ8BaIkBoGcWPhLwZrdWA" />
 </picture>
</a>

<div align="left">
  
👇 **THIS** is also a **`live`** badge with global rank. Follow [instruction](https://star-history.dera.page/Mubelotix/star-history#badges) to embed yours.

<p align="left">
 <a href="https://star-history.dera.page/Mubelotix/star-history">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/badge?repo=Mubelotix/star-history&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/badge?repo=Mubelotix/star-history" />
    <img alt="Star History Rank" src="https://api.star-history.com/badge?repo=Mubelotix/star-history" />
  </picture>
 </a>
</p>

</div>

## ✨ Features

- **Unique** **`sketch xkcd`** feeling **chart**;
- **One-click** generation of **high-quality** image for chart;
- Support **multiple chart view** mode **`based on date or timeline`**;
- **Embed** the **real-time chart** into **`GitHub readme or other websites`** **(like the one we embed here on the top)**
- And **various** useful **functions**:
  - toggle **repo visibility**;
  - **shortcut** to input repo;
  - **share** on **`Twitter`** **quickly**;
  - **support** input **multiple repos**;
  - ...waiting **for you** to **find out!**

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
