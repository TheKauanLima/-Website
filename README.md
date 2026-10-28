# Portfolio Website

A colorful, animated personal portfolio with tabs for Home, Projects, Art, Music, Pictures, About and Contact, and links to GitHub, LinkedIn and other profiles.

- **Frontend:** vanilla HTML/CSS/JS in `public/`, with no build step.
- **Backend:** a Node.js server in `server/` with zero dependencies. It serves the site and adds a small API (content and contact form).

## Quick start

```sh
npm start        # http://127.0.0.1:3000
npm test         # run all tests
```

Nothing needs to be installed beyond Node 20 or newer.

## Make it yours

All text, links, images and music live in **`public/data/content.json`**. Search it for `YOUR` and replace every placeholder. To replace the art, photos, project images or audio, drop your files into `public/media/` and point `content.json` at them. See [docs/CONTENT-GUIDE.md](docs/CONTENT-GUIDE.md).

The `<noscript>` fallback in `public/index.html` also contains your GitHub and LinkedIn URLs, so update them there too.

## Deploying

- **Static hosting** (GitHub Pages, Netlify, …): publish the `public/` folder as is. The site loads `data/content.json` directly. The contact section falls back to a mailto link.
- **With the Node server:** run `npm start` on any host with Node. The contact form then saves messages to `data/messages.ndjson`. See [docs/SERVER.md](docs/SERVER.md).

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): design spec, API contract and acceptance criteria
- [docs/CONTENT-GUIDE.md](docs/CONTENT-GUIDE.md): editing content and media
- [docs/SERVER.md](docs/SERVER.md): running and configuring the server

## Animations

The site respects your OS "reduce motion" setting. If animations look frozen, either turn on Windows' *Settings → Accessibility → Visual effects → Animation effects*, or press the play/pause button in the site header.
