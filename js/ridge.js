// Navigation along the mountain.
// Laptop: the header is the ridge line; every page is a point on it, the three steps are the crests and a red
// diamond climbs along the line to the page you open. Phone: the bar only says where you are; "Route" opens the
// whole mountain with every page as a waypoint.
import { html, icon, raw } from './core.js';
import { t } from './i18n.js';

// x, y in a 1000 x 100 box (y down). kind: base | crest | peak | sub | dip (a dip is only a bend in the line)
const PTS = [
  { x: 1.5, y: 90, r: 'overview', kind: 'base' },
  { x: 12, y: 76, kind: 'dip' },
  { x: 22, y: 50, r: 'signals', kind: 'crest', n: 'I', stage: 'observe' },
  { x: 30, y: 70, kind: 'dip' },
  { x: 45, y: 32, r: 'diagnosis', kind: 'crest', n: 'II', stage: 'diagnose' },
  { x: 52.5, y: 52, r: 'competitors', kind: 'sub' },
  { x: 60, y: 44, r: 'proof', kind: 'sub' },
  { x: 65, y: 58, kind: 'dip' },
  { x: 76, y: 8, r: 'mission', kind: 'peak', n: 'III', stage: 'act' },
  { x: 85, y: 36, r: 'website', kind: 'sub' },
  { x: 93, y: 50, r: 'pack', kind: 'sub' },
  { x: 100, y: 62, kind: 'dip' },
];
const STOPS = PTS.filter((p) => p.r);
const len = (a, b) => Math.hypot((b.x - a.x) * 10, b.y - a.y);
const CUM = PTS.reduce((acc, p, i) => { acc.push(i ? acc[i - 1] + len(PTS[i - 1], p) : 0); return acc; }, []);
const TOTAL = CUM[CUM.length - 1];
const fracOf = (route) => { const i = PTS.findIndex((p) => p.r === route); return i < 0 ? 0 : CUM[i] / TOTAL; };
function pointAt(f) {
  const d = f * TOTAL; let i = CUM.findIndex((c) => c >= d); if (i <= 0) return PTS[0];
  const a = PTS[i - 1], b = PTS[i], k = (d - CUM[i - 1]) / (CUM[i] - CUM[i - 1] || 1);
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}
const LINE = PTS.map((p, i) => `${i ? 'L' : 'M'}${p.x * 10} ${p.y}`).join(' ');
/** The walked part of the line: every point up to fraction f, then the point at f. */
function pathTo(f) {
  const d = f * TOTAL; const pts = PTS.filter((_, i) => CUM[i] <= d); const p = pointAt(f);
  return [...pts, p].map((q, i) => `${i ? 'L' : 'M'}${(q.x * 10).toFixed(1)} ${q.y.toFixed(1)}`).join(' ');
}
const label = (p) => (p.n ? t(`journey.${p.stage}`) : t(p.r === 'overview' ? 'nav.home' : `nav.${p.r}`));
const stageOfRoute = (r) => { const i = PTS.findIndex((p) => p.r === r); for (let k = i; k >= 0; k--) if (PTS[k].n) return PTS[k]; return null; };

/** Header ridge for the current route. done: { observe, diagnose, act }. */
export function ridge(route, done) {
  const on = PTS.some((p) => p.r === route); const f = on ? fracOf(route) : 0;
  return html`<div class="ridge-line" style="--f:${f}">
    <svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true"><path class="rl-base" d="${LINE}" vector-effect="non-scaling-stroke"/>
      <path class="rl-done" d="${pathTo(f)}" vector-effect="non-scaling-stroke"/></svg>
    ${STOPS.map((p) => { const cur = p.r === route; const big = p.kind !== 'sub';
      return html`<a class="rl-pt rl-${p.kind} ${cur ? 'is-cur' : ''} ${p.stage && done[p.stage] ? 'is-done' : ''}" href="#/${p.r}" style="left:${p.x}%;top:${p.y}%" ${raw(cur ? 'aria-current="page"' : '')}>
        <i class="rl-dot" aria-hidden="true"></i><span class="rl-l">${big && p.n ? html`<b>${p.n}</b>` : ''}${label(p)}</span></a>`; })}
    <i class="rl-me" aria-hidden="true" style="left:${pointAt(f).x}%;top:${pointAt(f).y}%;opacity:${on ? 1 : 0}"></i></div>`;
}

