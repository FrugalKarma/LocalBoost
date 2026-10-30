// Pure website generator: document config in, HTML/CSS/JS out. No imports, so it can be
// shared by the app, the public preview page and the ZIP export. Every string is escaped
// and every colour validated, so generated pages cannot inject markup or scripts.

const E = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const S = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, n) : '');
const HEX = /^#[0-9a-fA-F]{6}$/;
const handle = (v) => (typeof v === 'string' ? v.replace(/^@+/, '').replace(/[^A-Za-z0-9._]/g, '').slice(0, 30) : '');
export const THEMES = ['ocean', 'forest', 'sunset', 'lavender', 'mono', 'cream', 'night'];
export const THEME_ACCENT = { ocean: '#F59E0B', forest: '#E9C46A', sunset: '#FDBA74', lavender: '#FDE68A', mono: '#FACC15', cream: '#C2410C', night: '#38BDF8' };
export const LAYOUTS = ['split', 'centered', 'editorial'];
export const FONTS_LIST = ['lexend', 'serif', 'grotesk'];
export const RADII = ['soft', 'sharp', 'round'];
const inkFor = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#10151C' : '#FFFFFF'; };

export function normalizeDoc(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const x = r.text && typeof r.text === 'object' ? r.text : {};
  const arr = (a, n) => (Array.isArray(a) ? a.slice(0, n) : []);
  return {
    lang: ['ro', 'en', 'fr', 'de', 'hu'].includes(r.lang) ? r.lang : 'en',
    theme: THEMES.includes(r.theme) ? r.theme : 'ocean',
    accent: HEX.test(r.accent) ? r.accent : '#F59E0B',
    font: FONTS_LIST.includes(r.font) ? r.font : 'lexend',
    radius: RADII.includes(r.radius) ? r.radius : 'soft',
    layout: LAYOUTS.includes(r.layout) ? r.layout : 'split',
    flags: { booking: r.flags?.booking !== false, reviews: r.flags?.reviews !== false, location: r.flags?.location !== false },
    exp: Number(r.exp) || 0,
    text: {
      brand: S(x.brand, 60), location: S(x.location, 80), headline: S(x.headline, 120), sub: S(x.sub, 260), cta: S(x.cta, 40),
      badge: S(x.badge, 60), servicesTitle: S(x.servicesTitle, 60),
      services: arr(x.services, 3).map((s) => ({ n: S(s?.n, 50), d: S(s?.d, 160) })),
      offerLabel: S(x.offerLabel, 40), offerTitle: S(x.offerTitle, 90), offerText: S(x.offerText, 320), offerWindow: S(x.offerWindow, 40),
      reviewsTitle: S(x.reviewsTitle, 60), rating: S(x.rating, 8), reviewsNote: S(x.reviewsNote, 120),
      reviews: arr(x.reviews, 3).map((q) => S(q, 180)),
      locationTitle: S(x.locationTitle, 60), locationText: S(x.locationText, 160),
      hoursTitle: S(x.hoursTitle, 60), hours: arr(x.hours, 4).map((h) => S(h, 80)),
      contactTitle: S(x.contactTitle, 60), contact: S(x.contact, 120),
      faqTitle: S(x.faqTitle, 60), faq: arr(x.faq, 5).map((f) => ({ q: S(f?.q, 140), a: S(f?.a, 320) })),
      bookTitle: S(x.bookTitle, 70), bookName: S(x.bookName, 40), bookParty: S(x.bookParty, 40), bookSlot: S(x.bookSlot, 40),
      bookConsent: S(x.bookConsent, 160), bookSubmit: S(x.bookSubmit, 40), bookDone: S(x.bookDone, 200), bookRequired: S(x.bookRequired, 100),
      slots: arr(x.slots, 6).map((s) => S(s, 20)),
      footer: S(x.footer, 60), demo: S(x.demo, 40), nav: arr(x.nav, 6).map((n) => S(n, 30)),
      tempLabel: S(x.tempLabel, 80),
      social: { instagram: handle(x.social?.instagram), tiktok: handle(x.social?.tiktok), facebook: handle(x.social?.facebook), website: S(typeof x.social?.website === 'string' ? x.social.website.replace(/[^A-Za-z0-9.\-_/]/g, '') : '', 120) },
    },
  };
}

export function sectionList(doc) {
  const f = doc.flags;
  return ['hero', 'services', 'offer', f.reviews && 'reviews', f.location && 'location', 'faq', f.booking && 'booking'].filter(Boolean);
}

