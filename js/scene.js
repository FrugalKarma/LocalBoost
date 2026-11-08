// The landscape behind every screen: the same mountain seen from the altitude of the step you are on.
// level 0 = the foothills (Home, Observe), 1 = the ridge (Analyse), 2 = the summit (Act, and the launch countdown).
// Colours come from CSS variables (--sc-*), so the light and dark themes paint the same scene.

const W = 1440, H = 900;
const poly = (pts) => `M0 ${H} ${pts.map(([x, y]) => `L${x} ${y}`).join(' ')} L${W} ${H} Z`;
function contours(cx, cy, n) {
  let c = '';
  for (let k = 1; k <= n; k++) c += `<ellipse cx="${(cx + 20 * Math.sin(k)).toFixed(1)}" cy="${cy + k * 6}" rx="${k * 70}" ry="${k * 44}" class="sc-topo ${k % 4 ? '' : 'is-major'}" transform="rotate(${(-8 + k * 0.6).toFixed(1)} ${cx} ${cy})"/>`;
  return c;
}
const RIDGE_FAR = [[0, 520], [180, 430], [300, 480], [470, 330], [600, 410], [760, 300], [880, 360], [1040, 210], [1180, 330], [1300, 280], [1440, 380]];
const RIDGE_NEAR = [[0, 640], [160, 560], [320, 610], [520, 470], [700, 560], [860, 450], [1000, 520], [1160, 400], [1300, 470], [1440, 430]];
const HILLS_A = [[0, 690], [120, 650], [260, 680], [420, 630], [560, 670], [720, 640], [880, 675], [1040, 630], [1200, 665], [1320, 640], [1440, 660]];
const HILLS_B = [[0, 780], [140, 750], [300, 770], [460, 735], [640, 765], [800, 740], [980, 770], [1140, 745], [1300, 772], [1440, 750]];
const PEAK = 'M560 900 L900 380 L960 430 L1060 170 L1160 360 L1240 320 L1440 560 L1440 900 Z';

function layers(level, id) {
  if (level === 2) return `<circle class="sc-disc" cx="1120" cy="250" r="190"/>
    <path class="sc-far" d="${poly([[0, 600], [200, 540], [380, 590], [560, 520], [760, 580], [960, 540], [1160, 600], [1440, 560]])}"/>
    <g class="sc-body"><path d="${PEAK}" fill="url(#${id}m)"/><path d="${PEAK}" fill="url(#${id}s)"/>
    <path d="M1060 170 L1030 215 L1046 210 L1060 228 L1074 208 L1086 222 Z" class="sc-snow"/><path d="M1060 170 L1160 360 L1240 320 L1440 560 L1440 900 L1000 900 Z" fill="#000" opacity=".3"/>
    <g clip-path="url(#${id}c)"><rect class="sc-sheen" x="300" y="0" width="240" height="900" fill="url(#${id}h)"/></g></g>`;
  if (level === 1) return `<circle class="sc-disc" cx="1180" cy="170" r="150"/>
    <path class="sc-far" d="${poly(RIDGE_FAR)}"/>
    <g class="sc-body"><path d="${poly(RIDGE_NEAR)}" fill="url(#${id}m)" opacity=".9"/><path d="${poly(RIDGE_NEAR)}" fill="url(#${id}s)"/></g>
    <rect y="560" width="${W}" height="340" class="sc-fog"/>`;
  return `<circle class="sc-disc" cx="1240" cy="150" r="110"/>
    <path class="sc-far" d="M700 900 L1000 300 L1060 360 L1180 120 L1300 330 L1440 260 L1440 900 Z"/>
    <g class="sc-body"><path d="${poly(HILLS_A)}" fill="url(#${id}m)" opacity=".55"/></g><path class="sc-near" d="${poly(HILLS_B)}"/>
    <rect y="600" width="${W}" height="300" class="sc-fog"/>`;
}

let n = 0;
export function scene(level) {
  const id = `sc${++n}`;
  const clip = level === 2 ? PEAK : level === 1 ? poly(RIDGE_NEAR) : poly(HILLS_A);
  let dust = ''; let s = 11 + level;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 46; i++) dust += `<circle cx="${(rnd() * W).toFixed(0)}" cy="${(rnd() * H).toFixed(0)}" r="${(rnd() * 1.4 + 0.3).toFixed(2)}" style="--d:${(9 + rnd() * 14).toFixed(1)}s;--o:${(-rnd() * 20).toFixed(1)}s;opacity:${(rnd() * 0.5).toFixed(2)}"/>`;
  return `<svg class="sc sc-l${level}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false"><defs>
    <linearGradient id="${id}m" x1="0" y1="0" x2="1" y2=".4"><stop offset="0" style="stop-color:var(--mt-1)"/><stop offset=".4" style="stop-color:var(--mt-2)"/><stop offset=".52" style="stop-color:var(--mt-3)"/><stop offset=".64" style="stop-color:var(--mt-2)"/><stop offset="1" style="stop-color:var(--mt-4)"/></linearGradient>
    <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".8"/></linearGradient>
    <linearGradient id="${id}h" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFF4E6" stop-opacity="0"/><stop offset=".5" stop-color="#FFF4E6" stop-opacity=".22"/><stop offset="1" stop-color="#FFF4E6" stop-opacity="0"/></linearGradient>
    <clipPath id="${id}c"><path d="${clip}"/></clipPath></defs>
    <rect class="sc-sky" width="${W}" height="${H}"/><g class="sc-topos">${contours(1080, 120, 22)}</g>
    ${layers(level, id)}<g class="sc-dust">${dust}</g></svg>`;
}
