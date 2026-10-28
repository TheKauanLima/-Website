// Validates the REAL public/data/content.json against the §2 schema.
// Skips while the frontend has not committed the file yet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isHttpsUrl, validateContent } from '../server/lib/content-schema.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const CONTENT_FILE = path.join(PUBLIC_DIR, 'data', 'content.json');
const present = fs.existsSync(CONTENT_FILE);

function loadContent() {
  return JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8').replace(/^﻿/, ''));
}

function format(list) {
  return list.map((e) => `  - ${e.path || '(root)'}: ${e.message}`).join('\n');
}

test('public/data/content.json is valid JSON and passes the schema', (t) => {
  if (!present) return t.skip('content.json not present yet');
  let data;
  assert.doesNotThrow(() => {
    data = loadContent();
  }, 'content.json must be valid JSON');
  const { errors, warnings } = validateContent(data);
  if (warnings.length) t.diagnostic(`warnings:\n${format(warnings)}`);
  assert.equal(errors.length, 0, `content.json has schema errors:\n${format(errors)}`);
});

test('every local media path in content.json exists under public/', (t) => {
  if (!present) return t.skip('content.json not present yet');
  const data = loadContent();
  const refs = [];
  const add = (where, value) => {
    if (typeof value === 'string' && value !== '' && !isHttpsUrl(value)) refs.push([where, value]);
  };
  add('profile.avatar', data.profile?.avatar);
  (data.projects ?? []).forEach((p, i) => add(`projects[${i}].image`, p?.image));
  (data.art ?? []).forEach((a, i) => add(`art[${i}].src`, a?.src));
  (data.pictures ?? []).forEach((p, i) => add(`pictures[${i}].src`, p?.src));
  (data.music?.tracks ?? []).forEach((tr, i) => {
    add(`music.tracks[${i}].cover`, tr?.cover);
    if (tr?.type === 'audio') add(`music.tracks[${i}].url`, tr?.url);
  });
  const missing = refs.filter(([, rel]) => !fs.existsSync(path.join(PUBLIC_DIR, ...rel.split('/'))));
  assert.deepEqual(missing, [], `missing media files:\n${missing.map(([w, r]) => `  - ${w}: ${r}`).join('\n')}`);
});

test('every placeholder is findable by searching for "YOUR"', (t) => {
  if (!present) return t.skip('content.json not present yet');
  const text = fs.readFileSync(CONTENT_FILE, 'utf8');
  assert.match(text, /YOUR[- ]/, 'placeholders use the YOUR- / YOUR marker');
});
