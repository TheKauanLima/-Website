import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeContent } from '../../public/js/lib/normalize.js';

const REAL = JSON.parse(readFileSync(new URL('../../public/data/content.json', import.meta.url), 'utf8'));

test('never throws on garbage input and returns full defaults', () => {
  for (const raw of [undefined, null, 42, 'str', [], {}, { site: 5, nav: 'x', projects: {} }]) {
    const c = normalizeContent(raw);
    assert.equal(c.schemaVersion, 1);
    assert.equal(typeof c.site.title, 'string');
    assert.ok(c.site.title.length > 0);
    assert.deepEqual(c.nav, [{ id: 'home', label: 'Home', eyebrow: '', intro: '' }]);
    assert.deepEqual(c.projects, []);
    assert.deepEqual(c.art, []);
    assert.deepEqual(c.pictures, []);
    assert.deepEqual(c.music.tracks, []);
    assert.equal(c.site.lang, 'en');
    assert.equal(c.site.themeDefault, 'system');
    assert.equal(c.contact.formEnabled, true);
    assert.equal(c.about.heading, 'About me');
  }
});

test('survives getters that throw', () => {
  const evil = {};
  Object.defineProperty(evil, 'profile', { get() { throw new Error('boom'); }, enumerable: true });
  assert.doesNotThrow(() => normalizeContent(evil));
});

test('the committed content.json keeps every entry', () => {
  const c = normalizeContent(REAL);
  assert.equal(c.projects.length, 3);
  assert.equal(c.art.length, 6);
  assert.equal(c.pictures.length, 6);
  assert.equal(c.music.tracks.length, 2);
  assert.equal(c.nav.length, 7);
  assert.equal(c.profile.name, 'YOUR NAME');
  assert.equal(c.site.title, 'YOUR NAME — Portfolio');
  assert.equal(c.site.footerNote, '© 2026 YOUR NAME. Built by hand with HTML, CSS & JS.');
  assert.equal(c.home.headline, "Hi, I'm YOUR NAME.");
  assert.ok(c.nav.filter((n) => n.id !== 'home').every((n) => n.eyebrow && n.intro));
  assert.deepEqual(c.home.featuredProjectIds, ['project-1', 'project-2']);
  // Links with an empty URL are hidden.
  assert.deepEqual(c.links.map((l) => l.id), ['github', 'linkedin', 'email']);
  // Embed track is converted to the SoundCloud widget.
  assert.equal(c.music.tracks[0].embed.provider, 'soundcloud');
  assert.ok(c.music.tracks[0].embed.src.startsWith('https://w.soundcloud.com/player/?url='));
  assert.equal(c.music.tracks[1].url, 'media/music/sample-tone.wav');
});

test('committed content.json marks placeholders with YOUR', () => {
  const text = JSON.stringify(REAL);
  assert.match(REAL.profile.name, /YOUR/);
  assert.match(REAL.links.find((l) => l.id === 'github').url, /YOUR-/);
  assert.match(REAL.links.find((l) => l.id === 'linkedin').url, /YOUR-/);
  assert.ok((text.match(/YOUR/g) || []).length > 20);
});

test('links: drops unsafe/empty urls, maps unknown icons, dedupes ids', () => {
  const c = normalizeContent({
    links: [
      { id: 'a', label: 'A', url: 'javascript:alert(1)', icon: 'github' },
      { id: 'b', label: 'B', url: '', icon: 'github' },
      { id: 'c', label: 'C', url: 'https://c.example.com', icon: 'myspace' },
      { id: 'c', label: 'C2', url: 'https://c2.example.com', icon: 'github' },
      { id: 'Bad Id', label: 'D', url: 'https://d.example.com', icon: 'github' },
      { id: 'e', label: '', url: 'https://e.example.com', icon: 'github' },
      { id: 'f', label: 'F', url: 'mailto:f@example.com', icon: 'email', showInHero: false },
    ],
  });
  assert.deepEqual(c.links, [
    { id: 'c', label: 'C', url: 'https://c.example.com', icon: 'link', showInHero: true },
    { id: 'f', label: 'F', url: 'mailto:f@example.com', icon: 'email', showInHero: false },
  ]);
});

test('nav: drops unknown and duplicate ids, lowercases, default labels', () => {
  const c = normalizeContent({ nav: [{ id: 'Projects' }, { id: 'blog', label: 'Blog' }, { id: 'projects', label: 'Dup' }, { id: 'art', label: 'Gallery' }] });
  assert.deepEqual(c.nav, [
    { id: 'projects', label: 'Projects', eyebrow: '', intro: '' },
    { id: 'art', label: 'Gallery', eyebrow: '', intro: '' },
  ]);
});

