// What each plan includes, on the client. The server enforces the same rules (lib/auth-core.mjs, lib/site-core.mjs).
import { html, icon, openModal } from './core.js';
import { t, ta } from './i18n.js';
import { authOn, signedIn, getSession } from './auth.js';

export const PLAN_RANK = { free: 0, pro: 1, business: 2 };
/** Feature → lowest plan that has it. */
export const FEATURES = {
  publish: 'business', download: 'business', inbox: 'business', stats: 'business', noBranding: 'business',
  chat: 'pro', pack: 'pro', replies: 'pro', poster: 'pro', unlimitedAi: 'pro',
};
/** Current plan. Without accounts (self-hosted) everything is on. */
export function currentPlan() {
  if (!authOn() || !signedIn()) return 'business';
  return getSession()?.plan || 'free';
}
export const can = (feature) => PLAN_RANK[currentPlan()] >= PLAN_RANK[FEATURES[feature] || 'free'];
export const needFor = (feature) => FEATURES[feature] || 'free';
export function aiAllowance() {
  const s = getSession();
  if (currentPlan() !== 'free' || !s) return null;
  return { used: s.aiUsed || 0, limit: s.aiLimit || 3 };
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
