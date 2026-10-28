// DOM-free content normalizer. Applies defaults and drops invalid entries. Never throws.
import { safeHref, safeMediaSrc, safeAudioSrc, toEmbedUrl } from './urls.js';

export const NAV_IDS = Object.freeze(['home', 'projects', 'art', 'music', 'pictures', 'about', 'contact']);
export const NAV_LABELS = Object.freeze({
  home: 'Home', projects: 'Projects', art: 'Art', music: 'Music',
  pictures: 'Pictures', about: 'About', contact: 'Contact',
});
export const ICONS = Object.freeze([
  'github', 'linkedin', 'email', 'instagram', 'soundcloud', 'spotify', 'youtube', 'bandcamp',
  'x', 'bluesky', 'mastodon', 'behance', 'dribbble', 'artstation', 'website', 'resume', 'link',
]);

const ICON_SET = new Set(ICONS);
const NAV_SET = new Set(NAV_IDS);
const SLUG_RE = /^[a-z0-9-]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const THEMES = new Set(['system', 'dark', 'light']);
export const NAME_TOKEN = '{name}';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const obj = (v) => (isObj(v) ? v : {});
const arr = (v) => (Array.isArray(v) ? v : []);

/** Trimmed string or fallback; truncated to max code points when given. */
function str(v, fallback = '', max = Infinity) {
  if (typeof v !== 'string') return fallback;
  const s = v.trim();
  if (!s) return fallback;
  const cps = [...s];
  return cps.length > max ? cps.slice(0, max).join('') : s;
}
const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);
const posInt = (v) => (Number.isInteger(v) && v > 0 ? v : null);
const strList = (v, maxItems = Infinity, maxLen = Infinity) =>
  arr(v).map((x) => str(x, '', maxLen)).filter(Boolean).slice(0, maxItems);

/** Keeps entries with a valid, unique slug id. */
function uniqueSlugs(list, mapFn) {
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    if (!isObj(raw)) continue;
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    if (!SLUG_RE.test(id) || seen.has(id)) continue;
    const item = mapFn(raw, id);
    if (!item) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

/** Replaces every literal "{name}" token with the profile name (ARCHITECTURE A6). */
export function fillName(text, name) {
  return typeof text === 'string' ? text.split(NAME_TOKEN).join(name) : '';
}

function normSite(raw, profileName, hasName) {
  const s = obj(raw);
  return {
    title: fillName(str(s.title, hasName ? `${NAME_TOKEN} — Portfolio` : 'Portfolio', 80), profileName),
    description: fillName(str(s.description, '', 200), profileName),
    lang: str(s.lang, 'en', 35),
    themeDefault: THEMES.has(s.themeDefault) ? s.themeDefault : 'system',
    footerNote: fillName(str(s.footerNote), profileName),
  };
}

function normProfile(raw) {
  const p = obj(raw);
  const name = str(p.name, 'Portfolio', 80);
  const role = str(p.role, '', 80);
  const avatar = safeMediaSrc(p.avatar) || '';
  return {
    name,
    role,
    roles: strList(p.roles, 6, 80),
    tagline: str(p.tagline, '', 200),
    location: str(p.location),
    avatar,
    avatarAlt: str(p.avatarAlt, avatar ? `Portrait of ${name}` : ''),
    availability: str(p.availability),
    resumeUrl: safeHref(p.resumeUrl) || '',
  };
}

function normLinks(raw) {
  return uniqueSlugs(arr(raw), (l) => {
    const label = str(l.label, '', 40);
    const url = safeHref(l.url);
    if (!label || !url) return null;
    return {
      id: l.id.trim(),
      label,
      url,
      icon: ICON_SET.has(l.icon) ? l.icon : 'link',
      showInHero: bool(l.showInHero, true),
    };
  }).slice(0, 20);
}

function normNav(raw) {
  const seen = new Set();
  const out = [];
  for (const n of arr(raw)) {
    if (!isObj(n)) continue;
    const id = typeof n.id === 'string' ? n.id.trim().toLowerCase() : '';
    if (!NAV_SET.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label: str(n.label, NAV_LABELS[id], 24), eyebrow: str(n.eyebrow, '', 40), intro: str(n.intro, '', 240) });
    if (out.length === 7) break;
  }
  return out.length ? out : [{ id: 'home', label: 'Home', eyebrow: '', intro: '' }];
}

function normProjects(raw) {
  return uniqueSlugs(arr(raw), (p, id) => {
    const title = str(p.title, '', 80);
    if (!title) return null;
    const image = safeMediaSrc(p.image) || '';
    return {
      id,
      title,
      summary: str(p.summary, '', 160),
      description: str(p.description),
      image,
      imageAlt: image ? str(p.imageAlt, `Image of ${title}`) : '',
      year: str(typeof p.year === 'number' ? String(p.year) : p.year),
      role: str(p.role),
      tags: strList(p.tags, 8, 40),
      links: arr(p.links)
        .filter(isObj)
        .map((l) => ({ label: str(l.label, '', 40), url: safeHref(l.url) }))
        .filter((l) => l.label && l.url),
      featured: bool(p.featured, false),
    };
  }).slice(0, 50);
}

