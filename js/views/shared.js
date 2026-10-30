import { html, icon, demoBadge } from '../core.js';
import { t } from '../i18n.js';
import { getState } from '../store.js';
import { scan, SCAN_STEPS } from '../collect.js';

export function pageHead({ note, title, sub, actions }) {
  return html`<header class="page-head">
    <div><h1>${title}</h1>${sub ? html`<p class="lede">${sub}</p>` : ''}</div>
    ${actions ? html`<div class="page-actions">${actions}</div>` : ''}</header>`;
}

export const statusBadge = (status) => html`<span class="badge badge-${status}">${t(`status.${status}`)}</span>`;

export function journeyState() {
  const s = getState();
  return {
    observe: true,
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

export { demoBadge };

/** AI can be wrong and local conditions change quickly: shown wherever AI output appears. */
export function aiNotice() {
  return html`<div class="notice" role="note">${icon('info', 18)}<p><strong>${t('ai.noticeTitle')}</strong> ${t('ai.notice')}</p></div>`;
}

/** Live scanning steps shown while signals are being collected. */
export function scanCard() {
  return html`<section class="card scan" aria-live="polite"><p class="tag">${t('start.scanning')}</p>
    <ol class="steps">${SCAN_STEPS.map((k, i) => html`<li class="${i < scan.step ? 'done' : i === scan.step ? 'now' : ''}"><span class="dot"></span>${t(`start.scan.${k}`)}</li>`)}</ol>
    <div class="bar-indet"><i></i></div></section>`;
}

