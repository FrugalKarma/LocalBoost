// AI layer: role-separated calls to /api/ai (server-side key), 16 s per call / 25 s per step, JSON repair,
// schema validation and a rule-based local fallback built from the same real data, so the app never blocks.
import { t, ta, getLang } from './i18n.js';
import { authHeaders } from './auth.js';
import { getState, update } from './store.js';
import { limit } from './core.js';
import { getBiz, cleanHandle } from './business.js';
import { evidenceForAi, competitorList, ruleProblems, OPP_OF, siteGaps } from './insights.js';
import { localNames } from './names.js';
import { apiUrl, onApiBaseChange } from './api.js';

export const AI_TIMEOUT_MS = 25000; // total budget for one step (the analysis makes two calls)
const CALL_TIMEOUT_MS = 16000; // budget for a single call; the server has its own 15 s upstream limit

/** Abort when either the step budget or the single-call budget runs out. */
function withTimeout(signal, ms) {
  const t = AbortSignal.timeout(ms);
  if (AbortSignal.any) return AbortSignal.any([signal, t]);
  const c = new AbortController(); const stop = () => c.abort();
  signal.addEventListener('abort', stop, { once: true }); t.addEventListener('abort', stop, { once: true });
  return c.signal;
}
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
    const n = (v, d, max) => { const x = Math.round(Number(v)); return Number.isFinite(x) && x >= 0 ? Math.min(max, x) : d; };
    return { opportunity: {
      title: str(p.title, 120), why: str(p.why_now), hypothesis: str(p.hypothesis, 500), impact: str(p.impact, 240),
      audience: str(p.audience, 240), confidence: pct(p.confidence, 70),
      target: { requests: n(p.target?.requests, 3, 200), reviews: n(p.target?.reviews, 2, 100) },
    } };
  },
  themes(o) {
    if (!o || !Array.isArray(o.themes)) return null;
    const items = o.themes.slice(0, 6).map((x) => ({ label: str(x?.label, 60), tone: x?.tone === 'gap' ? 'gap' : 'pos', mentions: Math.max(1, Math.min(999, Math.round(Number(x?.mentions) || 1))), quotes: strs(x?.quotes, 2, 160) })).filter((x) => x.label);
    return items.length ? { items } : null;
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
      services: Array.isArray(o.services) ? o.services.slice(0, 6).map((x) => ({ n: str(x?.name, 60), d: str(x?.description, 200) })).filter((x) => x.n) : [],
      faq: Array.isArray(o.faq) ? o.faq.slice(0, 4).map((f) => ({ q: str(f?.q, 140), a: str(f?.a, 300) })).filter((f) => f.q && f.a) : [],
    };
  },
};

/* ---------- transport ---------- */
/** Everything the AI may use: only real data the owner gave or LocalBoost measured. */
export function signalPayload() {
  const b = getBiz();
  return {
    business: { name: b.name || null, city: b.city, category: b.category, goal: b.goal, address: b.address || b.place?.address || null, website: b.website || null, phone: b.phone || null,
      instagram: b.instagram || null, tiktok: b.tiktok || null, facebook: b.facebook || null, openingHours: b.place?.hours || null, googleRating: b.place?.rating ?? null, googleReviewCount: b.place?.reviewCount ?? null },
    evidence: evidenceForAi(),
    competitors: competitorList().slice(0, 8).map((c) => ({ name: c.name, rating: c.rating, reviewCount: c.reviewCount, distanceM: c.distance ?? null, hasWebsite: !!c.website })),
  };
}

export class AiError extends Error { constructor(kind, msg) { super(msg || kind); this.kind = kind; } }

// One cheap probe per page load: static hosting or a key-less server means "no AI", with no repeated failing requests.
let availability = null;
export const resetAiAvailability = () => { availability = null; };
onApiBaseChange(resetAiAvailability);
export async function aiAvailable() {
  if (availability === null) {
    availability = fetch(apiUrl('/api/health'), { signal: AbortSignal.timeout(4000) }).then((r) => (r.ok ? r.json() : { ai: false })).then((j) => !!j.ai).catch(() => false);
  }
  return availability;
}

