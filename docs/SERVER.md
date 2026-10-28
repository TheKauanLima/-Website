# Server

A small Node.js server with zero dependencies. It serves the static site in `public/` and adds a JSON API under `/api/`. Nothing needs to be installed beyond Node 20 or newer (Node 24 is what it was developed on).

## Run it

```sh
npm start          # node server/server.js
npm run dev        # restarts automatically when server files change
npm test           # runs every test with node --test
```

On startup it prints `Portfolio running at http://127.0.0.1:3000`. Press **Ctrl+C** to stop it. It stops accepting connections, lets in-flight requests finish (for up to 5 seconds), and exits.

## Configuration (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | Port to listen on (`0` picks a free port). |
| `HOST` | `127.0.0.1` | Interface to bind. Only this computer can connect by default. Use `0.0.0.0` to expose it on your LAN. |
| `PUBLIC_DIR` | `public` | Static web root. |
| `CONTENT_FILE` | `public/data/content.json` | The site content served at `/api/content`. |
| `MESSAGES_FILE` | `data/messages.ndjson` | Where contact-form messages are stored. |
| `MESSAGES_MAX_BYTES` | `5242880` (5 MB) | Once the messages file reaches this size, new messages are refused with 503. |
| `RATE_LIMIT_MAX` | `5` | Contact submissions allowed per IP per window. |
| `RATE_LIMIT_WINDOW_MS` | `600000` (10 min) | Rate-limit sliding window. |
| `TRUST_PROXY` | `0` | Set to `1` only behind **one** reverse proxy. The client IP is then the **rightmost** `X-Forwarded-For` entry (see below). |

Relative paths resolve against the **project root** (the folder that contains `server/`), not the directory you run the command from. An invalid number (for example `PORT=abc`) stops the server at startup with a clear message.

Examples:

```sh
# Git Bash / macOS / Linux
PORT=8080 npm start
MESSAGES_FILE=/tmp/messages.ndjson npm start

# PowerShell
$env:PORT = "8080"; npm start
```

## API

