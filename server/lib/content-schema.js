/**
 * Validator for public/data/content.json, implementing ARCHITECTURE.md §2.2.
 * validateContent(obj) → { valid, errors: [{path, message}], warnings: [{path, message}] }
 * Unknown keys produce warnings, never errors.
 */

import { isPlainObject } from './util.js';
import { EMAIL_RE } from './validate-contact.js';

export const ICONS = Object.freeze([
  'github', 'linkedin', 'email', 'instagram', 'soundcloud', 'spotify', 'youtube', 'bandcamp',
  'x', 'bluesky', 'mastodon', 'behance', 'dribbble', 'artstation', 'website', 'resume', 'link',
]);

export const NAV_IDS = Object.freeze(['home', 'projects', 'art', 'music', 'pictures', 'about', 'contact']);

export const EMBED_HOSTS = Object.freeze([
  'soundcloud.com', 'w.soundcloud.com', 'open.spotify.com', 'www.youtube.com', 'youtube.com',
  'youtu.be', 'www.youtube-nocookie.com', 'bandcamp.com', 'embed.music.apple.com',
]);

const SLUG_RE = /^[a-z0-9-]+$/;
const MEDIA_RE = /^[A-Za-z0-9._\-/]+$/;
export const AUDIO_EXT_RE = /\.(mp3|ogg|wav|m4a|opus|flac)$/i;
/** Same pattern as the contact API (§3.3) and the frontend normalizer. */
export { EMAIL_RE };
// Whitespace, control characters and backslashes are never valid in a URL or media path.
// eslint-disable-next-line no-control-regex
const BAD_URL_CHARS_RE = /[\s\u0000-\u001F\u007F\\]/;

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function isHttpsUrl(value) {
  if (typeof value !== 'string' || !/^https:\/\//i.test(value) || BAD_URL_CHARS_RE.test(value)) return false;
  const u = parseUrl(value);
  return !!u && u.protocol === 'https:' && u.hostname !== '';
}

/** url = https://…, http://…, mailto:…, a # hash, or a relative path. No backslashes. */
export function isUrl(value) {
  if (typeof value !== 'string' || value === '' || BAD_URL_CHARS_RE.test(value)) return false;
  if (value.startsWith('#')) return true;
  if (/^https?:\/\//i.test(value)) {
    const u = parseUrl(value);
    return !!u && u.hostname !== '';
  }
  if (/^mailto:/i.test(value)) return value.length > 'mailto:'.length;
  if (value.startsWith('//')) return false;
  // Any other scheme (javascript:, data:, ftp:, …) is rejected.
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return false;
  return true;
}

/** media path = https://… or a relative path of safe characters, no leading "/", no "..". */
export function isMediaPath(value) {
  if (typeof value !== 'string' || value === '') return false;
  if (/^https:\/\//i.test(value)) return isHttpsUrl(value);
  return MEDIA_RE.test(value) && !value.startsWith('/') && !value.includes('..');
}

// ---- Embed rules: mirror of toEmbedUrl() in public/js/lib/urls.js ----------
// Kept as a copy (not an import) so the server never depends on frontend code;
// tests/parity.test.js checks both agree on a corpus of URLs.
const YT_HOSTS = new Set(['youtu.be', 'youtube.com', 'www.youtube.com', 'www.youtube-nocookie.com']);
const YT_ID_RE = /^[A-Za-z0-9_-]{6,20}$/;
const SPOTIFY_TYPES = new Set(['track', 'album', 'playlist', 'artist', 'episode', 'show']);
const SPOTIFY_ID_RE = /^[A-Za-z0-9]{6,40}$/;

function youtubeId(u) {
  const parts = u.pathname.split('/').filter(Boolean);
  if (u.hostname.toLowerCase() === 'youtu.be') return parts[0] || null;
  if (u.pathname === '/watch') return u.searchParams.get('v');
  if (['embed', 'shorts', 'live'].includes(parts[0]) && parts[1]) return parts[1];
  return null;
}

/** Provider name if the URL is an allowlisted, convertible player URL; otherwise null. */
export function embedProvider(value) {
  if (!isHttpsUrl(value)) return null;
  const u = parseUrl(value);
  const host = u.hostname.toLowerCase();
  if (!EMBED_HOSTS.includes(host)) return null;
  if (YT_HOSTS.has(host)) {
    const id = youtubeId(u);
    return id && YT_ID_RE.test(id) ? 'youtube' : null;
  }
  if (host === 'open.spotify.com') {
    let parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] && /^intl-[a-z-]+$/i.test(parts[0])) parts = parts.slice(1);
    if (parts[0] === 'embed') parts = parts.slice(1);
    const [type, id] = parts;
    return SPOTIFY_TYPES.has(type) && id && SPOTIFY_ID_RE.test(id) ? 'spotify' : null;
  }
  if (host === 'w.soundcloud.com') return u.pathname.startsWith('/player') ? 'soundcloud' : null;
  if (host === 'soundcloud.com') return u.pathname.split('/').filter(Boolean).length > 0 ? 'soundcloud' : null;
  if (host === 'bandcamp.com') return u.pathname.startsWith('/EmbeddedPlayer') ? 'bandcamp' : null;
  if (host === 'embed.music.apple.com') return u.pathname.length > 1 ? 'apple' : null;
  return null;
}

