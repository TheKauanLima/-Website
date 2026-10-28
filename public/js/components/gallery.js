import { h } from '../lib/dom.js';
import { openLightbox } from './lightbox.js';
import { icon } from './icons.js';

/**
 * renderGallery(items, { label }) → HTMLElement
 * items: [{ src, alt, title?, caption?, meta?, width?, height? }]
 */
export function renderGallery(items, { label = 'Gallery' } = {}) {
  const lightboxItems = items.map((it) => ({
    src: it.src,
    alt: it.alt,
    caption: [it.title, it.caption, it.meta].filter(Boolean).join(' · '),
  }));

  const list = h('ul', { class: 'gallery', 'aria-label': label, 'data-stagger': '' });
  items.forEach((it, index) => {
    const w = it.width || 1200;
    const hgt = it.height || 1200;
    const img = h('img', { src: it.src, alt: it.alt, width: w, height: hgt, loading: 'lazy', decoding: 'async' });
    const heading = it.title || it.caption;
    const sub = it.title ? it.caption || it.meta : it.meta;
    const btn = h('button', { type: 'button', class: 'gallery-item', 'aria-haspopup': 'dialog' },
      h('span', { class: 'gallery-frame' }, img, h('span', { class: 'gallery-zoom' }, icon('expand'))),
      heading || sub
        ? h('span', { class: 'gallery-caption' },
          heading ? h('span', { class: 'gallery-title' }, heading) : null,
          sub ? h('span', { class: 'gallery-meta' }, sub) : null)
        : null);
    btn.addEventListener('click', () => openLightbox(lightboxItems, index, btn));
    const li = h('li', { class: 'gallery-cell', 'data-reveal': 'scale' }, btn);
    li.style.setProperty('--ar', String(w / hgt));
    list.append(li);
  });
  return list;
}
