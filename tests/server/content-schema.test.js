import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  isAudioSource,
  isEmbedUrl,
  isMediaPath,
  isUrl,
  validateContent,
} from '../../server/lib/content-schema.js';
import { FIXTURE_BROKEN, FIXTURE_CONTENT } from '../helpers/server.js';

const load = () => JSON.parse(fs.readFileSync(FIXTURE_CONTENT, 'utf8'));

function errorPaths(data) {
  return validateContent(data).errors.map((e) => e.path);
}

function mutate(fn) {
  const data = load();
  fn(data);
  return data;
}

describe('validateContent: fixtures', () => {
  test('content.valid.json is valid with no warnings', () => {
    const r = validateContent(load());
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.warnings, []);
    assert.equal(r.valid, true);
  });

  test('content.broken.json is not parseable JSON', () => {
    assert.throws(() => JSON.parse(fs.readFileSync(FIXTURE_BROKEN, 'utf8')));
  });

  test('non-object roots are invalid', () => {
    for (const v of [null, [], 'x', 1]) assert.equal(validateContent(v).valid, false);
  });

  test('a minimal document is valid', () => {
    const r = validateContent({
      schemaVersion: 1,
      site: { title: 'T' },
      profile: { name: 'N', role: 'R' },
      nav: [{ id: 'home', label: 'Home' }],
    });
    assert.deepEqual(r.errors, []);
  });
});

