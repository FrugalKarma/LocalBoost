// Pure website generator: document config in, HTML/CSS/JS out. No imports, so the app (preview,
// download) and the server (hosted page at /s/<slug>) render exactly the same site.
// Every string is escaped and every colour, URL and number validated, so a site cannot inject markup.
// The script is a fixed string (no per-site values inside), so the hosted page can allow it by hash in its CSP.

const E = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const S = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, n) : '');
const HEX = /^#[0-9a-fA-F]{6}$/;
const handle = (v) => (typeof v === 'string' ? v.replace(/^@+/, '').replace(/[^A-Za-z0-9._]/g, '').slice(0, 30) : '');
const httpsUrl = (v, n = 300) => { const s = S(v, n); try { const u = new URL(s); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
const phone = (v) => S(v, 30).replace(/[^\d+()\s.-]/g, '').trim();
const digits = (v) => S(v, 30).replace(/[^\d]/g, '');
const email = (v) => { const s = S(v, 120).trim(); return /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(s) ? s : ''; };
const coord = (v, max) => { const n = Number(v); return Number.isFinite(n) && Math.abs(n) <= max ? Math.round(n * 1e6) / 1e6 : null; };

export const THEMES = ['burgundy', 'ocean', 'forest', 'sunset', 'lavender', 'mono', 'cream', 'night'];
export const THEME_ACCENT = { burgundy: '#F1C84B', ocean: '#F59E0B', forest: '#E9C46A', sunset: '#FDBA74', lavender: '#FDE68A', mono: '#FACC15', cream: '#C2410C', night: '#38BDF8' };
export const LAYOUTS = ['split', 'centered', 'editorial'];
export const FONTS_LIST = ['lexend', 'serif', 'grotesk'];
export const RADII = ['soft', 'sharp', 'round'];
const inkFor = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#10151C' : '#FFFFFF'; };

export function normalizeDoc(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const x = r.text && typeof r.text === 'object' ? r.text : {};
  const b = r.biz && typeof r.biz === 'object' ? r.biz : {};
  const arr = (a, n) => (Array.isArray(a) ? a.slice(0, n) : []);
  return {
    lang: ['ro', 'en', 'fr', 'de', 'hu'].includes(r.lang) ? r.lang : 'en',
    theme: THEMES.includes(r.theme) ? r.theme : 'burgundy',
    accent: HEX.test(r.accent) ? r.accent : '#F1C84B',
    font: FONTS_LIST.includes(r.font) ? r.font : 'lexend',
    radius: RADII.includes(r.radius) ? r.radius : 'soft',
    layout: LAYOUTS.includes(r.layout) ? r.layout : 'split',
    flags: { booking: r.flags?.booking !== false, reviews: r.flags?.reviews !== false, location: r.flags?.location !== false, offer: r.flags?.offer !== false, party: !!r.flags?.party },
    biz: {
      name: S(b.name, 80), kind: S(b.kind, 60), city: S(b.city, 80), address: S(b.address, 200),
      phone: phone(b.phone), whatsapp: digits(b.whatsapp), email: email(b.email),
      lat: coord(b.lat, 90), lng: coord(b.lng, 180), mapsUrl: httpsUrl(b.mapsUrl),
      rating: (() => { const n = Number(b.rating); return Number.isFinite(n) && n > 0 && n <= 5 ? Math.round(n * 10) / 10 : null; })(),
      reviewCount: Math.max(0, Math.min(1e6, Math.round(Number(b.reviewCount) || 0))),
      hours: arr(b.hours, 7).map((h) => S(h, 90)).filter(Boolean),
      reviews: arr(b.reviews, 3).map((v) => ({ text: S(v?.text, 420), author: S(v?.author, 60), rating: Math.max(1, Math.min(5, Math.round(Number(v?.rating) || 5))) })).filter((v) => v.text),
      social: { instagram: handle(b.social?.instagram), tiktok: handle(b.social?.tiktok), facebook: handle(b.social?.facebook) },
    },
    text: {
      headline: S(x.headline, 120), sub: S(x.sub, 260), cta: S(x.cta, 40), badge: S(x.badge, 80),
      servicesTitle: S(x.servicesTitle, 60), services: arr(x.services, 6).map((s) => ({ n: S(s?.n, 60), d: S(s?.d, 200) })).filter((s) => s.n),
      offerLabel: S(x.offerLabel, 40), offerTitle: S(x.offerTitle, 90), offerText: S(x.offerText, 320),
      reviewsTitle: S(x.reviewsTitle, 60), reviewsOn: S(x.reviewsOn, 80), reviewsAll: S(x.reviewsAll, 60),
      visitTitle: S(x.visitTitle, 60), hoursTitle: S(x.hoursTitle, 60), today: S(x.today, 30), directions: S(x.directions, 40), call: S(x.call, 30), whatsapp: S(x.whatsapp, 30), emailLabel: S(x.emailLabel, 30),
      faqTitle: S(x.faqTitle, 60), faq: arr(x.faq, 6).map((f) => ({ q: S(f?.q, 140), a: S(f?.a, 400) })).filter((f) => f.q && f.a),
      bookTitle: S(x.bookTitle, 70), bookSub: S(x.bookSub, 200), bookName: S(x.bookName, 40), bookContact: S(x.bookContact, 50), bookDate: S(x.bookDate, 30), bookTime: S(x.bookTime, 30),
      bookParty: S(x.bookParty, 40), bookMsg: S(x.bookMsg, 50), bookConsent: S(x.bookConsent, 220), bookSubmit: S(x.bookSubmit, 40), bookSending: S(x.bookSending, 40),
      bookDone: S(x.bookDone, 220), bookDoneApp: S(x.bookDoneApp, 220), bookRequired: S(x.bookRequired, 120), bookFail: S(x.bookFail, 200), bookPreview: S(x.bookPreview, 200), bookIntro: S(x.bookIntro, 120),
      nav: arr(x.nav, 5).map((n) => S(n, 30)), footer: S(x.footer, 80), madeWith: S(x.madeWith, 60),
    },
  };
}

export function sectionList(doc) {
  const f = doc.flags; const b = doc.biz;
  return ['hero', doc.text.services.length && 'services', f.offer && doc.text.offerTitle && 'offer', f.reviews && b.reviews.length && 'reviews', f.location && 'visit', doc.text.faq.length && 'faq', f.booking && 'booking'].filter(Boolean);
}

export const SITE_CSS = `
*{box-sizing:border-box;margin:0}html{scroll-behavior:smooth}
:root{--accent:#F1C84B;--accent-ink:#10151C;--r:16px;--rb:999px;--fh:Lexend,system-ui,sans-serif;--fb:Lexend,system-ui,sans-serif;--ok:#2E7D57;
--hero-bg:#6E1A33;--hero-fg:#FFF6F2;--hero-muted:rgba(255,246,242,.8);--page:#FBF5F4;--fg:#33121F;--muted:#6E4B56;--card:#fff;--head:#4E1426;--line:rgba(110,26,51,.15)}
body.t-ocean{--hero-bg:#0B2A4A;--hero-fg:#F4F8FB;--hero-muted:rgba(244,248,251,.8);--page:#F4F8FB;--fg:#10202F;--muted:#4A5B6C;--head:#0B2A4A;--line:rgba(11,42,74,.16)}
body.t-forest{--hero-bg:#16372B;--hero-fg:#F3F7F1;--hero-muted:rgba(243,247,241,.8);--page:#F5F7F2;--fg:#17261F;--muted:#4C5E54;--head:#16372B;--line:rgba(22,55,43,.16)}
body.t-sunset{--hero-bg:#7C2D12;--hero-fg:#FFF4E8;--hero-muted:rgba(255,244,232,.82);--page:#FFF7ED;--fg:#2B1A10;--muted:#6B4A39;--head:#7C2D12;--line:rgba(124,45,18,.18)}
body.t-lavender{--hero-bg:#3B2A6B;--hero-fg:#F7F5FF;--hero-muted:rgba(247,245,255,.82);--page:#F7F5FF;--fg:#1D1633;--muted:#575070;--head:#3B2A6B;--line:rgba(59,42,107,.16)}
body.t-mono{--hero-bg:#111;--hero-fg:#fff;--hero-muted:rgba(255,255,255,.78);--page:#FAFAFA;--fg:#111;--muted:#555;--head:#111;--line:rgba(0,0,0,.14)}
body.t-cream{--hero-bg:#F1EADB;--hero-fg:#2B2118;--hero-muted:#5E5446;--page:#FFFBF3;--fg:#2B2118;--muted:#6B6154;--head:#2B2118;--line:rgba(43,33,24,.15)}
body.t-night{--hero-bg:#0E1116;--hero-fg:#F1F5F9;--hero-muted:rgba(241,245,249,.78);--page:#14181F;--fg:#F1F5F9;--muted:#A9B4C2;--card:#1C222B;--head:#F1F5F9;--line:rgba(241,245,249,.16)}
body.f-serif{--fh:Fraunces,Georgia,serif}body.f-grotesk{--fh:'Space Grotesk',system-ui,sans-serif;--fb:'Space Grotesk',system-ui,sans-serif}
body.r-sharp{--r:4px;--rb:4px}body.r-round{--r:28px;--rb:999px}
body{font-family:var(--fb);background:var(--page);color:var(--fg);line-height:1.55;font-size:17px;-webkit-text-size-adjust:100%}
h1,h2,h3{font-family:var(--fh);font-weight:600;line-height:1.12;color:var(--head)}
a{color:inherit}.wrap{max-width:1080px;margin:0 auto;padding:0 20px}
.top{position:sticky;top:0;z-index:5;background:var(--hero-bg);color:var(--hero-fg);border-bottom:1px solid rgba(255,255,255,.12)}
.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:62px}
.logo{font-family:var(--fh);font-weight:700;font-size:1.12rem;display:flex;gap:10px;align-items:center;text-decoration:none;min-width:0}
.logo span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.logo i{width:26px;height:26px;border-radius:50%;border:3px solid var(--accent);display:inline-block;position:relative;flex:none}
.logo i:after{content:"";position:absolute;inset:5px;border-radius:50%;background:var(--accent)}
.nav{display:flex;gap:22px;font-size:.92rem}.nav a{text-decoration:none;opacity:.86}.nav a:hover{opacity:1;text-decoration:underline}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 22px;border-radius:var(--rb);background:var(--accent);color:var(--accent-ink);text-decoration:none;border:2px solid transparent;cursor:pointer;font:inherit;font-weight:700;transition:transform .12s}
.btn.ghost{background:transparent;color:inherit;border-color:currentColor}
.btn:active{transform:scale(.97)}.btn:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible,a:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.top .btn{min-height:40px;padding:0 16px;flex:none}
.hero{background:var(--hero-bg);color:var(--hero-fg);position:relative;overflow:hidden;padding:56px 0 60px}
.hero h1{color:var(--hero-fg);font-size:clamp(2.1rem,6vw,3.8rem);max-width:16ch;overflow-wrap:break-word}
.hero p.sub{color:var(--hero-muted);font-size:1.12rem;max-width:48ch;margin:16px 0 24px}
.hero .acts{display:flex;gap:10px;flex-wrap:wrap}
.facts{display:flex;gap:10px;flex-wrap:wrap;margin-top:26px;font-size:.92rem}
.facts span{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18)}
body.t-cream .facts span{background:rgba(0,0,0,.05);border-color:rgba(0,0,0,.12)}
.badge{display:inline-flex;gap:8px;align-items:center;font-size:.78rem;letter-spacing:.06em;text-transform:uppercase;padding:6px 12px;border-radius:999px;border:1px solid currentColor;margin-bottom:18px}
.badge:before{content:"";width:8px;height:8px;border-radius:50%;background:var(--accent)}
.hero .grid{display:grid;grid-template-columns:1.25fr .75fr;gap:30px;align-items:center}
.hero.centered .grid{grid-template-columns:1fr;text-align:center;justify-items:center}.hero.centered h1{max-width:20ch}.hero.centered .art{display:none}.hero.centered .acts,.hero.centered .facts{justify-content:center}
.hero.editorial .grid{grid-template-columns:1fr}.hero.editorial h1{font-size:clamp(2.4rem,8vw,5.4rem);max-width:13ch}.hero.editorial .art{position:absolute;right:-60px;top:20px;width:340px;opacity:.25}
.art svg{width:100%;height:auto;display:block}
.sec{padding:60px 0}.sec h2{font-size:clamp(1.6rem,4vw,2.3rem);margin-bottom:22px}
.eyebrow{font-size:.78rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:8px}
.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:22px}
.card h3{font-size:1.18rem;margin-bottom:6px}.card p{color:var(--muted);font-size:.98rem}
.offer{background:var(--hero-bg);color:var(--hero-fg);border-radius:var(--r);padding:32px;display:grid;grid-template-columns:1fr auto;gap:22px;align-items:center;border:2px dashed var(--accent)}
.offer h2{color:var(--hero-fg);margin:6px 0 10px}.offer p{color:var(--hero-muted);max-width:52ch}.offer .eyebrow{color:var(--accent)}
.pulse{display:flex;gap:14px;align-items:center;margin-bottom:20px;flex-wrap:wrap}.score{font-family:var(--fh);font-size:3rem;color:var(--head);line-height:1}
.stars{color:#E8A317;letter-spacing:2px}.rv p{color:var(--fg)}.rv .who{margin-top:12px;font-size:.88rem;color:var(--muted);font-weight:600}
.more{margin-top:18px;display:inline-block;font-weight:600}
.two{display:grid;grid-template-columns:1fr 1fr;gap:22px;align-items:start}
.map{border-radius:var(--r);overflow:hidden;border:1px solid var(--line);background:#E6EDF2;aspect-ratio:4/3}.map iframe{border:0;width:100%;height:100%;display:block}
.hours{padding:0}.hours li{list-style:none;padding:9px 0;border-bottom:1px solid var(--line);font-size:.96rem}.hours li.now{font-weight:700;color:var(--head)}
.contact{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.contact .btn{background:var(--card);color:var(--head);border-color:var(--line)}
address{font-style:normal;color:var(--muted);margin-bottom:18px}
details{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin-bottom:10px}summary{cursor:pointer;font-weight:700;min-height:28px}details p{margin-top:8px;color:var(--muted)}
form{display:grid;gap:14px;background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:24px;max-width:620px}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
label{display:grid;gap:6px;font-weight:600;font-size:.92rem}
input,select,textarea{min-height:48px;border-radius:12px;border:1.5px solid var(--line);padding:10px 14px;font:inherit;background:var(--page);color:var(--fg);width:100%}
textarea{min-height:90px;resize:vertical}
.chk{display:flex;gap:10px;align-items:flex-start;font-weight:500;font-size:.88rem;color:var(--muted)}.chk input{width:22px;height:22px;min-height:0;margin-top:2px;accent-color:var(--head);flex:none}
.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.done{display:none;background:rgba(46,125,87,.12);border:1.5px solid var(--ok);border-radius:14px;padding:18px;font-weight:600;color:var(--fg)}.done.show{display:block;animation:pop .25s ease}
.err{color:#B3261E;font-size:.9rem;min-height:1.2em}body.t-night .err{color:#FFB4A9}
.lead{color:var(--muted);margin:-10px 0 20px;max-width:56ch}
footer{background:var(--hero-bg);color:var(--hero-fg);padding:28px 0;font-size:.9rem}footer .wrap{display:flex;gap:12px;justify-content:space-between;flex-wrap:wrap;align-items:center}
.soc{display:flex;gap:14px;flex-wrap:wrap}.made{opacity:.7;font-size:.8rem}
.callbar{display:none}
@keyframes pop{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
@media(max-width:820px){.nav{display:none}.hero .grid,.two{grid-template-columns:1fr}.cards{grid-template-columns:1fr}.offer{grid-template-columns:1fr}.art{display:none}.sec{padding:44px 0}.row2{grid-template-columns:1fr}
.callbar{display:flex;position:sticky;bottom:0;z-index:5;gap:8px;padding:10px 12px;background:var(--card);border-top:1px solid var(--line)}.callbar a{flex:1;min-height:46px}}
`;

// Fixed script (no per-site values): settings come from data-* attributes on <body>.
export const SITE_JS = `
(function(){
var B=document.body.dataset,api=B.api||'',slug=B.slug||'',preview=B.preview==='1';
function send(o){if(!api||preview)return Promise.reject();return fetch(api,{method:'POST',headers:{'content-type':'text/plain'},body:JSON.stringify(o),keepalive:true,mode:'cors'}).then(function(r){if(!r.ok)throw r;return r})}
if(api&&!preview){send({op:'hit',slug:slug,kind:'view'}).catch(function(){})}
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('[data-track]');if(a)send({op:'hit',slug:slug,kind:'click'}).catch(function(){})});
var days=document.querySelectorAll('.hours li');if(days.length===7){var i=(new Date().getDay()+6)%7;days[i].className='now';var t=document.getElementById('today');if(t){t.textContent=days[i].textContent}}
var f=document.getElementById('book');if(!f)return;
var er=document.getElementById('err'),done=document.getElementById('done');
function finish(msg){f.querySelector('.fields').style.display='none';done.textContent='\\u2713 '+msg;done.classList.add('show');done.focus()}
function fallback(text){var wa=B.wa,mail=B.mail;if(wa){window.open('https://wa.me/'+wa+'?text='+encodeURIComponent(text),'_blank','noopener');return finish(f.getAttribute('data-done-app'))}
if(mail){location.href='mailto:'+mail+'?subject='+encodeURIComponent(document.title)+'&body='+encodeURIComponent(text);return finish(f.getAttribute('data-done-app'))}
er.textContent=f.getAttribute('data-fail')}
f.addEventListener('submit',function(e){e.preventDefault();var v=function(n){return(f.elements[n]&&f.elements[n].value||'').trim()};
if(v('website'))return;
if(!v('name')||!v('contact')||!f.elements.consent.checked){er.textContent=f.getAttribute('data-required');return}er.textContent='';
var d={name:v('name'),contact:v('contact'),date:v('date'),time:v('time'),party:v('party'),message:v('message')};
if(preview)return finish(f.getAttribute('data-preview'));
var text=f.getAttribute('data-intro')+'\\n'+d.name+' \\u00b7 '+d.contact+(d.date?'\\n'+d.date+' '+d.time:'')+(d.party?'\\n'+d.party:'')+(d.message?'\\n'+d.message:'');
var btn=f.querySelector('button[type=submit]'),label=btn.textContent;btn.disabled=true;btn.textContent=f.getAttribute('data-sending');
send({op:'request',slug:slug,name:d.name,contact:d.contact,date:d.date,time:d.time,party:d.party,message:d.message,consent:true})
.then(function(){finish(f.getAttribute('data-done'))}).catch(function(){btn.disabled=false;btn.textContent=label;fallback(text)})});
})();
`;

const ART = `<svg viewBox="0 0 320 320" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-opacity=".35"><circle cx="160" cy="160" r="150"/><circle cx="160" cy="160" r="110"/><circle cx="160" cy="160" r="70"/><path d="M10 160h300M160 10v300"/></g><circle cx="160" cy="160" r="38" fill="var(--accent)"/><path d="M160 186s-20-17-20-34a20 20 0 0140 0c0 17-20 34-20 34z" fill="var(--accent-ink)"/><circle cx="160" cy="152" r="7" fill="var(--accent)"/></svg>`;

const stars = (n) => `<span class="stars" aria-hidden="true">${'★'.repeat(Math.round(n))}${'☆'.repeat(5 - Math.round(n))}</span>`;
const mapEmbed = (b) => {
  if (b.lat == null || b.lng == null) return '';
  const d = 0.006; const bbox = [b.lng - d, b.lat - d * 0.6, b.lng + d, b.lat + d * 0.6].map((n) => n.toFixed(5)).join('%2C');
  return `<div class="map"><iframe title="Map" loading="lazy" referrerpolicy="no-referrer" src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&amp;layer=mapnik&amp;marker=${b.lat}%2C${b.lng}"></iframe></div>`;
};
const dirUrl = (b) => b.mapsUrl || (b.lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}` : b.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.name} ${b.address}`)}` : '');

export function buildBody(doc) {
  const x = doc.text; const f = doc.flags; const b = doc.biz;
  const secs = sectionList(doc);
  const cta = secs.includes('booking') ? '#booking' : b.phone ? `tel:${E(b.phone.replace(/\s/g, ''))}` : '#visit';
  let n = 0;
  const sec = (id, inner) => `<section class="sec" id="${id}" data-sec="${n++}"><div class="wrap">${inner}</div></section>`;
  const tel = b.phone ? `tel:${E(b.phone.replace(/\s/g, ''))}` : '';
  const wa = b.whatsapp ? `https://wa.me/${E(b.whatsapp)}` : '';
  const dir = dirUrl(b);
  const parts = [];
  const facts = [b.rating ? `<span>${stars(b.rating)} ${E(String(b.rating))} · ${E(String(b.reviewCount))} Google</span>` : '', b.hours.length === 7 ? `<span>${E(x.today)}: <b id="today">…</b></span>` : '', b.address ? `<span>${E(b.address.split(',')[0])}</span>` : ''].filter(Boolean).join('');
  parts.push(`<section class="hero ${doc.layout}" id="hero" data-sec="${n++}"><div class="wrap grid"><div>${x.badge ? `<span class="badge">${E(x.badge)}</span>` : ''}<h1>${E(x.headline || b.name)}</h1>${x.sub ? `<p class="sub">${E(x.sub)}</p>` : ''}
    <div class="acts"><a class="btn" href="${cta}" data-track="cta">${E(x.cta)}</a>${tel ? `<a class="btn ghost" href="${tel}" data-track="call">${E(x.call)}</a>` : ''}</div>${facts ? `<div class="facts">${facts}</div>` : ''}</div><div class="art" style="color:var(--hero-fg)">${ART}</div></div></section>`);
  if (secs.includes('services')) parts.push(sec('services', `<p class="eyebrow">${E(b.kind)}${b.city ? ` · ${E(b.city)}` : ''}</p><h2>${E(x.servicesTitle)}</h2><div class="cards">${x.services.map((s) => `<div class="card"><h3>${E(s.n)}</h3>${s.d ? `<p>${E(s.d)}</p>` : ''}</div>`).join('')}</div>`));
  if (secs.includes('offer')) parts.push(sec('offer', `<div class="offer"><div><p class="eyebrow">${E(x.offerLabel)}</p><h2>${E(x.offerTitle)}</h2><p>${E(x.offerText)}</p></div><a class="btn" href="${cta}" data-track="offer">${E(x.cta)}</a></div>`));
  if (secs.includes('reviews')) parts.push(sec('reviews', `<h2>${E(x.reviewsTitle)}</h2>${b.rating ? `<div class="pulse"><span class="score">${E(String(b.rating))}</span>${stars(b.rating)}<span class="eyebrow" style="margin:0">${E(x.reviewsOn)}</span></div>` : ''}
    <div class="cards">${b.reviews.map((v) => `<figure class="card rv">${stars(v.rating)}<p>“${E(v.text.length > 300 ? `${v.text.slice(0, 297)}…` : v.text)}”</p><figcaption class="who">${E(v.author)} · Google</figcaption></figure>`).join('')}</div>${b.mapsUrl ? `<a class="more" href="${E(b.mapsUrl)}" target="_blank" rel="noopener noreferrer">${E(x.reviewsAll)} →</a>` : ''}`));
  if (secs.includes('visit')) {
    const contact = [dir && `<a class="btn" href="${E(dir)}" target="_blank" rel="noopener noreferrer" data-track="directions">${E(x.directions)}</a>`, tel && `<a class="btn" href="${tel}" data-track="call">${E(x.call)} ${E(b.phone)}</a>`, wa && `<a class="btn" href="${wa}" target="_blank" rel="noopener noreferrer" data-track="whatsapp">${E(x.whatsapp)}</a>`, b.email && `<a class="btn" href="mailto:${E(b.email)}" data-track="email">${E(x.emailLabel)}</a>`].filter(Boolean).join('');
    parts.push(sec('visit', `<div class="two"><div><h2>${E(x.visitTitle)}</h2>${b.address ? `<address>${E(b.name)}<br>${E(b.address)}</address>` : ''}${b.hours.length ? `<h3>${E(x.hoursTitle)}</h3><ul class="hours">${b.hours.map((h) => `<li>${E(h)}</li>`).join('')}</ul>` : ''}${contact ? `<div class="contact">${contact}</div>` : ''}</div>${mapEmbed(b)}</div>`));
  }
  if (secs.includes('faq')) parts.push(sec('faq', `<h2>${E(x.faqTitle)}</h2>${x.faq.map((q) => `<details><summary>${E(q.q)}</summary><p>${E(q.a)}</p></details>`).join('')}`));
  if (secs.includes('booking')) {
    const party = Array.from({ length: 12 }, (_, i) => `<option>${i + 1}</option>`).join('');
    parts.push(sec('booking', `<h2>${E(x.bookTitle)}</h2>${x.bookSub ? `<p class="lead">${E(x.bookSub)}</p>` : ''}<form id="book" novalidate data-required="${E(x.bookRequired)}" data-done="${E(x.bookDone)}" data-done-app="${E(x.bookDoneApp)}" data-fail="${E(x.bookFail)}" data-preview="${E(x.bookPreview)}" data-sending="${E(x.bookSending)}" data-intro="${E(x.bookIntro)}"><div class="fields" style="display:grid;gap:14px">
      <div class="row2"><label>${E(x.bookName)}<input name="name" maxlength="80" autocomplete="name" required></label><label>${E(x.bookContact)}<input name="contact" maxlength="120" autocomplete="tel" inputmode="tel" required></label></div>
      <div class="row2"><label>${E(x.bookDate)}<input type="date" name="date"></label><label>${E(x.bookTime)}<input type="time" name="time" step="900"></label></div>
      ${f.party ? `<label>${E(x.bookParty)}<select name="party">${party}</select></label>` : ''}
      <label>${E(x.bookMsg)}<textarea name="message" maxlength="600"></textarea></label>
      <label class="hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
      <label class="chk"><input type="checkbox" name="consent"><span>${E(x.bookConsent)}</span></label><p class="err" id="err" role="alert"></p><button class="btn" type="submit">${E(x.bookSubmit)}</button></div><div class="done" id="done" tabindex="-1" role="status"></div></form>`));
  }
  const navIds = ['services', 'reviews', 'visit', 'faq', 'booking'];
  const nav = navIds.map((id, i) => (secs.includes(id) && x.nav[i] ? `<a href="#${id}">${E(x.nav[i])}</a>` : '')).join('');
  const head = `<header class="top"><div class="wrap"><a class="logo" href="#hero"><i></i><span>${E(b.name)}</span></a><nav class="nav">${nav}</nav><a class="btn" href="${cta}" data-track="cta">${E(x.cta)}</a></div></header>`;
  const soc = [b.social.instagram && `<a href="https://instagram.com/${E(b.social.instagram)}" target="_blank" rel="noopener noreferrer">Instagram</a>`, b.social.facebook && `<a href="https://facebook.com/${E(b.social.facebook)}" target="_blank" rel="noopener noreferrer">Facebook</a>`, b.social.tiktok && `<a href="https://tiktok.com/@${E(b.social.tiktok)}" target="_blank" rel="noopener noreferrer">TikTok</a>`].filter(Boolean).join('');
  const callbar = tel || wa ? `<div class="callbar">${tel ? `<a class="btn" href="${tel}" data-track="call">${E(x.call)}</a>` : ''}${wa ? `<a class="btn ghost" href="${wa}" target="_blank" rel="noopener noreferrer" data-track="whatsapp" style="color:var(--head)">${E(x.whatsapp)}</a>` : ''}</div>` : '';
  const foot = `<footer><div class="wrap"><span>© ${new Date().getFullYear()} ${E(b.name)}${x.footer ? ` · ${E(x.footer)}` : ''}</span>${soc ? `<span class="soc">${soc}</span>` : ''}${x.madeWith ? `<span class="made">${E(x.madeWith)}</span>` : ''}</div></footer>`;
  return `${head}<main>${parts.join('')}</main>${foot}${callbar}`;
}

