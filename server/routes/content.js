import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { JSON_TYPE, sendBody, sendError } from '../lib/http.js';
import { etagMatches } from '../lib/static.js';
import { validateContent } from '../lib/content-schema.js';

const MAX_WARNED = 100;

/** GET|HEAD /api/content. Reads the file on every request. */
export function createContentHandler({ contentFile, logger = console }) {
  const warnedEtags = new Set();

  function warnOnce(etag, data) {
    if (warnedEtags.has(etag)) return;
    if (warnedEtags.size >= MAX_WARNED) warnedEtags.clear();
    warnedEtags.add(etag);
    const { errors } = validateContent(data);
    if (errors.length > 0) {
      const lines = errors.map((e) => `  - ${e.path || '(root)'}: ${e.message}`).join('\n');
      logger?.warn?.(`content.json has ${errors.length} schema error(s):\n${lines}`);
    }
  }

  return async function content(req, res) {
    let bytes;
    let data;
    try {
      bytes = await fs.readFile(contentFile);
      let text = bytes.toString('utf8');
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // tolerate a UTF-8 BOM
      data = JSON.parse(text);
    } catch (err) {
      logger?.error?.(`content unavailable: ${err.message}`);
      return sendError(req, res, 500, 'CONTENT_UNAVAILABLE', 'Site content is unavailable.', {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const etag = `"${crypto.createHash('sha1').update(bytes).digest('base64url')}"`;
    const headers = { 'Cache-Control': 'no-cache', ETag: etag };

    try {
      warnOnce(etag, data);
    } catch (err) {
      logger?.error?.(`content validation failed: ${err.message}`);
    }

    if (etagMatches(req.headers['if-none-match'], etag)) {
      return sendBody(req, res, 304, headers, null);
    }
    return sendBody(req, res, 200, { 'Content-Type': JSON_TYPE, ...headers }, JSON.stringify(data));
  };
}
