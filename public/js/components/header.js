import { h } from '../lib/dom.js';
import { toggleTheme, currentTheme, onThemeChange } from '../lib/theme.js';
import { isReducedMotion, setMotion, onMotionChange } from '../lib/motion.js';
import { icon } from './icons.js';

function initials(name) {
  const parts = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] || 'P').slice(0, 2);
  return letters.toUpperCase();
}

/**
 * renderHeader(content, { onNavigate }) → { element, closeMenu }
 * element is the header's inner content (mounted into the <header> placeholder by main.js).
 */
export function renderHeader(content, { onNavigate } = {}) {
  const homeId = content.nav.some((n) => n.id === 'home') ? 'home' : content.nav[0].id;

  const menuBtn = h('button', {
    type: 'button', class: 'icon-btn menu-toggle', 'aria-expanded': 'false', 'aria-controls': 'primary-nav',
  }, icon('menu', 'icon-open'), icon('close', 'icon-close'), h('span', { class: 'visually-hidden' }, 'Menu'));

  const nav = h('nav', { id: 'primary-nav', class: 'primary-nav', 'aria-label': 'Primary' },
    h('ul', { class: 'nav-list' },
      content.nav.map((n) => h('li', null,
        h('a', { href: `#${n.id}`, 'data-route': n.id, class: 'nav-link' }, h('span', null, n.label))))));

  // While the mobile menu is open, the page behind the overlay is inert so Tab stays in header + nav.
  const behind = () => [document.getElementById('main')].filter(Boolean);
  function setOpen(open, { restoreFocus = false } = {}) {
    menuBtn.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
    document.documentElement.classList.toggle('menu-open', open);
    behind().forEach((el) => { el.inert = open; });
    if (!open && restoreFocus) menuBtn.focus();
  }
  const isOpen = () => menuBtn.getAttribute('aria-expanded') === 'true';
  if (typeof matchMedia === 'function') {
    const desktop = matchMedia('(min-width: 45em)');
    if (desktop.addEventListener) desktop.addEventListener('change', (e) => { if (e.matches && isOpen()) setOpen(false); });
  }

  menuBtn.addEventListener('click', () => setOpen(!isOpen()));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) {
      e.preventDefault();
      setOpen(false, { restoreFocus: true });
    }
  });
  document.addEventListener('click', (e) => {
    if (isOpen() && !nav.contains(e.target) && !menuBtn.contains(e.target)) setOpen(false);
  });
  nav.addEventListener('click', (e) => {
    const link = e.target instanceof Element ? e.target.closest('a[data-route]') : null;
    if (!link || !onNavigate) return;
    // Let the router handle it so choosing the current route still closes the menu and focuses the h1.
    if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      onNavigate(link.getAttribute('data-route'));
    }
  });

  // Theme toggle: accessible name stays constant, aria-pressed carries the state.
  const themeBtn = h('button', { type: 'button', class: 'icon-btn theme-toggle', 'aria-label': 'Dark theme' },
    icon('moon', 'icon-moon'), icon('sun', 'icon-sun'));
  const syncTheme = (theme) => {
    themeBtn.setAttribute('aria-pressed', String(theme === 'dark'));
    themeBtn.title = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  };
  themeBtn.addEventListener('click', () => toggleTheme());
  onThemeChange(syncTheme);
  syncTheme(currentTheme());

  // Motion toggle ("Pause animations"), pressed = paused. Satisfies WCAG 2.2.2.
  const motionBtn = h('button', { type: 'button', class: 'icon-btn motion-toggle', 'aria-label': 'Pause animations' },
    icon('pause', 'icon-pause'), icon('play', 'icon-play'));
  const syncMotion = (reduced) => {
    motionBtn.setAttribute('aria-pressed', String(reduced));
    motionBtn.title = reduced ? 'Play animations' : 'Pause animations';
  };
  motionBtn.addEventListener('click', () => setMotion(isReducedMotion() ? 'full' : 'reduced'));
  onMotionChange(syncMotion);
  syncMotion(isReducedMotion());

  const element = h('div', { class: 'header-inner container' },
    h('a', { class: 'brand', href: `#${homeId}` },
      h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, initials(content.profile.name)),
      h('span', { class: 'brand-name' }, content.profile.name)),
    // DOM order = visual order at every width (A5/A9): only the mobile menu button precedes the nav.
    h('div', { class: 'menu-wrap' }, menuBtn),
    nav,
    h('div', { class: 'header-tools' }, themeBtn, motionBtn));

  return { element, closeMenu: () => setOpen(false) };
}
