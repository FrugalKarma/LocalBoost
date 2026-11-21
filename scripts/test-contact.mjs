// Self-check: "Talk to us" stores the message and sends an encrypted notification to every subscribed phone;
// a phone that unsubscribed (410) is forgotten. node scripts/test-contact.mjs
import assert from 'node:assert/strict';
import { createECDH, createHmac, createDecipheriv, randomBytes } from 'node:crypto';
import { newVapidKeys } from '../lib/webpush.mjs';
const k = newVapidKeys();
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_PUBLISHABLE_KEY: 'pk', SUPABASE_SECRET_KEY: 'sk', ARCTON_MAINTENANCE: 'off', VAPID_PUBLIC_KEY: k.publicKey, VAPID_PRIVATE_KEY: k.privateKey });

// two "phones": one live, one that dropped its subscription
const phone = createECDH('prime256v1'); phone.generateKeys(); const auth = randomBytes(16);
const subs = [{ endpoint: 'https://push.test/live', p256dh: phone.getPublicKey().toString('base64url'), auth: auth.toString('base64url') },
  { endpoint: 'https://push.test/gone', p256dh: phone.getPublicKey().toString('base64url'), auth: auth.toString('base64url') }];
const leads = []; const pushed = []; const deleted = []; const subQueries = [];
const j = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url); const m = init.method || 'GET';
  if (u.pathname === '/rest/v1/leads' && m === 'POST') { leads.push(JSON.parse(init.body)); return j(201, []); }
  if (u.pathname === '/rest/v1/push_subs' && m === 'GET') { subQueries.push(u.searchParams.get('user_ref')); return j(200, subs); }
  if (u.pathname === '/rest/v1/push_subs' && m === 'DELETE') { deleted.push(u.searchParams.get('endpoint')); return j(204, null); }
  if (u.hostname === 'push.test') { pushed.push({ path: u.pathname, headers: init.headers, body: Buffer.from(init.body) }); return new Response(null, { status: u.pathname === '/gone' ? 410 : 201 }); }
  return j(404, {});
};
const { handleAccount } = await import('../lib/auth-core.mjs');
let ipN = 0; const send = (body) => handleAccount('auth', { method: 'POST', query: {}, body: { op: 'contact', ...body }, headers: {}, ip: `10.0.0.${++ipN}` });

let r = await send({ name: 'Ana Pop', reply: 'ana@test.ro', message: 'Bună,\nvreau o ofertă pentru salon.', consent: true, from: 'launch', lang: 'ro' });
assert.equal(r.status, 200);
assert.deepEqual(leads[0], { name: 'Ana Pop', reply: 'ana@test.ro', message: 'Bună,\nvreau o ofertă pentru salon.', source: 'launch', lang: 'ro' });
assert.equal(pushed.length, 2, 'one push per subscribed phone');
assert.equal(subQueries[0], 'not.like.owner:*', 'business owners\' booking phones never get admin messages');
assert.deepEqual(deleted, ['eq.https://push.test/gone'], 'the phone that unsubscribed is forgotten');
const p = pushed.find((x) => x.path === '/live');
assert.match(p.headers.authorization, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/); assert.equal(p.headers['content-encoding'], 'aes128gcm');
// the phone can read it, nobody else gets plain text
const buf = p.body; const salt = buf.subarray(0, 16); const asPub = buf.subarray(21, 86); const ct = buf.subarray(86);
const h = (a, b) => createHmac('sha256', a).update(b).digest();
const prk = h(salt, h(h(auth, phone.computeSecret(asPub)), Buffer.concat([Buffer.from('WebPush: info\0'), phone.getPublicKey(), asPub, Buffer.from([1])])));
const d = createDecipheriv('aes-128-gcm', h(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16), h(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12)); d.setAuthTag(ct.subarray(-16));
const msg = JSON.parse(Buffer.concat([d.update(ct.subarray(0, -16)), d.final()]).subarray(0, -1).toString());
assert.equal(msg.title, 'Mesaj nou: Ana Pop'); assert.match(msg.body, /ofertă pentru salon/); assert.equal(msg.url, '/#/admin?leads');
assert.ok(!buf.includes(Buffer.from('salon')), 'not readable by the push service');

// refused: missing consent, a contact we cannot answer, the honeypot (accepted silently, nothing stored)
assert.equal((await send({ name: 'X', reply: 'x@y.ro', message: 'salut', consent: false })).body.error, 'consent_required');
assert.equal((await send({ name: 'X', reply: 'abc', message: 'salut', consent: true })).body.error, 'invalid_reply');
assert.equal((await send({ name: 'X', reply: '0712 345 678', message: 'salut', consent: true })).status, 200, 'a phone number is fine');
const before = leads.length; assert.equal((await send({ name: 'Bot', reply: 'b@b.ro', message: 'spam', consent: true, website: 'http://x' })).status, 200); assert.equal(leads.length, before, 'honeypot: nothing stored');
// too many from one address
const many = []; for (let i = 0; i < 4; i++) many.push((await handleAccount('auth', { method: 'POST', query: {}, body: { op: 'contact', name: 'Y', reply: 'y@y.ro', message: 'hello', consent: true }, headers: {}, ip: '9.9.9.9' })).status);
assert.deepEqual(many, [200, 200, 200, 429]);
// a business owner's phones: only that owner's subscriptions are asked for
const { notifyUser } = await import('../lib/auth-core.mjs');
await notifyUser('11111111-2222-3333-4444-555555555555', { title: 'Rezervare nouă: Ana' });
assert.equal(subQueries.at(-1), 'eq.owner:11111111-2222-3333-4444-555555555555');
console.log('contact ok');
