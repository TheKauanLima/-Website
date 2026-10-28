import crypto from 'node:crypto';
import { getClientIp, readBody, sendError, sendJson } from '../lib/http.js';
import { isPlainObject } from '../lib/util.js';
import { isHoneypotFilled, validateContact } from '../lib/validate-contact.js';

export const BODY_LIMIT = 32768;
const DRAIN_GRACE_MS = 1000;

/**
 * Get rid of the rest of an oversized upload after the 413 has been sent.
 * Leftover bytes are discarded for a short grace period (closing a socket with unread
 * data sends a TCP reset, which can make the client lose the 413), then the request is destroyed.
 */
function destroyAfterResponse(req, res) {
  const kill = () => {
    if (req.complete || req.destroyed) return;
    const timer = setTimeout(() => req.destroy(), DRAIN_GRACE_MS);
    timer.unref?.();
    req.once('end', () => clearTimeout(timer));
    req.once('close', () => clearTimeout(timer));
    req.resume();
  };
  if (res.writableFinished) kill();
  else res.once('finish', kill);
}

/** POST /api/contact pipeline (§3.3 steps 2–10; step 1 is handled by the router). */
export function createContactHandler({ limiter, store, trustProxy = false, now = Date.now }) {
  return async function contact(req, res) {
    const headers = { 'Cache-Control': 'no-store' };
    res.setHeader('Cache-Control', 'no-store');
    const fail = (status, code, message, extra = {}) =>
      sendError(req, res, status, code, message, { ...extra, headers: { ...headers, ...extra.headers } });

    // 2. Origin check.
    const origin = req.headers.origin;
    if (origin !== undefined) {
      let originHost = null;
      try {
        originHost = new URL(origin).host.toLowerCase();
      } catch {
        originHost = null;
      }
      const host = (req.headers.host ?? '').toLowerCase();
      if (!originHost || originHost !== host) {
        return fail(403, 'FORBIDDEN_ORIGIN', 'Cross-origin requests are not allowed.');
      }
    }

    // 3. Rate limit.
    const ip = getClientIp(req, trustProxy);
    const verdict = limiter.hit(ip);
    if (!verdict.allowed) {
      return fail(429, 'RATE_LIMITED', 'Too many messages. Please try again later.', {
        headers: { 'Retry-After': String(verdict.retryAfter) },
      });
    }

    // 4. Content type.
    const contentType = String(req.headers['content-type'] ?? '').toLowerCase();
    if (!contentType.startsWith('application/json')) {
      return fail(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.');
    }

    // 5. Size limit (declared length first, then streamed bytes).
    const declared = req.headers['content-length'];
    if (declared !== undefined && Number(declared) > BODY_LIMIT) {
      fail(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');
      destroyAfterResponse(req, res);
      return;
    }
    let raw;
    try {
      raw = await readBody(req, BODY_LIMIT);
    } catch (err) {
      if (err.code === 'PAYLOAD_TOO_LARGE') {
        fail(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');
        destroyAfterResponse(req, res);
        return;
      }
      // Client went away mid-upload: nothing to answer.
      if (!res.destroyed) res.destroy();
      return;
    }

    // 6. JSON parse.
    let body;
    try {
      body = JSON.parse(raw.toString('utf8'));
    } catch {
      return fail(400, 'INVALID_JSON', 'Request body is not valid JSON.');
    }
    if (!isPlainObject(body)) {
      return fail(400, 'INVALID_JSON', 'Request body must be a JSON object.');
    }

    // 7. Validation.
    const result = validateContact(body);
    if (!result.ok) {
      return fail(422, 'VALIDATION_FAILED', 'Please correct the highlighted fields.', { details: result.details });
    }

    const id = crypto.randomUUID();
    const receivedAt = new Date(now()).toISOString();

    // 8. Honeypot: pretend success, store nothing.
    if (isHoneypotFilled(body)) {
      return sendJson(req, res, 201, { ok: true, id, receivedAt }, headers);
    }

    // 9. Store.
    const userAgent = String(req.headers['user-agent'] ?? '').slice(0, 200);
    try {
      await store.append({
        id,
        receivedAt,
        name: result.value.name,
        email: result.value.email,
        message: result.value.message,
        ip,
        userAgent,
      });
    } catch (err) {
      if (err.code === 'STORAGE_FULL') {
        return fail(503, 'STORAGE_UNAVAILABLE', 'Message storage is full. Please try again later.');
      }
      throw err; // app.js turns this into a generic 500 INTERNAL_ERROR
    }

    // 10. Success.
    sendJson(req, res, 201, { ok: true, id, receivedAt }, headers);
  };
}
