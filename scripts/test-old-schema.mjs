// Self-check: sign-in still works on a database that lacks the bank-transfer columns. node scripts/test-old-schema.mjs
import assert from 'node:assert/strict';
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_PUBLISHABLE_KEY: 'pk', SUPABASE_SECRET_KEY: 'sk', ARCTON_MAINTENANCE: 'off' });
const user = { id: '00000000-0000-4000-8000-000000000001', email: 'a@b.ro' };
const calls = [];
globalThis.fetch = async (url, init = {}) => {
  calls.push(`${init.method || 'GET'} ${url}`);
  const j = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (url.includes('/auth/v1/token')) return j(200, { access_token: 't', refresh_token: 'r', expires_in: 3600, user });
  if (url.includes('plan_request')) return j(400, { code: '42703', message: 'column profiles.plan_request does not exist' });
  if (url.includes('/rest/v1/profiles')) return j(200, [{ ...user, role: 'client', disabled: false, plan: 'free' }]);
  return j(404, {});
};
const { handleAccount } = await import('../lib/auth-core.mjs');
const r = await handleAccount('auth', { method: 'POST', query: {}, body: { op: 'login', email: user.email, password: 'parola-lunga' }, headers: {}, ip: '1.1.1.1' });
assert.equal(r.status, 200, `login answered ${r.status} ${JSON.stringify(r.body)}`);
assert.equal(r.body.session.user.email, user.email);
assert.ok(calls.some((c) => c.includes('plan_request')) && calls.at(-1).includes('select=id,email'), 'tried the new columns, then the old ones');
console.log('old schema ok');
