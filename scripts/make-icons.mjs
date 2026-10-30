// Generates PNG icons (no dependencies): a radar/field-map mark on burgundy.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(out, { recursive: true });

const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = (b) => { let c = 0xFFFFFFFF; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) { const [r, g, b, a] = pixel(x / size, y / size); const o = y * (size * 4 + 1) + 1 + x * 4; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a; }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const BG = [0x3A, 0x10, 0x22]; const BG2 = [0x54, 0x17, 0x2A]; const Y = [0xF1, 0xC8, 0x4B]; const CREAM = [0xFF, 0xF9, 0xEF];
const mix = (a, b, t) => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));

// scale: how much of the canvas the mark uses (maskable icons keep a safe zone)
function mark(scale, rounded) {
  const SS = 3;
  return (u, v) => {
    let acc = [0, 0, 0, 0];
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const x = u + (sx + 0.5) / (SS * 512) - 0.5 / 512; const y = v + (sy + 0.5) / (SS * 512) - 0.5 / 512;
      const dx = x - 0.5; const dy = y - 0.5; const d = Math.hypot(dx, dy) / scale;
      let col = mix(BG, BG2, Math.min(1, Math.hypot(x - 0.3, y - 0.2) * 1.3)); let a = 255;
      if (rounded) { const cx = Math.abs(dx) - 0.3; const cy = Math.abs(dy) - 0.3; if (cx > 0 && cy > 0 && Math.hypot(cx, cy) > 0.2) a = 0; }
      const ring = (r, w) => Math.abs(d - r) < w;
      if (ring(0.38, 0.012) || ring(0.26, 0.012)) col = mix(col, CREAM, 0.55);
      if ((Math.abs(dx) < 0.004 * scale || Math.abs(dy) < 0.004 * scale) && d < 0.4) col = mix(col, CREAM, 0.3);
      const ang = Math.atan2(dy, dx);
      if (d < 0.38 && ang > -1.25 && ang < -0.15) col = mix(col, Y, 0.18 * (1 - Math.abs(ang + 0.7) / 0.6)); // radar sweep
      if (d < 0.135) col = Y;
      if (d < 0.05) col = BG; // centre pin
      if (Math.hypot((x - 0.69) / scale, (y - 0.28) / scale) < 0.03) col = CREAM; // signal dot
      acc = [acc[0] + col[0] * a, acc[1] + col[1] * a, acc[2] + col[2] * a, acc[3] + a];
    }
    const n = SS * SS; const alpha = acc[3] / n;
    if (alpha === 0) return [0, 0, 0, 0];
    const k = 1 / (acc[3] / 255);
    return [Math.round(acc[0] * k), Math.round(acc[1] * k), Math.round(acc[2] * k), Math.round(alpha)];
  };
}
const jobs = [['icon-192.png', 192, 1, true], ['icon-512.png', 512, 1, true], ['icon-maskable-512.png', 512, 0.78, false], ['favicon-32.png', 32, 1, true]];
for (const [name, size, scale, rounded] of jobs) {
  writeFileSync(path.join(out, name), png(size, mark(scale, rounded)));
  console.log('wrote', name);
}
writeFileSync(path.join(out, 'favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#3A1022"/><circle cx="32" cy="32" r="24" fill="none" stroke="#FFF9EF" stroke-opacity=".5" stroke-width="2"/><circle cx="32" cy="32" r="15" fill="none" stroke="#FFF9EF" stroke-opacity=".5" stroke-width="2"/><circle cx="32" cy="32" r="9" fill="#F1C84B"/><circle cx="46" cy="18" r="3" fill="#FFF9EF"/></svg>`);
console.log('wrote favicon.svg');

