// Hash router: lazily mounts views, toggles visibility, updates aria-current/title and manages focus.
import { h } from './lib/dom.js';
import { observeReveals, isReducedMotion } from './lib/motion.js';

/**
 * createRouter({ routes: Map<id, {label, render}>, defaultRoute, container, siteTitle, beforeRoute, onRoute })
 * → { start(), navigate(id) }
 */
export function createRouter({ routes, defaultRoute, container, siteTitle = document.title, beforeRoute, onRoute }) {
  const mounted = new Map();
  let current = null;
  let enterTimer = 0;

  function parse() {
    let raw = location.hash.slice(1);
    try { raw = decodeURIComponent(raw); } catch { /* keep raw */ }
    return raw.toLowerCase();
  }

  function mount(id) {
    if (mounted.has(id)) return mounted.get(id);
    const section = h('section', { id: `view-${id}`, class: 'view', 'aria-labelledby': `view-${id}-title`, hidden: true });
    try {
      section.append(routes.get(id).render());
    } catch (err) {
      console.error(err);
      section.append(
        h('div', { class: 'view-inner' },
          h('h1', { id: `view-${id}-title`, tabindex: '-1', class: 'view-title' }, routes.get(id).label),
          h('p', { class: 'empty-state' }, 'This section could not be displayed.')),
      );
    }
    container.append(section);
    mounted.set(id, section);
    return section;
  }

  function show(id, initial) {
    const section = mount(id);
    for (const [otherId, el] of mounted) el.hidden = otherId !== id;

    clearTimeout(enterTimer);
    section.classList.remove('view-enter');
    if (!isReducedMotion() && !initial) {
      void section.offsetWidth; // restart the animation
      section.classList.add('view-enter');
      enterTimer = setTimeout(() => section.classList.remove('view-enter'), 400);
    }
    observeReveals(section);

    document.querySelectorAll('[data-route]').forEach((a) => {
      if (a.getAttribute('data-route') === id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });

    const { label } = routes.get(id);
    document.title = id === defaultRoute ? siteTitle : `${label} · ${siteTitle}`;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    if (!initial) {
      const heading = section.querySelector(`#view-${id}-title`);
      if (heading) heading.focus({ preventScroll: true });
    }
    current = id;
    if (onRoute) onRoute(id);
  }

  function route(initial = false) {
    if (beforeRoute) beforeRoute();
    let id = parse();
    if (!id) id = defaultRoute;
    else if (!routes.has(id)) {
      history.replaceState(null, '', `#${defaultRoute}`);
      id = defaultRoute;
    }
    if (id === current && !initial) {
      // Same route chosen again (e.g. from the mobile menu): keep the view, but reset scroll and focus.
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      const heading = mounted.get(id)?.querySelector(`#view-${id}-title`);
      if (heading) heading.focus({ preventScroll: true });
      if (onRoute) onRoute(id);
      return;
    }
    show(id, initial);
  }

  return {
    start() {
      window.addEventListener('hashchange', () => route(false));
      route(true);
    },
    navigate(id) {
      if (!routes.has(id)) id = defaultRoute;
      if (location.hash === `#${id}`) route(false);
      else location.hash = id;
    },
  };
}
