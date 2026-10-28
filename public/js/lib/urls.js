// DOM-free URL helpers. Safe to import in Node tests.

export const EMBED_HOSTS = Object.freeze([
  'soundcloud.com',
  'w.soundcloud.com',
  'open.spotify.com',
  'www.youtube.com',
  'youtube.com',
  'youtu.be',
  'www.youtube-nocookie.com',
  'bandcamp.com',
  'embed.music.apple.com',
]);

const EMBED_HOST_SET = new Set(EMBED_HOSTS);
const MEDIA_PATH_RE = /^[A-Za-z0-9._\-/]+$/;
const SCHEME_RE = /^([A-Za-z][A-Za-z0-9+.-]*):/;
// Control characters and backslashes are never valid in an href we emit.
// Browsers strip tabs/newlines inside schemes ("java\nscript:"), so reject them outright.
const BAD_CHARS_RE = /[\u0000-\u001F\u007F\\]/;
const ALLOWED_SCHEMES = new Set(['http', 'https', 'mailto']);

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * Returns the URL if it is safe to use as an href: http(s), mailto, "#hash" or a relative path.
 * Anything else (javascript:, data:, protocol-relative //host, control chars) returns null.
 */
export function safeHref(url) {
  if (typeof url !== 'string') return null;
  const s = url.trim();
  if (!s || BAD_CHARS_RE.test(s)) return null;
  if (s.startsWith('#')) return s;
  if (s.startsWith('//')) return null;
  const m = SCHEME_RE.exec(s);
  if (m) {
    const scheme = m[1].toLowerCase();
    if (!ALLOWED_SCHEMES.has(scheme)) return null;
    if (scheme === 'mailto') return s.length > 'mailto:'.length ? s : null;
    const u = parseUrl(s);
    return u && u.hostname ? s : null;
  }
  return s; // relative path
}

/**
 * Returns the path if it is a valid media path: an https:// URL, or a relative path made of
 * [A-Za-z0-9._-/] that does not start with "/" and contains no "..".
 */
export function safeMediaSrc(path) {
  if (typeof path !== 'string') return null;
  const s = path.trim();
  if (!s) return null;
  if (/^https:\/\//i.test(s)) {
    if (BAD_CHARS_RE.test(s) || /\s/.test(s)) return null;
    const u = parseUrl(s);
    return u && u.protocol === 'https:' && u.hostname ? s : null;
  }
  if (s.startsWith('/') || s.includes('..') || !MEDIA_PATH_RE.test(s)) return null;
  return s;
}

/** True when url is an https URL whose hostname is on the embed allowlist. */
export function isAllowedEmbedHost(url) {
  if (typeof url !== 'string') return false;
  const u = parseUrl(url.trim());
  return !!u && u.protocol === 'https:' && EMBED_HOST_SET.has(u.hostname.toLowerCase());
}

const YT_ID_RE = /^[A-Za-z0-9_-]{6,20}$/;
const SPOTIFY_TYPES = new Set(['track', 'album', 'playlist', 'artist', 'episode', 'show']);
const SPOTIFY_ID_RE = /^[A-Za-z0-9]{6,40}$/;

function youtubeId(u) {
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split('/').filter(Boolean);
  if (host === 'youtu.be') return parts[0] || null;
  if (u.pathname === '/watch') return u.searchParams.get('v');
  if ((parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') && parts[1]) return parts[1];
  return null;
}

/**
 * Converts a share URL into an embeddable player URL.
 * Returns { src, provider } or null when the URL is not a supported, allowlisted player.
 */
export function toEmbedUrl(url) {
  if (!isAllowedEmbedHost(url)) return null;
  const original = url.trim();
  const u = parseUrl(original);
  const host = u.hostname.toLowerCase();

  if (host === 'youtu.be' || host === 'youtube.com' || host === 'www.youtube.com' || host === 'www.youtube-nocookie.com') {
    const id = youtubeId(u);
    if (!id || !YT_ID_RE.test(id)) return null;
    return { src: `https://www.youtube-nocookie.com/embed/${id}`, provider: 'youtube' };
  }

  if (host === 'open.spotify.com') {
    let parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] && /^intl-[a-z-]+$/i.test(parts[0])) parts = parts.slice(1);
    if (parts[0] === 'embed') parts = parts.slice(1);
    const [type, id] = parts;
    if (!SPOTIFY_TYPES.has(type) || !id || !SPOTIFY_ID_RE.test(id)) return null;
    return { src: `https://open.spotify.com/embed/${type}/${id}`, provider: 'spotify' };
  }

  if (host === 'w.soundcloud.com') {
    return u.pathname.startsWith('/player') ? { src: u.href, provider: 'soundcloud' } : null;
  }

  if (host === 'soundcloud.com') {
    if (u.pathname.split('/').filter(Boolean).length === 0) return null;
    return {
      src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(original)}&color=%23ff4d8d&visual=true`,
      provider: 'soundcloud',
    };
  }

  if (host === 'bandcamp.com') {
    return u.pathname.startsWith('/EmbeddedPlayer') ? { src: u.href, provider: 'bandcamp' } : null;
  }

  if (host === 'embed.music.apple.com') {
    return u.pathname.length > 1 ? { src: u.href, provider: 'apple' } : null;
  }

  return null;
}

/** True for absolute http(s) links that should open in a new tab. */
export function isExternalHref(href) {
  return typeof href === 'string' && /^https?:\/\//i.test(href);
}

const AUDIO_EXT_RE = /\.(mp3|ogg|wav|m4a|opus|flac)$/i;

/** Valid audio source: a media path ending in a known audio extension, or any https URL. */
export function safeAudioSrc(path) {
  const s = safeMediaSrc(path);
  if (!s) return null;
  if (/^https:\/\//i.test(s)) return s;
  return AUDIO_EXT_RE.test(s) ? s : null;
}
