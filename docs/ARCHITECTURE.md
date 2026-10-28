# Portfolio Website: Architecture Spec (v1)

Project root: `C:\Users\theka\Documents\!Website`. I checked it and it is empty. Node is v24.14.1.

Architecture in brief:
- The site is a static frontend in `public/`, which is also the static web root.
- A zero-dependency Node server in `server/` serves `public/` and adds `/api/*`.
- All site content lives in one file, `public/data/content.json`.
- The frontend asks `api/content` for the content first. If that fails, it fetches the same file statically (`data/content.json`). This is why the site works on GitHub Pages with no changes.

Everything is ESM. `package.json` has `"type": "module"`.

---

## 1. Directory tree

```
!Website/
├── package.json                  [BE] Zero dependencies. Scripts: start, dev, test. "type":"module", "private":true, engines node>=20
├── .gitignore                    [BE] Ignores /data/ (root-anchored runtime messages; must NOT match public/data/), node_modules/, *.log
├── README.md                     [ORCH] Short overview; links to the docs below
├── docs/
│   ├── ARCHITECTURE.md           [ORCH] This spec
│   ├── CONTENT-GUIDE.md          [FE] How the owner edits content.json and replaces media (no code)
│   └── SERVER.md                 [BE] How to run, env vars, messages file, static deploy notes
├── scripts/
│   └── generate-placeholders.mjs [FE] Zero-dep Node script that writes every placeholder SVG and sample-tone.wav into public/media
├── public/                       Static web root (this folder is what gets deployed to GitHub Pages)
│   ├── index.html                [FE] App shell: skip link, header/nav, <main>, footer, bg layer, meta CSP, module script
│   ├── favicon.svg               [FE] Gradient monogram icon
│   ├── robots.txt                [FE] Allows everything
│   ├── css/
│   │   ├── tokens.css            [FE] Color/space/type/motion tokens for dark + light themes
│   │   ├── base.css              [FE] Reset, typography, focus styles, .visually-hidden, skip link
│   │   ├── layout.css            [FE] Header, nav (desktop + mobile), main container, view sections, footer, grids
│   │   ├── components.css        [FE] Buttons, cards, chips, gallery, lightbox, music player/facade, form, toggles
│   │   └── animations.css        [FE] Keyframes, bg blobs, reveal classes, view transitions, reduced-motion overrides
│   ├── js/
│   │   ├── main.js               [FE] Bootstrap: init theme/motion, load content, build header/footer, register views, start router
│   │   ├── content-loader.js     [FE] API-first load with timeout, then static fallback; returns {content, source}
│   │   ├── router.js             [FE] Hash router: lazy view mount, show/hide, aria-current, title, focus management
│   │   ├── lib/
│   │   │   ├── dom.js            [FE] h(tag, attrs, ...children) element builder (textContent only), clear(el)
│   │   │   ├── urls.js           [FE] DOM-free: safeHref(), safeMediaSrc(), toEmbedUrl(), isAllowedEmbedHost()
│   │   │   ├── normalize.js      [FE] DOM-free: normalizeContent(raw) fills defaults and drops invalid entries
│   │   │   ├── motion.js         [FE] Reduced-motion state (system + user toggle), onMotionChange, observeReveals()
│   │   │   └── theme.js          [FE] Theme state (system/dark/light), toggle, persists to localStorage
│   │   ├── components/
│   │   │   ├── header.js         [FE] Brand, nav links from content.nav, mobile menu button, theme + motion toggles
│   │   │   ├── footer.js         [FE] Social links, footerNote, "data source" hint in dev only (see §4.7)
│   │   │   ├── social-links.js   [FE] Renders content.links as icon+label anchors
│   │   │   ├── icons.js          [FE] Constant inline SVG strings keyed by icon name (the only innerHTML allowed)
│   │   │   ├── gallery.js        [FE] Shared responsive image grid for Art + Pictures; opens the lightbox
│   │   │   ├── lightbox.js       [FE] <dialog>-based lightbox: prev/next, keys, swipe, caption, focus restore
│   │   │   └── contact-form.js   [FE] Form with client validation mirroring the API; mailto fallback
│   │   └── views/
│   │       ├── home.js           [FE] Hero (gradient name, rotating roles, tagline, CTAs, socials), highlights, featured projects
│   │       ├── projects.js       [FE] Filterable (by tag) project card grid
│   │       ├── art.js            [FE] Art gallery
│   │       ├── music.js          [FE] Track list: click-to-load embed facades + native <audio>
│   │       ├── pictures.js       [FE] Photo gallery
│   │       ├── about.js          [FE] Bio paragraphs, skills groups, timeline, facts, résumé button
│   │       └── contact.js        [FE] Contact heading/blurb, email, contact-form component
│   ├── data/
│   │   └── content.json          [FE creates; schema is frozen by §2] THE single content file
│   └── media/
│       ├── avatar.svg            [FE, generated] 512x512 gradient avatar placeholder
│       ├── projects/project-1.svg … project-3.svg   [FE, generated] 1200x750
│       ├── art/art-1.svg … art-6.svg                [FE, generated] mixed 1200x1500 / 1500x1200 / 1200x1200
│       ├── pictures/picture-1.svg … picture-6.svg   [FE, generated] 1600x1067 / 1067x1600
│       └── music/cover-1.svg, cover-2.svg, sample-tone.wav   [FE, generated] covers 600x600; ~3s sine chord, 22.05kHz mono 16-bit
├── server/
│   ├── server.js                 [BE] Entry: loadConfig(), http.createServer(createApp(cfg)), timeouts, listen, graceful shutdown
│   ├── app.js                    [BE] createApp(options) → (req,res) handler: URL checks, security headers, dispatch, logging
│   ├── config.js                 [BE] loadConfig(env) → resolved absolute paths + numbers (paths relative to project root, not cwd)
│   ├── routes/
│   │   ├── health.js             [BE] GET/HEAD /api/health
│   │   ├── content.js            [BE] GET/HEAD /api/content (read file per request, ETag, schema warnings)
│   │   └── contact.js            [BE] POST /api/contact pipeline
│   └── lib/
│       ├── http.js               [BE] sendJson, sendError, readBody(limit), applySecurityHeaders, getClientIp
│       ├── static.js             [BE] Secure static file serving (traversal guard, ETag/304, Range, caching)
│       ├── mime.js               [BE] Extension → Content-Type map
│       ├── rate-limit.js         [BE] createRateLimiter({windowMs,max,now}) sliding window, in-memory
│       ├── validate-contact.js   [BE] validateContact(body) → {ok, value, details}
│       ├── content-schema.js     [BE] validateContent(obj) → {valid, errors:[{path,message}]} implementing §2 rules
│       └── message-store.js      [BE] createMessageStore(file, {maxBytes}) → append(record) (serialized queue, mkdir -p)
├── data/                         Runtime only, gitignored, created on first message. Never served.
│   └── messages.ndjson
└── tests/
    ├── helpers/
    │   └── server.js             [BE] startTestServer(opts) → {baseUrl, port, close}; rawRequest(port, method, rawPath, headers, body)
    ├── fixtures/
    │   ├── public/               [BE] index.html, css/site.css, js/app.js, img/pic.svg, audio/clip.wav, .secret, sub/index.html
    │   ├── content.valid.json    [BE] Minimal valid content
    │   └── content.broken.json   [BE] Invalid JSON text
    ├── server/
    │   ├── static.test.js        [BE] MIME, index, 304, Range, traversal, dotfiles, 405, 414
    │   ├── health.test.js        [BE]
    │   ├── content.test.js       [BE] 200/ETag/304/500
    │   ├── contact.test.js       [BE] Full pipeline incl. origin, 415, 413, 400, 422, honeypot, 429, storage
    │   ├── rate-limit.test.js    [BE] Unit test with injected clock
    │   ├── validate-contact.test.js [BE] Unit
    │   └── content-schema.test.js   [BE] Unit tests of validator against fixtures
    ├── content-file.test.js      [BE] Validates the REAL public/data/content.json with content-schema.js (skips if file missing)
    └── frontend/
        ├── urls.test.js          [FE] Unit tests of public/js/lib/urls.js in Node (DOM-free)
        └── normalize.test.js     [FE] Unit tests of public/js/lib/normalize.js in Node (DOM-free)
```

