import { h } from '../lib/dom.js';
import { safeHref, isExternalHref } from '../lib/urls.js';
import { icon } from './icons.js';

/** Anchor attributes + trailing hint for a (possibly external) link. */
export function linkAttrs(href) {
  return isExternalHref(href) ? { href, target: '_blank', rel: 'noopener noreferrer' } : { href };
}

export function newTabHint(href) {
  return isExternalHref(href) ? h('span', { class: 'visually-hidden' }, ' (opens in new tab)') : null;
}

/**
 * renderSocialLinks(links, { heroOnly, className, label }) → <ul> of icon + label anchors, or null if empty.
 */
export function renderSocialLinks(links, { heroOnly = false, className = '', label = 'Social links' } = {}) {
  const items = links.filter((l) => (!heroOnly || l.showInHero) && safeHref(l.url));
  if (!items.length) return null;
  return h('ul', { class: `social-links ${className}`.trim(), 'aria-label': label },
    items.map((l) => {
      const href = safeHref(l.url);
      return h('li', null,
        h('a', { ...linkAttrs(href), class: `social-link social-${l.icon}` },
          icon(l.icon),
          h('span', { class: 'social-label' }, l.label),
          newTabHint(href)));
    }));
}