export const SITE_CSS = `
*{box-sizing:border-box;margin:0}html{scroll-behavior:smooth}
:root{--accent:#F59E0B;--accent-ink:#10151C;--r:16px;--rb:999px;--fh:Lexend,system-ui,sans-serif;--fb:Lexend,system-ui,sans-serif;--sage:#5FA98A;
--hero-bg:#0B2A4A;--hero-fg:#F4F8FB;--hero-muted:rgba(244,248,251,.78);--page:#F4F8FB;--fg:#10202F;--muted:#4A5B6C;--card:#fff;--head:#0B2A4A;--line:rgba(11,42,74,.16)}
body.t-forest{--hero-bg:#16372B;--hero-fg:#F3F7F1;--hero-muted:rgba(243,247,241,.78);--page:#F5F7F2;--fg:#17261F;--muted:#4C5E54;--head:#16372B;--line:rgba(22,55,43,.16)}
body.t-sunset{--hero-bg:#7C2D12;--hero-fg:#FFF4E8;--hero-muted:rgba(255,244,232,.8);--page:#FFF7ED;--fg:#2B1A10;--muted:#6B4A39;--head:#7C2D12;--line:rgba(124,45,18,.18)}
body.t-lavender{--hero-bg:#3B2A6B;--hero-fg:#F7F5FF;--hero-muted:rgba(247,245,255,.8);--page:#F7F5FF;--fg:#1D1633;--muted:#575070;--head:#3B2A6B;--line:rgba(59,42,107,.16)}
body.t-mono{--hero-bg:#111;--hero-fg:#fff;--hero-muted:rgba(255,255,255,.75);--page:#FAFAFA;--fg:#111;--muted:#555;--head:#111;--line:rgba(0,0,0,.14)}
body.t-cream{--hero-bg:#F1EADB;--hero-fg:#2B2118;--hero-muted:#5E5446;--page:#FFFBF3;--fg:#2B2118;--muted:#6B6154;--head:#2B2118;--line:rgba(43,33,24,.15)}
body.t-night{--hero-bg:#0E1116;--hero-fg:#F1F5F9;--hero-muted:rgba(241,245,249,.75);--page:#14181F;--fg:#F1F5F9;--muted:#A9B4C2;--card:#1C222B;--head:#F1F5F9;--line:rgba(241,245,249,.16)}
body.f-serif{--fh:Fraunces,Georgia,serif}
body.f-grotesk{--fh:'Space Grotesk',system-ui,sans-serif;--fb:'Space Grotesk',system-ui,sans-serif}
body.r-sharp{--r:4px;--rb:4px}
body.r-round{--r:30px;--rb:999px}
body{font-family:var(--fb);background:var(--page);color:var(--fg);line-height:1.55;font-size:17px;-webkit-text-size-adjust:100%}
h1,h2,h3{font-family:var(--fh);font-weight:600;line-height:1.12;color:var(--head)}
a{color:inherit}.wrap{max-width:1080px;margin:0 auto;padding:0 22px}
.top{position:sticky;top:0;z-index:5;background:var(--hero-bg);color:var(--hero-fg);border-bottom:1px solid rgba(255,249,239,.14)}
.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:62px}
.logo{font-family:var(--fh);font-weight:700;font-size:1.15rem;display:flex;gap:10px;align-items:center;text-decoration:none}
.logo i{width:26px;height:26px;border-radius:50%;border:3px solid var(--accent);display:inline-block;position:relative;flex:none}
.logo i:after{content:"";position:absolute;inset:5px;border-radius:50%;background:var(--accent)}
.nav{display:flex;gap:22px;font-size:.92rem}.nav a{text-decoration:none;opacity:.86}.nav a:hover{opacity:1;text-decoration:underline}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 22px;border-radius:var(--rb);background:var(--accent);color:var(--accent-ink);font-weight:800;text-decoration:none;border:2px solid transparent;cursor:pointer;font:inherit;font-weight:800;transition:transform .12s}
.btn:active{transform:scale(.97)}.btn:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.hero{background:var(--hero-bg);color:var(--hero-fg);position:relative;overflow:hidden;padding:56px 0 64px}
.hero h1{color:var(--hero-fg);font-size:clamp(2.1rem,6vw,3.9rem);max-width:15ch;overflow-wrap:break-word}
.hero p.sub{color:var(--hero-muted);font-size:1.12rem;max-width:46ch;margin:18px 0 26px}
.badge{display:inline-flex;gap:8px;align-items:center;font-family:var(--fb);font-size:.78rem;letter-spacing:.06em;text-transform:uppercase;padding:6px 12px;border-radius:999px;border:1px solid currentColor;margin-bottom:18px}
.badge:before{content:"";width:8px;height:8px;border-radius:50%;background:var(--accent)}
.hero .grid{display:grid;grid-template-columns:1.2fr .8fr;gap:30px;align-items:center}
.hero.centered .grid{grid-template-columns:1fr;text-align:center;justify-items:center}.hero.centered h1{max-width:20ch}.hero.centered .art{display:none}
.hero.editorial .grid{grid-template-columns:1fr}.hero.editorial h1{font-size:clamp(2.4rem,8vw,5.6rem);max-width:12ch}.hero.editorial .art{position:absolute;right:-60px;top:20px;width:340px;opacity:.28}
.art svg{width:100%;height:auto;display:block}
.sec{padding:60px 0}.sec h2{font-size:clamp(1.6rem,4vw,2.3rem);margin-bottom:22px}
.eyebrow{font-family:var(--fb);font-size:.76rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:8px}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:22px}
.card h3{font-size:1.2rem;margin-bottom:6px}.card p{color:var(--muted);font-size:.98rem}.card .n{font-family:var(--fb);color:var(--muted);font-size:.78rem}
.offer{background:var(--hero-bg);color:var(--hero-fg);border-radius:var(--r);padding:34px;display:grid;grid-template-columns:1fr auto;gap:22px;align-items:center;border:2px dashed var(--accent)}
.offer h2{color:var(--hero-fg);margin:6px 0 10px}.offer p{color:var(--hero-muted);max-width:52ch}.offer .eyebrow{color:var(--accent)}.offer{border-color:var(--accent)}
.pulse{display:flex;gap:18px;align-items:center;margin-bottom:18px;flex-wrap:wrap}.score{font-family:var(--fh);font-size:3.2rem;color:var(--head);line-height:1}
.stars{color:var(--accent);letter-spacing:3px;filter:drop-shadow(0 0 1px rgba(0,0,0,.5))}
.quote{border-left:4px solid var(--accent);padding-left:14px;font-style:italic}
.two{display:grid;grid-template-columns:1.1fr .9fr;gap:18px}.map{border-radius:var(--r);overflow:hidden;border:1px solid var(--line);background:#E6EDF2}.map svg{display:block;width:100%;height:auto}
.hours li{list-style:none;padding:8px 0;border-bottom:1px solid var(--line)}
details{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin-bottom:10px}summary{cursor:pointer;font-weight:700;min-height:28px}details p{margin-top:8px;color:var(--muted)}
form{display:grid;gap:14px;background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:26px;max-width:560px}
label{display:grid;gap:6px;font-weight:700;font-size:.92rem}input[type=text],select{min-height:48px;border-radius:12px;border:1.5px solid var(--line);padding:0 14px;font:inherit;background:var(--page);color:var(--fg)}
.chk{display:flex;gap:10px;align-items:flex-start;font-weight:500;font-size:.88rem;color:var(--muted)}.chk input{width:22px;height:22px;margin-top:2px;accent-color:var(--head);flex:none}
.done{display:none;background:rgba(123,165,141,.2);border:1.5px solid var(--sage);border-radius:16px;padding:18px;font-weight:700;color:var(--fg)}.done.show{display:block;animation:pop .25s ease}
.err{color:#B3261E;font-size:.88rem;min-height:1.2em}body.t-night .err{color:#FFB4A9}
footer{background:var(--hero-bg);color:var(--hero-fg);padding:30px 0;font-size:.9rem}footer .wrap{display:flex;gap:12px;justify-content:space-between;flex-wrap:wrap;align-items:center}
.soc{display:flex;gap:6px;flex-wrap:wrap}.soc a{opacity:.9}.demo{font-family:var(--fb);font-size:.72rem;letter-spacing:.08em;border:1px solid var(--accent);color:var(--accent);padding:3px 8px;border-radius:6px}
.temp{background:var(--accent);color:var(--accent-ink);text-align:center;font-weight:700;font-size:.85rem;padding:6px 10px}
@keyframes pop{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
@media(max-width:820px){.nav{display:none}.hero .grid,.two{grid-template-columns:1fr}.cards{grid-template-columns:1fr}.offer{grid-template-columns:1fr}.art{max-width:260px}.hero.editorial .art{display:none}.sec{padding:44px 0}}
body.present{font-size:21px}body.present .sec{min-height:100vh;display:flex;align-items:center}body.present .sec>.wrap,body.present .hero>.wrap{width:100%}body.present .hero{min-height:100vh;display:flex;align-items:center}body.present .nav,body.present .top .btn{display:none}
body.present *:focus{cursor:default}
`;

