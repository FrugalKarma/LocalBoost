// Real data sources for the Observe step, shared by server.mjs and the Vercel functions:
//   Google Places (find the business, its rating and latest reviews, nearby competitors)
//   and a website check (fetches the owner's site and tests what customers need to find).
// The Google key stays on the server. Without GOOGLE_PLACES_API_KEY, /api/places answers 503
// and the app asks the owner to type the details in instead.
import { lookup } from 'node:dns/promises';
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { access, placesAccess } from './auth-core.mjs';

const KEY = () => (process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim();
const PLACES = () => (process.env.GOOGLE_PLACES_URL || 'https://places.googleapis.com/v1').replace(/\/+$/, ''); // overridable for tests
export const placesEnabled = () => !!KEY();

const out = (status, body) => ({ status, body });
const LANGS = ['ro', 'en', 'fr', 'de', 'hu'];
const str = (v, n = 200) => (typeof v === 'string' ? v.replace(/[\u0000-\u001F]/g, ' ').trim().slice(0, n) : '');
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

// per-IP budget so one visitor cannot burn the Google quota
const hits = new Map();
function throttled(key, max, windowMs) {
  const now = Date.now(); const list = (hits.get(key) || []).filter((x) => now - x < windowMs);
  list.push(now); hits.set(key, list); if (hits.size > 5000) hits.clear();
  return list.length > max;
}

/* ---------- Google Places (New) ---------- */
// Business category in the app → Google place types for "nearby competitors".
const TYPES = {
  cafe: ['cafe', 'coffee_shop'], restaurant: ['restaurant'], salon: ['beauty_salon', 'hair_salon', 'nail_salon'],
  shop: ['clothing_store', 'gift_shop', 'book_store', 'store'], other: null,
};
const BASIC = 'id,displayName,formattedAddress,location,rating,userRatingCount,googleMapsUri,websiteUri';

async function google(path, { method = 'GET', body, fields }) {
  let r;
  try {
    r = await fetch(`${PLACES()}${path}`, { method, headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY(), 'x-goog-fieldmask': fields }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
  } catch { return { error: 'places_unreachable' }; }
  const j = await r.json().catch(() => ({}));
  if (r.status === 429) return { error: 'rate_limited' };
  if (!r.ok) { console.warn('[Arcton] places', r.status, j?.error?.message); return { error: r.status === 403 || r.status === 400 ? 'places_key' : 'places_failed' }; }
  return { json: j };
}

const brief = (p) => ({
  id: str(p.id, 300), name: str(p.displayName?.text, 120), address: str(p.formattedAddress, 200),
  lat: num(p.location?.latitude), lng: num(p.location?.longitude),
  rating: num(p.rating), reviewCount: num(p.userRatingCount) ?? 0, mapsUrl: str(p.googleMapsUri, 300), website: str(p.websiteUri, 300),
});
const distM = (a, b) => {
  if (a.lat == null || b.lat == null) return null;
  const R = 6371000; const r = (d) => (d * Math.PI) / 180;
  const x = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)));
};

/** Google periods (Sunday = 0) → 7 days, Monday first, up to 2 ranges each: [{ closed, r: [['08:00','20:00']] }]. */
export function periodsToWeek(periods) {
  if (!Array.isArray(periods) || !periods.length) return null;
  const pad = (n) => String(n ?? 0).padStart(2, '0');
  const t = (x) => `${pad(x?.hour)}:${pad(x?.minute)}`;
  const week = Array.from({ length: 7 }, () => ({ closed: true, r: [] }));
  if (periods.length === 1 && periods[0].open && !periods[0].close) return week.map(() => ({ closed: false, r: [['00:00', '23:59']] })); // open 24/7
  for (const p of periods) {
    if (!p.open || typeof p.open.day !== 'number') continue;
    const i = (p.open.day + 6) % 7;
    const close = p.close ? t(p.close) : '23:59';
    if (week[i].r.length < 2) { week[i].r.push([t(p.open), close === '00:00' ? '23:59' : close]); week[i].closed = false; }
  }
  return week;
}

