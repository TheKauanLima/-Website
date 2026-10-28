import { h } from '../lib/dom.js';
import { renderGallery } from '../components/gallery.js';
import { viewHeader, emptyState, navCopy } from './shared.js';

export function render(content) {
  const { label, eyebrow, intro } = navCopy(content, 'pictures');
  const header = viewHeader('pictures', label, eyebrow, intro);
  if (!content.pictures.length) return h('div', { class: 'view-inner' }, header, emptyState());
  const items = content.pictures.map((p) => ({
    src: p.src, alt: p.alt, title: p.title, caption: p.caption,
    meta: [p.location, p.date].filter(Boolean).join(' · '),
    width: p.width, height: p.height,
  }));
  return h('div', { class: 'view-inner' }, header, renderGallery(items, { label: `${label} gallery` }));
}
