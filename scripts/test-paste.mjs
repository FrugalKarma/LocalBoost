// Self-check for reviews pasted from Google Maps. node scripts/test-paste.mjs
import assert from 'node:assert/strict';
import { parseReviews } from '../js/paste.js';
const ro = `Maria Popescu
Ghid local · 23 de recenzii · 105 fotografii
5 stele
acum o lună
Cafea foarte bună, dar coada dimineața e prea lungă.
Îmi place
Distribuie
Ion Ionescu
3 recenzii
acum 2 săptămâni
Nou
Personal amabil, dar programul de pe Google
nu e corect duminica. Mai mult
Răspuns de la proprietar acum 2 săptămâni
Mulțumim, Ion! Am corectat programul.
Elena D.
1 recenzie
2 stele
acum 3 luni
Prea puține locuri la prânz.`;
const r = parseReviews(ro);
assert.equal(r.maps, true);
assert.deepEqual(r.items, [
  { text: 'Cafea foarte bună, dar coada dimineața e prea lungă.', rating: 5 },
  { text: 'Personal amabil, dar programul de pe Google nu e corect duminica.' },
  { text: 'Prea puține locuri la prânz.', rating: 2 },
]);
const en = `John Smith\nLocal Guide · 45 reviews\na week ago\nGreat flat white, hard to find a table at 3 pm.\nLike\nShare\nAnna K.\n2 reviews\n3 months ago\nClosed on Sunday although Google said open.\nResponse from the owner a month ago\nSorry Anna, fixed!`;
assert.deepEqual(parseReviews(en).items.map((x) => x.text), ['Great flat white, hard to find a table at 3 pm.', 'Closed on Sunday although Google said open.']);
// plain notes keep the old behaviour: one per line
assert.deepEqual(parseReviews('Clientul a întrebat de parcare\nVor terasă vara').items.map((x) => x.text), ['Clientul a întrebat de parcare', 'Vor terasă vara']);
console.log('paste ok');
