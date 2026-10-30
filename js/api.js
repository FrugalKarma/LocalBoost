// Where the AI server lives. Empty = same origin (web app served by server.mjs or Vercel).
// The packaged Android app (Capacitor) has no server of its own, so it needs the hosted address,
// set in Settings or baked in at build time as window.LOCALBOOST_API_BASE.
const KEY = 'localboost.apiBase';
const listeners = new Set();

const clean = (v) => String(v || '').trim().replace(/\/+$/, '');
export function apiBase() {
  let v = '';
  try { v = localStorage.getItem(KEY) || ''; } catch { /* storage blocked */ }
  return clean(v || globalThis.LOCALBOOST_API_BASE || '');
}
export const apiUrl = (path) => `${apiBase()}${path}`;

/** Accepts '' (same origin), https://… or http://localhost… Returns false when the address is not valid. */
export function setApiBase(value) {
  const v = clean(value);
  if (v && !/^https:\/\/[^\s/]+\.[^\s]+$/i.test(v) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(v)) return false;
  try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch { /* storage blocked */ }
  listeners.forEach((fn) => fn(v));
  return true;
}
export const onApiBaseChange = (fn) => listeners.add(fn);