function normMediaItems(raw, kind) {
  return uniqueSlugs(arr(raw), (m, id) => {
    const src = safeMediaSrc(m.src);
    const alt = str(m.alt);
    if (!src || !alt) return null;
    const item = {
      id,
      src,
      alt,
      title: str(m.title),
      caption: str(m.caption),
      width: posInt(m.width),
      height: posInt(m.height),
    };
    if (kind === 'art') {
      item.year = str(typeof m.year === 'number' ? String(m.year) : m.year);
      item.medium = str(m.medium);
    } else {
      item.location = str(m.location);
      item.date = str(m.date);
    }
    return item;
  }).slice(0, 100);
}

function normMusic(raw) {
  const m = obj(raw);
  const tracks = uniqueSlugs(arr(m.tracks), (t, id) => {
    const title = str(t.title, '', 80);
    if (!title) return null;
    const type = t.type === 'embed' || t.type === 'audio' ? t.type : null;
    if (!type) return null;
    let url = null;
    let embed = null;
    if (type === 'embed') {
      embed = toEmbedUrl(typeof t.url === 'string' ? t.url : '');
      if (!embed) return null;
      url = t.url.trim();
    } else {
      url = safeAudioSrc(t.url);
      if (!url) return null;
    }
    const cover = safeMediaSrc(t.cover) || '';
    return {
      id,
      title,
      artist: str(t.artist),
      description: str(t.description),
      type,
      url,
      embed,
      cover,
      coverAlt: cover ? str(t.coverAlt, `Cover art for ${title}`) : '',
    };
  }).slice(0, 30);
  return { intro: str(m.intro), tracks };
}

function normHome(raw, profile, navIds, projectIds) {
  const h = obj(raw);
  const cta = [];
  for (const c of arr(h.cta)) {
    if (!isObj(c)) continue;
    const label = str(c.label, '', 40);
    const href = safeHref(c.href);
    if (!label || !href) continue;
    if (href.startsWith('#') && !navIds.has(href.slice(1).toLowerCase())) continue;
    cta.push({ label, href });
    if (cta.length === 3) break;
  }
  return {
    headline: fillName(str(h.headline, `Hi, I'm ${NAME_TOKEN}.`), profile.name),
    intro: str(h.intro),
    highlights: arr(h.highlights)
      .filter(isObj)
      .map((x) => ({ value: str(x.value, '', 12), label: str(x.label, '', 40) }))
      .filter((x) => x.value && x.label)
      .slice(0, 4),
    cta,
    // null = not specified (views fall back to featured:true / first two); [] = explicitly none.
    featuredProjectIds: Array.isArray(h.featuredProjectIds)
      ? [...new Set(strList(h.featuredProjectIds))].filter((id) => projectIds.has(id))
      : null,
  };
}

function normAbout(raw) {
  const a = obj(raw);
  return {
    heading: str(a.heading, 'About me'),
    paragraphs: strList(a.paragraphs),
    skills: arr(a.skills)
      .filter(isObj)
      .map((s) => ({ group: str(s.group), items: strList(s.items) }))
      .filter((s) => s.group && s.items.length),
    timeline: arr(a.timeline)
      .filter(isObj)
      .map((t) => ({ period: str(t.period), title: str(t.title), org: str(t.org), description: str(t.description) }))
      .filter((t) => t.title),
    facts: strList(a.facts),
  };
}

function normContact(raw) {
  const c = obj(raw);
  const email = str(c.email);
  return {
    heading: str(c.heading, "Let's talk"),
    blurb: str(c.blurb),
    email: EMAIL_RE.test(email) && [...email].length <= 254 ? email : '',
    formEnabled: bool(c.formEnabled, true),
  };
}

function build(raw) {
  const r = obj(raw);
  const profile = normProfile(r.profile);
  const nav = normNav(r.nav);
  const projects = normProjects(r.projects);
  const navIds = new Set(nav.map((n) => n.id));
  const projectIds = new Set(projects.map((p) => p.id));
  return {
    schemaVersion: 1,
    site: normSite(r.site, profile.name, !!(isObj(r.profile) && str(r.profile.name))),
    profile,
    links: normLinks(r.links),
    nav,
    home: normHome(r.home, profile, navIds, projectIds),
    about: normAbout(r.about),
    projects,
    art: normMediaItems(r.art, 'art'),
    music: normMusic(r.music),
    pictures: normMediaItems(r.pictures, 'pictures'),
    contact: normContact(r.contact),
  };
}

/** normalizeContent(raw) → Content. Never throws. */
export function normalizeContent(raw) {
  try {
    return build(raw);
  } catch {
    return build({});
  }
}
