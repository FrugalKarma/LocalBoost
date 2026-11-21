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
  poster: "Impact, 'Haettenschweiler', 'Arial Narrow Bold', sans-serif-condensed, sans-serif",
  round: "'Arial Rounded MT Bold', 'Varela Round', 'Nunito', 'Trebuchet MS', sans-serif",
  script: "'Brush Script MT', 'Segoe Script', 'Lucida Handwriting', cursive",
  narrow: "'Arial Narrow', 'Roboto Condensed', 'Helvetica Neue', Arial, sans-serif",
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
  bordo: ['#5A1020', '#E0C29F', '#FFF4E6', '#E2576C', '#7A1A2E'],
  forest: ['#1F3D2B', '#A7C4A0', '#F1F7EE', '#E9C46A', '#2E5A3F'],
  ocean: ['#023E8A', '#90E0EF', '#FFFFFF', '#48CAE4', '#0077B6'],
  lemon: ['#FFF3B0', '#E09F3E', '#540B0E', '#E09F3E', '#FFE680'],
  peach: ['#FFDAB9', '#E76F51', '#5C2A1A', '#F4A261', '#FFC49B'],
  lavender: ['#E9E3FF', '#7B61FF', '#2D1B69', '#A08CFF', '#D4CBFF'],
  earth: ['#C2A878', '#5B4636', '#2E2118', '#8C6A4F', '#D8C3A0'],
  neon: ['#111111', '#39FF14', '#FFFFFF', '#FF2BD6', '#262626'],
  matcha: ['#DDE5B6', '#6C584C', '#283618', '#606C38', '#ADC178'],
  cherry: ['#FFF0F3', '#C9184A', '#590D22', '#FF4D6D', '#FFCCD5'],
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
  pizza: '<path d="M12 21L3.5 6a14 14 0 0 1 17 0z"/><path d="M5 8.5a12 12 0 0 1 14 0"/><circle cx="10" cy="11" r="1"/><circle cx="13.5" cy="14" r="1"/>',
  wine: '<path d="M8 3h8l-.5 5a3.5 3.5 0 0 1-7 0z"/><path d="M12 11.5V20M8.5 20h7"/>',
  burger: '<path d="M4 11a8 6 0 0 1 16 0z"/><path d="M3.5 14h17M5 17h14a1 1 0 0 1-1 3H6a1 1 0 0 1-1-3"/>',
  flower: '<circle cx="12" cy="10" r="2.5"/><path d="M12 7.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 1 1 0 5zM14.5 10a2.5 2.5 0 1 1 5 0 2.5 2.5 0 1 1-5 0zM12 12.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 1 1 0-5zM9.5 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0zM12 17.5V22"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  paw: '<circle cx="7" cy="9" r="1.8"/><circle cx="11" cy="6" r="1.8"/><circle cx="15" cy="6.5" r="1.8"/><circle cx="18" cy="10" r="1.8"/><path d="M8 16a4 3.5 0 0 1 8 0c0 2-1.5 3.5-4 3.5S8 18 8 16z"/>',
  dumbbell: '<path d="M7 7v10M17 7v10M4 9v6M20 9v6M7 12h10"/>',
  wrench: '<path d="M14.5 4.5a4.5 4.5 0 0 0 4.9 6L21 12l-8.5 8.5a2.1 2.1 0 0 1-3-3L18 9l-1.5-1.5"/><path d="M14.5 4.5L17 7"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21a2 2 0 0 1 2-2h13v2"/>',
  car: '<path d="M4 16V12l2-5h12l2 5v4z"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/><path d="M4 12h16"/>',
  wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r=".8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',
};
export const ICON_IDS = Object.keys(ICONS);
export const SHAPES = ['circle', 'scallop', 'star', 'flower', 'burst', 'badge', 'heart', 'square', 'oval', 'ticket', 'bubble', 'hexagon', 'shield', 'diamond', 'pill', 'arch', 'cloud'];
export const RINGS = ['solid', 'dashed', 'dotted', 'double', 'none'];
export const FILLS = ['solid', 'gradient', 'radial'];
export const PATTERNS = ['none', 'dots', 'stripes', 'checks', 'rays', 'waves', 'confetti', 'grid', 'zigzag', 'stars'];
export const MOCKUPS = ['plain', 'cup', 'bag', 'window', 'laptop'];
export const EMOJIS = ['☕', '🥐', '🍰', '🍕', '🍔', '🥗', '🍷', '🌿', '🌸', '✨', '❤️', '⭐', '🎉', '💇', '💅', '🛍️', '🎁', '📍', '😊', '🔥', '🐾', '🌞', '🧁', '🍦'];

