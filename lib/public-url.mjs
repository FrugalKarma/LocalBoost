// The public address of the app. Links in emails and hosted pages are built from this,
// never from the Host header, so a forged Host cannot send people (or reset links) somewhere else.
export const DEFAULT_PUBLIC_URL = 'https://www.arcton.site';
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/** LOCALBOOST_PUBLIC_URL, else https://www.arcton.site. On a local test server (Host is localhost) the local address. */
export function publicUrl(headers = {}) {
  const env = (process.env.LOCALBOOST_PUBLIC_URL || '').trim().replace(/\/+$/, '');
  if (/^https?:\/\/[^\s/]+$/i.test(env)) return env;
  const host = String(headers.host || '');
  if (LOCAL.test(host) && !headers['x-forwarded-host']) return `http://${host}`;
  return DEFAULT_PUBLIC_URL;
}

/** Origins the app may send people back to after an email link (sign-up confirmation, password reset). */
export function allowedOrigins(headers = {}) {
  const extra = (process.env.LOCALBOOST_ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter((s) => /^https:\/\//.test(s));
  return new Set([publicUrl(headers), DEFAULT_PUBLIC_URL, 'https://arcton.site', ...extra]);
}

/** A redirect target is kept only if it points at one of our own origins; anything else becomes ''. */
export function safeRedirect(value, headers = {}) {
  let u; try { u = new URL(String(value || '')); } catch { return ''; }
  if (u.username || u.password) return '';
  const local = u.protocol === 'http:' && LOCAL.test(u.host);
  return allowedOrigins(headers).has(u.origin) || local ? u.href : '';
}
