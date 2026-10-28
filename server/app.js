import path from 'node:path';
import { applySecurityHeaders, canRespond, sendError, sendText } from './lib/http.js';
import { createRateLimiter } from './lib/rate-limit.js';
import { createMessageStore } from './lib/message-store.js';
import { createStaticHandler } from './lib/static.js';
import { createHealthHandler } from './routes/health.js';
import { createContentHandler } from './routes/content.js';
import { createContactHandler } from './routes/contact.js';

export const MAX_URL_LENGTH = 2048;

function isApiPath(pathname) {
  return pathname === '/api' || pathname.startsWith('/api/');
}

/**
 * Build the request handler.
 * The returned function also exposes close() (stops the rate limiter's sweep timer).
 */
export function createApp({
  publicDir,
  contentFile,
  messagesFile,
  messagesMaxBytes = 5242880,
  rateLimit = { max: 5, windowMs: 600000 },
  trustProxy = false,
  now = Date.now,
  logger = console,
} = {}) {
  if (!publicDir || !contentFile || !messagesFile) {
    throw new Error('createApp requires publicDir, contentFile and messagesFile');
  }

  const limiter = createRateLimiter({ max: rateLimit.max, windowMs: rateLimit.windowMs, now });
  const store = createMessageStore(path.resolve(messagesFile), { maxBytes: messagesMaxBytes });
  const serveStatic = createStaticHandler({ publicDir: path.resolve(publicDir), logger });

  const api = new Map([
    ['/api/health', { methods: ['GET', 'HEAD'], handler: createHealthHandler({ now }) }],
    ['/api/content', { methods: ['GET', 'HEAD'], handler: createContentHandler({ contentFile: path.resolve(contentFile), logger }) }],
    ['/api/contact', {
      methods: ['POST'],
      noStore: true,
      handler: createContactHandler({ limiter, store, trustProxy, now }),
    }],
  ]);

  function logRequest(req, res, pathname, started) {
    if (!logger) return;
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const status = res.writableFinished ? res.statusCode : `${res.statusCode}(aborted)`;
    logger.log?.(`${req.method} ${pathname} ${status} ${ms.toFixed(1)}ms`);
  }

  async function dispatch(req, res, state) {
    const rawUrl = req.url ?? '/';
    const apiRequest = isApiPath(rawUrl.split('?')[0]);

    if (rawUrl.length > MAX_URL_LENGTH) {
      state.pathname = rawUrl.slice(0, 80) + '…';
      if (apiRequest) return sendError(req, res, 414, 'URI_TOO_LONG', 'Request URL is too long.');
      return sendText(req, res, 414, '414 URI Too Long\n');
    }

    let url;
    try {
      url = new URL(rawUrl, 'http://x');
    } catch {
      if (apiRequest) return sendError(req, res, 400, 'BAD_REQUEST', 'Malformed request URL.');
      return sendText(req, res, 400, '400 Bad Request\n');
    }
    state.pathname = url.pathname;

    if (!isApiPath(url.pathname)) return serveStatic(req, res, url);

    const route = api.get(url.pathname);
    if (!route) return sendError(req, res, 404, 'NOT_FOUND', 'API endpoint not found.');
    if (!route.methods.includes(req.method)) {
      const headers = { Allow: route.methods.join(', ') };
      if (route.noStore) headers['Cache-Control'] = 'no-store';
      return sendError(req, res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.', { headers });
    }
    return route.handler(req, res, url);
  }

  async function handler(req, res) {
    const started = process.hrtime.bigint();
    const state = { pathname: (req.url ?? '/').split('?')[0].slice(0, 200) };

    applySecurityHeaders(res);
    // Client aborts must never crash the process.
    req.on('error', () => {});
    res.on('error', () => {});
    let logged = false;
    const done = () => {
      if (logged) return;
      logged = true;
      logRequest(req, res, state.pathname, started);
    };
    res.once('finish', done);
    res.once('close', done);

    try {
      await dispatch(req, res, state);
    } catch (err) {
      logger?.error?.(`Unhandled error for ${req.method} ${state.pathname}: ${err?.stack ?? err}`);
      if (canRespond(res)) {
        // Headers set by the failed handler (ETag, Content-Type, ...) must not leak into the 500.
        for (const name of res.getHeaderNames()) res.removeHeader(name);
        applySecurityHeaders(res);
        if (isApiPath(state.pathname)) {
          sendError(req, res, 500, 'INTERNAL_ERROR', 'Something went wrong.', {
            headers: { 'Cache-Control': 'no-store' },
          });
        } else {
          sendText(req, res, 500, '500 Internal Server Error\n', { 'Cache-Control': 'no-store' });
        }
      } else if (!res.writableEnded) {
        res.destroy();
      }
    }
  }

  handler.close = () => limiter.stop();
  return handler;
}
