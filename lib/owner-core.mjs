// Owner (admin) sign-in by username, separate from customer accounts.
// It works with or without Supabase, so the admin area and the example can be shown on any deployment.
// The password is never stored: only a salted scrypt hash. Tokens are HMAC-signed and expire after 12 hours.
// Override in the environment: ARCTON_ADMIN_USER, ARCTON_ADMIN_HASH (scrypt$salt$hash), ARCTON_ADMIN_SECRET (token key),
// ARCTON_PREVIEW_HASH (a separate early-access password for the launch page; defaults to the admin password).
import { scryptSync, createHmac, createHash, timingSafeEqual, randomBytes } from 'node:crypto';

const DEFAULT_USER = 'byteforge';
const DEFAULT_HASH = 'scrypt$86c54d44e771906caccc110c35e7df3c$2e4d361c043c382289f5dfb4ba2d19abe10db96bad4cb9eef9dd3f3e779361c3';
export const OWNER_ID = '00000000-0000-4000-8000-0000000000a1';
const TTL = 12 * 3600;

const user = () => (process.env.ARCTON_ADMIN_USER || DEFAULT_USER).trim().toLowerCase();
const hash = () => process.env.ARCTON_ADMIN_HASH || DEFAULT_HASH;
// Token key: ARCTON_ADMIN_SECRET (at least 32 characters), else derived from server-only keys that never reach the browser
// or the repository. With neither, a random key is made per process: tokens then stop working after a restart,
// but nobody can forge one from a value written in the source code.
const RANDOM_KEY = randomBytes(32).toString('hex');
let warned = false;
const key = () => {
  const explicit = (process.env.ARCTON_ADMIN_SECRET || '').trim();
  const derived = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SECRET_KEY, process.env.GOOGLE_PLACES_API_KEY, process.env.ANTHROPIC_API_KEY, process.env.RESEND_API_KEY].filter((v) => v && v.trim().length >= 20).join('|');
  const base = explicit.length >= 32 ? explicit : derived || RANDOM_KEY;
  if (!warned && base === RANDOM_KEY) { warned = true; console.warn('[Arcton] ARCTON_ADMIN_SECRET is not set: admin sign-ins last until the server restarts.'); }
  return createHash('sha256').update(base).update('arcton-owner-v1').digest();
};
const sign = (payload) => createHmac('sha256', key()).update(payload).digest('base64url');
const same = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

// 6 attempts per address per 15 minutes, and at most 60 per 15 minutes from everyone together, so a password
// cannot be guessed by spreading the attempts over many addresses (credential stuffing).
const tries = new Map();
function limited(ip, scope = 'owner') {
  const now = Date.now(); const win = 15 * 60e3;
  const take = (k, max) => { const list = (tries.get(k) || []).filter((t) => now - t < win); list.push(now); tries.set(k, list); return list.length > max; };
  if (tries.size > 5000) tries.clear();
  const mine = take(`${scope}:${ip}`, 6); const all = take(`${scope}:*`, 60);
  return mine || all;
}
const scrypt = (password, salt) => scryptSync(String(password || '').slice(0, 200), salt, 32, { N: 16384, r: 8, p: 1 }).toString('hex');
const matches = (password, stored) => { const [alg, salt, want] = String(stored || '').split('$'); return alg === 'scrypt' && !!salt && !!want && same(scrypt(password, salt), want); };

/** Username + password → a session for the owner, or { error }. */
export function ownerLogin(username, password, ip = '') {
  if (limited(ip, 'owner')) return { error: 'rate_limited' };
  const okUser = same(String(username || '').trim().toLowerCase(), user());
  const okPass = matches(password, hash()); // always run, so a wrong username takes as long as a wrong password
  if (!okUser || !okPass) return { error: 'invalid_credentials' };
  const exp = Math.floor(Date.now() / 1000) + TTL; const payload = `owner.${exp}`;
  return { session: { access_token: `bf.${exp}.${sign(payload)}`, refresh_token: '', expires_at: exp, user: { id: OWNER_ID, email: user() }, role: 'admin', plan: 'business', owner: true } };
}

/** True when the bearer token is a valid, unexpired owner token. */
export function isOwnerToken(token) {
  const m = /^bf\.(\d{10})\.([A-Za-z0-9_-]{20,})$/.exec(String(token || '')); if (!m) return false;
  if (Number(m[1]) < Date.now() / 1000) return false;
  return same(sign(`owner.${m[1]}`), m[2]);
}
export const ownerUser = () => ({ user: { id: OWNER_ID, email: user() }, profile: { id: OWNER_ID, email: user(), role: 'admin', plan: 'business', disabled: false, owner: true } });

/* ---------- launch page ("coming soon") ---------- */
// On until the launch moment unless ARCTON_MAINTENANCE=off; ARCTON_MAINTENANCE=on keeps it on after the date.
const DEFAULT_LAUNCH = '2026-11-30T00:00:00+02:00';
export const launchAt = () => { const v = Date.parse(process.env.ARCTON_LAUNCH || DEFAULT_LAUNCH); return Number.isFinite(v) ? v : Date.parse(DEFAULT_LAUNCH); };
export function maintenance() {
  const mode = String(process.env.ARCTON_MAINTENANCE || '').toLowerCase();
  const on = mode === 'on' || (mode !== 'off' && Date.now() < launchAt());
  return { on, launch: new Date(launchAt()).toISOString() };
}
const PREVIEW_TTL = 30 * 24 * 3600;
/** The early-access password (ARCTON_PREVIEW_HASH, else the owner password) unlocks the app before launch: a 30-day pass for that browser. */
export function previewUnlock(password, ip = '') {
  if (limited(ip, 'preview')) return { error: 'rate_limited' };
  if (!matches(password, process.env.ARCTON_PREVIEW_HASH || hash())) return { error: 'invalid_credentials' };
  const exp = Math.floor(Date.now() / 1000) + PREVIEW_TTL;
  return { pass: `pv.${exp}.${sign(`preview.${exp}`)}`, exp };
}
export function isPreviewPass(pass) {
  const m = /^pv\.(\d{10})\.([A-Za-z0-9_-]{20,})$/.exec(String(pass || '')); if (!m) return false;
  if (Number(m[1]) < Date.now() / 1000) return false;
  return same(sign(`preview.${m[1]}`), m[2]);
}

/** Before launch, only owners and people with an early-access pass may sign up or sign in. */
export function prelaunchAllowed(headers) {
  if (!maintenance().on) return true;
  const bearer = String(headers?.authorization || '').replace(/^Bearer /, '');
  return isOwnerToken(bearer) || isPreviewPass(String(headers?.['x-preview-pass'] || ''));
}
