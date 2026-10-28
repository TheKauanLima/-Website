import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeHref, safeMediaSrc, isAllowedEmbedHost, toEmbedUrl, safeAudioSrc, isExternalHref } from '../../public/js/lib/urls.js';

test('safeHref allows http, https, mailto, hashes and relative paths', () => {
  assert.equal(safeHref('https://github.com/me'), 'https://github.com/me');
  assert.equal(safeHref('http://example.com'), 'http://example.com');
  assert.equal(safeHref('mailto:me@example.com'), 'mailto:me@example.com');
  assert.equal(safeHref('#projects'), '#projects');
  assert.equal(safeHref('media/cv.pdf'), 'media/cv.pdf');
  assert.equal(safeHref('  https://trim.me  '), 'https://trim.me');
});

test('safeHref rejects dangerous or malformed values', () => {
  for (const bad of [
    'javascript:alert(1)', 'JavaScript:alert(1)', ' javascript:alert(1)', 'java\nscript:alert(1)',
    'data:text/html,<b>x</b>', 'vbscript:msgbox', 'file:///etc/passwd', '//evil.example.com',
    'https://', 'mailto:', '', '   ', null, undefined, 42, {}, 'a\\b',
  ]) {
    assert.equal(safeHref(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test('safeMediaSrc follows the media path rule', () => {
  assert.equal(safeMediaSrc('media/art/art-1.svg'), 'media/art/art-1.svg');
  assert.equal(safeMediaSrc('https://cdn.example.com/a.png'), 'https://cdn.example.com/a.png');
  for (const bad of [
    '/media/a.svg', '../secret.png', 'media/../x.png', 'media/a b.png', 'http://example.com/a.png',
    'javascript:alert(1)', 'data:image/png;base64,AAAA', 'media/a.png?x=1', '', null, 3,
  ]) {
    assert.equal(safeMediaSrc(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test('safeAudioSrc requires an audio extension for local paths', () => {
  assert.equal(safeAudioSrc('media/music/a.wav'), 'media/music/a.wav');
  assert.equal(safeAudioSrc('media/music/a.MP3'), 'media/music/a.MP3');
  assert.equal(safeAudioSrc('https://cdn.example.com/stream'), 'https://cdn.example.com/stream');
  assert.equal(safeAudioSrc('media/music/a.txt'), null);
  assert.equal(safeAudioSrc('../a.mp3'), null);
});

test('isAllowedEmbedHost checks https + allowlist', () => {
  assert.equal(isAllowedEmbedHost('https://soundcloud.com/a/b'), true);
  assert.equal(isAllowedEmbedHost('https://youtu.be/abc'), true);
  assert.equal(isAllowedEmbedHost('https://embed.music.apple.com/us/album/x'), true);
  assert.equal(isAllowedEmbedHost('http://soundcloud.com/a/b'), false);
  assert.equal(isAllowedEmbedHost('https://evil.com/soundcloud.com'), false);
  assert.equal(isAllowedEmbedHost('https://soundcloud.com.evil.com/a'), false);
  assert.equal(isAllowedEmbedHost('https://m.youtube.com/watch?v=abc'), false);
  assert.equal(isAllowedEmbedHost('not a url'), false);
  assert.equal(isAllowedEmbedHost(null), false);
});

test('toEmbedUrl converts YouTube links to youtube-nocookie', () => {
  const expected = { src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', provider: 'youtube' };
  assert.deepEqual(toEmbedUrl('https://youtu.be/dQw4w9WgXcQ'), expected);
  assert.deepEqual(toEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10'), expected);
  assert.deepEqual(toEmbedUrl('https://youtube.com/watch?v=dQw4w9WgXcQ'), expected);
  assert.deepEqual(toEmbedUrl('https://www.youtube.com/embed/dQw4w9WgXcQ'), expected);
  assert.deepEqual(toEmbedUrl('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'), expected);
  assert.equal(toEmbedUrl('https://www.youtube.com/watch?v=<script>'), null);
  assert.equal(toEmbedUrl('https://www.youtube.com/channel/abc'), null);
});

test('toEmbedUrl converts Spotify links', () => {
  assert.deepEqual(toEmbedUrl('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=x'),
    { src: 'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC', provider: 'spotify' });
  assert.deepEqual(toEmbedUrl('https://open.spotify.com/intl-de/album/1DFixLWuPkv3KT3TnV35m3'),
    { src: 'https://open.spotify.com/embed/album/1DFixLWuPkv3KT3TnV35m3', provider: 'spotify' });
  assert.deepEqual(toEmbedUrl('https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M'),
    { src: 'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M', provider: 'spotify' });
  assert.equal(toEmbedUrl('https://open.spotify.com/user/someone'), null);
});

test('toEmbedUrl wraps soundcloud.com in the widget player', () => {
  const url = 'https://soundcloud.com/YOUR-USERNAME/YOUR-TRACK';
  assert.deepEqual(toEmbedUrl(url), {
    src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff4d8d&visual=true`,
    provider: 'soundcloud',
  });
  const widget = 'https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F1';
  assert.deepEqual(toEmbedUrl(widget), { src: widget, provider: 'soundcloud' });
  assert.equal(toEmbedUrl('https://soundcloud.com/'), null);
});

test('toEmbedUrl passes Bandcamp and Apple Music embeds through', () => {
  const bc = 'https://bandcamp.com/EmbeddedPlayer/album=123/size=large/';
  assert.deepEqual(toEmbedUrl(bc), { src: bc, provider: 'bandcamp' });
  assert.equal(toEmbedUrl('https://bandcamp.com/discover'), null);
  const am = 'https://embed.music.apple.com/us/album/x/123';
  assert.deepEqual(toEmbedUrl(am), { src: am, provider: 'apple' });
});

test('toEmbedUrl rejects anything else', () => {
  for (const bad of ['https://vimeo.com/123', 'http://youtu.be/dQw4w9WgXcQ', 'javascript:alert(1)', '', null, 'youtu.be/dQw4w9WgXcQ']) {
    assert.equal(toEmbedUrl(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test('isExternalHref detects absolute http(s) links', () => {
  assert.equal(isExternalHref('https://x.com'), true);
  assert.equal(isExternalHref('#home'), false);
  assert.equal(isExternalHref('mailto:a@b.c'), false);
});
