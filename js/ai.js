// AI layer: role-separated calls to /api/ai (server-side key), 8 s deadline, JSON repair,
// schema validation and a deterministic local fallback so the demo can never block.
import { t, ta, getLang } from './i18n.js';
import { getState, update } from './store.js';
import { BUSINESS, SIGNALS, BASELINE, TARGET } from './data.js';
import { limit } from './core.js';
import { getBiz, cleanHandle, socialSignals } from './business.js';
import { localNames } from './names.js';

export const AI_TIMEOUT_MS = 8000;
export const aiTrace = []; // developer-facing transparency log (no secrets)

/* ---------- JSON repair + validation ---------- */
export function repairJSON(input) {
  if (input && typeof input === 'object') return input;
  if (typeof input !== 'string') return null;
  let x = input.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = x.indexOf('{'); const b = x.lastIndexOf('}');
  if (a >= 0 && b > a) x = x.slice(a, b + 1);
  try { return JSON.parse(x); } catch { /* try light repairs */ }
  x = x.replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, '$1').replace(/'([^'\n]*)'\s*:/g, '"$1":');
  try { return JSON.parse(x); } catch { return null; }
}

const str = (v, n = 400) => (typeof v === 'string' ? limit(v.trim(), n) : '');
const pct = (v, d = 60) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : d; };
const strs = (v, n = 4, m = 200) => (Array.isArray(v) ? v.map((s) => str(s, m)).filter(Boolean).slice(0, n) : []);

export const validators = {
  analyst(o) {
    if (!o || !Array.isArray(o.problems)) return null;
    const problems = o.problems.slice(0, 3).map((p) => ({
      title: str(p?.title, 140), evidence: strs(p?.evidence, 3, 180),
      kind: p?.kind === 'fact' ? 'fact' : 'inference', confidence: pct(p?.confidence),
    })).filter((p) => p.title);
    if (!problems.length) return null;
    return { problems, facts: strs(o.facts), inferences: strs(o.inferences), needsOwner: strs(o.needs_owner) };
  },
  strategist(o) {
    const p = o?.opportunity;
    if (!p || !str(p.title) || !str(p.hypothesis)) return null;
    return { opportunity: {
      title: str(p.title, 120), why: str(p.why_now), hypothesis: str(p.hypothesis, 500), impact: str(p.impact, 240),
      audience: str(p.audience, 240), confidence: pct(p.confidence, 75),
      baseline: { visibility: pct(p.baseline?.visibility, BASELINE.visibility), reach: Number(p.baseline?.reach) || BASELINE.reach, requests: Number(p.baseline?.requests) || 0 },
      target: { reachPct: Number(p.target?.reach_pct) || TARGET.reachPct, requests: Number(p.target?.requests) || TARGET.requests },
    } };
  },
  creator(o) {
    if (!o || !str(o.offer?.title) || !str(o.post?.text) || !Array.isArray(o.headlines)) return null;
    return {
      offer: { title: str(o.offer.title, 100), body: str(o.offer.body, 400), cta: str(o.offer.cta, 80) },
      post: { text: str(o.post.text, 600), cta: str(o.post.cta, 80) },
      headlines: strs(o.headlines, 3, 120),
      merch: { concept: str(o.merch?.concept, 300), stickerText: str(o.merch?.sticker_text, 40) },
    };
  },
  namer(o) {
    if (!o || !Array.isArray(o.handles)) return null;
    const handles = [...new Set(o.handles.map((h) => cleanHandle(h)).filter((h) => h.length >= 3))].slice(0, 6);
    if (!handles.length) return null;
    return { handles, names: strs(o.names, 6, 60) };
  },
  builder(o) {
    if (!o || !str(o.headline) || !str(o.cta)) return null;
    return {
      headline: str(o.headline, 110), subheadline: str(o.subheadline, 240), cta: str(o.cta, 40),
      offerTitle: str(o.offer_title, 80), offerText: str(o.offer_text, 300),
      faq: Array.isArray(o.faq) ? o.faq.slice(0, 4).map((f) => ({ q: str(f?.q, 140), a: str(f?.a, 300) })).filter((f) => f.q && f.a) : [],
    };
  },
};

