import { h, clear } from '../lib/dom.js';
import { icon } from './icons.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const len = (s) => [...s].length;

/** Mirrors server/lib/validate-contact.js (ARCHITECTURE §3.3), same messages. */
export function validateContactFields({ name, email, message }) {
  const clean = {
    name: String(name ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim(),
    email: String(email ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim(),
    message: String(message ?? '').replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim(),
  };
  const errors = {};
  if (!clean.name) errors.name = 'Name is required.';
  else if (len(clean.name) > 100) errors.name = 'Name must be at most 100 characters.';

  if (!clean.email) errors.email = 'Email is required.';
  else if (len(clean.email) > 254) errors.email = 'Email must be at most 254 characters.';
  else if (!EMAIL_RE.test(clean.email)) errors.email = 'Email address is invalid.';

  if (!clean.message) errors.message = 'Message is required.';
  else if (len(clean.message) < 10) errors.message = 'Message must be at least 10 characters.';
  else if (len(clean.message) > 5000) errors.message = 'Message must be at most 5000 characters.';

  return { ok: Object.keys(errors).length === 0, value: clean, errors };
}

const FIELDS = [
  { name: 'name', label: 'Name', hint: 'How should I address you?', autocomplete: 'name', type: 'text' },
  { name: 'email', label: 'Email', hint: "I'll reply to this address.", autocomplete: 'email', type: 'email' },
  { name: 'message', label: 'Message', hint: 'At least 10 characters. What role or project do you have in mind?', textarea: true },
];

/**
 * renderContactForm(contact, { apiAvailable }) → HTMLElement
 * Callers only render the form when the API is available (see views/contact.js), so the option is informational.
 */
export function renderContactForm(contact) {
  const controls = {};
  const msgs = {};
  let submitted = false;
  let sending = false;

  const fieldEls = FIELDS.map((f) => {
    const id = `cf-${f.name}`;
    const msgId = `${id}-msg`;
    const attrs = {
      id, name: f.name, class: 'field-input', required: true, 'aria-describedby': msgId,
      autocomplete: f.autocomplete || null,
    };
    const control = f.textarea
      // No maxlength: the server counts code points, so length limits are enforced by validation instead.
      ? h('textarea', { ...attrs, rows: '6' })
      : h('input', { ...attrs, type: f.type, spellcheck: f.name === 'email' ? 'false' : null });
    const msg = h('p', { id: msgId, class: 'field-msg' }, f.hint);
    controls[f.name] = control;
    msgs[f.name] = msg;
    control.addEventListener('blur', () => { if (submitted) showErrors(validateContactFields(values()).errors, false); });
    return h('div', { class: `field field-${f.name}` }, h('label', { for: id, class: 'field-label' }, f.label), control, msg);
  });

  const honeypot = h('div', { class: 'hp', 'aria-hidden': 'true' },
    h('label', { for: 'cf-website' }, 'Website (leave empty)'),
    h('input', { id: 'cf-website', name: 'website', type: 'text', tabindex: '-1', autocomplete: 'off' }));

  const btnLabel = h('span', null, 'Send message');
  const submit = h('button', { type: 'submit', class: 'btn btn-primary btn-send' }, icon('send'), btnLabel);
  const status = h('p', { class: 'form-status', role: 'status', 'aria-live': 'polite' });

  const form = h('form', { class: 'contact-form card', novalidate: true, 'aria-label': 'Contact form' },
    fieldEls, honeypot, h('div', { class: 'form-actions' }, submit), status);

  function values() {
    return {
      name: controls.name.value,
      email: controls.email.value,
      message: controls.message.value,
      website: form.elements.website.value,
    };
  }

  function showErrors(errors, focusFirst) {
    let first = null;
    for (const f of FIELDS) {
      const err = errors[f.name];
      if (err) {
        controls[f.name].setAttribute('aria-invalid', 'true');
        msgs[f.name].textContent = err;
        msgs[f.name].classList.add('is-error');
        first = first || controls[f.name];
      } else {
        controls[f.name].removeAttribute('aria-invalid');
        msgs[f.name].textContent = f.hint;
        msgs[f.name].classList.remove('is-error');
      }
    }
    if (focusFirst && first) first.focus();
    return first;
  }

  function setStatus(kind, ...children) {
    clear(status);
    status.className = `form-status${kind ? ` is-${kind}` : ''}`;
    status.append(...children.filter(Boolean));
  }

  function fallbackLink(v) {
    if (!contact.email) return null;
    const body = `${v.message}\n\n— ${v.name} (${v.email})`.slice(0, 1500);
    const href = `mailto:${contact.email}?subject=${encodeURIComponent('Hello from your portfolio')}&body=${encodeURIComponent(body)}`;
    return h('a', { href, class: 'status-link' }, 'Send it by email instead');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    submitted = true;
    const v = values();
    const result = validateContactFields(v);
    if (!result.ok) {
      showErrors(result.errors, true);
      setStatus('error', 'Please fix the highlighted fields.');
      return;
    }
    showErrors({}, false);

    sending = true;
    submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    btnLabel.textContent = 'Sending…';
    setStatus('', '');
    try {
      let res;
      try {
        res = await fetch('api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...result.value, website: v.website }),
        });
      } catch {
        res = null;
      }
      if (res && res.status === 201) {
        form.reset();
        submitted = false;
        showErrors({}, false);
        setStatus('success', icon('check'), ' Thanks! Your message was sent.');
      } else if (res && res.status === 422) {
        let details = {};
        try { details = (await res.json())?.error?.details || {}; } catch { /* ignore */ }
        const first = showErrors(details, true);
        setStatus('error', first ? 'Please fix the highlighted fields.' : "Couldn't send right now.");
      } else if (res && res.status === 429) {
        const secs = parseInt(res.headers.get('Retry-After') || '600', 10);
        const n = Math.max(1, Math.ceil((Number.isFinite(secs) ? secs : 600) / 60));
        setStatus('error', `Too many messages. Please try again in ${n} ${n === 1 ? 'minute' : 'minutes'}.`);
      } else {
        const link = fallbackLink(result.value);
        setStatus('error', "Couldn't send right now.", link ? ' ' : null, link);
      }
    } finally {
      sending = false;
      submit.disabled = false;
      form.removeAttribute('aria-busy');
      btnLabel.textContent = 'Send message';
    }
  });

  return form;
}