const FONTS = 'https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&family=Fraunces:wght@500;600&family=Space+Grotesk:wght@400;500;600&display=swap';
const bodyClass = (doc) => [`t-${doc.theme}`, `f-${doc.font}`, `r-${doc.radius}`].join(' ');
const css = (doc) => `${SITE_CSS}:root{--accent:${doc.accent};--accent-ink:${inkFor(doc.accent)}}`;

/**
 * Complete standalone page.
 * opts.api + opts.slug: booking requests and visit counts go to that endpoint (hosted or downloaded after publishing).
 * opts.preview: the in-app preview; the form explains that nothing was sent.
 */
export function buildDocument(doc, opts = {}) {
  const b = doc.biz;
  const data = [opts.api ? `data-api="${E(opts.api)}"` : '', opts.slug ? `data-slug="${E(opts.slug)}"` : '', opts.preview ? 'data-preview="1"' : '', b.whatsapp ? `data-wa="${E(b.whatsapp)}"` : '', b.email ? `data-mail="${E(b.email)}"` : ''].filter(Boolean).join(' ');
  const desc = [doc.text.sub, b.address].filter(Boolean).join(' · ').slice(0, 160);
  const ld = { '@context': 'https://schema.org', '@type': 'LocalBusiness', name: b.name, address: b.address || undefined, telephone: b.phone || undefined, email: b.email || undefined,
    geo: b.lat != null ? { '@type': 'GeoCoordinates', latitude: b.lat, longitude: b.lng } : undefined,
    aggregateRating: b.rating ? { '@type': 'AggregateRating', ratingValue: b.rating, reviewCount: b.reviewCount } : undefined };
  const ldJson = JSON.stringify(ld).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="${doc.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${E(b.name)}${b.city ? ` · ${E(b.city)}` : ''}</title>${desc ? `<meta name="description" content="${E(desc)}">` : ''}<meta property="og:title" content="${E(b.name)}">${desc ? `<meta property="og:description" content="${E(desc)}">` : ''}${opts.preview ? '<meta name="robots" content="noindex">' : ''}<link rel="stylesheet" href="${FONTS}"><style>${css(doc)}</style><script type="application/ld+json">${ldJson}</script></head><body class="${bodyClass(doc)}" ${data}>${buildBody(doc)}<script>${SITE_JS}</script></body></html>`;
}
