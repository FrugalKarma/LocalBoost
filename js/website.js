// App-side website logic: resolve editable copy -> document config, share link, exports.
import { getLang, tIn, ta } from './i18n.js';
import { getState } from './store.js';
import { BUSINESS, SLOTS } from './data.js';
import { getBiz } from './business.js';
import { normalizeDoc, buildExportFiles } from './siteTemplate.js';

const THEME_BG = { ocean: '#0B2A4A', forest: '#16372B', sunset: '#7C2D12', lavender: '#3B2A6B', mono: '#111111', cream: '#2B2118', night: '#0E1116' };
const pick = (arr, i = 0) => (arr.length ? arr[((i % arr.length) + arr.length) % arr.length] : '');

export const siteLang = (site = getState().site) => site.lang || getLang();

/** Effective copy for the current site state (edit > AI > local variant). */
export function resolveCopy(s = getState()) {
  const site = s.site; const lang = siteLang(site);
  const o = site.overrides || {}; const v = site.variants || {};
  const ai = site.ai && site.ai.lang === lang ? site.ai.copy : null;
  const A = (k) => ta(k, lang);
  const useAi = (n) => (n ? null : ai);
  const heroAi = useAi(v.hero); const offerAi = useAi(v.offer); const faqAi = useAi(v.faq);
  const services = o.services || A('site.services');
  const faqLocal = A('site.faq'); const rot = v.faq || 0;
  const faqRotated = faqLocal.length ? faqLocal.map((_, i) => faqLocal[(i + rot) % faqLocal.length]) : [];
  return {
    lang,
    headline: o.headline ?? heroAi?.headline ?? pick(A('site.headline'), v.hero),
    sub: o.sub ?? heroAi?.subheadline ?? pick(A('site.sub'), v.hero),
    cta: o.cta ?? heroAi?.cta ?? tIn(lang, 'site.cta'),
    location: o.location ?? getBiz().city,
    hours: o.hours ?? A('site.hours').join('\n'),
    offerTitle: o.offerTitle ?? offerAi?.offerTitle ?? pick(A('gen.offerTitle'), v.offer),
    offerText: o.offerText ?? offerAi?.offerText ?? pick(A('gen.offerBody'), v.offer),
    services: services.slice(0, 3),
    faq: o.faq || (faqAi?.faq?.length ? faqAi.faq : faqRotated),
  };
}

export function resolveDoc(s = getState()) {
  const site = s.site; const c = resolveCopy(s); const lang = c.lang;
  const T = (k) => tIn(lang, k);
  return normalizeDoc({
    lang, theme: site.theme, accent: site.accent, layout: site.layout, font: site.font, radius: site.radius,
    flags: { booking: site.showBooking, reviews: site.showReviews, location: site.showLocation },
    exp: Date.now() + 72 * 3600 * 1000,
    text: {
      brand: getBiz().name || T('biz.unnamed'), social: { instagram: getBiz().instagram, tiktok: getBiz().tiktok, facebook: getBiz().facebook, website: getBiz().website }, location: c.location, headline: c.headline, sub: c.sub, cta: c.cta, badge: c.location,
      servicesTitle: T('site.servicesTitle'), services: c.services,
      offerLabel: T('site.offerLabel'), offerTitle: c.offerTitle, offerText: c.offerText,
      reviewsTitle: T('site.reviewsTitle'), rating: String(BUSINESS.rating), reviewsNote: T('site.reviewsNote'),
      reviews: [1, 2, 3].map((n) => T(`site.review${n}`)),
      locationTitle: T('site.locationTitle'), locationText: `${getBiz().name || T('biz.unnamed')}, ${c.location}.`,
      hoursTitle: T('site.hoursTitle'), hours: c.hours.split('\n').filter(Boolean),
      contactTitle: T('site.contactTitle'), contact: T('site.contact'),
      faqTitle: T('site.faqTitle'), faq: c.faq,
      bookTitle: T('site.bookTitle'), bookName: T('site.bookName'), bookParty: T('site.bookParty'), bookSlot: T('site.bookSlot'),
      bookConsent: T('site.bookConsent'), bookSubmit: T('site.bookSubmit'), bookDone: T('site.bookDone'), bookRequired: T('site.bookRequired'),
      slots: SLOTS, footer: T('site.footer'), demo: '', nav: ta('site.nav', lang), tempLabel: T('site.temp'),
    },
  });
}

