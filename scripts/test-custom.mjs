// Self-check: the admin acts on a client's site ("as"), uploads a hand-made site, and it is served sandboxed
// in place of the template. A client cannot do either. node scripts/test-custom.mjs
import assert from 'node:assert/strict';
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_PUBLISHABLE_KEY: 'pk', SUPABASE_SECRET_KEY: 'sk' });
const ADMIN = 'aaaaaaaa-0000-0000-0000-000000000001'; const CLIENT = 'cccccccc-0000-0000-0000-000000000002';
const users = { 'tok-admin': { id: ADMIN, role: 'admin' }, 'tok-client': { id: CLIENT, role: 'client' } };
const sites = {}; const j = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url); const m = init.method || 'GET'; const p = u.searchParams;
  if (u.pathname === '/auth/v1/user') { const x = users[String(init.headers?.authorization || '').slice(7)]; return x ? j(200, { id: x.id, email: `${x.role}@t.ro` }) : j(401, {}); }
  if (u.pathname === '/rest/v1/profiles') { const id = (p.get('id') || '').slice(3); const x = Object.values(users).find((y) => y.id === id); return j(200, x ? [{ id, email: `${x.role}@t.ro`, role: x.role, plan: 'business', disabled: false }] : []); }
  if (u.pathname === '/rest/v1/sites' && m === 'GET') {
    const owner = p.get('owner')?.slice(3); const slug = p.get('slug')?.slice(3);
    const row = owner ? sites[owner] : Object.values(sites).find((s) => s.slug === slug);
    if (!row) return j(200, []);
    return j(200, [{ ...row, owner: Object.keys(sites).find((k) => sites[k] === row), profiles: { plan: 'business', role: 'client', email: 'c@t.ro', disabled: false } }]);
  }
  if (u.pathname === '/rest/v1/sites' && m === 'POST') { const b = JSON.parse(init.body); sites[b.owner] = { ...(sites[b.owner] || {}), ...b }; return j(201, []); }
  if (u.pathname === '/rest/v1/sites' && m === 'PATCH') { const o = p.get('owner').slice(3); Object.assign(sites[o], JSON.parse(init.body)); return j(200, []); }
  return j(200, []);
};
const { handleSite } = await import('../lib/site-core.mjs');
const call = (tok, body) => handleSite({ method: 'POST', query: {}, body, headers: { authorization: `Bearer ${tok}` }, origin: 'https://arcton.site', ip: '1.1.1.1' });
const page = (slug) => handleSite({ method: 'GET', query: { op: 'page', slug }, body: {}, headers: {}, origin: 'https://arcton.site', ip: '1.1.1.1' });
const HTML = '<!doctype html><html><body><h1>Aurora, făcut de mână</h1></body></html>';

assert.equal((await call('tok-client', { op: 'custom-set', as: CLIENT, html: HTML, slug: 'aurora' })).status, 403, 'only the admin uploads custom sites');
assert.equal((await call('tok-client', { op: 'unpublish', as: ADMIN })).status, 403, 'a client can never act as someone else');
assert.equal((await call('tok-admin', { op: 'custom-set', as: CLIENT, html: 'hello', slug: 'aurora' })).body.error, 'not_html');
assert.equal((await call('tok-admin', { op: 'push-sub', as: CLIENT, sub: {} })).status, 400, 'the admin phone never subscribes as a client');
let r = await call('tok-admin', { op: 'custom-set', as: CLIENT, html: HTML, slug: 'aurora', name: 'Cafeneaua Aurora' });
assert.equal(r.status, 200); assert.equal(r.body.url, 'https://arcton.site/s/aurora'); assert.ok(sites[CLIENT], 'stored under the client, not the admin'); assert.ok(!sites[ADMIN]);
const pg = await page('aurora');
assert.equal(pg.status, 200); assert.match(pg.body, /făcut de mână/); assert.match(pg.body, /window\.ARCTON=\{api:"https:\/\/arcton\.site\/api\/site",slug:"aurora"\}/);
assert.match(pg.headers['content-security-policy'], /sandbox allow-scripts/); assert.doesNotMatch(pg.headers['content-security-policy'], /allow-same-origin/, 'never on the app\'s origin');
r = await call('tok-admin', { op: 'publish', as: CLIENT, slug: 'aurora', doc: { biz: { name: 'Cafeneaua Aurora' } } });
assert.equal(r.status, 200, 'the admin publishes the template site for the client'); assert.ok(sites[CLIENT].custom_html, 'publishing the template keeps the custom site');
r = await call('tok-admin', { op: 'custom-remove', as: CLIENT }); assert.equal(r.status, 200); assert.equal(sites[CLIENT].custom_html, null);
assert.doesNotMatch((await page('aurora')).body, /făcut de mână/, 'back to the template');
console.log('custom ok');
