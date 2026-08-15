## Website

The website is built using a **modern tech stack**: **`Next.js`** + **`TailwindCSS`**.

Contributions are welcome, especially those that give the website a more modern look. Reviews are made by humans, so keep your changes focused and prefer submitting multiple small pull requests over one large one.

```shell
pnpm i && pnpm dev
```

This runs both the frontend and the backend concurrently. The website will be served at http://localhost:3000, and the API server (used to generate chart **`SVG`** images for **`GitHub readme`**) on http://localhost:8080.

## Extension

### Requirements

- Node and npm installed
- An UNIX-like operating system

### 🛠 Build locally

1. Run `npm install` to install all required dependencies
2. Run `npm run build`

The build step will create the `distribution` folder, this folder will contain the generated extension.

### 🏃 Run the extension

Using [web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/) is recommended for automatic reloading and running in a dedicated browser instance. Alternatively you can load the extension manually (see below).

1. Run `npm run watch` to watch for file changes and build continuously
2. Run `npm install --global web-ext` (only only for the first time)
3. In another terminal, run `web-ext run -t firefox-desktop`
4. Check that the extension is loaded by opening the extension options ([in Firefox](extension/media/extension_options_firefox.png) or [in Chrome](extension/media/extension_options_chrome.png)).

#### Manually

You can also [load the extension manually in Chrome](https://www.smashingmagazine.com/2017/04/browser-extension-edge-chrome-firefox-opera-brave-vivaldi/#google-chrome-opera-vivaldi) or [Firefox](https://www.smashingmagazine.com/2017/04/browser-extension-edge-chrome-firefox-opera-brave-vivaldi/#mozilla-firefox).
