import { h } from '../lib/dom.js';
import { renderGallery } from '../components/gallery.js';
import { viewHeader, emptyState, navCopy } from './shared.js';

export function render(content) {
  const { label, eyebrow, intro } = navCopy(content, 'art');
  const header = viewHeader('art', label, eyebrow, intro);
  if (!content.art.length) return h('div', { class: 'view-inner' }, header, emptyState());
  const items = content.art.map((a) => ({
    src: a.src, alt: a.alt, title: a.title, caption: a.caption,
    meta: [a.year, a.medium].filter(Boolean).join(' · '),
    width: a.width, height: a.height,
  }));
  return h('div', { class: 'view-inner' }, header, renderGallery(items, { label: `${label} gallery` }));
}
