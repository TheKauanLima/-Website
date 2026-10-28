// API-first content loading with a static-file fallback (works on GitHub Pages).

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

async function fetchJson(url, { timeoutMs, requireJsonType }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-cache',
      signal: controller.signal,
    });
    if (!res.ok) return null;
    if (requireJsonType && !(res.headers.get('content-type') || '').includes('application/json')) return null;
    const data = await res.json();
    if (!data || typeof data !== 'object' || Array.isArray(data) || !('schemaVersion' in data)) return null;
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** loadContent({ timeoutMs }) → { content, source: 'api' | 'static' } */
export async function loadContent({ timeoutMs = 3000 } = {}) {
  if (location.protocol === 'file:') {
    throw fail('FILE_PROTOCOL', 'This site cannot run from file://. Run "npm start" or serve the public/ folder with a static server.');
  }
  const fromApi = await fetchJson('api/content', { timeoutMs, requireJsonType: true });
  if (fromApi) return { content: fromApi, source: 'api' };
  const fromStatic = await fetchJson('data/content.json', { timeoutMs, requireJsonType: false });
  if (fromStatic) return { content: fromStatic, source: 'static' };
  throw fail('CONTENT_LOAD_FAILED', 'The site content could not be loaded.');
}
