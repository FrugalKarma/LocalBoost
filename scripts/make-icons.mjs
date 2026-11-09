// Arcton Ai icons, no dependencies: the mountain with a red trail climbing to the red diamond on the summit
// (the "you are here" marker of the app's ridge navigation), bronze on matte black.
// Writes the PWA icons, the favicon, the in-app logo (SVG + PNG) and the Android launcher icons.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'icons');
mkdirSync(out, { recursive: true });

/* ---------- the mark, in a 64 x 64 box ---------- */
export const COLORS = { bg: '#0C0A0A', lit: ['#E8CDA8', '#B98E62', '#7A5A3C'], shade: '#5E4430', far: '#4A3526', snow: '#F4E6D2', red: '#C2384E' };
const LIT = [[9, 52], [26, 25], [31, 31], [41, 15], [55, 52]];
const SHADE = [[41, 15], [37, 52], [55, 52]];
const FAR = [[26, 25], [23, 52], [9, 52]];
const SNOW = [[41, 15], [46.2, 24], [43, 22], [41, 26], [38, 21.5], [35.8, 24]];
const TRAIL = [[14, 52], [25, 41.5], [22, 39], [34, 27.5], [41, 14]]; const TRAIL_W = 1.8;
const DIAMOND = { x: 41, y: 11, r: 3 * Math.SQRT2 };

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v * (1 - t) + b[i] * t);
const inside = (poly, x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i]; const [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const segDist = (x, y, [ax, ay], [bx, by]) => { const dx = bx - ax; const dy = by - ay; const k = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))); return Math.hypot(x - ax - k * dx, y - ay - k * dy); };
const onTrail = (x, y) => TRAIL.some((p, i) => i && segDist(x, y, TRAIL[i - 1], p) <= TRAIL_W / 2);
const litAt = (x, y) => { const t = ((x - 9) / 46 + (y - 15) / 37) / 2; const [a, b, c] = COLORS.lit.map(hex); return t < 0.5 ? mix(a, b, t * 2) : mix(b, c, (t - 0.5) * 2); };

/** Colour at (x, y) in 0..1; `tile` paints the black square behind it. scale < 1 shrinks the mark (maskable safe zone). */
function sample(x, y, { tile = true, scale = 1, rounded = 0 } = {}) {
  if (rounded) { const dx = Math.abs(x - 0.5) - (0.5 - rounded); const dy = Math.abs(y - 0.5) - (0.5 - rounded); if (dx > 0 && dy > 0 && Math.hypot(dx, dy) > rounded) return null; }
  const u = ((x - 0.5) / scale + 0.5) * 64; const v = ((y - 0.5) / scale + 0.5) * 64;
  let col = tile ? hex(COLORS.bg) : null;
  if (inside(LIT, u, v)) col = litAt(u, v);
  if (inside(SHADE, u, v)) col = hex(COLORS.shade);
  if (inside(FAR, u, v)) col = hex(COLORS.far);
  if (inside(SNOW, u, v)) col = mix(col || hex(COLORS.bg), hex(COLORS.snow), 0.9);
  if (onTrail(u, v) || Math.abs(u - DIAMOND.x) + Math.abs(v - DIAMOND.y) <= DIAMOND.r) col = hex(COLORS.red);
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
const pts = (p) => p.map(([x, y]) => `${x},${y}`).join(' ');
const markSvg = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">${COLORS.lit.map((c, i) => `<stop offset="${i / 2}" stop-color="${c}"/>`).join('')}</linearGradient></defs>
<polygon points="${pts(LIT)}" fill="url(#g)"/><polygon points="${pts(SHADE)}" fill="${COLORS.shade}"/><polygon points="${pts(FAR)}" fill="${COLORS.far}"/><polygon points="${pts(SNOW)}" fill="${COLORS.snow}" opacity=".9"/>
<path d="M${TRAIL.map(([x, y]) => `${x} ${y}`).join(' L')}" fill="none" stroke="${COLORS.red}" stroke-width="${TRAIL_W}" stroke-linejoin="miter" stroke-linecap="square"/>
<rect x="${DIAMOND.x - 3}" y="${DIAMOND.y - 3}" width="6" height="6" transform="rotate(45 ${DIAMOND.x} ${DIAMOND.y})" fill="${COLORS.red}"/>`;
export const logoSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${COLORS.bg}"/>${markSvg}</svg>`;
export const markOnlySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="6 4 52 50">${markSvg}</svg>`;

const jobs = [['icon-192.png', 192, {}], ['icon-512.png', 512, {}], ['icon-maskable-512.png', 512, { scale: 0.8 }], ['favicon-32.png', 32, {}], ['logo.png', 256, {}]]; // sharp tiles: phones round them themselves
for (const [name, size, opts] of jobs) { writeFileSync(path.join(out, name), png(size, opts)); console.log('wrote', name); }
writeFileSync(path.join(out, 'favicon.svg'), logoSvg());
writeFileSync(path.join(out, 'logo.svg'), logoSvg());
writeFileSync(path.join(out, 'mark.svg'), markOnlySvg);
writeFileSync(path.join(out, 'mark-light.svg'), markOnlySvg);
console.log('wrote favicon.svg, logo.svg, mark.svg, mark-light.svg');

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