export function isEmbedUrl(value) {
  return embedProvider(value) !== null;
}

export function isAudioSource(value) {
  if (isHttpsUrl(value)) return true;
  return isMediaPath(value) && AUDIO_EXT_RE.test(value);
}

const codePoints = (s) => [...s].length;
const join = (base, key) => (base ? `${base}.${key}` : key);

export function validateContent(data) {
  const errors = [];
  const warnings = [];
  const error = (path, message) => errors.push({ path, message });
  const warn = (path, message) => warnings.push({ path, message });

  // ---- primitive helpers -------------------------------------------------
  function knownKeys(obj, keys, base) {
    for (const key of Object.keys(obj)) {
      if (!keys.includes(key)) warn(join(base, key), 'Unknown key (ignored).');
    }
  }

  /** Validate a string field. Returns the string, or undefined when absent/invalid. */
  function str(obj, key, base, { required = false, min = 0, max = Infinity } = {}) {
    const path = join(base, key);
    const value = obj[key];
    if (value === undefined) {
      if (required) error(path, 'Required string is missing.');
      return undefined;
    }
    if (typeof value !== 'string') {
      error(path, 'Must be a string.');
      return undefined;
    }
    // Minimum lengths count trimmed text: the frontend treats whitespace-only as empty.
    if (codePoints(value.trim()) < min) {
      error(path, min === 1 ? 'Must not be empty or blank.' : `Must be at least ${min} characters.`);
    }
    if (codePoints(value) > max) error(path, `Must be at most ${max} characters.`);
    return value;
  }

  function bool(obj, key, base, { required = false } = {}) {
    const value = obj[key];
    if (value === undefined) {
      if (required) error(join(base, key), 'Required boolean is missing.');
      return;
    }
    if (typeof value !== 'boolean') error(join(base, key), 'Must be true or false.');
  }

  function obj(parent, key, base, { required = false } = {}) {
    const path = join(base, key);
    const value = parent[key];
    if (value === undefined) {
      if (required) error(path, 'Required object is missing.');
      return undefined;
    }
    if (!isPlainObject(value)) {
      error(path, 'Must be an object.');
      return undefined;
    }
    return value;
  }

  function arr(parent, key, base, { required = false, min = 0, max = Infinity } = {}) {
    const path = join(base, key);
    const value = parent[key];
    if (value === undefined) {
      if (required) error(path, 'Required array is missing.');
      return undefined;
    }
    if (!Array.isArray(value)) {
      error(path, 'Must be an array.');
      return undefined;
    }
    if (value.length < min) error(path, `Must have at least ${min} item(s).`);
    if (value.length > max) error(path, `Must have at most ${max} items.`);
    return value;
  }

  function strArray(parent, key, base, opts = {}) {
    const list = arr(parent, key, base, opts);
    if (!list) return undefined;
    list.forEach((item, i) => {
      if (typeof item !== 'string') error(`${join(base, key)}[${i}]`, 'Must be a string.');
      // Blank entries would be silently dropped by the frontend.
      else if (item.trim() === '') error(`${join(base, key)}[${i}]`, 'Must not be empty or blank.');
      else if (opts.itemMax && codePoints(item) > opts.itemMax) {
        error(`${join(base, key)}[${i}]`, `Must be at most ${opts.itemMax} characters.`);
      }
    });
    return list;
  }

  /** Each item must be an object; returns [item, path] pairs for the valid ones. */
  function objectItems(list, base) {
    const out = [];
    (list ?? []).forEach((item, i) => {
      const path = `${base}[${i}]`;
      if (!isPlainObject(item)) error(path, 'Must be an object.');
      else out.push([item, path]);
    });
    return out;
  }

  function slugId(item, path, seen) {
    const id = item.id;
    if (typeof id !== 'string' || id === '') {
      error(`${path}.id`, 'Required id is missing.');
      return undefined;
    }
    if (!SLUG_RE.test(id)) error(`${path}.id`, 'Must be a slug (lowercase letters, digits and dashes).');
    if (seen.has(id)) error(`${path}.id`, `Duplicate id "${id}".`);
    seen.add(id);
    return id;
  }

  function check(obj, key, base, predicate, message, { required = false, allowEmpty = false } = {}) {
    const value = obj[key];
    const path = join(base, key);
    if (value === undefined) {
      if (required) error(path, 'Required value is missing.');
      return;
    }
    if (typeof value !== 'string') {
      error(path, 'Must be a string.');
      return;
    }
    if (allowEmpty && value === '') return;
    if (!predicate(value)) error(path, message);
  }

  // ---- root --------------------------------------------------------------
  if (!isPlainObject(data)) {
    error('', 'Content must be a JSON object.');
    return { valid: false, errors, warnings };
  }

  knownKeys(data, [
    'schemaVersion', 'site', 'profile', 'links', 'nav', 'home', 'about',
    'projects', 'art', 'music', 'pictures', 'contact',
  ], '');

  if (data.schemaVersion === undefined) error('schemaVersion', 'Required number is missing.');
  else if (data.schemaVersion !== 1) error('schemaVersion', 'Must be the number 1.');

  // ---- site --------------------------------------------------------------
  const site = obj(data, 'site', '', { required: true });
  if (site) {
    knownKeys(site, ['title', 'description', 'lang', 'themeDefault', 'footerNote'], 'site');
    str(site, 'title', 'site', { required: true, min: 1, max: 80 });
    str(site, 'description', 'site', { max: 200 });
    str(site, 'lang', 'site');
    if (site.themeDefault !== undefined && !['system', 'dark', 'light'].includes(site.themeDefault)) {
      error('site.themeDefault', 'Must be "system", "dark" or "light".');
    }
    str(site, 'footerNote', 'site');
  }

  // ---- profile -----------------------------------------------------------
  const profile = obj(data, 'profile', '', { required: true });
  if (profile) {
    knownKeys(profile, [
      'name', 'role', 'roles', 'tagline', 'location', 'avatar', 'avatarAlt', 'availability', 'resumeUrl',
    ], 'profile');
    str(profile, 'name', 'profile', { required: true, min: 1, max: 80 });
    str(profile, 'role', 'profile', { required: true, min: 1, max: 80 });
    strArray(profile, 'roles', 'profile', { max: 6 });
    str(profile, 'tagline', 'profile', { max: 200 });
    str(profile, 'location', 'profile');
    str(profile, 'availability', 'profile');
    str(profile, 'avatarAlt', 'profile');
    check(profile, 'avatar', 'profile', isMediaPath, 'Must be a media path or "".', { allowEmpty: true });
    check(profile, 'resumeUrl', 'profile', isUrl, 'Must be a valid URL or "".', { allowEmpty: true });
  }

  // ---- links -------------------------------------------------------------
  const links = arr(data, 'links', '', { max: 20 });
  const linkIds = new Set();
  for (const [link, path] of objectItems(links, 'links')) {
    knownKeys(link, ['id', 'label', 'url', 'icon', 'showInHero'], path);
    slugId(link, path, linkIds);
    str(link, 'label', path, { required: true, min: 1, max: 40 });
    check(link, 'url', path, isUrl, 'Must be a valid URL or "".', { required: true, allowEmpty: true });
    if (link.icon !== undefined && !ICONS.includes(link.icon)) {
      error(`${path}.icon`, `Must be one of: ${ICONS.join(', ')}.`);
    }
    bool(link, 'showInHero', path);
  }

  // ---- nav ---------------------------------------------------------------
  const nav = arr(data, 'nav', '', { required: true, min: 1, max: 7 });
  const navIds = new Set();
  for (const [item, path] of objectItems(nav, 'nav')) {
    knownKeys(item, ['id', 'label', 'eyebrow', 'intro'], path);
    if (!NAV_IDS.includes(item.id)) error(`${path}.id`, `Must be one of: ${NAV_IDS.join(', ')}.`);
    else if (navIds.has(item.id)) error(`${path}.id`, `Duplicate nav id "${item.id}".`);
    else navIds.add(item.id);
    str(item, 'label', path, { required: true, min: 1, max: 24 });
    // A7: optional per-tab copy.
    str(item, 'eyebrow', path, { max: 40 });
    str(item, 'intro', path, { max: 240 });
  }

  // ---- projects (before home, which references project ids) -------------
  const projects = arr(data, 'projects', '', { max: 50 });
  const projectIds = new Set();
  for (const [p, path] of objectItems(projects, 'projects')) {
    knownKeys(p, [
      'id', 'title', 'summary', 'description', 'image', 'imageAlt', 'year', 'role', 'tags', 'links', 'featured',
    ], path);
    slugId(p, path, projectIds);
    str(p, 'title', path, { required: true, min: 1, max: 80 });
    str(p, 'summary', path, { max: 160 });
    str(p, 'description', path);
    check(p, 'image', path, isMediaPath, 'Must be a media path or "".', { allowEmpty: true });
    const alt = str(p, 'imageAlt', path);
    if (typeof p.image === 'string' && p.image !== '' && (!alt || alt.trim() === '')) {
      error(`${path}.imageAlt`, 'Required when image is set.');
    }
    str(p, 'year', path);
    str(p, 'role', path);
    strArray(p, 'tags', path, { max: 8 });
    const plinks = arr(p, 'links', path);
    for (const [l, lpath] of objectItems(plinks, `${path}.links`)) {
      knownKeys(l, ['label', 'url'], lpath);
      str(l, 'label', lpath, { required: true, min: 1 });
      check(l, 'url', lpath, isUrl, 'Must be a valid URL or "".', { required: true, allowEmpty: true });
    }
    bool(p, 'featured', path);
  }

  // ---- home --------------------------------------------------------------
  const home = obj(data, 'home', '');
  if (home) {
    knownKeys(home, ['headline', 'intro', 'highlights', 'cta', 'featuredProjectIds'], 'home');
    str(home, 'headline', 'home', { required: true });
    str(home, 'intro', 'home');
    const highlights = arr(home, 'highlights', 'home', { max: 4 });
    for (const [h, path] of objectItems(highlights, 'home.highlights')) {
      knownKeys(h, ['value', 'label'], path);
      str(h, 'value', path, { required: true, min: 1, max: 12 });
      str(h, 'label', path, { required: true, min: 1, max: 40 });
    }
    const cta = arr(home, 'cta', 'home', { max: 3 });
    for (const [c, path] of objectItems(cta, 'home.cta')) {
      knownKeys(c, ['label', 'href'], path);
      str(c, 'label', path, { required: true, min: 1 });
      // A hash must point at a tab that exists in this document's nav (the frontend drops others).
      check(c, 'href', path, (v) => (v.startsWith('#') ? navIds.has(v.slice(1)) : isUrl(v)),
        'Must be "#<navId>" of a tab in nav, or a valid URL.', { required: true });
    }
    const featured = strArray(home, 'featuredProjectIds', 'home');
    (featured ?? []).forEach((id, i) => {
      if (typeof id === 'string' && !projectIds.has(id)) {
        error(`home.featuredProjectIds[${i}]`, `No project with id "${id}".`);
      }
    });
  }

  // ---- about -------------------------------------------------------------
  const about = obj(data, 'about', '');
  if (about) {
    knownKeys(about, ['heading', 'paragraphs', 'skills', 'timeline', 'facts'], 'about');
    str(about, 'heading', 'about', { required: true });
    strArray(about, 'paragraphs', 'about');
    for (const [s, path] of objectItems(arr(about, 'skills', 'about'), 'about.skills')) {
      knownKeys(s, ['group', 'items'], path);
      str(s, 'group', path, { required: true, min: 1 });
      strArray(s, 'items', path, { required: true, min: 1 });
    }
    for (const [t, path] of objectItems(arr(about, 'timeline', 'about'), 'about.timeline')) {
      knownKeys(t, ['period', 'title', 'org', 'description'], path);
      str(t, 'period', path, { required: true });
      str(t, 'title', path, { required: true, min: 1 });
      str(t, 'org', path);
      str(t, 'description', path);
    }
    strArray(about, 'facts', 'about');
  }

  // ---- art / pictures ----------------------------------------------------
  function gallery(key, extraKeys) {
    const list = arr(data, key, '', { max: 100 });
    const ids = new Set();
    for (const [item, path] of objectItems(list, key)) {
      knownKeys(item, ['id', 'src', 'alt', 'title', 'caption', 'width', 'height', ...extraKeys], path);
      slugId(item, path, ids);
      check(item, 'src', path, isMediaPath, 'Must be a media path.', { required: true });
      str(item, 'alt', path, { required: true, min: 1 });
      for (const k of ['title', 'caption', ...extraKeys]) str(item, k, path);
      for (const dim of ['width', 'height']) {
        const v = item[dim];
        if (v !== undefined && !(Number.isInteger(v) && v > 0)) error(`${path}.${dim}`, 'Must be a positive integer.');
      }
    }
  }
  gallery('art', ['year', 'medium']);
  gallery('pictures', ['location', 'date']);

  // ---- music -------------------------------------------------------------
  const music = obj(data, 'music', '');
  if (music) {
    knownKeys(music, ['intro', 'tracks'], 'music');
    str(music, 'intro', 'music');
    const tracks = arr(music, 'tracks', 'music', { max: 30 });
    const ids = new Set();
    for (const [t, path] of objectItems(tracks, 'music.tracks')) {
      knownKeys(t, ['id', 'title', 'artist', 'description', 'type', 'url', 'cover', 'coverAlt'], path);
      slugId(t, path, ids);
      str(t, 'title', path, { required: true, min: 1, max: 80 });
      str(t, 'artist', path);
      str(t, 'description', path);
      if (t.type !== 'embed' && t.type !== 'audio') {
        error(`${path}.type`, 'Must be "embed" or "audio".');
      } else if (t.type === 'embed') {
        check(t, 'url', path, isEmbedUrl, `Must be an https URL on the embed allowlist (${EMBED_HOSTS.join(', ')}).`, { required: true });
      } else {
        check(t, 'url', path, isAudioSource, 'Must be a media path ending in .mp3/.ogg/.wav/.m4a/.opus/.flac, or an https URL.', { required: true });
      }
      check(t, 'cover', path, isMediaPath, 'Must be a media path or "".', { allowEmpty: true });
      str(t, 'coverAlt', path);
    }
  }

  // ---- contact -----------------------------------------------------------
  const contact = obj(data, 'contact', '');
  if (contact) {
    knownKeys(contact, ['heading', 'blurb', 'email', 'formEnabled'], 'contact');
    str(contact, 'heading', 'contact', { required: true });
    str(contact, 'blurb', 'contact');
    const email = str(contact, 'email', 'contact', { required: true, max: 254 });
    if (email && !EMAIL_RE.test(email)) error('contact.email', 'Must be a valid email address or "".');
    bool(contact, 'formEnabled', 'contact');
  }

  return { valid: errors.length === 0, errors, warnings };
}
