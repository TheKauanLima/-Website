// Reduced-motion state: the system preference plus an in-page override that persists.
const KEY = 'pf-motion';
const listeners = new Set();
let reduced = false;
let mql = null;
let observer = null;

function readStored() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'reduced' || v === 'full' ? v : null;
  } catch {
    return null;
  }
}

function apply() {
  document.documentElement.setAttribute('data-motion', reduced ? 'reduced' : 'full');
}

function emit() {
  if (reduced) revealAll(document);
  for (const cb of listeners) {
    try { cb(reduced); } catch (err) { console.error(err); }
  }
}

export function initMotion() {
  if (!mql && typeof matchMedia === 'function') {
    mql = matchMedia('(prefers-reduced-motion: reduce)');
    const onSystemChange = () => {
      if (readStored()) return;
      reduced = mql.matches;
      apply();
      emit();
    };
    if (mql.addEventListener) mql.addEventListener('change', onSystemChange);
  }
  const stored = readStored();
  reduced = stored ? stored === 'reduced' : !!(mql && mql.matches);
  apply();
}

export function isReducedMotion() {
  return reduced;
}

/** setMotion('reduced' | 'full'): persists the choice. */
export function setMotion(value) {
  reduced = value === 'reduced';
  try { localStorage.setItem(KEY, reduced ? 'reduced' : 'full'); } catch { /* storage unavailable */ }
  apply();
  emit();
}

/** onMotionChange(cb(reduced)) → unsubscribe() */
export function onMotionChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function revealAll(root) {
  root.querySelectorAll('[data-reveal]:not(.is-visible)').forEach((el) => {
    el.classList.add('is-visible');
    if (observer) observer.unobserve(el);
  });
}

/** Observes every [data-reveal] element inside root and adds .is-visible once it scrolls into view. */
export function observeReveals(root) {
  root.querySelectorAll('[data-stagger]').forEach((group) => {
    [...group.children].forEach((child, index) => {
      if (!child.style.getPropertyValue('--i')) child.style.setProperty('--i', String(index % 8));
    });
  });
  if (reduced || typeof IntersectionObserver !== 'function') {
    revealAll(root);
    return;
  }
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });
  }
  root.querySelectorAll('[data-reveal]:not(.is-visible)').forEach((el) => observer.observe(el));
}
