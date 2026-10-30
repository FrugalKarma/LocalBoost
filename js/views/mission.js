import { html, icon, toast, confirmDialog, copyText } from '../core.js';
import { t, fmtDate, fmtNumber } from '../i18n.js';
import { getState, update } from '../store.js';
import { missingItems, needsNames, cleanHandle } from '../business.js';
import { missionAgents, startMission, resetMission, missionPlan, isMissionRunning } from '../mission.js';
import { getAssets } from '../ai.js';
import { MISSION_HOURS } from '../data.js';
import { actions, rerender } from '../registry.js';
import { pageHead, aiNotice } from './shared.js';
import { needSignals } from '../collect.js';

const AGENT_ICON = { analyst: 'signals', strategist: 'diagnosis', creator: 'pack', builder: 'website', scout: 'sparkle' };

export async function launchMission() {
  if (isMissionRunning() || needSignals()) return;
  const res = await startMission(() => rerender());
  if (res.ok) toast(res.fallbacks?.length ? t('mission.toastDoneFallback') : t('mission.toastDone'), 'success');
  else toast(t('mission.toastError'), 'error');
}

export const mission = {
  id: 'mission',
  render() {
    const m = getState().mission; const p = missionPlan(); const o = p.opportunity;
    const busy = m?.status === 'running';
    const assets = getAssets();
    const reachGoal = Math.round(p.baseline.reach * (1 + p.target.reachPct / 100));
    const hoursLeft = m?.checkpointAt ? Math.max(0, Math.ceil((m.checkpointAt - Date.now()) / 3.6e6)) : MISSION_HOURS;
    const label = m?.status === 'active' ? 'active' : busy ? 'running' : m?.status === 'error' ? 'error' : 'idle';
    return html`
    ${pageHead({ note: '04', title: t('mission.title'), sub: t('mission.sub'),
      actions: html`${m ? html`<button class="btn btn-ghost" data-act="reset-mission" ${busy ? 'disabled' : ''}>${icon('refresh', 18)} ${t('actions.resetMission')}</button>` : ''}
        <button class="btn btn-primary btn-lg" data-act="start-mission" ${busy ? 'disabled' : ''}>${icon('play', 18)} ${m?.status === 'active' ? t('actions.restartMission') : t('actions.startMission')}</button>` })}
    <details class="sig-about"><summary>${icon('info', 16)} ${t('ai.noticeTitle')}</summary><p>${t('ai.notice')}</p></details>

    <section class="clock" aria-label="${t('mission.checkpoint')}">
      <div class="clock-top">
        <div><div class="clock-badges"><span class="badge badge-mission-${label}">${t(`mission.status.${label}`)}</span>
          ${m?.fallbacks?.length ? html`<span class="badge badge-inference">${t('mission.usedFallback')}</span>` : ''}</div>
          <p class="clock-big">${m?.checkpointAt ? t('ledger.hoursLeft', { h: hoursLeft }) : `${MISSION_HOURS} h`}</p>
          <p class="clock-sub">${m?.checkpointAt ? t('mission.checkpointAt', { date: fmtDate(m.checkpointAt) }) : t('mission.checkpointHint')}</p></div>
        ${o ? html`<div class="clock-offer"><span>${t('mission.offer')}</span><strong>${assets?.offer.title || o.title}</strong></div>` : ''}
      </div>
      <div class="clock-track" role="img" aria-label="${m?.checkpointAt ? t('ledger.hoursLeft', { h: hoursLeft }) : `${MISSION_HOURS} h`}">
        <i class="clock-fill" style="width:${m?.checkpointAt ? Math.round(((MISSION_HOURS - hoursLeft) / MISSION_HOURS) * 100) : 0}%"></i>
        ${[0, 12, 24, 36, 48].map((h) => html`<span class="clock-tick" style="left:${(h / MISSION_HOURS) * 100}%"><b>${h} h</b></span>`)}
      </div>
      <div class="clock-ends"><span>${m?.startedAt ? `${t('mission.started')} ${fmtDate(m.startedAt)}` : ''}</span><span>${t('mission.checkpoint')}</span></div>
      <p class="clock-note">${t('mission.honest')}</p>
    </section>

    <div class="mis-grid">
      <section class="card">
        <h2 class="card-title">${t('mission.plan')}</h2>
        ${o ? html`<dl class="plan">
          <div><dt>${t('mission.hypothesis')}</dt><dd>${o.hypothesis}</dd></div>
          <div><dt>${t('mission.audience')}</dt><dd>${o.audience}</dd></div>
        </dl>` : html`<p class="muted">${t('mission.noPlan')}</p>`}
        <div class="goal-grid">
          <div class="goal has-src" tabindex="0" data-src="target"><span>${t('proof.reach')}</span><p><s>${fmtNumber(p.baseline.reach)}</s>${icon('next', 16)}<b>${fmtNumber(reachGoal)}</b></p><small>+${p.target.reachPct}%</small></div>
          <div class="goal has-src" tabindex="0" data-src="target"><span>${t('proof.requests')}</span><p><s>${p.baseline.requests}</s>${icon('next', 16)}<b>≥ ${p.target.requests}</b></p><small>${t('mission.target')}</small></div>
          <div class="goal has-src" tabindex="0" data-src="baseline"><span>${t('proof.visibility')}</span><p><s>${p.baseline.visibility}</s>${icon('next', 16)}<b>↑</b></p><small>/100</small></div>
          <div class="goal"><span>${t('proof.ctaClicks')}</span><p><s>0</s>${icon('next', 16)}<b>↑</b></p><small>${t('mission.target')}</small></div>
        </div>
      </section>
      <section class="card" aria-live="polite">
        <h2 class="card-title">${t('mission.agents')}</h2>
        <ol class="pipe">${missionAgents().map((a) => { const st = m?.agents?.[a] || 'waiting'; return html`<li class="pipe-${st}">
          <span class="pipe-dot">${st === 'running' ? html`<i class="spin" aria-hidden="true"></i>` : st === 'complete' || st === 'fallback' ? icon('check', 14) : icon(AGENT_ICON[a], 14)}</span>
          <span class="pipe-txt"><strong>${t(`agents.${a}`)}</strong><small>${t(`agents.${a}Role`)}</small></span>
          <span class="pipe-st">${t(`mission.agent.${st}`)}</span></li>`; })}</ol>
      </section>
    </div>

    <h2 class="section-h">${t('mission.assets')}</h2>
    <div class="kit">
      ${[['website', getState().site.generated], ['pack', !!assets], ['proof', !!getState().checkpoint]].map(([r, ok]) => html`
        <button class="kit-tile" data-act="go" data-route="${r}" data-stage="${r === 'proof' ? 'measure' : 'act'}">
          <span class="kit-ic">${icon(r, 24)}</span><strong>${t(`nav.${r}`)}</strong>
          <span class="badge badge-${ok ? 'live' : 'inference'}">${t(ok ? 'common.ready' : 'common.pending')}</span>
          <span class="kit-go">${t('common.open')} ${icon('next', 16)}</span></button>`)}
    </div>
    ${nameIdeas()}`;
  },
};