let lastF = null;
/** After a repaint: slide the red line and the diamond from the previous page's point to this one. */
export function animateRidge(root, route) {
  const box = root?.querySelector('.ridge-line'); if (!box) return;
  const on = PTS.some((p) => p.r === route); const to = on ? fracOf(route) : 0;
  const from = lastF ?? to; lastF = to;
  const me = box.querySelector('.rl-me'); const done = box.querySelector('.rl-done');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || from === to) return;
  const t0 = performance.now(); const dur = 900 + Math.abs(to - from) * 900;
  const ease = (k) => 1 - (1 - k) ** 4;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur); const f = from + (to - from) * ease(k); const p = pointAt(f);
    me.style.left = `${p.x}%`; me.style.top = `${p.y}%`; done.setAttribute('d', pathTo(f));
    if (k < 1) requestAnimationFrame(step);
  };
  done.setAttribute('d', pathTo(from));
  requestAnimationFrame(step);
}

/** Phone: where you are, as a breadcrumb that opens the route map. */
export function trailButton(route) {
  const st = stageOfRoute(route);
  const here = route === 'overview' ? t('nav.home') : PTS.some((p) => p.r === route) ? label(PTS.find((p) => p.r === route)) : t(`nav.${route}`);
  return html`<button class="trail-btn" data-act="trail-open" aria-haspopup="dialog">${st ? html`<b>${st.n}</b>` : ''}<span>${st && st.r !== route ? html`<small>${t(`journey.${st.stage}`)}</small>` : ''}${here}</span>${icon('up', 14)}</button>`;
}

// the phone map: the mountain seen whole, every page a waypoint (x %, y % of the map)
const MAP = [['overview', 16, 90], ['signals', 40, 78], ['diagnosis', 22, 64], ['competitors', 46, 55], ['proof', 26, 45], ['mission', 58, 17], ['website', 80, 29], ['pack', 70, 41]];
export function trailMap(route, done) {
  const i = MAP.findIndex(([r]) => r === route);
  const path = MAP.map(([, x, y], k) => `${k ? 'L' : 'M'}${x * 10} ${y * 10}`).join(' ');
  const walked = MAP.slice(0, Math.max(1, i + 1)).map(([, x, y], k) => `${k ? 'L' : 'M'}${x * 10} ${y * 10}`).join(' ');
  const pt = (r) => PTS.find((p) => p.r === r);
  return html`<div class="trail" role="dialog" aria-modal="true" aria-label="${t('trail.title')}">
    <div class="trail-head"><p class="tag">${t('trail.eyebrow')}</p><h2>${t('trail.title')}</h2><button class="icon-btn" data-act="trail-close" aria-label="${t('common.close')}">${icon('x', 20)}</button></div>
    <div class="trail-map"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
      <path class="tm-mtn" d="M0 1000 L0 820 L180 700 L300 760 L420 560 L520 620 L580 170 L700 330 L820 260 L1000 480 L1000 1000 Z"/>
      <path class="tm-route" d="${path}" vector-effect="non-scaling-stroke"/><path class="tm-walked" d="${walked}" vector-effect="non-scaling-stroke"/></svg>
      ${MAP.map(([r, x, y]) => { const p = pt(r); return html`<a class="tm-pt ${x >= 55 ? 'is-left' : ''} ${r === route ? 'is-cur' : ''} ${p.n ? 'is-crest' : ''} ${p.stage && done[p.stage] ? 'is-done' : ''}" href="#/${r}" style="left:${x}%;top:${y}%" data-act="trail-close">
        <i aria-hidden="true"></i><span>${p.n ? html`<b>${p.n}</b>` : ''}${label(p)}</span></a>`; })}</div>
    <p class="trail-foot muted small">${t('trail.foot', { n: Math.max(0, i) + 1, total: MAP.length })}</p></div>`;
}
