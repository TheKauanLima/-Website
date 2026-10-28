import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import {
  looksLikeStackTrace,
  missingSecurityHeaders,
  rawRequest,
  startTestServer,
} from '../helpers/server.js';

const VALID = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  message: "Hello, I'd like to talk about a role.",
  website: '',
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function post(port, body, headers = {}) {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  return rawRequest(port, 'POST', '/api/contact', { 'Content-Type': 'application/json', ...headers }, payload);
}

async function readLines(file) {
  try {
    const text = await fs.readFile(file, 'utf8');
    return text.split('\n').filter(Boolean);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function errorOf(res) {
  return JSON.parse(res.text).error;
}

function assertApiError(res, status, code) {
  assert.equal(res.status, status, res.text);
  assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
  assert.equal(res.headers['cache-control'], 'no-store');
  const err = errorOf(res);
  assert.equal(err.code, code);
  assert.equal(typeof err.message, 'string');
  if (code !== 'VALIDATION_FAILED') assert.equal('details' in err, false);
  assert.ok(!looksLikeStackTrace(res.text));
  assert.deepEqual(missingSecurityHeaders(res.headers), []);
  return err;
}

describe('POST /api/contact: success, storage, sanitizing', () => {
  let srv;
  before(async () => {
    srv = await startTestServer({ rateLimit: { max: 1000, windowMs: 600000 } });
  });
  after(() => srv.close());

  test('valid body returns 201 and appends one NDJSON line', async () => {
    const res = await post(srv.port, VALID, { 'User-Agent': 'TestAgent/' + 'x'.repeat(300) });
    assert.equal(res.status, 201);
    assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.deepEqual(missingSecurityHeaders(res.headers), []);
    const body = JSON.parse(res.text);
    assert.deepEqual(Object.keys(body).sort(), ['id', 'ok', 'receivedAt']);
    assert.equal(body.ok, true);
    assert.match(body.id, UUID_RE);
    assert.equal(new Date(body.receivedAt).toISOString(), body.receivedAt);

    const lines = await readLines(srv.messagesFile);
    assert.equal(lines.length, 1);
    const rec = JSON.parse(lines[0]);
    assert.deepEqual(Object.keys(rec), ['id', 'receivedAt', 'name', 'email', 'message', 'ip', 'userAgent']);
    assert.equal(rec.id, body.id);
    assert.equal(rec.receivedAt, body.receivedAt);
    assert.equal(rec.name, VALID.name);
    assert.equal(rec.email, VALID.email);
    assert.equal(rec.message, VALID.message);
    assert.match(rec.ip, /127\.0\.0\.1/);
    assert.equal(rec.userAgent.length, 200);
    assert.ok(rec.userAgent.startsWith('TestAgent/'));
  });

  test('messages directory is created on demand', async () => {
    assert.ok(srv.messagesFile.startsWith(srv.tmpDir));
    const stat = await fs.stat(path.dirname(srv.messagesFile));
    assert.ok(stat.isDirectory());
  });

  test('control characters are stripped, CRLF normalized, fields trimmed', async () => {
    const res = await post(srv.port, {
      name: '  Ada\u0000\u0007 Lovelace\u007F\t ',
      email: ' ada\u0001@example.com\n',
      message: '  Line one\r\nLine two\u0000\u000B\u001B\tend  ',
    });
    assert.equal(res.status, 201, res.text);
    const rec = JSON.parse((await readLines(srv.messagesFile)).at(-1));
    assert.equal(rec.name, 'Ada Lovelace');
    assert.equal(rec.email, 'ada@example.com');
    assert.equal(rec.message, 'Line one\nLine two\tend');
  });

  test('unknown fields are ignored and never stored', async () => {
    const res = await post(srv.port, { ...VALID, admin: true, extra: 'EXTRA-FIELD' });
    assert.equal(res.status, 201);
    const last = (await readLines(srv.messagesFile)).at(-1);
    assert.ok(!last.includes('EXTRA-FIELD'));
    assert.equal('admin' in JSON.parse(last), false);
  });

  test('newlines in fields cannot inject extra NDJSON lines', async () => {
    const before = (await readLines(srv.messagesFile)).length;
    const res = await post(srv.port, { ...VALID, message: 'Hello there\n{"id":"injected"}\n' });
    assert.equal(res.status, 201);
    const lines = await readLines(srv.messagesFile);
    assert.equal(lines.length, before + 1);
    for (const line of lines) JSON.parse(line);
  });

  test('concurrent submissions are all stored as whole lines', async () => {
    const before = (await readLines(srv.messagesFile)).length;
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => post(srv.port, { ...VALID, name: `Sender ${i}` })),
    );
    assert.ok(results.every((r) => r.status === 201));
    const lines = await readLines(srv.messagesFile);
    assert.equal(lines.length, before + 20);
    const names = lines.slice(before).map((l) => JSON.parse(l).name).sort();
    assert.deepEqual(names, Array.from({ length: 20 }, (_, i) => `Sender ${i}`).sort());
  });

  test('filled honeypot returns 201 with a random id but stores nothing', async () => {
    const before = (await readLines(srv.messagesFile)).length;
    const res = await post(srv.port, { ...VALID, website: 'http://spam.example' });
    assert.equal(res.status, 201);
    const body = JSON.parse(res.text);
    assert.equal(body.ok, true);
    assert.match(body.id, UUID_RE);
    assert.ok(body.receivedAt);
    assert.equal((await readLines(srv.messagesFile)).length, before);
  });

  test('honeypot does not bypass validation', async () => {
    const res = await post(srv.port, { website: 'bot' });
    assertApiError(res, 422, 'VALIDATION_FAILED');
  });

  test('Content-Type with charset is accepted', async () => {
    const res = await post(srv.port, VALID, { 'Content-Type': 'application/json; charset=utf-8' });
    assert.equal(res.status, 201);
  });

  test('matching Origin is allowed, missing Origin is allowed', async () => {
    const ok = await post(srv.port, VALID, { Origin: `http://127.0.0.1:${srv.port}` });
    assert.equal(ok.status, 201);
    const none = await post(srv.port, VALID);
    assert.equal(none.status, 201);
  });
});