export const defaultSticker = (o = {}) => normSticker({ id: `s${Math.random().toString(36).slice(2, 8)}`, ...o });
/** Fills every field (older saved stickers have fewer), so the editor and renderer can rely on them. */
export function normSticker(d = {}) {
  const n = (v, def, lo, hi) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : def; };
  return {
    id: d.id || `s${Math.random().toString(36).slice(2, 8)}`,
    shape: SHAPES.includes(d.shape) ? d.shape : 'circle', palette: PALETTES[d.palette] ? d.palette : 'aurora', colors: d.colors && typeof d.colors === 'object' ? d.colors : null,
    fill: FILLS.includes(d.fill) ? d.fill : 'solid', gradAngle: n(d.gradAngle, 135, 0, 360), pattern: PATTERNS.includes(d.pattern) ? d.pattern : 'none', patternOpacity: n(d.patternOpacity, 0.18, 0.05, 0.6),
    font: FONTS[d.font] ? d.font : 'bold', upper: d.upper !== false, spacing: n(d.spacing, 2, 0, 8), textStroke: !!d.textStroke,
    top: String(d.top ?? 'CAFENEAUA AURORA'), center: String(d.center ?? 'HELLO'), bottom: String(d.bottom ?? 'IAȘI · 2026'),
    topSize: n(d.topSize, 13, 8, 22), topY: n(d.topY, 0, -30, 30), bottomY: n(d.bottomY, 0, -30, 30), centerSize: n(d.centerSize, 0, 0, 56), bottomSize: n(d.bottomSize, 11, 8, 20), centerY: n(d.centerY, 0, -40, 40), arc: n(d.arc, 70, 50, 84),
    art: ['icon', 'emoji', 'image', 'none'].includes(d.art) ? d.art : (d.icon && d.icon !== 'none' ? 'icon' : 'none'), icon: ICONS[d.icon] !== undefined ? d.icon : 'coffee', emoji: String(d.emoji || '☕').slice(0, 4), image: typeof d.image === 'string' ? d.image : '', imageRound: d.imageRound !== false,
    artSize: n(d.artSize, 40, 16, 110), artY: n(d.artY, 0, -50, 50),
    ring: RINGS.includes(d.ring) ? d.ring : 'dashed', ringWidth: n(d.ringWidth, 3.5, 1, 10), ringInset: n(d.ringInset, 10, 4, 30),
    inner: d.inner !== false, innerSize: n(d.innerSize, 44, 20, 70), outline: n(d.outline, 6, 0, 16), shadow: d.shadow !== false, rotate: n(d.rotate, 0, -45, 45),
  };
}

