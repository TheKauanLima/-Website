import { h } from '../lib/dom.js';
import { safeHref } from '../lib/urls.js';
import { icon } from '../components/icons.js';
import { linkAttrs, newTabHint } from '../components/social-links.js';
import { viewHeader, emptyState, navCopy } from './shared.js';

function projectCard(p) {
  return h('article', { class: 'card project-card', 'aria-labelledby': `project-${p.id}-title` },
    p.image ? h('div', { class: 'card-media' },
      h('img', { src: p.image, alt: p.imageAlt, width: '1200', height: '750', loading: 'lazy', decoding: 'async' })) : null,
    h('div', { class: 'card-body' },
      h('h2', { id: `project-${p.id}-title`, class: 'card-title' }, p.title),
      p.year || p.role ? h('p', { class: 'card-meta' }, [p.year, p.role].filter(Boolean).join(' · ')) : null,
      p.summary ? h('p', { class: 'card-summary' }, p.summary) : null,
      p.description ? h('p', { class: 'card-desc' }, p.description) : null,
      p.tags.length ? h('ul', { class: 'chip-list', 'aria-label': 'Tags' }, p.tags.map((t) => h('li', { class: 'chip' }, t))) : null,
      p.links.length ? h('div', { class: 'card-actions' },
        p.links.map((l, i) => {
          const href = safeHref(l.url);
          return h('a', { ...linkAttrs(href), class: i === 0 ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm' },
            h('span', null, l.label), href.startsWith('http') ? icon('external') : null, newTabHint(href));
        })) : null));
}

export function render(content) {
  const { label, eyebrow, intro } = navCopy(content, 'projects');
  const { projects } = content;
  const header = viewHeader('projects', label, eyebrow, intro);
  if (!projects.length) return h('div', { class: 'view-inner' }, header, emptyState());

  const tags = [...new Set(projects.flatMap((p) => p.tags))];
  const count = h('p', { class: 'filter-count', 'aria-live': 'polite' });
  const items = projects.map((p) => ({ p, li: h('li', { 'data-reveal': 'up' }, projectCard(p)) }));
  const grid = h('ul', { class: 'card-grid projects-grid', 'data-stagger': '' }, items.map((x) => x.li));

  const setCount = (n) => { count.textContent = `Showing ${n} ${n === 1 ? 'project' : 'projects'}`; };
  setCount(projects.length);

  let toolbar = null;
  if (tags.length) {
    const buttons = [];
    const select = (tag, btn) => {
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      let shown = 0;
      items.forEach(({ p, li }) => {
        const match = tag === null || p.tags.includes(tag);
        li.hidden = !match;
        if (match) {
          shown += 1;
          li.classList.remove('pop-in');
          void li.offsetWidth;
          li.classList.add('pop-in');
          li.classList.add('is-visible');
        }
      });
      setCount(shown);
    };
    const mk = (text, tag) => {
      const b = h('button', { type: 'button', class: 'chip chip-btn', 'aria-pressed': String(tag === null) }, text);
      b.addEventListener('click', () => select(tag, b));
      buttons.push(b);
      return b;
    };
    toolbar = h('div', { class: 'filter-bar', 'data-reveal': 'fade' },
      h('div', { class: 'filter-chips', role: 'group', 'aria-label': 'Filter projects by tag' },
        mk('All', null), tags.map((t) => mk(t, t))),
      count);
  }

  return h('div', { class: 'view-inner' }, header, toolbar || count, grid);
}
