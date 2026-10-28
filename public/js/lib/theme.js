// Theme state: stored choice > content default > system preference.
const KEY = 'pf-theme';
const listeners = new Set();
let defaultPref = 'system';
let mql = null;

function readStored() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'dark' || v === 'light' ? v : null;
  } catch {
    return null;
  }
}

function systemTheme() {
  return mql && mql.matches ? 'light' : 'dark';
}

function resolve() {
  const stored = readStored();
  if (stored) return stored;
  if (defaultPref === 'dark' || defaultPref === 'light') return defaultPref;
  return systemTheme();
}

function apply() {
  const theme = resolve();
  document.documentElement.setAttribute('data-theme', theme);
  for (const cb of listeners) {
    try { cb(theme); } catch (err) { console.error(err); }
  }
}

/** initTheme(defaultPref) can be called again once content is loaded to apply site.themeDefault. */
export function initTheme(pref = 'system') {
  defaultPref = pref === 'dark' || pref === 'light' ? pref : 'system';
  if (!mql && typeof matchMedia === 'function') {
    mql = matchMedia('(prefers-color-scheme: light)');
    if (mql.addEventListener) mql.addEventListener('change', apply);
  }
  apply();
}

export function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

export function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem(KEY, next); } catch { /* storage unavailable */ }
  if (!readStored()) {
    // Storage blocked: still honour the click for this page view.
    defaultPref = next;
  }
  apply();
  return next;
}

/** onThemeChange(cb(theme)) → unsubscribe() */
export function onThemeChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
