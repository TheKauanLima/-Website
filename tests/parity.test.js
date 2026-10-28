// Backend/frontend parity (ARCHITECTURE.md amendment A4).
// 1. Constants duplicated between server/lib and public/js/lib must be identical.
// 2. Anything the backend validator accepts must survive the frontend normalizer intact.
// The frontend modules are only imported/read here, never modified.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as schema from '../server/lib/content-schema.js';
import { EMAIL_RE as CONTACT_EMAIL_RE } from '../server/lib/validate-contact.js';
import * as urls from '../public/js/lib/urls.js';
import * as normalize from '../public/js/lib/normalize.js';

const fePath = (rel) => fileURLToPath(new URL(`../public/js/${rel}`, import.meta.url));
const CONTENT_FILE = fileURLToPath(new URL('../public/data/content.json', import.meta.url));
const FIXTURE = fileURLToPath(new URL('./fixtures/content.valid.json', import.meta.url));

/** Extract a (non-exported) regex literal `const NAME = /.../flags;` from a frontend source file. */
function regexFromSource(rel, name) {
  const src = fs.readFileSync(fePath(rel), 'utf8');
  const m = new RegExp(`const ${name} = /(.+)/([a-z]*);`).exec(src);
  assert.ok(m, `${name} not found in public/js/${rel}`);
  return new RegExp(m[1], m[2]);
}

const sameRegex = (a, b) => a.source === b.source && a.flags === b.flags;

describe('parity: shared constants', () => {
  test('ICONS', () => assert.deepEqual([...schema.ICONS], [...normalize.ICONS]));
  test('NAV_IDS', () => assert.deepEqual([...schema.NAV_IDS], [...normalize.NAV_IDS]));
  test('EMBED_HOSTS', () => assert.deepEqual([...schema.EMBED_HOSTS].sort(), [...urls.EMBED_HOSTS].sort()));

  test('EMAIL_RE (contact API, content schema, normalizer, contact form)', () => {
    assert.equal(schema.EMAIL_RE, CONTACT_EMAIL_RE, 'server uses a single EMAIL_RE');
    for (const rel of ['lib/normalize.js', 'components/contact-form.js']) {
      const fe = regexFromSource(rel, 'EMAIL_RE');
      assert.ok(sameRegex(fe, CONTACT_EMAIL_RE), `${rel}: ${fe} !== ${CONTACT_EMAIL_RE}`);
    }
  });

  test('audio extension regex', () => {
    const fe = regexFromSource('lib/urls.js', 'AUDIO_EXT_RE');
    assert.ok(sameRegex(fe, schema.AUDIO_EXT_RE), `${fe} !== ${schema.AUDIO_EXT_RE}`);
  });
});

describe('parity: URL rules (validator accepts ⇒ frontend accepts)', () => {
  const EMBED_CORPUS = [
    'https://soundcloud.com/artist/track',
    'https://soundcloud.com/',
    'https://soundcloud.com',
    'https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F1',
    'https://w.soundcloud.com/other',
    'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
    'https://open.spotify.com/intl-de/track/4uLU6hMCjMI75M1A2tKUQC',
    'https://open.spotify.com/embed/album/4uLU6hMCjMI75M1A2tKUQC',
    'https://open.spotify.com/show/4uLU6hMCjMI75M1A2tKUQC',
    'https://open.spotify.com/track/abc',
    'https://open.spotify.com/user/4uLU6hMCjMI75M1A2tKUQC',
    'https://open.spotify.com/',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://youtu.be/',
    'https://youtu.be/abc',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/watch?v=dQw4w9WgXcQ&t=10',
    'https://www.youtube.com/watch?v=',
    'https://www.youtube.com/watch?v=bad%20id',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/live/dQw4w9WgXcQ',
    'https://www.youtube.com/channel/UC123456',
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://bandcamp.com/EmbeddedPlayer/album=1/size=large',
    'https://bandcamp.com/album/x',
    'https://artist.bandcamp.com/track/x',
    'https://embed.music.apple.com/us/album/x/1',
    'https://embed.music.apple.com/',
    'http://soundcloud.com/a/b',
    'https://SOUNDCLOUD.com/a/b',
    'https://soundcloud.com.evil.com/a',
    'https://evil.com/?soundcloud.com',
    'https://soundcloud.com/a\\b',
    ' https://youtu.be/dQw4w9WgXcQ',
    'javascript:alert(1)',
    'media/music/a.mp3',
    '',
  ];

  test('isEmbedUrl matches toEmbedUrl exactly (validator never looser)', () => {
    for (const url of EMBED_CORPUS) {
      const fe = urls.toEmbedUrl(url) !== null;
      const be = schema.isEmbedUrl(url);
      if (be) assert.ok(fe, `validator accepts but toEmbedUrl rejects: ${url}`);
      // Only whitespace/backslash inputs may differ (validator is stricter there).
      if (!/[\s\\]/.test(url)) assert.equal(be, fe, `mismatch for ${url}`);
    }
  });

  const HREF_CORPUS = [
    'https://example.com', 'http://example.com/x?y=1#z', 'mailto:a@b.co', 'mailto:', '#projects', '#',
    'media/cv.pdf', './x.html', '../x.html', 'x', '//evil.com', 'javascript:alert(1)', 'JAVASCRIPT:x',
    'java\nscript:x', 'data:text/html,x', 'vbscript:x', 'ftp://x.com', 'https://', 'https://a.com\\b',
    'media\\cv.pdf', ' https://a.com', 'a b', '\u0000x', 'tel:+123',
  ];
  test('isUrl ⇒ safeHref', () => {
    for (const url of HREF_CORPUS) {
      if (schema.isUrl(url)) assert.ok(urls.safeHref(url), `isUrl accepts but safeHref rejects: ${JSON.stringify(url)}`);
    }
    assert.equal(schema.isUrl('https://a.com\\b'), false);
    assert.equal(schema.isUrl('media\\cv.pdf'), false);
  });

  const MEDIA_CORPUS = [
    'media/a.svg', 'a.png', 'media/music/a.mp3', 'media/music/a.MP3', 'media/a', 'https://cdn.example.com/a.jpg',
    'https://cdn.example.com/stream', 'http://x.com/a.png', '/media/a.svg', '../a.svg', 'media/../a.svg', 'media\\a.svg',
    'media/a b.svg', 'a%20b.svg', 'javascript:x', '', ' media/a.svg', 'https://a.com/a\\b.png',
  ];
  test('isMediaPath ⇒ safeMediaSrc, isAudioSource ⇒ safeAudioSrc', () => {
    for (const p of MEDIA_CORPUS) {
      if (schema.isMediaPath(p)) assert.ok(urls.safeMediaSrc(p), `isMediaPath accepts but safeMediaSrc rejects: ${p}`);
      if (schema.isAudioSource(p)) assert.ok(urls.safeAudioSrc(p), `isAudioSource accepts but safeAudioSrc rejects: ${p}`);
    }
  });
});