`package.json` scripts:
```json
"scripts": {
  "start": "node server/server.js",
  "dev": "node --watch server/server.js",
  "test": "node --test \"tests/**/*.test.js\""
}
```

---

## 2. Content file

**Location:** `public/data/content.json`. The server serves it as `/api/content` and, because it sits in the static root, also as `/data/content.json`.

**Rules for the owner:**
- Plain text only. No HTML is interpreted anywhere.
- Every placeholder contains the uppercase marker `YOUR-` or `YOUR `, so the owner can search for "YOUR" to find all of them.
- Setting a URL to `""` hides that link or button.
- Media paths are relative to `public/` with no leading slash (for example `media/art/art-1.svg`), or absolute `https://` URLs.

### 2.1 Example (this is also the initial file FE commits)

```json
{
  "schemaVersion": 1,
  "site": {
    "title": "YOUR NAME — Portfolio",
    "description": "Portfolio of YOUR NAME: YOUR-ROLE. Projects, art, music and photography.",
    "lang": "en",
    "themeDefault": "system",
    "footerNote": "© 2026 YOUR NAME. Built by hand with HTML, CSS & JS."
  },
  "profile": {
    "name": "YOUR NAME",
    "role": "YOUR-ROLE (e.g. Software Engineer)",
    "roles": ["YOUR-ROLE 1", "YOUR-ROLE 2", "YOUR-ROLE 3"],
    "tagline": "YOUR one-sentence pitch to employers goes here.",
    "location": "YOUR-CITY, YOUR-COUNTRY",
    "avatar": "media/avatar.svg",
    "avatarAlt": "Portrait of YOUR NAME",
    "availability": "Open to opportunities",
    "resumeUrl": ""
  },
  "links": [
    { "id": "github",   "label": "GitHub",   "url": "https://github.com/YOUR-USERNAME",        "icon": "github",   "showInHero": true },
    { "id": "linkedin", "label": "LinkedIn", "url": "https://www.linkedin.com/in/YOUR-HANDLE", "icon": "linkedin", "showInHero": true },
    { "id": "email",    "label": "Email",    "url": "mailto:YOUR-EMAIL@example.com",           "icon": "email",    "showInHero": true },
    { "id": "instagram","label": "Instagram","url": "",                                        "icon": "instagram","showInHero": false },
    { "id": "soundcloud","label": "SoundCloud","url": "",                                      "icon": "soundcloud","showInHero": false }
  ],
  "nav": [
    { "id": "home",     "label": "Home" },
    { "id": "projects", "label": "Projects" },
    { "id": "art",      "label": "Art" },
    { "id": "music",    "label": "Music" },
    { "id": "pictures", "label": "Pictures" },
    { "id": "about",    "label": "About" },
    { "id": "contact",  "label": "Contact" }
  ],
  "home": {
    "headline": "Hi, I'm YOUR NAME.",
    "intro": "YOUR short intro paragraph: what you build, what you care about, what you're looking for.",
    "highlights": [
      { "value": "YOUR-N+", "label": "Years building software" },
      { "value": "YOUR-N",  "label": "Shipped projects" },
      { "value": "YOUR-N",  "label": "Artworks" }
    ],
    "cta": [
      { "label": "See my projects", "href": "#projects" },
      { "label": "Get in touch",    "href": "#contact" }
    ],
    "featuredProjectIds": ["project-1"]
  },
  "about": {
    "heading": "About me",
    "paragraphs": [
      "YOUR first bio paragraph.",
      "YOUR second bio paragraph."
    ],
    "skills": [
      { "group": "Languages", "items": ["YOUR-SKILL", "YOUR-SKILL"] },
      { "group": "Tools",     "items": ["YOUR-TOOL", "YOUR-TOOL"] }
    ],
    "timeline": [
      { "period": "YOUR-YEAR — Present", "title": "YOUR-JOB-TITLE", "org": "YOUR-COMPANY", "description": "YOUR one-line summary of the role." }
    ],
    "facts": ["YOUR fun fact #1", "YOUR fun fact #2"]
  },
  "projects": [
    {
      "id": "project-1",
      "title": "YOUR PROJECT 1",
      "summary": "One-line summary of YOUR PROJECT 1 (max 160 chars).",
      "description": "Longer description: problem, what you did, result.",
      "image": "media/projects/project-1.svg",
      "imageAlt": "Screenshot of YOUR PROJECT 1",
      "year": "2026",
      "role": "YOUR-ROLE on this project",
      "tags": ["JavaScript", "Node.js"],
      "links": [
        { "label": "Live demo", "url": "" },
        { "label": "Source",    "url": "https://github.com/YOUR-USERNAME/YOUR-REPO" }
      ],
      "featured": true
    }
  ],
  "art": [
    {
      "id": "art-1",
      "title": "YOUR ARTWORK 1",
      "src": "media/art/art-1.svg",
      "alt": "Describe YOUR ARTWORK 1 for screen-reader users",
      "caption": "YOUR caption",
      "year": "2026",
      "medium": "Digital",
      "width": 1200,
      "height": 1500
    }
  ],
  "music": {
    "intro": "YOUR short intro about your music.",
    "tracks": [
      {
        "id": "track-1",
        "title": "YOUR TRACK (embed)",
        "artist": "YOUR NAME",
        "description": "Paste a SoundCloud, Spotify, YouTube or Bandcamp link in url.",
        "type": "embed",
        "url": "https://soundcloud.com/YOUR-USERNAME/YOUR-TRACK",
        "cover": "media/music/cover-1.svg",
        "coverAlt": "Cover art for YOUR TRACK"
      },
      {
        "id": "track-2",
        "title": "YOUR TRACK (local file)",
        "artist": "YOUR NAME",
        "description": "Drop an .mp3/.ogg/.wav into public/media/music and point url at it.",
        "type": "audio",
        "url": "media/music/sample-tone.wav",
        "cover": "media/music/cover-2.svg",
        "coverAlt": "Cover art for YOUR TRACK"
      }
    ]
  },
  "pictures": [
    {
      "id": "picture-1",
      "src": "media/pictures/picture-1.svg",
      "alt": "Describe YOUR PHOTO 1",
      "caption": "YOUR caption",
      "location": "YOUR-PLACE",
      "date": "2026-01",
      "width": 1600,
      "height": 1067
    }
  ],
  "contact": {
    "heading": "Let's talk",
    "blurb": "YOUR note to employers: what roles you're interested in and how to reach you.",
    "email": "YOUR-EMAIL@example.com",
    "formEnabled": true
  }
}
```
The committed file must contain 3 projects, 6 art items, 6 pictures and 2 tracks, matching the generated media.

