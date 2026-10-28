/** True for a non-null, non-array object (what JSON.parse gives for `{…}`). */
export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
