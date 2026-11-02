// App-side website logic: the owner's real details + edited/AI copy -> one document config,
// used for the live preview, the downloadable file and the hosted page (/s/<slug>).
import { getLang, tIn, ta } from './i18n.js';
import { getState } from './store.js';
import { getBiz, waNumber } from './business.js';
import { getAssets } from './ai.js';
import { normalizeDoc, buildDocument } from './siteTemplate.js';
import { slug as slugify } from './core.js';
import { apiUrl } from './api.js';

const pick = (arr, i = 0) => (arr.length ? arr[((i % arr.length) + arr.length) % arr.length] : '');
const fill = (s, v) => String(s || '').replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
export const siteLang = (site = getState().site) => site.lang || getLang();
export const PARTY_CATEGORIES = ['cafe', 'restaurant'];

/** Opening hours: what the owner typed for the site, else Google's list. */
export function siteHours(s = getState()) {
  const o = s.site.overrides || {};
  if (typeof o.hours === 'string') return o.hours.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 7);
  return (getBiz().place?.hours || []).slice(0, 7);
}

/** Effective copy for the current site state (owner edit > AI > template built from the real details). */
export function resolveCopy(s = getState()) {
  const site = s.site; const lang = siteLang(site); const b = getBiz();
  const o = site.overrides || {}; const v = site.variants || {};
  const ai = site.ai && site.ai.lang === lang ? site.ai.copy : null;
  const A = (k) => ta(k, lang); const T = (k) => tIn(lang, k);
  const vars = { name: b.name || T('biz.unnamed'), city: (b.city || '').split(',')[0], kind: T(`biz.cat.${b.category}`).toLowerCase(), phone: b.phone };
  const heroAi = v.hero ? null : ai; const faqAi = v.faq ? null : ai; const svcAi = v.services ? null : ai;
  const assets = getAssets();
  const hours = siteHours(s);
  const faqLocal = [
    hours.length && { q: T('site.faqTpl.hoursQ'), a: hours.join(' · ') },
    (b.address || b.place?.address) && { q: T('site.faqTpl.whereQ'), a: b.address || b.place.address },
    { q: T('site.faqTpl.bookQ'), a: fill(T(b.phone ? 'site.faqTpl.bookAPhone' : 'site.faqTpl.bookA'), vars) },
  ].filter(Boolean);
  const svcLocal = A(`site.svc.${b.category}`);
  return {
    lang,
    headline: o.headline ?? heroAi?.headline ?? fill(pick(A('site.tpl.headline'), v.hero), vars),
    sub: o.sub ?? heroAi?.subheadline ?? fill(pick(A('site.tpl.sub'), v.hero), vars),
    cta: o.cta ?? heroAi?.cta ?? T(`site.cta.${b.goal}`),
    // the offer is only shown when the owner wrote it or the AI drafted it: template text with [brackets] never goes online
    offerTitle: o.offerTitle ?? ai?.offerTitle ?? (assets?.mode === 'ai' ? assets.offer.title : ''),
    offerText: o.offerText ?? ai?.offerText ?? (assets?.mode === 'ai' ? assets.offer.body : ''),
    services: (o.services || (svcAi?.services?.length ? svcAi.services : svcLocal)).slice(0, 6),
    faq: o.faq || (faqAi?.faq?.length ? faqAi.faq : faqLocal),
    hours,
  };
}

/** The full document for the template. preview: in-app preview (nothing is sent from its form). */
export function resolveDoc(s = getState()) {
  const site = s.site; const c = resolveCopy(s); const lang = c.lang; const b = getBiz(); const p = b.place || {};
  const T = (k) => tIn(lang, k);
  const g = s.signals?.google;
  const reviews = (g?.reviews || []).filter((r) => (r.rating || 0) >= 4 && r.text).slice(0, 3);
  return normalizeDoc({
    lang, theme: site.theme, accent: site.accent, layout: site.layout, font: site.font, radius: site.radius,
    flags: { booking: site.showBooking, reviews: site.showReviews, location: site.showLocation, offer: site.showOffer !== false, party: PARTY_CATEGORIES.includes(b.category) },
    biz: {
      name: b.name || T('biz.unnamed'), kind: T(`biz.cat.${b.category}`), city: (b.city || '').split(',')[0], address: b.address || p.address || '',
      phone: b.phone || p.phone || '', whatsapp: waNumber(b.whatsapp), email: b.email, lat: p.lat, lng: p.lng, mapsUrl: p.mapsUrl,
      rating: g?.rating ?? p.rating, reviewCount: g?.reviewCount ?? p.reviewCount, hours: c.hours, reviews,
      social: { instagram: b.instagram, tiktok: b.tiktok, facebook: b.facebook },
    },
    text: {
      headline: c.headline, sub: c.sub, cta: c.cta, badge: [T(`biz.cat.${b.category}`), (b.city || '').split(',')[0]].filter(Boolean).join(' · '),
      servicesTitle: T('site.servicesTitle'), services: c.services,
      offerLabel: T('site.offerLabel'), offerTitle: c.offerTitle, offerText: c.offerText,
      reviewsTitle: T('site.reviewsTitle'), reviewsOn: T('site.reviewsOn'), reviewsAll: T('site.reviewsAll'),
      visitTitle: T('site.visitTitle'), hoursTitle: T('site.hoursTitle'), today: T('site.today'), directions: T('site.directions'), call: T('site.call'), whatsapp: 'WhatsApp', emailLabel: T('site.emailLabel'),
      faqTitle: T('site.faqTitle'), faq: c.faq,
      bookTitle: T(`site.bookTitle.${b.goal}`), bookSub: T('site.bookSub'), bookName: T('site.bookName'), bookContact: T('site.bookContact'), bookDate: T('site.bookDate'), bookTime: T('site.bookTime'),
      bookParty: T('site.bookParty'), bookMsg: T('site.bookMsg'), bookConsent: T('site.bookConsent'), bookSubmit: T('site.bookSubmit'), bookSending: T('site.bookSending'),
      bookDone: T('site.bookDone'), bookDoneApp: T('site.bookDoneApp'), bookRequired: T('site.bookRequired'), bookFail: T('site.bookFail'), bookPreview: T('site.bookPreview'), bookIntro: T('site.bookIntro'),
      nav: ta('site.nav', lang), footer: b.address || p.address || '', madeWith: T('site.madeWith'),
    },
  });
}

export const suggestedSlug = () => slugify(getBiz().name || 'my-business').slice(0, 40).replace(/-+$/, '') || 'my-business';
/** Download: one self-contained HTML file. Once the site is published, its form still delivers requests to the app. */
export function exportHtml() {
  const site = getState().site;
  const opts = site.slug && site.publishedAt ? { api: `${apiUrl('') || location.origin}/api/site`, slug: site.slug } : {};
  return new Blob([buildDocument(resolveDoc(), opts)], { type: 'text/html;charset=utf-8' });
}
