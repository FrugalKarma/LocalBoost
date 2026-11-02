// Tiny stand-in for Supabase (Auth + the two LocalBoost tables) so accounts can be tested offline.
//   node scripts/mock-supabase.mjs            → http://localhost:5299
//   SUPABASE_URL=http://localhost:5299 SUPABASE_ANON_KEY=mock-public SUPABASE_SERVICE_ROLE_KEY=mock-secret node server.mjs
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
export const mail = []; // recovery / confirmation messages

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

// PostgREST subset: eq filters, select (incl. one embedded businesses(...)), order, limit, insert, patch.
function restRoute(method, table, q, body, h) {
  if (h.apikey !== SECRET) return [401, { message: 'permission denied' }]; // RLS with no policies
  const store = table === 'profiles' ? profiles : table === 'businesses' ? businesses : null;
  if (!store) return [404, { message: 'no table' }];
  const pk = table === 'profiles' ? 'id' : 'owner';
  const filters = [...q.entries()].filter(([k, v]) => !['select', 'order', 'limit'].includes(k) && v.startsWith('eq.')).map(([k, v]) => [k, v.slice(3)]);
  const match = (r) => filters.every(([k, v]) => String(r[k]) === v);
  const prefer = String(h.prefer || '');
  if (method === 'GET') {
    let rows = [...store.values()].filter(match).map((r) => ({ ...r }));
    const sel = q.get('select') || '';
    if (/businesses\(/.test(sel)) rows = rows.map((r) => { const b = businesses.get(r.id); return { ...r, businesses: b ? { name: b.name, category: b.category, city: b.city, stage: b.stage, updated_at: b.updated_at } : null }; });
    if (q.get('order') === 'created_at.desc') rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return [200, rows.slice(0, Number(q.get('limit')) || 1000)];
  }
  if (method === 'POST') {
    const row = Array.isArray(body) ? body[0] : body;
    if (store.has(row[pk])) return prefer.includes('ignore-duplicates') ? [201, []] : [409, { code: '23505', message: 'duplicate key value violates unique constraint' }];
    const full = table === 'profiles' ? { role: 'client', disabled: false, created_at: new Date().toISOString(), ...row } : row;
    store.set(row[pk], full); return [201, [full]];
  }
  if (method === 'PATCH') {
    const hit = [...store.values()].filter(match);
    hit.forEach((r) => Object.assign(r, body));
    return [200, prefer.includes('return=representation') ? hit : []];
  }
  return [405, {}];
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'); let raw = '';
  for await (const c of req) raw += c;
  let body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch { /* ignore */ }
  let r;
  if (url.pathname === '/mock/confirm') { const u = byEmail(url.searchParams.get('email')); if (u) u.confirmed = true; r = [200, { confirmed: !!u }]; }
  else if (url.pathname === '/mock/mail') r = [200, mail];
  else if (url.pathname === '/mock/session') { const u = byEmail(url.searchParams.get('email')); r = u ? [200, issue(u)] : [404, {}]; } // what a confirmation / reset link would hand the app
  else if (url.pathname === '/mock/role') { const u = byEmail(url.searchParams.get('email')); if (u) profiles.get(u.id).role = url.searchParams.get('role') || 'admin'; r = [200, { ok: !!u }]; }
  else if (url.pathname.startsWith('/auth/v1/')) r = authRoute(req.method, url.pathname, url.searchParams, body, req.headers);
  else if (url.pathname.startsWith('/rest/v1/')) r = restRoute(req.method, url.pathname.slice(9), url.searchParams, body, req.headers);
  else r = [404, {}];
  res.writeHead(r[0], { 'content-type': 'application/json' });
  res.end(r[1] === null ? '' : JSON.stringify(r[1]));
}).listen(PORT, () => console.log(`mock Supabase on http://localhost:${PORT}`));