### 2.2 Validation rules

`server/lib/content-schema.js` implements these rules and `tests/content-file.test.js` enforces them. `normalize.js` on the frontend tolerates any violation: it applies the default or drops the entry, and never throws.

Types: **str** = string, **str?** = optional string (default `""`), **url** = see the URL rules below.

| Path | Rule |
|---|---|
| `schemaVersion` | required, number, `=== 1` |
| `site.title` | str, 1–80 chars |
| `site.description` | str?, ≤200 |
| `site.lang` | str?, default `"en"` |
| `site.themeDefault` | one of `"system"`,`"dark"`,`"light"`; default `"system"` |
| `site.footerNote` | str? |
| `profile.name`, `profile.role` | str, 1–80 |
| `profile.roles` | array of str (0–6), optional, default `[]` |
| `profile.tagline` ≤200, `location`, `availability`, `avatarAlt` | str? |
| `profile.avatar` | media path or `""` |
| `profile.resumeUrl` | url or `""` |
| `links[]` | array ≤20. `id` slug `^[a-z0-9-]+$`, unique; `label` str 1–40; `url` url or `""`; `icon` ∈ ICONS; `showInHero` bool (default true) |
| `nav[]` | array 1–7. `id` ∈ `home, projects, art, music, pictures, about, contact`, unique; `label` str 1–24. The first entry is the default route |
| `home.headline` str; `home.intro` str? | |
| `home.highlights[]` | ≤4 of `{value: str ≤12, label: str ≤40}` |
| `home.cta[]` | ≤3 of `{label: str, href: "#<navId>" or url}` |
| `home.featuredProjectIds[]` | str; each must match a `projects[].id` |
| `about.heading` str; `paragraphs[]` str; `skills[]` `{group: str, items: str[]}`; `timeline[]` `{period, title, org?, description?}`; `facts[]` str | |
| `projects[]` | ≤50. `id` slug unique; `title` 1–80; `summary` ≤160; `description?`; `image` media path or `""`; `imageAlt` required non-empty if image set; `year?`, `role?`; `tags` str[] ≤8; `links[]` `{label, url}`; `featured` bool |
| `art[]`, `pictures[]` | ≤100. `id` slug unique within array; `src` media path (required); `alt` non-empty str (required); `title?`, `caption?`, `year?`, `medium?` (art), `location?`, `date?` (pictures); `width`/`height` optional positive integers |
| `music.intro` str? | |
| `music.tracks[]` | ≤30. `id` slug unique; `title` 1–80; `artist?`, `description?`; `type` ∈ `"embed"`,`"audio"`; `url`: for `embed` an `https://` URL on the embed allowlist; for `audio` a media path ending in `.mp3/.ogg/.wav/.m4a/.opus/.flac` or an https URL; `cover?` media path; `coverAlt?` |
| `contact.heading` str; `blurb?`; `email` str (may be `""`); `formEnabled` bool (default true) | |
| Unknown keys | allowed but produce a warning (not an error) |

- **ICONS** = `github, linkedin, email, instagram, soundcloud, spotify, youtube, bandcamp, x, bluesky, mastodon, behance, dribbble, artstation, website, resume, link`. Any other value renders the `link` icon.
- **url** = `https://…`, `http://…`, `mailto:…`, a `#` hash, or a relative path.
- **media path** = either `https://…`, or a relative path matching `^[A-Za-z0-9._\-/]+$` that does not start with `/` and contains no `..`.
- **Embed allowlist (hostnames):** `soundcloud.com`, `w.soundcloud.com`, `open.spotify.com`, `www.youtube.com`, `youtube.com`, `youtu.be`, `www.youtube-nocookie.com`, `bandcamp.com`, `embed.music.apple.com`.

---

## 3. API contract

General rules for all endpoints:
- Base paths are relative to the site root.
- All `/api/*` responses are JSON with `Content-Type: application/json; charset=utf-8`.
- No CORS headers. The API is same-origin only.
- Unknown `/api/*` path returns **404** `NOT_FOUND`.
- A known path with the wrong method returns **405** `METHOD_NOT_ALLOWED` with an `Allow` header.

**Error shape (every non-2xx API response):**
```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Human-readable summary.", "details": { "email": "Email address is invalid." } } }
```
`details` is present only for `VALIDATION_FAILED`. Responses never include stack traces.

Error codes: `BAD_REQUEST`, `NOT_FOUND`, `METHOD_NOT_ALLOWED`, `URI_TOO_LONG`, `FORBIDDEN_ORIGIN`, `RATE_LIMITED`, `UNSUPPORTED_MEDIA_TYPE`, `PAYLOAD_TOO_LARGE`, `INVALID_JSON`, `VALIDATION_FAILED`, `CONTENT_UNAVAILABLE`, `STORAGE_UNAVAILABLE`, `INTERNAL_ERROR`.

### 3.1 `GET|HEAD /api/health`
- **200** `{ "status": "ok", "uptime": 12.345, "time": "2026-09-28T17:00:00.000Z" }`. `uptime` is `process.uptime()` in seconds; `time` is ISO 8601.
- `Cache-Control: no-store`.

### 3.2 `GET|HEAD /api/content`
- The server reads `CONTENT_FILE` on every request, so edits show up without a restart.
- **200**: the body is exactly the file's parsed JSON, re-serialized. There is no wrapper, so the API and static sources are identical to the frontend.
- Headers: `Cache-Control: no-cache` and `ETag: "<sha1 of file bytes, base64url>"`.
- If `If-None-Match` matches the ETag, respond **304** with an empty body.
- If schema validation finds errors, still respond 200 and log the errors once per distinct ETag with `console.warn`.
- File missing or unreadable, or invalid JSON: **500** `CONTENT_UNAVAILABLE`.

### 3.3 `POST /api/contact`
The server runs these steps in this exact order. The first failure wins.

