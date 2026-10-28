import { h } from '../lib/dom.js';
import { icon } from './icons.js';

let ui = null;
let state = { items: [], index: 0, returnFocusEl: null };

function build() {
  const img = h('img', { class: 'lightbox-img', alt: '', decoding: 'async' });
  const caption = h('figcaption', { class: 'lightbox-caption' });
  const counter = h('p', { class: 'lightbox-counter', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const prev = h('button', { type: 'button', class: 'icon-btn lightbox-nav lightbox-prev', 'aria-label': 'Previous image' }, icon('chevron-left'));
  const next = h('button', { type: 'button', class: 'icon-btn lightbox-nav lightbox-next', 'aria-label': 'Next image' }, icon('chevron-right'));
  const close = h('button', { type: 'button', class: 'icon-btn lightbox-close', 'aria-label': 'Close' }, icon('close'));
  const figure = h('figure', { class: 'lightbox-figure' }, img, caption);
  const stage = h('div', { class: 'lightbox-stage' }, figure);
  const dialog = h('dialog', { class: 'lightbox', 'aria-label': 'Image viewer' },
    h('div', { class: 'lightbox-top' }, counter, close),
    stage, prev, next);

  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  close.addEventListener('click', () => dialog.close());

  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
  });

  // Backdrop / empty-area click closes (suppressed right after a swipe).
  let suppressClick = false;
  dialog.addEventListener('click', (e) => {
    if (suppressClick) { suppressClick = false; return; }
    if (e.target === dialog || e.target === stage || e.target === figure) dialog.close();
  });

  // Pointer swipe (50px horizontal threshold).
  let start = null;
  stage.addEventListener('pointerdown', (e) => {
    start = { x: e.clientX, y: e.clientY };
  });
  stage.addEventListener('pointerup', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy)) {
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 400);
      go(dx < 0 ? 1 : -1);
    }
  });
  stage.addEventListener('pointercancel', () => { start = null; });

  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('lightbox-open');
    const el = state.returnFocusEl;
    const visible = el && el.isConnected && (typeof el.checkVisibility !== 'function' || el.checkVisibility());
    if (visible) el.focus();
  });

  document.body.append(dialog);
  return { dialog, img, caption, counter, prev, next };
}

function preload(i) {
  const item = state.items[(i + state.items.length) % state.items.length];
  if (item) { const pre = new Image(); pre.decoding = 'async'; pre.src = item.src; }
}

function render() {
  const { items, index } = state;
  const item = items[index];
  ui.img.classList.remove('is-shown');
  void ui.img.offsetWidth;
  ui.img.src = item.src;
  ui.img.alt = item.alt;
  ui.img.classList.add('is-shown');
  ui.caption.textContent = item.caption || '';
  ui.caption.hidden = !item.caption;
  ui.counter.textContent = `${index + 1} / ${items.length}`;
  const multi = items.length > 1;
  ui.prev.hidden = !multi;
  ui.next.hidden = !multi;
  if (multi) { preload(index + 1); preload(index - 1); }
}

function go(delta) {
  if (state.items.length < 2) return;
  state.index = (state.index + delta + state.items.length) % state.items.length;
  render();
}

/** Closes the lightbox without restoring focus (used on route changes; the router focuses the new view). */
export function closeLightbox() {
  if (!ui || !ui.dialog.open) return;
  state.returnFocusEl = null;
  ui.dialog.close();
}

/** openLightbox(items [{src, alt, caption}], startIndex, returnFocusEl) */
export function openLightbox(items, startIndex = 0, returnFocusEl = document.activeElement) {
  if (!items.length) return;
  if (!ui) ui = build();
  state = { items, index: Math.min(Math.max(0, startIndex), items.length - 1), returnFocusEl };
  render();
  document.documentElement.classList.add('lightbox-open');
  if (!ui.dialog.open) ui.dialog.showModal();
}