describe('POST /api/contact: error responses', () => {
  let srv;
  before(async () => {
    srv = await startTestServer({ rateLimit: { max: 1000, windowMs: 600000 } });
  });
  after(() => srv.close());

  test('foreign Origin returns 403 FORBIDDEN_ORIGIN', async () => {
    for (const origin of ['http://evil.example', `http://127.0.0.1:${srv.port + 1}`, `https://127.0.0.1:${srv.port}.evil.example`, 'null', 'garbage']) {
      const res = await post(srv.port, VALID, { Origin: origin });
      assertApiError(res, 403, 'FORBIDDEN_ORIGIN');
    }
    assert.equal((await readLines(srv.messagesFile)).length, 0);
  });

  test('non-JSON content type returns 415', async () => {
    const cases = [
      { 'Content-Type': 'text/plain' },
      { 'Content-Type': 'application/x-www-form-urlencoded' },
      { 'Content-Type': 'multipart/form-data; boundary=x' },
    ];
    for (const headers of cases) {
      assertApiError(await post(srv.port, 'name=a', headers), 415, 'UNSUPPORTED_MEDIA_TYPE');
    }
    const none = await rawRequest(srv.port, 'POST', '/api/contact', {}, JSON.stringify(VALID));
    assertApiError(none, 415, 'UNSUPPORTED_MEDIA_TYPE');
  });

  test('malformed JSON returns 400 INVALID_JSON', async () => {
    for (const body of ['{"name":', 'not json', '', "{'a':1}"]) {
      assertApiError(await post(srv.port, body), 400, 'INVALID_JSON');
    }
  });

  test('JSON that is not a plain object returns 400 INVALID_JSON', async () => {
    for (const body of ['[]', '[{"name":"a"}]', 'null', '"string"', '42', 'true']) {
      assertApiError(await post(srv.port, body), 400, 'INVALID_JSON');
    }
  });

  test('declared Content-Length over 32768 returns 413 without reading the body', async () => {
    const big = JSON.stringify({ ...VALID, message: 'x'.repeat(40000) });
    const res = await post(srv.port, big);
    assertApiError(res, 413, 'PAYLOAD_TOO_LARGE');
  });

  test('streamed (chunked) body over 32768 returns 413', async () => {
    const res = await new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: '127.0.0.1', port: srv.port, method: 'POST', path: '/api/contact', agent: false,
          headers: { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' },
        },
        (r) => {
          const chunks = [];
          r.on('data', (c) => chunks.push(c));
          r.on('end', () => resolve({ status: r.statusCode, headers: r.headers, text: Buffer.concat(chunks).toString() }));
        },
      );
      req.on('error', (err) => (err.code === 'ECONNRESET' || err.code === 'EPIPE' ? null : reject(err)));
      req.write('{"name":"a","email":"a@b.co","message":"');
      for (let i = 0; i < 10; i++) req.write('y'.repeat(4096));
      req.end('"}');
    });
    assert.equal(res.status, 413);
    assert.equal(JSON.parse(res.text).error.code, 'PAYLOAD_TOO_LARGE');
    assert.equal(res.headers['cache-control'], 'no-store');
  });

  test('a body of exactly 32768 bytes is accepted by the size check', async () => {
    const base = JSON.stringify({ ...VALID, pad: '' });
    const body = JSON.stringify({ ...VALID, pad: 'p'.repeat(32768 - Buffer.byteLength(base)) });
    assert.equal(Buffer.byteLength(body), 32768);
    const res = await post(srv.port, body);
    assert.equal(res.status, 201, res.text);
  });

  test('server keeps working after 413s', async () => {
    const res = await rawRequest(srv.port, 'GET', '/api/health');
    assert.equal(res.status, 200);
  });

  test('GET /api/contact returns 405 with Allow: POST', async () => {
    for (const method of ['GET', 'HEAD', 'PUT', 'DELETE']) {
      const res = await rawRequest(srv.port, method, '/api/contact');
      assert.equal(res.status, 405, method);
      assert.equal(res.headers.allow, 'POST');
      assert.equal(res.headers['cache-control'], 'no-store');
      if (method !== 'HEAD') assert.equal(errorOf(res).code, 'METHOD_NOT_ALLOWED');
    }
  });
});

