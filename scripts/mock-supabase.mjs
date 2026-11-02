// Tiny stand-in for Supabase (Auth + the LocalBoost tables) and Google Places so accounts can be tested offline.
//   node scripts/mock-supabase.mjs            → http://localhost:5299
//   SUPABASE_URL=http://localhost:5299 SUPABASE_ANON_KEY=mock-public SUPABASE_SERVICE_ROLE_KEY=mock-secret \
//   GOOGLE_PLACES_API_KEY=mock-google GOOGLE_PLACES_URL=http://localhost:5299/v1 node server.mjs
// MOCK_CONFIRM=1 makes sign-up wait for email confirmation (open /mock/confirm?email=… to confirm).
// Only the calls lib/auth-core.mjs makes are implemented. Data lives in memory.
import http from 'node:http';
import { randomUUID, randomBytes } from 'node:crypto';

const PORT = Number(process.env.MOCK_SUPABASE_PORT) || 5299;
const PUBLIC = 'mock-public'; const SECRET = 'mock-secret';
const CONFIRM = process.env.MOCK_CONFIRM === '1';
const users = new Map(); // id → { id, email, password, confirmed, banned }
const tokens = new Map(); // access → { id, exp }
const refresh = new Map(); // refresh → id
const profiles = new Map(); const businesses = new Map();
export const mail = [];
const media = new Map(); // storage: bucket/path → { type, body } // recovery / confirmation messages

const byEmail = (e) => [...users.values()].find((u) => u.email === e);
function issue(u) {
  const access = randomBytes(16).toString('hex'); const rt = randomBytes(16).toString('hex');
  tokens.set(access, { id: u.id, exp: Date.now() + 3600e3 }); refresh.set(rt, u.id);
  return { access_token: access, refresh_token: rt, expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: u.id, email: u.email } };
}
const err = (status, code, msg) => [status, { code: status, error_code: code, msg }];
const who = (h) => { const t = tokens.get(String(h.authorization || '').replace(/^Bearer /, '')); return t && t.exp > Date.now() ? users.get(t.id) : null; };