/* ---------- transport ---------- */
export function signalPayload() {
  const user = getState().userSignals.map((s) => ({ id: s.id, source: s.source, evidence: s.evidence, data: 'user' }));
  const demo = [...SIGNALS, ...socialSignals().used].map((s) => ({ id: s.id, type: s.type, source: s.source, status: s.status, confidence: s.confidence, evidence: t(`d.${s.id}`) }));
  return {
    business: { name: getBiz().name, city: getBiz().city, category: getBiz().category, goal: getBiz().goal, website: getBiz().website || null, instagram: getBiz().instagram || null, tiktok: getBiz().tiktok || null, facebook: getBiz().facebook || null, rating: BUSINESS.rating, visibility: BUSINESS.visibility, reach: BUSINESS.reach, trend: BUSINESS.trend },
    dataMode: 'demo', signals: [...demo, ...user],
  };
}

export class AiError extends Error { constructor(kind, msg) { super(msg || kind); this.kind = kind; } }

// One cheap probe per page load: static hosting or a key-less server means "no AI", with no repeated failing requests.
let availability = null;
async function aiAvailable() {
  if (availability === null) {
    availability = fetch('/api/health', { signal: AbortSignal.timeout(2500) }).then((r) => (r.ok ? r.json() : { ai: false })).then((j) => !!j.ai).catch(() => false);
  }
  return availability;
}

