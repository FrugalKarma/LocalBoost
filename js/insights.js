// Everything the screens show is derived here from real data: the Google listing, the website check,
// what the owner pasted, nearby competitors and the visits/requests of the published Arcton Ai site.
import { getState } from './store.js';
import { t } from './i18n.js';
import { getBiz } from './business.js';
import { mySite, serverCaps } from './sources.js';
import { authOn, signedIn } from './auth.js';

export const MISSION_HOURS = 48;
const DAY = 864e5;

/* ---------- signals ---------- */
// Website checks that matter to a customer, in order of importance.
export const SITE_KEYS = ['reachable', 'booking', 'phone', 'hours', 'mobile', 'map', 'description', 'https', 'title', 'structured', 'whatsapp', 'social', 'fast'];
export function siteGaps() {
  const site = getState().signals?.site;
  if (!site) return [];
  if (site.error || !site.checks?.reachable) return ['reachable'];
  return SITE_KEYS.filter((k) => site.checks[k] === false);
}

/** One list for the Signals screen: Google reviews, pasted items and website findings. */
export function signalList() {
  const s = getState().signals || {}; const b = getBiz();
  const out = [];
  (s.google?.reviews || []).forEach((v, i) => out.push({ id: `g${i}`, type: 'review', source: 'Google', text: v.text, rating: v.rating, author: v.author, when: v.when }));
  (s.notes || []).forEach((n) => out.push({ id: n.id, type: n.kind, source: n.source || t(`signals.kind.${n.kind}`), text: n.text, user: true, at: n.at }));
  if (s.collectedAt) {
    if (!b.website) out.push({ id: 'w-none', type: 'website', source: t('signals.siteCheck'), text: t('signals.noWebsite') });
    else if (s.site) siteGaps().slice(0, 6).forEach((k) => out.push({ id: `w-${k}`, type: 'website', source: t('signals.siteCheck'), text: t(`check.${k}.bad`) }));
  }
  return out;
}

/** Plain-text evidence for the AI and for the chat. */
export function evidenceForAi() {
  const s = getState().signals || {};
  return {
    google: s.google ? { rating: s.google.rating, reviewCount: s.google.reviewCount, reviews: (s.google.reviews || []).map((v) => ({ rating: v.rating, text: v.text, when: v.when })) } : null,
    ownerNotes: (s.notes || []).slice(0, 60).map((n) => ({ kind: n.kind, source: n.source, text: n.text })),
    website: s.site ? { url: s.site.url, score: s.site.score, error: s.site.error || null, checks: s.site.checks } : (getBiz().website ? null : 'no website'),
    themes: s.themes?.items || null,
  };
}

/* ---------- competitors ---------- */
export function competitorList() {
  const c = getState().competitors || {};
  return [...(c.list || []), ...(c.custom || []).map((x) => ({ ...x, custom: true }))];
}
export function competitorSummary() {
  const list = competitorList().filter((c) => c.rating != null);
  if (!list.length) return null;
  const avg = (k) => list.reduce((a, c) => a + (Number(c[k]) || 0), 0) / list.length;
  return { n: list.length, rating: avg('rating'), reviews: avg('reviewCount'), withSite: list.filter((c) => c.website).length };
}

/* ---------- the published site: visits, clicks, requests ---------- */
let siteData = null; let siteLoading = null; const siteListeners = new Set();
export const onSiteData = (fn) => siteListeners.add(fn);
export const getSiteData = () => siteData;
/** Loads the hosted site's stats and booking requests (kept in memory only: they contain customers' details). */
export async function loadSiteData(force = false) {
  if (!authOn() || !signedIn()) { siteData = { available: false }; return siteData; }
  if (siteData && !force) return siteData;
  siteLoading ||= (async () => {
    const caps = await serverCaps();
    if (!caps.sites) { siteData = { available: false }; return siteData; }
    const r = await mySite();
    siteData = r.ok ? { available: true, ...r.data, fetchedAt: Date.now() } : { available: false, error: r.error };
    siteListeners.forEach((fn) => fn(siteData));
    return siteData;
  })().finally(() => { siteLoading = null; });
  return siteLoading;
}
export function clearSiteData() { siteData = null; }

