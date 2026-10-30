import { html, raw } from './core.js';
import { t, fmtNumber, getLocale } from './i18n.js';
import { HOURLY, HOURLY_START, BUSINESS } from './data.js';

export function scoreRing(value, size = 132) {
  const r = 52; const c = 2 * Math.PI * r; const off = c * (1 - value / 100);
  return html`<svg class="ring" width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="${t('overview.score')}: ${value}/100">
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="currentColor" stroke-opacity=".18" stroke-width="9"/>
    <circle class="ring-arc" cx="60" cy="60" r="${r}" fill="none" stroke="var(--yellow-500)" stroke-width="9" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(1)}" style="--from:${c.toFixed(1)};--to:${off.toFixed(1)};stroke-dashoffset:${off.toFixed(1)}" transform="rotate(-90 60 60)"/>
    <text x="60" y="58" text-anchor="middle" class="ring-num">${value}</text>
    <text x="60" y="76" text-anchor="middle" class="ring-sub">/100</text></svg>`;
}

/** Search interest by hour with the 14:00-18:00 opportunity window highlighted. */
export function hourlyChart() {
  const W = 560; const H = 190; const pad = { l: 8, r: 8, t: 20, b: 30 };
  const n = HOURLY.length; const bw = (W - pad.l - pad.r) / n; const max = 100;
  const bars = HOURLY.map((v, i) => {
    const h = (v / max) * (H - pad.t - pad.b); const hour = HOURLY_START + i;
    const inWin = hour >= BUSINESS.windowStart && hour < BUSINESS.windowEnd;
    const x = pad.l + i * bw + 3; const y = H - pad.b - h;
    return `<rect class="bar ${inWin ? 'bar-hot' : ''}" style="--i:${i}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw - 6).toFixed(1)}" height="${h.toFixed(1)}" rx="4"><title>${hour}:00 · ${v}</title></rect>` +
      (i % 2 === 0 ? `<text x="${(x + (bw - 6) / 2).toFixed(1)}" y="${H - 10}" text-anchor="middle" class="axis">${hour}</text>` : '');
  }).join('');
  const wx = pad.l + (BUSINESS.windowStart - HOURLY_START) * bw; const ww = (BUSINESS.windowEnd - BUSINESS.windowStart) * bw;
  return html`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${t('overview.hourlyAria')}">
    <rect x="${wx}" y="6" width="${ww}" height="${H - pad.b - 2}" rx="8" fill="var(--yellow-500)" fill-opacity=".14" stroke="var(--yellow-500)" stroke-dasharray="4 4"/>
    <text x="${wx + ww / 2}" y="18" text-anchor="middle" class="axis axis-hot">${BUSINESS.windowStart}:00–${BUSINESS.windowEnd}:00</text>
    ${raw(bars)}</svg>`;
}

const shortDate = (d) => new Intl.DateTimeFormat(getLocale(), { day: 'numeric', month: 'short' }).format(d);

