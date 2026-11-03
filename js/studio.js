// Action Studio rendering: stickers and social-post graphics as SVG (crisp on screen and in print),
// exported as SVG, PNG (via canvas) or an A4 print sheet. Fonts are web-safe so exports look like the preview.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hexOk = (c, d) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : d);

export const FONTS = {
  bold: "'Arial Black', 'Helvetica Neue', Arial, sans-serif",
  modern: "'Trebuchet MS', 'Segoe UI', Verdana, sans-serif",
  classic: "Georgia, 'Times New Roman', serif",
  elegant: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
  mono: "'Courier New', Courier, monospace",
  hand: "'Comic Sans MS', 'Chalkboard SE', 'Segoe Print', cursive",
};
export const FONT_IDS = Object.keys(FONTS);

/** Colour sets: [background, ring, text, icon/accent, inner]. */
export const PALETTES = {
  aurora: ['#7C3AED', '#C4B5FD', '#FFFFFF', '#7DD3FC', '#6D28D9'],
  sky: ['#E0F2FE', '#0284C7', '#0C4A6E', '#0EA5E9', '#BAE6FD'],
  sunset: ['#FB7185', '#FDE68A', '#FFFFFF', '#FDE68A', '#F43F5E'],
  mint: ['#D1FAE5', '#059669', '#064E3B', '#10B981', '#A7F3D0'],
  coffee: ['#3F2A1E', '#D6B48C', '#FFF4E6', '#E8B04B', '#5C3D2E'],
  candy: ['#FCE7F3', '#DB2777', '#831843', '#F472B6', '#FBCFE8'],
  night: ['#0F172A', '#FBBF24', '#F8FAFC', '#FBBF24', '#1E293B'],
  mono: ['#FFFFFF', '#111111', '#111111', '#111111', '#F3F4F6'],
};
export const PALETTE_IDS = Object.keys(PALETTES);

/* ---------- icons (24 x 24, stroke) ---------- */
export const ICONS = {
  none: '',
  coffee: '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"/>',
  scissors: '<circle cx="6" cy="7" r="3"/><circle cx="6" cy="17" r="3"/><path d="M8.5 8.5L20 19M8.5 15.5L20 5"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  leaf: '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19l8-8"/>',
  pin: '<path d="M12 21s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  fork: '<path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5"/><path d="M17 21V3c-2 1.5-3 4-3 7h3"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="1"/><path d="M3 9h18v-3H3zM12 6v14"/><path d="M12 6c-2-3-6-3-6 0h6zM12 6c2-3 6-3 6 0h-6z"/>',
  percent: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  cake: '<path d="M4 20h16v-7H4z"/><path d="M4 15c2 1.5 4 1.5 6 0s4-1.5 6 0 3 1 4 0"/><path d="M12 13V9M12 6.5v.01"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4 4 0 0 0 7 0M9 10h.01M15 10h.01"/>',
};
export const ICON_IDS = Object.keys(ICONS);
export const SHAPES = ['circle', 'scallop', 'star', 'square', 'ticket', 'bubble', 'hexagon'];
export const RINGS = ['solid', 'dashed', 'dotted', 'double', 'none'];

export const defaultSticker = (o = {}) => ({ id: `s${Math.random().toString(36).slice(2, 8)}`, shape: 'circle', palette: 'aurora', colors: null, font: 'bold', icon: 'coffee',
  top: 'CAFENEAUA AURORA', center: 'HELLO', bottom: 'IAȘI · 2026', ring: 'dashed', inner: true, size: 6, rotate: 0, ...o });