async function callRole(role, payload, signal) {
  const sim = getState().aiSim;
  const started = performance.now();
  const entry = { role, at: new Date().toISOString(), outcome: 'pending', ms: 0 };
  aiTrace.unshift(entry); aiTrace.length = Math.min(aiTrace.length, 20);
  try {
    if (sim === 'timeout') {
      await new Promise((_, rej) => { signal.addEventListener('abort', () => rej(new AiError('timeout')), { once: true }); });
    }
    if (sim === 'error') throw new AiError('simulated', 'Simulated provider error');
    if (!(await aiAvailable())) throw new AiError('not_configured');
    let res;
    try {
      res = await fetch('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role, lang: getLang(), payload }), signal });
    } catch (e) {
      if (signal.aborted) throw new AiError('timeout');
      throw new AiError('unreachable', e.message);
    }
    if (!res.ok) throw new AiError('http', `HTTP ${res.status}`);
    const body = await res.json();
    if (body.error) throw new AiError(body.error === 'ai_not_configured' ? 'not_configured' : body.error === 'timeout' ? 'timeout' : 'http', body.error);
    const parsed = repairJSON(body.text ?? body.json);
    const valid = validators[role](parsed);
    if (!valid) throw new AiError('invalid_json');
    entry.outcome = 'ok'; entry.model = body.model;
    return valid;
  } catch (e) {
    entry.outcome = e.kind || 'error';
    throw e;
  } finally {
    entry.ms = Math.round(performance.now() - started);
  }
}

const deadline = () => AbortSignal.timeout(AI_TIMEOUT_MS);

/* ---------- deterministic local fallbacks (read live from the locale) ---------- */
export function localDiagnosis() {
  const problems = [1, 2, 3].map((n) => ({
    title: t(`ai.p${n}.title`), evidence: [t(`ai.p${n}.ev1`), t(`ai.p${n}.ev2`)],
    kind: n === 3 ? 'inference' : 'fact', confidence: [86, 91, 78][n - 1],
  }));
  return {
    problems, facts: ta('ai.facts'), inferences: ta('ai.inferences'), needsOwner: ta('ai.needsOwner'),
    opportunity: {
      title: t('ai.opp.title'), why: t('ai.opp.why'), hypothesis: t('ai.opp.hyp'), impact: t('ai.opp.impact'),
      audience: t('ai.opp.audience'), confidence: 82, baseline: { ...BASELINE }, target: { reachPct: TARGET.reachPct, requests: TARGET.requests },
    },
  };
}

export function localAssets(v = {}) {
  const pick = (key, i = 0) => { const a = ta(key); return a.length ? a[(i || 0) % a.length] : ''; };
  const hs = ta('gen.headlines'); const hi = ((v.headlines || 0) * 3) % Math.max(hs.length, 1);
  return {
    offer: { title: pick('gen.offerTitle', v.offer), body: pick('gen.offerBody', v.offer), cta: t('gen.cta') },
    post: { text: pick('gen.post', v.post).replaceAll('{brand}', getBiz().name || t('biz.unnamed')), cta: t('gen.cta') },
    headlines: [0, 1, 2].map((k) => hs[(hi + k) % hs.length]),
    merch: { concept: pick('gen.merchConcept', v.merch), stickerText: pick('gen.stickerText', v.merch) },
  };
}

/* ---------- public API ---------- */
export async function runDiagnosis({ onStep } = {}) {
  const started = Date.now();
  const signal = deadline();
  const payload = signalPayload();
  let mode = 'fallback'; let reason = null; let data = null;
  try {
    onStep?.(1);
    const an = await callRole('analyst', payload, signal);
    onStep?.(2);
    const st = await callRole('strategist', { ...payload, problems: an.problems }, signal);
    data = { ...an, ...st }; mode = 'ai';
  } catch (e) {
    reason = e.kind || 'error';
    console.warn('[LocalBoost] AI unavailable, using local analysis:', reason); // developer log only
  }
  const result = { mode, reason, timestamp: new Date().toISOString(), lang: getLang(), durationMs: Date.now() - started, data };
  update({ diagnosis: result });
  return result;
}

export function getDiagnosis() {
  const d = getState().diagnosis;
  if (!d) return null;
  return { ...d, data: d.mode === 'ai' && d.data ? d.data : localDiagnosis() };
}

export async function runAssets() {
  const signal = deadline();
  const diag = getDiagnosis();
  let mode = 'fallback'; let ai = null; let reason = null;
  try {
    ai = await callRole('creator', { ...signalPayload(), opportunity: diag?.data.opportunity }, signal);
    mode = 'ai';
  } catch (e) { reason = e.kind || 'error'; console.warn('[LocalBoost] creator fallback:', reason); }
  const prev = getState().assets;
  update({ assets: { mode, reason, ai, lang: getLang(), timestamp: new Date().toISOString(), variants: prev?.variants || { offer: 0, post: 0, headlines: 0, merch: 0 }, approved: {} } });
  return mode;
}

export function getAssets() {
  const a = getState().assets;
  if (!a) return null;
  const local = localAssets(a.variants);
  if (a.mode === 'ai' && a.ai) {
    const v = a.variants;
    return {
      ...a,
      offer: v.offer ? local.offer : a.ai.offer, post: v.post ? local.post : a.ai.post,
      headlines: v.headlines ? local.headlines : (a.ai.headlines.length === 3 ? a.ai.headlines : local.headlines),
      merch: v.merch ? local.merch : a.ai.merch,
    };
  }
  return { ...a, ...local };
}

export function ensureAssetsSync() {
  if (!getState().assets) {
    update({ assets: { mode: 'fallback', reason: 'not_configured', ai: null, lang: getLang(), timestamp: new Date().toISOString(), variants: { offer: 0, post: 0, headlines: 0, merch: 0 }, approved: {} } });
  }
  return getAssets();
}

export function ensureDiagnosisSync() {
  if (!getState().diagnosis) {
    update({ diagnosis: { mode: 'fallback', reason: 'not_run', timestamp: new Date().toISOString(), lang: getLang(), durationMs: 0, data: null } });
  }
  return getDiagnosis();
}

export function regenAsset(kind) {
  const a = getState().assets; if (!a) return;
  const variants = { ...a.variants, [kind]: (a.variants[kind] || 0) + 1 };
  update({ assets: { ...a, variants } });
}

/** Website copy (Website Builder role) - returns {mode, copy|null}. */
export async function runBuilder() {
  const signal = deadline();
  try {
    const copy = await callRole('builder', { ...signalPayload(), opportunity: getDiagnosis()?.data.opportunity }, signal);
    return { mode: 'ai', copy };
  } catch (e) {
    console.warn('[LocalBoost] builder fallback:', e.kind);
    return { mode: 'fallback', copy: null, reason: e.kind };
  }
}

/** Name Scout: handle/name ideas for accounts the business does not have yet. */
export async function runNames() {
  const signal = deadline();
  const b = getBiz();
  let mode = 'fallback'; let data = null;
  try {
    data = await callRole('namer', { business: { name: b.name || null, city: b.city, category: b.category }, needName: b.noName && !b.name, lang: getLang() }, signal);
    mode = 'ai';
    if (!(b.noName && !b.name)) data.names = [];
  } catch (e) { console.warn('[LocalBoost] namer fallback:', e.kind); }
  if (!data) data = localNames();
  update({ names: { mode, handles: data.handles, names: data.names || [], lang: getLang(), timestamp: new Date().toISOString() } });
  return mode;
}

export function reasonKey(reason) {
  return ['timeout', 'not_configured', 'invalid_json', 'simulated', 'unreachable', 'http', 'not_run'].includes(reason) ? `ai.reason.${reason}` : 'ai.reason.error';
}
