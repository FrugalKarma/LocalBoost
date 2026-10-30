// Business profile: what the owner has to tell LocalBoost, with "I don't have one" escape hatches.
import { getState, update } from './store.js';
import { BUSINESS, SOCIAL_SIGNALS } from './data.js';
import { limit } from './core.js';
import { t } from './i18n.js';

export const CATEGORIES = ['cafe', 'restaurant', 'salon', 'shop', 'other'];
export const GOALS = ['bookings', 'followers', 'traffic'];

export const EXAMPLE = {
  name: BUSINESS.name, category: 'cafe', city: BUSINESS.city, goal: 'bookings',
  website: '', instagram: 'cafeneauacopou', tiktok: '', facebook: 'cafeneauacopou', noName: false, noWebsite: true, noInstagram: false, noTiktok: true, noFacebook: false,
};

export const emptyDraft = () => ({
  name: '', category: 'cafe', city: '', goal: 'bookings', website: '', instagram: '', tiktok: '', facebook: '',
  noName: false, noWebsite: false, noInstagram: false, noTiktok: false, noFacebook: false,
});

export const cleanHandle = (v) => limit(String(v || '').replace(/^@+/, '').replace(/[^A-Za-z0-9._]/g, ''), 30);
export function cleanWebsite(v) {
  const s = limit(String(v || '').trim(), 120); if (!s) return '';
  try { const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); return /\./.test(u.hostname) ? u.hostname + (u.pathname === '/' ? '' : u.pathname) : ''; } catch { return ''; }
}

/** Effective business info used across the app (own details win, the sample fills the rest). */
export function getBiz() {
  const b = getState().business;
  return {
    name: b.name || (b.noName ? '' : BUSINESS.name), city: b.city || BUSINESS.city, category: b.category || 'cafe', goal: b.goal || 'bookings',
    website: b.website || '', instagram: b.instagram || '', tiktok: b.tiktok || '', facebook: b.facebook || '',
    noName: !!b.noName, noWebsite: !!b.noWebsite, noInstagram: !!b.noInstagram, noTiktok: !!b.noTiktok, noFacebook: !!b.noFacebook,
  };
}
/** Sample social comments for the accounts the owner added, and the networks that were skipped. */
export function socialSignals() {
  const b = getBiz();
  return { used: SOCIAL_SIGNALS.filter((s) => b[s.net]), skipped: SOCIAL_SIGNALS.filter((s) => !b[s.net]).map((s) => s.net) };
}
export const displayName = () => getBiz().name || t('biz.unnamed');

export function validate(d) {
  if (!d.city.trim() || (!d.name.trim() && !d.noName)) return 'biz.required';
  const ok = (val, none, clean) => (clean(val) ? true : none);
  if (!ok(d.website, d.noWebsite, cleanWebsite) || !ok(d.instagram, d.noInstagram, cleanHandle) || !ok(d.tiktok, d.noTiktok, cleanHandle) || !ok(d.facebook, d.noFacebook, cleanHandle)) return 'biz.missingChoice';
  return null;
}

export function saveBiz(d) {
  update({ business: {
    loaded: true, name: limit(d.name.trim(), 60), category: d.category, city: limit(d.city.trim(), 60), goal: d.goal,
    website: d.noWebsite ? '' : cleanWebsite(d.website), instagram: d.noInstagram ? '' : cleanHandle(d.instagram), tiktok: d.noTiktok ? '' : cleanHandle(d.tiktok), facebook: d.noFacebook ? '' : cleanHandle(d.facebook),
    noName: d.noName && !d.name.trim(), noWebsite: d.noWebsite && !cleanWebsite(d.website), noInstagram: d.noInstagram && !cleanHandle(d.instagram), noTiktok: d.noTiktok && !cleanHandle(d.tiktok), noFacebook: d.noFacebook && !cleanHandle(d.facebook),
  }, names: null });
}

/** Missing accounts/name: the mission adds a Name Scout step for these. */
export function missingItems() {
  const b = getBiz();
  return { name: b.noName && !b.name, instagram: b.noInstagram && !b.instagram, tiktok: b.noTiktok && !b.tiktok, facebook: b.noFacebook && !b.facebook };
}
export const needsNames = () => { const m = missingItems(); return m.name || m.instagram || m.tiktok || m.facebook; };