/* ---------- sticker ---------- */
function shapePath(shape, c = 100, r = 92) {
  const pts = (n, R, r2, rot = -Math.PI / 2) => Array.from({ length: n * 2 }, (_, i) => { const a = rot + (i * Math.PI) / n; const rr = i % 2 ? r2 : R; return `${(c + rr * Math.cos(a)).toFixed(2)},${(c + rr * Math.sin(a)).toFixed(2)}`; }).join(' ');
  switch (shape) {
    case 'scallop': { let d = ''; const n = 18; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2 - Math.PI / 2; const x = c + r * Math.cos(a); const y = c + r * Math.sin(a); if (!i) d += `M${x.toFixed(2)},${y.toFixed(2)}`; else d += `A10.5,10.5 0 0 1 ${x.toFixed(2)},${y.toFixed(2)}`; } return `<path d="${d}Z"`; }
    case 'star': return `<polygon points="${pts(12, r, r * 0.84)}"`;
    case 'square': return `<rect x="${c - r}" y="${c - r}" width="${r * 2}" height="${r * 2}" rx="30"`;
    case 'ticket': return `<path d="M18,40 h164 a12,12 0 0 0 0,24 v72 a12,12 0 0 0 0,24 h-164 a12,12 0 0 0 0,-24 v-72 a12,12 0 0 0 0,-24z" transform="translate(0,0)"`;
    case 'bubble': return `<path d="M30,18 h140 a22,22 0 0 1 22,22 v90 a22,22 0 0 1 -22,22 h-80 l-34,30 v-30 h-26 a22,22 0 0 1 -22,-22 v-90 a22,22 0 0 1 22,-22z"`;
    case 'hexagon': return `<polygon points="${Array.from({ length: 6 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 3; return `${(c + r * Math.cos(a)).toFixed(2)},${(c + r * Math.sin(a)).toFixed(2)}`; }).join(' ')}"`;
    default: return `<circle cx="${c}" cy="${c}" r="${r}"`;
  }
}
const ringDash = (ring) => (ring === 'dashed' ? 'stroke-dasharray="9 7"' : ring === 'dotted' ? 'stroke-dasharray="1.5 8" stroke-linecap="round"' : '');
export const stickerColors = (d) => { const p = PALETTES[d.palette] || PALETTES.aurora; const c = d.colors || {}; return { bg: hexOk(c.bg, p[0]), ring: hexOk(c.ring, p[1]), text: hexOk(c.text, p[2]), icon: hexOk(c.icon, p[3]), inner: hexOk(c.inner, p[4]) }; };

