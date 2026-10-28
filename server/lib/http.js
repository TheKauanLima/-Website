import { isIP } from 'node:net';

export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: https:",
  "media-src 'self' https:",
  "font-src 'self'",
  "connect-src 'self'",
  'frame-src https://w.soundcloud.com https://open.spotify.com https://www.youtube-nocookie.com https://www.youtube.com https://bandcamp.com https://embed.music.apple.com',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' mailto:",
  "frame-ancestors 'none'",
].join('; ');

export const SECURITY_HEADERS = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Content-Security-Policy': CSP,
});

export const JSON_TYPE = 'application/json; charset=utf-8';

/** Set the §5.3 security headers. Called first for every response. */
export function applySecurityHeaders(res) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
}

/** True when a response can still be written to. */
export function canRespond(res) {
  return !res.headersSent && !res.writableEnded && !res.destroyed;
}

/**
 * Send a complete response. HEAD, 204 and 304 get headers only.
 * Returns false (and does nothing) if the response was already started.
 */
export function sendBody(req, res, status, headers, body) {
  if (!canRespond(res)) return false;
  const buf = body == null ? null : Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8');
  for (const [name, value] of Object.entries(headers ?? {})) {
    if (value !== undefined && value !== null) res.setHeader(name, value);
  }
  res.statusCode = status;
  const noBody = status === 204 || status === 304;
  if (buf && !noBody) res.setHeader('Content-Length', buf.length);
  if (req.method === 'HEAD' || noBody || !buf) res.end();
  else res.end(buf);
  return true;
}

export function sendJson(req, res, status, data, headers = {}) {
  return sendBody(req, res, status, { 'Content-Type': JSON_TYPE, ...headers }, JSON.stringify(data));
}

/** Send the §3 error shape. `details` is only included for VALIDATION_FAILED. */
export function sendError(req, res, status, code, message, { details, headers } = {}) {
  const error = { code, message };
  if (code === 'VALIDATION_FAILED' && details) error.details = details;
  return sendJson(req, res, status, { error }, headers);
}

export function sendText(req, res, status, text, headers = {}) {
  return sendBody(req, res, status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers }, text);
}

export function sendHtml(req, res, status, html, headers = {}) {
  return sendBody(req, res, status, { 'Content-Type': 'text/html; charset=utf-8', ...headers }, html);
}

/**
 * Read the request body up to `limit` bytes.
 * Rejects with err.code = 'PAYLOAD_TOO_LARGE' once the running total exceeds the limit
 * (remaining bytes are discarded), or 'ABORTED' if the client goes away first.
 */
export function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let settled = false;

    const cleanup = () => {
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('error', onError);
      req.off('close', onClose);
    };
    const fail = (code, message) => {
      if (settled) return;
      settled = true;
      cleanup();
      const err = new Error(message);
      err.code = code;
      reject(err);
    };
    function onData(chunk) {
      total += chunk.length;
      if (total > limit) {
        chunks.length = 0;
        fail('PAYLOAD_TOO_LARGE', 'Request body exceeds limit');
        return;
      }
      chunks.push(chunk);
    }
    function onEnd() {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(Buffer.concat(chunks, total));
    }
    function onError() {
      fail('ABORTED', 'Request aborted');
    }
    function onClose() {
      if (!req.complete) fail('ABORTED', 'Request aborted');
    }

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
    req.on('close', onClose);
  });
}

/**
 * Client IP. By default the socket address. With trustProxy, the RIGHTMOST X-Forwarded-For
 * entry (the one appended by the trusted proxy; entries to its left are client-controlled),
 * used only if it is a valid IP address; otherwise the socket address.
 */
export function getClientIp(req, trustProxy = false) {
  const socketIp = req.socket?.remoteAddress || 'unknown';
  if (!trustProxy) return socketIp;
  const raw = req.headers['x-forwarded-for'];
  const joined = Array.isArray(raw) ? raw.join(',') : raw ?? '';
  const rightmost = joined.split(',').map((s) => s.trim()).filter(Boolean).at(-1) ?? '';
  return isIP(rightmost) ? rightmost : socketIp;
}
