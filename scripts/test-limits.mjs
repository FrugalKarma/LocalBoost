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
const { aiAccess, LIMITS, CREDITS, creditState } = await import('../lib/auth-core.mjs');
const { handleData } = await import('../lib/places-core.mjs');
const H = { authorization: 'Bearer user-token' };
let n = 0; const look = () => handleData('places', { method: 'GET', query: { op: 'search', q: 'cafe iasi' }, body: {}, headers: H, ip: `10.0.${Math.floor(n / 30)}.${n++ % 30}` });

reset();
assert.deepEqual(await look().then((r) => [r.status, r.body.error]), [402, 'plan_required'], 'no plan: no Google lookups');
assert.equal((await aiAccess(H, 'analyst')).error, 'plan_required', 'no plan: no AI');
reset({ plan: 'pro' });
for (let i = 0; i < LIMITS.places.pro; i++) assert.equal((await look()).status, 200, `lookup ${i + 1}`);
assert.deepEqual(await look().then((r) => [r.status, r.body.error]), [429, 'quota_reached'], 'pro: monthly Google limit');
reset({ plan: 'pro', places_month: '2000-01', places_count: 999 }); assert.equal((await look()).status, 200, 'a new month starts at zero');
reset({ plan: 'pro' }); googleDown = true; assert.equal((await look()).status, 502); googleDown = false; assert.equal(row.places_count, 0, 'failed Google call is not counted');
reset({ role: 'admin', places_month: new Date().toISOString().slice(0, 7), places_count: 9999 }); assert.equal((await look()).status, 200, 'admin is not limited');

reset({ plan: 'pro' });
for (let i = 0; i < LIMITS.ai.pro; i++) assert.ok((await aiAccess(H, 'creator')).ok, `ai ${i + 1}`);
assert.equal((await aiAccess(H, 'creator')).error, 'daily_limit', 'pro: daily AI limit');
reset({ plan: 'pro' }); const before = row.ai_day_count;
const g = await aiAccess(H, 'namer'); await g.release(); assert.equal(row.ai_day_count, before, 'release gives the unit back');

reset({ plan: 'pro' }); oldSchema = true; assert.equal((await look()).status, 200, 'database without the new columns still works');

// credits: allowance first, then bought credits; a trial has its own smaller amount
oldSchema = false;
const C = { credits_period: null, credits_used: 0, credits_extra: 0, plan_trial: false };
const soon = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
reset({ plan: 'pro', plan_until: soon, ...C, plan_trial: true });
for (let i = 0; i < CREDITS.trial / 2; i++) assert.ok((await aiAccess(H, 'analyst')).ok, `trial analysis ${i + 1}`);
assert.equal((await aiAccess(H, 'analyst')).error, 'no_credits', 'trial: credits run out');
assert.equal(row.ai_day_count, CREDITS.trial / 2, 'refused call does not count against the daily limit');
assert.deepEqual(await look().then((r) => [r.status, r.body.error]), [402, 'no_credits'], 'no credits: no Google lookup');
assert.equal(row.places_count, 0, 'refused lookup is not counted');
row.credits_extra = 5;
assert.ok((await aiAccess(H, 'analyst')).ok); assert.ok((await aiAccess(H, 'analyst')).ok); assert.equal(row.credits_extra, 1, 'bought credits are used after the allowance');
assert.equal((await aiAccess(H, 'analyst')).error, 'no_credits', 'not enough bought credits left');
reset({ plan: 'pro', ...C, credits_period: new Date().toISOString().slice(0, 7), credits_used: CREDITS.pro - 1, credits_extra: 1 });
const g2 = await aiAccess(H, 'creator'); assert.ok(g2.ok); assert.deepEqual([row.credits_used, row.credits_extra], [CREDITS.pro, 0], 'split between allowance and bought');
await g2.release(); assert.deepEqual([row.credits_used, row.credits_extra], [CREDITS.pro - 1, 1], 'release gives both back');
reset({ plan: 'pro', ...C, credits_period: '2000-01', credits_used: 999 }); assert.equal(creditState(row).used, 0, 'a new month starts at zero');
assert.ok((await aiAccess(H, 'chat')).ok); assert.equal(row.credits_used, 1);
console.log('limits ok');