1. Method must be POST. Otherwise **405** with `Allow: POST`.
2. **Origin check.** If an `Origin` header is present and its host (`new URL(origin).host`) does not equal the `Host` header, respond **403** `FORBIDDEN_ORIGIN`. A missing Origin is allowed.
3. **Rate limit.** The key is the client IP: `req.socket.remoteAddress`, or, only when `TRUST_PROXY=1`, the **rightmost** `X-Forwarded-For` entry (the one appended by the trusted proxy), accepted only if `net.isIP()` is non-zero, otherwise `remoteAddress`. Sliding window: **5 requests per 10 minutes per IP**. Every POST that reaches this step counts. When exceeded, respond **429** `RATE_LIMITED` with `Retry-After: <seconds, integer ceil>`.
4. `Content-Type` must start with `application/json`. Otherwise **415** `UNSUPPORTED_MEDIA_TYPE`.
5. **Size limit: 32768 bytes.** If `Content-Length` exceeds the limit, respond **413** immediately without reading the body. While streaming, if the running total exceeds the limit, respond **413** and destroy the request.
6. `JSON.parse` failure: **400** `INVALID_JSON`. A parsed value that is not a plain object (array, null, primitive) is also **400** `INVALID_JSON`.
7. **Validation** (`validate-contact.js`). Lengths are counted in code points (`[...s].length`) after sanitizing and trimming. Any failure gives **422** `VALIDATION_FAILED` with `details` keyed by field. These message strings are exact:
   - **Sanitizing:**
     - `name` and `email`: remove `[\u0000-\u001F\u007F]`.
     - `message`: normalize `\r\n` to `\n`, then remove `[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]`.
   - `name` (required, 1–100):
     - missing, not a string, or empty: `"Name is required."`
     - too long: `"Name must be at most 100 characters."`
   - `email` (required, ≤254, regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`):
     - missing or empty: `"Email is required."`
     - bad format: `"Email address is invalid."`
     - too long: `"Email must be at most 254 characters."`
   - `message` (required, 10–5000):
     - missing or empty: `"Message is required."`
     - too short: `"Message must be at least 10 characters."`
     - too long: `"Message must be at most 5000 characters."`
   - Unknown fields are ignored.
8. **Honeypot.** If `website` is a non-empty string, respond **201** with the normal success shape and a random id, but do not store anything.
9. **Store.** Append one JSON line to `MESSAGES_FILE`:
   ```json
   {"id":"<uuid>","receivedAt":"<ISO>","name":"...","email":"...","message":"...","ip":"...","userAgent":"<first 200 chars>"}
   ```
   - Create the directory if needed.
   - Serialize writes through a promise queue.
   - If the file is already ≥ 5 MB (`MESSAGES_MAX_BYTES`), respond **503** `STORAGE_UNAVAILABLE`.
   - Any write error: **500** `INTERNAL_ERROR`.
10. **201** `{ "ok": true, "id": "<crypto.randomUUID()>", "receivedAt": "<ISO>" }`

All contact responses carry `Cache-Control: no-store`.

**Request example:**
```http
POST /api/contact
Content-Type: application/json

{"name":"Ada","email":"ada@example.com","message":"Hello, I'd like to talk about a role.","website":""}
```

### 3.4 Static files (everything not under `/api/`)
- **Methods:**
  - GET and HEAD only. Anything else gets **405** (`Allow: GET, HEAD`, plain-text body).
  - HEAD returns the same headers as GET with no body.
- **Paths:**
  - `/` serves `index.html`.
  - A directory path ending in `/` serves its `index.html`, or 404 if there is none.
  - A directory path without a trailing slash gets a **301** to the path plus `/`, keeping the query string.
  - There is never a directory listing.
- **Caching:**
  - Every file gets `ETag: W/"<size hex>-<mtimeMs floor hex>"` and `Last-Modified`.
  - `If-None-Match` match returns **304**.
  - `Cache-Control`:
    - `.html`, `.css`, `.js`, `.mjs`, `.json`: `no-cache`. There is no build step and no hashed filenames, so the browser always revalidates.
    - All other types: `public, max-age=604800`.
- **Range:**
  - Send `Accept-Ranges: bytes` on files.
  - A single range `bytes=a-b`, `bytes=a-` or `bytes=-n` returns **206** with `Content-Range`.
  - An unsatisfiable or multi-range request returns **416** with `Content-Range: bytes */size`. Safari audio seeking needs this.
- **Errors:**
  - Not found: **404** with a tiny HTML body `<h1>404 Not Found</h1>` and a link to `./`.
  - Malformed percent-encoding: **400**.
  - URL longer than 2048 chars: **414**. For `/api/*` this is JSON `URI_TOO_LONG`.

**MIME map (`mime.js`).** Text types get `; charset=utf-8` appended.

| Extension | Content-Type |
|---|---|
| html | text/html |
| css | text/css |
| js, mjs | text/javascript |
| json | application/json |
| webmanifest | application/manifest+json |
| txt | text/plain |
| xml | application/xml |
| svg | image/svg+xml |
| png | image/png |
| jpg, jpeg | image/jpeg |
| gif | image/gif |
| webp | image/webp |
| avif | image/avif |
| ico | image/x-icon |
| mp3 | audio/mpeg |
| ogg, opus | audio/ogg |
| wav | audio/wav |
| m4a | audio/mp4 |
| flac | audio/flac |
| mp4 | video/mp4 |
| webm | video/webm |
| woff2 | font/woff2 |
| woff | font/woff |
| pdf | application/pdf |
| (anything else) | application/octet-stream |

### 3.5 Server config (`config.js`, env vars)

| Env var | Default | Notes |
|---|---|---|
| `PORT` | `3000` | |
| `HOST` | `127.0.0.1` | |
| `PUBLIC_DIR` | `public` | |
| `CONTENT_FILE` | `public/data/content.json` | |
| `MESSAGES_FILE` | `data/messages.ndjson` | |
| `MESSAGES_MAX_BYTES` | `5242880` | |
| `RATE_LIMIT_MAX` | `5` | |
| `RATE_LIMIT_WINDOW_MS` | `600000` | |
| `TRUST_PROXY` | `0` | |

Relative paths resolve against the project root (`fileURLToPath(new URL('..', import.meta.url))`), not the working directory.

Interface: `createApp({ publicDir, contentFile, messagesFile, messagesMaxBytes, rateLimit: {max, windowMs}, trustProxy, now = Date.now, logger = console | null })` returns a `(req, res)` handler.

`server.js` sets these on the server:
- `server.requestTimeout = 15000`
- `server.headersTimeout = 10000`
- `server.keepAliveTimeout = 5000`

It prints `Portfolio running at http://HOST:PORT` on startup and closes cleanly on SIGINT/SIGTERM.

Logging is one line per request: `METHOD path status ms`. Never log request bodies.

---

## 4. Frontend design

### 4.1 Module responsibilities and interfaces
- **`main.js`**
  1. Call `initTheme()` and `initMotion()`.
  2. Call `loadContent()`, then `normalizeContent()`.
  3. Set `document.documentElement.lang`, `document.title` and the meta description.
  4. Render the header and footer.
  5. Build the routes from `content.nav` and call `createRouter(...).start()`.
  6. Wire the skip link.

  On a load failure it renders an error card in `<main>` with a Retry button that re-runs bootstrap.
- **`content-loader.js`**: `export async function loadContent({ timeoutMs = 3000 } = {}) → { content, source: 'api' | 'static' }`. Throws `Error` with `.code = 'CONTENT_LOAD_FAILED'`, or `'FILE_PROTOCOL'` when `location.protocol === 'file:'`. For that case the error card says to run `npm start` or use a static server.
- **`lib/normalize.js`** (DOM-free): `export function normalizeContent(raw) → Content`. It never throws. It:
  - applies defaults from §2;
  - drops array entries that miss required fields;
  - removes links with an empty or unsafe url;
  - maps unknown icons to `link`;
  - drops nav ids that are not in the fixed set (if nothing is left, uses `[{id:'home',label:'Home'}]`);
  - drops tracks whose url is not allowed.
- **`lib/urls.js`** (DOM-free):
  - `safeHref(url) → string|null`: allows http, https, mailto, `#…`, relative.
  - `safeMediaSrc(path) → string|null`: follows the media path rule.
  - `isAllowedEmbedHost(url) → boolean`.
  - `toEmbedUrl(url) → { src, provider } | null`, which converts:
    - `youtube.com/watch?v=ID`, `youtu.be/ID` or `/embed/ID` → `https://www.youtube-nocookie.com/embed/ID`, provider `youtube`
    - `open.spotify.com/{track|album|playlist|artist|episode}/ID` → `https://open.spotify.com/embed/{type}/ID`, provider `spotify`
    - `soundcloud.com/...` → `https://w.soundcloud.com/player/?url=<encoded original>&color=%23ff4d8d&visual=true`
    - `w.soundcloud.com/player/...` → passes through, provider `soundcloud`
    - `bandcamp.com/EmbeddedPlayer/...` and `embed.music.apple.com/...` → pass through
    - anything else → `null`
- **`lib/dom.js`**:
  - `h(tag, attrs, ...children)`. Children are strings (inserted as text nodes) or Nodes. Attributes are set with `setAttribute`. Keys beginning with `on` attach listeners. The `style` key is **forbidden**; use `el.style.setProperty` instead.
  - `clear(el)`.
  - **Rule: content is never passed to `innerHTML`.** The only innerHTML use is `icons.js` constants.
- **`lib/motion.js`**:
  - `initMotion()`: state comes from `localStorage['pf-motion']` (`'reduced'|'full'`), else from `matchMedia('(prefers-reduced-motion: reduce)')`. It sets `<html data-motion="reduced|full">`.
  - `isReducedMotion()`, `setMotion(v)`, `onMotionChange(cb)`.
  - `observeReveals(root)` (see §4.3).
- **`lib/theme.js`**: `initTheme(defaultPref)`, `toggleTheme()`. It sets `<html data-theme="dark|light">`, persists to `localStorage['pf-theme']`, and follows the system setting when unset.
- **`components/header.js`**: `renderHeader(content, { onNavigate })`.
  - Brand link `#home` showing `profile.name`.
  - `<nav aria-label="Primary">` containing a `<ul>` of `<a href="#id">`.
  - Menu button (below 720px): `aria-expanded`, `aria-controls="primary-nav"`. Esc closes it and returns focus to the button; it also closes on route change.
  - Theme toggle and motion toggle are `<button aria-pressed>` with visible labels or `aria-label`s.
- **`components/gallery.js`**: `renderGallery(items, { label }) → HTMLElement`.
  - A `<ul>` grid of `<li><button class="gallery-item">`, each containing an `<img loading="lazy" decoding="async" width height alt>` and a caption.
  - Click opens the lightbox.
  - The aspect ratio comes from width/height, which prevents layout shift.
- **`components/lightbox.js`**: `openLightbox(items /* [{src, alt, caption}] */, startIndex, returnFocusEl)`.
  - Uses a single reusable `<dialog class="lightbox" aria-label="Image viewer">` opened with `showModal()`.
  - Keys: ←/→ move to prev/next; Esc closes (native).
  - Buttons Close, Previous and Next carry `aria-label`s.
  - A counter "3 / 6" sits in an `aria-live="polite"` region.
  - Clicking the backdrop closes it.
  - Pointer swipe with a horizontal threshold of 50px.
  - Neighbor images are preloaded.
  - On close, focus returns to `returnFocusEl`.
- **`components/contact-form.js`**: `renderContactForm(contact, { apiAvailable }) → HTMLElement` (see §4.6).
- **Views**: each exports `render(content, ctx) → HTMLElement`, where `ctx = { apiAvailable, navigate }`. A view's root content must start with `<h1 id="view-<id>-title" tabindex="-1">`. Views with zero items render an empty state ("Nothing here yet, check back soon.") instead of an empty grid.
  - `home.js`:
    - Hero: avatar, gradient `h1` name, rotating role line, tagline, availability badge, CTA buttons, hero socials (`showInHero`).
    - Highlights row.
    - Featured project cards (clicking one navigates to `#projects`).
  - `projects.js`:
    - Tag filter chips: a toolbar of `<button aria-pressed>` with "All" first. Filtering keeps focus and updates an `aria-live` count, e.g. "Showing 2 projects".
    - Cards: image, title (h2), year/role, summary, description, tag chips, and link buttons (external links use `target="_blank" rel="noopener noreferrer"` plus visually-hidden text "(opens in new tab)").
  - `art.js` and `pictures.js`: intro line plus `renderGallery`.
  - `music.js`:
    - Intro, then one card per track.
    - `audio` tracks use a native `<audio controls preload="none" src>` with cover and text.
    - `embed` tracks use a **facade**: a cover image and a `<button>` labelled "Load <provider> player for <title>". The button is replaced by the iframe only on click:
      ```html
      <iframe src=… title="<title> — <provider> player" loading="lazy"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              referrerpolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox">
      ```
      Heights: SoundCloud 166, Spotify 152, YouTube 16:9, others 160.
    - Starting playback of one `<audio>` pauses the others.
  - `about.js`: paragraphs, skills (h2 plus chip lists), timeline (an `<ol>` with gradient connector line), facts, and the résumé button if a URL is set.
  - `contact.js`: heading, blurb, a visible email with a "Copy email" button (Clipboard API, status text "Copied!"), then the form component.

