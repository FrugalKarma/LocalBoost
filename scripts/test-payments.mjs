// Self-check: recording a bank transfer sets the plan end date (renewals continue from the current end). node scripts/test-payments.mjs
import assert from 'node:assert/strict';
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_PUBLISHABLE_KEY: 'pk', SUPABASE_SECRET_KEY: 'sk', ARCTON_MAINTENANCE: 'off', RESEND_API_KEY: '' });
const ADMIN = '00000000-0000-4000-8000-00000000000a'; const CLIENT = '00000000-0000-4000-8000-00000000000c';
const rows = { [ADMIN]: { id: ADMIN, email: 'a@x.ro', role: 'admin', disabled: false, plan: 'free' }, [CLIENT]: { id: CLIENT, email: 'c@x.ro', role: 'client', disabled: false, plan: 'free', plan_until: null } };
const paid = [];
const j = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url); const m = init.method || 'GET';
  if (u.pathname === '/auth/v1/user') return j(200, { id: ADMIN, email: 'a@x.ro' });
  if (u.pathname === '/rest/v1/payments') { const r = { id: paid.length + 1, ...JSON.parse(init.body) }; paid.push(r); return j(201, [r]); }
  if (u.pathname === '/rest/v1/profiles') {
    const id = u.searchParams.get('id')?.slice(3); const row = rows[id];
    if (m === 'PATCH') { Object.assign(row, JSON.parse(init.body)); return j(200, []); }
    return j(200, row ? [row] : []);
  }
  return j(404, {});
};
const { handleAccount, planOf } = await import('../lib/auth-core.mjs');
const pay = (body) => handleAccount('admin', { method: 'POST', query: {}, body: { op: 'paid', id: CLIENT, ...body }, headers: { authorization: 'Bearer t' }, ip: '1.1.1.1' });
const ymd = (d) => d.toISOString().slice(0, 10); const today = new Date();
const plus = (m) => { const d = new Date(`${ymd(today)}T00:00:00Z`); const day = d.getUTCDate(); d.setUTCMonth(d.getUTCMonth() + m); if (d.getUTCDate() < day) d.setUTCDate(0); return ymd(d); };

let r = await pay({ plan: 'pro', months: 3, amount: 119.97, reference: 'ARCTON-1' });
assert.equal(r.status, 200); assert.equal(r.body.planUntil, plus(3)); assert.equal(rows[CLIENT].plan, 'pro'); assert.equal(paid[0].amount_eur, 119.97);
r = await pay({ plan: 'pro', months: 1, amount: 39.99 }); // renewal: continues from the current end date
assert.equal(r.body.planUntil, (() => { const d = new Date(`${plus(3)}T00:00:00Z`); const day = d.getUTCDate(); d.setUTCMonth(d.getUTCMonth() + 1); if (d.getUTCDate() < day) d.setUTCDate(0); return ymd(d); })());
r = await pay({ plan: 'business', months: 1, amount: 79.99 }); // a different plan starts today
assert.equal(r.body.planUntil, plus(1)); assert.equal(rows[CLIENT].plan, 'business');
assert.equal((await pay({ plan: 'pro', months: 2, amount: 79.98 })).status, 400, 'only 1, 3, 6 or 12 months');
assert.equal((await pay({ plan: 'pro', months: 1, amount: 0 })).status, 400, 'an amount is required');
// end date passed: a week of grace, then the plan falls back to free
const ago = (d) => ymd(new Date(Date.now() - d * 864e5));
assert.equal(planOf({ plan: 'pro', plan_until: ago(3) }), 'pro');
assert.equal(planOf({ plan: 'pro', plan_until: ago(9) }), 'free');
assert.equal(planOf({ plan: 'pro', plan_until: null }), 'pro', 'set by hand: no end date');
// free trial: the admin grants Pro or Business for 7, 14 or 30 days; the request and its note are cleared
Object.assign(rows[CLIENT], { plan: 'free', plan_until: null, plan_request: 'trial', plan_request_note: 'cafenea' });
const trial = (body) => handleAccount('admin', { method: 'POST', query: {}, body: { op: 'trial', id: CLIENT, ...body }, headers: { authorization: 'Bearer t' }, ip: '1.1.1.1' });
assert.equal((await trial({ plan: 'pro', days: 10 })).status, 400, 'only 7, 14 or 30 days');
assert.equal((await trial({ plan: 'free', days: 7 })).status, 400, 'only a paid plan');
r = await trial({ plan: 'business', days: 14 });
assert.equal(r.status, 200); assert.equal(rows[CLIENT].plan, 'business'); assert.equal(rows[CLIENT].plan_until, ymd(new Date(Date.now() + 14 * 864e5)));
assert.equal(rows[CLIENT].plan_request, null); assert.equal(rows[CLIENT].plan_request_note, null);
console.log('payments ok');