describe('POST /api/contact: 422 validation details (exact strings)', () => {
  let srv;
  before(async () => {
    srv = await startTestServer({ rateLimit: { max: 1000, windowMs: 600000 } });
  });
  after(() => srv.close());

  const cases = [
    ['all missing', {}, {
      name: 'Name is required.', email: 'Email is required.', message: 'Message is required.',
    }],
    ['empty after trim', { name: '   ', email: '\u0000', message: '\t\n ' }, {
      name: 'Name is required.', email: 'Email is required.', message: 'Message is required.',
    }],
    ['wrong types', { name: 42, email: ['a@b.co'], message: { text: 'hello world!' } }, {
      name: 'Name is required.', email: 'Email is required.', message: 'Message is required.',
    }],
    ['name too long', { ...VALID, name: 'n'.repeat(101) }, { name: 'Name must be at most 100 characters.' }],
    ['email invalid', { ...VALID, email: 'not-an-email' }, { email: 'Email address is invalid.' }],
    ['email with space', { ...VALID, email: 'a b@example.com' }, { email: 'Email address is invalid.' }],
    ['email no tld dot', { ...VALID, email: 'a@example' }, { email: 'Email address is invalid.' }],
    ['email too long', { ...VALID, email: 'a'.repeat(250) + '@example.com' }, { email: 'Email must be at most 254 characters.' }],
    ['message too short', { ...VALID, message: 'Too short' }, { message: 'Message must be at least 10 characters.' }],
    ['message too long', { ...VALID, message: 'm'.repeat(5001) }, { message: 'Message must be at most 5000 characters.' }],
    ['mixed', { name: 'Ada', email: 'bad', message: 'short' }, {
      email: 'Email address is invalid.', message: 'Message must be at least 10 characters.',
    }],
  ];
  for (const [label, body, details] of cases) {
    test(label, async () => {
      const err = assertApiError(await post(srv.port, body), 422, 'VALIDATION_FAILED');
      assert.deepEqual(err.details, details);
    });
  }

  test('lengths are counted in code points', async () => {
    const emoji = '\u{1F600}';
    const ok = await post(srv.port, { ...VALID, name: emoji.repeat(100), message: emoji.repeat(10) });
    assert.equal(ok.status, 201, ok.text);
    const bad = await post(srv.port, { ...VALID, name: emoji.repeat(101) });
    assert.deepEqual(errorOf(bad).details, { name: 'Name must be at most 100 characters.' });
  });

  test('boundaries: name 100, message 10 and 5000, email 254 are accepted', async () => {
    const email = 'a'.repeat(242) + '@example.com';
    assert.equal(email.length, 254);
    const res = await post(srv.port, { name: 'n'.repeat(100), email, message: 'm'.repeat(5000) });
    assert.equal(res.status, 201, res.text);
    const short = await post(srv.port, { ...VALID, message: '0123456789' });
    assert.equal(short.status, 201);
  });

  test('nothing is stored for invalid submissions', async () => {
    const before = (await readLines(srv.messagesFile)).length;
    await post(srv.port, { name: 'x' });
    assert.equal((await readLines(srv.messagesFile)).length, before);
  });
});

