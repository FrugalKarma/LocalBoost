// Self-check: free times on the website, the last place cannot be taken twice, bookings confirm themselves and the
// customer gets an email when the business chose email. node scripts/test-slots.mjs
import assert from 'node:assert/strict';
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_PUBLISHABLE_KEY: 'pk', SUPABASE_SECRET_KEY: 'sk', RESEND_API_KEY: 're_test' });
const owner = '11111111-2222-3333-4444-555555555555';
const hours = Array.from({ length: 7 }, () => ({ closed: false, r: [['18:00', '22:00']] }));
let notify = 'email';
const doc = () => ({ lang: 'ro', biz: { name: 'Cafeneaua Aurora', phone: '0740111222', hours }, sections: [{ type: 'booking', id: 'b' }], booking: { capacity: 10, per: 'people', slot: 30, notify, askParty: true } });
const rows = [{ time: '19:00', party: 6, status: 'confirmed' }, { time: '19:00', party: 2, status: 'new' }, { time: '20:00', party: 4, status: 'declined' }];
const inserted = []; const mails = [];
const j = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url); const m = init.method || 'GET';
  if (u.hostname === 'api.resend.com') { if (u.pathname.endsWith('/batch')) mails.push(...JSON.parse(init.body)); return j(200, {}); } // /emails = the owner's own alert
  if (u.pathname === '/rest/v1/sites') return j(200, [{ owner, slug: 'aurora', doc: doc(), profiles: { plan: 'pro', role: 'client', email: 'o@x.ro', disabled: false } }]);
  if (u.pathname === '/rest/v1/site_requests' && m === 'GET') { const st = u.searchParams.get('status'); return j(200, rows.filter((r) => !st || st.slice(4, -1).split(',').includes(r.status))); }
  if (u.pathname === '/rest/v1/site_requests' && m === 'POST') { inserted.push(JSON.parse(init.body)); return j(201, []); }
  if (u.pathname.startsWith('/rest/v1/site_stats') || u.pathname.startsWith('/rest/v1/rpc')) return j(200, []);
  if (u.pathname === '/rest/v1/push_subs') return j(200, []);
  return j(200, []);
};
const { handleSite } = await import('../lib/site-core.mjs');
let n = 0; const call = (method, q) => handleSite({ method, query: method === 'GET' ? q : {}, body: method === 'POST' ? q : {}, headers: {}, origin: 'https://arcton.site', ip: `10.0.0.${++n}` });

const s = await call('GET', { op: 'slots', slug: 'aurora', date: '2026-12-05' });
assert.equal(s.status, 200); assert.deepEqual(s.body.used, { '19:00': 8 }, 'declined bookings free their places; only counts, no names');
assert.ok(!JSON.stringify(s.body).includes('party'), 'no customer details leave');
const book = (o) => call('POST', { op: 'request', slug: 'aurora', name: 'Ana Pop', contact: 'ana@exemplu.ro', date: '2026-12-05', consent: true, ...o });
let r = await book({ time: '19:00', party: 3 });
assert.equal(r.status, 409, '8 + 3 > 10: the time is full'); assert.equal(r.body.error, 'slot_full'); assert.equal(inserted.length, 0);
r = await book({ time: '19:00', party: 2 });
assert.equal(r.status, 200); assert.equal(r.body.status, 'confirmed'); assert.equal(inserted[0].status, 'confirmed', 'confirms itself when there is room');
assert.equal(r.body.mailed, true); assert.deepEqual(mails[0].to, ['ana@exemplu.ro']); assert.match(mails[0].subject, /Rezervare confirmată: Cafeneaua Aurora/); assert.match(mails[0].text, /19:00/);
r = await book({ time: '20:00', party: 2, contact: '0740 111 222' });
assert.equal(r.status, 200); assert.equal(r.body.mailed, false, 'a phone number gets no email'); assert.equal(mails.length, 1);
notify = 'whatsapp'; r = await book({ time: '20:30', party: 2 });
assert.equal(r.body.mailed, false, 'the business answers on WhatsApp itself'); assert.equal(mails.length, 1);
console.log('slots ok');
