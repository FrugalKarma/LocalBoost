// Owner (admin) sign-in by username, separate from customer accounts.
// It works with or without Supabase, so the admin area and the example can be shown on any deployment.
// The password is never stored: only a salted scrypt hash. Tokens are HMAC-signed and expire after 12 hours.
// Override in the environment: ARCTON_ADMIN_USER, ARCTON_ADMIN_HASH (scrypt$salt$hash), ARCTON_ADMIN_SECRET (token key).
import { scryptSync, createHmac, createHash, timingSafeEqual } from 'node:crypto';

const DEFAULT_USER = 'byteforge';
const DEFAULT_HASH = 'scrypt$86c54d44e771906caccc110c35e7df3c$2e4d361c043c382289f5dfb4ba2d19abe10db96bad4cb9eef9dd3f3e779361c3';
export const OWNER_ID = '00000000-0000-4000-8000-0000000000a1';
const TTL = 12 * 3600;

const user = () => (process.env.ARCTON_ADMIN_USER || DEFAULT_USER).trim().toLowerCase();
const hash = () => process.env.ARCTON_ADMIN_HASH || DEFAULT_HASH;
// Token key: an explicit secret, else derived from server-only keys that never reach the browser or the repository.
const key = () => createHash('sha256').update(process.env.ARCTON_ADMIN_SECRET || [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.GOOGLE_PLACES_API_KEY, process.env.ANTHROPIC_API_KEY, process.env.RESEND_API_KEY].filter(Boolean).join('|') || 'arcton-local-dev-only').update('arcton-owner-v1').digest();
const sign = (payload) => createHmac('sha256', key()).update(payload).digest('base64url');
const same = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

const tries = new Map(); // ip -> [timestamps]; 6 attempts per 15 minutes
function limited(ip) {
  const now = Date.now(); const list = (tries.get(ip) || []).filter((t) => now - t < 15 * 60e3);
  list.push(now); tries.set(ip, list); if (tries.size > 5000) tries.clear();
  return list.length > 6;
}

/** Username + password → a session for the owner, or { error }. */
export function ownerLogin(username, password, ip = '') {
  if (limited(ip)) return { error: 'rate_limited' };
  const [alg, salt, want] = hash().split('$');
  const okUser = same(String(username || '').trim().toLowerCase(), user());
  let okPass = false;
  if (alg === 'scrypt' && salt && want) {
    const got = scryptSync(String(password || ''), salt, 32, { N: 16384, r: 8, p: 1 }).toString('hex');
    okPass = same(got, want);
  }
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
/** The owner password unlocks the app before launch: a 30-day pass for that browser. */
export function previewUnlock(password, ip = '') {
  if (limited(`pv:${ip}`)) return { error: 'rate_limited' };
  const [alg, salt, want] = hash().split('$');
  if (alg !== 'scrypt' || !salt || !want) return { error: 'invalid_credentials' };
  const got = scryptSync(String(password || ''), salt, 32, { N: 16384, r: 8, p: 1 }).toString('hex');
  if (!same(got, want)) return { error: 'invalid_credentials' };
  const exp = Math.floor(Date.now() / 1000) + PREVIEW_TTL;
  return { pass: `pv.${exp}.${sign(`preview.${exp}`)}`, exp };
}
export function isPreviewPass(pass) {
  const m = /^pv\.(\d{10})\.([A-Za-z0-9_-]{20,})$/.exec(String(pass || '')); if (!m) return false;
  if (Number(m[1]) < Date.now() / 1000) return false;
  return same(sign(`preview.${m[1]}`), m[2]);
}
