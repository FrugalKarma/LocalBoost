// Arcton Ai icons, no dependencies: a minimal dark-blue iceberg on a light tile.
// Above the waterline a small peak; below it, the larger part most people never see (the insight).
// Writes the PWA icons, the favicon, the in-app logo (SVG + PNG) and the Android launcher icons.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'icons');
mkdirSync(out, { recursive: true });

/* ---------- the mark, in a 0..1 square ---------- */
export const COLORS = { navy: '#1B2D5C', facet: '#2C4580', sky: '#F5F3FB', water: '#E4DEF3', line: '#5B43A3' };
const WATER = 0.55;
const TIP = [[0.27, WATER], [0.41, 0.33], [0.47, 0.39], [0.56, 0.22], [0.73, WATER]];
const FACET = [[0.56, 0.22], [0.6, WATER], [0.73, WATER]];
const BODY = [[0.22, 0.585], [0.78, 0.585], [0.83, 0.67], [0.67, 0.81], [0.45, 0.85], [0.2, 0.72]];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const C = Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, hex(v)]));
const mix = (a, b, t) => a.map((v, i) => v * (1 - t) + b[i] * t);
const inside = (poly, x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i]; const [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };

/** Colour at (x, y) of the mark; `tile` paints sky + water behind it. scale < 1 shrinks the mark (maskable safe zone). */
function sample(x, y, { tile = true, scale = 1, rounded = 0 } = {}) {
  if (rounded) { const dx = Math.abs(x - 0.5) - (0.5 - rounded); const dy = Math.abs(y - 0.5) - (0.5 - rounded); if (dx > 0 && dy > 0 && Math.hypot(dx, dy) > rounded) return null; }
  const u = (x - 0.5) / scale + 0.5; const v = (y - 0.5) / scale + 0.5;
  let col = tile ? (v < WATER ? C.sky : C.water) : null;
  if (tile && Math.abs(v - WATER - 0.0125) < 0.0075 && u > 0.12 && u < 0.88) col = mix(col, C.line, 0.85);
  if (inside(BODY, u, v)) col = col ? mix(col, C.navy, 0.42) : [...C.navy, 0.42 * 255];
  if (inside(TIP, u, v)) col = C.navy;
  if (inside(FACET, u, v)) col = C.facet;
  return col;
}

/* ---------- PNG writer ---------- */
const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = (b) => { let c = 0xFFFFFFFF; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
function png(size, opts) {
  const SS = 4; const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      let r = 0; let g = 0; let b = 0; let a = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const s = sample((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size, opts); if (!s) continue;
        const al = s.length === 4 ? s[3] / 255 : 1; r += s[0] * al; g += s[1] * al; b += s[2] * al; a += al;
      }
      const o = py * (size * 4 + 1) + 1 + px * 4; const n = SS * SS;
      if (a) { raw[o] = Math.round(r / a); raw[o + 1] = Math.round(g / a); raw[o + 2] = Math.round(b / a); } raw[o + 3] = Math.round((a / n) * 255);
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------- SVG versions (crisp in the app) ---------- */
const pts = (p) => p.map(([x, y]) => `${(x * 64).toFixed(2)},${(y * 64).toFixed(2)}`).join(' ');
const markSvg = `<polygon points="${pts(BODY)}" fill="${COLORS.navy}" fill-opacity=".42"/><polygon points="${pts(TIP)}" fill="${COLORS.navy}"/><polygon points="${pts(FACET)}" fill="${COLORS.facet}"/>`;
export const logoSvg = (rx = 14) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><clipPath id="t"><rect width="64" height="64" rx="${rx}"/></clipPath><g clip-path="url(#t)"><rect width="64" height="64" fill="${COLORS.sky}"/><rect y="${WATER * 64}" width="64" height="${64 - WATER * 64}" fill="${COLORS.water}"/><rect x="7.68" y="${(WATER + 0.005) * 64}" width="48.64" height=".96" rx=".48" fill="${COLORS.line}" fill-opacity=".85"/>${markSvg}</g></svg>`;
export const markOnlySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="8 10 48 46">${markSvg}</svg>`;

const jobs = [['icon-192.png', 192, { rounded: 0.18 }], ['icon-512.png', 512, { rounded: 0.18 }], ['icon-maskable-512.png', 512, { scale: 0.8 }], ['favicon-32.png', 32, { rounded: 0.2 }], ['logo.png', 256, { rounded: 0.22 }]];
for (const [name, size, opts] of jobs) { writeFileSync(path.join(out, name), png(size, opts)); console.log('wrote', name); }
writeFileSync(path.join(out, 'favicon.svg'), logoSvg(14));
writeFileSync(path.join(out, 'logo.svg'), logoSvg(14));
writeFileSync(path.join(out, 'mark.svg'), markOnlySvg);
console.log('wrote favicon.svg, logo.svg, mark.svg');

// Android launcher icons (legacy square/round + adaptive foreground with its 108dp safe zone)
const res = path.join(root, 'android/app/src/main/res');
if (existsSync(res)) {
  for (const [dir, s] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) {
    const d = path.join(res, `mipmap-${dir}`); mkdirSync(d, { recursive: true });
    writeFileSync(path.join(d, 'ic_launcher.png'), png(s, { rounded: 0.18 }));
    writeFileSync(path.join(d, 'ic_launcher_round.png'), png(s, { rounded: 0.5 }));
    writeFileSync(path.join(d, 'ic_launcher_foreground.png'), png(Math.round(s * 2.25), { scale: 0.62 }));
  }
  console.log('wrote Android launcher icons');
}
