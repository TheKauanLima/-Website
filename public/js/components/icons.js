// Constant inline SVG icons. These trusted constants are the ONLY strings ever assigned to innerHTML.
// Never interpolate content into these strings.

const stroke = (body) =>
  `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
const solid = (body, viewBox = '0 0 24 24') =>
  `<svg viewBox="${viewBox}" width="1em" height="1em" fill="currentColor" aria-hidden="true" focusable="false">${body}</svg>`;

const ICONS = Object.freeze({
  github: solid('<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>', '0 0 16 16'),
  linkedin: solid('<path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.5 8h4v15h-4V8zm7.5 0h3.8v2.05h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V23h-4v-7.1c0-1.7-.03-3.88-2.37-3.88-2.37 0-2.73 1.85-2.73 3.76V23H8V8z"/>'),
  email: stroke('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>'),
  instagram: stroke('<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".5" fill="currentColor"/>'),
  soundcloud: stroke('<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>'),
  spotify: stroke('<circle cx="12" cy="12" r="10"/><path d="M7 9.5c3.5-1.2 7.5-.9 10.5.9M7.5 12.8c3-.9 6-.6 8.5.8M8 15.8c2.3-.6 4.5-.4 6.5.6"/>'),
  youtube: stroke('<path d="M2.5 17a24.1 24.1 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.6 49.6 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.1 24.1 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.6 49.6 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/>'),
  bandcamp: stroke('<path d="M2.5 18 8.5 6h13l-6 12z"/>'),
  x: stroke('<path d="M4 4l11.7 16H20L8.3 4H4zM4 20l6.8-6.8M13.2 10.8 20 4"/>'),
  bluesky: stroke('<path d="M12 11C10.5 8 7 5 4.5 4.5 3 4.2 3 6 3.3 8c.4 2.4 2.2 3.3 4.7 3-3.5.6-4 2.6-2 4.4 2.4 2.1 4.6-.4 6-3.4 1.4 3 3.6 5.5 6 3.4 2-1.8 1.5-3.8-2-4.4 2.5.3 4.3-.6 4.7-3 .3-2 .3-3.8-1.2-3.5C17 5 13.5 8 12 11z"/>'),
  mastodon: stroke('<path d="M8 3h8a5 5 0 0 1 5 5v5a5 5 0 0 1-5 5h-5l-4 3v-3.5A5 5 0 0 1 3 13V8a5 5 0 0 1 5-5z"/><path d="M8 13V9.5a1.5 1.5 0 0 1 3 0V12m0-2.5a1.5 1.5 0 0 1 3 0V13"/>'),
  behance: stroke('<path d="M3 6h5a3 3 0 0 1 0 6H3zM3 12h6a3 3 0 0 1 0 6H3zM14.5 7h6M14 14.5h7a3.5 3.5 0 1 0-1 2.5"/>'),
  dribbble: stroke('<circle cx="12" cy="12" r="10"/><path d="M19.1 5.1C15.2 9.1 10 10.4 2.3 10.9M21.8 12.8c-6.6-1.4-12.1 1-16.4 6.3M8.6 2.8c4.4 6 6 9.4 8 17.7"/>'),
  artstation: stroke('<path d="M2 17l2.5 4h13L15 17zM9.5 3h5L22 16l-2.5 4.5zM8.5 6 2.5 16h8.5l3-5z"/>'),
  website: stroke('<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'),
  resume: stroke('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>'),
  link: stroke('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),

  sun: stroke('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>'),
  moon: stroke('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
  pause: stroke('<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>'),
  play: stroke('<path d="M6 3l14 9-14 9V3z"/>'),
  menu: stroke('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  close: stroke('<path d="M18 6 6 18M6 6l12 12"/>'),
  'chevron-left': stroke('<path d="m15 18-6-6 6-6"/>'),
  'chevron-right': stroke('<path d="m9 18 6-6-6-6"/>'),
  'arrow-right': stroke('<path d="M5 12h14M12 5l7 7-7 7"/>'),
  external: stroke('<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'),
  copy: stroke('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  check: stroke('<path d="M20 6 9 17l-5-5"/>'),
  pin: stroke('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>'),
  expand: stroke('<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>'),
  music: stroke('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
  send: stroke('<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>'),
  sparkle: stroke('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"/>'),
  code: stroke('<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>'),
  palette: stroke('<circle cx="13.5" cy="6.5" r="1" fill="currentColor"/><circle cx="17.5" cy="10.5" r="1" fill="currentColor"/><circle cx="8.5" cy="7.5" r="1" fill="currentColor"/><circle cx="6.5" cy="12.5" r="1" fill="currentColor"/><path d="M12 2a10 10 0 0 0 0 20 2 2 0 0 0 2-2v-.5a2 2 0 0 1 2-2h1.5A4.5 4.5 0 0 0 22 13 11 10 0 0 0 12 2z"/>'),
  camera: stroke('<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>'),
  user: stroke('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  chat: stroke('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  home: stroke('<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>'),
});

/** Returns a <span class="icon"> containing the named icon (falls back to "link"). */
export function icon(name, className = '') {
  const span = document.createElement('span');
  span.className = className ? `icon ${className}` : 'icon';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = Object.prototype.hasOwnProperty.call(ICONS, name) ? ICONS[name] : ICONS.link;
  return span;
}