describe('POST /api/contact: pipeline order and rate limit', () => {
  test('6th request within the window returns 429 with an integer Retry-After', async () => {
    let t = 1_000_000;
    const srv = await startTestServer({ now: () => t });
    try {
      for (let i = 0; i < 5; i++) {
        const res = await post(srv.port, VALID);
        assert.equal(res.status, 201);
        t += 1000;
      }
      const res = await post(srv.port, VALID);
      const err = assertApiError(res, 429, 'RATE_LIMITED');
      assert.equal(typeof err.message, 'string');
      assert.match(res.headers['retry-after'], /^\d+$/);
      assert.equal(Number(res.headers['retry-after']), 595); // 600s window minus 5s elapsed

      t += 595_000; // the oldest hit leaves the window
      assert.equal((await post(srv.port, VALID)).status, 201);
      assert.equal((await post(srv.port, VALID)).status, 429);
      assert.equal((await readLines(srv.messagesFile)).length, 6);
    } finally {
      await srv.close();
    }
  });

  test('every POST that reaches the limiter counts (415/400/422 included)', async () => {
    const srv = await startTestServer();
    try {
      assert.equal((await post(srv.port, 'x', { 'Content-Type': 'text/plain' })).status, 415);
      assert.equal((await post(srv.port, '{bad')).status, 400);
      assert.equal((await post(srv.port, {})).status, 422);
      assert.equal((await post(srv.port, { ...VALID, website: 'bot' })).status, 201);
      assert.equal((await post(srv.port, VALID)).status, 201);
      // Rate limit runs before the content-type check.
      assertApiError(await post(srv.port, 'x', { 'Content-Type': 'text/plain' }), 429, 'RATE_LIMITED');
    } finally {
      await srv.close();
    }
  });

  test('origin check runs before the rate limit and does not consume it', async () => {
    const srv = await startTestServer({ rateLimit: { max: 1, windowMs: 600000 } });
    try {
      for (let i = 0; i < 3; i++) {
        assert.equal((await post(srv.port, VALID, { Origin: 'http://evil.example' })).status, 403);
      }
      assert.equal((await post(srv.port, VALID)).status, 201);
      // Once limited, a foreign origin still gets 403 (origin is step 2).
      assert.equal((await post(srv.port, VALID, { Origin: 'http://evil.example' })).status, 403);
      assert.equal((await post(srv.port, VALID)).status, 429);
    } finally {
      await srv.close();
    }
  });

  test('X-Forwarded-For is ignored unless trustProxy is on', async () => {
    const srv = await startTestServer({ rateLimit: { max: 2, windowMs: 600000 } });
    try {
      assert.equal((await post(srv.port, VALID, { 'X-Forwarded-For': '1.1.1.1' })).status, 201);
      assert.equal((await post(srv.port, VALID, { 'X-Forwarded-For': '2.2.2.2' })).status, 201);
      assert.equal((await post(srv.port, VALID, { 'X-Forwarded-For': '3.3.3.3' })).status, 429);
      const rec = JSON.parse((await readLines(srv.messagesFile))[0]);
      assert.match(rec.ip, /127\.0\.0\.1/);
    } finally {
      await srv.close();
    }
  });

  test('with trustProxy the RIGHTMOST X-Forwarded-For entry is the key and stored ip', async () => {
    const srv = await startTestServer({ trustProxy: true, rateLimit: { max: 1, windowMs: 600000 } });
    try {
      assert.equal((await post(srv.port, VALID, { 'X-Forwarded-For': '10.0.0.1, 1.1.1.1' })).status, 201);
      assert.equal((await post(srv.port, VALID, { 'X-Forwarded-For': '10.0.0.1, 2.2.2.2' })).status, 201);
      assert.equal((await post(srv.port, VALID, { 'X-Forwarded-For': '1.1.1.1' })).status, 429);
      assert.equal((await post(srv.port, VALID, { 'X-Forwarded-For': '2001:db8::1' })).status, 201, 'IPv6 accepted');
      const ips = (await readLines(srv.messagesFile)).map((l) => JSON.parse(l).ip);
      assert.deepEqual(ips, ['1.1.1.1', '2.2.2.2', '2001:db8::1']);
    } finally {
      await srv.close();
    }
  });

  test('with trustProxy a spoofed leftmost X-Forwarded-For does not bypass the limit', async () => {
    const srv = await startTestServer({ trustProxy: true, rateLimit: { max: 2, windowMs: 600000 } });
    try {
      // The client prepends a random address each time; the proxy appends the real one (5.5.5.5).
      const statuses = [];
      for (let i = 0; i < 5; i++) {
        const spoof = `${1 + i}.${Math.floor(Math.random() * 255)}.${i * 7}.${200 - i}`;
        statuses.push((await post(srv.port, VALID, { 'X-Forwarded-For': `${spoof}, 5.5.5.5` })).status);
      }
      assert.deepEqual(statuses, [201, 201, 429, 429, 429]);
      const ips = (await readLines(srv.messagesFile)).map((l) => JSON.parse(l).ip);
      assert.deepEqual(ips, ['5.5.5.5', '5.5.5.5']);
    } finally {
      await srv.close();
    }
  });

  test('with trustProxy an invalid rightmost entry falls back to the socket address', async () => {
    const srv = await startTestServer({ trustProxy: true, rateLimit: { max: 2, windowMs: 600000 } });
    try {
      for (const xff of ['1.1.1.1, not-an-ip', '2.2.2.2, 999.1.1.1', '3.3.3.3, 1.2.3']) {
        await post(srv.port, VALID, { 'X-Forwarded-For': xff });
      }
      const ips = (await readLines(srv.messagesFile)).map((l) => JSON.parse(l).ip);
      assert.equal(ips.length, 2, 'all three shared the socket-address bucket (third was 429)');
      for (const ip of ips) assert.match(ip, /127\.0\.0\.1/);
    } finally {
      await srv.close();
    }
  });
});

