// App-side website model: the owner's real details + the sections they edit -> one document
// for the live preview, the downloadable file and the hosted page (/s/<slug>).
import { getLang, tIn, ta } from './i18n.js';
import { getState, update } from './store.js';
import { getBiz, waNumber } from './business.js';
import { getAssets } from './ai.js';
import { normalizeDoc, buildDocument, PRESETS } from './siteTemplate.js';
import { slug as slugify } from './core.js';
import { apiUrl } from './api.js';
import { can } from './plans.js';

const fill = (s, v) => String(s || '').replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const pick = (arr, i = 0) => (arr.length ? arr[((i % arr.length) + arr.length) % arr.length] : '');
export const siteLang = (site = getState().site) => site.lang || getLang();
export const PARTY_CATEGORIES = ['cafe', 'restaurant'];
export const PRESET_FOR = { cafe: 'bordeaux', restaurant: 'bistro', salon: 'salon', shop: 'studio', other: 'minimal' };
/** Section types the owner can add more than once or remove; the rest are fixed building blocks. */
export const ADDABLE = ['about', 'services', 'menu', 'gallery', 'offer', 'faq', 'contact'];
export const SECTION_ICON = { hero: 'website', about: 'info', services: 'pack', menu: 'menu', gallery: 'image', offer: 'sparkle', reviews: 'star', visit: 'pin', faq: 'help', booking: 'calendar', contact: 'share' };
const uid = (type) => `${type}-${Math.random().toString(36).slice(2, 7)}`;

/** Opening hours for the site: what the owner set, else Google's structured hours. */
export function siteHours(s = getState()) {
  const b = s.business || {};
  return b.hours || b.place?.hoursStruct || null;
}

/** A new, empty section of this type with sensible starting content. */
export function newSection(type, lang = siteLang()) {
  const T = (k) => tIn(lang, k);
  const base = { id: uid(type), type, on: true, title: '' };
  if (type === 'services') return { ...base, items: [{ n: '', d: '', price: '' }] };
  if (type === 'menu') return { ...base, note: '', groups: [{ name: T('site.menuGroup'), items: [{ n: '', d: '', price: '' }] }] };
  if (type === 'gallery') return { ...base, images: [] };
  if (type === 'faq') return { ...base, items: [{ q: '', a: '' }] };
  if (type === 'offer') return { ...base, label: T('site.offerLabel'), text: '', until: '' };
  if (type === 'about') return { ...base, text: '', image: '', imageAlt: '' };
  if (type === 'contact') return { ...base, sub: '' };
  return base;
}

/** First draft of the site from the real details (and the AI copy when there is one). */
export function draftSections(copy = null, lang = siteLang()) {
  const b = getBiz(); const s = getState(); const T = (k) => tIn(lang, k); const A = (k) => ta(k, lang);
  const vars = { name: b.name || T('biz.unnamed'), city: (b.city || '').split(',')[0], kind: T(`biz.cat.${b.category}`).toLowerCase(), phone: b.phone };
  const hours = siteHours(s); const assets = getAssets();
  const faq = copy?.faq?.length ? copy.faq : [
    (hours || b.place?.hours?.length) && { q: T('site.faqTpl.hoursQ'), a: T('site.faqTpl.hoursA') },
    (b.address || b.place?.address) && { q: T('site.faqTpl.whereQ'), a: b.address || b.place.address },
    { q: T('site.faqTpl.bookQ'), a: fill(T(b.phone ? 'site.faqTpl.bookAPhone' : 'site.faqTpl.bookA'), vars) },
  ].filter(Boolean);
  const services = (copy?.services?.length ? copy.services : A(`site.svc.${b.category}`)).map((x) => ({ n: x.n, d: x.d, price: '' }));
  const offerTitle = copy?.offerTitle || (assets?.mode === 'ai' ? assets.offer.title : '');
  const offerText = copy?.offerText || (assets?.mode === 'ai' ? assets.offer.body : '');
  const list = [
    { id: 'hero', type: 'hero', on: true, title: '', headline: copy?.headline || fill(pick(A('site.tpl.headline')), vars), sub: copy?.subheadline || fill(pick(A('site.tpl.sub')), vars), cta: copy?.cta || T(`site.cta.${b.goal}`), image: '', imageAlt: '' },
    { id: 'about', type: 'about', on: true, title: '', text: copy?.about || '', image: '', imageAlt: '' },
    { id: 'services', type: 'services', on: true, title: '', items: services },
    PARTY_CATEGORIES.includes(b.category) && { id: 'menu', type: 'menu', on: true, title: '', note: '', groups: [{ name: T('site.menuGroup'), items: [{ n: '', d: '', price: '' }] }] },
    { id: 'gallery', type: 'gallery', on: true, title: '', images: [] },
    { id: 'offer', type: 'offer', on: !!offerTitle, title: offerTitle, label: T('site.offerLabel'), text: offerText, until: '' },
    { id: 'reviews', type: 'reviews', on: true, title: '' },
    { id: 'visit', type: 'visit', on: true, title: '' },
    { id: 'faq', type: 'faq', on: true, title: '', items: faq },
    { id: 'booking', type: 'booking', on: true, title: T(`site.bookTitle.${b.goal}`), sub: T('site.bookSub') },
    { id: 'contact', type: 'contact', on: false, title: '', sub: '' },
  ].filter(Boolean);
  return list;
}

