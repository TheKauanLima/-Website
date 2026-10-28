import { h } from '../lib/dom.js';
import { safeHref } from '../lib/urls.js';
import { icon } from '../components/icons.js';
import { renderSocialLinks } from '../components/social-links.js';
import { renderContactForm } from '../components/contact-form.js';
import { viewHeader, navCopy, emptyState } from './shared.js';

function copyEmail(email) {
  const status = h('span', { class: 'copy-status', role: 'status', 'aria-live': 'polite' });
  const label = h('span', null, 'Copy email');
  const btn = h('button', { type: 'button', class: 'btn btn-ghost btn-sm copy-btn' }, icon('copy'), label);
  let timer = 0;
  btn.addEventListener('click', async () => {
    clearTimeout(timer);
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(email);
      status.textContent = 'Copied!';
      btn.classList.add('is-copied');
    } catch {
      const target = btn.closest('.contact-card')?.querySelector('.contact-email-text');
      if (target) {
        const range = document.createRange();
        range.selectNodeContents(target);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
      status.textContent = 'Press Ctrl+C (or ⌘+C) to copy.';
    }
    timer = setTimeout(() => { status.textContent = ''; btn.classList.remove('is-copied'); }, 2500);
  });
  return [btn, status];
}

export function render(content, ctx = {}) {
  const { contact } = content;
  const mailto = contact.email ? safeHref(`mailto:${contact.email}`) : null;
  const showForm = !!(ctx.apiAvailable && contact.formEnabled);

  const copy = navCopy(content, 'contact');
  // contact.blurb (the owner's own words) wins over the generic tab intro.
  const header = viewHeader('contact', contact.heading, copy.eyebrow, contact.blurb || copy.intro);

  const socials = renderSocialLinks(content.links, { className: 'contact-social', label: 'Other ways to reach me' });

  const card = !mailto && !socials ? null : h('div', { class: 'card contact-card', 'data-reveal': 'up' },
    mailto ? h('div', { class: 'contact-email' },
      h('p', { class: 'contact-email-label' }, 'Email'),
      h('a', { href: mailto, class: 'contact-email-link' }, icon('email'), h('span', { class: 'contact-email-text' }, contact.email)),
      h('div', { class: 'contact-email-actions' },
        !showForm ? h('a', { href: `mailto:${contact.email}?subject=Hello%20from%20your%20portfolio`, class: 'btn btn-primary' }, icon('send'), h('span', null, 'Email me')) : null,
        copyEmail(contact.email))) : null,
    socials ? h('div', { class: 'contact-socials' }, h('p', { class: 'contact-email-label' }, 'Elsewhere'), socials) : null);

  let body;
  if (showForm) {
    const form = h('div', { 'data-reveal': 'up' }, renderContactForm(contact, ctx));
    body = card ? h('div', { class: 'contact-grid' }, card, form) : h('div', { class: 'contact-grid contact-grid-single' }, form);
  } else {
    body = card ? h('div', { class: 'contact-grid contact-grid-single' }, card) : emptyState();
  }

  return h('div', { class: 'view-inner contact' }, header, body);
}