async function places({ method, query, body, headers, ip }) {
  if (!placesEnabled()) return out(503, { error: 'places_not_configured' });
  if (throttled(`places:${ip}`, 40, 3600_000)) return out(429, { error: 'rate_limited' });
  const gate = await placesAccess(headers); // signed in, and within the client's monthly Google limit
  if (!gate.ok) return out(gate.status, { error: gate.error });
  const res = await placesOps(method, query, body);
  if (res.status >= 400 && gate.release) await gate.release().catch(() => {}); // Google failed or bad input: the lookup is not counted
  return res;
}

async function placesOps(method, query, body) {
  const q = method === 'GET' ? query : body || {};
  const lang = LANGS.includes(q.lang) ? q.lang : 'en';

  if (q.op === 'search') {
    const text = str(q.q, 160); if (text.length < 3) return out(400, { error: 'bad_request' });
    const r = await google('/places:searchText', { method: 'POST', fields: `${BASIC},primaryType`.split(',').map((f) => `places.${f}`).join(','), body: { textQuery: text, languageCode: lang, maxResultCount: 6 } });
    if (r.error) return out(502, { error: r.error });
    return out(200, { places: (r.json.places || []).map((p) => ({ ...brief(p), type: str(p.primaryType, 60) })) });
  }
  if (q.op === 'details') {
    const id = str(q.id, 300); if (!/^[A-Za-z0-9_-]{10,300}$/.test(id)) return out(400, { error: 'bad_request' });
    const r = await google(`/places/${encodeURIComponent(id)}?languageCode=${lang}`, { fields: `${BASIC},nationalPhoneNumber,internationalPhoneNumber,regularOpeningHours.weekdayDescriptions,regularOpeningHours.periods,reviews,primaryType` });
    if (r.error) return out(502, { error: r.error });
    const p = r.json;
    return out(200, { place: {
      ...brief(p), phone: str(p.internationalPhoneNumber || p.nationalPhoneNumber, 40), type: str(p.primaryType, 60),
      hours: (p.regularOpeningHours?.weekdayDescriptions || []).slice(0, 7).map((h) => str(h, 80)),
      hoursStruct: periodsToWeek(p.regularOpeningHours?.periods),
      // Google requires the author to be shown next to each review
      reviews: (p.reviews || []).slice(0, 5).map((v) => ({ rating: num(v.rating), text: str(v.text?.text || v.originalText?.text, 1200), author: str(v.authorAttribution?.displayName, 80), when: str(v.relativePublishTimeDescription, 40), at: str(v.publishTime, 40) })).filter((v) => v.text),
    }, fetchedAt: new Date().toISOString() });
  }
  if (q.op === 'nearby') {
    const lat = num(q.lat); const lng = num(q.lng);
    if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return out(400, { error: 'bad_request' });
    const types = TYPES[q.category] || null; const self = str(q.self, 300);
    const radius = Math.min(5000, Math.max(300, Number(q.radius) || 1500));
    const fields = BASIC.split(',').map((f) => `places.${f}`).join(',');
    const r = types
      ? await google('/places:searchNearby', { method: 'POST', fields, body: { includedTypes: types, maxResultCount: 12, rankPreference: 'DISTANCE', languageCode: lang, locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius } } } })
      : await google('/places:searchText', { method: 'POST', fields, body: { textQuery: str(q.q, 120) || 'shop', languageCode: lang, maxResultCount: 12, locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius } } } });
    if (r.error) return out(502, { error: r.error });
    const me = { lat, lng };
    const list = (r.json.places || []).map(brief).filter((p) => p.id !== self).map((p) => ({ ...p, distance: distM(me, p) })).filter((p) => p.distance == null || p.distance <= radius * 1.5).slice(0, 10);
    return out(200, { places: list, fetchedAt: new Date().toISOString() });
  }
  return out(400, { error: 'bad_request' });
}

