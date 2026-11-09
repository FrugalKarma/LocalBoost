import { html, icon } from '../core.js';
import { t } from '../i18n.js';
import { getState } from '../store.js';
import { scan, hasSignals } from '../collect.js';
import { climbLoader } from '../mountain.js';

// Which step of the journey each screen belongs to, for the small label above its title.
const STEP_OF = { signals: ['I', 'observe'], diagnosis: ['II', 'diagnose'], competitors: ['II', 'diagnose'], proof: ['II', 'diagnose'], mission: ['III', 'act'], website: ['III', 'act'], pack: ['III', 'act'] };
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
    act: s.mission?.status === 'active' || !!s.site?.generated,
    measure: !!s.checkpoint, // kept for the admin stage list; on screen it is part of Analyse
  };
}

export function nextAction() {
  const s = getState();
  // not on Google (or Google is not connected): the reviews they paste are what the analysis reads
  if (!s.diagnosis && !s.business?.place?.id && !(s.signals?.notes || []).length) return { key: 'next.paste', route: 'signals' };
  if (!s.diagnosis) return { key: 'next.analysis', route: 'diagnosis', act: 'run-analysis-go' };
  if (s.mission?.status !== 'active') return { key: 'next.mission', route: 'mission' };
  if (!s.site.generated) return { key: 'next.website', route: 'website' };
  if (!s.checkpoint) return { key: 'next.proof', route: 'proof' };
  return { key: 'next.proof', route: 'proof' };
}

export function journey() {
  const j = journeyState();
  const steps = [['observe', 'signals'], ['diagnose', 'diagnosis'], ['act', 'mission']];
  return html`<ol class="journey">${steps.map(([k, route], i) => html`<li class="${j[k] ? 'done' : ''}">
    <button class="journey-step" data-act="go" data-route="${route}"><span class="journey-n">${j[k] ? icon('check', 16) : ['I', 'II', 'III'][i]}</span>
    <span><strong>${t(`journey.${k}`)}</strong><small>${t(`journey.${k}Sub`)}</small></span></button></li>`)}</ol>`;
}


/** AI can be wrong and local conditions change quickly: shown wherever AI output appears. */
export function aiNotice() {
  return html`<div class="notice" role="note">${icon('info', 18)}<p><strong>${t('ai.noticeTitle')}</strong> ${t('ai.notice')}</p></div>`;
}

/** Live scanning steps shown while signals are being collected. */
export function scanCard() {
  return climbLoader(t('start.scanning'), scan.steps.map((k) => t(`collect.step.${k}`)), scan.step);
}

/** The three steps for the mountain: what is done, where each one leads. */
export function climbSteps() {
  const j = journeyState();
  const steps = [['observe', '#/signals'], ['diagnose', '#/diagnosis'], ['act', '#/mission']].map(([k, href]) => ({ label: t(`journey.${k}`), sub: t(`journey.${k}Sub`), href, done: !!j[k] }));
  return { steps, current: steps.findIndex((s) => !s.done) };
}