export const SITE_JS = `
(function(){
var f=document.getElementById('book');
if(f){f.addEventListener('submit',function(e){e.preventDefault();var ok=document.getElementById('consent').checked;var er=document.getElementById('err');
if(!ok){er.textContent=f.getAttribute('data-required');return}er.textContent='';
var party=f.party.value,slot=f.slot.value;f.querySelectorAll('.fields').forEach(function(n){n.style.display='none'});
var d=document.getElementById('done');d.classList.add('show');d.focus&&d.focus();
try{parent.postMessage({lb:'booking',party:Number(party),slot:slot},'*')}catch(x){}})}
window.addEventListener('message',function(e){var m=e.data;if(!m||m.lb!=='goto')return;
var els=document.querySelectorAll('[data-sec]');var el=els[m.index];if(el)el.scrollIntoView({behavior:m.instant?'auto':'smooth',block:'start'})});
document.documentElement.setAttribute('data-ready','1');
})();
`;

const ART = `<svg viewBox="0 0 320 320" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-opacity=".35"><circle cx="160" cy="160" r="150"/><circle cx="160" cy="160" r="110"/><circle cx="160" cy="160" r="70"/><path d="M10 160h300M160 10v300"/></g><circle cx="160" cy="160" r="38" fill="var(--accent)"/><path d="M146 150h28v16a14 14 0 01-28 0z" fill="none" stroke="var(--accent-ink)" stroke-width="5" stroke-linecap="round"/><circle cx="238" cy="92" r="9" fill="var(--accent)"/><circle cx="84" cy="228" r="6" fill="var(--accent)" fill-opacity=".7"/></svg>`;
const MAP = `<svg viewBox="0 0 400 240" role="img" aria-hidden="true"><rect width="400" height="240" fill="#E6EDF2"/><rect x="250" y="20" width="120" height="80" rx="14" fill="#BFD9C9"/><g stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round"><path d="M-10 170C90 150 170 190 410 120"/><path d="M120 -10C140 80 100 150 130 250"/><path d="M-10 60H410" stroke-width="5"/><path d="M300 -10V250" stroke-width="5"/></g><g fill="none" stroke="currentColor" stroke-opacity=".25" style="color:var(--head)"><circle cx="200" cy="130" r="70"/><circle cx="200" cy="130" r="40"/></g><path d="M200 150s14-12 14-26a14 14 0 10-28 0c0 14 14 26 14 26z" style="fill:var(--head)"/><circle cx="200" cy="124" r="5.5" style="fill:var(--accent)"/></svg>`;