/* ---------- website check ---------- */
// Only public internet addresses: no localhost, private ranges, cloud metadata, etc.
function privateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const x = ip.toLowerCase();
  if (!net.isIPv6(x)) return true; // not an address we understand: refuse
  const mapped = /^::ffff:(?:0:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(x); // ::ffff:7f00:1 = 127.0.0.1
  if (x.startsWith('::ffff:') && net.isIPv4(x.slice(7))) return privateIp(x.slice(7));
  if (mapped) { const a = parseInt(mapped[1], 16); const b = parseInt(mapped[2], 16); return privateIp(`${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`); }
  return x === '::' || x === '::1' || /^::[0-9a-f.:]*$/.test(x) // unspecified, loopback, IPv4-compatible
    || /^(fc|fd|fe[89ab]|ff)/.test(x) // unique-local, link-local, multicast
    || x.startsWith('64:ff9b:') || x.startsWith('2002:') || x.startsWith('2001:db8:') || /^2001:0?:/.test(x); // NAT64, 6to4, docs, Teredo
}
const ALLOW_LOCAL = () => process.env.LOCALBOOST_SITECHECK_ALLOW_LOCAL === '1';
// Checked again at the moment of connecting, so a name that answered with a public address a second ago
// cannot switch to a private one for the real request (DNS rebinding).
function guardedLookup(host, opts, cb) {
  dns.lookup(host, { all: true }, (err, addrs) => {
    if (err) return cb(err);
    if (!addrs.length || (!ALLOW_LOCAL() && addrs.some((a) => privateIp(a.address)))) return cb(Object.assign(new Error('blocked address'), { code: 'EBLOCKED' }));
    return opts?.all ? cb(null, addrs) : cb(null, addrs[0].address, addrs[0].family);
  });
}
/** GET with the guarded lookup, no automatic redirects, at most 2 MB read. */
function guardedGet(u) {
  return new Promise((resolve) => {
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.get(u, { lookup: guardedLookup, headers: { 'user-agent': 'ArctonAiSiteCheck/1.0', accept: 'text/html,*/*' }, timeout: 9000 }, (res) => {
      const chunks = []; let size = 0;
      res.on('data', (c) => { size += c.length; if (size > 2_000_000) { res.destroy(); return; } chunks.push(c); });
      const done = () => resolve({ status: res.statusCode || 0, location: res.headers.location || '', type: String(res.headers['content-type'] || ''), html: Buffer.concat(chunks).toString('utf8'), size });
      res.on('end', done); res.on('close', done); res.on('error', done);
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => resolve({ error: e.code === 'EBLOCKED' ? 'url_blocked' : 'unreachable' }));
  });
}
async function safeUrl(raw) {
  let u; try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return null; }
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) return null;
  if (u.port && !['80', '443'].includes(u.port)) return null;
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!host.includes('.') || /\.(local|internal|localhost)$/i.test(host)) return null;
  if (net.isIP(host) && !ALLOW_LOCAL() && privateIp(host)) return null;
  if (!ALLOW_LOCAL()) {
    let addrs = [];
    try { addrs = await lookup(host, { all: true }); } catch { return { dns: true, u }; } // the address does not exist (or DNS is down)
    if (!addrs.length || addrs.some((a) => privateIp(a.address))) return null;
  }
  return u;
}
async function fetchPage(start) {
  let u = start; const t0 = Date.now();
  for (let hop = 0; hop < 5; hop++) {
    const safe = await safeUrl(u.href); if (!safe) return { error: 'url_blocked' }; if (safe.dns) return { error: 'not_found' };
    const r = await guardedGet(safe);
    if (r.error) return { error: r.error };
    if (r.status >= 300 && r.status < 400 && r.location) { try { u = new URL(r.location, safe); } catch { return { error: 'unreachable' }; } continue; } // every hop is checked again
    return { status: r.status, url: safe.href, html: r.html, ms: Date.now() - t0, kb: Math.round(r.size / 1024), type: r.type };
  }
  return { error: 'too_many_redirects' };
}

