// Accounts on the client: session storage, sign-in calls and fetch with the right token.
// Accounts are on when the server says so (/api/auth?op=config). Off = the app works on this device only, as before.
import { apiUrl } from './api.js';

const SKEY = 'localboost.session';
const CKEY = 'localboost.authEnabled'; // last answer from the server, so the app can start offline
const MKEY = 'localboost.support';
const listeners = new Set();
let session = read(SKEY);
let enabled = read(CKEY) === true;
let support = read(MKEY) || '';
/** Where owners ask for a plan change (LOCALBOOST_SUPPORT_EMAIL on the server). */
export const supportEmail = () => support;

function read(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } }
function write(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } }

export const authOn = () => enabled;
export const getSession = () => session;
export const signedIn = () => !!session?.access_token;
export const isAdmin = () => session?.role === 'admin';
export const userEmail = () => session?.user?.email || '';
export const userId = () => session?.user?.id || '';
export const onAuthChange = (fn) => listeners.add(fn);

export function setSession(s, reason = 'signin') {
  session = s?.access_token ? { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: Number(s.expires_at) || 0, user: s.user || {}, role: s.role || 'client', plan: s.plan || 'free', aiUsed: Number(s.aiUsed) || 0, aiLimit: Number(s.aiLimit) || 3, termsVersion: s.termsVersion || null, termsAt: s.termsAt || null, owner: !!s.owner } : null;
  write(SKEY, session);
  listeners.forEach((fn) => fn(session, reason));
}

/** Asks the server whether accounts are on. Keeps the last known answer when offline. */
export async function loadAuthConfig() {
  try {
    const r = await fetch(apiUrl('/api/auth?op=config'), { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (r.ok) { const j = await r.json(); enabled = !!j.enabled; write(CKEY, enabled); support = typeof j.support === 'string' ? j.support : ''; write(MKEY, support || null); }
  } catch { /* offline or no server: keep the cached answer */ }
  return enabled;
}

async function post(body, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  let r;
  try { r = await fetch(apiUrl('/api/auth'), { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) }); }
  catch { return { error: 'network' }; }
  let j = {}; try { j = await r.json(); } catch { /* empty */ }
  return r.ok ? j : { error: j.error || 'auth_failed' };
}

// Email links come back to the web app; inside the Android app (https://localhost) let Supabase use its Site URL.
const redirectTo = () => (/^https:\/\/localhost$/.test(location.origin) || location.protocol === 'capacitor:' ? '' : `${location.origin}/`);

/** Owner (admin) sign-in by username: works even when customer accounts are off. */
export async function ownerSignIn(username, password) {
  const j = await post({ op: 'owner-login', username, password });
  if (j.session) setSession(j.session);
  return j;
}
export const isOwner = () => !!session?.owner;

export async function signIn(email, password) {
  const j = await post({ op: 'login', email, password });
  if (j.session) setSession(j.session);
  return j;
}
export async function signUp(email, password, terms) {
  const j = await post({ op: 'signup', email, password, terms, redirectTo: redirectTo() });
  if (j.session) setSession(j.session);
  return j;
}
export const sendReset = (email) => post({ op: 'recover', email, redirectTo: redirectTo() });
export async function changePassword(password) {
  const tok = await freshToken();
  return post({ op: 'password', password }, tok);
}
export async function signOut(reason = 'signout') {
  const tok = session?.access_token;
  setSession(null, reason);
  if (tok) post({ op: 'logout' }, tok).catch(() => {});
}

/* ---------- tokens ---------- */
let refreshing = null;
async function refresh() {
  if (!session?.refresh_token) return null;
  refreshing ||= (async () => {
    const j = await post({ op: 'refresh', refresh_token: session.refresh_token });
    if (j.session) { setSession(j.session, 'refresh'); return session.access_token; }
    if (session?.owner) { await signOut('expired'); return null; } // owner sessions are not refreshed: sign in again
    if (j.error === 'network' || j.error === 'auth_unreachable' || j.error === 'database_unreachable') return session.access_token; // try again later
    await signOut(j.error === 'account_disabled' ? 'disabled' : 'expired');
    return null;
  })().finally(() => { refreshing = null; });
  return refreshing;
}
/** A token that is valid for at least another minute (refreshes it when needed). */
export async function freshToken() {
  if (!session) return null;
  if (session.expires_at && session.expires_at * 1000 - Date.now() < 60_000) return refresh();
  return session.access_token;
}
/** Adds the Authorization header for /api/ai and /api/chat (no-op when signed out). */
export async function authHeaders(h = {}) {
  const tok = signedIn() ? await freshToken() : null;
  return tok ? { ...h, authorization: `Bearer ${tok}` } : h;
}

/** fetch for /api/data and /api/admin: JSON in and out, one retry after a token refresh. Returns { status, body } or { status: 0 } offline. */
export async function api(path, { method = 'GET', body } = {}) {
  const go = async (tok) => {
    try {
      const r = await fetch(apiUrl(path), { method, cache: 'no-store', headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
      let j = {}; try { j = await r.json(); } catch { /* empty */ }
      return { status: r.status, body: j };
    } catch { return { status: 0, body: { error: 'network' } }; }
  };
  let tok = await freshToken(); if (!tok) return { status: 401, body: { error: 'auth_required' } };
  let r = await go(tok);
  if (r.status === 401) { tok = await refresh(); if (!tok) return r; r = await go(tok); }
  if (r.status === 403 && r.body.error === 'account_disabled') await signOut('disabled');
  return r;
}

/** Supabase email links land on the app as #access_token=…&type=signup|recovery (or #error=…). */
export function readAuthHash() {
  const h = location.hash.replace(/^#\/?/, '');
  if (!/(^|&)(access_token|error_description|error)=/.test(h)) return null;
  const p = new URLSearchParams(h);
  history.replaceState(null, '', location.pathname + location.search); // keep tokens out of the address bar
  if (p.get('error') || p.get('error_description')) return { error: p.get('error_code') || p.get('error') || 'link_invalid' };
  return { type: p.get('type') || 'signup', session: { access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_at: Number(p.get('expires_at')) || Math.floor(Date.now() / 1000) + (Number(p.get('expires_in')) || 3600) } };
}
/** Completes a session from an email link: asks the server who this is and what role they have. */
export async function adoptLinkSession(s) {
  const j = await post({ op: 'me' }, s.access_token);
  if (!j.user) return j;
  setSession({ ...s, user: j.user, role: j.role, plan: j.plan, aiUsed: j.aiUsed, aiLimit: j.aiLimit, termsVersion: j.termsVersion, termsAt: j.termsAt }, 'link');
  return j;
}

/** Re-reads role, plan and AI allowance (the admin may have changed the plan). */
export async function refreshMe() {
  if (!signedIn()) return null;
  const tok = await freshToken(); if (!tok) return null;
  const j = await post({ op: 'me' }, tok);
  if (j.user && session) { session = { ...session, role: j.role, plan: j.plan, aiUsed: j.aiUsed, aiLimit: j.aiLimit, termsVersion: j.termsVersion, termsAt: j.termsAt }; write(SKEY, session); listeners.forEach((fn) => fn(session, 'plan')); }
  return j;
}

/** Records on the account that the current Terms / Privacy / AI notice were accepted. */
export async function recordConsent(version) {
  const tok = await freshToken(); if (!tok) return { error: 'auth_required' };
  const j = await post({ op: 'consent', version }, tok);
  if (j.ok && session) { session = { ...session, termsVersion: version, termsAt: j.at }; write(SKEY, session); }
  return j;
}
