import { html, icon, toast, openModal } from '../core.js';
import { t, fmtDate, fmtNumber } from '../i18n.js';
import { getState, update } from '../store.js';
import { missionPlan, evaluateCheckpoint, measureNow } from '../mission.js';
import { actions, rerender } from '../registry.js';
import { pageHead } from './shared.js';
import { meter } from '../charts.js';
import { loadSiteData } from '../insights.js';
import { getBiz } from '../business.js';
import { placeDetails, serverCaps } from '../sources.js';
import { applyPlace } from '../collect.js';

const pctOf = (v, goal) => Math.max(0, Math.min(100, Math.round((v / Math.max(goal, 1)) * 100)));
const dash = (v) => (v == null ? '—' : fmtNumber(v));
let busy = false;

export const proof = {
  id: 'proof',
  render() {
    const s = getState(); const p = missionPlan(); const cp = s.checkpoint; const base = p.baseline || {};
    const ev = cp ? evaluateCheckpoint(cp) : null;
    const rows = [
      { k: 'requests', base: '0', target: `≥ ${p.target.requests}`, cur: cp ? dash(cp.requests) : '—', pct: cp ? pctOf(cp.requests, p.target.requests) : 0, note: cp && cp.extraRequests ? t('proof.inclExtra', { n: cp.extraRequests }) : '' },
      { k: 'newReviews', base: dash(base.reviewCount), target: `+${p.target.reviews}`, cur: cp ? (cp.newReviews == null ? '—' : `+${cp.newReviews}`) : '—', pct: cp && cp.newReviews != null ? pctOf(cp.newReviews, p.target.reviews) : 0 },
      { k: 'views', base: dash(base.views), target: '↑', cur: cp ? dash(cp.views) : '—', pct: cp && cp.views != null ? pctOf(cp.views, Math.max(1, base.views || 1) * 1.2) : 0 },
      { k: 'clicks', base: dash(base.clicks), target: '↑', cur: cp ? dash(cp.clicks) : '—', pct: cp && cp.clicks != null ? pctOf(cp.clicks, Math.max(1, base.clicks || 1) * 1.2) : 0 },
    ];
    const statusKey = ev ? ev.status : s.mission?.status === 'active' ? 'waiting' : 'notStarted';
    return html`
    ${pageHead({ title: t('proof.title'), sub: t('proof.sub'),
      actions: s.mission?.status === 'active' ? html`<button class="btn btn-primary" data-act="record-checkpoint" ${busy ? 'disabled' : ''}>${busy ? html`<i class="spin"></i>` : icon('refresh', 18)} ${cp ? t('proof.update') : t('proof.record')}</button>` : '' })}
    <section class="verdict verdict-${statusKey}">
      <div><p class="verdict-k">${t('mission.checkpoint')}</p><h2>${t(`proof.status.${statusKey}`)}</h2>
        <p class="verdict-meta">${s.mission?.checkpointAt ? html`<span>${t('proof.due')} ${fmtDate(s.mission.checkpointAt)}</span>` : ''}
          ${cp ? html`<span>${t('proof.recorded')} ${fmtDate(cp.recordedAt)}</span>` : ''}</p></div>
      <span class="verdict-mark" aria-hidden="true">${icon(statusKey === 'success' ? 'check' : statusKey === 'miss' ? 'x' : 'clock', 40)}</span>
    </section>
    ${s.mission?.status !== 'active' ? html`<section class="card empty-hero"><p class="muted">${t('proof.noMission')}</p><button class="btn btn-primary" data-act="go" data-route="mission">${t('actions.startMission')}</button></section>` : ''}
    <div class="result-grid">${rows.map((r) => html`<article class="result ${r.pct >= 100 ? 'met' : ''}">
      <div class="result-top"><span>${t(`proof.${r.k}`)}</span>${r.pct >= 100 ? html`<span class="result-ok">${icon('check', 14)}</span>` : ''}</div>
      <strong>${r.cur}</strong>
      <p class="result-sub"><span>${t('mission.baseline')} ${r.base}</span><span>${t('mission.target')} ${r.target}</span></p>
      ${meter(r.pct, t(`proof.${r.k}`))}${r.note ? html`<small class="muted">${r.note}</small>` : ''}</article>`)}</div>
    <p class="muted small">${t('proof.sources')}${base.published === false ? html` ${t('proof.notPublished')}` : ''}</p>

    <div class="next-grid">
      <section class="branch ${statusKey === 'success' ? 'is-now' : ''}"><h3>${icon('check', 18)} ${t('proof.ifWorks')}</h3><p>${t('proof.ifWorksBody')}</p></section>
      <section class="branch ${statusKey === 'partial' || statusKey === 'miss' ? 'is-now' : ''}"><h3>${icon('refresh', 18)} ${t('proof.ifNot')}</h3>
        <ol class="plain">${[1, 2, 3].map((n) => html`<li>${t(`proof.fix${n}`)}</li>`)}</ol></section>
    </div>

    <section class="card"><h2 class="card-title">${t('proof.timeline')}</h2>
      <ol class="steps-h">${['start', 'measure', 'return', 'decide'].map((k, i) => { const done = [!!s.mission, !!cp, !!cp, false][i];
        return html`<li class="${done ? 'done' : ''}"><span class="steps-h-dot">${done ? icon('check', 14) : i + 1}</span><strong>${t(`proof.tl.${k}`)}</strong><small>${t(`proof.tl.${k}Sub`)}</small></li>`; })}</ol>
      <p class="muted small">${t('proof.honest')}</p></section>`;
  },
};

actions['record-checkpoint'] = async () => {
  if (busy) return;
  const prev = getState().checkpoint;
  const extra = await openModal({
    title: t('proof.recordTitle'),
    body: html`<p class="muted">${t('proof.recordBody')}</p><label class="field"><span>${t('proof.extraLabel')}</span>
      <input id="cp-extra" type="number" min="0" max="9999" inputmode="numeric" value="${prev?.extraRequests || 0}"></label><p class="muted small">${t('proof.extraHint')}</p>`,
    actions: [{ label: t('common.cancel'), kind: 'btn-ghost', value: null }, { label: t('proof.measure'), kind: 'btn-primary', collect: () => Number(document.getElementById('cp-extra')?.value) || 0 }],
  });
  if (extra == null) return;
  busy = true; rerender();
  // fresh numbers: Google rating/review count and the website's visits and requests
  const b = getBiz(); const caps = await serverCaps();
  if (b.place?.id && caps.places) { const r = await placeDetails(b.place.id); if (r.ok) { applyPlace(r.data.place, r.data.fetchedAt); update((st) => ({ signals: { ...st.signals, google: { rating: r.data.place.rating, reviewCount: r.data.place.reviewCount, reviews: r.data.place.reviews, fetchedAt: r.data.fetchedAt } } })); } }
  await loadSiteData(true).catch(() => {});
  update({ checkpoint: measureNow(extra) });
  busy = false;
  toast(t('proof.toastSaved'), 'success'); rerender();
};