function authRoute(method, p, q, body, h) {
  const key = h.apikey;
  if (key !== PUBLIC && key !== SECRET) return err(401, 'no_api_key', 'Invalid API key');
  if (p === '/auth/v1/signup' && method === 'POST') {
    if (byEmail(body.email)) return CONFIRM ? [200, { id: randomUUID(), email: body.email }] : err(422, 'user_already_exists', 'User already registered');
    if (String(body.password).length < 8) return err(422, 'weak_password', 'Password should be at least 8 characters.');
    const u = { id: randomUUID(), email: body.email, password: body.password, confirmed: !CONFIRM, banned: false };
    users.set(u.id, u); profiles.set(u.id, { id: u.id, email: u.email, role: 'client', disabled: false, created_at: new Date().toISOString() });
    if (CONFIRM) { mail.push({ type: 'signup', email: u.email, redirect: q.get('redirect_to') }); return [200, { id: u.id, email: u.email }]; }
    return [200, issue(u)];
  }
  if (p === '/auth/v1/token' && method === 'POST') {
    if (q.get('grant_type') === 'password') {
      const u = byEmail(body.email);
      if (!u || u.password !== body.password) return err(400, 'invalid_credentials', 'Invalid login credentials');
      if (!u.confirmed) return err(400, 'email_not_confirmed', 'Email not confirmed');
      if (u.banned) return err(400, 'user_banned', 'User is banned');
      return [200, issue(u)];
    }
    const id = refresh.get(body.refresh_token); refresh.delete(body.refresh_token);
    const u = id && users.get(id);
    if (!u) return err(400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found');
    if (u.banned) return err(400, 'user_banned', 'User is banned');
    return [200, issue(u)];
  }
  if (p === '/auth/v1/recover' && method === 'POST') { if (byEmail(body.email)) mail.push({ type: 'recovery', email: body.email, redirect: q.get('redirect_to') }); return [200, {}]; }
  if (p === '/auth/v1/user') {
    const u = who(h); if (!u) return err(401, 'bad_jwt', 'invalid JWT');
    if (method === 'PUT') { if (body.password === u.password) return err(422, 'same_password', 'New password should be different'); u.password = body.password; }
    return [200, { id: u.id, email: u.email }];
  }
  if (p === '/auth/v1/logout') { const t = String(h.authorization || '').replace(/^Bearer /, ''); tokens.delete(t); return [204, null]; }
  const m = p.match(/^\/auth\/v1\/admin\/users\/([\w-]+)$/);
  if (m) {
    if (key !== SECRET) return err(403, 'not_admin', 'User not allowed');
    const u = users.get(m[1]); if (!u) return err(404, 'user_not_found', 'User not found');
    if (method === 'DELETE') { users.delete(u.id); profiles.delete(u.id); businesses.delete(u.id); for (const [k, v] of tokens) if (v.id === u.id) tokens.delete(k); return [200, {}]; }
    if (method === 'PUT') { u.banned = body.ban_duration !== 'none'; return [200, { id: u.id }]; }
  }
  return err(404, 'not_found', 'not found');
}

// PostgREST subset: eq / gte / is filters, select (incl. embedded businesses(...)), order, limit, insert/upsert, patch, delete, rpc.
const tables = { profiles: [new Map(), 'id'], businesses: [new Map(), 'owner'], sites: [new Map(), 'owner'], site_requests: [new Map(), 'id'], site_stats: [new Map(), 'key'] };
tables.profiles[0] = profiles; tables.businesses[0] = businesses;
let seq = 1;
function restRoute(method, table, q, body, h) {
  if (h.apikey !== SECRET) return [401, { message: 'permission denied' }]; // RLS with no policies
  if (table === 'rpc/localboost_site_hit') {
    const key = `${body.p_owner}|${body.p_day}`; const st = tables.site_stats[0];
    const row = st.get(key) || { key, owner: body.p_owner, day: body.p_day, views: 0, clicks: 0, requests: 0 };
    row[{ view: 'views', click: 'clicks', request: 'requests' }[body.p_kind]] += 1; st.set(key, row); return [204, null];
  }
  const t = tables[table]; if (!t) return [404, { message: 'no table' }];
  const [store, pk] = t;
  const filters = [...q.entries()].filter(([k]) => !['select', 'order', 'limit', 'on_conflict'].includes(k));
  const match = (r) => filters.every(([k, v]) => {
    if (v.startsWith('eq.')) return String(r[k]) === v.slice(3);
    if (v.startsWith('gte.')) return String(r[k]) >= v.slice(4);
    if (v.startsWith('is.')) return String(r[k]) === v.slice(3);
    return true;
  });
  const prefer = String(h.prefer || '');
  const clean = (r) => { const { key, ...rest } = r; return table === 'site_stats' ? rest : r; };
  if (method === 'GET') {
    let rows = [...store.values()].filter(match).map((r) => clean({ ...r }));
    const sel = q.get('select') || '';
    if (table === 'sites' && /profiles\(/.test(sel)) rows = rows.map((r) => { const pr = profiles.get(r.owner); return { ...r, profiles: pr ? { plan: pr.plan || 'free', role: pr.role, email: pr.email, disabled: pr.disabled } : null }; });
    if (/businesses\(/.test(sel)) rows = rows.map((r) => { const b = businesses.get(r.id); return { ...r, businesses: b ? { name: b.name, category: b.category, city: b.city, stage: b.stage, updated_at: b.updated_at } : null }; });
    const ord = q.get('order'); if (ord) { const [col, dir] = ord.split('.'); rows.sort((a, b) => String(a[col]).localeCompare(String(b[col])) * (dir === 'desc' ? -1 : 1)); }
    return [200, rows.slice(0, Number(q.get('limit')) || 1000)];
  }
  if (method === 'POST') {
    const row = { ...(Array.isArray(body) ? body[0] : body) };
    if (table === 'site_requests') { row.id = seq++; row.created_at = new Date().toISOString(); row.status = 'new'; }
    if (table === 'sites') { const other = [...store.values()].find((r) => r.slug === row.slug && r.owner !== row.owner); if (other) return [409, { code: '23505', message: 'duplicate slug' }]; }
    if (store.has(row[pk])) {
      if (prefer.includes('ignore-duplicates')) return [201, []];
      if (prefer.includes('merge-duplicates')) { Object.assign(store.get(row[pk]), row); return [201, [store.get(row[pk])]]; }
      return [409, { code: '23505', message: 'duplicate key value violates unique constraint' }];
    }
    const full = table === 'profiles' ? { role: 'client', disabled: false, created_at: new Date().toISOString(), ...row } : row;
    store.set(row[pk], full); return [201, prefer.includes('return=representation') ? [full] : []];
  }
  if (method === 'PATCH') {
    const hit = [...store.values()].filter(match);
    hit.forEach((r) => Object.assign(r, body));
    return [200, prefer.includes('return=representation') ? hit : []];
  }
  if (method === 'DELETE') { [...store.values()].filter(match).forEach((r) => store.delete(r[pk])); return [204, null]; }
  return [405, {}];
}

// Google Places (New) subset, for GOOGLE_PLACES_URL=http://localhost:5299/v1
const PLACES = [
  { id: 'ChIJmockOwner000001', displayName: { text: 'Cafe Test Copou' }, formattedAddress: 'Bd. Carol I 10, Iași', location: { latitude: 47.1745, longitude: 27.5715 }, rating: 4.6, userRatingCount: 212, googleMapsUri: 'https://maps.google.com/?cid=1', websiteUri: 'https://example.com/',
    internationalPhoneNumber: '+40 712 345 678', regularOpeningHours: { weekdayDescriptions: ['Monday: 8:00 AM – 8:00 PM', 'Tuesday: 8:00 AM – 8:00 PM', 'Wednesday: 8:00 AM – 8:00 PM', 'Thursday: 8:00 AM – 8:00 PM', 'Friday: 8:00 AM – 10:00 PM', 'Saturday: 9:00 AM – 10:00 PM', 'Sunday: Closed'],
      periods: [1, 2, 3, 4].map((d) => ({ open: { day: d, hour: 8, minute: 0 }, close: { day: d, hour: 20, minute: 0 } })).concat([{ open: { day: 5, hour: 8, minute: 0 }, close: { day: 5, hour: 22, minute: 0 } }, { open: { day: 6, hour: 9, minute: 0 }, close: { day: 6, hour: 22, minute: 0 } }]) },
    reviews: [
      { rating: 5, text: { text: 'Lovely quiet place to work, great flat white. Wish they opened on Sundays.' }, authorAttribution: { displayName: 'Ioana P.' }, relativePublishTimeDescription: '2 weeks ago' },
      { rating: 4, text: { text: 'Good coffee, friendly staff. Hard to find a table around 3 pm.' }, authorAttribution: { displayName: 'Mark T.' }, relativePublishTimeDescription: 'a month ago' },
      { rating: 2, text: { text: 'Came on Sunday and it was closed, the hours on Google were not clear.' }, authorAttribution: { displayName: 'Radu M.' }, relativePublishTimeDescription: '3 months ago' },
    ] },
  { id: 'ChIJmockRival000002', displayName: { text: 'Bean There' }, formattedAddress: 'Str. Copou 3, Iași', location: { latitude: 47.1760, longitude: 27.5700 }, rating: 4.4, userRatingCount: 530, googleMapsUri: 'https://maps.google.com/?cid=2', websiteUri: 'https://beanthere.example' },
  { id: 'ChIJmockRival000003', displayName: { text: 'Parc Coffee' }, formattedAddress: 'Str. Parcului 1, Iași', location: { latitude: 47.1720, longitude: 27.5740 }, rating: 4.8, userRatingCount: 96, googleMapsUri: 'https://maps.google.com/?cid=3' },
  { id: 'ChIJmockRival000004', displayName: { text: 'Espresso Lab' }, formattedAddress: 'Str. Universității 7, Iași', location: { latitude: 47.1735, longitude: 27.5690 }, rating: 4.1, userRatingCount: 61, googleMapsUri: 'https://maps.google.com/?cid=4', websiteUri: 'https://espressolab.example' },
];
function placesRoute(method, p, body, h) {
  if (h['x-goog-api-key'] !== 'mock-google') return [403, { error: { message: 'API key not valid' } }];
  if (p === '/v1/places:searchText') return [200, { places: PLACES.filter((x) => (body.textQuery || '').toLowerCase().includes('cafe') || x.displayName.text.toLowerCase().includes(String(body.textQuery || '').toLowerCase().split(' ')[0])).slice(0, body.maxResultCount || 5) }];
  if (p === '/v1/places:searchNearby') return [200, { places: PLACES }];
  const m = p.match(/^\/v1\/places\/([\w-]+)$/); if (m) { const x = PLACES.find((y) => y.id === m[1]); return x ? [200, x] : [404, { error: { message: 'not found' } }]; }
  return [404, {}];
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'); const chunks = [];
  for await (const c of req) chunks.push(c);
  const rawBuf = Buffer.concat(chunks); const raw = url.pathname.startsWith('/storage/') ? '' : rawBuf.toString('utf8');
  let body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch { /* ignore */ }
  let r;
  if (url.pathname === '/mock/confirm') { const u = byEmail(url.searchParams.get('email')); if (u) u.confirmed = true; r = [200, { confirmed: !!u }]; }
  else if (url.pathname === '/mock/mail') r = [200, mail];
  else if (url.pathname === '/mock/session') { const u = byEmail(url.searchParams.get('email')); r = u ? [200, issue(u)] : [404, {}]; } // what a confirmation / reset link would hand the app
  else if (url.pathname === '/mock/plan') { const u = byEmail(url.searchParams.get('email')); if (u) profiles.get(u.id).plan = url.searchParams.get('plan') || 'business'; r = [200, { ok: !!u }]; }
  else if (url.pathname === '/mock/role') { const u = byEmail(url.searchParams.get('email')); if (u) profiles.get(u.id).role = url.searchParams.get('role') || 'admin'; r = [200, { ok: !!u }]; }
  else if (url.pathname.startsWith('/auth/v1/')) r = authRoute(req.method, url.pathname, url.searchParams, body, req.headers);
  else if (url.pathname.startsWith('/rest/v1/')) r = restRoute(req.method, url.pathname.slice(9), url.searchParams, body, req.headers);
  else if (url.pathname.startsWith('/storage/v1/object/') && req.method === 'POST') {
    if (req.headers.apikey !== SECRET) r = [403, { message: 'denied' }];
    else { const key = url.pathname.replace('/storage/v1/object/', ''); media.set(key, { type: req.headers['content-type'], body: rawBuf }); r = [200, { Key: key }]; }
  } else if (url.pathname.startsWith('/storage/v1/object/public/')) {
    const m = media.get(url.pathname.replace('/storage/v1/object/public/', ''));
    if (!m) r = [404, {}]; else { res.writeHead(200, { 'content-type': m.type, 'access-control-allow-origin': '*' }); return res.end(m.body); }
  } else if (url.pathname.startsWith('/v1/places')) r = placesRoute(req.method, url.pathname, body, req.headers);
  else if (url.pathname === '/mock/site.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<!doctype html><html><head><title>Cafe Test</title><meta name="viewport" content="width=device-width"></head><body><h1>Cafe Test</h1><p>Program: Luni-Vineri 08:00-20:00</p><a href="tel:+40712">Call</a><a href="https://instagram.com/x">ig</a></body></html>'); }
  else r = [404, {}];
  res.writeHead(r[0], { 'content-type': 'application/json' });
  res.end(r[1] === null ? '' : JSON.stringify(r[1]));
}).listen(PORT, () => console.log(`mock Supabase on http://localhost:${PORT}`));
