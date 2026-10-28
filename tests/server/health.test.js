import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { missingSecurityHeaders, rawRequest, startTestServer } from '../helpers/server.js';

describe('GET|HEAD /api/health', () => {
  let srv;
  before(async () => {
    srv = await startTestServer({ now: () => Date.parse('2026-09-28T17:00:00.000Z') });
  });
  after(() => srv.close());

  test('GET returns 200 {status, uptime, time}', async () => {
    const res = await rawRequest(srv.port, 'GET', '/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
    assert.equal(res.headers['cache-control'], 'no-store');
    const body = JSON.parse(res.text);
    assert.deepEqual(Object.keys(body).sort(), ['status', 'time', 'uptime']);
    assert.equal(body.status, 'ok');
    assert.equal(typeof body.uptime, 'number');
    assert.ok(body.uptime >= 0);
    assert.equal(body.time, '2026-09-28T17:00:00.000Z');
    assert.equal(new Date(body.time).toISOString(), body.time);
    assert.deepEqual(missingSecurityHeaders(res.headers), []);
    assert.equal(res.headers['access-control-allow-origin'], undefined, 'no CORS');
  });

  test('HEAD returns headers only', async () => {
    const res = await rawRequest(srv.port, 'HEAD', '/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 0);
    assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
    assert.equal(res.headers['cache-control'], 'no-store');
  });

  test('wrong method returns 405 METHOD_NOT_ALLOWED with Allow', async () => {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const res = await rawRequest(srv.port, method, '/api/health');
      assert.equal(res.status, 405);
      assert.equal(res.headers.allow, 'GET, HEAD');
      assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
      assert.deepEqual(JSON.parse(res.text), { error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
    }
  });

  test('query strings are ignored for routing', async () => {
    const res = await rawRequest(srv.port, 'GET', '/api/health?x=1');
    assert.equal(res.status, 200);
  });
});

describe('unknown /api paths', () => {
  let srv;
  before(async () => {
    srv = await startTestServer();
  });
  after(() => srv.close());

  for (const p of ['/api', '/api/', '/api/nope', '/api/health/', '/api/Health', '/api/contact/x']) {
    test(`${p} returns 404 NOT_FOUND JSON`, async () => {
      const res = await rawRequest(srv.port, 'GET', p);
      assert.equal(res.status, 404);
      assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
      const body = JSON.parse(res.text);
      assert.equal(body.error.code, 'NOT_FOUND');
      assert.equal(typeof body.error.message, 'string');
      assert.equal('details' in body.error, false);
      assert.deepEqual(missingSecurityHeaders(res.headers), []);
    });
  }
});
