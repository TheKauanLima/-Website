import fs from 'node:fs/promises';
import path from 'node:path';

export class StorageFullError extends Error {
  constructor(message = 'Message storage is full') {
    super(message);
    this.code = 'STORAGE_FULL';
  }
}

/**
 * Append-only NDJSON message store. Writes are serialized through a promise queue.
 * append(record) resolves when the line is on disk; rejects with StorageFullError
 * when the file is already >= maxBytes, or with the underlying fs error.
 */
export function createMessageStore(file, { maxBytes = 5242880 } = {}) {
  const target = path.resolve(file);
  let queue = Promise.resolve();

  async function write(record) {
    await fs.mkdir(path.dirname(target), { recursive: true });
    let size = 0;
    try {
      size = (await fs.stat(target)).size;
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    if (size >= maxBytes) throw new StorageFullError();
    // JSON.stringify escapes newlines, so one record is always exactly one line.
    await fs.appendFile(target, JSON.stringify(record) + '\n', 'utf8');
  }

  function append(record) {
    const result = queue.then(() => write(record));
    queue = result.catch(() => {});
    return result;
  }

  return { append, file: target };
}
