import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECT_ROOT, loadConfig } from '../../server/config.js';

const ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

describe('loadConfig', () => {
  test('PROJECT_ROOT is the folder containing server/', () => {
    assert.equal(PROJECT_ROOT, ROOT);
  });

  test('defaults', () => {
    const cfg = loadConfig({});
    assert.equal(cfg.port, 3000);
    assert.equal(cfg.host, '127.0.0.1');
    assert.equal(cfg.publicDir, path.join(ROOT, 'public'));
    assert.equal(cfg.contentFile, path.join(ROOT, 'public', 'data', 'content.json'));
    assert.equal(cfg.messagesFile, path.join(ROOT, 'data', 'messages.ndjson'));
    assert.equal(cfg.messagesMaxBytes, 5242880);
    assert.deepEqual(cfg.rateLimit, { max: 5, windowMs: 600000 });
    assert.equal(cfg.trustProxy, false);
  });

  test('relative paths resolve against the project root, not the cwd', () => {
    const original = process.cwd();
    try {
      process.chdir(path.join(ROOT, 'tests'));
      const cfg = loadConfig({ PUBLIC_DIR: 'tests/fixtures/public', MESSAGES_FILE: 'tmp/m.ndjson' });
      assert.equal(cfg.publicDir, path.join(ROOT, 'tests', 'fixtures', 'public'));
      assert.equal(cfg.messagesFile, path.join(ROOT, 'tmp', 'm.ndjson'));
      assert.equal(loadConfig({}).publicDir, path.join(ROOT, 'public'));
    } finally {
      process.chdir(original);
    }
  });

  test('absolute paths are kept', () => {
    const abs = path.resolve(path.sep, 'somewhere', 'messages.ndjson');
    assert.equal(loadConfig({ MESSAGES_FILE: abs }).messagesFile, abs);
  });

  test('env overrides', () => {
    const cfg = loadConfig({
      PORT: '8080',
      HOST: '0.0.0.0',
      MESSAGES_MAX_BYTES: '1000',
      RATE_LIMIT_MAX: '10',
      RATE_LIMIT_WINDOW_MS: '60000',
      TRUST_PROXY: '1',
    });
    assert.equal(cfg.port, 8080);
    assert.equal(cfg.host, '0.0.0.0');
    assert.equal(cfg.messagesMaxBytes, 1000);
    assert.deepEqual(cfg.rateLimit, { max: 10, windowMs: 60000 });
    assert.equal(cfg.trustProxy, true);
    assert.equal(loadConfig({ TRUST_PROXY: '0' }).trustProxy, false);
    assert.equal(loadConfig({ PORT: '' }).port, 3000);
  });

  test('invalid numbers throw a readable error', () => {
    assert.throws(() => loadConfig({ PORT: 'abc' }), /Invalid PORT/);
    assert.throws(() => loadConfig({ PORT: '70000' }), /Invalid PORT/);
    assert.throws(() => loadConfig({ RATE_LIMIT_MAX: '0' }), /Invalid RATE_LIMIT_MAX/);
  });
});
