import { html, icon, toast, openModal } from '../core.js';
import { t, fmtDate, fmtNumber } from '../i18n.js';
import { getState, update } from '../store.js';
import { missionPlan, evaluateCheckpoint } from '../mission.js';
import { actions, rerender } from '../registry.js';
import { pageHead, demoBadge } from './shared.js';
import { meter } from '../charts.js';

const pctOf = (v, goal) => Math.max(0, Math.min(100, Math.round((v / Math.max(goal, 1)) * 100)));

export const proof = {
  id: 'proof',
  render() {
    const s = getState(); const p = missionPlan(); const cp = s.checkpoint;
    const reachGoal = Math.round(p.baseline.reach * (1 + p.target.reachPct / 100));
    const ev = cp ? evaluateCheckpoint(cp) : null;
    const demoReq = s.bookings.length;
    const rows = [
      { k: 'reach', base: fmtNumber(p.baseline.reach), target: `${fmtNumber(reachGoal)} (+${p.target.reachPct}%)`, cur: cp ? fmtNumber(cp.reach) : '—', pct: cp ? pctOf(cp.reach - p.baseline.reach, reachGoal - p.baseline.reach) : 0 },
      { k: 'requests', base: String(p.baseline.requests), target: `≥ ${p.target.requests}`, cur: cp ? String(cp.requests) : '—', pct: cp ? pctOf(cp.requests, p.target.requests) : 0 },
      { k: 'ctaClicks', base: '0', target: '↑', cur: cp ? String(cp.ctaClicks) : '—', pct: cp ? Math.min(100, cp.ctaClicks * 10) : 0 },
      { k: 'visibility', base: `${p.baseline.visibility}/100`, target: '↑', cur: cp ? `${cp.visibility}/100` : '—', pct: cp ? pctOf(cp.visibility - p.baseline.visibility, 5) : 0 },
    ];
    const statusKey = ev ? ev.status : s.mission?.status === 'active' ? 'waiting' : 'notStarted';
    return html`
    ${pageHead({ note: '07', title: t('proof.title'), sub: t('proof.sub'),
      actions: html`<button class="btn btn-primary" data-act="record-checkpoint">${icon('check', 18)} ${cp ? t('proof.update') : t('proof.record')}</button>` })}
    <section class="verdict verdict-${statusKey}">
      <div><p class="verdict-k">${t('mission.checkpoint')}</p><h2>${t(`proof.status.${statusKey}`)}</h2>
        <p class="verdict-meta">${s.mission?.checkpointAt ? html`<span>${t('proof.due')} ${fmtDate(s.mission.checkpointAt)}</span>` : ''}
          ${cp ? html`<span>${t('proof.recorded')} ${fmtDate(cp.recordedAt)} · ${t(cp.demo ? 'proof.sourceDemo' : 'proof.sourceOwner')}</span>` : ''}</p></div>
      <span class="verdict-mark" aria-hidden="true">${icon(statusKey === 'success' ? 'check' : statusKey === 'miss' ? 'x' : 'clock', 40)}</span>
    </section>
    <div class="result-grid">${rows.map((r) => html`<article class="result ${r.pct >= 100 ? 'met' : ''}">
      <div class="result-top"><span>${t(`proof.${r.k}`)}</span>${r.pct >= 100 ? html`<span class="result-ok">${icon('check', 14)}</span>` : ''}</div>
      <strong class="has-src" tabindex="0" data-src="checkpointVal">${r.cur}</strong>
      <p class="result-sub"><span class="has-src" tabindex="0" data-src="baseline">${t('mission.baseline')} ${r.base}</span><span class="has-src" tabindex="0" data-src="target">${t('mission.target')} ${r.target}</span></p>
      ${meter(r.pct, t(`proof.${r.k}`))}</article>`)}</div>
    <p class="muted small">${t('proof.demoRequests', { n: demoReq })} ${demoBadge()}</p>

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
  const p = missionPlan(); const prev = getState().checkpoint;
  const reachGoal = Math.round(p.baseline.reach * (1 + p.target.reachPct / 100));
  const v = prev || { reach: reachGoal + 40, requests: Math.max(getState().bookings.length, p.target.requests), ctaClicks: 23, visibility: 80 };
  const f = (id, label, val) => html`<label class="field"><span>${label}</span><input id="${id}" type="number" min="0" max="999999" inputmode="numeric" value="${val}"></label>`;
  const res = await openModal({
    title: t('proof.recordTitle'),
    body: html`<p class="muted">${t('proof.recordBody')}</p>${f('cp-reach', t('proof.reach'), v.reach)}${f('cp-req', t('proof.requests'), v.requests)}${f('cp-cta', t('proof.ctaClicks'), v.ctaClicks)}${f('cp-vis', t('proof.visibility'), v.visibility)}<p class="small">${demoBadge()} ${t('proof.recordDemoNote')}</p>`,
    actions: [{ label: t('common.cancel'), kind: 'btn-ghost', value: false }, {
      label: t('proof.save'), kind: 'btn-primary',
      collect: () => {
        const n = (id, max) => Math.max(0, Math.min(max, Math.round(Number(document.getElementById(id)?.value) || 0)));
        return { reach: n('cp-reach', 999999), requests: n('cp-req', 9999), ctaClicks: n('cp-cta', 99999), visibility: n('cp-vis', 100) };
      },
    }],
  });
  if (!res || typeof res !== 'object') return;
  update({ checkpoint: { ...res, recordedAt: Date.now(), demo: true } });
  toast(t('proof.toastSaved'), 'success'); rerender();
};