/** Reach over the selected period: area line with start/end labels and a hoverable point for every sample. */
export function reachChart(stats) {
  const W = 520; const H = 170; const pad = { l: 10, r: 14, t: 16, b: 28 };
  const vals = stats.points.map((p) => p.value); const min = Math.min(...vals); const max = Math.max(...vals); const span = Math.max(1, max - min);
  const x = (i) => pad.l + (i / Math.max(1, stats.points.length - 1)) * (W - pad.l - pad.r);
  const y = (v) => H - pad.b - ((v - min) / span) * (H - pad.t - pad.b);
  const d = stats.points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const lastX = x(stats.points.length - 1); const lastY = y(vals[vals.length - 1]);
  const dots = stats.points.map((p, i) => `<circle class="hit" cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="7" fill="transparent"><title>${shortDate(p.date)} · ${fmtNumber(p.value)}</title></circle>`).join('');
  return html`<svg class="reach-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${t('overview.trendAria', { v: fmtNumber(stats.end) })}">
    <g stroke="currentColor" stroke-opacity=".12"><path d="M${pad.l} ${H - pad.b}H${W - pad.r}"/><path d="M${pad.l} ${pad.t}H${W - pad.r}" stroke-dasharray="3 5"/></g>
    <path d="${d} L${lastX.toFixed(1)} ${H - pad.b} L${pad.l} ${H - pad.b} Z" fill="var(--yellow-500)" fill-opacity=".16"/>
    <path class="spark-line" d="${d}" fill="none" stroke="var(--yellow-500)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/>
    <circle cx="${x(0).toFixed(1)}" cy="${y(vals[0]).toFixed(1)}" r="4" fill="var(--yellow-400)" fill-opacity=".7"/>
    <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="5" fill="var(--yellow-400)"/>
    <text x="${pad.l}" y="${H - 8}" class="axis">${shortDate(stats.from)}</text><text x="${W - pad.r}" y="${H - 8}" text-anchor="end" class="axis">${shortDate(stats.to)}</text>
    <text x="${W - pad.r}" y="${pad.t - 4}" text-anchor="end" class="axis axis-hot">${fmtNumber(max)}</text><text x="${pad.l}" y="${H - pad.b - 6}" class="axis">${fmtNumber(min)}</text>
    ${raw(dots)}</svg>`;
}
/** Abstract field map for the hero: coordinate lines, radar rings and signal dots. */
export function fieldMap() {
  const dots = [[96, 70, 5], [188, 120, 7], [250, 52, 4], [310, 150, 6], [150, 175, 4], [372, 96, 5], [60, 150, 3]];
  return html`<svg class="fieldmap" viewBox="0 0 440 230" aria-hidden="true">
    <g stroke="currentColor" stroke-opacity=".16" fill="none">
      ${raw([0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<path d="M${i * 62} 0V230"/>`).join(''))}
      ${raw([0, 1, 2, 3, 4].map((i) => `<path d="M0 ${i * 58}H440"/>`).join(''))}
    </g>
    <g stroke="currentColor" stroke-opacity=".32" fill="none"><circle cx="300" cy="115" r="38"/><circle cx="300" cy="115" r="76"/><circle cx="300" cy="115" r="114"/></g>
    <path d="M20 190C90 150 150 205 230 160S360 120 430 60" stroke="var(--yellow-500)" stroke-width="2" fill="none" stroke-dasharray="3 6"/>
    <path class="sweep" d="M300 115L414 115A114 114 0 0 0 380 34Z" fill="var(--yellow-500)" fill-opacity=".14"/>
    ${raw(dots.map(([x, y, r], i) => `<circle class="pulse-dot" style="--d:${i * 0.35}s" cx="${x}" cy="${y}" r="${r}" fill="var(--yellow-400)"/>`).join(''))}
    <circle cx="300" cy="115" r="9" fill="var(--yellow-500)" stroke="var(--burgundy-950)" stroke-width="3"/></svg>`;
}

export function meter(value, label) {
  return html`<div class="meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}" aria-label="${label}"><i style="width:${value}%"></i></div>`;
}

/** Illustrative street map for the Home screen (not real geography). Colours come from CSS tokens so both themes work. */
export function streetMap() {
  return html`<svg class="street" viewBox="0 0 760 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <path class="m-water" d="M-10 470 C140 440 260 510 420 480 S640 420 780 450 L780 580 L-10 580Z"/>
    <path class="m-park" d="M470 40 C560 10 690 50 710 130 C730 210 640 250 560 230 C480 210 420 110 470 40Z"/>
    <path class="m-park" d="M60 70 C130 50 190 90 175 150 C160 200 80 200 55 160 C35 125 40 85 60 70Z"/>
    <g class="m-road"><path d="M-10 300 L780 210" stroke-width="18"/><path d="M340 -10 L390 580" stroke-width="13"/>
      <path d="M-10 140 C180 180 320 120 780 370" stroke-width="8"/><path d="M180 -10 L230 450" stroke-width="6"/>
      <path d="M560 -10 L530 460" stroke-width="6"/><path d="M-10 400 L780 330" stroke-width="6"/></g>
    <g class="m-block"><rect x="250" y="180" width="70" height="46" rx="5"/><rect x="410" y="250" width="90" height="56" rx="5"/>
      <rect x="250" y="320" width="76" height="46" rx="5"/><rect x="600" y="270" width="78" height="42" rx="5"/></g>
    <text class="m-label" x="525" y="125">Parcul Copou</text>
    <text class="m-label" x="610" y="232" transform="rotate(-6 610 232)">Bd. Carol I</text></svg>`;
}
