import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  FIXTURE_PUBLIC,
  looksLikeStackTrace,
  makeTempDir,
  missingSecurityHeaders,
  rawRequest,
  rawSocket,
  startTestServer,
} from '../helpers/server.js';

const LEAK_MARKERS = ['LEAK-PACKAGE', 'LEAK-SERVER', 'LEAK-MESSAGES', 'LEAK-GITIGNORE', 'FIXTURE-SECRET', 'LEAK-OUTSIDE'];

describe('static files: MIME, index, caching, ranges, methods', () => {
  let srv;
  before(async () => {
    srv = await startTestServer();
  });
  after(() => srv.close());

  const get = (p, headers) => rawRequest(srv.port, 'GET', p, headers);

  test('GET / serves index.html with no-cache and validators', async () => {
    const res = await get('/');
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'text/html; charset=utf-8');
    assert.match(res.text, /FIXTURE-INDEX/);
    assert.equal(res.headers['cache-control'], 'no-cache');
    assert.match(res.headers.etag, /^W\/"[0-9a-f]+-[0-9a-f]+"$/);
    assert.ok(!Number.isNaN(Date.parse(res.headers['last-modified'])));
    assert.equal(res.headers['accept-ranges'], 'bytes');
    assert.equal(Number(res.headers['content-length']), res.body.length);
    assert.deepEqual(missingSecurityHeaders(res.headers), []);
  });

  test('ETag encodes size and mtime', async () => {
    const stat = await fs.stat(path.join(FIXTURE_PUBLIC, 'css', 'site.css'));
    const res = await get('/css/site.css');
    assert.equal(res.headers.etag, `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`);
  });

  const mimeCases = [
    ['/index.html', 'text/html; charset=utf-8', 'no-cache'],
    ['/css/site.css', 'text/css; charset=utf-8', 'no-cache'],
    ['/js/app.js', 'text/javascript; charset=utf-8', 'no-cache'],
    ['/img/pic.svg', 'image/svg+xml; charset=utf-8', 'public, max-age=604800'],
    ['/audio/clip.wav', 'audio/wav', 'public, max-age=604800'],
    ['/noindex/readme.txt', 'text/plain; charset=utf-8', 'public, max-age=604800'],
  ];
  for (const [p, type, cache] of mimeCases) {
    test(`MIME and cache policy for ${p}`, async () => {
      const res = await get(p);
      assert.equal(res.status, 200);
      assert.equal(res.headers['content-type'], type);
      assert.equal(res.headers['cache-control'], cache);
      const onDisk = await fs.readFile(path.join(FIXTURE_PUBLIC, ...p.split('/').filter(Boolean)));
      assert.deepEqual(res.body, onDisk);
    });
  }

  test('HEAD returns the same headers as GET and no body', async () => {
    const g = await get('/css/site.css');
    const h = await rawRequest(srv.port, 'HEAD', '/css/site.css');
    assert.equal(h.status, 200);
    assert.equal(h.body.length, 0);
    for (const name of ['content-type', 'content-length', 'etag', 'last-modified', 'cache-control', 'accept-ranges']) {
      assert.equal(h.headers[name], g.headers[name], name);
    }
    assert.deepEqual(missingSecurityHeaders(h.headers), []);
  });

  test('If-None-Match with the current ETag returns 304 with no body', async () => {
    const first = await get('/js/app.js');
    const res = await get('/js/app.js', { 'If-None-Match': first.headers.etag });
    assert.equal(res.status, 304);
    assert.equal(res.body.length, 0);
    assert.equal(res.headers.etag, first.headers.etag);
    assert.deepEqual(missingSecurityHeaders(res.headers), []);

    const list = await get('/js/app.js', { 'If-None-Match': `"nope", ${first.headers.etag}` });
    assert.equal(list.status, 304);
    const strong = await get('/js/app.js', { 'If-None-Match': first.headers.etag.replace(/^W\//, '') });
    assert.equal(strong.status, 304, 'weak comparison');
    const stale = await get('/js/app.js', { 'If-None-Match': 'W/"0-0"' });
    assert.equal(stale.status, 200);
  });

  test('directory with trailing slash serves its index.html', async () => {
    const res = await get('/sub/');
    assert.equal(res.status, 200);
    assert.match(res.text, /FIXTURE-SUB-INDEX/);
  });

  test('directory without trailing slash redirects 301 keeping the query', async () => {
    const res = await get('/sub');
    assert.equal(res.status, 301);
    assert.equal(res.headers.location, '/sub/');
    const q = await get('/sub?a=1&b=two');
    assert.equal(q.status, 301);
    assert.equal(q.headers.location, '/sub/?a=1&b=two');
  });

  test('redirect Location is never protocol-relative', async () => {
    // These raw request lines normalize to the pathname "//sub" (a directory without a
    // trailing slash). A naive redirect would send "Location: //sub/", which browsers
    // treat as the external host "sub".
    for (const target of ['/x/..//sub', '/.//sub', '/x/..//sub?q=1']) {
      const text = await rawSocket(srv.port, `GET ${target} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n`);
      assert.match(text, /^HTTP\/1\.1 301 /, target);
      const location = /\r\nLocation: ([^\r]*)\r\n/i.exec(text)?.[1];
      assert.equal(location, target.endsWith('?q=1') ? '/sub/?q=1' : '/sub/', target);
    }
  });

  test('never lists directories', async () => {
    for (const p of ['/noindex/', '/css/', '/img/']) {
      const res = await get(p);
      assert.equal(res.status, 404, p);
      assert.doesNotMatch(res.text, /readme\.txt|site\.css|pic\.svg/);
    }
  });

  test('404 is a tiny HTML page linking to ./', async () => {
    const res = await get('/does-not-exist.html');
    assert.equal(res.status, 404);
    assert.equal(res.headers['content-type'], 'text/html; charset=utf-8');
    assert.match(res.text, /<h1>404 Not Found<\/h1>/);
    assert.match(res.text, /href="\.\/"/);
    assert.deepEqual(missingSecurityHeaders(res.headers), []);
  });

  test('a file path with a trailing slash is 404', async () => {
    assert.equal((await get('/index.html/')).status, 404);
  });

  test('Range bytes=a-b returns 206 with the exact slice', async () => {
    const file = await fs.readFile(path.join(FIXTURE_PUBLIC, 'audio', 'clip.wav'));
    const res = await get('/audio/clip.wav', { Range: 'bytes=0-9' });
    assert.equal(res.status, 206);
    assert.equal(res.headers['content-range'], `bytes 0-9/${file.length}`);
    assert.equal(res.headers['content-length'], '10');
    assert.equal(res.headers['content-type'], 'audio/wav');
    assert.deepEqual(res.body, file.subarray(0, 10));
  });

  test('Range bytes=a- and bytes=-n', async () => {
    const file = await fs.readFile(path.join(FIXTURE_PUBLIC, 'audio', 'clip.wav'));
    const open = await get('/audio/clip.wav', { Range: 'bytes=100-' });
    assert.equal(open.status, 206);
    assert.equal(open.headers['content-range'], `bytes 100-${file.length - 1}/${file.length}`);
    assert.deepEqual(open.body, file.subarray(100));

    const suffix = await get('/audio/clip.wav', { Range: 'bytes=-50' });
    assert.equal(suffix.status, 206);
    assert.equal(suffix.headers['content-range'], `bytes ${file.length - 50}-${file.length - 1}/${file.length}`);
    assert.deepEqual(suffix.body, file.subarray(file.length - 50));

    const clamp = await get('/audio/clip.wav', { Range: 'bytes=2000-999999' });
    assert.equal(clamp.status, 206);
    assert.equal(clamp.headers['content-range'], `bytes 2000-${file.length - 1}/${file.length}`);
  });

  test('unsatisfiable and multi-range requests return 416', async () => {
    const size = (await fs.stat(path.join(FIXTURE_PUBLIC, 'audio', 'clip.wav'))).size;
    for (const range of [`bytes=${size}-`, 'bytes=99999-100000', 'bytes=0-1,5-6', 'bytes=-0', 'bytes=10-5', 'bytes=abc']) {
      const res = await get('/audio/clip.wav', { Range: range });
      assert.equal(res.status, 416, range);
      assert.equal(res.headers['content-range'], `bytes */${size}`, range);
      assert.deepEqual(missingSecurityHeaders(res.headers), []);
    }
  });

  test('HEAD with Range returns 206 headers and no body', async () => {
    const res = await rawRequest(srv.port, 'HEAD', '/audio/clip.wav', { Range: 'bytes=0-9' });
    assert.equal(res.status, 206);
    assert.equal(res.headers['content-length'], '10');
    assert.equal(res.body.length, 0);
  });

  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) {
    test(`${method} to a static path returns 405 with Allow: GET, HEAD`, async () => {
      const res = await rawRequest(srv.port, method, '/index.html', { 'Content-Type': 'text/plain' }, method === 'POST' ? 'x=1' : undefined);
      assert.equal(res.status, 405);
      assert.equal(res.headers.allow, 'GET, HEAD');
      assert.match(res.headers['content-type'], /^text\/plain/);
      assert.deepEqual(missingSecurityHeaders(res.headers), []);
    });
  }

  test('URL longer than 2048 characters returns 414', async () => {
    const long = '/' + 'a'.repeat(2100);
    const res = await get(long);
    assert.equal(res.status, 414);
    assert.deepEqual(missingSecurityHeaders(res.headers), []);

    const api = await get('/api/' + 'a'.repeat(2100));
    assert.equal(api.status, 414);
    assert.equal(api.headers['content-type'], 'application/json; charset=utf-8');
    assert.equal(JSON.parse(api.text).error.code, 'URI_TOO_LONG');

    const edge = await get('/' + 'a'.repeat(2047)); // exactly 2048 chars
    assert.equal(edge.status, 404);
  });

  test('malformed percent-encoding returns 400', async () => {
    for (const p of ['/%E0%A4%A', '/%', '/css/%zz.css', '/%c0%ae%c0%ae/package.json']) {
      const res = await get(p);
      assert.equal(res.status, 400, p);
      assert.deepEqual(missingSecurityHeaders(res.headers), []);
    }
  });
});

describe('static files: traversal and hidden-file guards', () => {
  let srv;
  let sandbox;
  let symlinkOk = false;

  before(async () => {
    // A throwaway site root with secrets next to (not inside) the public folder.
    sandbox = await makeTempDir('portfolio-traversal-');
    const pub = path.join(sandbox, 'public');
    await fs.cp(FIXTURE_PUBLIC, pub, { recursive: true });
    await fs.writeFile(path.join(sandbox, 'package.json'), '{"name":"LEAK-PACKAGE"}');
    await fs.mkdir(path.join(sandbox, 'server'));
    await fs.writeFile(path.join(sandbox, 'server', 'server.js'), '// LEAK-SERVER');
    await fs.mkdir(path.join(sandbox, 'data'));
    await fs.writeFile(path.join(sandbox, 'data', 'messages.ndjson'), '{"x":"LEAK-MESSAGES"}\n');
    await fs.writeFile(path.join(pub, '.gitignore'), 'LEAK-GITIGNORE\n');
    await fs.mkdir(path.join(pub, '.hidden'));
    await fs.writeFile(path.join(pub, '.hidden', 'file.txt'), 'FIXTURE-SECRET in hidden dir');
    await fs.mkdir(path.join(sandbox, 'outside'));
    await fs.writeFile(path.join(sandbox, 'outside', 'secret.txt'), 'LEAK-OUTSIDE');
    try {
      // Junctions need no admin rights on Windows; ignored elsewhere.
      await fs.symlink(path.join(sandbox, 'outside'), path.join(pub, 'escape'), 'junction');
      await fs.symlink(path.join(sandbox, 'package.json'), path.join(pub, 'linked.json')).catch(() => {});
      symlinkOk = true;
    } catch {
      symlinkOk = false;
    }
    srv = await startTestServer({ publicDir: pub });
  });
  after(async () => {
    await srv.close();
    await fs.rm(sandbox, { recursive: true, force: true, maxRetries: 3 });
  });

  const assertBlocked = (res, p) => {
    assert.ok(res.status === 400 || res.status === 404, `${p} -> ${res.status}`);
    for (const marker of LEAK_MARKERS) assert.ok(!res.text.includes(marker), `${p} leaked ${marker}`);
    assert.ok(!looksLikeStackTrace(res.text), `${p} leaked a stack/path`);
    assert.deepEqual(missingSecurityHeaders(res.headers), []);
  };

  // §7 item 21, verbatim.
  const acceptance = [
    '/../package.json',
    '/%2e%2e/%2e%2e/package.json',
    '/..%2fserver%2fserver.js',
    '/css/..%5c..%5cpackage.json',
    '/.gitignore',
    '/data/../../data/messages.ndjson',
    '/%00',
    '/%E0%A4%A',
  ];
  for (const p of acceptance) {
    test(`acceptance: ${p} is blocked`, async () => {
      assertBlocked(await rawRequest(srv.port, 'GET', p), p);
    });
  }

  const extra = [
    '/../../package.json',
    '/..\\package.json',
    '/css/..\\..\\package.json',
    '/%2e%2e%5cpackage.json',
    '/%2E%2E/package.json',
    '/.%2e/package.json',
    '/%2e%2e%2fpackage.json',
    '/css/%2e%2e%2f%2e%2e%2fpackage.json',
    '/%5c..%5cpackage.json',
    '/.secret',
    '/%2esecret',
    '/.hidden/file.txt',
    '/%2ehidden/file.txt',
    '/css/../.secret',
    '/index.html%00.css',
    '/C:/Windows/win.ini',
    '/c%3a/windows/win.ini',
    '/index.html::$DATA',
    '/index.html%3a%3a$DATA',
    '/..%2f..%2f..%2f..%2f..%2f..%2fetc%2fpasswd',
    '/css/%2e%2e%5c%2e%2e%5c%2e%2e%5cdata%5cmessages.ndjson',
  ];
  for (const p of extra) {
    test(`extra: ${p} is blocked`, async () => {
      assertBlocked(await rawRequest(srv.port, 'GET', p), p);
    });
  }

  test('raw request lines with dot segments are blocked', async () => {
    const text = await rawSocket(srv.port, 'GET /../../package.json HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n');
    assert.match(text, /^HTTP\/1\.1 (400|404)/);
    for (const marker of LEAK_MARKERS) assert.ok(!text.includes(marker));
  });

  test('HEAD on blocked paths is blocked too', async () => {
    const res = await rawRequest(srv.port, 'HEAD', '/.gitignore');
    assert.equal(res.status, 404);
  });

  test('symlinks/junctions escaping the public folder are 404', async (t) => {
    if (!symlinkOk) return t.skip('cannot create symlinks on this system');
    assertBlocked(await rawRequest(srv.port, 'GET', '/escape/secret.txt'), '/escape/secret.txt');
    const linked = await rawRequest(srv.port, 'GET', '/linked.json');
    assert.ok(!linked.text.includes('LEAK-PACKAGE'));
  });

  test('normal files still work inside the sandbox', async () => {
    const res = await rawRequest(srv.port, 'GET', '/css/site.css');
    assert.equal(res.status, 200);
  });
});

describe('static files: server faults', () => {
  test('a missing public folder gives a generic 500 with no stack trace', async () => {
    const tmp = await makeTempDir();
    const srv = await startTestServer({ publicDir: path.join(tmp, 'nope') });
    try {
      const res = await rawRequest(srv.port, 'GET', '/');
      assert.equal(res.status, 500);
      assert.ok(!looksLikeStackTrace(res.text));
      assert.deepEqual(missingSecurityHeaders(res.headers), []);
    } finally {
      await srv.close();
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});