export function buildBody(doc, opts = {}) {
  const x = doc.text; const f = doc.flags;
  const cta = f.booking ? '#booking' : '#offer';
  let n = 0;
  const sec = (id, inner, cls = '') => `<section class="sec ${cls}" id="${id}" data-sec="${n++}"><div class="wrap">${inner}</div></section>`;
  const stars = '<span class="stars" aria-hidden="true">★★★★★</span>';
  const slots = (x.slots.length ? x.slots : ['14:00–15:00']).map((s) => `<option>${E(s)}</option>`).join('');
  const party = Array.from({ length: 12 }, (_, i) => `<option>${i + 1}</option>`).join('');
  const parts = [];
  parts.push(`<section class="hero ${doc.layout}" id="hero" data-sec="${n++}"><div class="wrap grid"><div><span class="badge">${E(x.badge)}</span><h1>${E(x.headline)}</h1><p class="sub">${E(x.sub)}</p><a class="btn" href="${cta}">${E(x.cta)}</a></div><div class="art" style="color:var(--hero-fg)">${ART}</div></div></section>`);
  parts.push(sec('services', `<p class="eyebrow">${E(x.location)}</p><h2>${E(x.servicesTitle)}</h2><div class="cards">${x.services.map((s, i) => `<div class="card"><span class="n">0${i + 1}</span><h3>${E(s.n)}</h3><p>${E(s.d)}</p></div>`).join('')}</div>`));
  parts.push(sec('offer', `<div class="offer"><div><p class="eyebrow">${E(x.offerLabel)}</p><h2>${E(x.offerTitle)}</h2><p>${E(x.offerText)}</p></div><a class="btn" href="${cta}">${E(x.cta)}</a></div>`, ''));
  if (f.reviews) parts.push(sec('reviews', `<h2>${E(x.reviewsTitle)}</h2><div class="pulse"><span class="score">${E(x.rating)}</span>${stars}<span class="eyebrow">${E(x.reviewsNote)}</span></div><div class="cards">${x.reviews.map((q) => `<div class="card"><p class="quote">“${E(q)}”</p></div>`).join('')}</div>`));
  if (f.location) parts.push(sec('location', `<div class="two"><div><h2>${E(x.locationTitle)}</h2><p style="color:var(--muted);margin-bottom:18px">${E(x.locationText)}</p><h3>${E(x.hoursTitle)}</h3><ul class="hours">${x.hours.map((h) => `<li>${E(h)}</li>`).join('')}</ul><p style="margin-top:14px"><strong>${E(x.contactTitle)}:</strong> ${E(x.contact)}</p></div><div class="map">${MAP}</div></div>`));
  parts.push(sec('faq', `<h2>${E(x.faqTitle)}</h2>${x.faq.map((q) => `<details><summary>${E(q.q)}</summary><p>${E(q.a)}</p></details>`).join('')}`));
  if (f.booking) parts.push(sec('booking', `<h2>${E(x.bookTitle)}</h2><form id="book" data-required="${E(x.bookRequired)}" novalidate><div class="fields" style="display:grid;gap:14px"><label>${E(x.bookName)}<input type="text" name="name" maxlength="60" autocomplete="off"></label><label>${E(x.bookParty)}<select name="party">${party}</select></label><label>${E(x.bookSlot)}<select name="slot">${slots}</select></label><label class="chk"><input type="checkbox" id="consent"><span>${E(x.bookConsent)}</span></label><p class="err" id="err" role="alert"></p><button class="btn" type="submit">${E(x.bookSubmit)}</button></div><div class="done" id="done" tabindex="-1" role="status">✓ ${E(x.bookDone)}</div></form>`));
  const head = `<header class="top"><div class="wrap"><a class="logo" href="#hero"><i></i>${E(x.brand)}</a><nav class="nav">${x.nav.map((l, i) => `<a href="#${['services', 'offer', 'location', 'faq'][i] || 'hero'}">${E(l)}</a>`).join('')}</nav><a class="btn" href="${cta}" style="min-height:40px;padding:0 16px">${E(x.cta)}</a></div></header>`;
  const temp = opts.temp ? `<div class="temp">${E(x.tempLabel)}</div>` : '';
  const soc = [x.social.instagram && `<a href="https://instagram.com/${E(x.social.instagram)}" target="_blank" rel="noopener noreferrer">Instagram @${E(x.social.instagram)}</a>`, x.social.tiktok && `<a href="https://tiktok.com/@${E(x.social.tiktok)}" target="_blank" rel="noopener noreferrer">TikTok @${E(x.social.tiktok)}</a>`, x.social.facebook && `<a href="https://facebook.com/${E(x.social.facebook)}" target="_blank" rel="noopener noreferrer">Facebook @${E(x.social.facebook)}</a>`].filter(Boolean).join(' · ');
  const foot = `<footer><div class="wrap"><span>${E(x.footer)}</span>${soc ? `<span class="soc">${soc}</span>` : ''}${x.demo ? `<span class="demo">${E(x.demo)}</span>` : ''}</div></footer>`;
  return `${temp}${head}${parts.join('')}${foot}`;
}

