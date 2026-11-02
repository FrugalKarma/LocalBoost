// Mission Control orchestration: four agents move waiting -> running -> complete.
import { getState, update, updateSite } from './store.js';
import { runDiagnosis, runAssets, runBuilder, runNames, getDiagnosis, ensureAssetsSync, ensureDiagnosisSync } from './ai.js';
import { needsNames } from './business.js';
import { MISSION_HOURS, liveMetrics, loadSiteData } from './insights.js';
import { sleep } from './core.js';
import { getLang } from './i18n.js';

export const AGENTS = ['analyst', 'strategist', 'creator', 'builder'];
/** The Name Scout joins the mission only when the business lacks a name or a social account. */
export const missionAgents = () => (needsNames() ? [...AGENTS, 'scout'] : AGENTS);
let running = false;
export const isMissionRunning = () => running;

const setAgent = (id, status, extra = {}) => update((s) => ({ mission: { ...s.mission, agents: { ...s.mission.agents, [id]: status }, ...extra } }));

export async function startMission(onChange = () => {}) {
  if (running) return { ok: false };
  running = true;
  const fallbacks = [];
  try {
    await loadSiteData(true).catch(() => {});
    // baseline = the real numbers right before the experiment (null where nothing is measured yet)
    const baseline = { ...liveMetrics(Date.now() - MISSION_HOURS * 3600e3), at: Date.now() };
    update({ mission: { status: 'running', startedAt: Date.now(), baseline, agents: Object.fromEntries(missionAgents().map((a) => [a, 'waiting'])) }, checkpoint: null });
    onChange();
    const step = async (id, work) => {
      setAgent(id, 'running'); onChange();
      const t0 = Date.now();
      const mode = await work();
      await sleep(Math.max(0, 650 - (Date.now() - t0)));
      const st = mode === 'fallback' ? 'fallback' : 'complete';
      if (st === 'fallback') fallbacks.push(id);
      setAgent(id, st); onChange();
    };
    await step('analyst', async () => {
      if (!getState().diagnosis) return (await runDiagnosis()).mode;
      return getState().diagnosis.mode;
    });
    await step('strategist', async () => (getState().diagnosis?.mode || 'fallback'));
    await step('creator', async () => (getState().assets ? getState().assets.mode : runAssets()));
    await step('builder', async () => {
      const r = await runBuilder();
      updateSite({ generated: true, ai: r.mode === 'ai' ? { lang: getLang(), copy: r.copy } : null, variants: { hero: 0, offer: 0, faq: 0 } });
      return r.mode;
    });
    if (needsNames()) await step('scout', async () => runNames());
    ensureDiagnosisSync(); ensureAssetsSync();
    const startedAt = getState().mission.startedAt;
    update((s) => ({ mission: { ...s.mission, status: 'active', checkpointAt: startedAt + MISSION_HOURS * 3600 * 1000, fallbacks } }));
    onChange();
    return { ok: true, fallbacks };
  } catch (e) {
    console.error('[LocalBoost] mission error', e); // developer log only
    update((s) => ({ mission: { ...s.mission, status: 'error' } }));
    onChange();
    return { ok: false };
  } finally { running = false; }
}

export function resetMission() {
  update({ mission: null, checkpoint: null });
}

export function missionPlan() {
  const d = getDiagnosis();
  const o = d?.data.opportunity;
  const m = getState().mission;
  return { opportunity: o, baseline: m?.baseline || null, target: { requests: o?.target?.requests ?? 3, reviews: o?.target?.reviews ?? 2 } };
}

/**
 * Measures the mission window with real numbers: website visits, clicks and requests since the start,
 * new Google reviews since the baseline, plus requests the owner received elsewhere (phone, DMs) if they add them.
 */
export function measureNow(extraRequests = 0) {
  const p = missionPlan(); const m = getState().mission;
  const since = m?.startedAt || Date.now();
  const now = liveMetrics(since);
  const base = p.baseline || {};
  const newReviews = now.reviewCount != null && base.reviewCount != null ? Math.max(0, now.reviewCount - base.reviewCount) : null;
  return {
    views: now.views, clicks: now.clicks, siteRequests: now.requests, extraRequests: Math.max(0, Math.round(extraRequests) || 0),
    requests: (now.requests || 0) + (Math.max(0, Math.round(extraRequests) || 0)),
    rating: now.rating, reviewCount: now.reviewCount, newReviews, recordedAt: Date.now(),
  };
}

/** Compare a checkpoint with the target: success when both goals are met, partial when one is. */
export function evaluateCheckpoint(cp) {
  const p = missionPlan();
  const reqOk = cp.requests >= p.target.requests;
  const revOk = cp.newReviews != null && cp.newReviews >= p.target.reviews;
  const status = reqOk && (revOk || cp.newReviews == null) ? 'success' : reqOk || revOk || (cp.clicks || 0) > 0 ? 'partial' : 'miss';
  return { status, reqOk, revOk };
}