test('projects: required title, unique slug, sanitised image/links, tag cap', () => {
  const c = normalizeContent({
    projects: [
      { id: 'p1', title: 'One', image: '../x.png', tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'], links: [{ label: 'X', url: 'javascript:1' }, { label: 'Y', url: 'https://y.example.com' }] },
      { id: 'p1', title: 'Dup' },
      { id: 'p2' },
      { id: 'p3', title: 'Three', image: 'media/p.svg' },
    ],
    home: { featuredProjectIds: ['p3', 'missing', 'p3'] },
  });
  assert.equal(c.projects.length, 2);
  const [p1, p3] = c.projects;
  assert.equal(p1.image, '');
  assert.equal(p1.tags.length, 8);
  assert.deepEqual(p1.links, [{ label: 'Y', url: 'https://y.example.com' }]);
  assert.equal(p1.featured, false);
  assert.equal(p3.image, 'media/p.svg');
  assert.ok(p3.imageAlt.length > 0, 'image without alt gets a fallback alt');
  assert.deepEqual(c.home.featuredProjectIds, ['p3']);
});

test('art/pictures: require src + alt, keep dimensions only when positive integers', () => {
  const c = normalizeContent({
    art: [
      { id: 'a1', src: 'media/a.svg', alt: 'A', width: 100, height: 200, medium: 'Ink' },
      { id: 'a2', src: 'media/b.svg' },
      { id: 'a3', src: '/abs.svg', alt: 'x' },
      { id: 'a4', src: 'media/c.svg', alt: 'C', width: -3, height: 1.5 },
    ],
    pictures: [{ id: 'p1', src: 'https://img.example.com/p.jpg', alt: 'P', location: 'Here' }],
  });
  assert.deepEqual(c.art.map((a) => a.id), ['a1', 'a4']);
  assert.equal(c.art[0].medium, 'Ink');
  assert.equal(c.art[1].width, null);
  assert.equal(c.art[1].height, null);
  assert.equal(c.pictures[0].location, 'Here');
});

test('music: drops tracks with non-allowlisted or invalid urls', () => {
  const c = normalizeContent({
    music: {
      tracks: [
        { id: 't1', title: 'YT', type: 'embed', url: 'https://youtu.be/dQw4w9WgXcQ' },
        { id: 't2', title: 'Bad host', type: 'embed', url: 'https://evil.example.com/player' },
        { id: 't3', title: 'Local', type: 'audio', url: 'media/music/x.mp3' },
        { id: 't4', title: 'Not audio', type: 'audio', url: 'media/music/x.exe' },
        { id: 't5', title: 'Bad type', type: 'video', url: 'media/music/x.mp3' },
        { id: 't6', type: 'audio', url: 'media/music/y.mp3' },
      ],
    },
  });
  assert.deepEqual(c.music.tracks.map((t) => t.id), ['t1', 't3']);
  assert.deepEqual(c.music.tracks[0].embed, { src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', provider: 'youtube' });
  assert.equal(c.music.tracks[1].embed, null);
});

test('site/profile/contact defaults and sanitising', () => {
  const c = normalizeContent({
    site: { themeDefault: 'neon' },
    profile: { name: 'Ada', roles: ['a', 2, '', 'b'], resumeUrl: 'javascript:1', avatar: 'media/me.png' },
    contact: { email: 'not-an-email', formEnabled: false },
    home: { cta: [{ label: 'Go', href: '#nowhere' }, { label: 'Home', href: '#home' }, { label: 'Bad', href: 'javascript:1' }] },
  });
  assert.equal(c.site.themeDefault, 'system');
  assert.equal(c.site.title, 'Ada — Portfolio');
  assert.deepEqual(c.profile.roles, ['a', 'b']);
  assert.equal(c.profile.resumeUrl, '');
  assert.equal(c.profile.avatarAlt, 'Portrait of Ada');
  assert.equal(c.contact.email, '');
  assert.equal(c.contact.formEnabled, false);
  assert.deepEqual(c.home.cta, [{ label: 'Home', href: '#home' }]);
  assert.equal(c.home.headline, "Hi, I'm Ada.");
});

test('truncates over-long strings instead of dropping them', () => {
  const c = normalizeContent({ profile: { name: 'x'.repeat(200) }, projects: [{ id: 'p', title: 'T', summary: 's'.repeat(300) }] });
  assert.equal(c.profile.name.length, 80);
  assert.equal(c.projects[0].summary.length, 160);
});

test('{name} token is replaced in site.title, site.description and home.headline', () => {
  const c = normalizeContent({
    site: { title: '{name} — Portfolio', description: 'Work by {name}. More {name}.', footerNote: '© 2026 {name}. Built by hand.' },
    profile: { name: 'Grace Hopper' },
    home: { headline: "Hi, I'm {name}." },
  });
  assert.equal(c.site.title, 'Grace Hopper — Portfolio');
  assert.equal(c.site.description, 'Work by Grace Hopper. More Grace Hopper.');
  assert.equal(c.home.headline, "Hi, I'm Grace Hopper.");
  assert.equal(c.site.footerNote, '© 2026 Grace Hopper. Built by hand.');
});

test('nav eyebrow/intro are optional strings truncated to 40 / 240', () => {
  const c = normalizeContent({ nav: [
    { id: 'projects', label: 'Projects', eyebrow: 'Work', intro: 'Things I built.' },
    { id: 'art', eyebrow: 'e'.repeat(60), intro: 'i'.repeat(300) },
    { id: 'music', eyebrow: 5, intro: null },
  ] });
  assert.deepEqual(c.nav[0], { id: 'projects', label: 'Projects', eyebrow: 'Work', intro: 'Things I built.' });
  assert.equal(c.nav[1].eyebrow.length, 40);
  assert.equal(c.nav[1].intro.length, 240);
  assert.equal(c.nav[2].eyebrow, '');
  assert.equal(c.nav[2].intro, '');
});

test('featuredProjectIds: null when absent, [] kept when explicitly empty', () => {
  const projects = [{ id: 'p1', title: 'One' }];
  assert.equal(normalizeContent({ projects, home: {} }).home.featuredProjectIds, null);
  assert.deepEqual(normalizeContent({ projects, home: { featuredProjectIds: [] } }).home.featuredProjectIds, []);
});
