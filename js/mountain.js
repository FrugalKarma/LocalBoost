// The mountain: Arcton Ai's three steps drawn as a climb. Crest I = Observe, crest II = Analyse, the peak = Act.
// Used as the main navigation on Home, as the picture on the sign-in page and the front page, and (small) while the AI works.
import { html } from './core.js';

const FRONT = 'M0 720 L70 590 L150 620 L250 350 L320 440 L390 400 L470 290 L520 350 L610 90 L670 320 L740 280 L820 400 L820 720 Z';
const BACK = 'M0 720 L110 500 L190 540 L300 400 L400 450 L490 320 L580 200 L660 280 L730 170 L820 320 L820 720 Z';
const SEG = ['M30 690 C 150 640, 215 450, 250 350', 'M250 350 C 320 330, 420 330, 470 290', 'M470 290 C 540 230, 590 160, 610 90'];
const CREST = [[250, 350], [470, 290], [610, 90]];
const NUM = ['I', 'II', 'III'];
let uid = 0;

/**
 * steps: [{ label, sub, href, done }] for I, II, III. current: index of the step the business is on (or -1).
 * opts.size: 'hero' | 'side' | 'mini'. opts.links: false renders plain labels (decorative use).
 */
export function mountain(steps, current = -1, opts = {}) {
  const id = `mt${++uid}`; const size = opts.size || 'hero';
  const seg = SEG.map((d, i) => {
    const on = steps[i]?.done;
    return html`<path class="mtn-seg ${on ? 'is-done' : 'is-todo'}" d="${d}" pathLength="1" style="--i:${i}"/>`;
  });
  const marks = CREST.map(([x, y], i) => html`<g class="mtn-mark ${steps[i]?.done ? 'is-done' : ''} ${i === current ? 'is-now' : ''} ${i === 2 ? 'is-peak' : ''}" style="--i:${i}">
    <line x1="${x}" y1="${y - 10}" x2="${x}" y2="${y - (i === 2 ? 46 : 86)}" class="mtn-leader"/>
    ${i === current ? html`<circle cx="${x}" cy="${y}" r="16" class="mtn-pulse"/>` : ''}
    <rect x="${x - (i === 2 ? 8 : 6)}" y="${y - (i === 2 ? 8 : 6)}" width="${i === 2 ? 16 : 12}" height="${i === 2 ? 16 : 12}" transform="rotate(45 ${x} ${y})" class="mtn-dia"/></g>`);
  const ann = steps.map((s, i) => {
    const [x, y] = CREST[i]; const top = ((y - (i === 2 ? 46 : 86) - 2) / 720) * 100; const left = (x / 820) * 100;
    const inner = html`<span class="mtn-t"><i>${NUM[i]}</i>${s.label}</span>${s.sub ? html`<span class="mtn-sub">${s.sub}</span>` : ''}`;
    const cls = `mtn-ann ${s.done ? 'is-done' : ''} ${i === current ? 'is-now' : ''} ${i === 2 ? 'is-peak' : ''}`;
    return opts.links === false || !s.href
      ? html`<span class="${cls}" style="left:${left}%;top:${top}%;--i:${i}">${inner}</span>`
      : html`<a class="${cls}" href="${s.href}" style="left:${left}%;top:${top}%;--i:${i}">${inner}</a>`;
  });
  const dust = Array.from({ length: size === 'mini' ? 0 : 14 }, (_, k) => html`<i style="--x:${(k * 53) % 100}%;--d:${8 + (k * 7) % 11}s;--o:${-(k * 1.7) % 9}s"></i>`);
  return html`<div class="mtn mtn-${size}">
    <svg class="mtn-svg" viewBox="0 0 820 720" aria-hidden="true" focusable="false"><defs>
      <linearGradient id="${id}-metal" x1="0" y1="0" x2="1" y2=".35"><stop offset="0" style="stop-color:var(--mt-1)"/><stop offset=".38" style="stop-color:var(--mt-2)"/><stop offset=".5" style="stop-color:var(--mt-3)"/><stop offset=".62" style="stop-color:var(--mt-2)"/><stop offset="1" style="stop-color:var(--mt-4)"/></linearGradient>
      <linearGradient id="${id}-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".78"/></linearGradient>
      <linearGradient id="${id}-sheen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFF4E6" stop-opacity="0"/><stop offset=".5" stop-color="#FFF4E6" stop-opacity=".28"/><stop offset="1" stop-color="#FFF4E6" stop-opacity="0"/></linearGradient>
      <clipPath id="${id}-clip"><path d="${FRONT}"/></clipPath></defs>
      <circle class="mtn-disc" cx="650" cy="230" r="236"/>
      <path class="mtn-back" d="${BACK}"/>
      <g class="mtn-body"><path d="${FRONT}" fill="url(#${id}-metal)"/><path d="${FRONT}" fill="url(#${id}-shade)"/>
        <path d="M610 90 L470 290 L520 350 Z" fill="#000" opacity=".28"/><path d="M610 90 L670 320 L740 280 L820 400 L820 720 L560 720 Z" fill="#000" opacity=".36"/>
        <g clip-path="url(#${id}-clip)"><rect class="mtn-sheen" x="-320" y="-40" width="260" height="800" fill="url(#${id}-sheen)"/></g>
        <path class="mtn-edge" d="${FRONT}" pathLength="1"/></g>
      ${seg}${marks}</svg>
    ${ann}
    <span class="mtn-dust" aria-hidden="true">${dust}</span></div>`;
}

/** The climb while the AI works: the trail draws itself over and over, with the current task under it. */
export function climbLoader(title, lines, step) {
  return html`<section class="climb" aria-live="polite"><div class="climb-art">${mountain([{ label: '' }, { label: '' }, { label: '' }], -1, { size: 'mini', links: false })}</div>
    <div class="climb-copy"><p class="tag">${title}</p>
      <ol class="climb-steps">${lines.map((l, i) => html`<li class="${i < step ? 'done' : i === step ? 'now' : ''}"><span class="climb-n">${String(i + 1).padStart(2, '0')}</span>${l}</li>`)}</ol></div></section>`;
}