export function buildParts(doc, opts = {}) {
  const css = `${SITE_CSS}:root{--accent:${doc.accent};--accent-ink:${inkFor(doc.accent)}}`;
  return { css, js: SITE_JS, body: buildBody(doc, opts), sections: sectionList(doc) };
}

const FONTS = 'https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600&family=Fraunces:wght@500;600&family=Space+Grotesk:wght@400;500;600&display=swap';
const bodyClass = (doc, extra = '') => [`t-${doc.theme}`, `f-${doc.font}`, `r-${doc.radius}`, extra].join(' ').trim();

/** Complete standalone document (inline CSS + JS), used for iframe srcdoc and the public preview. */
export function buildDocument(doc, opts = {}) {
  const p = buildParts(doc, opts);
  const cls = bodyClass(doc, opts.present ? 'present' : '');
  return `<!doctype html><html lang="${doc.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${E(doc.text.brand)}</title><meta name="robots" content="noindex"><link rel="stylesheet" href="${FONTS}"><style>${p.css}</style></head><body class="${cls}">${p.body}<script>${p.js}<\/script></body></html>`;
}

/** Separate files for the ZIP export. */
export function buildExportFiles(doc) {
  const p = buildParts(doc);
  const html = `<!doctype html><html lang="${doc.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${E(doc.text.brand)}</title><link rel="stylesheet" href="${FONTS}"><link rel="stylesheet" href="style.css"></head><body class="${bodyClass(doc)}">${p.body}<script src="script.js"><\/script></body></html>`;
  return { 'index.html': html, 'style.css': p.css, 'script.js': p.js };
}
