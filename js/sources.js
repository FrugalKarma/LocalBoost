// Calls to the server's real data sources: Google Places, the website check and hosted websites.
// Each returns { ok, data } or { ok: false, error } and never throws, so screens can show a clear message.
import { apiUrl, onApiBaseChange } from './api.js';
import { authHeaders, api, signedIn, authOn } from './auth.js';
import { getLang } from './i18n.js';

let caps = null; // what the server can do: { ai, places, accounts, sites, sitecheck }
export const resetCaps = () => { caps = null; };
onApiBaseChange(resetCaps);
/** Server capabilities from /api/health (cached per page load). */
export function serverCaps() {
  caps ||= fetch(apiUrl('/api/health'), { cache: 'no-store', signal: AbortSignal.timeout(5000) })
    .then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
    .then((j) => ({ reachable: !!j.ok, ai: !!j.ai, places: !!j.places, accounts: !!j.accounts, sites: !!j.sites, sitecheck: !!j.sitecheck }));
  return caps;
}

async function call(path, { method = 'GET', body } = {}) {
  if (authOn() && signedIn()) {
    const r = await api(path, { method, body });
    return r.status === 200 ? { ok: true, data: r.body } : { ok: false, error: r.body?.error || (r.status === 0 ? 'network' : 'failed'), status: r.status };
  }
  try {
    const r = await fetch(apiUrl(path), { method, cache: 'no-store', headers: await authHeaders({ 'content-type': 'application/json' }), body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
    const j = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, data: j } : { ok: false, error: j.error || 'failed', status: r.status };
  } catch { return { ok: false, error: 'network', status: 0 }; }
}

/* ---------- Google Places ---------- */
export const findPlaces = (q) => call('/api/places', { method: 'POST', body: { op: 'search', q, lang: getLang() } });
export const placeDetails = (id) => call(`/api/places?op=details&id=${encodeURIComponent(id)}&lang=${getLang()}`);
export const nearbyPlaces = ({ lat, lng, category, self, q }) =>
  call(`/api/places?op=nearby&lat=${lat}&lng=${lng}&category=${encodeURIComponent(category || '')}&self=${encodeURIComponent(self || '')}&q=${encodeURIComponent(q || '')}&lang=${getLang()}`);

/* ---------- website check ---------- */
export const checkWebsite = (url) => call(`/api/sitecheck?url=${encodeURIComponent(url)}`);

/* ---------- hosted website ---------- */
export const mySite = () => call('/api/site?op=mine');
export const publishSite = (slug, doc) => call('/api/site', { method: 'POST', body: { op: 'publish', slug, doc } });
export const unpublishSite = () => call('/api/site', { method: 'POST', body: { op: 'unpublish' } });
export const setRequestStatus = (id, status) => call('/api/site', { method: 'POST', body: { op: 'request-status', id, status } });
export const deleteRequest = (id) => call('/api/site', { method: 'POST', body: { op: 'request-delete', id } });
/** Public address of the published site (same server as the app). */
export const siteUrl = (slug) => `${apiUrl('') || location.origin}/s/${slug}`;
