import { h } from '../lib/dom.js';
import { safeHref } from '../lib/urls.js';
import { icon } from '../components/icons.js';
import { renderSocialLinks, linkAttrs, newTabHint } from '../components/social-links.js';

function headline(text, name) {
  const at = name ? text.indexOf(name) : -1;
  if (at < 0) return [h('span', { class: 'gradient-text' }, text)];
  return [
    text.slice(0, at),
    h('span', { class: 'gradient-text' }, name),
    text.slice(at + name.length),
  ].filter(Boolean);
}

function roleLine(profile) {
  const role = profile.role || profile.roles[0];
  return role ? h('p', { class: 'hero-role' }, role) : null;
}

function ctaButton(cta, i) {
  const href = safeHref(cta.href);
  if (!href) return null;
  return h('a', { ...linkAttrs(href), class: i === 0 ? 'btn btn-primary' : 'btn btn-ghost' },
    h('span', null, cta.label), newTabHint(href));
}

function featuredCard(p, projectsInNav) {
  const inner = [
    p.image ? h('div', { class: 'card-media' },
      h('img', { src: p.image, alt: p.imageAlt, width: '1200', height: '750', loading: 'lazy', decoding: 'async' })) : null,
    h('div', { class: 'card-body' },
      h('h3', { class: 'card-title' }, p.title),
      p.year || p.role ? h('p', { class: 'card-meta' }, [p.year, p.role].filter(Boolean).join(' · ')) : null,
      p.summary ? h('p', { class: 'card-summary' }, p.summary) : null,
      p.tags.length ? h('ul', { class: 'chip-list', 'aria-label': 'Tags' }, p.tags.map((t) => h('li', { class: 'chip' }, t))) : null,
      projectsInNav ? h('span', { class: 'card-more', 'aria-hidden': 'true' }, 'View project') : null),
  ];
  return projectsInNav
    ? h('a', { class: 'card card-link project-card', href: '#projects' }, inner)
    : h('article', { class: 'card project-card' }, inner);
}

export function render(content) {
  const { profile, home, projects, nav } = content;
  const projectsInNav = nav.some((n) => n.id === 'projects');

  const heroSocials = renderSocialLinks(content.links, { heroOnly: true, className: 'hero-social', label: 'Find me online' });

  const visual = h('div', { class: 'hero-visual', 'data-reveal': 'scale' },
    h('div', { class: 'avatar-wrap' },
      profile.avatar
        ? h('img', { class: 'avatar', src: profile.avatar, alt: profile.avatarAlt, width: '512', height: '512', decoding: 'async' })
        : h('span', { class: 'avatar avatar-fallback', 'aria-hidden': 'true' }, profile.name.slice(0, 1))),
    profile.availability ? h('p', { class: 'badge badge-available' }, h('span', { class: 'pulse-dot', 'aria-hidden': 'true' }), profile.availability) : null,
    profile.location ? h('p', { class: 'hero-location' }, icon('pin'), profile.location) : null);

  const hero = h('div', { class: 'hero' },
    h('div', { class: 'hero-text' },
      h('h1', { id: 'view-home-title', tabindex: '-1', class: 'hero-title' }, headline(home.headline, profile.name)),
      roleLine(profile),
      profile.tagline ? h('p', { class: 'hero-tagline', 'data-reveal': 'up' }, profile.tagline) : null,
      home.intro ? h('p', { class: 'hero-intro', 'data-reveal': 'up' }, home.intro) : null,
      home.cta.length ? h('div', { class: 'hero-cta', 'data-reveal': 'up' }, home.cta.map(ctaButton)) : null,
      heroSocials ? h('div', { 'data-reveal': 'fade' }, heroSocials) : null),
    visual);

  // featuredProjectIds absent (null) → fall back to featured:true, then the first two. [] → no featured section.
  let featured;
  if (Array.isArray(home.featuredProjectIds)) {
    featured = home.featuredProjectIds.map((id) => projects.find((p) => p.id === id)).filter(Boolean);
  } else {
    featured = projects.filter((p) => p.featured);
    if (!featured.length) featured = projects.slice(0, 2);
  }

  const featuredSection = featured.length
    ? h('section', { class: 'home-section', 'aria-labelledby': 'home-featured-title' },
      h('div', { class: 'section-head', 'data-reveal': 'up' },
        h('p', { class: 'eyebrow' }, 'Selected work'),
        h('h2', { id: 'home-featured-title', class: 'section-title' }, 'Featured projects'),
        projectsInNav ? h('a', { href: '#projects', class: 'text-link' }, 'All projects') : null),
      h('ul', { class: `card-grid featured-grid count-${Math.min(featured.length, 3)}`, 'data-stagger': '' },
        featured.map((p) => h('li', { 'data-reveal': 'up' }, featuredCard(p, projectsInNav)))))
    : null;

  return h('div', { class: 'view-inner home' }, hero, featuredSection);
}
