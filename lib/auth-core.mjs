// Accounts, cloud data and the admin area, shared by server.mjs and the Vercel functions in api/.
// The browser only talks to /api/auth, /api/data and /api/admin. This file talks to Supabase:
//   Auth (sign-up, sign-in, tokens, password reset) with the public key,
//   the database and admin actions with the secret key, which never leaves the server.
// Without SUPABASE_URL + both keys, accounts are off and the app keeps working on-device only.

const env = (k) => (process.env[k] || '').trim();
const SB = () => env('SUPABASE_URL').replace(/\/+$/, '');
const PUBLIC_KEY = () => env('SUPABASE_ANON_KEY') || env('SUPABASE_PUBLISHABLE_KEY');
const SECRET_KEY = () => env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_SECRET_KEY');
import { ownerLogin, isOwnerToken, ownerUser, maintenance, previewUnlock, isPreviewPass, prelaunchAllowed } from './owner-core.mjs';
import { safeRedirect, publicUrl } from './public-url.mjs';
import { sendMails, mailOn, simpleMail } from './mail.mjs';
import { BRAND } from '../js/brand.js';
import { randomInt } from 'node:crypto';
export const authEnabled = () => !!(SB() && PUBLIC_KEY() && SECRET_KEY());

const MAX_DATA = 600 * 1024; // one business, serialised
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const out = (status, body) => ({ status, body });

/* ---------- plans ---------- */
// free: everything to try, AI analysis 3 per month, website preview only (watermarked)
// pro: unlimited AI, Ask Arcton, action pack, review replies, QR poster; website preview only
// business: everything in Pro + publish the website, booking requests, visit stats, download, no Arcton Ai branding
export const PLANS = ['free', 'pro', 'business'];
export const PLAN_RANK = { free: 0, pro: 1, business: 2 };
export const FREE_AI_PER_MONTH = Number(process.env.LOCALBOOST_FREE_AI_PER_MONTH) || 3;
// Fair-use limits per client, so one account cannot burn the Google or AI budget. Admins are not limited.
// Google lookups count per calendar month, AI requests (every kind, chat included) per day.
// An account without a plan ('free') can look around but not use Google or the AI: it asks for a plan or a free trial.
export const LIMITS = { places: { free: 0, pro: 100, business: 250 }, ai: { free: 0, pro: 150, business: 300 } };
/** Admins always get everything; an unknown value counts as free. */
const GRACE_DAYS = 7; // a paid plan keeps working a week past its end date, so a late transfer does not lock anyone out
const expired = (until) => !!until && Date.parse(`${until}T00:00:00Z`) + (GRACE_DAYS + 1) * 864e5 < Date.now();
export const planOf = (profile) => (profile?.role === 'admin' ? 'business' : PLANS.includes(profile?.plan) && !expired(profile.plan_until) ? profile.plan : 'free');
export const atLeast = (plan, need) => PLAN_RANK[plan] >= PLAN_RANK[need];
const fail = (status, error, extra = {}) => out(status, { error, ...extra });

