// Tiny element builder. Content is always inserted as text, never as HTML.

/**
 * h('a', { href: '#x', class: 'btn', onclick: fn }, 'text', childNode, [more], null)
 * - string/number children become text nodes; null/undefined/false are skipped; arrays are flattened
 * - attribute values of false/null/undefined are skipped; true sets an empty attribute
 * - keys starting with "on" attach event listeners
 * - the "style" key is forbidden (CSP): use el.style.setProperty() instead
 */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'style') throw new Error('h(): the "style" attribute is forbidden; use el.style.setProperty()');
      if (value === false || value === null || value === undefined) continue;
      if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else {
        el.setAttribute(key, value === true ? '' : String(value));
      }
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(el, child);
    else if (child instanceof Node) el.append(child);
    else el.append(document.createTextNode(String(child)));
  }
}

/** Removes all children of el. */
export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}
