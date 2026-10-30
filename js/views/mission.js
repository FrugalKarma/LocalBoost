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
    ${aiNotice()}
    <div class="status-strip"><span class="badge badge-mission-${label}">${t(`mission.status.${label}`)}</span>
      ${m?.startedAt ? html`<span class="mono small">${t('mission.started')} ${fmtDate(m.startedAt)}</span>` : ''}
      ${m?.fallbacks?.length ? html`<span class="badge badge-inference">${t('mission.usedFallback')}</span>` : ''}</div>

    <div class="bento">
      <section class="card span-5" aria-live="polite">
        <p class="tag">${t('tag.action')} · ${t('mission.agents')}</p>
        <ul class="agents">${missionAgents().map((a) => { const st = m?.agents?.[a] || 'waiting'; return html`<li class="agent agent-${st}">
          <span class="agent-ic">${icon(AGENT_ICON[a], 20)}</span>
          <span class="agent-txt"><strong>${t(`agents.${a}`)}</strong><small>${t(`agents.${a}Role`)}</small></span>
          <span class="agent-st">${st === 'running' ? html`<i class="spin" aria-hidden="true"></i>` : st === 'complete' || st === 'fallback' ? icon('check', 16) : ''}${t(`mission.agent.${st}`)}</span></li>`; })}</ul>
      </section>

      <section class="card span-7">
        <p class="tag">${t('tag.evidence')} · ${t('mission.plan')}</p>
        ${o ? html`<dl class="plan">
          <div><dt>${t('mission.hypothesis')}</dt><dd>${o.hypothesis}</dd></div>
          <div><dt>${t('mission.audience')}</dt><dd>${o.audience}</dd></div>
          <div><dt>${t('mission.offer')}</dt><dd>${assets?.offer.title || o.title}</dd></div>
        </dl>` : html`<p class="muted">${t('mission.noPlan')}</p>`}
        <div class="table-wrap"><table class="table"><thead><tr><th></th><th>${t('mission.baseline')}</th><th>${t('mission.target')}</th></tr></thead><tbody>
          <tr><th scope="row">${t('proof.reach')}</th><td class="has-src" tabindex="0" data-src="baseline">${fmtNumber(p.baseline.reach)}</td><td class="has-src" tabindex="0" data-src="target">${fmtNumber(reachGoal)} <small>(+${p.target.reachPct}%)</small></td></tr>
          <tr><th scope="row">${t('proof.requests')}</th><td class="has-src" tabindex="0" data-src="baseline">${p.baseline.requests}</td><td class="has-src" tabindex="0" data-src="target">≥ ${p.target.requests}</td></tr>
          <tr><th scope="row">${t('proof.visibility')}</th><td class="has-src" tabindex="0" data-src="baseline">${p.baseline.visibility}/100</td><td class="has-src" tabindex="0" data-src="target">↑</td></tr>
          <tr><th scope="row">${t('proof.ctaClicks')}</th><td>0</td><td>↑</td></tr></tbody></table></div>
      </section>

      <section class="card span-7">
        <p class="tag">${t('tag.action')} · ${t('mission.assets')}</p>
        <ul class="asset-links">
          <li><span>${icon('website', 18)} ${t('nav.website')}</span><span class="badge badge-${getState().site.generated ? 'live' : 'inference'}">${t(getState().site.generated ? 'common.ready' : 'common.pending')}</span><button class="btn btn-ghost btn-sm" data-act="go" data-route="website">${t('common.open')}</button></li>
          <li><span>${icon('pack', 18)} ${t('nav.pack')}</span><span class="badge badge-${assets ? 'live' : 'inference'}">${t(assets ? 'common.ready' : 'common.pending')}</span><button class="btn btn-ghost btn-sm" data-act="go" data-route="pack">${t('common.open')}</button></li>
          <li><span>${icon('proof', 18)} ${t('nav.proof')}</span><span class="badge badge-${getState().checkpoint ? 'live' : 'inference'}">${t(getState().checkpoint ? 'common.ready' : 'common.pending')}</span><button class="btn btn-ghost btn-sm" data-act="go" data-route="proof">${t('common.open')}</button></li>
        </ul>
      </section>

      <section class="card card-accent span-5">
        <p class="tag">${t('tag.checkpoint')} · ${t('mission.checkpoint')}</p>
        ${m?.checkpointAt ? html`<p class="big-num sm">${hoursLeft} h</p><p>${t('mission.checkpointAt', { date: fmtDate(m.checkpointAt) })}</p>` : html`<p class="big-num sm">${MISSION_HOURS} h</p><p class="muted">${t('mission.checkpointHint')}</p>`}
        <p class="muted small">${t('mission.honest')}</p>
      </section>
      ${nameIdeas()}
    </div>`;
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