/* ---------- share link ---------- */
const b64 = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64 = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
export const PREVIEW_PATH = `/preview/${BUSINESS.id}`;
export function shareUrl(doc = resolveDoc()) {
  return `${location.origin}${PREVIEW_PATH}#d=${b64(JSON.stringify(doc))}`;
}

/* ---------- ZIP (store method, no dependencies) ---------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u8) => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

export function makeZip(files) {
  const enc = new TextEncoder(); const chunks = []; const central = []; let offset = 0;
  const u16 = (n) => [n & 255, (n >>> 8) & 255]; const u32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  for (const [name, content] of Object.entries(files)) {
    const nameB = enc.encode(name); const data = typeof content === 'string' ? enc.encode(content) : content; const crc = crc32(data);
    const local = new Uint8Array([0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameB.length), ...u16(0), ...nameB]);
    chunks.push(local, data);
    central.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameB.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...nameB]));
    offset += local.length + data.length;
  }
  const cdSize = central.reduce((a, c) => a + c.length, 0);
  const end = new Uint8Array([0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(central.length), ...u16(central.length), ...u32(cdSize), ...u32(offset), ...u16(0)]);
  return new Blob([...chunks, ...central, end], { type: 'application/zip' });
}

export function exportZip() {
  const doc = resolveDoc();
  const files = buildExportFiles(doc);
  files['README.txt'] = `${getBiz().name || "Business"} - temporary website\n${tIn(doc.lang, 'site.exportReadme')}\n`;
  return makeZip(files);
}
export function exportHtml() {
  const f = buildExportFiles(resolveDoc());
  const inline = f['index.html'].replace('<link rel="stylesheet" href="style.css">', `<style>${f['style.css']}</style>`).replace('<script src="script.js"><\/script>', `<script>${f['script.js']}<\/script>`);
  return new Blob([inline], { type: 'text/html;charset=utf-8' });
}

/* ---------- pitch card PNG ("screenshot for the pitch") ---------- */
export function exportPitchCard(doc = resolveDoc()) {
  return new Promise((resolve, reject) => {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 630;
    const g = c.getContext('2d'); const x = doc.text;
    g.fillStyle = THEME_BG[doc.theme] || '#0B2A4A'; g.fillRect(0, 0, 1200, 630);
    g.strokeStyle = 'rgba(255,249,239,.14)'; g.lineWidth = 2;
    [120, 210, 300, 390].forEach((r) => { g.beginPath(); g.arc(980, 200, r, 0, Math.PI * 2); g.stroke(); });
    g.beginPath(); g.moveTo(580, 200); g.lineTo(1200, 200); g.moveTo(980, 0); g.lineTo(980, 630); g.stroke();
    g.fillStyle = doc.accent; g.beginPath(); g.arc(980, 200, 46, 0, Math.PI * 2); g.fill();
    g.fillStyle = doc.accent; g.font = '500 22px Lexend, sans-serif'; g.fillText(`${x.brand.toUpperCase()} · ${x.location.toUpperCase()}`, 70, 90);
    g.fillStyle = '#FFF9EF'; g.font = '500 60px Lexend, sans-serif';
    const words = x.headline.split(' '); let line = ''; let y = 190;
    for (const w of words) { const test = line ? `${line} ${w}` : w; if (g.measureText(test).width > 780 && line) { g.fillText(line, 70, y); line = w; y += 74; } else line = test; }
    g.fillText(line, 70, y);
    g.fillStyle = doc.accent; const label = x.offerTitle; g.font = '500 30px Lexend, sans-serif';
    const w = Math.min(g.measureText(label).width + 56, 760); g.beginPath(); g.roundRect(70, 440, w, 62, 31); g.fill();
    g.fillStyle = '#10151C'; g.fillText(label.slice(0, 40), 98, 481);
    g.fillStyle = '#FFF9EF'; g.font = '500 28px Lexend, sans-serif'; g.fillText(`→ ${x.cta}`, 70, 556);
    g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '400 20px Lexend, sans-serif'; g.fillText(x.footer, 70, 598);
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas'))), 'image/png');
  });
}