const BOOK = /(rezerv|programar|book|reserv|termin|foglal|appointment|commander|order online|comand)/i;
const HOURS_WORDS = /(program|orar|opening hours|hours|horaires|öffnungszeiten|nyitvatart|nyitva)/i;
const TIME_RANGE = /\b([01]?\d|2[0-3])[:.][0-5]\d\s*(?:-|–|—|to|până la|bis|à)\s*([01]?\d|2[0-3])[:.][0-5]\d\b/;

export function analyseHtml(html, page) {
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const has = (re) => re.test(html);
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  const noAlt = imgs.filter((i) => !/\balt\s*=\s*["'][^"']+["']/i.test(i)).length;
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim().slice(0, 120);
  const checks = {
    reachable: page.status >= 200 && page.status < 400,
    https: page.url.startsWith('https://'),
    mobile: has(/<meta[^>]+name=["']viewport["']/i),
    title: title.length >= 3,
    description: has(/<meta[^>]+name=["']description["'][^>]+content=["'][^"']{20,}/i) || has(/<meta[^>]+content=["'][^"']{20,}["'][^>]+name=["']description["']/i),
    phone: has(/href=["']tel:/i),
    whatsapp: has(/wa\.me\/|api\.whatsapp\.com|whatsapp:\/\//i),
    email: has(/href=["']mailto:/i),
    booking: has(/<form\b/i) && BOOK.test(text) || /href=["'][^"']*(rezerv|book|reserv|termin|foglal|appointment)[^"']*["']/i.test(html) || /(calendly|booksy|fresha|treatwell|opentable|thefork|quandoo|setmore|simplybook)/i.test(html),
    hours: TIME_RANGE.test(text) && HOURS_WORDS.test(text) || has(/"openingHours/i),
    map: has(/google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|openstreetmap\.org|waze\.com/i),
    structured: has(/application\/ld\+json[\s\S]{0,4000}"@type"\s*:\s*"(LocalBusiness|Restaurant|CafeOrCoffeeShop|BeautySalon|Store|HairSalon|FoodEstablishment)/i),
    social: has(/instagram\.com\/|facebook\.com\/|tiktok\.com\/@/i),
    fast: page.ms < 3000 && page.kb < 3000,
  };
  const keys = Object.keys(checks);
  const passed = keys.filter((k) => checks[k]).length;
  return { url: page.url, status: page.status, title, ms: page.ms, kb: page.kb, imagesWithoutAlt: noAlt, words: text.split(' ').length, checks, score: Math.round((passed / keys.length) * 100) };
}

async function sitecheck({ method, query, body, headers, ip }) {
  if (!(await access(headers)).ok) return out(401, { error: 'auth_required' });
  if (throttled(`site:${ip}`, 20, 3600_000)) return out(429, { error: 'rate_limited' });
  const raw = str((method === 'GET' ? query : body || {}).url, 300);
  const u0 = await safeUrl(raw);
  if (!u0) return out(400, { error: 'url_blocked' });
  if (u0.dns) return out(200, { result: { url: u0.u.href, error: 'not_found', checks: { reachable: false }, score: 0 }, checkedAt: new Date().toISOString() });
  const u = u0;
  const page = await fetchPage(u);
  if (page.error) return out(200, { result: { url: u.href, error: page.error, checks: { reachable: false }, score: 0 }, checkedAt: new Date().toISOString() });
  if (!/html/i.test(page.type) && !/<html/i.test(page.html)) return out(200, { result: { url: page.url, error: 'not_html', checks: { reachable: false }, score: 0 }, checkedAt: new Date().toISOString() });
  return out(200, { result: analyseHtml(page.html, page), checkedAt: new Date().toISOString() });
}

const ROUTES = { places, sitecheck };
export async function handleData(route, req) {
  try { return await ROUTES[route](req); }
  catch (e) { console.error('[Arcton] data error', e); return out(500, { error: 'server_error' }); }
}
export async function vercelData(route, req, res, corsHeaders) {
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(corsHeaders(req.headers.origin))) res.setHeader(k, v);
  if (req.method === 'OPTIONS') return res.status(204).end();
  let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const r = await handleData(route, { method: req.method, query: req.query || {}, body: body || {}, headers: req.headers, ip });
  res.status(r.status).json(r.body);
}