/* ---------- shapes (drawn at radius 92 around 100,100; scaled for rings and the die-cut border) ---------- */
function basePath(shape) {
  const c = 100; const r = 92; const P = (pts) => `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`;
  const polar = (n, R, r2, rot = -Math.PI / 2) => Array.from({ length: n * 2 }, (_, i) => { const a = rot + (i * Math.PI) / n; const rr = i % 2 ? r2 : R; return [c + rr * Math.cos(a), c + rr * Math.sin(a)]; });
  switch (shape) {
    case 'scallop': { let d = ''; const k = 18; for (let i = 0; i <= k; i++) { const a = (i / k) * Math.PI * 2 - Math.PI / 2; const x = c + r * Math.cos(a); const y = c + r * Math.sin(a); d += i ? `A10.5,10.5 0 0 1 ${x.toFixed(1)},${y.toFixed(1)}` : `M${x.toFixed(1)},${y.toFixed(1)}`; } return `${d}Z`; }
    case 'star': return P(polar(14, r, r * 0.83));
    case 'flower': { let d = ''; const k = 8; const R = r * 0.74; const pr = R * Math.sin(Math.PI / k) * 1.08; for (let i = 0; i <= k; i++) { const a = (i / k) * Math.PI * 2 - Math.PI / 2; const x = c + R * Math.cos(a); const y = c + R * Math.sin(a); d += i ? `A${pr.toFixed(1)},${pr.toFixed(1)} 0 1 1 ${x.toFixed(1)},${y.toFixed(1)}` : `M${x.toFixed(1)},${y.toFixed(1)}`; } return `${d}Z`; }
    case 'heart': return 'M100,178 C40,138 8,104 8,66 C8,36 32,14 60,14 C78,14 92,24 100,38 C108,24 122,14 140,14 C168,14 192,36 192,66 C192,104 160,138 100,178Z';
    case 'square': return 'M38,8 H162 A30,30 0 0 1 192,38 V162 A30,30 0 0 1 162,192 H38 A30,30 0 0 1 8,162 V38 A30,30 0 0 1 38,8Z';
    case 'oval': return 'M100,36 C152,36 194,64 194,100 C194,136 152,164 100,164 C48,164 6,136 6,100 C6,64 48,36 100,36Z';
    case 'ticket': return 'M14,40 H186 A12,12 0 0 0 186,64 V136 A12,12 0 0 0 186,160 H14 A12,12 0 0 0 14,136 V64 A12,12 0 0 0 14,40Z';
    case 'bubble': return 'M30,16 H170 A22,22 0 0 1 192,38 V128 A22,22 0 0 1 170,150 H92 L56,184 V150 H30 A22,22 0 0 1 8,128 V38 A22,22 0 0 1 30,16Z';
    case 'hexagon': return P(Array.from({ length: 6 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 3; return [c + r * Math.cos(a), c + r * Math.sin(a)]; }));
    case 'shield': return 'M100,8 L184,34 V96 C184,146 148,178 100,194 C52,178 16,146 16,96 V34Z';
    case 'burst': return P(polar(24, r, r * 0.86));
    case 'badge': return P(polar(10, r, r * 0.9));
    case 'diamond': return 'M100,6 L194,100 L100,194 L6,100Z';
    case 'pill': return 'M54,52 H146 A48,48 0 0 1 146,148 H54 A48,48 0 0 1 54,52Z';
    case 'arch': return 'M100,8 C152,8 186,44 186,96 V192 H14 V96 C14,44 48,8 100,8Z';
    case 'cloud': return 'M54,160 C26,160 10,140 12,116 C14,94 32,82 50,84 C52,56 76,38 102,42 C122,26 156,34 164,62 C186,64 196,86 190,108 C202,124 194,160 160,160Z';
    default: return `M${c - r},${c} A${r},${r} 0 1 1 ${c + r},${c} A${r},${r} 0 1 1 ${c - r},${c}Z`;
  }
}
export const ROUND = ['circle', 'scallop', 'star', 'flower', 'burst', 'badge'];
/** Path scaled around the centre: k > 1 grows (die-cut border), k < 1 shrinks (rings). */
const scaled = (shape, k) => `<path d="${basePath(shape)}" transform="translate(100 100) scale(${k.toFixed(4)}) translate(-100 -100)"`;
const ringDash = (ring, w) => (ring === 'dashed' ? `stroke-dasharray="${(w * 2.6).toFixed(1)} ${(w * 2).toFixed(1)}"` : ring === 'dotted' ? `stroke-dasharray="0.1 ${(w * 2.4).toFixed(1)}" stroke-linecap="round"` : '');
export const stickerColors = (d) => { const p = PALETTES[d.palette] || PALETTES.aurora; const c = d.colors || {}; return { bg: hexOk(c.bg, p[0]), bg2: hexOk(c.bg2, p[4]), ring: hexOk(c.ring, p[1]), text: hexOk(c.text, p[2]), icon: hexOk(c.icon, p[3]), inner: hexOk(c.inner, p[4]), pattern: hexOk(c.pattern, p[2]), outline: hexOk(c.outline, '#FFFFFF') }; };