async function callRole(role, payload, signal) {
  const started = performance.now();
  const entry = { role, at: new Date().toISOString(), outcome: 'pending', ms: 0 };
  aiTrace.unshift(entry); aiTrace.length = Math.min(aiTrace.length, 20);
  try {
    if (!(await aiAvailable())) throw new AiError('not_configured');
    let res;
    const callSignal = withTimeout(signal, CALL_TIMEOUT_MS);
    try {
      res = await fetch(apiUrl('/api/ai'), { method: 'POST', headers: await authHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ role, lang: getLang(), payload }), signal: callSignal });
    } catch (e) {
      if (callSignal.aborted) throw new AiError('timeout');
      throw new AiError('unreachable', e.message);
    }
    if (!res.ok) throw new AiError('http', `HTTP ${res.status}`);
    const body = await res.json();
    if (body.error) throw new AiError(body.error === 'ai_not_configured' || body.error === 'auth_required' ? 'not_configured' : body.error === 'timeout' ? 'timeout' : 'http', body.error);
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

/* ---------- local fallbacks: rules over the real data (read live from the locale) ---------- */
const fill = (str0, vars) => String(str0).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
const bizVars = () => { const b = getBiz(); return { name: b.name || t('biz.unnamed'), city: (b.city || '').split(',')[0], kind: t(`biz.cat.${b.category}`).toLowerCase() }; };

export function localDiagnosis() {
  const rules = ruleProblems();
  const top = rules.slice(0, 3);
  const problems = top.length ? top.map((r) => ({ title: t(`rule.${r.key}.title`, r.vars), evidence: [t(`rule.${r.key}.ev`, r.vars)], kind: r.kind, confidence: Math.min(95, r.weight) }))
    : [{ title: t('rule.grow.title'), evidence: [t('rule.grow.ev')], kind: 'inference', confidence: 60 }];
  const opp = top.length ? OPP_OF[top[0].key] : 'grow';
  const v = { ...bizVars(), ...(top[0]?.vars || {}) };
  const b = getBiz();
  return {
    problems,
    facts: top.filter((r) => r.kind === 'fact').map((r) => t(`rule.${r.key}.ev`, r.vars)),
    inferences: top.filter((r) => r.kind !== 'fact').map((r) => t(`rule.${r.key}.ev`, r.vars)),
    needsOwner: ta('ai.needsOwner').map((x) => fill(x, v)),
    opportunity: {
      title: fill(t(`opp.${opp}.title`), v), why: fill(t(`opp.${opp}.why`), v), hypothesis: fill(t(`opp.${opp}.hyp`), v), impact: fill(t(`opp.${opp}.impact`), v),
      audience: fill(t(`opp.${opp}.audience`), v), confidence: top[0] ? Math.min(85, top[0].weight - 5) : 55,
      target: { requests: b.goal === 'bookings' ? 3 : 1, reviews: opp === 'reviews' || opp === 'google' ? 3 : 1 },
    },
    gaps: siteGaps(),
  };
}

export function localAssets(v = {}) {
  const vars = bizVars();
  const pick = (key, i = 0) => { const a = ta(key); return a.length ? fill(a[(i || 0) % a.length], vars) : ''; };
  const goal = getBiz().goal;
  const hs = ta(`gen.headlines`); const hi = ((v.headlines || 0) * 3) % Math.max(hs.length, 1);
  return {
    offer: { title: pick('gen.offerTitle', v.offer), body: pick('gen.offerBody', v.offer), cta: t(`gen.cta.${goal}`) },
    post: { text: pick('gen.post', v.post), cta: t(`gen.cta.${goal}`) },
    headlines: [0, 1, 2].map((k) => fill(hs[(hi + k) % hs.length] || '', vars)),
    merch: { concept: pick('gen.merchConcept', v.merch), stickerText: pick('gen.stickerText', v.merch).toUpperCase() },
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

/** Themes across reviews and pasted comments (AI only; without AI the Signals screen lists them one by one). */
export async function runThemes(texts) {
  try {
    const r = await callRole('themes', { business: signalPayload().business, texts: texts.slice(0, 80) }, deadline());
    return { mode: 'ai', items: r.items, at: new Date().toISOString() };
  } catch (e) { return { mode: 'none', reason: e.kind || 'error', items: [], at: new Date().toISOString() }; }
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
  return ['timeout', 'not_configured', 'invalid_json', 'unreachable', 'http', 'not_run'].includes(reason) ? `ai.reason.${reason}` : 'ai.reason.error';
}
