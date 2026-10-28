import fs from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../../server/app.js';

export const FIXTURES = fileURLToPath(new URL('../fixtures/', import.meta.url));
export const FIXTURE_PUBLIC = path.join(FIXTURES, 'public');
export const FIXTURE_CONTENT = path.join(FIXTURES, 'content.valid.json');
export const FIXTURE_BROKEN = path.join(FIXTURES, 'content.broken.json');

export const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'content-security-policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; media-src 'self' https:; " +
    "font-src 'self'; connect-src 'self'; frame-src https://w.soundcloud.com https://open.spotify.com " +
    'https://www.youtube-nocookie.com https://www.youtube.com https://bandcamp.com https://embed.music.apple.com; ' +
    "object-src 'none'; base-uri 'self'; form-action 'self' mailto:; frame-ancestors 'none'",
};

export async function makeTempDir(prefix = 'portfolio-test-') {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

/**
 * Start the app on an ephemeral port with fixture defaults and a temp messages file.
 * Any createApp option can be overridden. Returns { baseUrl, port, close, app, tmpDir, messagesFile, logs }.
 */
export async function startTestServer(opts = {}) {
  const tmpDir = await makeTempDir();
  const logs = { log: [], warn: [], error: [] };
  const logger = opts.captureLogs
    ? {
        log: (m) => logs.log.push(String(m)),
        warn: (m) => logs.warn.push(String(m)),
        error: (m) => logs.error.push(String(m)),
      }
    : null;

  const { captureLogs, ...appOpts } = opts;
  const messagesFile = appOpts.messagesFile ?? path.join(tmpDir, 'data', 'messages.ndjson');
  const app = createApp({
    publicDir: FIXTURE_PUBLIC,
    contentFile: FIXTURE_CONTENT,
    rateLimit: { max: 5, windowMs: 600000 },
    logger,
    ...appOpts,
    messagesFile,
  });

  const server = http.createServer(app);
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();

  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    app.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(() => resolve()));
    await fs.rm(tmpDir, { recursive: true, force: true, maxRetries: 3 });
  }

  return { baseUrl: `http://127.0.0.1:${port}`, port, close, app, server, tmpDir, messagesFile, logs };
}

/**
 * Send a request with an exact, un-normalized path over a fresh connection.
 * Resolves { status, headers, body (Buffer), text }.
 */
export function rawRequest(port, method, rawPath, headers = {}, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, method, path: rawPath, headers, agent: false },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          resolve({ status: res.statusCode, headers: res.headers, body: buf, text: buf.toString('utf8') });
        });
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

/**
 * Write raw bytes to the server over TCP and collect the whole response text
 * (for request lines that http.request refuses to send).
 */
export function rawSocket(port, data, { timeoutMs = 3000 } = {}) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1');
    const chunks = [];
    socket.setTimeout(timeoutMs, () => socket.destroy());
    socket.on('data', (c) => chunks.push(c));
    socket.on('error', (err) => (chunks.length ? resolve(Buffer.concat(chunks).toString('latin1')) : reject(err)));
    socket.on('close', () => resolve(Buffer.concat(chunks).toString('latin1')));
    socket.write(data);
  });
}

/** Assert-style helper used by several suites. */
export function missingSecurityHeaders(headers) {
  const problems = [];
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (headers[name] !== value) problems.push(`${name}=${headers[name]}`);
  }
  if ('x-powered-by' in headers) problems.push('x-powered-by present');
  if ('server' in headers) problems.push('server present');
  return problems;
}

/** True if a body looks like it contains a stack trace or a filesystem path. */
export function looksLikeStackTrace(text) {
  return /\bat .+\(.+:\d+:\d+\)/.test(text) || /\n\s+at /.test(text) || /[A-Za-z]:\\|node:internal|file:\/\//.test(text);
}