// ---- document-level: validator-accepted content is never dropped --------------

const base = () => JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const nonEmptyUrl = (list) => (list ?? []).filter((l) => l.url !== '');

/** Assert that normalizeContent kept every entry of a validator-accepted document. */
function assertNothingDropped(raw, label) {
  const n = normalize.normalizeContent(structuredClone(raw));
  const eq = (actual, expected, what) => assert.equal(actual, expected, `${label}: ${what}`);

  // Links with url "" are hidden by design (§2 rules); everything else must survive.
  eq(n.links.length, nonEmptyUrl(raw.links).length, 'links');
  eq(n.nav.length, raw.nav.length, 'nav');
  raw.nav.forEach((item, i) => {
    eq(n.nav[i].id, item.id, `nav[${i}].id`);
    if (typeof item.eyebrow === 'string' && item.eyebrow.trim() && 'eyebrow' in n.nav[i]) {
      eq(n.nav[i].eyebrow, item.eyebrow.trim(), `nav[${i}].eyebrow`);
    }
    if (typeof item.intro === 'string' && item.intro.trim() && 'intro' in n.nav[i]) {
      eq(n.nav[i].intro, item.intro.trim(), `nav[${i}].intro`);
    }
  });
  eq(n.profile.roles.length, (raw.profile.roles ?? []).length, 'profile.roles');
  if (raw.profile.avatar) eq(n.profile.avatar, raw.profile.avatar, 'profile.avatar');
  if (raw.profile.resumeUrl) eq(n.profile.resumeUrl, raw.profile.resumeUrl, 'profile.resumeUrl');

  const projects = raw.projects ?? [];
  eq(n.projects.length, projects.length, 'projects');
  projects.forEach((p, i) => {
    if (p.image) eq(n.projects[i].image, p.image, `projects[${i}].image`);
    eq(n.projects[i].tags.length, (p.tags ?? []).length, `projects[${i}].tags`);
    eq(n.projects[i].links.length, nonEmptyUrl(p.links).length, `projects[${i}].links`);
  });

  if (raw.home) {
    eq(n.home.highlights.length, (raw.home.highlights ?? []).length, 'home.highlights');
    eq(n.home.cta.length, (raw.home.cta ?? []).length, 'home.cta');
    eq(n.home.featuredProjectIds.length, new Set(raw.home.featuredProjectIds ?? []).size, 'home.featuredProjectIds');
  }
  if (raw.about) {
    eq(n.about.paragraphs.length, (raw.about.paragraphs ?? []).length, 'about.paragraphs');
    eq(n.about.skills.length, (raw.about.skills ?? []).length, 'about.skills');
    (raw.about.skills ?? []).forEach((s, i) => eq(n.about.skills[i].items.length, s.items.length, `about.skills[${i}].items`));
    eq(n.about.timeline.length, (raw.about.timeline ?? []).length, 'about.timeline');
    eq(n.about.facts.length, (raw.about.facts ?? []).length, 'about.facts');
  }
  eq(n.art.length, (raw.art ?? []).length, 'art');
  eq(n.pictures.length, (raw.pictures ?? []).length, 'pictures');
  const tracks = raw.music?.tracks ?? [];
  eq(n.music.tracks.length, tracks.length, 'music.tracks');
  tracks.forEach((t, i) => {
    if (t.cover) eq(n.music.tracks[i].cover, t.cover, `music.tracks[${i}].cover`);
  });
  if (raw.contact) eq(n.contact.email, raw.contact.email, 'contact.email');
}

