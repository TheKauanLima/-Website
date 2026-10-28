import { h } from '../lib/dom.js';
import { icon } from '../components/icons.js';
import { linkAttrs, newTabHint } from '../components/social-links.js';
import { viewHeader, navCopy } from './shared.js';

export function render(content) {
  const { about, profile } = content;

  const copy = navCopy(content, 'about');
  const header = viewHeader('about', about.heading, copy.eyebrow, copy.intro);

  const resume = profile.resumeUrl
    ? h('a', { ...linkAttrs(profile.resumeUrl), class: 'btn btn-primary' }, icon('resume'), h('span', null, 'Download résumé'), newTabHint(profile.resumeUrl))
    : null;

  const bio = h('div', { class: 'about-bio' },
    about.paragraphs.length
      ? about.paragraphs.map((p, i) => h('p', { class: i === 0 ? 'lede' : null, 'data-reveal': 'up' }, p))
      : h('p', { class: 'empty-state' }, 'Nothing here yet, check back soon.'),
    resume ? h('div', { class: 'about-actions', 'data-reveal': 'up' }, resume) : null);

  const side = h('aside', { class: 'about-side', 'aria-label': 'Profile summary' },
    h('div', { class: 'card profile-card', 'data-reveal': 'scale' },
      profile.avatar ? h('img', { class: 'profile-avatar', src: profile.avatar, alt: profile.avatarAlt, width: '512', height: '512', loading: 'lazy', decoding: 'async' }) : null,
      h('p', { class: 'profile-name' }, profile.name),
      profile.role ? h('p', { class: 'profile-role' }, profile.role) : null,
      profile.location ? h('p', { class: 'profile-location' }, icon('pin'), profile.location) : null,
      about.facts.length ? h('div', { class: 'facts' },
        h('h2', { class: 'facts-title' }, 'Quick facts'),
        h('ul', { class: 'facts-list' }, about.facts.map((f) => h('li', null, icon('sparkle'), h('span', null, f))))) : null));

  const skills = about.skills.length
    ? h('section', { class: 'about-section', 'aria-labelledby': 'about-skills-title' },
      h('h2', { id: 'about-skills-title', class: 'section-title', 'data-reveal': 'up' }, 'Skills'),
      h('div', { class: 'skills-grid', 'data-stagger': '' },
        about.skills.map((s) => h('div', { class: 'card skill-group', 'data-reveal': 'up' },
          h('h3', { class: 'skill-title' }, s.group),
          h('ul', { class: 'chip-list' }, s.items.map((it) => h('li', { class: 'chip chip-color' }, it)))))))
    : null;

  const timeline = about.timeline.length
    ? h('section', { class: 'about-section', 'aria-labelledby': 'about-timeline-title' },
      h('h2', { id: 'about-timeline-title', class: 'section-title', 'data-reveal': 'up' }, 'Experience'),
      h('ol', { class: 'timeline', 'data-stagger': '' },
        about.timeline.map((t) => h('li', { class: 'timeline-item', 'data-reveal': 'up' },
          h('span', { class: 'timeline-dot', 'aria-hidden': 'true' }),
          h('div', { class: 'card timeline-card' },
            t.period ? h('p', { class: 'timeline-period' }, t.period) : null,
            h('h3', { class: 'timeline-title' }, t.title),
            t.org ? h('p', { class: 'timeline-org' }, t.org) : null,
            t.description ? h('p', { class: 'timeline-desc' }, t.description) : null)))))
    : null;

  return h('div', { class: 'view-inner about' },
    header,
    h('div', { class: 'about-grid' }, bio, side),
    skills,
    timeline);
}
