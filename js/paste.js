// Reviews pasted from Google Maps: the copied text mixes reviewer names, "Local Guide · 12 reviews", dates,
// "Like / Share" and the owner's replies with the reviews themselves. This keeps only the reviews (and the
// star rating when the copy has one). Text that does not look like a Maps copy is split by line, as before.
const ACTIONS = /^(like|share|helpful|more|less|new|edited|report review|translated by google|see original|see translation|îmi place|imi place|distribuie|apreciază|apreciaza|util|mai mult|mai puțin|mai putin|nou|editat|raportează recenzia|tradus de google|vezi originalul|vezi traducerea|afișează originalul|j'aime|partager|plus|nouveau|gefällt mir|teilen|mehr|neu|tetszik|megosztás|tovább|új)$/i;
const META = /(local guide|ghid local|guide local|lokaler guide|helyi idegenvezető)|^\d[\d.,]*\s*(reviews?|recenzii|de recenzii|recenzie|photos?|fotografii|de fotografii|avis|photos|rezensionen|fotos|vélemény|fotó)\b/i;
const DATE = /^(\d+|a|an|one|o|un|una|o\s+singură)?\s*(minute?s?|hours?|days?|weeks?|months?|years?|minut|minute|oră|ore|zi|zile|săptămână|săptămâni|saptamana|saptamani|lună|luni|luna|an|ani)\s+ago$|^acum\s+(o|un|\d+|câteva|cateva)?\s*\S+$|^(il y a|vor)\s+.+$|^(\d+|egy)\s+\S+\s+(ezelőtt|óta)$|^(yesterday|ieri|today|azi|astăzi)$/i;
const OWNER = /^(response from the owner|răspuns de la proprietar|raspuns de la proprietar|réponse du propriétaire|antwort vom inhaber|a tulajdonos válasza)/i;
const STARS = /^(?:([1-5])(?:[.,]0)?\s*(?:\/\s*5|stars?|stele|stea|étoiles?|sterne?|csillag)|(★{1,5})(☆{0,4}))\s*$/i;
const short = (l) => l.length <= 60;

/** Returns [{ text, rating? }] and whether the text looked like a Google Maps copy. */
export function parseReviews(input) {
  const lines = String(input || '').replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const kind = (l) => (OWNER.test(l) ? 'owner' : STARS.test(l) ? 'stars' : short(l) && META.test(l) ? 'meta' : short(l) && DATE.test(l) ? 'date' : ACTIONS.test(l) ? 'action' : 'text');
  const kinds = lines.map(kind);
  const marks = kinds.filter((k) => k === 'meta' || k === 'date' || k === 'owner').length;
  if (marks < 2) return { maps: false, items: lines.map((l) => ({ text: l })).filter((x) => x.text.length >= 4) };
  // a reviewer's name is the short line right before their meta / date / stars line
  const isName = (i) => kinds[i] === 'text' && short(lines[i]) && ['meta', 'date', 'stars'].includes(kinds[i + 1]);
  const items = []; let cur = null; let skipping = false;
  const close = () => { if (cur?.text.length >= 4) items.push(cur); cur = null; };
  lines.forEach((l, i) => {
    if (isName(i)) { close(); skipping = false; cur = { text: '' }; return; }
    const k = kinds[i];
    if (k === 'owner') { skipping = true; return; }
    if (skipping) return;
    if (k === 'stars') { const m = l.match(STARS); (cur ||= { text: '' }).rating = Number(m[1]) || m[2].length; return; }
    if (k !== 'text') return;
    const t = l.replace(/(\s*…)?\s*(more|mai mult|plus|mehr|tovább)$/i, '').trim();
    cur ||= { text: '' }; cur.text = cur.text ? `${cur.text} ${t}` : t;
  });
  close();
  return { maps: true, items };
}
