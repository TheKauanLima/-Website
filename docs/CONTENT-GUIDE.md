# Content guide

Every piece of text, link, image and track on the site comes from one file: `public/data/content.json`. You never need to edit HTML, CSS or JavaScript.

## Quick start

1. Open `public/data/content.json` in any text editor.
2. Search for `YOUR`. Every placeholder contains it (`YOUR NAME`, `YOUR-USERNAME`, …). Replace each one.
3. Save and reload the browser. With `npm start` the change shows up immediately, with no restart.

The file must stay valid JSON: keep the double quotes, and put commas between entries but not after the last one. If the page shows "Couldn't load the site", paste the file into any JSON validator to find the typo.

## Rules

- **Plain text only.** HTML tags are shown as literal text, never interpreted.
- **Hide something** by setting its URL to `""`, for example a link, a project's "Live demo" button, or `profile.resumeUrl`.
- **Media paths** are relative to `public/` with no leading slash (`media/art/my-painting.jpg`), or a full `https://` URL. Use only letters, digits, `.`, `_`, `-` and `/` in file names (no spaces).
- **Alt text is required** for art and pictures. Describe the image for someone who can't see it. Entries without `alt` are skipped.

## The `{name}` token

`site.title`, `site.description`, `site.footerNote` and `home.headline` may contain the literal text `{name}`. It is replaced with `profile.name` when the page renders, and the home headline shows the name in the animated gradient. The committed file uses `"{name} — Portfolio"` and `"Hi, I'm {name}."`, and the footer note starts with `"© 2026 {name}."`, so changing `profile.name` alone updates the header, hero, browser title and footer.

## Sections

| Key | What it controls |
|---|---|
| `site` | Browser tab title, search description, footer note. `themeDefault` is `"system"`, `"dark"` or `"light"`. |
| `profile` | Your name (header, hero, footer), `role`, the rotating `roles` (up to 6), `tagline`, `location`, `avatar`, `availability` badge, `resumeUrl` (adds a "Download résumé" button on About). |
| `links` | GitHub, LinkedIn, email and other profiles. `icon` is one of: github, linkedin, email, instagram, soundcloud, spotify, youtube, bandcamp, x, bluesky, mastodon, behance, dribbble, artstation, website, resume, link. `showInHero: false` keeps a link out of the home page hero (it still shows in the footer and on Contact). |
| `nav` | The tabs and their order. Allowed ids: home, projects, art, music, pictures, about, contact. Remove an entry to remove that tab. The first entry is the landing page. You can rename a tab with `label`. Optional `eyebrow` (≤ 40 characters, the small label above the page title) and `intro` (≤ 240 characters, the line under it; also the text on the home page "More of what I do" cards). If you leave them out, built-in defaults are used. On Music and Contact, `music.intro` / `contact.blurb` take priority over the tab `intro` under the page title. |
| `home` | `headline` (your name inside it is shown in the animated gradient), `intro`, up to 4 `highlights` (value max 12 characters), up to 3 `cta` buttons (`href` like `"#projects"` or a URL), and `featuredProjectIds`. If `featuredProjectIds` is missing, the home page shows projects marked `"featured": true` (or the first two). Set it to `[]` to hide the featured section. |
| `about` | `heading`, `paragraphs` (the first one is shown larger), `skills` groups, `timeline` entries, and `facts`. |
| `projects` | Each needs a unique `id` (lowercase letters, digits and dashes) and a `title`. `summary` max 160 characters. Up to 8 `tags`: they become the filter chips. `links` become buttons. |
| `art`, `pictures` | Image galleries. `width` and `height` (in pixels) keep the layout from jumping while images load, so set them to your image's real size. |
| `music` | `intro` and `tracks` (see below). |
| `contact` | `heading`, `blurb`, `email` (set `""` to show only your social links), and `formEnabled`. |

## Replacing images

1. Put your file in the matching folder, e.g. `public/media/art/sunset.jpg`.
2. Point the entry at it: `"src": "media/art/sunset.jpg"`, and update `width`, `height` and `alt`.
3. Delete the old placeholder SVG if you like.

Good sizes: avatar 512×512 (square), project images 1200×750 (16:10), music covers 600×600. Art and photos can be any shape. Export JPG or WebP around 1600px on the long edge to keep the site fast.

`node scripts/generate-placeholders.mjs` recreates the placeholder images. It overwrites the placeholder file names only, never your own files.

## Music

Each track has `"type": "embed"` or `"type": "audio"`.

- **embed:** paste a normal share link into `url`. Supported: SoundCloud (`https://soundcloud.com/you/track`), Spotify (`https://open.spotify.com/track/…`, album, playlist, artist, episode), YouTube (`https://youtu.be/…` or `watch?v=…`), Bandcamp `EmbeddedPlayer` links and Apple Music `embed.music.apple.com` links. Visitors see your cover plus a "Load player" button. Nothing is fetched from the provider until they click it. Links from other sites are ignored.
- **audio:** put an `.mp3`, `.ogg`, `.wav`, `.m4a`, `.opus` or `.flac` file in `public/media/music/` and set `"url": "media/music/my-song.mp3"`.

## Contact form

The form is shown only when the site runs on the Node server (`npm start`) and `formEnabled` is `true`. On static hosting such as GitHub Pages, visitors get an "Email me" button and a "Copy email" button instead.

## One more place: the no-JavaScript message

`public/index.html` has a short `<noscript>` block, shown only to visitors with JavaScript turned off. It holds your GitHub and LinkedIn profile URLs and your email as plain text, and it is the only text outside `content.json`. Search `index.html` for `YOUR` and update it whenever your profile links change.
