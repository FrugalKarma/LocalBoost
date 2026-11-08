// Self-check for the weekly digest: node scripts/test-digest.mjs
import assert from 'node:assert/strict';
process.env.CRON_SECRET = 'test-secret-0123456789';
const { composeDigest, unsubToken, handleDigest } = await import('../lib/digest-core.mjs');

assert.equal(composeDigest({ id: 'u1', email: 'a@b.c', data: { business: {} }, stats: { views: 0, requests: 0 }, origin: 'https://x' }), null, 'no business, no email');
const m = composeDigest({ id: 'u1', email: 'a@b.c', origin: 'https://x', stats: { views: 41, requests: 3 },
  data: { business: { name: 'Café <Aurora>' }, signals: { google: { rating: 4.6, reviewCount: 218 } }, diagnosis: { data: { opportunity: { title: 'Rezervări online sâmbăta' } } } } });
assert.deepEqual(m.to, ['a@b.c']);
assert.match(m.text, /Cereri de rezervare: 3/); assert.match(m.text, /Vizite pe site: 41/); assert.match(m.text, /4\.6 · 218 recenzii/); assert.match(m.text, /Rezervări online sâmbăta/);
assert.ok(m.html.includes('Café &lt;Aurora&gt;') && !m.html.includes('<Aurora>'), 'business name is escaped');
assert.ok(m.headers['List-Unsubscribe'].includes(unsubToken('u1')), 'one-click unsubscribe header');
assert.match(m.text, /Arcton Ai Consulting SRL/, 'sender identity in every email');
assert.notEqual(unsubToken('u1'), unsubToken('u2'));
const r = await handleDigest({ method: 'GET', query: {}, headers: { authorization: 'Bearer wrong' }, origin: 'https://x' });
assert.ok([401, 503].includes(r.status), 'cron needs the secret');
console.log('digest ok');