describe('POST /api/contact: storage failures', () => {
  test('file at or over MESSAGES_MAX_BYTES returns 503 STORAGE_UNAVAILABLE', async () => {
    const srv = await startTestServer({ messagesMaxBytes: 100 });
    try {
      await fs.mkdir(path.dirname(srv.messagesFile), { recursive: true });
      await fs.writeFile(srv.messagesFile, 'x'.repeat(100));
      assertApiError(await post(srv.port, VALID), 503, 'STORAGE_UNAVAILABLE');
      assert.equal((await fs.stat(srv.messagesFile)).size, 100);
    } finally {
      await srv.close();
    }
  });

  test('a file just under the cap still accepts one more message', async () => {
    const srv = await startTestServer({ messagesMaxBytes: 100 });
    try {
      await fs.mkdir(path.dirname(srv.messagesFile), { recursive: true });
      await fs.writeFile(srv.messagesFile, 'x'.repeat(99));
      assert.equal((await post(srv.port, VALID)).status, 201);
      assertApiError(await post(srv.port, VALID), 503, 'STORAGE_UNAVAILABLE');
    } finally {
      await srv.close();
    }
  });

  test('a write error returns a generic 500 INTERNAL_ERROR with no stack trace', async () => {
    const srv = await startTestServer({ captureLogs: true });
    try {
      // Make the messages "file" a directory so appendFile fails.
      await fs.mkdir(srv.messagesFile, { recursive: true });
      const res = await post(srv.port, VALID);
      const err = assertApiError(res, 500, 'INTERNAL_ERROR');
      assert.equal(err.message, 'Something went wrong.');
      assert.ok(!res.text.includes(srv.tmpDir));
      assert.ok(srv.logs.error.length >= 1, 'error logged server-side');
      assert.ok(srv.logs.log.every((l) => !l.includes(VALID.message)), 'bodies are never logged');
    } finally {
      await srv.close();
    }
  });
});

describe('POST /api/contact: aborted uploads', () => {
  test('client aborting mid-upload does not crash the server or store anything', async () => {
    const srv = await startTestServer({ captureLogs: true });
    try {
      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => {
          const socket = net.connect(srv.port, '127.0.0.1', () => {
            socket.write(
              'POST /api/contact HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\n' +
                'Content-Length: 1000\r\n\r\n{"name":"Ada","email":"a',
            );
            setTimeout(() => {
              socket.destroy();
              resolve();
            }, 30);
          });
          socket.on('error', resolve);
        });
      }
      await new Promise((r) => setTimeout(r, 50));
      const res = await rawRequest(srv.port, 'GET', '/api/health');
      assert.equal(res.status, 200);
      assert.equal((await readLines(srv.messagesFile)).length, 0);
      assert.equal(srv.logs.error.length, 0);
    } finally {
      await srv.close();
    }
  });

  test('client aborting a chunked upload does not crash the server', async () => {
    const srv = await startTestServer();
    try {
      await new Promise((resolve) => {
        const socket = net.connect(srv.port, '127.0.0.1', () => {
          socket.write(
            'POST /api/contact HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\n' +
              'Transfer-Encoding: chunked\r\n\r\n5\r\n{"nam\r\n',
          );
          setTimeout(() => {
            socket.destroy();
            resolve();
          }, 30);
        });
        socket.on('error', resolve);
      });
      await new Promise((r) => setTimeout(r, 50));
      assert.equal((await rawRequest(srv.port, 'GET', '/api/health')).status, 200);
    } finally {
      await srv.close();
    }
  });
});
