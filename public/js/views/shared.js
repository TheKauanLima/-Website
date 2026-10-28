// Small helpers shared by the view modules.
import { h } from '../lib/dom.js';

/** Default per-tab copy, used when a nav entry has no eyebrow/intro (ARCHITECTURE A7). */
export const DEFAULT_COPY = Object.freeze({
  projects: { eyebrow: 'Work', intro: 'A selection of things I have built: the problem, what I did and how it turned out.' },
  art: { eyebrow: 'Visual work', intro: 'Pieces I have made. Select any artwork to view it full size.' },
  music: { eyebrow: 'Sound', intro: 'Tracks, sketches and sounds.' },
  pictures: { eyebrow: 'Photography', intro: 'Moments and places through my lens. Select a photo to view it full size.' },
  about: { eyebrow: 'About', intro: 'My story, skills and experience.' },
  contact: { eyebrow: 'Contact', intro: 'Hiring or collaborating? Say hello.' },
});

/** navCopy(content, id) → { label, eyebrow, intro } with defaults applied. */
export function navCopy(content, id) {
  const entry = content.nav.find((n) => n.id === id) || {};
  const def = DEFAULT_COPY[id] || { eyebrow: '', intro: '' };
  const fallbackLabel = id.charAt(0).toUpperCase() + id.slice(1);
  return {
    label: entry.label || fallbackLabel,
    eyebrow: entry.eyebrow || def.eyebrow,
    intro: entry.intro || def.intro,
  };
}

/** Standard view header; the h1 is the first heading in the view and receives focus on navigation. */
export function viewHeader(id, title, eyebrow, lede) {
  return h('header', { class: 'view-header' },
    h('h1', { id: `view-${id}-title`, tabindex: '-1', class: 'view-title' },
      h('span', { class: 'gradient-text' }, title)),
    eyebrow ? h('p', { class: 'eyebrow' }, eyebrow) : null,
    lede ? h('p', { class: 'view-lede' }, lede) : null);
}

export function emptyState() {
  return h('p', { class: 'empty-state card' }, 'Nothing here yet, check back soon.');
}
