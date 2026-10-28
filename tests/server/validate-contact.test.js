import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isHoneypotFilled,
  sanitizeLine,
  sanitizeMessage,
  validateContact,
} from '../../server/lib/validate-contact.js';

const VALID = { name: 'Ada', email: 'ada@example.com', message: 'Hello there, friend.' };

describe('validateContact', () => {
  test('accepts a valid body and returns sanitized values', () => {
    const r = validateContact({ ...VALID, name: ' Ada\u0000 ', extra: 1 });
    assert.equal(r.ok, true);
    assert.deepEqual(r.details, {});
    assert.deepEqual(r.value, { name: 'Ada', email: 'ada@example.com', message: 'Hello there, friend.' });
  });

  test('required messages', () => {
    assert.deepEqual(validateContact({}).details, {
      name: 'Name is required.',
      email: 'Email is required.',
      message: 'Message is required.',
    });
    assert.deepEqual(validateContact({ name: null, email: 5, message: false }).details, {
      name: 'Name is required.',
      email: 'Email is required.',
      message: 'Message is required.',
    });
  });

  test('name length', () => {
    assert.equal(validateContact({ ...VALID, name: 'a'.repeat(100) }).ok, true);
    assert.deepEqual(validateContact({ ...VALID, name: 'a'.repeat(101) }).details, {
      name: 'Name must be at most 100 characters.',
    });
  });

  test('email format and length', () => {
    for (const email of ['plain', 'a@b', '@b.co', 'a@.co', 'a b@c.de', 'a@b c.de', 'a@@b.co']) {
      assert.deepEqual(validateContact({ ...VALID, email }).details, { email: 'Email address is invalid.' }, email);
    }
    for (const email of ['a@b.co', 'first.last+tag@sub.example.org']) {
      assert.equal(validateContact({ ...VALID, email }).ok, true, email);
    }
    const long = 'a'.repeat(243) + '@example.com'; // 255
    assert.deepEqual(validateContact({ ...VALID, email: long }).details, { email: 'Email must be at most 254 characters.' });
  });

  test('message length in code points after sanitizing', () => {
    assert.deepEqual(validateContact({ ...VALID, message: '123456789' }).details, {
      message: 'Message must be at least 10 characters.',
    });
    // Control chars do not count toward the minimum.
    assert.deepEqual(validateContact({ ...VALID, message: '123456789\u0000' }).details, {
      message: 'Message must be at least 10 characters.',
    });
    assert.equal(validateContact({ ...VALID, message: '\u{1F389}'.repeat(10) }).ok, true);
    assert.equal(validateContact({ ...VALID, message: 'm'.repeat(5000) }).ok, true);
    assert.deepEqual(validateContact({ ...VALID, message: 'm'.repeat(5001) }).details, {
      message: 'Message must be at most 5000 characters.',
    });
  });

  test('non-object input fails cleanly', () => {
    for (const input of [null, undefined, [], 'x', 1]) {
      assert.equal(validateContact(input).ok, false);
    }
  });
});

describe('sanitizers', () => {
  test('sanitizeLine strips all C0 controls and DEL, then trims', () => {
    assert.equal(sanitizeLine(' a\u0000b\u001Fc\u007Fd\te\nf '), 'abcdef');
    assert.equal(sanitizeLine(5), undefined);
  });

  test('sanitizeMessage keeps tab/newline/CR, normalizes CRLF, strips others', () => {
    assert.equal(sanitizeMessage('a\r\nb\tc\u0000\u0008\u000B\u000C\u000E\u001F\u007Fd'), 'a\nb\tcd');
    assert.equal(sanitizeMessage('a\rb'), 'a\rb');
    assert.equal(sanitizeMessage('  x  '), 'x');
  });
});

describe('isHoneypotFilled', () => {
  test('only a non-empty string counts', () => {
    assert.equal(isHoneypotFilled({ website: 'x' }), true);
    assert.equal(isHoneypotFilled({ website: '' }), false);
    assert.equal(isHoneypotFilled({}), false);
    assert.equal(isHoneypotFilled({ website: 1 }), false);
  });
});
