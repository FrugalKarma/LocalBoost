import { html, raw } from './core.js';
import { t } from './i18n.js';


/** Small daily bar chart (website visits over the last days). */
export function barSeries(values, label) {
  const W = 300; const H = 70; const n = values.length; const max = Math.max(1, ...values); const bw = W / n;
  const bars = values.map((v, i) => { const h = Math.max(v ? 3 : 1, (v / max) * (H - 6)); return `<rect x="${(i * bw + 1).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="2" class="${v ? 'bar' : 'bar bar-zero'}"><title>${v}</title></rect>`; }).join('');
  return html`<svg class="mini-bars" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${label}">${raw(bars)}</svg>`;
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
    <path d="M20 190C90 150 150 205 230 160S360 120 430 60" stroke="var(--ice-500)" stroke-width="2" fill="none" stroke-dasharray="3 6"/>
    <path class="sweep" d="M300 115L414 115A114 114 0 0 0 380 34Z" fill="var(--ice-500)" fill-opacity=".14"/>
    ${raw(dots.map(([x, y, r], i) => `<circle class="pulse-dot" style="--d:${i * 0.35}s" cx="${x}" cy="${y}" r="${r}" fill="var(--ice-400)"/>`).join(''))}
    <circle cx="300" cy="115" r="9" fill="var(--ice-500)" stroke="var(--plum-950)" stroke-width="3"/></svg>`;
}

export function meter(value, label) {
  return html`<div class="meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}" aria-label="${label}"><i style="width:${value}%"></i></div>`;
}

/** Decorative street pattern behind the Home map card (not real geography; the pins on top are placed from real coordinates). */
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
</svg>`;
}
