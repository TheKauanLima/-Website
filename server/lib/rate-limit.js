/**
 * In-memory sliding-window rate limiter (a timestamp log per key).
 *
 * hit(key) records a request and returns { allowed, remaining, retryAfter }.
 * retryAfter is in whole seconds (ceil) and only meaningful when allowed is false.
 * Rejected hits are not recorded, so a blocked client regains access exactly
 * windowMs after its oldest counted request.
 */
export function createRateLimiter({
  windowMs = 600000,
  max = 5,
  now = Date.now,
  maxKeys = 10000,
  sweepIntervalMs = 60000,
} = {}) {
  /** @type {Map<string, number[]>} insertion order = least recently used first */
  const hits = new Map();

  function prune(list, t) {
    const cutoff = t - windowMs;
    let i = 0;
    while (i < list.length && list[i] <= cutoff) i++;
    if (i > 0) list.splice(0, i);
    return list;
  }

  function hit(key) {
    const t = now();
    const list = prune(hits.get(key) ?? [], t);
    // Refresh LRU position.
    hits.delete(key);

    if (list.length >= max) {
      hits.set(key, list);
      const retryMs = list[0] + windowMs - t;
      return { allowed: false, remaining: 0, retryAfter: Math.max(1, Math.ceil(retryMs / 1000)) };
    }

    list.push(t);
    hits.set(key, list);
    while (hits.size > maxKeys) {
      hits.delete(hits.keys().next().value);
    }
    return { allowed: true, remaining: max - list.length, retryAfter: 0 };
  }

  function sweep() {
    const t = now();
    for (const [key, list] of hits) {
      if (prune(list, t).length === 0) hits.delete(key);
    }
  }

  let timer = null;
  if (sweepIntervalMs > 0) {
    timer = setInterval(sweep, sweepIntervalMs);
    timer.unref?.();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return {
    hit,
    sweep,
    stop,
    reset: () => hits.clear(),
    get size() {
      return hits.size;
    },
  };
}