describe('validateContent: rules', () => {
  const cases = [
    ['schemaVersion missing', (d) => delete d.schemaVersion, 'schemaVersion'],
    ['schemaVersion 2', (d) => (d.schemaVersion = 2), 'schemaVersion'],
    ['schemaVersion "1"', (d) => (d.schemaVersion = '1'), 'schemaVersion'],
    ['site missing', (d) => delete d.site, 'site'],
    ['site.title empty', (d) => (d.site.title = ''), 'site.title'],
    ['site.title 81 chars', (d) => (d.site.title = 't'.repeat(81)), 'site.title'],
    ['site.description too long', (d) => (d.site.description = 'd'.repeat(201)), 'site.description'],
    ['site.themeDefault bad', (d) => (d.site.themeDefault = 'blue'), 'site.themeDefault'],
    ['profile.name missing', (d) => delete d.profile.name, 'profile.name'],
    ['profile.role too long', (d) => (d.profile.role = 'r'.repeat(81)), 'profile.role'],
    ['profile.roles > 6', (d) => (d.profile.roles = Array(7).fill('x')), 'profile.roles'],
    ['profile.roles non-string', (d) => (d.profile.roles = [1]), 'profile.roles[0]'],
    ['profile.tagline too long', (d) => (d.profile.tagline = 't'.repeat(201)), 'profile.tagline'],
    ['profile.avatar absolute path', (d) => (d.profile.avatar = '/media/a.svg'), 'profile.avatar'],
    ['profile.avatar traversal', (d) => (d.profile.avatar = 'media/../x.svg'), 'profile.avatar'],
    ['profile.avatar http', (d) => (d.profile.avatar = 'http://x.com/a.png'), 'profile.avatar'],
    ['profile.resumeUrl javascript:', (d) => (d.profile.resumeUrl = 'javascript:alert(1)'), 'profile.resumeUrl'],
    ['links > 20', (d) => (d.links = Array.from({ length: 21 }, (_, i) => ({ id: `l${i}`, label: 'L', url: '', icon: 'link' }))), 'links'],
    ['link id not slug', (d) => (d.links[0].id = 'Git Hub'), 'links[0].id'],
    ['link id duplicate', (d) => (d.links[1].id = 'github'), 'links[1].id'],
    ['link label empty', (d) => (d.links[0].label = ''), 'links[0].label'],
    ['link label too long', (d) => (d.links[0].label = 'l'.repeat(41)), 'links[0].label'],
    ['link url javascript:', (d) => (d.links[0].url = 'javascript:alert(1)'), 'links[0].url'],
    ['link url data:', (d) => (d.links[0].url = 'data:text/html,hi'), 'links[0].url'],
    ['link url protocol-relative', (d) => (d.links[0].url = '//evil.com'), 'links[0].url'],
    ['link icon unknown', (d) => (d.links[0].icon = 'myspace'), 'links[0].icon'],
    ['link showInHero not bool', (d) => (d.links[0].showInHero = 'yes'), 'links[0].showInHero'],
    ['nav empty', (d) => (d.nav = []), 'nav'],
    ['nav > 7', (d) => d.nav.push({ id: 'home', label: 'Again' }), 'nav'],
    ['nav id unknown', (d) => (d.nav[0].id = 'blog'), 'nav[0].id'],
    ['nav id duplicate', (d) => (d.nav[1].id = 'home'), 'nav[1].id'],
    ['nav label too long', (d) => (d.nav[0].label = 'n'.repeat(25)), 'nav[0].label'],
    ['home.headline missing', (d) => delete d.home.headline, 'home.headline'],
    ['home.highlights > 4', (d) => (d.home.highlights = Array(5).fill({ value: '1', label: 'x' })), 'home.highlights'],
    ['highlight value > 12', (d) => (d.home.highlights[0].value = 'v'.repeat(13)), 'home.highlights[0].value'],
    ['highlight label > 40', (d) => (d.home.highlights[0].label = 'l'.repeat(41)), 'home.highlights[0].label'],
    ['home.cta > 3', (d) => (d.home.cta = Array(4).fill({ label: 'x', href: '#home' })), 'home.cta'],
    ['cta href unknown hash', (d) => (d.home.cta[0].href = '#blog'), 'home.cta[0].href'],
    ['cta href javascript:', (d) => (d.home.cta[0].href = 'javascript:void(0)'), 'home.cta[0].href'],
    ['featured id unknown', (d) => (d.home.featuredProjectIds = ['nope']), 'home.featuredProjectIds[0]'],
    ['about.heading missing', (d) => delete d.about.heading, 'about.heading'],
    ['about.skills items missing', (d) => delete d.about.skills[0].items, 'about.skills[0].items'],
    ['about.timeline title missing', (d) => delete d.about.timeline[0].title, 'about.timeline[0].title'],
    ['about.facts non-string', (d) => (d.about.facts = [1]), 'about.facts[0]'],
    ['projects > 50', (d) => (d.projects = Array.from({ length: 51 }, (_, i) => ({ id: `p${i}`, title: 'P' }))), 'projects'],
    ['project title empty', (d) => (d.projects[0].title = ''), 'projects[0].title'],
    ['project summary > 160', (d) => (d.projects[0].summary = 's'.repeat(161)), 'projects[0].summary'],
    ['project image bad', (d) => (d.projects[0].image = 'C:\\img.png'), 'projects[0].image'],
    ['project imageAlt missing with image', (d) => (d.projects[0].imageAlt = ''), 'projects[0].imageAlt'],
    ['project tags > 8', (d) => (d.projects[0].tags = Array(9).fill('t')), 'projects[0].tags'],
    ['project link url bad', (d) => (d.projects[0].links[0].url = 'javascript:x'), 'projects[0].links[0].url'],
    ['project featured not bool', (d) => (d.projects[0].featured = 1), 'projects[0].featured'],
    ['project id duplicate', (d) => d.projects.push({ ...d.projects[0] }), 'projects[1].id'],
    ['art src missing', (d) => delete d.art[0].src, 'art[0].src'],
    ['art alt empty', (d) => (d.art[0].alt = ''), 'art[0].alt'],
    ['art alt blank', (d) => (d.art[0].alt = '   '), 'art[0].alt'],
    ['art width not integer', (d) => (d.art[0].width = 12.5), 'art[0].width'],
    ['art height zero', (d) => (d.art[0].height = 0), 'art[0].height'],
    ['art > 100', (d) => (d.art = Array.from({ length: 101 }, (_, i) => ({ id: `a${i}`, src: 'a.svg', alt: 'a' }))), 'art'],
    ['picture id not slug', (d) => (d.pictures[0].id = 'Pic_1'), 'pictures[0].id'],
    ['picture src traversal', (d) => (d.pictures[0].src = '../secret.jpg'), 'pictures[0].src'],
    ['tracks > 30', (d) => (d.music.tracks = Array.from({ length: 31 }, (_, i) => ({ id: `t${i}`, title: 'T', type: 'audio', url: 'a.mp3' }))), 'music.tracks'],
    ['track type bad', (d) => (d.music.tracks[0].type = 'video'), 'music.tracks[0].type'],
    ['embed not allowlisted', (d) => (d.music.tracks[0].url = 'https://evil.example/player'), 'music.tracks[0].url'],
    ['embed over http', (d) => (d.music.tracks[0].url = 'http://soundcloud.com/x/y'), 'music.tracks[0].url'],
    ['audio bad extension', (d) => (d.music.tracks[1].url = 'media/music/track.exe'), 'music.tracks[1].url'],
    ['audio absolute path', (d) => (d.music.tracks[1].url = '/media/music/a.mp3'), 'music.tracks[1].url'],
    ['track title > 80', (d) => (d.music.tracks[0].title = 't'.repeat(81)), 'music.tracks[0].title'],
    ['track cover bad', (d) => (d.music.tracks[0].cover = 'java script:x'), 'music.tracks[0].cover'],
    ['contact.email not string', (d) => (d.contact.email = null), 'contact.email'],
    ['contact.formEnabled not bool', (d) => (d.contact.formEnabled = 'true'), 'contact.formEnabled'],
    // v1.1 amendments
    ['contact.email invalid (A4)', (d) => (d.contact.email = 'not-an-email'), 'contact.email'],
    ['contact.email with space (A4)', (d) => (d.contact.email = 'a b@c.de'), 'contact.email'],
    ['contact.email > 254 (A4)', (d) => (d.contact.email = 'a'.repeat(250) + '@example.com'), 'contact.email'],
    ['link url with backslash (A4)', (d) => (d.links[0].url = 'https://github.com\\evil'), 'links[0].url'],
    ['relative url with backslash (A4)', (d) => (d.profile.resumeUrl = 'media\\cv.pdf'), 'profile.resumeUrl'],
    ['embed not convertible (A4)', (d) => (d.music.tracks[0].url = 'https://soundcloud.com/'), 'music.tracks[0].url'],
    ['embed youtube without id (A4)', (d) => (d.music.tracks[0].url = 'https://www.youtube.com/channel/abc'), 'music.tracks[0].url'],
    ['nav eyebrow > 40 (A7)', (d) => (d.nav[0].eyebrow = 'e'.repeat(41)), 'nav[0].eyebrow'],
    ['nav intro > 240 (A7)', (d) => (d.nav[0].intro = 'i'.repeat(241)), 'nav[0].intro'],
    ['nav eyebrow not string (A7)', (d) => (d.nav[0].eyebrow = 1), 'nav[0].eyebrow'],
    ['cta hash for a tab not in nav', (d) => { d.nav = d.nav.filter((n) => n.id !== 'contact'); }, 'home.cta[1].href'],
    ['site.title blank', (d) => (d.site.title = '   '), 'site.title'],
    ['link label blank', (d) => (d.links[0].label = '  '), 'links[0].label'],
    ['project link label blank', (d) => (d.projects[0].links[1].label = ' '), 'projects[0].links[1].label'],
    ['highlight value empty', (d) => (d.home.highlights[0].value = ''), 'home.highlights[0].value'],
    ['skills group blank', (d) => (d.about.skills[0].group = ' '), 'about.skills[0].group'],
    ['skills items empty', (d) => (d.about.skills[0].items = []), 'about.skills[0].items'],
    ['timeline title blank', (d) => (d.about.timeline[0].title = ''), 'about.timeline[0].title'],
    ['paragraph blank', (d) => (d.about.paragraphs = ['ok', '  ']), 'about.paragraphs[1]'],
    ['tag blank', (d) => (d.projects[0].tags = ['']), 'projects[0].tags[0]'],
  ];

  for (const [label, fn, expectedPath] of cases) {
    test(label, () => {
      const paths = errorPaths(mutate(fn));
      assert.ok(paths.includes(expectedPath), `expected error at ${expectedPath}, got ${JSON.stringify(paths)}`);
    });
  }

  test('allowed variations produce no errors', () => {
    const data = mutate((d) => {
      d.links[0].url = '';
      delete d.links[0].showInHero;
      d.profile.resumeUrl = 'media/resume.pdf';
      d.profile.avatar = '';
      d.projects[0].image = '';
      d.projects[0].imageAlt = '';
      d.music.tracks[0].url = 'https://youtu.be/dQw4w9WgXcQ';
      d.music.tracks[1].url = 'https://cdn.example.com/song.mp3';
      d.home.cta[0].href = 'https://example.com';
      d.contact.email = '';
      delete d.site.themeDefault;
      delete d.contact.formEnabled;
      // A6 name token and A7 per-tab copy.
      d.site.title = '{name} — Portfolio';
      d.site.description = 'Portfolio of {name}.';
      d.home.headline = "Hi, I'm {name}.";
      d.nav[0].eyebrow = 'e'.repeat(40);
      d.nav[0].intro = 'i'.repeat(240);
      d.nav[1].eyebrow = '';
    });
    assert.deepEqual(validateContent(data).errors, []);
  });

  test('unknown keys are warnings, not errors', () => {
    const data = mutate((d) => {
      d.extra = 1;
      d.site.color = 'red';
      d.projects[0].stars = 5;
    });
    const r = validateContent(data);
    assert.equal(r.valid, true);
    assert.deepEqual(r.warnings.map((w) => w.path).sort(), ['extra', 'projects[0].stars', 'site.color']);
  });

  test('every error has a path and message', () => {
    const r = validateContent({ schemaVersion: 3, site: 5, nav: 'x', projects: [1] });
    assert.equal(r.valid, false);
    for (const e of r.errors) {
      assert.equal(typeof e.path, 'string');
      assert.equal(typeof e.message, 'string');
      assert.ok(e.message.length > 0);
    }
  });
});

