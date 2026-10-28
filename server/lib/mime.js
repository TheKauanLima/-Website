import path from 'node:path';

const TYPES = Object.freeze({
  html: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  json: 'application/json',
  webmanifest: 'application/manifest+json',
  txt: 'text/plain',
  xml: 'application/xml',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
  mp4: 'video/mp4',
  webm: 'video/webm',
  woff2: 'font/woff2',
  woff: 'font/woff',
  pdf: 'application/pdf',
});

/** Types that get "; charset=utf-8" appended. */
const TEXT_TYPES = new Set([
  'text/html',
  'text/css',
  'text/javascript',
  'text/plain',
  'application/json',
  'application/manifest+json',
  'application/xml',
  'image/svg+xml',
]);

export const DEFAULT_TYPE = 'application/octet-stream';

/** Lower-case extension without the dot ("" if none). */
export function extensionOf(filePath) {
  return path.extname(filePath).slice(1).toLowerCase();
}

/** Content-Type header value for a file path. */
export function contentTypeFor(filePath) {
  const type = TYPES[extensionOf(filePath)] ?? DEFAULT_TYPE;
  return TEXT_TYPES.has(type) ? `${type}; charset=utf-8` : type;
}
