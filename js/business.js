// Business profile: what the owner tells Arcton Ai, plus the Google listing they linked (business.place).
import { getState, update } from './store.js';
import { limit } from './core.js';
import { t } from './i18n.js';

export const CATEGORIES = ['cafe', 'restaurant', 'salon', 'shop', 'other'];
export const GOALS = ['bookings', 'followers', 'traffic'];

export const emptyDraft = () => ({
  name: '', category: 'cafe', city: '', goal: 'bookings', website: '', instagram: '', tiktok: '', facebook: '',
  phone: '', email: '', whatsapp: '', address: '', place: null,
  noName: false, noWebsite: false, noInstagram: false, noTiktok: false, noFacebook: false,
});

export const cleanHandle = (v) => limit(String(v || '').replace(/^@+/, '').replace(/[^A-Za-z0-9._]/g, ''), 30);
export function cleanWebsite(v) {
  const s = limit(String(v || '').trim(), 160); if (!s) return '';
  try { const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); return /\./.test(u.hostname) ? u.hostname + (u.pathname === '/' ? '' : u.pathname) : ''; } catch { return ''; }
}
export const cleanPhone = (v) => limit(String(v || '').replace(/[^\d+()\s.-]/g, '').trim(), 30);
export const cleanEmail = (v) => { const s = limit(String(v || '').trim(), 120); return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? s : ''; };
/** WhatsApp wants the number with country code, digits only. A Romanian 07… number becomes 407…. */
export function waNumber(v) {
  let d = String(v || '').replace(/[^\d]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (/^07\d{8}$/.test(d)) d = `4${d}`;
  return d.length >= 9 && d.length <= 15 ? d : '';
}

/** The business as the owner entered it (nothing is filled in from samples). */
export function getBiz() {
  const b = getState().business || {};
  return {
    name: b.name || '', city: b.city || '', category: b.category || 'cafe', goal: b.goal || 'bookings',
    website: b.website || '', instagram: b.instagram || '', tiktok: b.tiktok || '', facebook: b.facebook || '',
    phone: b.phone || '', email: b.email || '', whatsapp: b.whatsapp || '', address: b.address || '',
    place: b.place || null, reviewLink: b.reviewLink || '',
    noName: !!b.noName, noWebsite: !!b.noWebsite, noInstagram: !!b.noInstagram, noTiktok: !!b.noTiktok, noFacebook: !!b.noFacebook,
  };
}
export const displayName = () => getBiz().name || t('biz.unnamed');

export function validate(d) {
  if (!d.city.trim() || (!d.name.trim() && !d.noName)) return 'biz.required';
  const ok = (val, none, clean) => (clean(val) ? true : none);
  if (!ok(d.website, d.noWebsite, cleanWebsite) || !ok(d.instagram, d.noInstagram, cleanHandle) || !ok(d.tiktok, d.noTiktok, cleanHandle) || !ok(d.facebook, d.noFacebook, cleanHandle)) return 'biz.missingChoice';
  if (d.email.trim() && !cleanEmail(d.email)) return 'biz.badEmail';
  return null;
}

export function saveBiz(d) {
  const prev = getState().business || {};
  const placeChanged = (prev.place?.id || null) !== (d.place?.id || null);
  update({ business: {
    loaded: true, name: limit(d.name.trim(), 80), category: d.category, city: limit(d.city.trim(), 80), goal: d.goal,
    website: d.noWebsite ? '' : cleanWebsite(d.website), instagram: d.noInstagram ? '' : cleanHandle(d.instagram), tiktok: d.noTiktok ? '' : cleanHandle(d.tiktok), facebook: d.noFacebook ? '' : cleanHandle(d.facebook),
    phone: cleanPhone(d.phone), email: cleanEmail(d.email), whatsapp: cleanPhone(d.whatsapp), address: limit(String(d.address || '').trim(), 200),
    place: d.place || null, reviewLink: prev.reviewLink || '',
    noName: d.noName && !d.name.trim(), noWebsite: d.noWebsite && !cleanWebsite(d.website), noInstagram: d.noInstagram && !cleanHandle(d.instagram), noTiktok: d.noTiktok && !cleanHandle(d.tiktok), noFacebook: d.noFacebook && !cleanHandle(d.facebook),
  }, names: null, ...(placeChanged ? { competitors: { list: [], custom: getState().competitors?.custom || [], fetchedAt: null } } : {}) });
}

/** Missing accounts/name: the mission adds a Name Scout step for these. */
export function missingItems() {
  const b = getBiz();
  return { name: b.noName && !b.name, instagram: b.noInstagram && !b.instagram, tiktok: b.noTiktok && !b.tiktok, facebook: b.noFacebook && !b.facebook };
}
export const needsNames = () => { const m = missingItems(); return m.name || m.instagram || m.tiktok || m.facebook; };
