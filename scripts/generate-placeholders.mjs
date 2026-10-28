#!/usr/bin/env node
// Writes every placeholder SVG and sample-tone.wav into public/media. Zero dependencies, deterministic, idempotent.
// Usage: node scripts/generate-placeholders.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MEDIA = join(ROOT, 'public', 'media');

const BRAND = ['#12b4e9', '#5fd0f3', '#0d8fbd', '#9fe3f8', '#0a6a8f'];

// Seeded PRNG (mulberry32) so every run produces identical files.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// HSL → #rrggbb (hex keeps the SVGs compatible with every renderer).
function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const r1 = (n) => Math.round(n * 10) / 10;

function write(rel, data) {
  const file = join(MEDIA, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  return rel;
}

function frame({ w, h, seed, title, label, decor }) {
  const rand = rng(seed * 7919 + 17);
  const hue = 190 + (seed * 7) % 18;
  const stops = [hsl(hue, 80, 50), hsl(hue + 6, 75, 36), hsl(hue + 12, 70, 20)];
  const circles = [];
  const n = 3 + (seed % 3);
  for (let i = 0; i < n; i++) {
    const cx = r1(rand() * w);
    const cy = r1(rand() * h);
    const r = r1((0.15 + rand() * 0.3) * Math.min(w, h));
    const fill = BRAND[(seed + i) % BRAND.length];
    circles.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="${r1(0.25 + rand() * 0.3)}"/>`);
  }
  const fs = Math.round(Math.min(w, h) * 0.065);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="t">
<title id="t">${esc(title)}</title>
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${stops[0]}"/><stop offset=".55" stop-color="${stops[1]}"/><stop offset="1" stop-color="${stops[2]}"/>
</linearGradient>
<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${Math.round(Math.min(w, h) / 40)}"/></filter>
</defs>
<rect width="${w}" height="${h}" fill="url(#bg)"/>
<g filter="url(#soft)">${circles.join('')}</g>
${decor ? decor(rand, w, h) : ''}
<g font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" text-anchor="middle">
<rect x="${Math.round(w / 2 - fs * 5.2)}" y="${Math.round(h / 2 - fs * 1.1)}" width="${Math.round(fs * 10.4)}" height="${Math.round(fs * 2.2)}" rx="${Math.round(fs * 1.1)}" fill="#0b0b1a" opacity=".55"/>
<text x="${w / 2}" y="${Math.round(h / 2 + fs * 0.35)}" font-size="${fs}" font-weight="800" fill="#ffffff">${esc(label)}</text>
</g>
</svg>
`;
}

const decorProject = (rand, w, h) => {
  // A stylised browser window.
  const x = w * 0.1, y = h * 0.12, ww = w * 0.8, hh = h * 0.76;
  const bars = [0.3, 0.55, 0.42, 0.7].map((f, i) =>
    `<rect x="${r1(x + ww * 0.06)}" y="${r1(y + hh * (0.62 + i * 0.08))}" width="${r1(ww * f * 0.6)}" height="${r1(hh * 0.035)}" rx="6" fill="#ffffff" opacity=".35"/>`).join('');
  return `<g><rect x="${x}" y="${y}" width="${ww}" height="${hh}" rx="24" fill="#0b0b1a" opacity=".28"/>
<rect x="${x}" y="${y}" width="${ww}" height="${r1(hh * 0.09)}" rx="24" fill="#0b0b1a" opacity=".35"/>
<circle cx="${r1(x + 34)}" cy="${r1(y + hh * 0.045)}" r="9" fill="#12b4e9"/><circle cx="${r1(x + 62)}" cy="${r1(y + hh * 0.045)}" r="9" fill="#5fd0f3"/><circle cx="${r1(x + 90)}" cy="${r1(y + hh * 0.045)}" r="9" fill="#9fe3f8"/>
${bars}</g>`;
};

const decorArt = (rand, w, h) => {
  const shapes = [];
  for (let i = 0; i < 5; i++) {
    const cx = r1(rand() * w), cy = r1(rand() * h), s = r1((0.08 + rand() * 0.14) * Math.min(w, h));
    const c = BRAND[i % BRAND.length];
    if (i % 2) shapes.push(`<rect x="${r1(cx - s / 2)}" y="${r1(cy - s / 2)}" width="${s}" height="${s}" rx="${r1(s * 0.2)}" transform="rotate(${Math.round(rand() * 90)} ${cx} ${cy})" fill="none" stroke="${c}" stroke-width="${r1(s * 0.08)}" opacity=".85"/>`);
    else shapes.push(`<circle cx="${cx}" cy="${cy}" r="${r1(s / 2)}" fill="none" stroke="#ffffff" stroke-width="${r1(s * 0.06)}" opacity=".6"/>`);
  }
  const wave = `<path d="M0 ${r1(h * 0.78)} C ${r1(w * 0.25)} ${r1(h * 0.62)}, ${r1(w * 0.5)} ${r1(h * 0.94)}, ${w} ${r1(h * 0.72)} L ${w} ${h} L 0 ${h} Z" fill="#0b0b1a" opacity=".22"/>`;
  return `<g>${wave}${shapes.join('')}</g>`;
};

const decorPicture = (rand, w, h) => {
  const sunR = r1(Math.min(w, h) * 0.1);
  const peaks = (base, amp, count, opacity) => {
    let d = `M0 ${h} L0 ${r1(h * base)}`;
    for (let i = 1; i <= count; i++) {
      const x = r1((w / count) * i);
      const y = r1(h * base - rand() * h * amp);
      d += ` L${r1(x - w / count / 2)} ${y} L${x} ${r1(h * base)}`;
    }
    return `<path d="${d} L${w} ${h} Z" fill="#0b0b1a" opacity="${opacity}"/>`;
  };
  return `<g><circle cx="${r1(w * 0.72)}" cy="${r1(h * 0.3)}" r="${sunR}" fill="#9fe3f8" opacity=".85"/>
${peaks(0.72, 0.25, 5, 0.25)}${peaks(0.85, 0.18, 7, 0.4)}</g>`;
};

const decorCover = (rand, w, h) => {
  const rings = [0.42, 0.32, 0.22].map((f, i) =>
    `<circle cx="${w / 2}" cy="${h / 2}" r="${r1(w * f)}" fill="none" stroke="#0b0b1a" stroke-width="${i === 0 ? 10 : 4}" opacity="${0.3 - i * 0.05}"/>`).join('');
  return `<g>${rings}<circle cx="${w / 2}" cy="${h / 2}" r="${r1(w * 0.06)}" fill="#0b0b1a" opacity=".5"/></g>`;
};

const decorAvatar = (rand, w, h) =>
  `<g fill="#0b0b1a" opacity=".32"><circle cx="${w / 2}" cy="${r1(h * 0.4)}" r="${r1(w * 0.17)}"/><path d="M${r1(w * 0.18)} ${h} a${r1(w * 0.32)} ${r1(h * 0.3)} 0 0 1 ${r1(w * 0.64)} 0 Z"/></g>`;

function avatarSvg() {
  const w = 512, h = 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="t">
<title id="t">Avatar placeholder: replace me</title>
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#12b4e9"/><stop offset="1" stop-color="#0a4f6e"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#bg)"/>
<circle cx="400" cy="110" r="70" fill="#9fe3f8" opacity=".3"/><circle cx="90" cy="420" r="110" fill="#5fd0f3" opacity=".25"/>
${decorAvatar(null, w, h)}
<rect x="86" y="378" width="340" height="92" rx="46" fill="#0b0b1a" opacity=".6"/>
<text x="256" y="442" text-anchor="middle" font-family="system-ui, sans-serif" font-size="60" font-weight="900" fill="#ffffff">replace me</text>
</svg>
`;
}

// WAV: 3 s, 22050 Hz, mono, 16-bit PCM, A-major chord with 0.3 s fade in/out.
function toneWav() {
  const rate = 22050, seconds = 3, n = rate * seconds, fade = 0.3 * rate;
  const freqs = [440, 554.37, 659.25];
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    let v = 0;
    for (const f of freqs) v += Math.sin(2 * Math.PI * f * t);
    v = (v / freqs.length) * 0.6;
    const env = Math.min(1, i / fade, (n - 1 - i) / fade);
    data.writeInt16LE(Math.round(v * env * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const written = [];
written.push(write('avatar.svg', avatarSvg()));

for (let i = 1; i <= 3; i++) {
  written.push(write(`projects/project-${i}.svg`, frame({
    w: 1200, h: 750, seed: i, title: `Project ${i} placeholder: replace me`, label: `Project ${i} · replace me`, decor: decorProject,
  })));
}

const ART_SIZES = [[1200, 1500], [1500, 1200], [1200, 1200], [1200, 1500], [1500, 1200], [1200, 1200]];
ART_SIZES.forEach(([w, h], idx) => {
  const i = idx + 1;
  written.push(write(`art/art-${i}.svg`, frame({
    w, h, seed: 10 + i, title: `Art ${i} placeholder: replace me`, label: `Art ${i} · replace me`, decor: decorArt,
  })));
});

const PIC_SIZES = [[1600, 1067], [1067, 1600], [1600, 1067], [1600, 1067], [1067, 1600], [1600, 1067]];
PIC_SIZES.forEach(([w, h], idx) => {
  const i = idx + 1;
  written.push(write(`pictures/picture-${i}.svg`, frame({
    w, h, seed: 20 + i, title: `Photo ${i} placeholder: replace me`, label: `Photo ${i} · replace me`, decor: decorPicture,
  })));
});

for (let i = 1; i <= 2; i++) {
  written.push(write(`music/cover-${i}.svg`, frame({
    w: 600, h: 600, seed: 30 + i, title: `Cover ${i} placeholder: replace me`, label: `Cover ${i} · replace me`, decor: decorCover,
  })));
}

written.push(write('music/sample-tone.wav', toneWav()));

console.log(`Wrote ${written.length} files to ${MEDIA}`);
for (const f of written) console.log(`  media/${f}`);