### 4.2 Routing (nav plus hash routing, not the WAI-ARIA tabs pattern)
**Why:** each section is a full page-like view that should be deep-linkable (`/#projects`), work with Back/Forward, and be announced as navigation. The ARIA tabs pattern models an in-page widget with arrow-key roving focus and no history. A `<nav>` of links with `aria-current="page"` is the correct semantics, and GitHub Pages needs no rewrites.

`router.js`: `createRouter({ routes /* Map<id, {label, render}> */, defaultRoute, container /* <main> */ }) → { start(), navigate(id) }`.

Parsing: `id = decodeURIComponent(location.hash.slice(1)).toLowerCase()`.
- Empty hash: show `defaultRoute` and leave the URL unchanged.
- Unknown id: `history.replaceState(null, '', '#' + defaultRoute)` and show the default.

On each route:
1. Lazily render the view once into `<section id="view-<id>" class="view" aria-labelledby="view-<id>-title">`, cache it, and call `observeReveals(section)`.
2. Set `hidden` on all other views and remove `hidden` from the active one.
3. Put the class `view-enter` on the active view for 400ms (skipped when motion is reduced).
4. Set `aria-current="page"` on the matching nav link and remove it from the others.
5. Set `document.title = route === default ? site.title : `${label} · ${site.title}``.
6. `window.scrollTo(0, 0)`.
7. On every route change except the initial load, focus the view's `h1` (`preventScroll: true`).

Listens on `hashchange`.

**Skip link:** `<a class="skip-link" href="#main">Skip to content</a>` needs a JS handler that calls `preventDefault()` and `main.focus()`. Without it the router would treat `#main` as an unknown route.

### 4.3 Animation approach
All animation uses transform and opacity, except the small gradient-text shift.

- **Background.** `<div class="bg" aria-hidden="true">` holds 4 `.blob` divs.
  - Placement: fixed, full viewport, `z-index: -1`.
  - Each blob is a `radial-gradient` circle in brand colors, 40–60vmax, with `filter: blur(60px)` and `opacity: .55` (dark) / `.35` (light).
  - Each blob drifts with its own `@keyframes blob-drift-N` (translate plus scale), 18–30s, `alternate infinite ease-in-out`.
  - The body has a fixed `var(--bg)` color underneath.
- **Hero name:**
  - `background: var(--gradient-text); background-size: 300% 100%; background-clip: text; color: transparent`
  - animated with `@keyframes gradient-shift` over 8s infinite.
