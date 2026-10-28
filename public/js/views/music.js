import { h } from '../lib/dom.js';
import { icon } from '../components/icons.js';
import { viewHeader, emptyState, navCopy } from './shared.js';

const PROVIDERS = {
  soundcloud: { name: 'SoundCloud', height: 166, host: 'soundcloud.com' },
  spotify: { name: 'Spotify', height: 152, host: 'spotify.com' },
  youtube: { name: 'YouTube', height: 0, host: 'youtube-nocookie.com' },
  bandcamp: { name: 'Bandcamp', height: 160, host: 'bandcamp.com' },
  apple: { name: 'Apple Music', height: 160, host: 'music.apple.com' },
};

function equalizer() {
  return h('span', { class: 'eq', 'aria-hidden': 'true' },
    h('span', null), h('span', null), h('span', null), h('span', null));
}

function embedFacade(track) {
  const provider = PROVIDERS[track.embed.provider] || { name: track.embed.provider, height: 160, host: '' };
  const slot = h('div', { class: 'embed-slot' });
  const btn = h('button', { type: 'button', class: 'btn btn-primary facade-btn' },
    icon('play'), h('span', null, `Load ${provider.name} player for ${track.title}`));
  const note = h('p', { class: 'facade-note' }, `Loads content from ${provider.host || provider.name}. Nothing is requested until you click.`);
  btn.addEventListener('click', () => {
    const iframe = h('iframe', {
      src: track.embed.src,
      title: `${track.title} — ${provider.name} player`,
      loading: 'lazy',
      allow: 'autoplay; encrypted-media; fullscreen; picture-in-picture',
      referrerpolicy: 'strict-origin-when-cross-origin',
      sandbox: 'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox',
      class: `embed-frame embed-${track.embed.provider}`,
    });
    if (provider.height) iframe.setAttribute('height', String(provider.height));
    slot.replaceChildren(provider.height ? iframe : h('div', { class: 'embed-video' }, iframe));
    slot.closest('.track-card')?.classList.add('is-loaded');
    iframe.focus();
  });
  slot.append(btn, note);
  return slot;
}

function trackCard(track, index) {
  const cover = track.cover
    ? h('img', { src: track.cover, alt: track.coverAlt, width: '600', height: '600', loading: 'lazy', decoding: 'async' })
    : h('span', { class: 'cover-fallback', 'aria-hidden': 'true' }, icon('music'));
  const player = track.type === 'audio'
    ? h('audio', { controls: true, preload: 'none', src: track.url, class: 'audio-player', 'aria-label': `Play ${track.title}` })
    : embedFacade(track);

  return h('article', { class: `card track-card tone-${(index % 5) + 1}`, 'aria-labelledby': `track-${track.id}-title` },
    h('div', { class: 'track-cover' }, cover, equalizer()),
    h('div', { class: 'track-body' },
      h('h2', { id: `track-${track.id}-title`, class: 'track-title' }, track.title),
      track.artist ? h('p', { class: 'track-artist' }, track.artist) : null,
      track.description ? h('p', { class: 'track-desc' }, track.description) : null,
      player));
}

export function render(content) {
  const copy = navCopy(content, 'music');
  const { tracks, intro } = content.music;
  // music.intro (the owner's own words) wins over the generic tab intro.
  const header = viewHeader('music', copy.label, copy.eyebrow, intro || copy.intro);
  if (!tracks.length) return h('div', { class: 'view-inner' }, header, emptyState());

  const list = h('ul', { class: 'track-list', 'data-stagger': '' },
    tracks.map((t, i) => h('li', { 'data-reveal': 'up' }, trackCard(t, i))));

  // Only one <audio> plays at a time; animate the equalizer of the playing track.
  list.addEventListener('play', (e) => {
    if (!(e.target instanceof HTMLMediaElement)) return;
    document.querySelectorAll('audio').forEach((a) => { if (a !== e.target && !a.paused) a.pause(); });
    e.target.closest('.track-card')?.classList.add('is-playing');
  }, true);
  const stop = (e) => {
    if (e.target instanceof HTMLMediaElement) e.target.closest('.track-card')?.classList.remove('is-playing');
  };
  list.addEventListener('pause', stop, true);
  list.addEventListener('ended', stop, true);

  return h('div', { class: 'view-inner' }, header, list);
}
