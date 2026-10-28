import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream';
import { contentTypeFor, extensionOf } from './mime.js';
import { canRespond, sendHtml, sendText } from './http.js';

const NO_CACHE_EXT = new Set(['html', 'css', 'js', 'mjs', 'json']);
const LONG_CACHE = 'public, max-age=604800';

const NOT_FOUND_HTML =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>404 Not Found</title></head>' +
  '<body><h1>404 Not Found</h1><p><a href="./">Go to the home page</a></p></body></html>\n';

export function cacheControlFor(filePath) {
  return NO_CACHE_EXT.has(extensionOf(filePath)) ? 'no-cache' : LONG_CACHE;
}

export function weakEtag(stat) {
  return `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
}

/** If-None-Match comparison (weak), supports lists and "*". */
export function etagMatches(header, etag) {
  if (!header) return false;
  if (header.trim() === '*') return true;
  const opaque = (tag) => tag.trim().replace(/^W\//, '');
  const target = opaque(etag);
  return header.split(',').some((tag) => opaque(tag) === target);
}

/**
 * Parse a Range header against a file size.
 * Returns null (ignore: not a bytes range), 'unsatisfiable', or {start, end} (inclusive).
 */
export function parseRange(header, size) {
  if (typeof header !== 'string') return null;
  const trimmed = header.trim();
  if (!/^bytes=/i.test(trimmed)) return null;
  const spec = trimmed.slice(6).trim();
  if (spec.includes(',')) return 'unsatisfiable';
  const m = /^(\d*)\s*-\s*(\d*)$/.exec(spec);
  if (!m || (m[1] === '' && m[2] === '')) return 'unsatisfiable';
  if (size === 0) return 'unsatisfiable';

  let start;
  let end;
  if (m[1] === '') {
    const suffix = Number(m[2]);
    if (suffix === 0) return 'unsatisfiable';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Number(m[2]);
    if (end < start) return 'unsatisfiable';
    end = Math.min(end, size - 1);
  }
  if (start >= size) return 'unsatisfiable';
  return { start, end };
}

function isInside(root, target) {
  return target === root || target.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
}

function hasHiddenSegment(relative) {
  return relative.split(/[\\/]+/).some((seg) => seg.startsWith('.'));
}

/**
 * Secure static file handler for `publicDir` (§3.4, §5.1).
 * Returns async (req, res, url) where url is the parsed WHATWG URL.
 */
export function createStaticHandler({ publicDir, logger = console } = {}) {
  const root = path.resolve(publicDir);
  let realRootPromise = null;

  function getRealRoot() {
    if (!realRootPromise) {
      realRootPromise = fs.realpath(root);
      // Retry on the next request if the folder appears later.
      realRootPromise.catch(() => {
        realRootPromise = null;
      });
    }
    return realRootPromise;
  }

  const notFound = (req, res) => sendHtml(req, res, 404, NOT_FOUND_HTML, { 'Cache-Control': 'no-cache' });

  /** Resolve a path to its real location, or null if it escapes the root or is hidden. */
  async function safeRealpath(realRoot, target) {
    let real;
    try {
      real = await fs.realpath(target);
    } catch {
      return null;
    }
    if (!isInside(realRoot, real)) return null;
    // Re-check dot segments on the canonical path (defeats e.g. Windows 8.3 short names).
    if (hasHiddenSegment(path.relative(realRoot, real))) return null;
    return real;
  }

  async function sendFile(req, res, filePath) {
    let handle;
    try {
      handle = await fs.open(filePath, 'r');
    } catch {
      return notFound(req, res);
    }
    let closeHandle = true;
    try {
      const stat = await handle.stat();
      if (!stat.isFile()) return notFound(req, res);
      if (!canRespond(res)) return;

      const size = stat.size;
      const etag = weakEtag(stat);
      res.setHeader('Content-Type', contentTypeFor(filePath));
      res.setHeader('ETag', etag);
      res.setHeader('Last-Modified', stat.mtime.toUTCString());
      res.setHeader('Cache-Control', cacheControlFor(filePath));
      res.setHeader('Accept-Ranges', 'bytes');

      if (etagMatches(req.headers['if-none-match'], etag)) {
        res.statusCode = 304;
        res.end();
        return;
      }

      let start = 0;
      let end = size - 1;
      let status = 200;
      const range = parseRange(req.headers.range, size);
      if (range === 'unsatisfiable') {
        return sendText(req, res, 416, '416 Range Not Satisfiable\n', { 'Content-Range': `bytes */${size}` });
      }
      if (range) {
        ({ start, end } = range);
        status = 206;
        res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      }

      const length = size === 0 ? 0 : end - start + 1;
      res.statusCode = status;
      res.setHeader('Content-Length', length);
      if (req.method === 'HEAD' || length === 0) {
        res.end();
        return;
      }

      const stream = handle.createReadStream({ start, end, autoClose: true });
      closeHandle = false;
      await new Promise((resolve) => {
        pipeline(stream, res, (err) => {
          if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
            logger?.error?.(`static stream error: ${err.message}`);
          }
          resolve();
        });
      });
    } finally {
      if (closeHandle) await handle.close().catch(() => {});
    }
  }

  return async function serveStatic(req, res, url) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendText(req, res, 405, '405 Method Not Allowed\n', { Allow: 'GET, HEAD' });
    }

    let decoded;
    try {
      decoded = decodeURIComponent(url.pathname);
    } catch {
      return sendText(req, res, 400, '400 Bad Request\n');
    }

    // Reject NUL, backslashes, colons (drive letters, NTFS streams) and any dot segment.
    if (/[\0\\:]/.test(decoded) || decoded.split('/').some((seg) => seg.startsWith('.'))) {
      return notFound(req, res);
    }

    const resolved = path.resolve(root, '.' + decoded);
    if (!isInside(root, resolved)) return notFound(req, res);

    let realRoot;
    try {
      realRoot = await getRealRoot();
    } catch (err) {
      logger?.error?.(`public directory unavailable: ${err.message}`);
      return sendText(req, res, 500, '500 Internal Server Error\n');
    }

    const real = await safeRealpath(realRoot, resolved);
    if (!real) return notFound(req, res);

    let stat;
    try {
      stat = await fs.stat(real);
    } catch {
      return notFound(req, res);
    }

    if (stat.isDirectory()) {
      if (!url.pathname.endsWith('/')) {
        // Collapse leading slashes so the Location can never be protocol-relative.
        const location = (url.pathname + '/').replace(/^\/{2,}/, '/') + url.search;
        return sendText(req, res, 301, `Moved Permanently: ${location}\n`, { Location: location });
      }
      const index = await safeRealpath(realRoot, path.join(real, 'index.html'));
      if (!index) return notFound(req, res);
      return sendFile(req, res, index);
    }

    if (!stat.isFile() || url.pathname.endsWith('/')) return notFound(req, res);
    return sendFile(req, res, real);
  };
}
