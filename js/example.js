// Example business for trying every feature without a Google key or a real listing.
// Everything here is fictional and the app marks it as EXAMPLE everywhere (banner + no publishing).
import { getState, update, defaultSite } from './store.js';

const now = () => new Date().toISOString();
const ago = (d) => new Date(Date.now() - d * 864e5).toISOString();
const week = [[['08:00', '20:00']], [['08:00', '20:00']], [['08:00', '20:00']], [['08:00', '20:00']], [['08:00', '22:00']], [['09:00', '22:00']], [['10:00', '18:00']]].map((r) => ({ closed: false, r }));

export const EXAMPLE = {
  business: {
    loaded: true, name: 'Cafeneaua Aurora', category: 'cafe', city: 'Iași', goal: 'bookings',
    website: 'cafeneaua-aurora.example', instagram: 'aurora.cafe', tiktok: '', facebook: 'cafeneauaaurora',
    phone: '+40 712 345 678', whatsapp: '+40712345678', email: 'salut@aurora.example', address: 'Str. Lăpușneanu 14, Iași',
    noName: false, noWebsite: false, noInstagram: false, noTiktok: true, noFacebook: false,
    place: { id: 'example-aurora-iasi-0001', name: 'Cafeneaua Aurora', address: 'Str. Lăpușneanu 14, 700057 Iași', lat: 47.1666, lng: 27.5822, rating: 4.6, reviewCount: 218, mapsUrl: '', website: '', phone: '+40 712 345 678',
      hours: ['Monday: 08:00–20:00', 'Tuesday: 08:00–20:00', 'Wednesday: 08:00–20:00', 'Thursday: 08:00–20:00', 'Friday: 08:00–22:00', 'Saturday: 09:00–22:00', 'Sunday: 10:00–18:00'], hoursStruct: week, fetchedAt: now() },
  },
  google: {
    rating: 4.6, reviewCount: 218,
    reviews: [
      { rating: 5, author: 'Ioana P.', when: 'acum 2 zile', at: ago(2), text: 'Cel mai bun flat white din centru și o terasă liniștită. Personalul e foarte prietenos, revin sigur!' },
      { rating: 5, author: 'Mark T.', when: 'a week ago', at: ago(7), text: 'Lovely quiet place to work, great flat white and homemade cinnamon rolls. Wish they had more power sockets.' },
      { rating: 4, author: 'Andrei M.', when: 'acum 2 săptămâni', at: ago(14), text: 'Cafea foarte bună, prăjituri de casă. Sâmbăta e greu să găsești masă după ora 11, ar fi bine să se poată rezerva online.' },
      { rating: 3, author: 'Radu C.', when: 'acum o lună', at: ago(30), text: 'Am venit duminică la 9 și era închis, programul de pe Google nu era clar. Altfel cafeaua e ok.' },
      { rating: 5, author: 'Elena V.', when: 'acum o lună', at: ago(34), text: 'Brunch-ul de sâmbătă e excelent! Ouă Benedict perfecte și un cappuccino foarte bun.' },
    ],
  },
  site: { url: 'https://cafeneaua-aurora.example/', status: 200, title: 'Cafeneaua Aurora', ms: 2400, kb: 1800, imagesWithoutAlt: 6, words: 240, score: 46,
    checks: { reachable: true, https: true, mobile: true, title: true, description: false, phone: true, whatsapp: false, email: false, booking: false, hours: false, map: true, structured: false, social: true, fast: true } },
  notes: [
    ['question', 'Instagram', 'Aveți opțiuni vegane la brunch?'],
    ['question', 'Instagram', 'Se poate rezerva o masă pentru 8 persoane sâmbătă la 11?'],
    ['comment', 'Facebook', 'Terasa e superbă, dar muzica a fost cam tare joi seara.'],
    ['message', 'WhatsApp', 'Bună! Faceți și torturi la comandă pentru aniversări?'],
    ['review', 'TripAdvisor', 'Great coffee, a bit hard to find a table on weekends. Booking would help.'],
    ['comment', 'Instagram', 'Cinnamon roll-urile sunt cele mai bune din Iași 😍'],
  ],
  themes: [
    { label: 'Coffee quality', tone: 'pos', mentions: 6, quotes: ['Cel mai bun flat white din centru', 'great flat white'] },
    { label: 'Hard to get a table on weekends', tone: 'gap', mentions: 4, quotes: ['Sâmbăta e greu să găsești masă după ora 11', 'Booking would help.'] },
    { label: 'Homemade pastries and brunch', tone: 'pos', mentions: 4, quotes: ['Cinnamon roll-urile sunt cele mai bune din Iași', 'Brunch-ul de sâmbătă e excelent'] },
    { label: 'Unclear opening hours', tone: 'gap', mentions: 2, quotes: ['programul de pe Google nu era clar'] },
    { label: 'Friendly staff', tone: 'pos', mentions: 2, quotes: ['Personalul e foarte prietenos'] },
  ],
  competitors: [
    { id: 'ex-c1', name: 'Tucano Coffee Copou', address: 'Bd. Carol I 4, Iași', lat: 47.1702, lng: 27.5759, rating: 4.5, reviewCount: 1840, distance: 640 },
    { id: 'ex-c2', name: 'Cafeneaua Veche', address: 'Str. Cuza Vodă 9, Iași', lat: 47.1649, lng: 27.5841, rating: 4.4, reviewCount: 512, distance: 230 },
    { id: 'ex-c3', name: 'Boema Bistro', address: 'Str. Ștefan cel Mare 22, Iași', lat: 47.1631, lng: 27.5866, rating: 4.7, reviewCount: 389, distance: 520 },
    { id: 'ex-c4', name: 'Moment Coffee Lab', address: 'Str. Anastasie Panu 3, Iași', lat: 47.1612, lng: 27.5893, rating: 4.8, reviewCount: 214, distance: 780 },
    { id: 'ex-c5', name: 'La Teatru Café', address: 'Str. Agatha Bârsescu 1, Iași', lat: 47.1673, lng: 27.5800, rating: 4.2, reviewCount: 645, distance: 190 },
  ],
};

export const isExample = () => !!getState().example;

/** Replaces the current business with the example one (the caller asks for confirmation first). */
export function loadExample() {
  const t0 = now(); const e = EXAMPLE;
  update({
    example: true, business: { ...e.business }, names: null,
    signals: { notes: e.notes.map(([kind, source, text], i) => ({ id: `ex${i}`, kind, source, text, at: Date.now() - i * 36e5 })), google: { ...e.google, fetchedAt: t0 }, site: { ...e.site, checkedAt: t0 },
      themes: { mode: 'example', items: e.themes, at: t0 }, errors: {}, collectedAt: t0 },
    competitors: { list: e.competitors, custom: [], fetchedAt: t0 },
    diagnosis: null, mission: null, assets: null, checkpoint: null, replies: null, studio: null, site: defaultSite(),
  });
}

/** Removes the example and starts clean (keeps profile name, theme and chat out of it). */
export function clearExample() {
  update({
    example: false, business: { loaded: false }, names: null,
    signals: { notes: [], google: null, site: null, themes: null, errors: {}, collectedAt: null },
    competitors: { list: [], custom: [], fetchedAt: null },
    diagnosis: null, mission: null, assets: null, checkpoint: null, replies: null, studio: null, site: defaultSite(),
  });
}
