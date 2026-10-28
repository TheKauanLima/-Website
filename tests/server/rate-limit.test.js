import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../../server/lib/rate-limit.js';

function clock(start = 0) {
  const c = { t: start, now: () => c.t };
  return c;
}

describe('createRateLimiter', () => {
  test('allows max hits per window, then blocks with a ceil-seconds retryAfter', () => {
    const c = clock(10_000);
    const rl = createRateLimiter({ max: 5, windowMs: 600_000, now: c.now, sweepIntervalMs: 0 });
    for (let i = 0; i < 5; i++) {
      const r = rl.hit('ip');
      assert.equal(r.allowed, true);
      assert.equal(r.remaining, 4 - i);
      c.t += 100;
    }
    const blocked = rl.hit('ip');
    assert.equal(blocked.allowed, false);
    // oldest at 10_000, now 10_500 -> 599.5s -> ceil 600
    assert.equal(blocked.retryAfter, 600);
    assert.ok(Number.isInteger(blocked.retryAfter));
  });

  test('keys are independent', () => {
    const c = clock();
    const rl = createRateLimiter({ max: 1, windowMs: 1000, now: c.now, sweepIntervalMs: 0 });
    assert.equal(rl.hit('a').allowed, true);
    assert.equal(rl.hit('a').allowed, false);
    assert.equal(rl.hit('b').allowed, true);
  });

  test('sliding window: capacity returns as each old hit expires', () => {
    const c = clock(0);
    const rl = createRateLimiter({ max: 2, windowMs: 1000, now: c.now, sweepIntervalMs: 0 });
    rl.hit('k'); // t=0
    c.t = 500;
    rl.hit('k'); // t=500
    c.t = 999;
    assert.equal(rl.hit('k').allowed, false);
    c.t = 1000; // first hit expires (window is (t-1000, t])
    assert.equal(rl.hit('k').allowed, true);
    assert.equal(rl.hit('k').allowed, false);
    c.t = 1500;
    assert.equal(rl.hit('k').allowed, true);
  });

  test('blocked hits are not recorded', () => {
    const c = clock(0);
    const rl = createRateLimiter({ max: 1, windowMs: 1000, now: c.now, sweepIntervalMs: 0 });
    rl.hit('k');
    for (let i = 0; i < 10; i++) {
      c.t += 50;
      rl.hit('k');
    }
    c.t = 1000;
    assert.equal(rl.hit('k').allowed, true);
  });

  test('retryAfter is at least 1 second', () => {
    const c = clock(0);
    const rl = createRateLimiter({ max: 1, windowMs: 1000, now: c.now, sweepIntervalMs: 0 });
    rl.hit('k');
    c.t = 999.9;
    assert.equal(rl.hit('k').retryAfter, 1);
  });

  test('sweep removes keys with no hits in the window', () => {
    const c = clock(0);
    const rl = createRateLimiter({ max: 5, windowMs: 1000, now: c.now, sweepIntervalMs: 0 });
    rl.hit('a');
    c.t = 600;
    rl.hit('b');
    c.t = 1200;
    rl.sweep();
    assert.equal(rl.size, 1);
    c.t = 2000;
    rl.sweep();
    assert.equal(rl.size, 0);
  });

  test('caps the number of keys, evicting the least recently used', () => {
    const c = clock(0);
    const rl = createRateLimiter({ max: 1, windowMs: 60_000, now: c.now, maxKeys: 3, sweepIntervalMs: 0 });
    rl.hit('a');
    rl.hit('b');
    rl.hit('c');
    rl.hit('a'); // blocked, but refreshes a
    rl.hit('d'); // evicts b
    assert.equal(rl.size, 3);
    assert.equal(rl.hit('a').allowed, false, 'a kept');
    assert.equal(rl.hit('b').allowed, true, 'b was evicted, so it starts fresh');
  });

  test('default key cap is 10,000', () => {
    const rl = createRateLimiter({ sweepIntervalMs: 0 });
    for (let i = 0; i < 10_050; i++) rl.hit(`ip-${i}`);
    assert.equal(rl.size, 10_000);
  });

  test('the sweep interval runs every 60s until stop() clears it', (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] });
    const c = clock(0);
    const rl = createRateLimiter({ max: 5, windowMs: 1000, now: c.now });
    rl.hit('a');
    c.t = 5000;
    t.mock.timers.tick(60_000);
    assert.equal(rl.size, 0, 'the interval swept the stale key');

    rl.hit('b');
    rl.stop();
    rl.stop(); // idempotent
    c.t = 10_000;
    t.mock.timers.tick(120_000);
    assert.equal(rl.size, 1, 'no sweep after stop()');
  });
});
