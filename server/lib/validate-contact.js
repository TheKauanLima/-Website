import { isPlainObject } from './util.js';

export const LIMITS = Object.freeze({
  nameMax: 100,
  emailMax: 254,
  messageMin: 10,
  messageMax: 5000,
});

export const MESSAGES = Object.freeze({
  nameRequired: 'Name is required.',
  nameTooLong: 'Name must be at most 100 characters.',
  emailRequired: 'Email is required.',
  emailInvalid: 'Email address is invalid.',
  emailTooLong: 'Email must be at most 254 characters.',
  messageRequired: 'Message is required.',
  messageTooShort: 'Message must be at least 10 characters.',
  messageTooLong: 'Message must be at most 5000 characters.',
});

/** Shared email pattern (contact API, content.json contact.email, frontend form). */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// eslint-disable-next-line no-control-regex
const LINE_CONTROL_RE = /[\u0000-\u001F\u007F]/g;
// eslint-disable-next-line no-control-regex
const MESSAGE_CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const codePoints = (s) => [...s].length;

export function sanitizeLine(value) {
  return typeof value === 'string' ? value.replace(LINE_CONTROL_RE, '').trim() : undefined;
}

export function sanitizeMessage(value) {
  return typeof value === 'string'
    ? value.replace(/\r\n/g, '\n').replace(MESSAGE_CONTROL_RE, '').trim()
    : undefined;
}

/**
 * Validate a parsed contact body (a plain object).
 * Returns { ok, value: {name, email, message}, details }.
 * details is keyed by field and uses the exact §3.3 strings. Unknown fields are ignored.
 */
export function validateContact(body) {
  const input = isPlainObject(body) ? body : {};
  const details = {};

  const name = sanitizeLine(input.name);
  if (!name) details.name = MESSAGES.nameRequired;
  else if (codePoints(name) > LIMITS.nameMax) details.name = MESSAGES.nameTooLong;

  const email = sanitizeLine(input.email);
  if (!email) details.email = MESSAGES.emailRequired;
  else if (codePoints(email) > LIMITS.emailMax) details.email = MESSAGES.emailTooLong;
  else if (!EMAIL_RE.test(email)) details.email = MESSAGES.emailInvalid;

  const message = sanitizeMessage(input.message);
  if (!message) details.message = MESSAGES.messageRequired;
  else if (codePoints(message) < LIMITS.messageMin) details.message = MESSAGES.messageTooShort;
  else if (codePoints(message) > LIMITS.messageMax) details.message = MESSAGES.messageTooLong;

  const ok = Object.keys(details).length === 0;
  return {
    ok,
    value: ok ? { name, email, message } : null,
    details,
  };
}

/** Honeypot: a non-empty `website` string means a bot. */
export function isHoneypotFilled(body) {
  return !!body && typeof body.website === 'string' && body.website.length > 0;
}