function variant(label, fn) {
  const doc = base();
  fn(doc);
  return [label, doc];
}

const EDGE_DOCS = [
  variant('fixture as-is', () => {}),
  variant('minimal document', (d) => {
    for (const k of ['links', 'home', 'about', 'projects', 'art', 'music', 'pictures', 'contact']) delete d[k];
    d.profile = { name: 'N', role: 'R' };
    d.site = { title: 'T' };
  }),
  variant('name token and per-tab copy (A6/A7)', (d) => {
    d.site.title = '{name} — Portfolio';
    d.home.headline = "Hi, I'm {name}.";
    d.nav.forEach((n, i) => {
      n.eyebrow = `Eyebrow ${i}`;
      n.intro = `Intro text for tab ${i}.`;
    });
    d.nav[0].eyebrow = 'e'.repeat(40);
    d.nav[0].intro = 'i'.repeat(240);
  }),
  variant('all embed forms', (d) => {
    const forms = [
      'https://youtu.be/dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ', 'https://open.spotify.com/intl-fr/playlist/37i9dQZF1DXcBWIGoYBM5M',
      'https://w.soundcloud.com/player/?url=x', 'https://bandcamp.com/EmbeddedPlayer/album=1',
      'https://embed.music.apple.com/us/album/x/1',
    ];
    d.music.tracks = forms.map((url, i) => ({ id: `t${i}`, title: `Track ${i}`, type: 'embed', url }));
  }),
  variant('https media everywhere', (d) => {
    d.profile.avatar = 'https://cdn.example.com/me.jpg';
    d.projects[0].image = 'https://cdn.example.com/p.png';
    d.art[0].src = 'https://cdn.example.com/a.png';
    d.music.tracks[1].url = 'https://cdn.example.com/stream';
  }),
  variant('empty urls hide links', (d) => {
    d.links.forEach((l) => (l.url = ''));
    d.projects[0].links.forEach((l) => (l.url = ''));
    d.profile.resumeUrl = '';
    d.contact.email = '';
  }),
  variant('rejected: unknown icon', (d) => (d.links[0].icon = 'myspace')),
  variant('max counts', (d) => {
    d.links = Array.from({ length: 20 }, (_, i) => ({ id: `l${i}`, label: `L${i}`, url: `https://e.com/${i}`, icon: 'link' }));
    d.projects = Array.from({ length: 50 }, (_, i) => ({ id: `p${i}`, title: `P${i}`, tags: Array(8).fill('t') }));
    d.home.featuredProjectIds = ['p0', 'p49'];
    d.art = Array.from({ length: 100 }, (_, i) => ({ id: `a${i}`, src: `media/a${i}.svg`, alt: `Art ${i}` }));
    d.profile.roles = Array(6).fill('Role');
    d.home.highlights = Array(4).fill({ value: '123456789012', label: 'l'.repeat(40) });
  }),
  variant('cta href to a url and a hash in nav', (d) => {
    d.home.cta = [{ label: 'Site', href: 'https://example.com' }, { label: 'Art', href: '#art' }, { label: 'Mail', href: 'mailto:a@b.co' }];
  }),
  variant('surrounding whitespace in text', (d) => {
    d.profile.name = '  Padded  ';
    d.links[0].label = ' GitHub ';
    d.about.paragraphs = ['  para  '];
  }),
  variant('rejected: blank label', (d) => (d.links[0].label = '   ')),
  variant('rejected: cta to missing tab', (d) => (d.home.cta = [{ label: 'Blog', href: '#blog' }])),
  variant('rejected: bad contact email', (d) => (d.contact.email = 'nope')),
  variant('rejected: unconvertible embed', (d) => (d.music.tracks[0].url = 'https://www.youtube.com/')),
];

describe('parity: validator-accepted documents survive normalizeContent', () => {
  test('edge-case documents', () => {
    let accepted = 0;
    for (const [label, doc] of EDGE_DOCS) {
      const { valid } = schema.validateContent(doc);
      if (label.startsWith('rejected:')) {
        assert.equal(valid, false, `${label} should be rejected by the validator`);
        continue;
      }
      if (!valid) continue;
      accepted++;
      assertNothingDropped(doc, label);
    }
    assert.ok(accepted >= 9, `expected most edge documents to be valid, got ${accepted}`);
  });

  test('the committed content.json', (t) => {
    if (!fs.existsSync(CONTENT_FILE)) return t.skip('content.json not present yet');
    const doc = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8').replace(/^﻿/, ''));
    if (!schema.validateContent(doc).valid) return t.skip('content.json fails the schema (see content-file.test.js)');
    assertNothingDropped(doc, 'content.json');
  });
});