/** Sites made by the previous version (one long form) become sections, keeping the owner's edits. */
export function ensureSiteV2() {
  const site = getState().site;
  if (!site.generated || Array.isArray(site.sections) && site.sections.length) return;
  const o = site.overrides || {};
  const copy = { ...(site.ai?.copy || {}), headline: o.headline ?? site.ai?.copy?.headline, subheadline: o.sub ?? site.ai?.copy?.subheadline, cta: o.cta ?? site.ai?.copy?.cta,
    services: o.services || site.ai?.copy?.services, faq: o.faq || site.ai?.copy?.faq, offerTitle: o.offerTitle, offerText: o.offerText };
  const preset = { burgundy: 'bordeaux', ocean: 'minimal', forest: 'bistro', sunset: 'street', lavender: 'studio', mono: 'minimal', cream: 'bistro', night: 'night' }[site.theme] || PRESET_FOR[getBiz().category];
  update((st) => ({ site: { ...st.site, v: 2, sections: draftSections(copy), design: { preset, palette: {}, fonts: null, radius: null, heroStyle: null, density: 'cozy' }, booking: st.site.booking || { askParty: null, askDate: true, askTime: true, askService: false, services: null, note: '' }, announcement: { on: false, text: '' }, seo: { title: '', description: '', image: '' }, logo: '', branding: true } }));
}

const LABELS = ['cta', 'call', 'directions', 'reviewsTitle', 'reviewsOn', 'reviewsAll', 'writeReview', 'visitTitle', 'hoursTitle', 'mapTitle', 'faqTitle', 'servicesTitle', 'menuTitle', 'galleryTitle', 'aboutTitle',
  'contactTitle', 'followTitle', 'navServices', 'navMenu', 'navGallery', 'navReviews', 'navVisit', 'navFaq', 'navLabel', 'skip', 'enlarge', 'close', 'openNow', 'closesAt', 'closed', 'opensAt', 'madeWith', 'locked',
  'privacyTitle', 'privacyText', 'bookName', 'bookContact', 'bookDate', 'bookTime', 'bookParty', 'bookService', 'bookMsg', 'bookConsent', 'bookSubmit', 'bookSending', 'bookDone', 'bookDoneApp', 'bookRequired', 'bookFail', 'bookPreview', 'bookIntro', 'bookTitle'];

/** The complete document for the template, from the current state. */
export function resolveDoc(s = getState()) {
  const site = s.site; const lang = siteLang(site); const b = getBiz(); const p = b.place || {};
  const T = (k) => tIn(lang, k); const g = s.signals?.google;
  const hidden = new Set(site.hiddenReviews || []);
  const reviews = (g?.reviews || []).filter((r, i) => (r.rating || 0) >= 4 && r.text && !hidden.has(i)).slice(0, 3);
  const sections = (site.sections || []);
  const svc = sections.filter((x) => x.type === 'services' || x.type === 'menu').flatMap((x) => (x.type === 'services' ? x.items.map((i) => i.n) : x.groups.flatMap((gr) => gr.items.map((i) => i.n)))).filter(Boolean).slice(0, 20);
  const text = Object.fromEntries(LABELS.map((k) => [k, T(`site.${k}`)]));
  text.cta = sections.find((x) => x.type === 'hero')?.cta || T(`site.cta.${b.goal}`);
  text.bookTitle = T(`site.bookTitle.${b.goal}`);
  const design = { ...site.design, preset: site.design?.preset || PRESET_FOR[b.category] };
  return normalizeDoc({
    lang, design, sections,
    biz: {
      name: b.name || T('biz.unnamed'), kind: T(`biz.cat.${b.category}`), city: (b.city || '').split(',')[0], address: b.address || p.address || '',
      phone: b.phone || p.phone || '', whatsapp: waNumber(b.whatsapp), email: b.email, lat: p.lat, lng: p.lng, mapsUrl: p.mapsUrl,
      reviewUrl: p.id ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(p.id)}` : '',
      logo: site.logo, rating: g?.rating ?? p.rating, reviewCount: g?.reviewCount ?? p.reviewCount,
      hours: siteHours(s), hoursText: siteHours(s) ? [] : (p.hours || []), hoursNote: b.hoursNote || '', reviews,
      social: { instagram: b.instagram, tiktok: b.tiktok, facebook: b.facebook },
    },
    booking: { ...site.booking, askParty: site.booking?.askParty ?? PARTY_CATEGORIES.includes(b.category), services: site.booking?.services?.length ? site.booking.services : svc },
    announcement: site.announcement, seo: site.seo,
    branding: can('noBranding') ? site.branding !== false : true,
    text,
  });
}

/** Options for rendering in the builder: preview, and a watermark for plans that cannot publish. */
export const previewOpts = () => ({ preview: true, watermark: can('publish') ? '' : tIn(siteLang(), 'site.watermark') });

export const suggestedSlug = () => slugify(getBiz().name || 'my-business').slice(0, 40).replace(/-+$/, '') || 'my-business';
export const publicSiteUrl = (slug) => `${apiUrl('') || location.origin}/s/${slug}`;
/** Download: one self-contained HTML file (Business). After publishing, its form still delivers requests to the app. */
export function exportHtml() {
  const site = getState().site;
  const base = apiUrl('') || location.origin;
  const opts = { fontBase: base, ...(site.slug && site.publishedAt ? { api: `${apiUrl('') || location.origin}/api/site`, slug: site.slug, url: publicSiteUrl(site.slug) } : {}) };
  return new Blob([buildDocument(resolveDoc(), opts)], { type: 'text/html;charset=utf-8' });
}
export { PRESETS };
