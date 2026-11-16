// Web Push without libraries: VAPID (RFC 8292) + aes128gcm payload encryption (RFC 8291), Node's crypto only.
// The message is encrypted for the phone, so the push service (Google, Apple, Mozilla) carries it but cannot read it.
// Keys: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (base64url, made by `node scripts/vapid-keys.mjs`), VAPID_SUBJECT (mailto: or https:).
import { createECDH, createHmac, createCipheriv, createPrivateKey, randomBytes, sign } from 'node:crypto';

const env = (k) => (process.env[k] || '').trim();
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const unb64u = (s) => Buffer.from(String(s || ''), 'base64url');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();

export const pushOn = () => unb64u(env('VAPID_PUBLIC_KEY')).length === 65 && unb64u(env('VAPID_PRIVATE_KEY')).length === 32;
export const pushPublicKey = () => (pushOn() ? env('VAPID_PUBLIC_KEY') : '');

/** VAPID header for one push service origin. */
export function vapidAuth(endpoint, pub = env('VAPID_PUBLIC_KEY'), priv = env('VAPID_PRIVATE_KEY'), subject = env('VAPID_SUBJECT') || 'mailto:support@arcton.site') {
  const P = unb64u(pub);
  const key = createPrivateKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(P.subarray(1, 33)), y: b64u(P.subarray(33, 65)), d: priv }, format: 'jwk' });
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
  const sig = sign('sha256', Buffer.from(`${head}.${claims}`), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${pub}`;
}

/** Encrypts `payload` for one subscription ({ endpoint, keys: { p256dh, auth } }). Returns the request body. */
export function encrypt(sub, payload, fixed) { // `fixed` ({ salt, asPrivate }) only for the RFC 8291 test vector
  const ua = unb64u(sub.keys.p256dh); const authSecret = unb64u(sub.keys.auth);
  if (ua.length !== 65 || authSecret.length !== 16) throw new Error('bad subscription keys');
  const salt = fixed ? unb64u(fixed.salt) : randomBytes(16); const as = createECDH('prime256v1'); // a new key and salt for every message
  if (fixed) as.setPrivateKey(unb64u(fixed.asPrivate)); else as.generateKeys();
  const asPub = as.getPublicKey();
  const shared = as.computeSecret(ua);
  const ikm = hmac(hmac(authSecret, shared), Buffer.concat([Buffer.from('WebPush: info\0'), ua, asPub, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
  const c = createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, body]);
}

/** Sends one notification. → { ok, gone } (gone: the phone unsubscribed; delete the subscription). */
export async function sendPush(sub, data) {
  if (!pushOn()) return { ok: false, gone: false };
  let r;
  try {
    r = await fetch(sub.endpoint, { method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { authorization: vapidAuth(sub.endpoint), 'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: '86400', urgency: 'high' },
      body: encrypt(sub, JSON.stringify(data)) });
  } catch { return { ok: false, gone: false }; }
  return { ok: r.status >= 200 && r.status < 300, gone: r.status === 404 || r.status === 410, status: r.status };
}

/** A new key pair, base64url. Run `node scripts/vapid-keys.mjs` on your own computer and put the result in Vercel. */
export function newVapidKeys() {
  const e = createECDH('prime256v1'); e.generateKeys();
  return { publicKey: b64u(e.getPublicKey()), privateKey: b64u(e.getPrivateKey()) };
}