describe('URL helpers', () => {
  test('isUrl', () => {
    for (const ok of ['https://a.com', 'http://a.com/x?y', 'mailto:a@b.co', '#projects', 'media/cv.pdf', './x', 'x.html']) {
      assert.equal(isUrl(ok), true, ok);
    }
    for (const bad of ['', 'javascript:alert(1)', 'JavaScript:alert(1)', 'data:x', 'vbscript:x', '//evil.com', 'https://', 'a b', 'ftp://x', 'mailto:', 5]) {
      assert.equal(isUrl(bad), false, String(bad));
    }
  });

  test('isMediaPath', () => {
    for (const ok of ['media/a.svg', 'a-b_c.1.png', 'https://cdn.example.com/a.jpg']) assert.equal(isMediaPath(ok), true, ok);
    for (const bad of ['', '/media/a.svg', '../a.svg', 'media/../a', 'media/a b.png', 'http://x.com/a.png', 'media\\a.png', 'a%20b.png', 'javascript:x']) {
      assert.equal(isMediaPath(bad), false, bad);
    }
  });

  test('isEmbedUrl', () => {
    for (const ok of [
      'https://soundcloud.com/u/t',
      'https://w.soundcloud.com/player/?url=x',
      'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
      'https://open.spotify.com/intl-de/album/4uLU6hMCjMI75M1A2tKUQC',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      'https://bandcamp.com/EmbeddedPlayer/album=1',
      'https://embed.music.apple.com/us/album/x',
    ]) {
      assert.equal(isEmbedUrl(ok), true, ok);
    }
    for (const bad of [
      'http://soundcloud.com/u', 'https://soundcloud.com.evil.com/u', 'https://evil.com/?soundcloud.com', 'media/a.mp3',
      // Allowlisted hosts whose URLs toEmbedUrl cannot convert:
      'https://soundcloud.com/', 'https://w.soundcloud.com/other', 'https://youtube.com/', 'https://youtu.be/x',
      'https://www.youtube.com/watch?v=bad id!', 'https://open.spotify.com/track/', 'https://open.spotify.com/user/abcdefgh',
      'https://bandcamp.com/album/x', 'https://embed.music.apple.com/',
    ]) {
      assert.equal(isEmbedUrl(bad), false, bad);
    }
  });

  test('isAudioSource', () => {
    for (const ok of ['media/music/a.mp3', 'a.OGG', 'b.wav', 'c.m4a', 'd.opus', 'e.flac', 'https://x.com/stream']) {
      assert.equal(isAudioSource(ok), true, ok);
    }
    for (const bad of ['a.mp4', 'media/a', '/a.mp3', '../a.mp3']) assert.equal(isAudioSource(bad), false, bad);
  });
});