- **Rotating roles.**
  - JS cycles `profile.roles` every 2600ms with a `role-swap` fade/slide-up of 350ms.
  - The line sits in an element with `aria-live="off"`.
  - A visually-hidden full list is provided for screen readers.
  - The rotation stops when motion is reduced (it shows `roles[0]`, or `role`).
- **Scroll reveals.**
  - Elements carry `data-reveal`. Supported values: `up` (default), `fade`, `scale`.
  - `observeReveals(root)` uses an `IntersectionObserver` with `threshold 0.15` and `rootMargin '0px 0px -10% 0px'`.
  - When an element intersects it gets `.is-visible` and is unobserved.
  - Stagger: grid children get `el.style.setProperty('--i', index % 8)`, and CSS uses `transition-delay: calc(var(--i, 0) * 60ms)`.
  - Without IntersectionObserver, or with motion reduced, everything is visible immediately.
  - **Content must never be invisible if JS fails.** The hidden starting state applies only under `html.js [data-reveal]:not(.is-visible)`, and `main.js` adds `js` to `<html>`.
- **Cards.**
  - Hover/focus-within: `translateY(-6px)`, a larger shadow, and an animated conic gradient border.
  - The border is a `::before` layer masked to a 2px ring, rotating `@property --angle` with `@keyframes spin-angle` over 6s. It runs on hover only.
- **View transition:** `@keyframes view-in`, from opacity 0 / translateY(12px) to 1 / 0, 400ms `var(--ease-out)`.
- **Buttons:** gradient background with a `background-position` shift on hover, and a `scale(.97)` press.
- **Nav:** the active link gets a gradient pill background with a 250ms transition.
- **Lightbox:** dialog `scale(.96)→1` plus fade-in over 250ms, and a backdrop blur.
- **Reduced motion.**
  - These selectors apply identical rules:
    - `@media (prefers-reduced-motion: reduce) { :root:not([data-motion="full"]) … }`
    - `:root[data-motion="reduced"] …`
  - The rules set, on `*` and its pseudo-elements:
    - `animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; scroll-behavior: auto !important;`
  - Blobs are static.
  - Reveals are visible.
  - The motion toggle in the header ("Pause animations" / "Play animations", `aria-pressed`) satisfies WCAG 2.2.2, because the background animation is infinite.

### 4.4 Theme tokens (`tokens.css`)
Dark is the default. Light applies via `[data-theme="light"]`, or via `@media (prefers-color-scheme: light) { :root:not([data-theme]) }`.

| Token | Dark | Light |
|---|---|---|
| `--bg` | `#0b0b1a` | `#fbf8ff` |
| `--bg-elev` | `#15152b` | `#ffffff` |
| `--surface` | `rgba(255,255,255,.06)` | `rgba(26,21,48,.04)` |
| `--surface-border` | `rgba(255,255,255,.14)` | `rgba(26,21,48,.12)` |
| `--text` | `#f4f3ff` | `#1a1530` |
| `--text-muted` | `#b8b5d6` | `#4a4566` |
| `--accent-text` (links, active text) | `#9fb0ff` | `#5a33d6` |
| `--on-brand` (text on gradient buttons) | `#0b0b1a` | `#0b0b1a` |
| `--focus` | `#ffe066` | `#b3261e` |
| `--danger` | `#ff8080` | `#b3261e` |
| `--success` | `#3ee6c1` | `#0f7a5f` |

**Brand colors (decorative only; never for body text):**
- `--brand-1: #ff4d8d` (pink)
- `--brand-2: #ffb547` (amber)
- `--brand-3: #3ee6c1` (mint)
- `--brand-4: #6c7bff` (indigo)
- `--brand-5: #b86bff` (violet)

**Gradients:**
- `--gradient-brand: linear-gradient(120deg, var(--brand-1), var(--brand-5) 35%, var(--brand-4) 65%, var(--brand-3))`
- `--gradient-text`:
  - dark theme: same stops as `--gradient-brand`
  - light theme: `#c2185b, #7b2ff7, #3346d3, #0f7a5f` (every stop is ≥4.5:1 on `--bg`)

**Other tokens:**
- Spacing: `--space-1…8` = `4, 8, 12, 16, 24, 32, 48, 64px`.
- Radius: `--radius-sm 8px`, `--radius-md 14px`, `--radius-lg 24px`, `--radius-pill 999px`.
- Shadow: `--shadow-1`, `--shadow-glow` (0 10px 40px color-mix of brand-5).
- Type:
  - `--font-sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
  - `--font-mono: ui-monospace, "Cascadia Code", Consolas, monospace`
  - No web fonts.
- Fluid sizes:
  - `--fs-hero: clamp(2.25rem, 6vw + 1rem, 5rem)`
  - `--fs-h1: clamp(1.75rem, 3vw + 1rem, 3rem)`
  - `--fs-h2: clamp(1.25rem, 1.5vw + 1rem, 1.75rem)`
  - `--fs-body: 1rem` (line-height 1.6)
- Motion: `--dur-fast 150ms`, `--dur-med 300ms`, `--dur-slow 600ms`, `--ease-out cubic-bezier(.2,.8,.2,1)`, `--ease-spring cubic-bezier(.34,1.56,.64,1)`.
- Layout: `--content-max: 1120px`. Grids use `repeat(auto-fill, minmax(min(100%, 260px), 1fr))`. The nav collapses below `45em` (720px).

**Contrast rule:**
- Body text uses only `--text`, `--text-muted` or `--accent-text`.
- Text over images or blobs sits on a `--surface` card with `backdrop-filter: blur(12px)` and a solid `--bg-elev` fallback via `@supports not`.

**Focus:** `:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }` on every interactive element.

### 4.5 Fallback logic (API absent)
1. If `location.protocol === 'file:'`, throw `FILE_PROTOCOL`. The error card tells the owner to run `npm start` (ES modules and fetch do not work over file://).
2. Fetch `'api/content'`. The path is **relative**, which keeps it working under a GitHub Pages subpath. Options: `{ headers: { Accept: 'application/json' }, cache: 'no-cache', signal }`, with an AbortController timeout of 3000ms. Accept the result only if `res.ok`, the `content-type` includes `application/json`, and the parsed value has `schemaVersion`. On success return `source: 'api'`.
3. Otherwise fetch `'data/content.json'` with the same checks. The static source only requires parsed JSON; a JSON content-type is not required, because some hosts send `text/plain`. Return `source: 'static'`.
4. Otherwise throw `CONTENT_LOAD_FAILED`. The error card shows a Retry button.

`ctx.apiAvailable = (source === 'api')`.

**Contact:**
- If `apiAvailable && contact.formEnabled`, show the form.
- Otherwise show a gradient button "Email me", `mailto:<contact.email>?subject=Hello%20from%20your%20portfolio`, plus Copy email. If `contact.email` is `""`, show only the social links.

All asset and API URLs in the frontend are relative (`css/…`, `js/…`, `media/…`, `api/…`). Nothing starts with `/`.

### 4.6 Contact form behaviour
- Fields: `name` (autocomplete name), `email` (type=email, autocomplete email), `message` (textarea).
- Each field has a visible `<label>` and a hint/error `<p id>` linked via `aria-describedby`.
- Honeypot: `website`, inside a `.hp` wrapper positioned off-screen, with `tabindex="-1"`, `autocomplete="off"` and `aria-hidden="true"`.
- The form uses `novalidate`. Client validation mirrors §3.3 with the exact same messages. It runs on submit and on blur after the first submit.
- On an invalid submit:
  - set `aria-invalid="true"` on bad fields;
  - focus the first invalid field;
  - fill the status region with "Please fix the highlighted fields."
- `fetch('api/contact', { method: 'POST', headers: {'Content-Type': 'application/json'}, body })`. The submit button is disabled and shows "Sending…" in the meantime.
- Response handling:
  - **201**: reset the form; status "Thanks! Your message was sent." (success color).
  - **422**: map `details` onto the fields.
  - **429**: "Too many messages. Please try again in N minutes.", where N is `ceil(Retry-After / 60)`.
  - **Network error, 404, 405 or 5xx**: "Couldn't send right now." plus a mailto link pre-filled with subject and body (`encodeURIComponent`, body truncated to 1500 chars).
- The status region is `<p role="status" aria-live="polite">`.

### 4.7 index.html requirements
- `<!doctype html>`, `lang="en"`, `<meta charset>`, and `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- `<meta name="description">`, updated by JS.
- `<meta name="color-scheme" content="dark light">`.
- A meta CSP identical to the server CSP in §5, minus `frame-ancestors`.
- Links to the 5 CSS files in this order: tokens, base, layout, components, animations.
- `<link rel="icon" href="favicon.svg">`.
- Body order:
  1. skip link;
  2. `.bg` blobs;
  3. `<header>` placeholder;
  4. `<main id="main" tabindex="-1">` containing `<p role="status">Loading…</p>`;
  5. `<footer>` placeholder;
  6. `<noscript>` message with socials fallback text;
  7. `<script type="module" src="js/main.js">`.