function patternDef(id, kind, col, op) {
  const o = `fill="${col}" fill-opacity="${op}"`; const st = `stroke="${col}" stroke-opacity="${op}"`;
  switch (kind) {
    case 'dots': return `<pattern id="${id}" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="7" cy="7" r="2.6" ${o}/></pattern>`;
    case 'stripes': return `<pattern id="${id}" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="14" ${o}/></pattern>`;
    case 'checks': return `<pattern id="${id}" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="10" height="10" ${o}/><rect x="10" y="10" width="10" height="10" ${o}/></pattern>`;
    case 'waves': return `<pattern id="${id}" width="24" height="12" patternUnits="userSpaceOnUse"><path d="M0,6 Q6,0 12,6 T24,6" fill="none" stroke-width="2" ${st}/></pattern>`;
    case 'confetti': return `<pattern id="${id}" width="40" height="40" patternUnits="userSpaceOnUse"><rect x="4" y="6" width="6" height="3" rx="1.5" transform="rotate(30 7 7)" ${o}/><circle cx="28" cy="10" r="2.5" ${o}/><rect x="20" y="28" width="7" height="3" rx="1.5" transform="rotate(-25 23 29)" ${o}/><circle cx="8" cy="30" r="2" ${o}/></pattern>`;
    case 'grid': return `<pattern id="${id}" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16,0 V16 M0,16 H16" fill="none" stroke-width="1.6" ${st}/></pattern>`;
    case 'zigzag': return `<pattern id="${id}" width="20" height="12" patternUnits="userSpaceOnUse"><path d="M0,9 L5,3 L10,9 L15,3 L20,9" fill="none" stroke-width="2" ${st}/></pattern>`;
    case 'stars': return `<pattern id="${id}" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M8,3 L9.4,6.6 L13,8 L9.4,9.4 L8,13 L6.6,9.4 L3,8 L6.6,6.6Z" ${o}/><path d="M23,17 L24,19.5 L26.5,20.5 L24,21.5 L23,24 L22,21.5 L19.5,20.5 L22,19.5Z" ${o}/></pattern>`;
    default: return '';
  }
}
const rays = (col, op) => Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2; const b = a + Math.PI / 32; return `<path d="M100,100 L${(100 + 160 * Math.cos(a)).toFixed(1)},${(100 + 160 * Math.sin(a)).toFixed(1)} L${(100 + 160 * Math.cos(b)).toFixed(1)},${(100 + 160 * Math.sin(b)).toFixed(1)}Z" fill="${col}" fill-opacity="${op}"/>`; }).join('');

