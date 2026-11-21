// Self-check for the weekly digest: node scripts/test-digest.mjs
import assert from 'node:assert/strict';
process.env.CRON_SECRET = 'test-secret-0123456789';
const { composeDigest, unsubToken, handleDigest } = await import('../lib/digest-core.mjs');

assert.equal(composeDigest({ id: 'u1', email: 'a@b.c', data: { business: {} }, stats: { views: 0, requests: 0 }, origin: 'https://x' }), null, 'no business, no email');
const m = composeDigest({ id: 'u1', email: 'a@b.c', origin: 'https://x', stats: { views: 41, requests: 3 },
  data: { business: { name: 'Café <Aurora>' }, signals: { google: { rating: 4.6, reviewCount: 218 } }, diagnosis: { data: { opportunity: { title: 'Rezervări online sâmbăta' } } } } });
assert.deepEqual(m.to, ['a@b.c']);
assert.match(m.text, /Cereri de rezervare: 3/); assert.match(m.text, /Vizite pe site: 41/); assert.match(m.text, /4,6 · 218 recenzii/); assert.match(m.text, /Rezervări online sâmbăta/);
// week over week, what got better, what the owner and the team did
const w = composeDigest({ id: 'u1', email: 'a@b.c', origin: 'https://x', last: { rating: 4.4, reviews: 210 }, note: 'Am pus pozele noi pe site.',
  stats: { views: 50, clicks: 4, requests: 2, confirmed: 2, prev: { views: 30, clicks: 6, requests: 2 } },
  data: { business: { name: 'Aurora' }, signals: { google: { rating: 4.6, reviewCount: 218 } }, repliesDone: { a: Date.now(), b: Date.now() - 30 * 864e5 } } });
assert.match(w.text, /Vizite pe site: 50 ▲ 20/); assert.match(w.text, /Clicuri pe telefon și hartă: 4 ▼ 2/); assert.match(w.text, /Cereri de rezervare: 2 =/);
assert.match(w.text, /\+20 vizite pe site/); assert.match(w.text, /a urcat de la 4,4 la 4,6/); assert.match(w.text, /\+8 recenzii noi/); assert.doesNotMatch(w.text, /\+\d+ clicuri/);
assert.match(w.text, /Ai răspuns la 1 recenzie/, 'only replies marked this week'); assert.match(w.text, /Ai confirmat 2 rezervări/);
assert.match(w.text, /Ce a făcut echipa Arcton pentru tine:\nAm pus pozele noi pe site\./); assert.ok(w.html.includes('Am pus pozele noi pe site.'));
const quiet = composeDigest({ id: 'u1', email: 'a@b.c', origin: 'https://x', stats: { views: 0, requests: 0 }, data: { business: { name: 'Aurora' } } });
assert.match(quiet.text, /cifrele au stat pe loc/); assert.match(quiet.text, /Nimic bifat/); assert.doesNotMatch(quiet.text, /echipa Arcton/);
assert.ok(m.html.includes('Café &lt;Aurora&gt;') && !m.html.includes('<Aurora>'), 'business name is escaped');
assert.ok(m.headers['List-Unsubscribe'].includes(unsubToken('u1')), 'one-click unsubscribe header');
assert.match(m.text, /Arcton Ai Consulting SRL/, 'sender identity in every email');
assert.notEqual(unsubToken('u1'), unsubToken('u2'));
const r = await handleDigest({ method: 'GET', query: {}, headers: { authorization: 'Bearer wrong' }, origin: 'https://x' });
assert.ok([401, 503].includes(r.status), 'cron needs the secret');
console.log('digest ok');