- **No inline scripts, no inline `<style>`, no `style=""` or `on*=` attributes.**
- Footer: `site.footerNote` and social links. When the hostname is `localhost` or `127.0.0.1`, it also shows a subtle "content: api|static" hint.

### 4.8 Placeholder generator (`scripts/generate-placeholders.mjs`)
- Uses Node `fs` only. Deterministic output: each image's hue comes from its index.
- Each SVG has:
  - a `linearGradient` background with 2–3 brand-ish stops;
  - 3–5 translucent circles or blobs;
  - centered text such as "Art 1 · replace me";
  - `role="img"` and a `<title>`.
- The script writes `sample-tone.wav`: 3s, 22050Hz, mono, 16-bit PCM, an A-major chord with a 0.3s fade in and out.
- Idempotent (overwrites). The SVGs and WAV are committed, so running the script is optional.

---

## 5. Server security notes
1. **Path traversal.**
   - Parse with `new URL(req.url, 'http://x')` and take `pathname`.
   - `decodeURIComponent`. A thrown error means **400**.
   - Reject with **404** if the decoded path contains `\0`, `\\` or `:`, or if any segment starts with `.`. This blocks dotfiles, `..` and `%2e%2e`.
   - `resolved = path.resolve(publicDir, '.' + decoded)`. Require `resolved === publicDir || resolved.startsWith(publicDir + path.sep)`.
   - Then `fs.promises.realpath(resolved)` and re-check containment against `realpath(publicDir)`, which defeats symlink escapes. If the check fails, **404**.
   - Serve regular files only (`stat.isFile()`).
2. **URL length:** reject request URLs over 2048 chars with **414**.
3. **Security headers on every response.** `applySecurityHeaders(res)` is called first in `app.js`:
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `X-Frame-Options: DENY`
   - `Cross-Origin-Opener-Policy: same-origin`
   - `Cross-Origin-Resource-Policy: same-origin`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
   - `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; media-src 'self' https:; font-src 'self'; connect-src 'self'; frame-src https://w.soundcloud.com https://open.spotify.com https://www.youtube-nocookie.com https://www.youtube.com https://bandcamp.com https://embed.music.apple.com; object-src 'none'; base-uri 'self'; form-action 'self' mailto:; frame-ancestors 'none'`
   - No `Server` or `X-Powered-By` headers.
   - Note for FE: the CSP forbids inline styles in markup. `el.style.setProperty(...)` via CSSOM is allowed and is the required way to set `--i` and similar.
4. **Body handling:**
   - Enforce the 32 KB limit on both `Content-Length` and streamed bytes.
   - Request timeouts per §3.5.
   - JSON only.
   - Unknown fields ignored.
   - Control characters stripped.
5. **Abuse control:**
   - Per-IP sliding-window rate limit, in memory.
   - The Map is swept every 60s by an `unref()`'d interval, and capped at 10,000 keys (oldest evicted).
   - The limiter exposes `stop()` so tests can clear the interval.
   - Honeypot field.
   - Same-origin `Origin` check.
   - Messages file capped at 5 MB.
   - `X-Forwarded-For` is ignored unless `TRUST_PROXY=1`; then only the rightmost, IP-validated entry is used.
6. **Storage:**
   - `data/messages.ndjson` is outside `public/`, so it can never be served.
   - Records are written with `JSON.stringify`, which prevents NDJSON line injection.
   - Message bodies are never logged.
7. **Errors:**
   - All handlers are wrapped in try/catch, and failures return a generic 500 (`INTERNAL_ERROR`).
   - The server logs `err.message`/stack to stderr only.
   - The process must not crash on client aborts: handle `req.on('error')`, check `res.headersSent` / `res.writableEnded`, and handle read-stream `error` events.
8. **Binding:** defaults to `127.0.0.1`. Exposing the server on the LAN requires setting `HOST=0.0.0.0` explicitly.
9. **Frontend side, enforced by review:**
   - no `innerHTML` with content;
   - `safeHref`/`safeMediaSrc` on every URL (this blocks `javascript:` URLs);
   - embed allowlist plus sandboxed iframes;
   - `rel="noopener noreferrer"` on every `target=_blank`.
10. **GitHub Pages** cannot send custom headers. The meta CSP in `index.html` provides CSP there. `frame-ancestors` and the other headers are only active when served by the Node server.

---

## 6. Division of work
Nobody edits files owned by the other developer. If a change is needed, raise it with the orchestrator and amend this spec.

**Frontend dev owns:**
- `public/**`: all HTML, CSS, JS, `data/content.json` and `media/**`
- `scripts/generate-placeholders.mjs`
- `tests/frontend/urls.test.js`, `tests/frontend/normalize.test.js`
- `docs/CONTENT-GUIDE.md`

**Backend dev owns:**
- `package.json`, `.gitignore`
- `server/**`
- `tests/helpers/**`, `tests/fixtures/**`, `tests/server/**`, `tests/content-file.test.js`
- `docs/SERVER.md`

**Orchestrator owns:** `README.md`, `docs/ARCHITECTURE.md`.

**Shared contracts (frozen by this spec):**
- The content schema (§2). BE validates it and FE produces and consumes it.
- API paths, bodies and error codes (§3).
- The validation message strings (§3.3).
- The CSP (§5.3). FE mirrors it in the meta tag.

**Working in parallel:**
- FE can develop against any static server, or against `npm start` once BE lands it. The fallback path makes FE independent of BE.
- BE tests use `tests/fixtures/public` and never depend on FE files. The one exception is `content-file.test.js`, which skips with `t.skip('content.json not present yet')` if the file is missing.
- `tests/frontend/*.test.js` import `../../public/js/lib/*.js`, which must stay DOM-free (no `window`/`document` at module top level).

