// Mission Control orchestration: four agents move waiting -> running -> complete.
import { getState, update, updateSite } from './store.js';
import { runDiagnosis, runAssets, runBuilder, runNames, getDiagnosis, ensureAssetsSync, ensureDiagnosisSync } from './ai.js';
import { needsNames } from './business.js';
import { MISSION_HOURS, BASELINE, TARGET } from './data.js';
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
    update({ mission: { status: 'running', startedAt: Date.now(), agents: Object.fromEntries(missionAgents().map((a) => [a, 'waiting'])) } });
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
  return { opportunity: o, baseline: o?.baseline || BASELINE, target: { reachPct: o?.target.reachPct || TARGET.reachPct, requests: o?.target.requests || TARGET.requests } };
}

/** Evaluate a recorded checkpoint against the target. */
export function evaluateCheckpoint(cp) {
  const p = missionPlan();
  const reachGoal = Math.round(p.baseline.reach * (1 + p.target.reachPct / 100));
  const reachOk = cp.reach >= reachGoal; const reqOk = cp.requests >= p.target.requests;
  const status = reachOk && reqOk ? 'success' : reachOk || reqOk || cp.ctaClicks > 0 ? 'partial' : 'miss';
  return { status, reachGoal, reachOk, reqOk };
}
