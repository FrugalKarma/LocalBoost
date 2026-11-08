import { html, icon } from '../core.js';
import { t } from '../i18n.js';
import { getState } from '../store.js';
import { scan, hasSignals } from '../collect.js';

// Which step of the journey each screen belongs to, for the small label above its title.
const STEP_OF = { signals: ['01', 'observe'], competitors: ['01', 'observe'], diagnosis: ['02', 'diagnose'], mission: ['03', 'act'], website: ['03', 'act'], pack: ['03', 'act'], proof: ['04', 'measure'] };
const eyebrow = () => { const st = STEP_OF[document.body.dataset.route]; return st ? `${st[0]} · ${t(`journey.${st[1]}`)}` : 'Arcton Ai'; };

export function pageHead({ note, title, sub, actions }) {
  return html`<header class="page-head">
    <div><p class="eyebrow">${eyebrow()}</p><h1>${title}</h1>${sub ? html`<p class="lede">${sub}</p>` : ''}</div>
    ${actions ? html`<div class="page-actions">${actions}</div>` : ''}</header>`;
}

export const statusBadge = (status) => html`<span class="badge badge-${status}">${t(`status.${status}`)}</span>`;

export function journeyState() {
  const s = getState();
  return {
    observe: hasSignals(),
    diagnose: !!s.diagnosis,
    act: s.mission?.status === 'active',
    measure: !!s.checkpoint,
  };
}

export function nextAction() {
  const s = getState();
  if (!s.diagnosis) return { key: 'next.analysis', route: 'diagnosis', act: 'run-analysis-go' };
  if (s.mission?.status !== 'active') return { key: 'next.mission', route: 'mission' };
  if (!s.site.generated) return { key: 'next.website', route: 'website' };
  if (!s.checkpoint) return { key: 'next.proof', route: 'proof' };
  return { key: 'next.proof', route: 'proof' };
}

export function journey() {
  const j = journeyState();
  const steps = [['observe', 'overview'], ['diagnose', 'diagnosis'], ['act', 'mission'], ['measure', 'proof']];
  return html`<ol class="journey">${steps.map(([k, route], i) => html`<li class="${j[k] ? 'done' : ''}">
    <button class="journey-step" data-act="go" data-route="${route}"><span class="journey-n">${j[k] ? icon('check', 16) : i + 1}</span>
    <span><strong>${t(`journey.${k}`)}</strong><small>${t(`journey.${k}Sub`)}</small></span></button></li>`)}</ol>`;
}


/** AI can be wrong and local conditions change quickly: shown wherever AI output appears. */
export function aiNotice() {
  return html`<div class="notice" role="note">${icon('info', 18)}<p><strong>${t('ai.noticeTitle')}</strong> ${t('ai.notice')}</p></div>`;
}

/** Live scanning steps shown while signals are being collected. */
export function scanCard() {
  return html`<section class="card scan" aria-live="polite"><p class="tag">${t('start.scanning')}</p>
    <ol class="steps">${scan.steps.map((k, i) => html`<li class="${i < scan.step ? 'done' : i === scan.step ? 'now' : ''}"><span class="dot"></span>${t(`collect.step.${k}`)}</li>`)}</ol>
    <div class="bar-indet"><i></i></div></section>`;
}