---

## 7. Acceptance criteria (QA)

**Run and tests**
1. A fresh clone with no `npm install` runs `npm start`, which prints the URL. `http://127.0.0.1:3000/` renders the site with no console errors and no CSP violations.
2. `npm test` passes on Windows with Node 24 and zero dependencies. `package.json` has no `dependencies` or `devDependencies`.
3. Serving `public/` with an unrelated static server (e.g. `npx serve public`, or copying it to a subfolder path), the site fully renders from `data/content.json`, and the contact section shows the mailto fallback instead of the form.

**Content**
4. Changing `profile.name` in `content.json` and reloading updates the header, hero, title and footer without a server restart. No code edits are needed for any text, link, image or track.
5. Setting a link `url` to `""` hides it. Removing an entry from `nav` removes that tab, and its hash redirects to the default route.
6. Searching `content.json` for `YOUR` finds every placeholder. `tests/content-file.test.js` passes on the committed file.

**Routing and accessibility**
7. Every tab (Home, Projects, Art, Music, Pictures, About, Contact) is reachable by clicking and via direct URL (`/#music`). Back/Forward work. An unknown hash (`#nope`) goes to Home. The active link has `aria-current="page"`. The title updates.
8. Keyboard only:
   - Tab reaches the skip link first, and activating it focuses `<main>` without changing the route.
   - All nav links, toggles, filters, gallery items, buttons and form fields are reachable, with a visible focus ring.
   - After navigation, focus lands on the view's `h1`.
   - The mobile menu opens and closes with Enter/Space and Esc.
9. Lightbox:
   - Enter on a gallery item opens it.
   - ←/→ move between images and the counter updates.
   - Esc closes it and focus returns to the originating item.
   - Tab stays inside the dialog.
   - Swipe works on touch emulation.
10. Screen-reader labelling: every image has non-empty alt text, every icon-only button has an accessible name, and iframes have a `title`. Lighthouse Accessibility is ≥ 95 on Home, Projects and Contact in both themes.
11. Contrast: body text is ≥ 4.5:1 and large text/UI is ≥ 3:1 in dark and light themes (spot-check with DevTools).
12. Reduced motion: with OS reduce-motion on, or the in-page "Pause animations" toggle, blobs, gradient text, role rotation, reveals and view transitions stop, and all content is visible immediately. The toggle persists across reloads.
13. Responsive at 360×740, 768×1024 and 1440×900: no horizontal scrollbar, no clipped text, the nav collapses under 720px, grids reflow, and the lightbox fits the viewport.

**Visual and media**
14. Colorful and animated: gradient background blobs drift, the hero name gradient animates, cards lift with a gradient border on hover, and sections reveal on scroll.
15. Music:
    - The embed track shows a facade, and no third-party request happens until the "Load player" click (check the Network tab); then the SoundCloud iframe loads.
    - The local WAV plays and can seek (206 responses).
    - Starting one audio pauses the others.
    - Changing a track url to `https://youtu.be/dQw4w9WgXcQ` produces a youtube-nocookie embed.
    - A non-allowlisted URL is dropped.
16. All placeholder media exist locally, and there are no external network requests on page load.

**API (verifiable with curl or tests)**
17. `GET /api/health` returns 200 with `{status:"ok", uptime:number, time:ISO}`.
18. `GET /api/content` returns 200 with the exact file content. A repeat request with `If-None-Match` returns 304. Corrupting the file returns 500 `CONTENT_UNAVAILABLE`.
19. `POST /api/contact`:
    - valid body: 201 and a new line in `data/messages.ndjson`;
    - bad fields: 422 with the exact detail strings;
    - non-JSON content type: 415;
    - malformed JSON: 400;
    - body over 32 KB: 413;
    - foreign `Origin`: 403;
    - 6th request within 10 min from one IP: 429 with `Retry-After`;
    - filled honeypot: 201 but nothing stored;
    - `GET /api/contact`: 405 with `Allow: POST`.
20. The form UI shows per-field errors and success/429/fallback messages as specified in §4.6.

**Static serving and security**
21. Each of these returns 400 or 404 and never leaks file contents (raw requests):
    - `/../package.json`
    - `/%2e%2e/%2e%2e/package.json`
    - `/..%2fserver%2fserver.js`
    - `/css/..%5c..%5cpackage.json`
    - `/.gitignore`
    - `/data/../../data/messages.ndjson`
    - `/%00`
    - `/%E0%A4%A`
22. Static files have correct MIME types (html, css, `text/javascript` for js, `image/svg+xml`, `audio/wav`), `ETag`-based 304s, and the Cache-Control policy from §3.4. POST to a static path returns 405. A URL over 2048 chars returns 414.
23. Every response carries the §5.3 security headers, and no response contains a stack trace.
24. Stopping the server with Ctrl+C exits cleanly. Aborting a request mid-upload does not crash the process.

### Critical files for implementation
- C:\Users\theka\Documents\!Website\public\data\content.json
- C:\Users\theka\Documents\!Website\public\js\content-loader.js
- C:\Users\theka\Documents\!Website\public\js\router.js
- C:\Users\theka\Documents\!Website\server\app.js
- C:\Users\theka\Documents\!Website\server\lib\static.js
---

## Amendments (v1.1, after code review)
- A1. `.gitignore` uses `/data/` (root-anchored) so `public/data/content.json` is committed.
- A2. With `TRUST_PROXY=1`, the client IP is the rightmost `X-Forwarded-For` entry and must pass `net.isIP()`. Otherwise use `remoteAddress`. (Leftmost is client-controlled behind nginx/Caddy.)
- A3. Music iframe sandbox adds `allow-popups-to-escape-sandbox`.
- A4. The backend content validator must be at least as strict as the frontend normalizer:
  - embed URLs must be convertible by the same rules as `toEmbedUrl`;
  - `contact.email` must match the contact EMAIL_RE;
  - `isUrl` rejects backslashes.
  Content that passes the backend validator must never be silently dropped by the frontend.
- A5. In the mobile layout, nav links must follow the menu button in focus order.
- A6. Name token: `site.title`, `site.description` and `home.headline` may contain the literal token `{name}`. The frontend replaces it with `profile.name` at render time, and the hero gradient highlights the substituted name. The committed content.json uses `"{name} — Portfolio"` and `"Hi, I'm {name}."`. Now changing `profile.name` alone updates the header, hero, title and footer (criterion 4).
- A7. Per-tab copy: each `nav[]` entry gains two optional fields: `eyebrow` (str, ≤ 40) and `intro` (str, ≤ 240). Views and the home "More of what I do" cards use these instead of hardcoded copy. When a field is absent, the current hardcoded text stays as the default. The committed content.json sets them explicitly. The backend validator accepts both fields and enforces the limits.
- A8. The motion toggle keeps a stable accessible name ("Pause animations") and uses `aria-pressed`. This is the accepted pattern, so criterion 12 is satisfied by `aria-pressed`, not by a label swap.
- A9. A6 extended: `site.footerNote` also supports `{name}`. In the header DOM, only the mobile menu button comes before `<nav>`; the theme and motion toggles follow it, so focus order matches the visual order at every width.
