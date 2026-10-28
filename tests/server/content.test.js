import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  FIXTURE_BROKEN,
  FIXTURE_CONTENT,
  looksLikeStackTrace,
  makeTempDir,
  missingSecurityHeaders,
  rawRequest,
  startTestServer,
} from '../helpers/server.js';

describe('GET|HEAD /api/content', () => {
  let srv;
  let dir;
  let contentFile;

  before(async () => {
    dir = await makeTempDir('portfolio-content-');
    contentFile = path.join(dir, 'content.json');
    srv = await startTestServer({ contentFile, captureLogs: true });
  });
  beforeEach(async () => {
    await fs.copyFile(FIXTURE_CONTENT, contentFile);
  });
  after(async () => {
    await srv.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  const get = (headers) => rawRequest(srv.port, 'GET', '/api/content', headers);

  test('200 with exactly the file content, no-cache and a sha1 base64url ETag', async () => {
    const bytes = await fs.readFile(contentFile);
    const res = await get();
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
    assert.equal(res.headers['cache-control'], 'no-cache');
    assert.deepEqual(JSON.parse(res.text), JSON.parse(bytes.toString('utf8')));
    assert.equal(res.text, JSON.stringify(JSON.parse(bytes.toString('utf8'))));
    const expected = `"${crypto.createHash('sha1').update(bytes).digest('base64url')}"`;
    assert.equal(res.headers.etag, expected);
    assert.deepEqual(missingSecurityHeaders(res.headers), []);
  });

  test('If-None-Match with the ETag returns 304 and an empty body', async () => {
    const first = await get();
    const res = await get({ 'If-None-Match': first.headers.etag });
    assert.equal(res.status, 304);
    assert.equal(res.body.length, 0);
    assert.equal(res.headers.etag, first.headers.etag);
    assert.equal(res.headers['cache-control'], 'no-cache');
    assert.deepEqual(missingSecurityHeaders(res.headers), []);
    const other = await get({ 'If-None-Match': '"something-else"' });
    assert.equal(other.status, 200);
  });

  test('edits show up without a restart and change the ETag', async () => {
    const first = await get();
    const data = JSON.parse(await fs.readFile(contentFile, 'utf8'));
    data.profile.name = 'Edited Name';
    await fs.writeFile(contentFile, JSON.stringify(data, null, 2));
    const res = await get({ 'If-None-Match': first.headers.etag });
    assert.equal(res.status, 200);
    assert.notEqual(res.headers.etag, first.headers.etag);
    assert.equal(JSON.parse(res.text).profile.name, 'Edited Name');
  });

  test('HEAD returns headers only', async () => {
    const g = await get();
    const res = await rawRequest(srv.port, 'HEAD', '/api/content');
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 0);
    assert.equal(res.headers.etag, g.headers.etag);
    assert.equal(res.headers['content-length'], g.headers['content-length']);
  });

  test('corrupt JSON returns 500 CONTENT_UNAVAILABLE without a stack trace', async () => {
    await fs.copyFile(FIXTURE_BROKEN, contentFile);
    const res = await get();
    assert.equal(res.status, 500);
    assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
    const body = JSON.parse(res.text);
    assert.equal(body.error.code, 'CONTENT_UNAVAILABLE');
    assert.equal('details' in body.error, false);
    assert.ok(!looksLikeStackTrace(res.text));
    assert.ok(!res.text.includes('Unexpected'), 'parser message is not echoed');
    assert.deepEqual(missingSecurityHeaders(res.headers), []);
  });

  test('missing file returns 500 CONTENT_UNAVAILABLE', async () => {
    await fs.rm(contentFile);
    const res = await get();
    assert.equal(res.status, 500);
    assert.equal(JSON.parse(res.text).error.code, 'CONTENT_UNAVAILABLE');
    assert.ok(!looksLikeStackTrace(res.text));
    assert.ok(!res.text.includes(dir), 'no file paths');
  });

  test('schema errors still return 200 and are warned once per ETag', async () => {
    const data = JSON.parse(await fs.readFile(contentFile, 'utf8'));
    data.site.title = '';
    data.nav = [];
    await fs.writeFile(contentFile, JSON.stringify(data));
    const before = srv.logs.warn.length;
    const a = await get();
    const b = await get();
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(srv.logs.warn.length, before + 1);
    assert.match(srv.logs.warn.at(-1), /site\.title/);
    assert.match(srv.logs.warn.at(-1), /nav/);
  });

  test('a UTF-8 BOM is tolerated', async () => {
    const text = await fs.readFile(contentFile, 'utf8');
    await fs.writeFile(contentFile, '﻿' + text);
    const res = await get();
    assert.equal(res.status, 200);
    assert.equal(JSON.parse(res.text).schemaVersion, 1);
  });

  test('wrong method returns 405 with Allow: GET, HEAD', async () => {
    const res = await rawRequest(srv.port, 'POST', '/api/content', { 'Content-Type': 'application/json' }, '{}');
    assert.equal(res.status, 405);
    assert.equal(res.headers.allow, 'GET, HEAD');
    assert.equal(JSON.parse(res.text).error.code, 'METHOD_NOT_ALLOWED');
  });
});
