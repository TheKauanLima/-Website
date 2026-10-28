import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXTURE_CONTENT, makeTempDir, rawRequest } from '../helpers/server.js';

const SERVER = fileURLToPath(new URL('../../server/server.js', import.meta.url));

function startProcess(env) {
  const child = spawn(process.execPath, [SERVER], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => (stdout += d));
  child.stderr.on('data', (d) => (stderr += d));
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server did not start: ${stdout} ${stderr}`)), 10000);
    child.stdout.on('data', () => {
      const m = /Portfolio running at http:\/\/127\.0\.0\.1:(\d+)/.exec(stdout);
      if (m) {
        clearTimeout(timer);
        resolve(Number(m[1]));
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`server exited early (${code}): ${stderr}`));
    });
  });
  const exited = new Promise((resolve) => child.on('exit', (code, signal) => resolve({ code, signal })));
  return { child, ready, exited, output: () => ({ stdout, stderr }) };
}

test('server.js starts, prints its URL, serves requests and stops', async () => {
  const tmp = await makeTempDir();
  const proc = startProcess({
    PORT: '0',
    HOST: '127.0.0.1',
    PUBLIC_DIR: 'tests/fixtures/public',
    CONTENT_FILE: FIXTURE_CONTENT,
    MESSAGES_FILE: path.join(tmp, 'messages.ndjson'),
  });
  try {
    const port = await proc.ready;
    const health = await rawRequest(port, 'GET', '/api/health');
    assert.equal(health.status, 200);
    const index = await rawRequest(port, 'GET', '/');
    assert.equal(index.status, 200);
    assert.match(index.text, /FIXTURE-INDEX/);
    assert.match(proc.output().stdout, /GET \/api\/health 200 [\d.]+ms/);

    // Real signals cannot be delivered gracefully to a child on Windows; there kill() is forceful.
    proc.child.kill('SIGINT');
    const { code, signal } = await proc.exited;
    if (process.platform !== 'win32') {
      assert.equal(code, 0, `exit ${code}/${signal}: ${proc.output().stderr}`);
      assert.match(proc.output().stdout, /SIGINT received, shutting down/);
    }
  } finally {
    if (proc.child.exitCode === null && proc.child.signalCode === null) proc.child.kill('SIGKILL');
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test('invalid configuration exits with a readable message', async () => {
  const proc = startProcess({ PORT: 'not-a-port' });
  const { code } = await proc.exited;
  assert.equal(code, 1);
  assert.match(proc.output().stderr, /Invalid PORT/);
  await proc.ready.catch(() => {});
});
