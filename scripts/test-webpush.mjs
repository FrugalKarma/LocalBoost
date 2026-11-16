// Checks lib/webpush.mjs against the receiving side of RFC 8291 and the VAPID signature. node scripts/test-webpush.mjs
import assert from 'node:assert/strict';
import { createECDH, createHmac, createDecipheriv, createPublicKey, randomBytes, verify } from 'node:crypto';
import { encrypt, vapidAuth, newVapidKeys } from '../lib/webpush.mjs';

const hmac = (k, d) => createHmac('sha256', k).update(d).digest();
// a "phone": its own key pair and auth secret, as PushManager.subscribe() would make
const ua = createECDH('prime256v1'); ua.generateKeys(); const auth = randomBytes(16);
const sub = { endpoint: 'https://push.example.com/send/abc', keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } };
const msg = JSON.stringify({ title: 'Mesaj nou pe arcton.site', body: 'Ana: Bună, vreau o ofertă pentru salon ✂️' });

const buf = encrypt(sub, msg);
const salt = buf.subarray(0, 16); const rs = buf.readUInt32BE(16); const idlen = buf[20]; const asPub = buf.subarray(21, 21 + idlen); const ct = buf.subarray(21 + idlen);
assert.equal(rs, 4096); assert.equal(idlen, 65);
const shared = ua.computeSecret(asPub);
const ikm = hmac(hmac(auth, shared), Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPub, Buffer.from([1])]));
const prk = hmac(salt, ikm);
const d = createDecipheriv('aes-128-gcm', hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16), hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12));
d.setAuthTag(ct.subarray(-16));
const plain = Buffer.concat([d.update(ct.subarray(0, -16)), d.final()]);
assert.equal(plain.at(-1), 2, 'last-record delimiter');
assert.equal(plain.subarray(0, -1).toString(), msg, 'decrypts to the same message');
assert.notDeepEqual(encrypt(sub, msg).subarray(0, 16), salt, 'new salt every message');

// RFC 8291 section 5 example: same keys and salt must give the same bytes as the standard
const rfc = encrypt({ keys: { p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg' } },
  'When I grow up, I want to be a watermelon', { salt: 'DGv6ra1nlYgDCS1FRnbzlw', asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw' });
assert.equal(rfc.toString('base64url'), 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN', 'RFC 8291 test vector');

// VAPID: the token verifies with the public key and names the push service origin
const k = newVapidKeys(); const h = vapidAuth(sub.endpoint, k.publicKey, k.privateKey, 'mailto:test@example.com');
const [, jwt, key] = h.match(/^vapid t=([^,]+), k=(.+)$/); assert.equal(key, k.publicKey);
const [head, claims, sig] = jwt.split('.');
const P = Buffer.from(k.publicKey, 'base64url');
const pub = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: P.subarray(1, 33).toString('base64url'), y: P.subarray(33).toString('base64url') }, format: 'jwk' });
assert.ok(verify('sha256', Buffer.from(`${head}.${claims}`), { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url')), 'signature verifies');
const c = JSON.parse(Buffer.from(claims, 'base64url'));
assert.equal(c.aud, 'https://push.example.com'); assert.ok(c.exp > Date.now() / 1000 && c.exp <= Date.now() / 1000 + 86400);
console.log('webpush ok');
