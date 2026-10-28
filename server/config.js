import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute path of the project root (the folder that contains server/). */
export const PROJECT_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

export const DEFAULTS = Object.freeze({
  PORT: 3000,
  HOST: '127.0.0.1',
  PUBLIC_DIR: 'public',
  CONTENT_FILE: 'public/data/content.json',
  MESSAGES_FILE: 'data/messages.ndjson',
  MESSAGES_MAX_BYTES: 5242880,
  RATE_LIMIT_MAX: 5,
  RATE_LIMIT_WINDOW_MS: 600000,
  TRUST_PROXY: false,
});

function readString(env, name) {
  const raw = env[name];
  if (raw === undefined || raw === null) return undefined;
  const value = String(raw).trim();
  return value === '' ? undefined : value;
}

function readInt(env, name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = readString(env, name);
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`Invalid ${name}: "${raw}" (expected an integer between ${min} and ${max})`);
  }
  return n;
}

function readPath(env, name, fallback, root) {
  return path.resolve(root, readString(env, name) ?? fallback);
}

function readBool(env, name, fallback) {
  const raw = readString(env, name);
  if (raw === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

/**
 * Build the server configuration from environment variables.
 * Relative paths resolve against the project root, never the current working directory.
 */
export function loadConfig(env = process.env, { root = PROJECT_ROOT } = {}) {
  return {
    projectRoot: root,
    port: readInt(env, 'PORT', DEFAULTS.PORT, { min: 0, max: 65535 }),
    host: readString(env, 'HOST') ?? DEFAULTS.HOST,
    publicDir: readPath(env, 'PUBLIC_DIR', DEFAULTS.PUBLIC_DIR, root),
    contentFile: readPath(env, 'CONTENT_FILE', DEFAULTS.CONTENT_FILE, root),
    messagesFile: readPath(env, 'MESSAGES_FILE', DEFAULTS.MESSAGES_FILE, root),
    messagesMaxBytes: readInt(env, 'MESSAGES_MAX_BYTES', DEFAULTS.MESSAGES_MAX_BYTES, { min: 1 }),
    rateLimit: {
      max: readInt(env, 'RATE_LIMIT_MAX', DEFAULTS.RATE_LIMIT_MAX, { min: 1 }),
      windowMs: readInt(env, 'RATE_LIMIT_WINDOW_MS', DEFAULTS.RATE_LIMIT_WINDOW_MS, { min: 1 }),
    },
    trustProxy: readBool(env, 'TRUST_PROXY', DEFAULTS.TRUST_PROXY),
  };
}