function sumSince(stats, sinceMs) {
  const since = new Date(sinceMs).toISOString().slice(0, 10);
  return (stats || []).filter((d) => d.day >= since).reduce((a, d) => ({ views: a.views + d.views, clicks: a.clicks + d.clicks, requests: a.requests + d.requests }), { views: 0, clicks: 0, requests: 0 });
}
/** Daily series for the last n days (zeros where nothing happened). */
export function dailySeries(n = 30) {
  const map = new Map((siteData?.stats || []).map((d) => [d.day, d]));
  return Array.from({ length: n }, (_, i) => { const day = new Date(Date.now() - (n - 1 - i) * DAY).toISOString().slice(0, 10); const d = map.get(day); return { day, views: d?.views || 0, clicks: d?.clicks || 0, requests: d?.requests || 0 }; });
}

/** The numbers Arcton Ai can measure right now. null = not measurable yet (no Google link / site not published). */
export function liveMetrics(sinceMs = Date.now() - 7 * DAY) {
  const b = getBiz(); const g = getState().signals?.google;
  const published = !!(siteData?.available && siteData.site?.published);
  const w = published ? sumSince(siteData.stats, sinceMs) : null;
  return {
    rating: g?.rating ?? b.place?.rating ?? null,
    reviewCount: g?.reviewCount ?? b.place?.reviewCount ?? null,
    views: w ? w.views : null, clicks: w ? w.clicks : null, requests: w ? w.requests : null,
    published,
  };
}

/* ---------- rule-based diagnosis (used when the AI is not set up) ---------- */
// Each rule looks at real data and, if it applies, returns a problem with evidence built from the numbers.
export function ruleProblems() {
  const s = getState(); const b = getBiz(); const g = s.signals?.google; const comp = competitorSummary();
  const gaps = siteGaps(); const out = [];
  const add = (key, weight, vars = {}, kind = 'fact') => out.push({ key, weight, vars, kind });
  if (!b.website) add('noWebsite', 90, { n: comp?.withSite ?? '?', total: comp?.n ?? '?' });
  else if (gaps.includes('reachable')) add('siteDown', 95, { url: b.website });
  else {
    if (gaps.includes('booking')) add('noBooking', b.goal === 'bookings' ? 88 : 70);
    if (gaps.includes('phone')) add('noPhone', 62);
    if (gaps.includes('hours')) add('noHours', 66);
    if (gaps.includes('mobile')) add('notMobile', 74);
  }
  if (!b.place?.id) add('noGoogle', 80);
  const rating = g?.rating ?? b.place?.rating; const count = g?.reviewCount ?? b.place?.reviewCount;
  if (rating != null && comp && rating < comp.rating - 0.15) add('lowRating', 72, { you: rating.toFixed(1), avg: comp.rating.toFixed(1) });
  if (count != null && comp && count < comp.reviews * 0.6) add('fewReviews', 68, { you: count, avg: Math.round(comp.reviews) });
  const bad = (g?.reviews || []).filter((v) => v.rating && v.rating <= 3);
  if (bad.length) add('badReviews', 64 + bad.length * 4, { n: bad.length, quote: bad[0].text.slice(0, 120) });
  (s.signals?.themes?.items || []).filter((x) => x.tone === 'gap').slice(0, 2).forEach((x, i) => add('theme', 60 - i * 5, { label: x.label, n: x.mentions, quote: (x.quotes || [])[0] || '' }, 'inference'));
  return out.sort((a, b2) => b2.weight - a.weight);
}
/** Which kind of fix the top problem calls for: the website, reviews, or the Google listing. */
export const OPP_OF = { noWebsite: 'site', siteDown: 'site', noBooking: 'site', noPhone: 'site', noHours: 'site', notMobile: 'site', noGoogle: 'google', lowRating: 'reviews', fewReviews: 'reviews', badReviews: 'reviews', theme: 'theme' };

export { DAY };
