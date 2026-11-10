// What each plan includes, on the client. The server enforces the same rules (lib/auth-core.mjs, lib/site-core.mjs).
import { html, icon, openModal, $, toast } from './core.js';
import { t, ta } from './i18n.js';
import { authOn, signedIn, getSession, isAdmin, requestTrial, planRequest } from './auth.js';

export const PLAN_RANK = { free: 0, pro: 1, business: 2 };
/** Feature → lowest plan that has it. */
export const FEATURES = {
  // Growth ('pro') has every tool; Custom Premium ('business') adds a premium site, own domain and hands-on support, done by the team.
  publish: 'pro', download: 'pro', inbox: 'pro', stats: 'pro', noBranding: 'pro',
  chat: 'pro', pack: 'pro', replies: 'pro', poster: 'pro', unlimitedAi: 'pro',
};
/** Current plan. Without accounts (self-hosted) everything is on. */
export function currentPlan() {
  if (!authOn() || !signedIn()) return 'business';
  return getSession()?.plan || 'free';
}
export const can = (feature) => PLAN_RANK[currentPlan()] >= PLAN_RANK[FEATURES[feature] || 'free'];
export const needFor = (feature) => FEATURES[feature] || 'free';
/** An account without a plan can look around but not run anything that costs (Google, AI, the site). */
export const noPlan = () => currentPlan() === 'free' && !isAdmin();
/** Buttons that need a plan. The server refuses the same calls with plan_required. */
export const PAID_ACTS = new Set(['run-analysis', 'run-analysis-go', 'collect-signals', 'gen-site', 'gen-assets', 'regen-asset', 'replies-gen', 'ai-write',
  'lookup-go', 'lookup-pick', 'qs-go', 'qs-pick', 'scan-comp', 'add-comp', 'start-mission', 'chat-open']);

/** Shown when an account without a plan presses a paid button: pick a plan, or ask the owner for a free trial. */
export function noPlanPrompt() {
  const asked = planRequest() === 'trial';
  return openModal({
    title: t('noplan.title'),
    body: html`<p>${t('noplan.body')}</p>
      ${asked ? html`<p class="pay-pending">${icon('check', 16)} ${t('noplan.asked')}</p>`
        : html`<label class="field"><span>${t('noplan.noteLabel')}</span><textarea id="np-note" rows="3" maxlength="500" placeholder="${t('noplan.notePh')}"></textarea></label>`}`,
    actions: [{ label: t('upgrade.seePlans'), kind: 'btn-ghost', value: 'plans' },
      ...(asked ? [] : [{ label: t('noplan.ask'), kind: 'btn-primary', collect: () => ({ note: $('#np-note')?.value.trim() || '' }) }])],
  }).then(async (v) => {
    if (v === 'plans') { location.hash = '#/plans'; return; }
    if (!v || typeof v !== 'object') return;
    const r = await requestTrial(v.note);
    toast(t(r.planRequest ? 'noplan.sent' : r.error === 'rate_limited' ? 'noplan.rate' : 'common.errorGeneric'), r.planRequest ? 'success' : 'error');
  });
}

/** Small lock badge used next to locked features. */
export const lockBadge = (feature) => html`<span class="lock-badge">${icon('star', 13)} ${t(`plans.${needFor(feature)}.name`)}</span>`;

/** Explains what the feature needs and how to get it. */
export function upgradePrompt(feature) {
  const need = needFor(feature);
  return openModal({
    title: t('upgrade.title', { plan: t(`plans.${need}.name`) }),
    body: html`<p>${t(`upgrade.why.${feature}`)}</p>
      <ul class="up-list">${ta(`plans.${need}.features`).map((f) => html`<li>${icon('check', 16)} ${f}</li>`)}</ul>
      <p class="muted">${t('upgrade.how')}</p>`,
    actions: [{ label: t('common.close'), kind: 'btn-ghost', value: null }, { label: t('upgrade.seePlans'), kind: 'btn-primary', value: 'plans' }],
  }).then((v) => { if (v === 'plans') location.hash = '#/plans'; });
}
