// Accounts, cloud data and the admin area, shared by server.mjs and the Vercel functions in api/.
// The browser only talks to /api/auth, /api/data and /api/admin. This file talks to Supabase:
//   Auth (sign-up, sign-in, tokens, password reset) with the public key,
//   the database and admin actions with the secret key, which never leaves the server.
// Without SUPABASE_URL + both keys, accounts are off and the app keeps working on-device only.

const env = (k) => (process.env[k] || '').trim();
const SB = () => env('SUPABASE_URL').replace(/\/+$/, '');
const PUBLIC_KEY = () => env('SUPABASE_ANON_KEY') || env('SUPABASE_PUBLISHABLE_KEY');
const SECRET_KEY = () => env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_SECRET_KEY');
export const authEnabled = () => !!(SB() && PUBLIC_KEY() && SECRET_KEY());

const MAX_DATA = 600 * 1024; // one business, serialised
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const out = (status, body) => ({ status, body });
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
const rest = (path, opts) => sb(`/rest/v1/${path}`, opts);

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
async function getProfile(user) {
  const r = await rest(`profiles?id=eq.${user.id}&select=id,email,role,disabled`);
  if (!r.ok) return null;
  if (r.json?.[0]) return r.json[0];
  // the sign-up trigger normally creates it; this covers users made before the schema was installed
  const ins = await rest('profiles', { method: 'POST', body: { id: user.id, email: user.email || '' }, prefer: 'resolution=ignore-duplicates,return=representation' });
  return ins.json?.[0] || { id: user.id, email: user.email || '', role: 'client', disabled: false };
}

/** Bearer token → { user, profile } or an error result. */
async function requireUser(headersIn) {
  const auth = String(headersIn.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return { error: fail(401, 'auth_required') };
  const r = await sb('/auth/v1/user', { key: PUBLIC_KEY(), bearer: token });
  if (r.status === 0) return { error: fail(503, 'auth_unreachable') };
  if (!r.ok || !r.json?.id) return { error: fail(401, 'session_expired') };
  const user = { id: r.json.id, email: r.json.email || '' };
  const profile = await getProfile(user);
  if (!profile) return { error: fail(503, 'database_unreachable') };
  if (profile.disabled) return { error: fail(403, 'account_disabled') };
  return { user, profile, token };
}
/** For /api/ai and /api/chat: when accounts are on, only signed-in, enabled users may spend AI credit. */
export async function aiAllowed(headersIn) {
  if (!authEnabled()) return true;
  const r = await requireUser(headersIn);
  return !r.error;
}

const session = (j, role) => ({
  access_token: j.access_token, refresh_token: j.refresh_token,
  expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (Number(j.expires_in) || 3600),
  user: { id: j.user?.id, email: j.user?.email || '' }, role,
});
const safeRedirect = (v) => {
  const s = String(v || '');
  return /^https:\/\/[^\s/]+(\/[^\s]*)?$/i.test(s) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/[^\s]*)?$/i.test(s) ? s : '';
};

/* ---------- /api/auth ---------- */
async function auth({ method, query, body, headers: h, ip }) {
  const op = method === 'GET' ? query.op : body?.op;
  if (op === 'config') return out(200, { enabled: authEnabled() });
  if (!authEnabled()) return fail(503, 'auth_not_configured');
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');

  if (op === 'signup' || op === 'login' || op === 'recover') {
    if (throttled(`${op}:${ip}`)) return fail(429, 'rate_limited');
    if (!EMAIL.test(email) || email.length > 254) return fail(400, 'invalid_email');
  }
  if (op === 'signup') {
    if (password.length < 8 || password.length > 72) return fail(400, 'weak_password');
    const redirect = safeRedirect(body?.redirectTo);
    const r = await sb(`/auth/v1/signup${redirect ? `?redirect_to=${encodeURIComponent(redirect)}` : ''}`, { method: 'POST', key: PUBLIC_KEY(), body: { email, password } });
    if (!r.ok) return fail(r.status === 0 ? 503 : 400, authError(r));
    if (r.json?.access_token) { // email confirmation is off in Supabase: signed in straight away
      const prof = await getProfile(r.json.user);
      return out(200, { session: session(r.json, prof?.role || 'client') });
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
    return out(200, { session: session(r.json, prof.role) });
  }
  if (op === 'refresh') {
    const token = String(body?.refresh_token || '');
    if (!token) return fail(401, 'session_expired');
    const r = await sb('/auth/v1/token?grant_type=refresh_token', { method: 'POST', key: PUBLIC_KEY(), body: { refresh_token: token } });
    if (!r.ok) return fail(r.status === 0 ? 503 : 401, authError(r));
    const prof = await getProfile(r.json.user);
    if (!prof) return fail(503, 'database_unreachable');
    if (prof.disabled) return fail(403, 'account_disabled');
    return out(200, { session: session(r.json, prof.role) });
  }
  if (op === 'recover') {
    const redirect = safeRedirect(body?.redirectTo);
    const r = await sb(`/auth/v1/recover${redirect ? `?redirect_to=${encodeURIComponent(redirect)}` : ''}`, { method: 'POST', key: PUBLIC_KEY(), body: { email } });
    if (r.status === 429) return fail(429, 'rate_limited');
    if (r.status === 0) return fail(503, 'auth_unreachable');
    return out(200, { sent: true }); // same answer whether or not the email has an account
  }
  if (op === 'me') {
    const u = await requireUser(h); if (u.error) return u.error;
    return out(200, { user: u.user, role: u.profile.role });
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
const one = (v) => (Array.isArray(v) ? v[0] || null : v || null);
async function admin({ method, query, body, headers: h }) {
  if (!authEnabled()) return fail(503, 'auth_not_configured');
  const u = await requireUser(h); if (u.error) return u.error;
  if (u.profile.role !== 'admin') return fail(403, 'not_admin');
  const op = method === 'GET' ? query.op : body?.op;
  const id = String((method === 'GET' ? query.id : body?.id) || '');

  if (op === 'clients') {
    const r = await rest('profiles?select=id,email,role,disabled,created_at,businesses(name,category,city,stage,updated_at)&order=created_at.desc&limit=1000');
    if (!r.ok) return fail(503, 'database_unreachable');
    return out(200, { clients: (r.json || []).map((p) => ({ id: p.id, email: p.email, role: p.role, disabled: p.disabled, created_at: p.created_at, business: one(p.businesses) })) });
  }
  if (!UUID.test(id)) return fail(400, 'bad_request');
  const pr = await rest(`profiles?id=eq.${id}&select=id,email,role,disabled,created_at`);
  if (!pr.ok) return fail(503, 'database_unreachable');
  const target = pr.json?.[0];
  if (!target) return fail(404, 'not_found');

  if (op === 'client' && method === 'GET') { const b = await readBusiness(id); return b.error || out(200, { client: target, ...b }); }
  if (op === 'save') return writeBusiness(id, body?.data, body?.version, u.user.id);
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

const ROUTES = { auth, data, admin };
/** route: 'auth' | 'data' | 'admin'. req: { method, query, body, headers, ip } → { status, body } */
export async function handleAccount(route, req) {
  try { return await ROUTES[route](req); }
  catch (e) { console.error('[LocalBoost] account error', e); return fail(500, 'server_error'); }
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