/** SVG markup for a sticker design. `uid` keeps ids unique when many stickers share a page. */
export function stickerSvg(input, { size = 200, uid = input?.id || 'x', title = '', bare = false } = {}) {
  const d = normSticker(input); const col = stickerColors(d); const font = FONTS[d.font]; const round = ROUND.includes(d.shape);
  const id = `k${String(uid).replace(/[^a-z0-9]/gi, '')}`; const up = (s) => (d.upper ? String(s).toUpperCase() : String(s));
  const fillRef = d.fill === 'solid' ? col.bg : `url(#${id}g)`;
  const grad = d.fill === 'gradient' ? `<linearGradient id="${id}g" gradientTransform="rotate(${d.gradAngle} .5 .5)"><stop offset="0" stop-color="${col.bg}"/><stop offset="1" stop-color="${col.bg2}"/></linearGradient>`
    : d.fill === 'radial' ? `<radialGradient id="${id}g" cx=".5" cy=".42" r=".65"><stop offset="0" stop-color="${col.bg2}"/><stop offset="1" stop-color="${col.bg}"/></radialGradient>` : '';
  const pat = d.pattern !== 'none' && d.pattern !== 'rays' ? patternDef(`${id}p`, d.pattern, col.pattern, d.patternOpacity) : '';
  const shadow = d.shadow ? `<filter id="${id}s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#1E1347" flood-opacity=".28"/></filter>` : '';
  const k = 1 - d.ringInset / 92;
  // the die-cut border sits outside the shape, so the shape shrinks to keep it inside the 200 box
  const body = d.outline ? 92 / (92 + d.outline) : 1;
  const ring = d.ring === 'none' ? '' : d.ring === 'double'
    ? `${scaled(d.shape, k)} fill="none" stroke="${col.ring}" stroke-width="${d.ringWidth}"/>${scaled(d.shape, k - (d.ringWidth + 4) / 92)} fill="none" stroke="${col.ring}" stroke-width="${(d.ringWidth / 2).toFixed(1)}"/>`
    : `${scaled(d.shape, k)} fill="none" stroke="${col.ring}" stroke-width="${d.ringWidth}" ${ringDash(d.ring, d.ringWidth)}/>`;
  const inner = d.inner ? `<circle cx="100" cy="100" r="${d.innerSize}" fill="${col.inner}"/>` : '';
  const ay = 100 + d.artY - (d.center ? 14 : 0); const as = d.artSize;
  let art = '';
  if (d.art === 'icon' && ICONS[d.icon]) art = `<g transform="translate(${100 - as / 2},${ay - as / 2}) scale(${(as / 24).toFixed(3)})" fill="none" stroke="${col.icon}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[d.icon]}</g>`;
  if (d.art === 'emoji' && d.emoji) art = `<text x="100" y="${ay + as * 0.35}" text-anchor="middle" font-size="${as}" font-family="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif">${esc(d.emoji)}</text>`;
  if (d.art === 'image' && d.image) art = `<defs><clipPath id="${id}c">${d.imageRound ? `<circle cx="100" cy="${ay}" r="${as / 2}"/>` : `<rect x="${100 - as / 2}" y="${ay - as / 2}" width="${as}" height="${as}" rx="${as * 0.12}"/>`}</clipPath></defs><image href="${esc(d.image)}" x="${100 - as / 2}" y="${ay - as / 2}" width="${as}" height="${as}" preserveAspectRatio="xMidYMid ${d.imageRound ? 'slice' : 'meet'}" clip-path="url(#${id}c)"/>`;
  const stroke = d.textStroke ? `stroke="${col.bg}" stroke-width="3" paint-order="stroke" stroke-linejoin="round"` : '';
  const cText = up(d.center).slice(0, 16); const cLen = cText.length;
  const cSize = d.centerSize || (cLen <= 4 ? 30 : cLen <= 7 ? 24 : cLen <= 10 ? 19 : 15);
  const cy = (art ? 100 + d.artY + as / 2 + cSize * 0.55 : 100 + cSize * 0.35) + d.centerY;
  const center = cText ? `<text x="100" y="${cy.toFixed(1)}" text-anchor="middle" font-family="${esc(font)}" font-weight="800" font-size="${cSize}" fill="${col.text}" letter-spacing="${(d.spacing / 4).toFixed(2)}" ${stroke} ${cLen * cSize * 0.68 > 130 ? 'textLength="130" lengthAdjust="spacingAndGlyphs"' : ''}>${esc(cText)}</text>` : '';
  let around = '';
  if (round) {
    const R = d.arc; const R2 = d.arc + 6;
    around = `<defs><path id="${id}a" d="M${100 - R},100 A${R},${R} 0 0 1 ${100 + R},100"/><path id="${id}b" d="M${100 - R2},100 A${R2},${R2} 0 0 0 ${100 + R2},100"/></defs>
      ${d.top ? `<text font-family="${esc(font)}" font-weight="700" font-size="${d.topSize}" fill="${col.text}" letter-spacing="${d.spacing}" ${stroke}><textPath href="#${id}a" startOffset="50%" text-anchor="middle">${esc(up(d.top).slice(0, 30))}</textPath></text>` : ''}
      ${d.bottom ? `<text font-family="${esc(font)}" font-weight="700" font-size="${d.bottomSize}" fill="${col.text}" letter-spacing="${d.spacing}" ${stroke}><textPath href="#${id}b" startOffset="50%" text-anchor="middle">${esc(up(d.bottom).slice(0, 32))}</textPath></text>` : ''}`;
  } else {
    const Y0 = { heart: [48, 150], oval: [62, 148], ticket: [62, 148], bubble: [44, 136], shield: [44, 160], hexagon: [48, 160], square: [38, 172], diamond: [64, 146], pill: [76, 136], arch: [52, 176], cloud: [72, 150] }[d.shape] || [44, 166];
    const Y = [Y0[0] + d.topY, Y0[1] + d.bottomY];
    const W = { heart: 110, oval: 150, ticket: 150, bubble: 150, shield: 120, hexagon: 120, square: 150, diamond: 96, pill: 160, arch: 140, cloud: 140 }[d.shape] || 136;
    const fit = (txt, fs) => (txt.length * fs * (0.62 + d.spacing * 0.04) > W ? `textLength="${W}" lengthAdjust="spacingAndGlyphs"` : '');
    const T = up(d.top).slice(0, 26); const B = up(d.bottom).slice(0, 28);
    around = `${T ? `<text x="100" y="${Y[0]}" text-anchor="middle" font-family="${esc(font)}" font-weight="700" font-size="${d.topSize}" fill="${col.text}" letter-spacing="${d.spacing / 2}" ${stroke} ${fit(T, d.topSize)}>${esc(T)}</text>` : ''}
      ${B ? `<text x="100" y="${Y[1]}" text-anchor="middle" font-family="${esc(font)}" font-weight="700" font-size="${d.bottomSize}" fill="${col.text}" letter-spacing="${d.spacing / 2}" ${stroke} ${fit(B, d.bottomSize)}>${esc(B)}</text>` : ''}`;
  }
  const clip = `<clipPath id="${id}x">${scaled(d.shape, 1)}/></clipPath>`;
  const content = `<g transform="translate(100 100) scale(${body.toFixed(4)}) translate(-100 -100)">
      ${d.outline ? `${scaled(d.shape, (92 + d.outline) / 92)} fill="${col.outline}"/>` : ''}
      ${scaled(d.shape, 1)} fill="${fillRef}"/>
      ${d.pattern === 'rays' ? `<g clip-path="url(#${id}x)">${rays(col.pattern, d.patternOpacity)}</g>` : pat ? `${scaled(d.shape, 1)} fill="url(#${id}p)"/>` : ''}
      ${ring}${inner}${art}${center}${around}</g>`;
  const inner_ = `<defs>${grad}${pat}${shadow}${clip}</defs><g transform="rotate(${d.rotate} 100 100)" ${d.shadow ? `filter="url(#${id}s)"` : ''}>${content}</g>`;
  if (bare) return inner_;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="${esc(title || [d.top, d.center, d.bottom].filter(Boolean).join(' · '))}">${inner_}</svg>`;
}

/** The sticker shown on an everyday object, for the preview only. */
export function mockupSvg(d, scene = 'plain', { size = 420, uid = 'm' } = {}) {
  const st = (x, y, w, rot = 0) => `<g transform="translate(${x} ${y}) rotate(${rot} ${w / 2} ${w / 2}) scale(${(w / 200).toFixed(4)})">${stickerSvg(d, { bare: true, uid })}</g>`;
  let s;
  switch (scene) {
    case 'cup': s = `<rect width="400" height="400" fill="#F4EFE9"/><ellipse cx="200" cy="356" rx="118" ry="16" fill="#000" opacity=".08"/>
      <path d="M96,96 L304,96 L282,348 Q280,360 266,360 L134,360 Q120,360 118,348Z" fill="#FFFFFF" stroke="#E6DED4" stroke-width="2"/>
      <rect x="84" y="70" width="232" height="34" rx="10" fill="#3F2A1E"/><rect x="100" y="56" width="200" height="20" rx="8" fill="#5C3D2E"/>
      <path d="M118,140 L282,140" stroke="#EFE7DD" stroke-width="2"/>${st(130, 160, 140, -4)}`; break;
    case 'bag': s = `<rect width="400" height="400" fill="#EEF2FF"/><ellipse cx="200" cy="370" rx="130" ry="14" fill="#000" opacity=".08"/>
      <path d="M150,80 Q150,40 200,40 Q250,40 250,80" fill="none" stroke="#B08B5E" stroke-width="10"/>
      <path d="M86,90 L314,90 L330,366 L70,366Z" fill="#D9B98C"/><path d="M86,90 L314,90 L318,120 L82,120Z" fill="#C9A676"/>${st(120, 150, 160, 3)}`; break;
    case 'window': s = `<rect width="400" height="400" fill="#DCEBF7"/><rect x="40" y="30" width="320" height="340" rx="12" fill="#BFD9EE" stroke="#8FB3CF" stroke-width="10"/>
      <path d="M60,60 L150,60 L80,180Z" fill="#fff" opacity=".35"/><path d="M250,330 L340,240 L340,300 L310,330Z" fill="#fff" opacity=".25"/>
      <text x="200" y="350" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#33546E" letter-spacing="4">OPEN</text>${st(110, 90, 180, 0)}`; break;
    case 'laptop': s = `<rect width="400" height="400" fill="#F5F3FF"/><rect x="60" y="70" width="280" height="200" rx="16" fill="#9CA3AF"/><rect x="60" y="70" width="280" height="200" rx="16" fill="url(#lg${uid})"/>
      <defs><linearGradient id="lg${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D1D5DB"/><stop offset="1" stop-color="#9CA3AF"/></linearGradient></defs>
      <path d="M30,282 L370,282 L352,312 L48,312Z" fill="#6B7280"/><circle cx="200" cy="170" r="10" fill="#E5E7EB" opacity=".6"/>${st(230, 92, 92, 12)}${st(80, 150, 96, -10)}`; break;
    default: return stickerSvg(d, { size, uid });
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="${size}" height="${size}" role="img" aria-label="${esc(d.top || 'sticker')}">${s}</svg>`;
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
