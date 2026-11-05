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

const salonWeek = [[['09:00', '19:00']], [['09:00', '19:00']], [['09:00', '19:00']], [['09:00', '20:00']], [['09:00', '20:00']], [['09:00', '15:00']], []].map((r) => ({ closed: !r.length, r }));
const bistroWeek = [[], [['12:00', '23:00']], [['12:00', '23:00']], [['12:00', '23:00']], [['12:00', '23:00']], [['12:00', '23:30']], [['12:00', '22:00']]].map((r) => ({ closed: !r.length, r }));

/** The fictional businesses: a café (most complete), a hair salon and a bistro. */
export const EXAMPLES = {
  cafe: EXAMPLE,
  salon: {
    business: { ...EXAMPLE.business, name: 'Studio Lumen', category: 'salon', goal: 'bookings', website: 'studio-lumen.example', instagram: 'studiolumen.iasi', facebook: '', noFacebook: true,
      phone: '+40 733 210 455', whatsapp: '+40733210455', email: 'programari@lumen.example', address: 'Str. Sărăriei 31, Iași',
      place: { ...EXAMPLE.business.place, id: 'example-lumen-iasi-0002', name: 'Studio Lumen', address: 'Str. Sărăriei 31, 700451 Iași', lat: 47.1712, lng: 27.5768, rating: 4.8, reviewCount: 143, phone: '+40 733 210 455', hours: [], hoursStruct: salonWeek } },
    google: { rating: 4.8, reviewCount: 143, reviews: [
      { rating: 5, author: 'Maria D.', when: 'acum 3 zile', at: ago(3), text: 'Cea mai bună vopsire pe care am avut-o! Andreea a înțeles exact ce voiam. Recomand cu drag.' },
      { rating: 5, author: 'Laura S.', when: 'a week ago', at: ago(8), text: 'Beautiful balayage and a very relaxing atmosphere. Booking was easy over WhatsApp.' },
      { rating: 4, author: 'Cristina P.', when: 'acum 2 săptămâni', at: ago(15), text: 'Rezultat superb, dar am așteptat 20 de minute peste ora programării.' },
      { rating: 5, author: 'Ana-Maria R.', when: 'acum o lună', at: ago(29), text: 'Tunsoare perfectă și sfaturi bune pentru îngrijirea părului creț.' },
      { rating: 3, author: 'Ioana T.', when: 'acum o lună', at: ago(40), text: 'Prețurile nu sunt afișate nicăieri online, am aflat abia la final.' },
    ] },
    site: { ...EXAMPLE.site, url: 'https://studio-lumen.example/', title: 'Studio Lumen', score: 38, checks: { ...EXAMPLE.site.checks, whatsapp: true, booking: false, hours: true, description: false, map: false } },
    notes: [['question', 'Instagram', 'Cât costă un balayage pentru păr lung?'], ['message', 'WhatsApp', 'Aveți loc sâmbătă dimineață pentru tuns și coafat?'], ['comment', 'Instagram', 'Superbă culoarea! Lucrați și cu produse vegane?'], ['question', 'Facebook', 'Faceți și coafuri pentru nuntă la domiciliu?']],
    themes: [
      { label: 'Colour and balayage results', tone: 'pos', mentions: 5, quotes: ['Cea mai bună vopsire', 'Beautiful balayage'] },
      { label: 'Prices not shown online', tone: 'gap', mentions: 3, quotes: ['Prețurile nu sunt afișate nicăieri online', 'Cât costă un balayage'] },
      { label: 'Waiting past the booked time', tone: 'gap', mentions: 1, quotes: ['am așteptat 20 de minute peste ora programării'] },
      { label: 'Weekend availability', tone: 'gap', mentions: 2, quotes: ['Aveți loc sâmbătă dimineață'] },
    ],
    competitors: [
      { id: 'ex-s1', name: 'Salon Belle Époque', address: 'Bd. Independenței 12, Iași', lat: 47.1688, lng: 27.5812, rating: 4.6, reviewCount: 402, distance: 420 },
      { id: 'ex-s2', name: 'Hair Lab Copou', address: 'Bd. Carol I 30, Iași', lat: 47.1741, lng: 27.5716, rating: 4.7, reviewCount: 233, distance: 520 },
      { id: 'ex-s3', name: 'Studio M Beauty', address: 'Str. Lascăr Catargi 8, Iași', lat: 47.1699, lng: 27.5850, rating: 4.4, reviewCount: 188, distance: 610 },
    ],
  },
  restaurant: {
    business: { ...EXAMPLE.business, name: 'Bistro Copou', category: 'restaurant', goal: 'bookings', website: 'bistro-copou.example', instagram: 'bistrocopou', facebook: 'bistrocopou',
      phone: '+40 744 908 112', whatsapp: '', email: 'rezervari@bistrocopou.example', address: 'Bd. Carol I 41, Iași',
      place: { ...EXAMPLE.business.place, id: 'example-bistro-iasi-0003', name: 'Bistro Copou', address: 'Bd. Carol I 41, 700506 Iași', lat: 47.1752, lng: 27.5701, rating: 4.3, reviewCount: 611, phone: '+40 744 908 112', hours: [], hoursStruct: bistroWeek } },
    google: { rating: 4.3, reviewCount: 611, reviews: [
      { rating: 5, author: 'Vlad G.', when: 'acum 4 zile', at: ago(4), text: 'Ciorba de burtă și papanașii sunt de neratat. Personal atent și rapid.' },
      { rating: 4, author: 'Sophie K.', when: 'a week ago', at: ago(9), text: 'Great local food and wine list. Hard to book a table on Friday night though.' },
      { rating: 2, author: 'Mihai L.', when: 'acum 3 săptămâni', at: ago(21), text: 'Am sunat de trei ori să rezerv și nu a răspuns nimeni. Mâncarea e bună, dar organizarea lasă de dorit.' },
      { rating: 5, author: 'Elena C.', when: 'acum o lună', at: ago(33), text: 'Terasa din curte e superbă vara, iar meniul zilei e foarte bun și ieftin.' },
      { rating: 4, author: 'Tudor B.', when: 'acum o lună', at: ago(38), text: 'Porții generoase. Ar fi util un meniu online cu prețuri.' },
    ] },
    site: { ...EXAMPLE.site, url: 'https://bistro-copou.example/', title: 'Bistro Copou', score: 54, checks: { ...EXAMPLE.site.checks, booking: false, hours: true, phone: true, structured: false, fast: false } },
    notes: [['question', 'Facebook', 'Se poate rezerva online pentru vineri seara, 6 persoane?'], ['question', 'Instagram', 'Aveți meniu vegetarian?'], ['comment', 'Facebook', 'Meniul zilei de joi a fost excelent!'], ['message', 'Email', 'Organizați evenimente private pentru 30 de persoane?']],
    themes: [
      { label: 'Traditional food quality', tone: 'pos', mentions: 5, quotes: ['Ciorba de burtă și papanașii sunt de neratat'] },
      { label: 'Hard to book a table', tone: 'gap', mentions: 4, quotes: ['Hard to book a table on Friday night', 'Am sunat de trei ori să rezerv'] },
      { label: 'No online menu with prices', tone: 'gap', mentions: 2, quotes: ['Ar fi util un meniu online cu prețuri'] },
      { label: 'Garden terrace', tone: 'pos', mentions: 2, quotes: ['Terasa din curte e superbă vara'] },
    ],
    competitors: [
      { id: 'ex-r1', name: 'Casa Lavric', address: 'Str. Sf. Atanasie 21, Iași', lat: 47.1630, lng: 27.5905, rating: 4.6, reviewCount: 2300, distance: 1400 },
      { id: 'ex-r2', name: 'Trattoria Copou', address: 'Bd. Carol I 50, Iași', lat: 47.1770, lng: 27.5680, rating: 4.4, reviewCount: 820, distance: 260 },
      { id: 'ex-r3', name: 'Bistro Pușkin', address: 'Str. Pușkin 7, Iași', lat: 47.1720, lng: 27.5745, rating: 4.5, reviewCount: 540, distance: 480 },
    ],
  },
};
export const exampleKind = () => getState().example || null;

export const isExample = () => !!getState().example;

/** Replaces the current business with the example one (the caller asks for confirmation first). */
export function loadExample(kind = 'cafe') {
  const t0 = now(); const e = EXAMPLES[kind] || EXAMPLE;
  update({
    example: kind in EXAMPLES ? kind : 'cafe', business: { ...e.business }, names: null,
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