/** SVG markup for a sticker design. `uid` keeps textPath ids unique when many stickers share a page. */
export function stickerSvg(d, { size = 200, uid = d.id || 'x', title = '' } = {}) {
  const col = stickerColors(d); const font = FONTS[d.font] || FONTS.bold; const round = ['circle', 'scallop', 'star'].includes(d.shape);
  const base = shapePath(d.shape);
  const ring = d.ring === 'none' ? '' : d.ring === 'double'
    ? `${shapePath(d.shape, 100, 84)} fill="none" stroke="${col.ring}" stroke-width="3"/>${shapePath(d.shape, 100, 77)} fill="none" stroke="${col.ring}" stroke-width="1.5"/>`
    : `${shapePath(d.shape, 100, 82)} fill="none" stroke="${col.ring}" stroke-width="3.5" ${ringDash(d.ring)}/>`;
  const inner = d.inner ? `<circle cx="100" cy="100" r="${round ? 44 : 40}" fill="${col.inner}"/>` : '';
  const icon = ICONS[d.icon] ? `<g transform="translate(${100 - 20},${d.center ? 66 : 80}) scale(1.6667)" fill="none" stroke="${col.icon}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[d.icon]}</g>` : '';
  const cLen = String(d.center || '').length; const cSize = cLen <= 4 ? 30 : cLen <= 7 ? 24 : cLen <= 10 ? 19 : 15;
  const center = d.center ? `<text x="100" y="${ICONS[d.icon] ? 128 : 110}" text-anchor="middle" ${cLen * cSize * 0.7 > 120 ? 'textLength="120" lengthAdjust="spacingAndGlyphs"' : ''} font-family="${esc(font)}" font-weight="800" font-size="${cSize}" fill="${col.text}" letter-spacing=".5">${esc(String(d.center).slice(0, 14))}</text>` : '';
  const tid = `t-${esc(uid)}`;
  let around = '';
  if (round) {
    const fit = (s, max) => String(s || '').slice(0, max);
    around = `<defs><path id="${tid}a" d="M30,100 A70,70 0 0 1 170,100"/><path id="${tid}b" d="M24,100 A76,76 0 0 0 176,100"/></defs>
      ${d.top ? `<text font-family="${esc(font)}" font-weight="700" font-size="${String(d.top).length > 18 ? 11 : 13}" fill="${col.text}" letter-spacing="2"><textPath href="#${tid}a" startOffset="50%" text-anchor="middle">${esc(fit(d.top, 28))}</textPath></text>` : ''}
      ${d.bottom ? `<text font-family="${esc(font)}" font-weight="700" font-size="11" fill="${col.text}" letter-spacing="2"><textPath href="#${tid}b" startOffset="50%" text-anchor="middle">${esc(fit(d.bottom, 30))}</textPath></text>` : ''}`;
  } else {
    const y1 = d.shape === 'bubble' ? 46 : d.shape === 'ticket' ? 62 : 44; const y2 = d.shape === 'bubble' ? 140 : d.shape === 'ticket' ? 148 : 166;
    const maxW = d.shape === 'bubble' ? 140 : d.shape === 'hexagon' ? 120 : 136;
    const fitAttr = (txt, fs) => (String(txt).length * fs * 0.72 > maxW ? `textLength="${maxW}" lengthAdjust="spacingAndGlyphs"` : '');
    around = `${d.top ? `<text x="100" y="${y1}" text-anchor="middle" font-family="${esc(font)}" font-weight="700" font-size="12" fill="${col.text}" letter-spacing="1.5" ${fitAttr(d.top, 12)}>${esc(String(d.top).slice(0, 24))}</text>` : ''}
      ${d.bottom ? `<text x="100" y="${y2}" text-anchor="middle" font-family="${esc(font)}" font-weight="700" font-size="11" fill="${col.text}" letter-spacing="1.5" ${fitAttr(d.bottom, 11)}>${esc(String(d.bottom).slice(0, 26))}</text>` : ''}`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="${esc(title || [d.top, d.center, d.bottom].filter(Boolean).join(' · '))}">
    <g transform="rotate(${Number(d.rotate) || 0} 100 100)">${base} fill="${col.bg}"/>${ring}${inner}${icon}${center}${around}</g></svg>`;
}

/* ---------- social post graphic ---------- */
export const FORMATS = { square: [1080, 1080], portrait: [1080, 1350], story: [1080, 1920] };
export const LAYOUTS = ['bold', 'photo', 'quote', 'offer', 'minimal'];
const wrap = (s, n) => { const out = ['']; String(s || '').split(/\s+/).forEach((w) => { if ((out[out.length - 1] + ' ' + w).trim().length > n) out.push(w); else out[out.length - 1] = (out[out.length - 1] + ' ' + w).trim(); }); return out.filter(Boolean); };
const lines = (arr, x, y, dy, attrs) => arr.map((l, i) => `<text x="${x}" y="${y + i * dy}" ${attrs}>${esc(l)}</text>`).join('');

/** p: { format, layout, palette, font, headline, body, cta, badge, name, handle, photo, quote, author, stars } */
export function postSvg(p, { width = 360 } = {}) {
  const [W, H] = FORMATS[p.format] || FORMATS.square; const pal = PALETTES[p.palette] || PALETTES.aurora; const font = FONTS[p.font] || FONTS.bold;
  const [bg, ring, ink, acc, deep] = pal; const tall = H > W; const pad = 90;
  const head = wrap(p.headline, p.layout === 'quote' ? 26 : 16).slice(0, 4); const body = wrap(p.body, 34).slice(0, tall ? 6 : 4);
  const hs = p.layout === 'quote' ? 58 : head.join('').length > 40 ? 82 : 100;
  const midY = tall ? H * 0.38 : H * 0.3;
  const photo = p.photo ? `<image href="${esc(p.photo)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>` : '';
  const cta = p.cta ? `<g transform="translate(${pad},${H - pad - 110})"><rect width="${Math.min(W - pad * 2, 60 + String(p.cta).length * 26)}" height="96" rx="48" fill="${ink}"/><text x="${Math.min(W - pad * 2, 60 + String(p.cta).length * 26) / 2}" y="62" text-anchor="middle" font-family="${esc(font)}" font-weight="800" font-size="40" fill="${bg}">${esc(String(p.cta).slice(0, 28))}</text></g>` : '';
  const brand = `<text x="${pad}" y="${pad + 20}" font-family="${esc(font)}" font-weight="800" font-size="38" fill="${ink}" letter-spacing="2">${esc(String(p.name || '').toUpperCase().slice(0, 30))}</text>${p.handle ? `<text x="${W - pad}" y="${pad + 20}" text-anchor="end" font-family="${esc(font)}" font-size="32" fill="${ink}" opacity=".8">@${esc(String(p.handle).slice(0, 24))}</text>` : ''}`;
  let inner = '';
  switch (p.layout) {
    case 'photo':
      inner = `<rect width="${W}" height="${H}" fill="${deep}"/>${photo}<rect width="${W}" height="${H}" fill="url(#shade)"/>${brand}
        ${lines(head, pad, H - pad - 200 - (head.length - 1) * hs - body.length * 50, hs, `font-family="${esc(font)}" font-weight="800" font-size="${hs}" fill="#fff"`)}
        ${lines(body, pad, H - pad - 170 - (body.length - 1) * 50 + 20, 50, `font-family="${esc(font)}" font-size="38" fill="#fff" opacity=".92"`)}${cta.replace(`fill="${ink}"`, 'fill="#fff"').replace(`fill="${bg}"`, `fill="${deep}"`)}`;
      break;
    case 'quote':
      inner = `<rect width="${W}" height="${H}" fill="${bg}"/><circle cx="${W - 120}" cy="160" r="260" fill="${acc}" opacity=".18"/>${brand}
        <text x="${pad - 10}" y="${midY + 40}" font-family="Georgia, serif" font-size="260" fill="${acc}" opacity=".9">“</text>
        <text x="${pad}" y="${midY + 120}" font-family="Arial, sans-serif" font-size="60" fill="#FBBF24" letter-spacing="8">${'★'.repeat(Math.max(1, Math.min(5, Number(p.stars) || 5)))}</text>
        ${lines(head, pad, midY + 220, hs * 1.25, `font-family="${esc(FONTS.classic)}" font-style="italic" font-size="${hs}" fill="${ink}"`)}
        <text x="${pad}" y="${midY + 260 + head.length * hs * 1.25}" font-family="${esc(font)}" font-weight="700" font-size="40" fill="${ink}" opacity=".85">— ${esc(p.author || '')}</text>${cta}`;
      break;
    case 'offer':
      inner = `<rect width="${W}" height="${H}" fill="${deep}"/><rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="56" fill="${bg}"/>
        <rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="56" fill="none" stroke="${ring}" stroke-width="8" stroke-dasharray="26 18"/>${brand.replace(new RegExp(`x="${pad}"`, 'g'), `x="${pad + 20}"`)}
        ${p.badge ? `<g transform="translate(${W - pad - 220},${midY - 150}) rotate(10 110 110)"><circle cx="110" cy="110" r="110" fill="${acc}"/><text x="110" y="128" text-anchor="middle" font-family="${esc(font)}" font-weight="900" font-size="${String(p.badge).length > 6 ? 40 : 60}" fill="${deep}">${esc(String(p.badge).slice(0, 9))}</text></g>` : ''}
        ${lines(head, pad + 20, midY + 60, hs, `font-family="${esc(font)}" font-weight="800" font-size="${hs}" fill="${ink}"`)}
        ${lines(body, pad + 20, midY + 80 + head.length * hs, 50, `font-family="${esc(font)}" font-size="38" fill="${ink}" opacity=".88"`)}${cta.replace(`translate(${pad},`, `translate(${pad + 20},`).replace(`${H - pad - 110}`, `${H - pad - 140}`)}`;
      break;
    case 'minimal':
      inner = `<rect width="${W}" height="${H}" fill="${bg}"/><rect x="${pad}" y="${midY - 40}" width="120" height="14" rx="7" fill="${acc}"/>${brand}
        ${lines(head, pad, midY + 80, hs * 1.05, `font-family="${esc(font)}" font-weight="800" font-size="${hs}" fill="${ink}"`)}
        ${lines(body, pad, midY + 120 + head.length * hs * 1.05, 52, `font-family="${esc(font)}" font-size="40" fill="${ink}" opacity=".85"`)}${cta}`;
      break;
    default:
      inner = `<rect width="${W}" height="${H}" fill="url(#bold)"/><circle cx="${W * 0.88}" cy="${H * 0.12}" r="${W * 0.32}" fill="${acc}" opacity=".35"/><circle cx="${W * 0.05}" cy="${H * 0.95}" r="${W * 0.28}" fill="${ring}" opacity=".3"/>${brand}
        ${lines(head, pad, midY + 80, hs, `font-family="${esc(font)}" font-weight="800" font-size="${hs}" fill="${ink}"`)}
        ${lines(body, pad, midY + 120 + head.length * hs, 50, `font-family="${esc(font)}" font-size="40" fill="${ink}" opacity=".9"`)}${cta}`;
  }
  const h = Math.round((width * H) / W);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${width}" height="${h}" role="img" aria-label="${esc(p.headline || '')}">
    <defs><linearGradient id="bold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${deep}"/></linearGradient>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset=".25" stop-color="#000" stop-opacity=".05"/><stop offset="1" stop-color="#000" stop-opacity=".72"/></linearGradient></defs>${inner}</svg>`;
}

/* ---------- export ---------- */
export function downloadText(name, text, type = 'image/svg+xml') {
  const url = URL.createObjectURL(new Blob([text], { type })); const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
/** Renders SVG markup to a PNG of `width` pixels and downloads it. Rejects if an image blocks the canvas. */
export async function downloadPng(name, svg, width) {
  const src = svg.replace(/width="\d+" height="\d+"/, '');
  const vb = src.match(/viewBox="0 0 (\d+) (\d+)"/); const W = Number(vb?.[1] || 1000); const H = Number(vb?.[2] || 1000);
  const img = new Image(); img.decoding = 'async'; img.crossOrigin = 'anonymous';
  const url = URL.createObjectURL(new Blob([src.replace('<svg ', `<svg width="${W}" height="${H}" `)], { type: 'image/svg+xml' }));
  await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = url; });
  const scale = width / W; const c = Object.assign(document.createElement('canvas'), { width: Math.round(W * scale), height: Math.round(H * scale) });
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
  const blob = await new Promise((ok) => c.toBlob(ok, 'image/png'));
  if (!blob) throw new Error('canvas');
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove();
}
/** Turns a remote photo into a data URL so it can be drawn into an exported PNG. */
export async function inlinePhoto(url) {
  if (!url || url.startsWith('data:')) return url;
  try { const r = await fetch(url, { mode: 'cors' }); const b = await r.blob(); return await new Promise((ok) => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(b); }); } catch { return url; }
}

/** A4 print sheet with as many copies as fit at the chosen diameter (cm). */
export function printSheet(designs, cm = 6, copies = 0) {
  const per = Math.max(1, Math.floor(19 / (cm + 0.4))) ** 1; const rows = Math.max(1, Math.floor(27.7 / (cm + 0.4)));
  const max = per * rows; const list = [];
  for (let i = 0; i < (copies || max); i++) list.push(designs[i % designs.length]);
  const root = document.createElement('div'); root.id = 'print-root';
  root.innerHTML = `<div class="sheet" style="display:grid;grid-template-columns:repeat(${per},${cm}cm);gap:.4cm;justify-content:center;padding:.5cm 0">${list.map((d, i) => `<div style="width:${cm}cm;height:${cm}cm">${stickerSvg(d, { size: 100, uid: `p${i}` }).replace('width="100" height="100"', 'width="100%" height="100%"')}</div>`).join('')}</div>`;
  document.body.append(root); document.body.classList.add('printing');
  const done = () => { root.remove(); document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done); setTimeout(() => { window.print(); setTimeout(done, 1500); }, 80);
  return max;
}