function nameIdeas() {
  const n = getState().names; const miss = missingItems();
  if (!n) {
    if (!needsNames()) return '';
    return html`<section class="card span-12"><p class="tag">${t('tag.action')} · ${t('names.title')}</p><p class="muted">${t('names.pending')}</p></section>`;
  }
  const chip = (txt, kind) => html`<li class="name-idea"><span class="mono">${kind === 'handle' ? '@' : ''}${txt}</span>
    <button class="btn btn-ghost btn-sm" data-act="copy-name" data-text="${kind === 'handle' ? '@' : ''}${txt}">${icon('copy', 15)} ${t('actions.copy')}</button>
    ${kind === 'handle' && miss.instagram ? html`<button class="btn btn-secondary btn-sm" data-act="use-handle" data-net="instagram" data-handle="${txt}">${t('names.useIg')}</button>` : ''}
    ${kind === 'handle' && miss.tiktok ? html`<button class="btn btn-secondary btn-sm" data-act="use-handle" data-net="tiktok" data-handle="${txt}">${t('names.useTt')}</button>` : ''}
    ${kind === 'handle' && miss.facebook ? html`<button class="btn btn-secondary btn-sm" data-act="use-handle" data-net="facebook" data-handle="${txt}">${t('names.useFb')}</button>` : ''}</li>`;
  return html`<section class="card span-12"><p class="tag">${t('tag.action')} · ${t('names.title')}</p>
    <p class="muted">${t('names.sub')} <span class="badge badge-${n.mode === 'ai' ? 'live' : 'inference'}">${t(n.mode === 'ai' ? 'names.byAi' : 'names.byLocal')}</span></p>
    ${n.names.length ? html`<h4>${t('names.brands')}</h4><ul class="name-list">${n.names.map((x) => chip(x, 'name'))}</ul>` : ''}
    <h4>${t('names.handles')}</h4><ul class="name-list">${n.handles.map((x) => chip(x, 'handle'))}</ul>
    <p class="muted small">${t('names.availability')}</p></section>`;
}

actions['copy-name'] = async (el) => { toast((await copyText(el.dataset.text)) ? t('common.copied') : t('common.copyFailed'), 'success'); };
actions['use-handle'] = (el) => {
  const net = ['tiktok', 'facebook'].includes(el.dataset.net) ? el.dataset.net : 'instagram';
  update((s) => ({ business: { ...s.business, [net]: cleanHandle(el.dataset.handle), [{ tiktok: 'noTiktok', facebook: 'noFacebook', instagram: 'noInstagram' }[net]]: false, [`${net}Planned`]: true } }));
  toast(t('names.usedToast', { net: { tiktok: 'TikTok', facebook: 'Facebook', instagram: 'Instagram' }[net] }), 'success'); rerender();
};

actions['start-mission'] = () => launchMission();
actions['reset-mission'] = async () => {
  if (!(await confirmDialog(t('mission.resetTitle'), t('mission.resetBody'), t('actions.resetMission')))) return;
  resetMission(); toast(t('mission.toastReset'), 'info'); rerender();
};