Every `/api/*` response is JSON (`application/json; charset=utf-8`). There are no CORS headers, so the API is same-origin only. Errors always look like this:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Please correct the highlighted fields.", "details": { "email": "Email address is invalid." } } }
```

`details` only appears for `VALIDATION_FAILED`. Stack traces are never sent; errors are logged to the terminal instead.

| Endpoint | Result |
|---|---|
| `GET/HEAD /api/health` | `200 {"status":"ok","uptime":12.3,"time":"<ISO>"}`, `Cache-Control: no-store` |
| `GET/HEAD /api/content` | The content file's JSON exactly, with `ETag` and `Cache-Control: no-cache`. `If-None-Match` gives `304`. A missing or broken file gives `500 CONTENT_UNAVAILABLE`. The file is re-read on every request, so edits show up without a restart. Schema problems are printed as warnings once per version of the file. |
| `POST /api/contact` | `201 {"ok":true,"id":"<uuid>","receivedAt":"<ISO>"}` |

`POST /api/contact` checks these in order, and the first failure wins:

| Step | Failure |
|---|---|
| `Origin` header present and not equal to the `Host` | `403 FORBIDDEN_ORIGIN` |
| More than 5 submissions in 10 minutes from one IP | `429 RATE_LIMITED` with `Retry-After` in seconds |
| `Content-Type` not `application/json…` | `415 UNSUPPORTED_MEDIA_TYPE` |
| Body over 32768 bytes | `413 PAYLOAD_TOO_LARGE` |
| Not valid JSON, or not a JSON object | `400 INVALID_JSON` |
| Bad `name` / `email` / `message` | `422 VALIDATION_FAILED` with per-field `details` |
| `website` (honeypot) filled in | Pretends success (`201`) and stores nothing |
| Messages file already at the size cap | `503 STORAGE_UNAVAILABLE` |
| Disk write error | `500 INTERNAL_ERROR` |

Any other method on a known endpoint gives `405 METHOD_NOT_ALLOWED` with an `Allow` header. An unknown `/api/…` path gives `404 NOT_FOUND`.

## The messages file

Messages are appended to `data/messages.ndjson`. This is outside `public/`, so it can never be downloaded through the site, and `data/` is in `.gitignore`. The folder is created automatically on the first message. Each line is one JSON object:

```json
{"id":"…","receivedAt":"2026-09-28T17:00:00.000Z","name":"Ada","email":"ada@example.com","message":"Hello…","ip":"127.0.0.1","userAgent":"Mozilla/5.0 …"}
```

To read the messages, open the file in any text editor, or pretty-print them:

```sh
node -e "require('fs').readFileSync('data/messages.ndjson','utf8').trim().split('\n').forEach(l=>console.log(JSON.parse(l)))"
```

Message bodies are never written to the log.

### When the messages file is full

Once `data/messages.ndjson` reaches `MESSAGES_MAX_BYTES` (5 MB by default, which is thousands of messages), every new submission gets `503 STORAGE_UNAVAILABLE`. The form then shows its "Couldn't send right now" message with the mailto fallback, so visitors can still reach you by email. The terminal logs a `POST /api/contact 503` line for each attempt. To recover (no restart needed, because the size is checked on every submission):

1. Archive the file: rename it, e.g. `data/messages-2026-09.ndjson`, or move it elsewhere. The next message creates a fresh `messages.ndjson` automatically.
2. Or, if you have already read everything, just delete it.
3. Or raise the cap, e.g. `MESSAGES_MAX_BYTES=20971520 npm start` (20 MB). This needs a restart.

A sudden jump to the cap usually means spam got past the honeypot and rate limit. Look at the `ip` and `userAgent` fields before raising the limit.

## Static files

- Only `GET` and `HEAD` are allowed (`405` otherwise). `/` and any `folder/` serve that folder's `index.html`, and a folder without a trailing slash is redirected (`301`) to add one. Folders are never listed.
- `.html`, `.css`, `.js`, `.mjs` and `.json` are sent with `Cache-Control: no-cache`, so the browser revalidates them with a cheap `304` on every load. Everything else (images, audio, fonts) is cached for 7 days. **After replacing a media file, give it a new name** (or hard-refresh) so returning visitors see it.
- Range requests are supported (`206`/`416`), so audio seeking works in every browser.
- Blocked with `400`/`404`: `..` in any form (encoded, double-encoded or with backslashes), any path segment starting with `.` (dotfiles such as `.git` or `.env`), NUL bytes, `:` (drive letters and NTFS streams), symlinks that point outside `public/`, and malformed percent-encoding. URLs longer than 2048 characters get `414`.
- Every response carries the security headers `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy` and `Permissions-Policy`. No `Server` or `X-Powered-By` header is sent.

## Logs

The server logs one line per request, `METHOD /path status time`, for example `GET /api/content 200 1.2ms`. Query strings and request bodies are never logged. Content-schema warnings and server errors go to stderr.

## Deploying without the server (GitHub Pages etc.)

The `public/` folder is a complete static site on its own. Publish just that folder, for example with a GitHub Pages workflow that uploads `public/`, or by setting Pages to serve from a branch whose root contains the files of `public/`. The frontend tries `api/content`, and when that fails it loads `data/content.json` directly. Without the API, the contact section shows an "Email me" button instead of the form.

Things that only the Node server provides:
- the contact form and message storage;
- HTTP security headers (the page's `<meta>` CSP still applies on Pages, but `frame-ancestors` and the other headers do not);
- the path-traversal and dotfile protection described above (static hosts have their own rules).

## Running it on a real server

- Put it behind a reverse proxy (Caddy, nginx) for HTTPS, and set `TRUST_PROXY=1` so rate limiting sees real client IPs.
- **How the client IP is chosen with `TRUST_PROXY=1`:** the server uses the **rightmost** `X-Forwarded-For` entry, and only if it is a valid IPv4/IPv6 address (`net.isIP`). Otherwise it falls back to the socket address. The rightmost entry is the one your proxy appends. Everything to its left comes from the client and can be forged, so a visitor sending `X-Forwarded-For: 1.2.3.4` cannot dodge the rate limit or plant a fake IP in the messages file.
  - This assumes exactly **one** proxy in front of the server that *appends* to `X-Forwarded-For`. This is the default for Caddy (`reverse_proxy`) and for nginx with `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`.
  - With a chain of proxies (e.g. a CDN in front of nginx), the rightmost entry is the CDN's address, so all visitors share one rate-limit bucket. In that case, have the outer proxy overwrite the header with the real client IP.
  - Never set `TRUST_PROXY=1` when the server is reachable directly: clients could then choose their own IP.
- The proxy must pass the original `Host` header through, or the contact form's same-origin check returns `403`.
- Keep `HOST=127.0.0.1` when the proxy runs on the same machine.
- Run it under a process manager (systemd, pm2 or a Windows service) that restarts it on failure. On shutdown, send `SIGTERM` (or press Ctrl+C in a terminal).
- The rate limiter is in memory, so it resets on restart and is per process.
