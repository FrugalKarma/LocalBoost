// Self-check for the per-client limits (Google lookups per month, AI requests per day). node scripts/test-limits.mjs
import assert from 'node:assert/strict';
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_PUBLISHABLE_KEY: 'pk', SUPABASE_SECRET_KEY: 'sk', ARCTON_MAINTENANCE: 'off', GOOGLE_PLACES_API_KEY: 'g' });
const id = '00000000-0000-4000-8000-000000000001';
let row; let oldSchema = false; let googleDown = false;
const reset = (extra = {}) => { row = { id, email: 'a@b.ro', role: 'client', disabled: false, plan: 'free', ai_month: null, ai_count: 0, places_month: null, places_count: 0, ai_day: null, ai_day_count: 0, ...extra }; };
const j = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url); const m = init.method || 'GET';
  if (u.hostname === 'places.googleapis.com') return googleDown ? j(500, {}) : j(200, { places: [{ id: 'abcdefghijkl', displayName: { text: 'Cafe' } }] });
  if (u.pathname === '/auth/v1/user') return j(200, { id, email: row.email });
  if (u.pathname !== '/rest/v1/profiles') return j(404, {});
  const q = [...u.searchParams];
  if (oldSchema && /places_|ai_day/.test(u.search + (init.body || ''))) return j(400, { code: '42703' });
  const match = q.every(([k, v]) => {
    if (k === 'id') return v === `eq.${id}`; if (k === 'select') return true;
    if (k === 'or') { const [col, , val] = v.slice(1, -1).split(',')[1].split('.'); return row[col] == null || row[col] !== val; }
    return String(row[k]) === v.slice(3);
  });
  if (m === 'GET') return j(200, match ? [row] : []);
  if (!match) return j(200, []);
  Object.assign(row, JSON.parse(init.body)); return j(200, [row]);
};
const { aiAccess, LIMITS, FREE_AI_PER_MONTH } = await import('../lib/auth-core.mjs');
const { handleData } = await import('../lib/places-core.mjs');
const H = { authorization: 'Bearer user-token' };
let n = 0; const look = () => handleData('places', { method: 'GET', query: { op: 'search', q: 'cafe iasi' }, body: {}, headers: H, ip: `10.0.${Math.floor(n / 30)}.${n++ % 30}` });

reset();
for (let i = 0; i < LIMITS.places.free; i++) assert.equal((await look()).status, 200, `lookup ${i + 1}`);
assert.deepEqual(await look().then((r) => [r.status, r.body.error]), [429, 'quota_reached'], 'free plan: monthly Google limit');
reset({ places_month: '2000-01', places_count: 999 }); assert.equal((await look()).status, 200, 'a new month starts at zero');
reset(); googleDown = true; assert.equal((await look()).status, 502); googleDown = false; assert.equal(row.places_count, 0, 'failed Google call is not counted');
reset({ role: 'admin', places_month: new Date().toISOString().slice(0, 7), places_count: 9999 }); assert.equal((await look()).status, 200, 'admin is not limited');

reset({ plan: 'pro' });
for (let i = 0; i < LIMITS.ai.pro; i++) assert.ok((await aiAccess(H, 'creator')).ok, `ai ${i + 1}`);
assert.equal((await aiAccess(H, 'creator')).error, 'daily_limit', 'pro: daily AI limit');
reset();
for (let i = 0; i < FREE_AI_PER_MONTH; i++) assert.ok((await aiAccess(H, 'analyst')).ok);
const before = row.ai_day_count; assert.equal((await aiAccess(H, 'analyst')).error, 'quota_reached', 'free: monthly analyses');
assert.equal(row.ai_day_count, before, 'a refused analysis gives the daily unit back');
const g = await aiAccess(H, 'namer'); await g.release(); assert.equal(row.ai_day_count, before, 'release gives the unit back');

reset(); oldSchema = true; assert.equal((await look()).status, 200, 'database without the new columns still works');
console.log('limits ok');