/* ---------- Supabase calls ---------- */
// New-style keys (sb_publishable_…, sb_secret_…) go only in the apikey header; legacy JWT keys also as Bearer.
function headers(key, bearer, prefer) {
  const h = { apikey: key, 'content-type': 'application/json' };
  const b = bearer || (key.startsWith('sb_') ? '' : key);
  if (b) h.authorization = `Bearer ${b}`;
  if (prefer) h.prefer = prefer;
  return h;
}
async function sb(path, { method = 'GET', key = SECRET_KEY(), bearer, body, prefer } = {}) {
  let r;
  try {
    r = await fetch(SB() + path, { method, headers: headers(key, bearer, prefer), body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
  } catch { return { ok: false, status: 0, json: null }; }
  const text = await r.text(); let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  return { ok: r.ok, status: r.status, json };
}
export const rest = (path, opts) => sb(`/rest/v1/${path}`, opts);

/** Uploads a file to Supabase Storage (public bucket) and returns its public URL, or null. */
export async function storageUpload(bucket, path, bytes, contentType) {
  const key = SECRET_KEY(); const h = { apikey: key, 'content-type': contentType, 'x-upsert': 'false', 'cache-control': '31536000' };
  if (!key.startsWith('sb_')) h.authorization = `Bearer ${key}`;
  try {
    const r = await fetch(`${SB()}/storage/v1/object/${bucket}/${path}`, { method: 'POST', headers: h, body: bytes, signal: AbortSignal.timeout(20000) });
    if (!r.ok) { console.warn('[Arcton] storage', r.status, await r.text().catch(() => '')); return null; }
    return `${SB()}/storage/v1/object/public/${bucket}/${path}`;
  } catch { return null; }
}

// Supabase Auth error → one of our short codes (translated in the app).
function authError(r) {
  const j = r.json || {};
  const code = String(j.error_code || j.code || j.error || '');
  const msg = String(j.msg || j.message || j.error_description || '').toLowerCase();
  if (r.status === 0) return 'auth_unreachable';
  if (r.status === 429 || /rate_limit/.test(code)) return 'rate_limited';
  if (code === 'user_banned' || /banned/.test(msg)) return 'account_disabled';
  if (code === 'email_not_confirmed' || /not confirmed/.test(msg)) return 'email_not_confirmed';
  if (code === 'invalid_credentials' || /invalid login/.test(msg)) return 'invalid_credentials';
  if (code === 'user_already_exists' || code === 'email_exists' || /already registered/.test(msg)) return 'email_taken';
  if (code === 'weak_password' || /password should/.test(msg)) return 'weak_password';
  if (code === 'same_password') return 'same_password';
  if (code === 'signup_disabled' || /signups not allowed/.test(msg)) return 'signup_disabled';
  if (code === 'refresh_token_not_found' || code === 'refresh_token_already_used' || /refresh token/.test(msg)) return 'session_expired';
  if (code === 'email_address_invalid' || /invalid.*email/.test(msg)) return 'invalid_email';
  return 'auth_failed';
}

/* ---------- small in-memory throttle for sign-in / sign-up / reset (Supabase has its own limits too) ---------- */
const hits = new Map();
function throttled(ip, max = 12, windowMs = 60_000) {
  const now = Date.now(); const list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

/* ---------- profiles ---------- */
const PROFILE_COLS = 'id,email,role,disabled,plan,ai_month,ai_count,terms_version,terms_accepted_at';
const USAGE_COLS = 'places_month,places_count,ai_day,ai_day_count';
async function getProfile(user) {
  let r = await rest(`profiles?id=eq.${user.id}&select=${PROFILE_COLS},plan_request,plan_request_at,plan_request_note,plan_until,${USAGE_COLS}`);
  // shortcut: a database without the bank-transfer columns (schema.sql not re-run) still signs people in; drop once every install has them
  if (r.status === 400) r = await rest(`profiles?id=eq.${user.id}&select=${PROFILE_COLS}`);
  if (!r.ok) return null;
  if (r.json?.[0]) return r.json[0];
  // the sign-up trigger normally creates it; this covers users made before the schema was installed
  const ins = await rest('profiles', { method: 'POST', body: { id: user.id, email: user.email || '' }, prefer: 'resolution=ignore-duplicates,return=representation' });
  return ins.json?.[0] || { id: user.id, email: user.email || '', role: 'client', disabled: false, plan: 'free' };
}

/** Bearer token → { user, profile } or an error result. */
export async function requireUser(headersIn) {
  const auth = String(headersIn.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return { error: fail(401, 'auth_required') };
  if (token.startsWith('bf.')) return isOwnerToken(token) ? { ...ownerUser(), token } : { error: fail(401, 'session_expired') };
  const r = await sb('/auth/v1/user', { key: PUBLIC_KEY(), bearer: token });
  if (r.status === 0) return { error: fail(503, 'auth_unreachable') };
  if (!r.ok || !r.json?.id) return { error: fail(401, 'session_expired') };
  const user = { id: r.json.id, email: r.json.email || '' };
  const profile = await getProfile(user);
  if (!profile) return { error: fail(503, 'database_unreachable') };
  if (profile.disabled) return { error: fail(403, 'account_disabled') };
  return { user, profile, token };
}
/**
 * Who is calling and what their plan allows. Accounts off (self-hosted, no Supabase) = everything allowed.
 * Returns { ok, plan, user, profile } or { ok: false, error }.
 */
export async function access(headersIn) {
  if (!authEnabled()) return { ok: true, plan: 'business', user: null, profile: null };
  const r = await requireUser(headersIn);
  if (r.profile?.owner) return { ok: true, plan: 'business', user: r.user, profile: null };
  if (r.error) return { ok: false, error: r.error.body.error, status: r.error.status };
  return { ok: true, plan: planOf(r.profile), user: r.user, profile: r.profile };
}

// Which AI tasks need which plan. The analysis is free up to FREE_AI_PER_MONTH per month.
const AI_NEEDS = { chat: 'pro', creator: 'pro', replier: 'pro', namer: 'free', themes: 'free', builder: 'free', analyst: 'free', strategist: 'free' };
/** For /api/ai and /api/chat. kind = the role name, or 'chat'. Returns { ok, release? } or { ok: false, error: 'auth_required' | 'plan_required' | 'quota_reached' }.
 *  When release is given, call it if the model did not answer, to give the reserved use back. */
export async function aiAccess(headersIn, kind) {
  const a = await access(headersIn);
  if (!a.ok) return { ok: false, error: 'auth_required' };
  if (!a.profile) return { ok: true };
  const need = AI_NEEDS[kind] || 'free';
  if (!atLeast(a.plan, need)) return { ok: false, error: 'plan_required', need };
  if (a.profile.role === 'admin') return { ok: true };
  if (a.plan === 'free') return { ok: false, error: 'plan_required' };
  const day = await take(a.user.id, a.profile, 'ai_day', 'ai_day_count', new Date().toISOString().slice(0, 10), LIMITS.ai[a.plan]);
  if (!day.ok) return { ok: false, error: day.error === 'quota_reached' ? 'daily_limit' : day.error };
  if (kind === 'analyst' && a.plan === 'free') {
    const month = await take(a.user.id, day.profile, 'ai_month', 'ai_count', new Date().toISOString().slice(0, 7), FREE_AI_PER_MONTH);
    if (!month.ok) { await day.release(); return month; }
    return { ok: true, release: async () => { await month.release(); await day.release(); } };
  }
  return { ok: true, release: day.release };
}

/**
 * Uses one unit of a per-period counter on the profile (periodCol holds the period, countCol the count in it).
 * The update is conditional on the count we read, so ten requests sent at once cannot all pass (race condition).
 * Returns { ok, release, profile } or { ok: false, error: 'quota_reached' | 'upstream' | 'rate_limited' }.
 * release() gives the unit back if nothing else changed the count since (never undercount).
 */
async function take(id, prof, periodCol, countCol, period, limit) {
  const none = { ok: true, release: async () => {}, profile: prof };
  if (!(periodCol in (prof || {}))) { // the database lacks the usage columns (schema.sql not re-run)
    console.warn(`[Arcton] profiles.${periodCol} missing: per-client limit not enforced, run supabase/schema.sql`);
    return none; // shortcut: fails open so sign-up keeps working; drop once every install has the columns
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const fresh = prof[periodCol] === period;
    const used = fresh ? Number(prof[countCol]) || 0 : 0;
    if (used >= limit) return { ok: false, error: 'quota_reached' };
    const cond = fresh ? `${periodCol}=eq.${period}&${countCol}=eq.${used}` : `or=(${periodCol}.is.null,${periodCol}.neq.${period})`;
    const r = await rest(`profiles?id=eq.${id}&${cond}`, { method: 'PATCH', body: { [periodCol]: period, [countCol]: used + 1 }, prefer: 'return=representation' });
    if (r.status === 400) return none; // column missing after all
    if (!r.ok) return { ok: false, error: 'upstream' };
    if (r.json?.length) {
      const release = () => rest(`profiles?id=eq.${id}&${periodCol}=eq.${period}&${countCol}=eq.${used + 1}`, { method: 'PATCH', body: { [countCol]: used } });
      return { ok: true, release, profile: { ...prof, [periodCol]: period, [countCol]: used + 1 } };
    }
    const again = await rest(`profiles?id=eq.${id}&select=${periodCol},${countCol}`); // someone else used one meanwhile: read and retry
    if (!again.ok || !again.json?.[0]) return { ok: false, error: 'upstream' };
    prof = { ...prof, ...again.json[0] };
  }
  return { ok: false, error: 'rate_limited' };
}

/** For /api/places: signed in (or accounts off) and within the monthly Google limit. Returns { ok, release? } or { ok: false, error, status }. */
export async function placesAccess(headersIn) {
  const a = await access(headersIn);
  if (!a.ok) return { ok: false, error: 'auth_required', status: 401 };
  if (!a.profile || a.profile.role === 'admin') return { ok: true };
  if (a.plan === 'free') return { ok: false, error: 'plan_required', status: 402 };
  const r = await take(a.user.id, a.profile, 'places_month', 'places_count', new Date().toISOString().slice(0, 7), LIMITS.places[a.plan]);
  return r.ok ? r : { ...r, status: r.error === 'quota_reached' ? 429 : 503 };
  return { ok: true };
}
/** Kept for older callers: signed in (or accounts off). */
export async function aiAllowed(headersIn) { return (await access(headersIn)).ok; }

const session = (j, prof) => ({
  access_token: j.access_token, refresh_token: j.refresh_token,
  expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (Number(j.expires_in) || 3600),
  user: { id: j.user?.id, email: j.user?.email || '' }, role: prof?.role || 'client', plan: planOf(prof),
  termsVersion: prof?.terms_version || null, termsAt: prof?.terms_accepted_at || null,
});
const TERMS = /^\d{4}-\d{2}-\d{2}$/;
/** Stores which version of the Terms / Privacy / AI notice the user accepted, and when. */
async function saveConsent(id, version) {
  const at = new Date().toISOString();
  const r = await rest(`profiles?id=eq.${id}`, { method: 'PATCH', body: { terms_version: version, terms_accepted_at: at } });
  return r.ok ? at : null;
}

/* ---------- /api/auth ---------- */
async function auth({ method, query, body, headers: h, ip }) {
  const op = method === 'GET' ? query.op : body?.op;
  // launch page: unlock with the owner password, and re-check a saved pass
  if (op === 'preview-unlock') { const r = previewUnlock(body?.password, ip); return r.pass ? out(200, { pass: r.pass, exp: r.exp }) : fail(r.error === 'rate_limited' ? 429 : 400, r.error); }
  if (op === 'preview-check') return out(200, { ok: isPreviewPass(body?.pass) || isOwnerToken(String(h.authorization || '').replace(/^Bearer /, '')) });
  if (op === 'config') return out(200, { maintenance: maintenance(), enabled: authEnabled(), support: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.LOCALBOOST_SUPPORT_EMAIL || '') ? process.env.LOCALBOOST_SUPPORT_EMAIL : '' });
  // owner (admin) sign-in by username: works with or without Supabase
  if (op === 'owner-login') { const r = ownerLogin(body?.username, body?.password, ip); return r.session ? out(200, { session: r.session }) : fail(r.error === 'rate_limited' ? 429 : 400, r.error); }
  if (op === 'me' && isOwnerToken(String(h.authorization || '').replace(/^Bearer /, ''))) { const o = ownerUser(); return out(200, { user: o.user, role: 'admin', plan: 'business', aiUsed: 0, aiLimit: FREE_AI_PER_MONTH, owner: true }); }
  if (op === 'logout' && String(h.authorization || '').startsWith('Bearer bf.')) return out(200, { ok: true });
  if (!authEnabled()) return fail(503, 'auth_not_configured');
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');

  if (op === 'waitlist') { // launch page: "tell me when it opens"; one email at launch, then the address is deleted
    if (body?.website) return out(200, { ok: true }); // honeypot field: bots fill it, people never see it
    if (throttled(`waitlist:${ip}`, 5, 600_000) || throttled('waitlist:*', 200)) return fail(429, 'rate_limited');
    if (!EMAIL.test(email) || email.length > 200) return fail(400, 'invalid_email');
    const lang = ['ro', 'en', 'fr', 'de', 'hu'].includes(body?.lang) ? body.lang : 'ro';
    const r = await rest('waitlist?on_conflict=email', { method: 'POST', body: { email, lang }, prefer: 'resolution=ignore-duplicates,return=minimal' });
    return r.ok ? out(200, { ok: true }) : fail(503, 'database_unreachable'); // same answer whether the address was new or not
  }

  if (op === 'signup' || op === 'login' || op === 'recover') {
    if (!prelaunchAllowed(h)) return fail(403, 'not_launched'); // before launch: only with an early-access pass
    if (throttled(`${op}:${ip}`) || throttled(`${op}:*`, 300)) return fail(429, 'rate_limited');
    if (!EMAIL.test(email) || email.length > 254) return fail(400, 'invalid_email');
  }
  if (op === 'signup') {
    if (password.length < 8 || password.length > 72) return fail(400, 'weak_password');
    if (!TERMS.test(String(body?.terms || ''))) return fail(400, 'terms_required');
    const redirect = safeRedirect(body?.redirectTo, h);
    const r = await sb(`/auth/v1/signup${redirect ? `?redirect_to=${encodeURIComponent(redirect)}` : ''}`, { method: 'POST', key: PUBLIC_KEY(), body: { email, password } });
    if (!r.ok) return fail(r.status === 0 ? 503 : 400, authError(r));
    const newId = r.json?.user?.id || r.json?.id;
    if (newId) await saveConsent(newId, body.terms).catch(() => null); // the profile row is created by the sign-up trigger
    if (r.json?.access_token) { // email confirmation is off in Supabase: signed in straight away
      const prof = await getProfile(r.json.user);
      return out(200, { session: session(r.json, prof || { role: 'client' }) });
    }
    return out(200, { confirm: true });
  }
  if (op === 'login') {
    if (!password) return fail(400, 'invalid_credentials');
    const r = await sb('/auth/v1/token?grant_type=password', { method: 'POST', key: PUBLIC_KEY(), body: { email, password } });
    if (!r.ok) return fail(r.status === 0 ? 503 : 400, authError(r));
    const prof = await getProfile(r.json.user);
    if (!prof) return fail(503, 'database_unreachable');
    if (prof.disabled) return fail(403, 'account_disabled');
    return out(200, { session: session(r.json, prof) });
  }
  if (op === 'refresh') {
    const token = String(body?.refresh_token || '');
    if (!token) return fail(401, 'session_expired');
    const r = await sb('/auth/v1/token?grant_type=refresh_token', { method: 'POST', key: PUBLIC_KEY(), body: { refresh_token: token } });
    if (!r.ok) return fail(r.status === 0 ? 503 : 401, authError(r));
    const prof = await getProfile(r.json.user);
    if (!prof) return fail(503, 'database_unreachable');
    if (prof.disabled) return fail(403, 'account_disabled');
    return out(200, { session: session(r.json, prof) });
  }
  if (op === 'recover') {
    const redirect = safeRedirect(body?.redirectTo, h);
    const r = await sb(`/auth/v1/recover${redirect ? `?redirect_to=${encodeURIComponent(redirect)}` : ''}`, { method: 'POST', key: PUBLIC_KEY(), body: { email } });
    if (r.status === 429) return fail(429, 'rate_limited');
    if (r.status === 0) return fail(503, 'auth_unreachable');
    return out(200, { sent: true }); // same answer whether or not the email has an account
  }
  if (op === 'me') {
    const u = await requireUser(h); if (u.error) return u.error;
    const month = new Date().toISOString().slice(0, 7);
    return out(200, { user: u.user, role: u.profile.role, plan: planOf(u.profile), aiUsed: u.profile.ai_month === month ? Number(u.profile.ai_count) || 0 : 0, aiLimit: FREE_AI_PER_MONTH, termsVersion: u.profile.terms_version || null, termsAt: u.profile.terms_accepted_at || null, planRequest: u.profile.plan_request || null, planRequestAt: u.profile.plan_request_at || null, planUntil: u.profile.plan_until || null,
      usage: { places: u.profile.places_month === month ? Number(u.profile.places_count) || 0 : 0, placesLimit: LIMITS.places[planOf(u.profile)], ai: u.profile.ai_day === new Date().toISOString().slice(0, 10) ? Number(u.profile.ai_day_count) || 0 : 0, aiLimit: LIMITS.ai[planOf(u.profile)] } });
  }
  if (op === 'plan-request') { // the client says they sent (or will send) the bank transfer; only the admin can change the plan
    const u = await requireUser(h); if (u.error) return u.error;
    const want = String(body?.plan || '');
    if (!['pro', 'business'].includes(want) || !(PLAN_RANK[want] > PLAN_RANK[planOf(u.profile)])) return fail(400, 'bad_request');
    if (throttled(`planreq:${u.user.id}`, 5, 3600_000)) return fail(429, 'rate_limited');
    const at = new Date().toISOString(); const note = String(body?.note || '').trim().slice(0, 500); // Custom Premium: what the client wants
    const r = await rest(`profiles?id=eq.${u.user.id}`, { method: 'PATCH', body: { plan_request: want, plan_request_at: at, ...(note ? { plan_request_note: note } : {}) } });
    return r.ok ? out(200, { planRequest: want, planRequestAt: at }) : fail(503, 'database_unreachable');
  }
  if (op === 'trial-request') { // an account without a plan asks the owner for a free trial or an offer
    const u = await requireUser(h); if (u.error) return u.error;
    if (throttled(`trial:${u.user.id}`, 3, 3600_000)) return fail(429, 'rate_limited');
    if (planOf(u.profile) !== 'free') return fail(400, 'bad_request');
    const note = String(body?.note || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 500);
    const at = new Date().toISOString();
    const r = await rest(`profiles?id=eq.${u.user.id}`, { method: 'PATCH', body: { plan_request: 'trial', plan_request_at: at, plan_request_note: note } });
    return r.ok ? out(200, { planRequest: 'trial', planRequestAt: at }) : fail(503, 'database_unreachable');
  }
  if (op === 'consent') {
    const u = await requireUser(h); if (u.error) return u.error;
    const v = String(body?.version || ''); if (!TERMS.test(v)) return fail(400, 'bad_request');
    const at = await saveConsent(u.user.id, v);
    return at ? out(200, { ok: true, at }) : fail(503, 'database_unreachable');
  }
  if (op === 'password') {
    if (password.length < 8 || password.length > 72) return fail(400, 'weak_password');
    const u = await requireUser(h); if (u.error) return u.error;
    const r = await sb('/auth/v1/user', { method: 'PUT', key: PUBLIC_KEY(), bearer: u.token, body: { password } });
    if (!r.ok) return fail(400, authError(r));
    return out(200, { ok: true });
  }
  if (op === 'logout') {
    const token = String(h.authorization || '').replace(/^Bearer /, '');
    if (token) await sb('/auth/v1/logout?scope=local', { method: 'POST', key: PUBLIC_KEY(), bearer: token });
    return out(200, { ok: true });
  }
  return fail(400, 'bad_request');
}

/* ---------- business data ---------- */
// The columns the admin list shows are copied out of the saved state on every save.
function summary(data) {
  const b = data?.business || {};
  const stage = data?.checkpoint ? 'measure' : data?.mission ? 'act' : data?.diagnosis ? 'diagnose' : data?.signalsCollected ? 'observe' : b.loaded ? 'start' : 'new';
  return { name: String(b.name || '').slice(0, 120) || null, category: String(b.category || '').slice(0, 40) || null, city: String(b.city || '').slice(0, 80) || null, stage };
}
function validData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  try { return JSON.stringify(data).length <= MAX_DATA; } catch { return false; }
}
async function readBusiness(owner) {
  const r = await rest(`businesses?owner=eq.${owner}&select=data,version,updated_at`);
  if (!r.ok) return { error: fail(503, 'database_unreachable') };
  const row = r.json?.[0];
  return { data: row?.data ?? null, version: row?.version ?? 0, updated_at: row?.updated_at ?? null };
}
/** Saves only if nobody else saved since `version` (0 = no row yet). On a clash, returns 409 with the newer copy. */
async function writeBusiness(owner, data, version, by) {
  if (!validData(data)) return fail(413, 'data_too_large');
  const v = Number(version) || 0;
  const row = { data, ...summary(data), updated_at: new Date().toISOString(), updated_by: by };
  let r;
  if (v > 0) r = await rest(`businesses?owner=eq.${owner}&version=eq.${v}`, { method: 'PATCH', body: { ...row, version: v + 1 }, prefer: 'return=representation' });
  else r = await rest('businesses', { method: 'POST', body: { owner, ...row, version: 1 }, prefer: 'return=representation' });
  if (r.ok && r.json?.[0]) return out(200, { version: r.json[0].version, updated_at: r.json[0].updated_at });
  if (r.status === 0 || r.status >= 500) return fail(503, 'database_unreachable');
  const now = await readBusiness(owner); if (now.error) return now.error;
  return fail(409, 'conflict', now);
}

/* ---------- /api/data (the signed-in user's own business) ---------- */
async function data({ method, body, headers: h }) {
  if (!authEnabled()) return fail(503, 'auth_not_configured');
  const u = await requireUser(h); if (u.error) return u.error;
  if (u.profile.owner) return method === 'GET' ? out(200, { data: null, version: 0 }) : method === 'PUT' ? out(200, { version: 1, local: true }) : fail(400, 'admin_self'); // the owner's own workspace stays on the device
  if (method === 'GET') { const b = await readBusiness(u.user.id); return b.error || out(200, b); }
  if (method === 'PUT') return writeBusiness(u.user.id, body?.data, body?.version, u.user.id);
  if (method === 'DELETE') { // "Delete my account" (required by Google Play for apps with accounts)
    if (u.profile.role === 'admin') return fail(400, 'admin_self');
    const r = await sb(`/auth/v1/admin/users/${u.user.id}`, { method: 'DELETE' });
    return r.ok ? out(200, { deleted: true }) : fail(503, 'auth_unreachable');
  }
  return fail(405, 'bad_request');
}

/* ---------- /api/admin ---------- */
// Temporary passwords: 3 groups of 4 from letters and digits that cannot be confused (no 0/O, 1/l/I), ~60 bits.
const PW_CHARS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function tempPassword() {
  const group = () => Array.from({ length: 4 }, () => PW_CHARS[randomInt(PW_CHARS.length)]).join('');
  return `${group()}-${group()}-${group()}`;
}
const one = (v) => (Array.isArray(v) ? v[0] || null : v || null);
async function admin({ method, query, body, headers: h }) {
  if (!authEnabled()) return fail(503, 'auth_not_configured');
  const u = await requireUser(h); if (u.error) return u.error;
  if (u.profile.role !== 'admin') return fail(403, 'not_admin');
  const op = method === 'GET' ? query.op : body?.op;
  const id = String((method === 'GET' ? query.id : body?.id) || '');

  if (op === 'clients') {
    const q = (extra) => rest(`profiles?select=id,email,role,disabled,plan,${extra}created_at,businesses(name,category,city,stage,updated_at)&order=created_at.desc&limit=1000`);
    let r = await q('plan_request,plan_request_at,plan_request_note,plan_until,'); if (r.status === 400) r = await q(''); // older database: no bank-transfer columns
    if (!r.ok) return fail(503, 'database_unreachable');
    return out(200, { clients: (r.json || []).map((p) => ({ id: p.id, email: p.email, role: p.role, disabled: p.disabled, plan: planOf(p), planRequest: p.plan_request || null, planRequestAt: p.plan_request_at || null, planRequestNote: p.plan_request_note || '', planUntil: p.plan_until || null, created_at: p.created_at, business: one(p.businesses) })) });
  }
  if (op === 'create') { // the admin opens an account for a client: confirmed at once, with a temporary password
    const email = String(body?.email || '').trim().toLowerCase().slice(0, 200);
    const plan = PLANS.includes(String(body?.plan)) ? String(body.plan) : 'free';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail(400, 'invalid_email');
    const password = tempPassword();
    const r = await sb('/auth/v1/admin/users', { method: 'POST', body: { email, password, email_confirm: true } });
    if (!r.ok) {
      const code = String(r.json?.error_code || r.json?.code || r.json?.msg || '');
      return /exists|registered|already/i.test(code) ? fail(409, 'email_taken') : fail(503, 'auth_unreachable');
    }
    const newId = r.json?.id || r.json?.user?.id;
    if (newId && plan !== 'free') await rest(`profiles?id=eq.${newId}`, { method: 'PATCH', body: { plan } });
    return out(200, { client: { id: newId, email, plan }, password }); // the password is shown once to the admin and never stored by Arcton
  }
  if (op === 'payments') {
    const r = await rest('payments?select=id,user_id,email,plan,months,amount_eur,reference,paid_on,plan_until,created_at&order=created_at.desc&limit=500');
    return r.ok ? out(200, { payments: r.json || [] }) : fail(503, 'database_unreachable');
  }
  if (op === 'waitlist') {
    const r = await rest('waitlist?select=email,lang,created_at&order=created_at.asc&limit=10000');
    return r.ok ? out(200, { list: r.json || [], mail: mailOn() }) : fail(503, 'database_unreachable');
  }
  if (op === 'waitlist-send') return sendLaunchMail(publicUrl(h));
  if (!UUID.test(id)) return fail(400, 'bad_request');
  const pr = await rest(`profiles?id=eq.${id}&select=id,email,role,disabled,plan,created_at`);
  if (!pr.ok) return fail(503, 'database_unreachable');
  const target = pr.json?.[0];
  if (!target) return fail(404, 'not_found');

  if (op === 'client' && method === 'GET') { const b = await readBusiness(id); return b.error || out(200, { client: target, ...b }); }
  if (op === 'save') return writeBusiness(id, body?.data, body?.version, u.user.id);
  if (op === 'plan') {
    const plan = String(body?.plan || '');
    if (!PLANS.includes(plan)) return fail(400, 'bad_request');
    let p = await rest(`profiles?id=eq.${id}`, { method: 'PATCH', body: { plan, plan_request: null, plan_request_at: null, plan_until: null } }); // set by hand: settles any open request, no end date
    if (p.status === 400) p = await rest(`profiles?id=eq.${id}`, { method: 'PATCH', body: { plan } }); // older database: no bank-transfer columns
    return p.ok ? out(200, { plan }) : fail(503, 'database_unreachable');
  }
  if (op === 'paid') return recordPayment(target, body, u.user.id, publicUrl(h));
  if (op === 'trial') return startTrial(target, body, publicUrl(h));
  if (op === 'disable' || op === 'enable' || op === 'delete') {
    if (id === u.user.id || target.role === 'admin') return fail(400, 'admin_self');
    if (op === 'delete') {
      const r = await sb(`/auth/v1/admin/users/${id}`, { method: 'DELETE' }); // cascades to profile and business
      return r.ok ? out(200, { deleted: true }) : fail(503, 'auth_unreachable');
    }
    const off = op === 'disable';
    const p = await rest(`profiles?id=eq.${id}`, { method: 'PATCH', body: { disabled: off } });
    if (!p.ok) return fail(503, 'database_unreachable');
    // a ban also stops sign-in and token refresh at Supabase itself
    await sb(`/auth/v1/admin/users/${id}`, { method: 'PUT', body: { ban_duration: off ? '876000h' : 'none' } });
    return out(200, { disabled: off });
  }
  return fail(400, 'bad_request');
}

/* ---------- bank transfers and the launch email (admin) ---------- */
// euro per month; also in js/views/plans.js and js/views/admin.js. 'pro' is shown as Growth; 'business' is Custom Premium, priced per client (null).
export const PRICE = { pro: 49.99, business: null };
const addMonths = (ymd, n) => { const d = new Date(`${ymd}T00:00:00Z`); const day = d.getUTCDate(); d.setUTCMonth(d.getUTCMonth() + n); if (d.getUTCDate() < day) d.setUTCDate(0); return d.toISOString().slice(0, 10); };

/** The admin saw the transfer: record it, set the plan until a date, and send the client a confirmation. */
async function recordPayment(target, b, by, origin) {
  const plan = String(b?.plan || ''); const months = Number(b?.months);
  if (!(plan in PRICE) || ![1, 3, 6, 12].includes(months) || target.role === 'admin') return fail(400, 'bad_request');
  const amount = Math.round(Number(b?.amount) * 100) / 100;
  if (!(amount > 0 && amount <= 10000)) return fail(400, 'bad_amount');
  const today = new Date().toISOString().slice(0, 10);
  const paidOn = /^\d{4}-\d{2}-\d{2}$/.test(String(b?.paidOn)) && b.paidOn <= today ? b.paidOn : today;
  const reference = String(b?.reference || '').replace(/[^\w .\-/]/g, '').slice(0, 60);
  const cur = await rest(`profiles?id=eq.${target.id}&select=plan,plan_until`);
  if (!cur.ok) return fail(503, 'database_unreachable');
  const prev = cur.json?.[0] || {};
  // a renewal of the same plan continues from the current end date; anything else starts today
  const from = prev.plan === plan && prev.plan_until && prev.plan_until > today ? prev.plan_until : today;
  const until = addMonths(from, months);
  const pay = await rest('payments', { method: 'POST', body: { user_id: target.id, email: target.email, plan, months, amount_eur: amount, reference, paid_on: paidOn, plan_until: until, recorded_by: by }, prefer: 'return=representation' });
  if (!pay.ok) return fail(503, 'database_unreachable');
  const p = await rest(`profiles?id=eq.${target.id}`, { method: 'PATCH', body: { plan, plan_until: until, plan_request: null, plan_request_at: null } });
  if (!p.ok) return fail(503, 'database_unreachable');
  const name = plan === 'pro' ? 'Growth' : 'Custom Premium';
  const dmy = until.split('-').reverse().join('.');
  const m = simpleMail({
    title: `Plata a fost confirmată: ${name} e activ`,
    lines: [`Am primit transferul de ${amount} EUR${reference ? ` (referința ${reference})` : ''}.`, `Planul ${name} e activ până pe ${dmy}. Data o vezi oricând în aplicație, la Abonamente.`, 'Factura ți-o trimitem separat.'],
    button: { label: 'Deschide Arcton Ai', url: origin },
    foot: [`${BRAND.company}${BRAND.cui ? ` · CUI ${BRAND.cui}` : ''}`, 'Primești acest email pentru că ai plătit un abonament Arcton Ai.'],
  });
  const emailed = mailOn() ? (await sendMails([{ to: [target.email], subject: `Arcton Ai: plata confirmată, ${name} activ până pe ${dmy}`, ...m }])) === 1 : false;
  return out(200, { plan, planUntil: until, payment: pay.json?.[0] || null, emailed });
}

/** The owner gives a free trial: the plan runs for 7, 14 or 30 days, no payment is recorded. */
async function startTrial(target, b, origin) {
  const plan = String(b?.plan || 'pro'); const days = Number(b?.days);
  if (!(plan in PRICE) || ![7, 14, 30].includes(days) || target.role === 'admin') return fail(400, 'bad_request');
  const d = new Date(); d.setUTCDate(d.getUTCDate() + days); const until = d.toISOString().slice(0, 10);
  const p = await rest(`profiles?id=eq.${target.id}`, { method: 'PATCH', body: { plan, plan_until: until, plan_request: null, plan_request_at: null, plan_request_note: null } });
  if (!p.ok) return fail(503, 'database_unreachable');
  const name = plan === 'pro' ? 'Growth' : 'Custom Premium'; const dmy = until.split('-').reverse().join('.');
  const m = simpleMail({ title: `Testul tău gratuit ${name} e activ`, lines: [`Ai acces la ${name} până pe ${dmy}, fără nicio plată.`, 'Îți căutăm afacerea, citim recenziile și îți arătăm ce te costă clienți. Dacă ai întrebări, răspunde la acest email.'], button: { label: 'Deschide Arcton Ai', url: origin }, foot: [BRAND.company] });
  const emailed = mailOn() ? (await sendMails([{ to: [target.email], subject: `Arcton Ai: testul ${name} e activ până pe ${dmy}`, ...m }])) === 1 : false;
  return out(200, { plan, planUntil: until, emailed });
}

const LAUNCH = {
  ro: { s: 'Arcton Ai s-a lansat', t: 'Arcton Ai e deschis.', l: ['Te-ai înscris să afli când se deschide Arcton Ai. De azi îți poți face cont și ne poți cere un test gratuit.', 'Îți cauți afacerea, iar în aproximativ un minut afli ce te costă clienți și ce să repari săptămâna asta.'], b: 'Creează cont', f: 'Ți-am scris o singură dată, cum am promis. Adresa ta a fost ștearsă din lista de așteptare.' },
  en: { s: 'Arcton Ai is live', t: 'Arcton Ai is open.', l: ['You asked us to tell you when Arcton Ai opens. From today you can create an account and ask us for a free trial.', 'Find your business and in about a minute you learn what is costing you customers and what to fix this week.'], b: 'Create an account', f: 'We wrote once, as promised. Your address has been deleted from the waiting list.' },
};
async function sendLaunchMail(origin) {
  if (!mailOn()) return fail(503, 'email_not_configured');
  const r = await rest('waitlist?select=email,lang&limit=10000');
  if (!r.ok) return fail(503, 'database_unreachable');
  const list = r.json || []; let sent = 0;
  for (let i = 0; i < list.length; i += 100) {
    const part = list.slice(i, i + 100);
    const n = await sendMails(part.map((w) => { const c = LAUNCH[w.lang === 'ro' ? 'ro' : 'en']; return { to: [w.email], subject: c.s, ...simpleMail({ title: c.t, lines: c.l, button: { label: c.b, url: origin }, foot: [c.f, BRAND.company] }) }; }));
    if (n !== part.length) break; // stop at the first failed batch; the rest stay on the list for a retry
    const del = await rest(`waitlist?email=in.(${part.map((w) => `"${w.email.replace(/"/g, '')}"`).join(',')})`, { method: 'DELETE' }); // purpose done: the address is deleted
    if (!del.ok) break;
    sent += n;
  }
  return out(200, { sent, of: list.length });
}

const ROUTES = { auth, data, admin };
/** route: 'auth' | 'data' | 'admin'. req: { method, query, body, headers, ip } → { status, body } */
export async function handleAccount(route, req) {
  try { return await ROUTES[route](req); }
  catch (e) { console.error('[Arcton] account error', e); return fail(500, 'server_error'); }
}

/** Adapter for the Vercel functions in api/. */
export async function vercelAccount(route, req, res, corsHeaders) {
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(corsHeaders(req.headers.origin))) res.setHeader(k, v);
  if (req.method === 'OPTIONS') return res.status(204).end();
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const r = await handleAccount(route, { method: req.method, query: req.query || {}, body: body || {}, headers: req.headers, ip });
  res.status(r.status).json(r.body);
}
