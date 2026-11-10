// Website engine: document in, complete HTML page out. No imports, so the app (preview, download)
// and the server (hosted page at /s/<slug>) render exactly the same site.
// Safety: every string is escaped, every colour, URL, number and time validated. The script is one
// fixed string (settings travel in data-* attributes), so the hosted page can allow it by hash in its CSP.
// Accessibility: landmarks, one h1, skip link, labelled form, visible focus, reduced motion,
// text colours picked for contrast automatically, 48 px touch targets.

const E = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const S = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, n) : '');
const HEX = /^#[0-9a-fA-F]{6}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const handle = (v) => (typeof v === 'string' ? v.replace(/^@+/, '').replace(/[^A-Za-z0-9._]/g, '').slice(0, 30) : '');
const imgUrl = (v) => { const s = S(v, 600000); if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s)) return s; try { const u = new URL(s); return u.protocol === 'https:' || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(u.href) ? u.href : ''; } catch { return ''; } }; // http only for local testing
const httpsUrl = (v, n = 300) => { const s = S(v, n); try { const u = new URL(s); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
const phone = (v) => S(v, 30).replace(/[^\d+()\s.-]/g, '').trim();
const digits = (v) => S(v, 30).replace(/[^\d]/g, '');
const email = (v) => { const s = S(v, 120).trim(); return /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(s) ? s : ''; };
const coord = (v, max) => { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) && Math.abs(n) <= max ? Math.round(n * 1e6) / 1e6 : null; };
const arr = (a, n) => (Array.isArray(a) ? a.slice(0, n) : []);

/* ---------- design system ---------- */
export const FONT_PAIRS = {
  archivo: { h: "'Archivo', system-ui, sans-serif", b: "'Lexend', system-ui, sans-serif", q: 'family=Archivo:wdth,wght@112,700;112,800&family=Lexend:wght@400;500;600' , hw: 800 },
  playfair: { h: "'Playfair Display', Georgia, serif", b: "'Source Sans 3', system-ui, sans-serif", q: 'family=Playfair+Display:wght@600;700&family=Source+Sans+3:wght@400;500;600', hw: 700 },
  cormorant: { h: "'Cormorant Garamond', Georgia, serif", b: "'Montserrat', system-ui, sans-serif", q: 'family=Cormorant+Garamond:wght@600;700&family=Montserrat:wght@400;500;600', hw: 700 },
  grotesk: { h: "'Space Grotesk', system-ui, sans-serif", b: "'Inter', system-ui, sans-serif", q: 'family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600', hw: 700 },
  bebas: { h: "'Bebas Neue', Impact, sans-serif", b: "'Work Sans', system-ui, sans-serif", q: 'family=Bebas+Neue&family=Work+Sans:wght@400;500;600', hw: 400 },
  nunito: { h: "'Nunito', system-ui, sans-serif", b: "'Nunito', system-ui, sans-serif", q: 'family=Nunito:wght@400;600;800', hw: 800 },
  dmserif: { h: "'DM Serif Display', Georgia, serif", b: "'DM Sans', system-ui, sans-serif", q: 'family=DM+Serif+Display&family=DM+Sans:wght@400;500;700', hw: 400 },
  fraunces: { h: "'Fraunces', Georgia, serif", b: "'Lexend', system-ui, sans-serif", q: 'family=Fraunces:wght@600;700&family=Lexend:wght@400;500;600', hw: 700 },
};
export const FONTS_LIST = Object.keys(FONT_PAIRS);
export const RADII = ['sharp', 'soft', 'round'];
export const HERO_STYLES = ['split', 'centered', 'image', 'editorial'];
export const DENSITY = ['cozy', 'airy'];

/** Ready-made looks. Each one is a complete, accessible design; the owner can tweak every part. */
export const PRESETS = {
  bordeaux: { palette: { brand: '#6E1A33', accent: '#F1C84B', bg: '#FBF5F4', surface: '#FFFFFF', text: '#33121F' }, fonts: 'archivo', radius: 'soft', heroStyle: 'split' },
  bistro: { palette: { brand: '#1F3A2E', accent: '#D9A441', bg: '#F7F3EA', surface: '#FFFDF8', text: '#1E2A23' }, fonts: 'playfair', radius: 'soft', heroStyle: 'image' },
  minimal: { palette: { brand: '#111827', accent: '#2563EB', bg: '#FFFFFF', surface: '#F4F5F7', text: '#111827' }, fonts: 'grotesk', radius: 'sharp', heroStyle: 'centered' },
  salon: { palette: { brand: '#5B3A55', accent: '#E9B8BE', bg: '#FFF7F8', surface: '#FFFFFF', text: '#2E1F2C' }, fonts: 'cormorant', radius: 'round', heroStyle: 'editorial' },
  street: { palette: { brand: '#0F172A', accent: '#F97316', bg: '#FFF8F1', surface: '#FFFFFF', text: '#0F172A' }, fonts: 'bebas', radius: 'sharp', heroStyle: 'image' },
  fresh: { palette: { brand: '#0E7490', accent: '#FACC15', bg: '#F0FDFA', surface: '#FFFFFF', text: '#083344' }, fonts: 'nunito', radius: 'round', heroStyle: 'split' },
  night: { palette: { brand: '#F5C451', accent: '#F5C451', bg: '#0F1115', surface: '#191C22', text: '#F3F4F6' }, fonts: 'dmserif', radius: 'soft', heroStyle: 'image' },
  studio: { palette: { brand: '#3F3CBB', accent: '#FF8FA3', bg: '#F7F7FF', surface: '#FFFFFF', text: '#1B1A3A' }, fonts: 'fraunces', radius: 'round', heroStyle: 'centered' },
};
export const PRESET_LIST = Object.keys(PRESETS);

/* ---------- colour maths (WCAG 2.1) ---------- */
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const luminance = (hex) => { const [r, g, b] = rgb(hex).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const x = luminance(a); const y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** Black-ish or white text, whichever reads better on this colour. */
export const inkOn = (hex) => (contrast(hex, '#111111') >= contrast(hex, '#FFFFFF') ? '#111111' : '#FFFFFF');

/* ---------- sections ---------- */
export const SECTION_TYPES = ['hero', 'about', 'services', 'menu', 'gallery', 'offer', 'reviews', 'visit', 'faq', 'booking', 'contact'];
const DAY_OK = (d) => d && typeof d === 'object';

function normSection(x, i) {
  if (!x || typeof x !== 'object' || !SECTION_TYPES.includes(x.type)) return null;
  const base = { id: S(x.id, 24).replace(/[^a-z0-9-]/gi, '') || `${x.type}-${i}`, type: x.type, on: x.on !== false, title: S(x.title, 90) };
  const items = (a, n) => arr(a, n).map((it) => ({ n: S(it?.n, 80), d: S(it?.d, 300), price: S(it?.price, 24) })).filter((it) => it.n);
  switch (x.type) {
    case 'hero': return { ...base, headline: S(x.headline, 120), sub: S(x.sub, 280), cta: S(x.cta, 40), image: imgUrl(x.image), imageAlt: S(x.imageAlt, 160) };
    case 'about': return { ...base, text: S(x.text, 1600), image: imgUrl(x.image), imageAlt: S(x.imageAlt, 160) };
    case 'services': return { ...base, items: items(x.items, 12) };
    case 'menu': return { ...base, note: S(x.note, 200), groups: arr(x.groups, 8).map((g) => ({ name: S(g?.name, 60), items: items(g?.items, 24) })).filter((g) => g.name || g.items.length) };
    case 'gallery': return { ...base, images: arr(x.images, 12).map((g) => ({ url: imgUrl(g?.url), alt: S(g?.alt, 160) })).filter((g) => g.url) };
    case 'offer': return { ...base, label: S(x.label, 40), text: S(x.text, 400), until: S(x.until, 40) };
    case 'faq': return { ...base, items: arr(x.items, 10).map((f) => ({ q: S(f?.q, 160), a: S(f?.a, 600) })).filter((f) => f.q && f.a) };
    case 'booking': case 'contact': return { ...base, sub: S(x.sub, 240) };
    default: return base;
  }
}

/** Opening hours: 7 days, Monday first, up to two time ranges per day. */
export function normHours(h) {
  if (!Array.isArray(h) || h.length !== 7 || !h.every(DAY_OK)) return null;
  return h.map((d) => {
    const r = arr(d.r, 2).filter((x) => Array.isArray(x) && TIME.test(x[0]) && TIME.test(x[1])).map((x) => [x[0], x[1]]);
    return { closed: !!d.closed || !r.length, r };
  });
}

export function normalizeDoc(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const x = r.text && typeof r.text === 'object' ? r.text : {};
  const b = r.biz && typeof r.biz === 'object' ? r.biz : {};
  const d = r.design && typeof r.design === 'object' ? r.design : {};
  const preset = PRESETS[d.preset] ? d.preset : 'bordeaux';
  const pal = { ...PRESETS[preset].palette };
  for (const k of Object.keys(pal)) if (HEX.test(d.palette?.[k])) pal[k] = d.palette[k];
  const bk = r.booking && typeof r.booking === 'object' ? r.booking : {};
  const sections = arr(r.sections, 24).map(normSection).filter(Boolean);
  const seen = new Set(); sections.forEach((s, i) => { if (seen.has(s.id)) s.id = `${s.id}-${i}`; seen.add(s.id); });
  return {
    lang: ['ro', 'en', 'fr', 'de', 'hu'].includes(r.lang) ? r.lang : 'en',
    design: {
      preset, palette: pal,
      fonts: FONT_PAIRS[d.fonts] ? d.fonts : PRESETS[preset].fonts,
      radius: RADII.includes(d.radius) ? d.radius : PRESETS[preset].radius,
      heroStyle: HERO_STYLES.includes(d.heroStyle) ? d.heroStyle : PRESETS[preset].heroStyle,
      density: DENSITY.includes(d.density) ? d.density : 'cozy',
    },
    biz: {
      name: S(b.name, 80), kind: S(b.kind, 60), city: S(b.city, 80), address: S(b.address, 200),
      phone: phone(b.phone), whatsapp: digits(b.whatsapp), email: email(b.email),
      lat: coord(b.lat, 90), lng: coord(b.lng, 180), mapsUrl: httpsUrl(b.mapsUrl), reviewUrl: httpsUrl(b.reviewUrl),
      logo: imgUrl(b.logo),
      rating: (() => { const n = Number(b.rating); return Number.isFinite(n) && n > 0 && n <= 5 ? Math.round(n * 10) / 10 : null; })(),
      reviewCount: Math.max(0, Math.min(1e6, Math.round(Number(b.reviewCount) || 0))),
      hours: normHours(b.hours), hoursText: arr(b.hoursText, 7).map((h) => S(h, 90)).filter(Boolean), hoursNote: S(b.hoursNote, 160),
      reviews: arr(b.reviews, 6).map((v) => ({ text: S(v?.text, 420), author: S(v?.author, 60), rating: Math.max(1, Math.min(5, Math.round(Number(v?.rating) || 5))) })).filter((v) => v.text),
      social: { instagram: handle(b.social?.instagram), tiktok: handle(b.social?.tiktok), facebook: handle(b.social?.facebook) },
    },
    sections,
    booking: {
      askParty: !!bk.askParty, askDate: bk.askDate !== false, askTime: bk.askTime !== false, askService: !!bk.askService,
      services: arr(bk.services, 20).map((s) => S(s, 60)).filter(Boolean), note: S(bk.note, 240),
    },
    announcement: { on: !!r.announcement?.on && !!S(r.announcement?.text, 160), text: S(r.announcement?.text, 160) },
    seo: { title: S(r.seo?.title, 70), description: S(r.seo?.description, 170), image: imgUrl(r.seo?.image) },
    branding: r.branding !== false,
    text: Object.fromEntries(Object.entries(x).filter(([, v]) => typeof v === 'string' || Array.isArray(v)).slice(0, 120).map(([k, v]) => [S(k, 30), Array.isArray(v) ? v.slice(0, 7).map((y) => S(y, 40)) : S(v, 260)])),
  };
}

/** Sections that will actually show (switched on and with something to show). */
export function visibleSections(doc) {
  const b = doc.biz;
  return doc.sections.filter((s) => {
    if (!s.on) return false;
    if (s.type === 'reviews') return b.reviews.length > 0;
    if (s.type === 'services') return s.items.length > 0;
    if (s.type === 'menu') return s.groups.some((g) => g.items.length);
    if (s.type === 'gallery') return s.images.length > 0;
    if (s.type === 'offer') return !!(s.title && s.text);
    if (s.type === 'faq') return s.items.length > 0;
    if (s.type === 'about') return !!s.text;
    return true;
  });
}

/* ---------- styles ---------- */
function css(doc) {
  const d = doc.design; const p = d.palette; const f = FONT_PAIRS[d.fonts];
  const R = { sharp: ['6px', '8px'], soft: ['16px', '999px'], round: ['28px', '999px'] }[d.radius];
  const dark = luminance(p.bg) < 0.2;
  const muted = dark ? 'color-mix(in srgb, var(--text) 72%, var(--bg))' : 'color-mix(in srgb, var(--text) 74%, var(--bg))';
  const pad = d.density === 'airy' ? '96px' : '64px';
  return `:root{--brand:${p.brand};--brand-ink:${inkOn(p.brand)};--accent:${p.accent};--accent-ink:${inkOn(p.accent)};--bg:${p.bg};--surface:${p.surface};--text:${p.text};--muted:${muted};--line:color-mix(in srgb, var(--text) 14%, transparent);--r:${R[0]};--rb:${R[1]};--fh:${f.h};--fb:${f.b};--hw:${f.hw};--pad:${pad};--focus:${contrast(p.accent, p.bg) >= 3 ? 'var(--accent)' : 'var(--brand)'}}
*{box-sizing:border-box;margin:0}html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{font-family:var(--fb);background:var(--bg);color:var(--text);line-height:1.6;font-size:17px}
img{max-width:100%;display:block}
h1,h2,h3{font-family:var(--fh);font-weight:var(--hw);line-height:1.1;letter-spacing:-.01em;overflow-wrap:break-word}
h2{font-size:clamp(1.75rem,4.2vw,2.6rem);margin-bottom:22px}h3{font-size:1.2rem}
a{color:inherit}.wrap{max-width:1120px;margin:0 auto;padding:0 20px}
.skip{position:absolute;left:12px;top:-60px;background:var(--surface);color:var(--text);padding:12px 16px;border-radius:12px;z-index:50;font-weight:700}.skip:focus{top:12px}
:focus-visible,iframe:focus,input[type=date]:focus,input[type=time]:focus{outline:3px solid var(--focus);outline-offset:3px}
.ann{background:var(--accent);color:var(--accent-ink);text-align:center;padding:10px 16px;font-weight:600;font-size:.95rem}
.top{position:sticky;top:0;z-index:20;background:color-mix(in srgb, var(--bg) 88%, transparent);backdrop-filter:saturate(1.4) blur(10px);border-bottom:1px solid var(--line)}
.top .wrap{display:flex;align-items:center;gap:16px;min-height:68px}
.logo{display:flex;align-items:center;gap:10px;text-decoration:none;font-family:var(--fh);font-weight:var(--hw);font-size:1.2rem;min-width:0;margin-right:auto}
.logo img{height:40px;width:auto;max-width:140px;object-fit:contain}.logo span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.logo i{width:30px;height:30px;border-radius:50%;background:var(--brand);display:inline-grid;place-items:center;color:var(--brand-ink);font-style:normal;font-size:.9rem;flex:none}
.nav{display:flex;gap:20px;font-size:.95rem}.nav a{text-decoration:none;padding:8px 0;color:var(--muted)}.nav a:hover{color:var(--text)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:50px;padding:0 24px;border-radius:var(--rb);background:var(--brand);color:var(--brand-ink);text-decoration:none;border:2px solid var(--brand);font:inherit;font-weight:700;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease}
.btn:hover{transform:translateY(-1px);box-shadow:0 10px 24px -14px color-mix(in srgb, var(--brand) 80%, transparent)}.btn:active{transform:none}
.btn.alt{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
.btn.ghost{background:transparent;color:inherit;border-color:currentColor}
.top .btn{min-height:44px;padding:0 18px}
.status{display:inline-flex;align-items:center;gap:8px;font-size:.92rem;font-weight:600}
.status i{width:10px;height:10px;border-radius:50%;background:#9CA3AF;flex:none}.status.open i{background:#16A34A;box-shadow:0 0 0 4px rgba(22,163,74,.18)}.status.closed i{background:#DC2626}
/* hero */
.hero{position:relative;overflow:hidden;padding:clamp(48px,8vw,104px) 0}
.hero .grid{display:grid;grid-template-columns:1.1fr .9fr;gap:clamp(24px,5vw,64px);align-items:center}
.hero h1{font-size:clamp(2.4rem,7vw,4.6rem);max-width:15ch}
.hero .sub{font-size:clamp(1.05rem,2.2vw,1.25rem);color:var(--muted);max-width:46ch;margin:18px 0 28px}
.hero .acts{display:flex;gap:12px;flex-wrap:wrap}
.facts{display:flex;gap:10px 18px;flex-wrap:wrap;margin-top:28px;color:var(--muted);font-size:.95rem}
.facts span{display:inline-flex;gap:8px;align-items:center}
.stars{color:#E8A317;letter-spacing:1px}
.hero-img{border-radius:var(--r);overflow:hidden;aspect-ratio:4/5;background:var(--surface);box-shadow:0 30px 60px -36px rgba(0,0,0,.45)}
.hero-img img{width:100%;height:100%;object-fit:cover}
.hero-art{aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 30% 30%,var(--accent),transparent 62%),var(--brand);opacity:.95;max-width:420px;justify-self:center;width:100%}
.hero.centered .grid{grid-template-columns:1fr;text-align:center;justify-items:center}.hero.centered h1{max-width:20ch}.hero.centered .acts,.hero.centered .facts{justify-content:center}.hero.centered .hero-media{display:none}
.hero.editorial .grid{grid-template-columns:1fr}.hero.editorial h1{font-size:clamp(3rem,10vw,7rem);max-width:12ch}.hero.editorial .hero-media{display:none}
.hero.image{color:#fff;min-height:min(86vh,760px);display:flex;align-items:flex-end;background:var(--brand)}
.hero.image .bgimg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.hero.image::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05) 0%,rgba(0,0,0,.35) 45%,rgba(0,0,0,.78) 100%);z-index:1}
.hero.image .wrap{position:relative;z-index:2;width:100%}.hero.image .grid{grid-template-columns:1fr}.hero.image .hero-media{display:none}
.hero.image .sub,.hero.image .facts{color:rgba(255,255,255,.9)}.hero.image .btn.ghost{color:#fff}
.hero.image.noimg{color:var(--brand-ink)}.hero.image.noimg::before{display:none}.hero.image.noimg .sub,.hero.image.noimg .facts{color:var(--brand-ink);opacity:.85}.hero.image.noimg .btn{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}.hero.image.noimg .btn.ghost{background:transparent;color:var(--brand-ink);border-color:currentColor}
/* sections */
.sec{padding:var(--pad) 0}.sec.alt{background:var(--surface)}
.eyebrow{font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:10px;font-weight:600}
.lead{color:var(--muted);max-width:60ch;margin:-8px 0 26px;font-size:1.05rem}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:24px}.sec.alt .card{background:var(--bg)}
.card h3{margin-bottom:8px}.card p{color:var(--muted)}
.price{font-weight:700;color:var(--text);white-space:nowrap}
.svc-top{display:flex;justify-content:space-between;gap:12px;align-items:baseline}
.about{display:grid;grid-template-columns:1fr 1fr;gap:clamp(24px,5vw,56px);align-items:center}.about.noimg{grid-template-columns:1fr;max-width:760px}
.about p{white-space:pre-line;color:var(--muted);font-size:1.08rem}.about .img{border-radius:var(--r);overflow:hidden;aspect-ratio:4/3}.about .img img{width:100%;height:100%;object-fit:cover}
.menu{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:28px 48px}
.menu h3{font-size:1.35rem;margin-bottom:12px;padding-bottom:10px;border-bottom:2px solid var(--brand)}
.menu ul{list-style:none;padding:0;display:grid;gap:14px}
.mi{display:grid;grid-template-columns:1fr auto;gap:2px 12px}.mi .n{font-weight:600}.mi .dots{display:none}.mi small{grid-column:1/-1;color:var(--muted)}
.gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
.gal button{padding:0;border:0;background:none;cursor:zoom-in;border-radius:var(--r);overflow:hidden;aspect-ratio:1}
.gal img{width:100%;height:100%;object-fit:cover;transition:transform .35s ease}.gal button:hover img{transform:scale(1.04)}
dialog.lb{border:0;padding:0;background:transparent;max-width:min(96vw,1100px);max-height:92vh}dialog.lb::backdrop{background:rgba(0,0,0,.86)}
dialog.lb img{max-height:84vh;width:auto;margin:auto;border-radius:12px}dialog.lb p{color:#fff;text-align:center;margin-top:10px}
dialog.lb .x{position:fixed;top:14px;right:14px;width:48px;height:48px;border-radius:50%;border:0;background:#fff;color:#111;font-size:1.4rem;cursor:pointer}
.offer{background:var(--brand);color:var(--brand-ink);border-radius:var(--r);padding:clamp(28px,5vw,48px);display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center}
.offer h2{margin:6px 0 10px}.offer p{opacity:.9;max-width:56ch}.offer .eyebrow{color:inherit;opacity:.8}.offer .btn{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
.pulse{display:flex;gap:14px;align-items:center;margin-bottom:24px;flex-wrap:wrap}.score{font-family:var(--fh);font-size:3.2rem;line-height:1;font-weight:var(--hw)}
.rv blockquote{font-size:1.02rem}.rv figcaption{margin-top:14px;font-size:.9rem;color:var(--muted);font-weight:600}
.more{display:inline-flex;margin-top:22px;font-weight:700}
.visit{display:grid;grid-template-columns:1fr 1fr;gap:clamp(24px,4vw,48px);align-items:start}
address{font-style:normal;color:var(--muted);margin-bottom:20px;font-size:1.05rem}
.hours{list-style:none;padding:0;border-top:1px solid var(--line)}.hours li{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}
.hours li.today{font-weight:700}.hours .t{color:var(--muted);text-align:right}.hours li.today .t{color:var(--text)}
.note{margin-top:12px;color:var(--muted);font-size:.95rem}
.contact{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}
.map{border-radius:var(--r);overflow:hidden;border:1px solid var(--line);aspect-ratio:4/3;background:var(--surface)}.map iframe{border:0;width:100%;height:100%}
details{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:4px 20px;margin-bottom:10px}.sec.alt details{background:var(--bg)}
summary{cursor:pointer;font-weight:700;min-height:52px;display:flex;align-items:center;list-style:none;gap:12px}summary::-webkit-details-marker{display:none}
summary::after{content:"+";margin-left:auto;font-size:1.4rem;color:var(--muted)}details[open] summary::after{content:"−"}details p{padding:0 0 16px;color:var(--muted)}
.band{background:var(--brand);color:var(--brand-ink);border-radius:var(--r);padding:clamp(28px,5vw,48px);display:flex;justify-content:space-between;align-items:center;gap:24px;flex-wrap:wrap}
.band .btn{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}.band .btn.ghost{background:transparent;color:inherit;border-color:currentColor}
form{display:grid;gap:16px;background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:clamp(20px,4vw,32px);max-width:680px}.sec.alt form{background:var(--bg)}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
label{display:grid;gap:6px;font-weight:600;font-size:.95rem}
input,select,textarea{min-height:50px;border-radius:12px;border:1.5px solid color-mix(in srgb, var(--text) 30%, transparent);padding:10px 14px;font:inherit;background:var(--bg);color:var(--text);width:100%}
textarea{min-height:100px;resize:vertical}
.chk{display:flex;gap:12px;align-items:flex-start;font-weight:500;font-size:.92rem;color:var(--muted)}.chk input{width:24px;height:24px;min-height:0;margin-top:1px;accent-color:var(--brand);flex:none}
.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.done{display:none;border:2px solid #16A34A;border-radius:14px;padding:20px;font-weight:600}.done.show{display:block}
.err{color:#B91C1C;font-weight:600;min-height:1.4em}
footer{background:var(--brand);color:var(--brand-ink);padding:40px 0 28px;margin-top:0}
footer .wrap{display:grid;grid-template-columns:2fr 1fr 1fr;gap:24px}footer h2{font-size:1.3rem;margin-bottom:10px}footer p,footer a{opacity:.88}footer a{display:block;padding:6px 0;text-decoration:none}footer a:hover{opacity:1;text-decoration:underline}
.priv{max-width:62ch;background:none;border:0;border-radius:0;padding:0;margin:0}.priv summary{cursor:pointer;text-decoration:underline;text-underline-offset:3px;min-height:24px;color:inherit}.priv summary::after{content:none}.priv p{margin:8px 0 0;line-height:1.55}
.fine{max-width:1120px;margin:24px auto 0;padding:16px 20px 0;border-top:1px solid color-mix(in srgb, var(--brand-ink) 20%, transparent);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:.85rem;opacity:.8}
.callbar{display:none}
.wm{position:fixed;inset:0;pointer-events:none;z-index:60;background:repeating-linear-gradient(-30deg,transparent 0 140px,rgba(0,0,0,.035) 140px 141px)}
.wm-bar{position:fixed;left:0;right:0;bottom:0;z-index:61;background:#111;color:#fff;text-align:center;padding:12px 16px;font-weight:600;font-size:.92rem}
body.preview [data-sec]{cursor:pointer;outline-offset:-3px}body.preview [data-sec]:hover{outline:2px dashed var(--accent)}body.preview [data-sec].picked{outline:3px solid var(--accent)}
@media(prefers-reduced-motion:reduce){*,*::before{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
@media(max-width:860px){.nav{display:none}.hero .grid,.about,.visit,.offer,.row2,footer .wrap{grid-template-columns:1fr}.hero-media{display:none}.offer{text-align:left}
.callbar{display:flex;position:sticky;bottom:0;z-index:15;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:var(--surface);border-top:1px solid var(--line)}.callbar .btn{flex:1;min-height:48px;padding:0 10px}
body.has-wm .callbar{bottom:44px}}`;
}

// Fixed script (no per-site values): settings come from data-* attributes on <body>.
export const SITE_JS = `
(function(){
var B=document.body.dataset,api=B.api||'',slug=B.slug||'',preview=B.preview==='1',locked=B.locked==='1';
function send(o){if(!api||preview||locked)return Promise.reject();return fetch(api,{method:'POST',headers:{'content-type':'text/plain'},body:JSON.stringify(o),keepalive:true,mode:'cors'}).then(function(r){if(!r.ok)throw r;return r})}
if(api&&!preview)send({op:'hit',slug:slug,kind:'view'}).catch(function(){});
var L={};try{L=JSON.parse(B.l||'{}')}catch(e){}
function fill(s,v){return String(s||'').replace('{t}',v)}
/* opening hours: today's row and "open now" */
var H=null;try{H=JSON.parse(B.hours||'null')}catch(e){}
function mins(t){var p=t.split(':');return +p[0]*60+ +p[1]}
if(H&&H.length===7){var now=new Date(),di=(now.getDay()+6)%7,m=now.getHours()*60+now.getMinutes(),day=H[di],open=false,closeAt='',nextAt='';
document.querySelectorAll('.hours li').forEach(function(li,i){if(i===di)li.className='today'});
if(!day.closed)day.r.forEach(function(r){var a=mins(r[0]),b=mins(r[1]);if(b<=a)b+=1440;if(m>=a&&m<b){open=true;closeAt=r[1]}else if(!nextAt&&m<a)nextAt=r[0]});
if(!open&&!nextAt){for(var k=1;k<=7;k++){var d2=H[(di+k)%7];if(!d2.closed&&d2.r.length){nextAt=(L.days?L.days[(di+k)%7]+' ':'')+d2.r[0][0];break}}}
document.querySelectorAll('[data-status]').forEach(function(el){el.className='status '+(open?'open':'closed');el.innerHTML='<i></i>'+(open?(L.open||'Open')+(closeAt?' · '+fill(L.closes,closeAt):''):(L.closed||'Closed')+(nextAt?' · '+fill(L.opens,nextAt):''))})}
/* clicks on call / book / directions */
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('[data-track]');if(a&&!preview)send({op:'hit',slug:slug,kind:'click'}).catch(function(){})});
/* gallery lightbox */
var dlg=document.getElementById('lb');
if(dlg){var im=dlg.querySelector('img'),cap=dlg.querySelector('p'),list=[].slice.call(document.querySelectorAll('.gal button')),cur=0;
function show(i){cur=(i+list.length)%list.length;var g=list[cur].querySelector('img');im.src=g.getAttribute('data-full')||g.src;im.alt=g.alt;cap.textContent=g.alt}
list.forEach(function(b,i){b.addEventListener('click',function(){if(preview)return;show(i);dlg.showModal()})});
dlg.querySelector('.x').addEventListener('click',function(){dlg.close()});
dlg.addEventListener('click',function(e){if(e.target===dlg)dlg.close()});
dlg.addEventListener('keydown',function(e){if(e.key==='ArrowRight')show(cur+1);if(e.key==='ArrowLeft')show(cur-1)})}
/* the builder preview: click a section to edit it */
if(preview){document.body.classList.add('preview');
document.addEventListener('click',function(e){var s=e.target.closest('[data-sec]');if(!e.target.closest('form'))e.preventDefault();if(!s)return;
document.querySelectorAll('[data-sec].picked').forEach(function(x){x.classList.remove('picked')});s.classList.add('picked');try{parent.postMessage({lb:'pick',id:s.getAttribute('data-sec')},'*')}catch(x){}},true);
window.addEventListener('message',function(e){var m=e.data;if(!m||m.lb!=='goto')return;var el=document.querySelector('[data-sec="'+String(m.id).replace(/[^a-z0-9-]/gi,'')+'"]');if(el){el.scrollIntoView({block:'start',behavior:m.instant?'auto':'smooth'});document.querySelectorAll('[data-sec].picked').forEach(function(x){x.classList.remove('picked')});el.classList.add('picked')}})}
/* booking form */
var f=document.getElementById('book');if(!f)return;
var er=document.getElementById('err'),done=document.getElementById('done');
var dt=f.elements.date;if(dt){var t=new Date();dt.min=t.toISOString().slice(0,10)}
function times(){var sel=f.elements.time;if(!sel||sel.tagName!=='SELECT'||!H)return;var v=dt&&dt.value?new Date(dt.value+'T12:00'):new Date();var day=H[(v.getDay()+6)%7];sel.innerHTML='';
var o0=document.createElement('option');o0.value='';o0.textContent='—';sel.appendChild(o0);
if(day.closed){o0.textContent=L.closed||'Closed';return}
day.r.forEach(function(r){var a=mins(r[0]),b=mins(r[1]);if(b<=a)b+=1440;for(var x=a;x<=b-30;x+=30){var hh=Math.floor(x/60)%24,mm=x%60,s=(hh<10?'0':'')+hh+':'+(mm<10?'0':'')+mm;var o=document.createElement('option');o.value=o.textContent=s;sel.appendChild(o)}})}
if(dt)dt.addEventListener('change',times);times();
function finish(msg){f.querySelector('.fields').hidden=true;done.textContent='\\u2713 '+msg;done.classList.add('show');done.focus()}
function fallback(text){var wa=B.wa,mail=B.mail;if(wa){window.open('https://wa.me/'+wa+'?text='+encodeURIComponent(text),'_blank','noopener');return finish(f.getAttribute('data-done-app'))}
if(mail){location.href='mailto:'+mail+'?subject='+encodeURIComponent(document.title)+'&body='+encodeURIComponent(text);return finish(f.getAttribute('data-done-app'))}
er.textContent=f.getAttribute('data-fail')}
f.addEventListener('submit',function(e){e.preventDefault();var v=function(n){return(f.elements[n]&&f.elements[n].value||'').trim()};
if(v('website'))return;
if(locked){er.textContent=f.getAttribute('data-locked');return}
if(!v('name')||v('contact').length<5||!f.elements.consent.checked){er.textContent=f.getAttribute('data-required');(v('name')?f.elements.contact:f.elements.name).focus();return}er.textContent='';
var d={name:v('name'),contact:v('contact'),date:v('date'),time:v('time'),party:v('party'),service:v('service'),message:v('message')};
if(preview)return finish(f.getAttribute('data-preview'));
var text=f.getAttribute('data-intro')+'\\n'+d.name+' \\u00b7 '+d.contact+(d.date?'\\n'+d.date+' '+d.time:'')+(d.service?'\\n'+d.service:'')+(d.party?'\\n'+d.party:'')+(d.message?'\\n'+d.message:'');
var btn=f.querySelector('button[type=submit]'),label=btn.textContent;btn.disabled=true;btn.textContent=f.getAttribute('data-sending');
send({op:'request',slug:slug,name:d.name,contact:d.contact,date:d.date,time:d.time,party:d.party,message:(d.service?d.service+(d.message?' \\u00b7 ':''):'')+d.message,consent:true})
.then(function(){finish(f.getAttribute('data-done'))}).catch(function(){btn.disabled=false;btn.textContent=label;fallback(text)})});
})();
`;

/* ---------- markup ---------- */
const stars = (n) => `<span class="stars" aria-hidden="true">${'★'.repeat(Math.round(n))}${'☆'.repeat(5 - Math.round(n))}</span>`;
const dirUrl = (b) => b.mapsUrl || (b.lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}` : b.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.name} ${b.address}`)}` : '');
const mapEmbed = (b, title) => {
  if (b.lat == null || b.lng == null) return '';
  const d = 0.006; const bbox = [b.lng - d, b.lat - d * 0.6, b.lng + d, b.lat + d * 0.6].map((n) => n.toFixed(5)).join('%2C');
  return `<div class="map"><iframe title="${E(title)}" loading="lazy" referrerpolicy="no-referrer" src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&amp;layer=mapnik&amp;marker=${b.lat}%2C${b.lng}"></iframe></div>`;
};
const dayNames = (lang) => { try { const f = new Intl.DateTimeFormat(lang, { weekday: 'long' }); return [1, 2, 3, 4, 5, 6, 7].map((i) => { const s = f.format(new Date(Date.UTC(2024, 0, i, 12))); return s.charAt(0).toUpperCase() + s.slice(1); }); } catch { return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; } };
const hoursRows = (doc) => {
  const b = doc.biz; const x = doc.text;
  if (b.hours) { const names = dayNames(doc.lang); return b.hours.map((d, i) => `<li><span>${E(names[i])}</span><span class="t">${d.closed ? E(x.closed || 'Closed') : d.r.map((r) => `${r[0]}–${r[1]}`).join(', ')}</span></li>`).join(''); }
  return b.hoursText.map((h) => { const k = h.indexOf(':'); return k > 0 && k < 20 ? `<li><span>${E(h.slice(0, k))}</span><span class="t">${E(h.slice(k + 1).trim())}</span></li>` : `<li><span>${E(h)}</span></li>`; }).join('');
};

export function buildBody(doc, opts = {}) {
  const x = doc.text; const b = doc.biz; const bk = doc.booking;
  const secs = visibleSections(doc);
  const has = (t) => secs.some((s) => s.type === t);
  const bookSec = secs.find((s) => s.type === 'booking');
  const tel = b.phone ? `tel:${E(b.phone.replace(/[\s().-]/g, ''))}` : '';
  const wa = b.whatsapp ? `https://wa.me/${E(b.whatsapp)}` : '';
  const dir = dirUrl(b);
  const cta = bookSec ? `#${bookSec.id}` : tel || wa || '#visit';
  const status = b.hours ? '<span class="status" data-status><i></i></span>' : '';
  let alt = false;
  const wrapSec = (s, inner, cls = '') => { alt = !alt; return `<section class="sec ${alt ? 'alt' : ''} ${cls}" id="${E(s.id)}" data-sec="${E(s.id)}" aria-labelledby="h-${E(s.id)}">${inner}</section>`; };
  const h2 = (s, fallback) => `<h2 id="h-${E(s.id)}">${E(s.title || fallback)}</h2>`;
  const parts = []; let h1Done = false;
  for (const s of secs) {
    if (s.type === 'hero') {
      const bg = s.image ? `<img class="bgimg" src="${E(s.image)}" alt="${E(s.imageAlt)}" fetchpriority="high">` : '';
      const media = s.image ? `<div class="hero-img"><img src="${E(s.image)}" alt="${E(s.imageAlt)}"></div>` : '<div class="hero-art" aria-hidden="true"></div>';
      const facts = [status, b.rating ? `<span>${stars(b.rating)} <b>${E(String(b.rating))}</b> · ${E(String(b.reviewCount))} Google</span>` : '', b.address ? `<span>${E(b.address.split(',').slice(0, 2).join(','))}</span>` : ''].filter(Boolean).join('');
      const style = doc.design.heroStyle;
      parts.push(`<section class="hero ${style} ${style === 'image' && !s.image ? 'noimg' : ''}" id="${E(s.id)}" data-sec="${E(s.id)}">${style === 'image' ? bg : ''}<div class="wrap grid"><div>
        ${b.kind || b.city ? `<p class="eyebrow">${E([b.kind, b.city].filter(Boolean).join(' · '))}</p>` : ''}<h1>${E(s.headline || b.name)}</h1>${s.sub ? `<p class="sub">${E(s.sub)}</p>` : ''}
        <div class="acts"><a class="btn ${style === 'image' ? 'alt' : ''}" href="${cta}" data-track="cta">${E(s.cta || x.cta || 'Book')}</a>${tel ? `<a class="btn ghost" href="${tel}" data-track="call">${E(x.call || 'Call')}</a>` : ''}</div>
        ${facts ? `<div class="facts">${facts}</div>` : ''}</div><div class="hero-media">${media}</div></div></section>`);
      h1Done = true;
    }
    if (s.type === 'about') parts.push(wrapSec(s, `<div class="wrap about ${s.image ? '' : 'noimg'}"><div>${h2(s, x.aboutTitle)}<p>${E(s.text)}</p></div>${s.image ? `<div class="img"><img src="${E(s.image)}" alt="${E(s.imageAlt)}" loading="lazy"></div>` : ''}</div>`));
    if (s.type === 'services') parts.push(wrapSec(s, `<div class="wrap">${h2(s, x.servicesTitle)}<div class="cards">${s.items.map((it) => `<div class="card"><div class="svc-top"><h3>${E(it.n)}</h3>${it.price ? `<span class="price">${E(it.price)}</span>` : ''}</div>${it.d ? `<p>${E(it.d)}</p>` : ''}</div>`).join('')}</div></div>`));
    if (s.type === 'menu') parts.push(wrapSec(s, `<div class="wrap">${h2(s, x.menuTitle)}${s.note ? `<p class="lead">${E(s.note)}</p>` : ''}<div class="menu">${s.groups.filter((g) => g.items.length).map((g) => `<div>${g.name ? `<h3>${E(g.name)}</h3>` : ''}<ul>${g.items.map((it) => `<li class="mi"><span class="n">${E(it.n)}</span><span class="price">${E(it.price)}</span>${it.d ? `<small>${E(it.d)}</small>` : ''}</li>`).join('')}</ul></div>`).join('')}</div></div>`));
    if (s.type === 'gallery') parts.push(wrapSec(s, `<div class="wrap">${h2(s, x.galleryTitle)}<div class="gal">${s.images.map((g) => `<button type="button" aria-label="${E(x.enlarge || 'Enlarge')}: ${E(g.alt || b.name)}"><img src="${E(g.url)}" alt="${E(g.alt || b.name)}" loading="lazy"></button>`).join('')}</div></div>
      <dialog class="lb" id="lb" aria-label="${E(x.galleryTitle || 'Photos')}"><button class="x" type="button" aria-label="${E(x.close || 'Close')}">×</button><img alt=""><p></p></dialog>`));
    if (s.type === 'offer') parts.push(wrapSec(s, `<div class="wrap"><div class="offer"><div>${s.label ? `<p class="eyebrow">${E(s.label)}</p>` : ''}<h2 id="h-${E(s.id)}">${E(s.title)}</h2><p>${E(s.text)}</p>${s.until ? `<p class="note" style="color:inherit;opacity:.85">${E(s.until)}</p>` : ''}</div><a class="btn" href="${cta}" data-track="offer">${E(x.cta || 'Book')}</a></div></div>`));
    if (s.type === 'reviews') parts.push(wrapSec(s, `<div class="wrap">${h2(s, x.reviewsTitle)}${b.rating ? `<div class="pulse"><span class="score">${E(String(b.rating))}</span>${stars(b.rating)}<span>${E(String(b.reviewCount))} ${E(x.reviewsOn || 'Google reviews')}</span></div>` : ''}
      <div class="cards">${b.reviews.map((v) => `<figure class="card rv">${stars(v.rating)}<blockquote><p>“${E(v.text.length > 320 ? `${v.text.slice(0, 317)}…` : v.text)}”</p></blockquote><figcaption>${E(v.author)} · Google</figcaption></figure>`).join('')}</div>
      <div class="contact">${b.mapsUrl ? `<a class="btn ghost" href="${E(b.mapsUrl)}" target="_blank" rel="noopener noreferrer">${E(x.reviewsAll || 'All reviews')}</a>` : ''}${b.reviewUrl ? `<a class="btn" href="${E(b.reviewUrl)}" target="_blank" rel="noopener noreferrer">${E(x.writeReview || 'Write a review')}</a>` : ''}</div></div>`));
    if (s.type === 'visit') {
      const contact = [dir && `<a class="btn" href="${E(dir)}" target="_blank" rel="noopener noreferrer" data-track="directions">${E(x.directions || 'Directions')}</a>`, tel && `<a class="btn ghost" href="${tel}" data-track="call">${E(b.phone)}</a>`, wa && `<a class="btn ghost" href="${wa}" target="_blank" rel="noopener noreferrer" data-track="whatsapp">WhatsApp</a>`, b.email && `<a class="btn ghost" href="mailto:${E(b.email)}" data-track="email">${E(b.email)}</a>`].filter(Boolean).join('');
      const rows = hoursRows(doc);
      parts.push(wrapSec(s, `<div class="wrap visit"><div>${h2(s, x.visitTitle)}${b.address ? `<address>${E(b.name)}<br>${E(b.address)}</address>` : ''}
        ${rows ? `<h3 style="margin-bottom:8px">${E(x.hoursTitle || 'Opening hours')} ${status}</h3><ul class="hours">${rows}</ul>` : ''}${b.hoursNote ? `<p class="note">${E(b.hoursNote)}</p>` : ''}
        ${contact ? `<div class="contact">${contact}</div>` : ''}</div>${mapEmbed(b, x.mapTitle || 'Map')}</div>`));
    }
    if (s.type === 'faq') parts.push(wrapSec(s, `<div class="wrap" style="max-width:860px">${h2(s, x.faqTitle)}${s.items.map((q) => `<details><summary>${E(q.q)}</summary><p>${E(q.a)}</p></details>`).join('')}</div>`));
    if (s.type === 'contact') parts.push(wrapSec(s, `<div class="wrap"><div class="band"><div><h2 id="h-${E(s.id)}" style="margin-bottom:6px">${E(s.title || x.contactTitle)}</h2>${s.sub ? `<p>${E(s.sub)}</p>` : ''}</div><div class="contact" style="margin:0">${tel ? `<a class="btn" href="${tel}" data-track="call">${E(x.call || 'Call')}</a>` : ''}${wa ? `<a class="btn ghost" href="${wa}" target="_blank" rel="noopener noreferrer" data-track="whatsapp">WhatsApp</a>` : ''}${dir ? `<a class="btn ghost" href="${E(dir)}" target="_blank" rel="noopener noreferrer" data-track="directions">${E(x.directions || 'Directions')}</a>` : ''}</div></div></div>`));
    if (s.type === 'booking') {
      const party = Array.from({ length: 20 }, (_, i) => `<option>${i + 1}</option>`).join('');
      const svc = bk.services.map((o) => `<option>${E(o)}</option>`).join('');
      parts.push(wrapSec(s, `<div class="wrap">${h2(s, x.bookTitle)}${s.sub ? `<p class="lead">${E(s.sub)}</p>` : ''}
      <form id="book" novalidate aria-describedby="err" data-required="${E(x.bookRequired)}" data-done="${E(x.bookDone)}" data-done-app="${E(x.bookDoneApp)}" data-fail="${E(x.bookFail)}" data-preview="${E(x.bookPreview)}" data-sending="${E(x.bookSending)}" data-intro="${E(x.bookIntro)}" data-locked="${E(x.locked)}"><div class="fields" style="display:grid;gap:16px">
        <div class="row2"><label>${E(x.bookName)}<input name="name" maxlength="80" autocomplete="name" required aria-required="true"></label><label>${E(x.bookContact)}<input name="contact" maxlength="120" autocomplete="tel" inputmode="tel" required aria-required="true"></label></div>
        ${bk.askService && svc ? `<label>${E(x.bookService)}<select name="service"><option value="">—</option>${svc}</select></label>` : ''}
        ${bk.askDate || bk.askTime ? `<div class="row2">${bk.askDate ? `<label>${E(x.bookDate)}<input type="date" name="date"></label>` : ''}${bk.askTime ? (b.hours ? `<label>${E(x.bookTime)}<select name="time"><option value="">—</option></select></label>` : `<label>${E(x.bookTime)}<input type="time" name="time" step="900"></label>`) : ''}</div>` : ''}
        ${bk.askParty ? `<label>${E(x.bookParty)}<select name="party">${party}</select></label>` : ''}
        <label>${E(x.bookMsg)}<textarea name="message" maxlength="600"></textarea></label>
        <label class="hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
        <label class="chk"><input type="checkbox" name="consent"><span>${E(x.bookConsent)}</span></label>${bk.note ? `<p class="note">${E(bk.note)}</p>` : ''}
        <p class="err" id="err" role="alert" aria-live="assertive"></p><button class="btn" type="submit">${E(x.bookSubmit)}</button></div>
        <div class="done" id="done" tabindex="-1" role="status"></div></form></div>`));
    }
  }
  if (!h1Done) parts.unshift(`<h1 class="skip" style="position:absolute;left:-9999px;top:auto">${E(b.name)}</h1>`);
  const NAV = { services: 'navServices', menu: 'navMenu', gallery: 'navGallery', reviews: 'navReviews', visit: 'navVisit', faq: 'navFaq' };
  const nav = secs.filter((s) => NAV[s.type]).slice(0, 5).map((s) => `<a href="#${E(s.id)}">${E(s.title || x[NAV[s.type]] || s.type)}</a>`).join('');
  const logo = b.logo ? `<img src="${E(b.logo)}" alt="${E(b.name)}">` : `<i aria-hidden="true">${E((b.name || '?').slice(0, 1).toUpperCase())}</i><span>${E(b.name)}</span>`;
  const head = `<a class="skip" href="#main">${E(x.skip || 'Skip to content')}</a>${doc.announcement.on ? `<div class="ann" role="note">${E(doc.announcement.text)}</div>` : ''}
    <header class="top"><div class="wrap"><a class="logo" href="#main">${logo}</a><nav class="nav" aria-label="${E(x.navLabel || 'Main')}">${nav}</nav><a class="btn" href="${cta}" data-track="cta">${E(x.cta || 'Book')}</a></div></header>`;
  const soc = [b.social.instagram && `<a href="https://instagram.com/${E(b.social.instagram)}" target="_blank" rel="noopener noreferrer">Instagram</a>`, b.social.facebook && `<a href="https://facebook.com/${E(b.social.facebook)}" target="_blank" rel="noopener noreferrer">Facebook</a>`, b.social.tiktok && `<a href="https://tiktok.com/@${E(b.social.tiktok)}" target="_blank" rel="noopener noreferrer">TikTok</a>`].filter(Boolean).join('');
  const reach = [tel && `<a href="${tel}">${E(b.phone)}</a>`, wa && `<a href="${wa}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`, b.email && `<a href="mailto:${E(b.email)}">${E(b.email)}</a>`, dir && `<a href="${E(dir)}" target="_blank" rel="noopener noreferrer">${E(x.directions || 'Directions')}</a>`].filter(Boolean).join('');
  // Privacy notice for visitors (GDPR art. 13): the business is the controller of booking requests, Arcton Ai processes them for it.
  const pContact = b.email || b.phone || '';
  const privacy = x.privacyText ? `<details class="priv"><summary>${E(x.privacyTitle || 'Privacy')}</summary><p>${E(String(x.privacyText).replace(/\{biz\}/g, b.name).replace(/\{contact\}/g, pContact))}</p></details>` : '';
  const foot = `<footer><div class="wrap"><div><h2>${E(b.name)}</h2>${b.address ? `<p>${E(b.address)}</p>` : ''}</div><div>${reach ? `<p style="font-weight:700;margin-bottom:4px">${E(x.contactTitle || 'Contact')}</p>${reach}` : ''}</div><div>${soc ? `<p style="font-weight:700;margin-bottom:4px">${E(x.followTitle || 'Follow')}</p>${soc}` : ''}</div></div>
    <div class="fine"><span>© ${new Date().getFullYear()} ${E(b.name)}</span>${privacy}${doc.branding ? `<span>${E(x.madeWith || 'Made with Arcton Ai')}</span>` : ''}</div></footer>`;
  const callbar = tel || wa || bookSec ? `<div class="callbar">${tel ? `<a class="btn ghost" href="${tel}" data-track="call">${E(x.call || 'Call')}</a>` : ''}${bookSec ? `<a class="btn" href="#${E(bookSec.id)}" data-track="cta">${E(x.cta || 'Book')}</a>` : wa ? `<a class="btn" href="${wa}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ''}</div>` : '';
  const wm = opts.watermark ? `<div class="wm" aria-hidden="true"></div><div class="wm-bar" role="note">${E(opts.watermark)}</div>` : '';
  return `${head}<main id="main" tabindex="-1">${parts.join('')}</main>${foot}${callbar}${wm}`;
}

function jsonLd(doc, url) {
  const b = doc.biz;
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const hours = b.hours ? b.hours.flatMap((d, i) => (d.closed ? [] : d.r.map((r) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: days[i], opens: r[0], closes: r[1] })))) : undefined;
  const img = doc.sections.find((s) => s.type === 'hero')?.image;
  const ld = { '@context': 'https://schema.org', '@type': 'LocalBusiness', name: b.name, url: url || undefined, image: img && !img.startsWith('data:') ? img : undefined, address: b.address || undefined, telephone: b.phone || undefined, email: b.email || undefined,
    geo: b.lat != null ? { '@type': 'GeoCoordinates', latitude: b.lat, longitude: b.lng } : undefined, openingHoursSpecification: hours?.length ? hours : undefined,
    aggregateRating: b.rating ? { '@type': 'AggregateRating', ratingValue: b.rating, reviewCount: b.reviewCount } : undefined,
    sameAs: [b.social.instagram && `https://instagram.com/${b.social.instagram}`, b.social.facebook && `https://facebook.com/${b.social.facebook}`, b.social.tiktok && `https://tiktok.com/@${b.social.tiktok}`].filter(Boolean) };
  return JSON.stringify(ld).replace(/</g, '\\u003c');
}

/**
 * Complete standalone page.
 * opts.api + opts.slug: booking requests and visit counts go to that endpoint (hosted, or downloaded after publishing).
 * opts.preview: the builder preview (click a section to edit it; the form sends nothing).
 * opts.watermark: text of the "preview only" bar (plans without publishing); the form is locked.
 * opts.url: canonical address of the published page.
 */
export function buildDocument(doc, opts = {}) {
  const b = doc.biz; const x = doc.text;
  const hero = doc.sections.find((s) => s.type === 'hero');
  const title = doc.seo.title || [b.name, b.kind && b.city ? `${b.kind}, ${b.city}` : b.city].filter(Boolean).join(' · ');
  const desc = doc.seo.description || [hero?.sub, b.address].filter(Boolean).join(' · ').slice(0, 160);
  const ogImg = doc.seo.image || hero?.image || '';
  const labels = JSON.stringify({ open: x.openNow || 'Open now', closes: x.closesAt || 'until {t}', closed: x.closed || 'Closed', opens: x.opensAt || 'opens {t}', days: (() => { const n = dayNames(doc.lang); return n.map((d) => d.slice(0, 3)); })() });
  const data = [opts.api && !opts.watermark ? `data-api="${E(opts.api)}"` : '', opts.slug ? `data-slug="${E(opts.slug)}"` : '', opts.preview ? 'data-preview="1"' : '', opts.watermark ? 'data-locked="1"' : '',
    b.whatsapp ? `data-wa="${E(b.whatsapp)}"` : '', b.email ? `data-mail="${E(b.email)}"` : '', b.hours ? `data-hours="${E(JSON.stringify(b.hours))}"` : '', `data-l="${E(labels)}"`].filter(Boolean).join(' ');
  const font = `${opts.fontBase || ''}/fonts/g/site-${doc.design.fonts}.css`; // served by Arcton, never by Google: no visitor IP leaves for a font
  return `<!doctype html><html lang="${doc.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${E(title)}</title>
${desc ? `<meta name="description" content="${E(desc)}">` : ''}<meta name="theme-color" content="${doc.design.palette.brand}">${opts.url ? `<link rel="canonical" href="${E(opts.url)}">` : ''}
<meta property="og:type" content="website"><meta property="og:title" content="${E(title)}">${desc ? `<meta property="og:description" content="${E(desc)}">` : ''}${ogImg && !ogImg.startsWith('data:') ? `<meta property="og:image" content="${E(ogImg)}"><meta name="twitter:card" content="summary_large_image">` : ''}${opts.url ? `<meta property="og:url" content="${E(opts.url)}">` : ''}
${opts.preview || opts.watermark ? '<meta name="robots" content="noindex">' : ''}<link rel="stylesheet" href="${font}"><style>${css(doc)}</style><script type="application/ld+json">${jsonLd(doc, opts.url)}</script></head>
<body ${data} class="${opts.watermark ? 'has-wm' : ''}">${buildBody(doc, opts)}<script>${SITE_JS}</script></body></html>`;
}

/* ---------- accessibility and quality check (used by the builder) ---------- */
/** Returns a list of { level: 'error' | 'warn', key, vars } and a 0-100 score. Keys are translated by the app. */
export function auditDoc(doc) {
  const out = []; const p = doc.design.palette; const b = doc.biz;
  const tc = contrast(p.text, p.bg); if (tc < 4.5) out.push({ level: 'error', key: 'textContrast', vars: { r: tc.toFixed(1) } });
  const sc = contrast(p.text, p.surface); if (sc < 4.5) out.push({ level: 'error', key: 'surfaceContrast', vars: { r: sc.toFixed(1) } });
  const secs = visibleSections(doc);
  const imgs = secs.flatMap((s) => (s.type === 'gallery' ? s.images.map((g) => g.alt) : s.image ? [s.imageAlt] : []));
  const missing = imgs.filter((a) => !a || a.length < 3).length; if (missing) out.push({ level: 'error', key: 'altText', vars: { n: missing } });
  if (!secs.some((s) => s.type === 'hero')) out.push({ level: 'warn', key: 'noHero' });
  if (!b.phone && !b.whatsapp && !b.email) out.push({ level: 'error', key: 'noContact' });
  if (!secs.some((s) => s.type === 'booking') && !b.phone) out.push({ level: 'warn', key: 'noBooking' });
  if (!b.hours && !b.hoursText.length) out.push({ level: 'warn', key: 'noHours' });
  if (!b.address) out.push({ level: 'warn', key: 'noAddress' });
  if (!doc.seo.description && !(doc.sections.find((s) => s.type === 'hero')?.sub)) out.push({ level: 'warn', key: 'noDescription' });
  if (!secs.some((s) => s.image || s.type === 'gallery')) out.push({ level: 'warn', key: 'noPhotos' });
  if (b.rating == null) out.push({ level: 'warn', key: 'noReviews' });
  const errs = out.filter((o) => o.level === 'error').length; const warns = out.length - errs;
  return { items: out, score: Math.max(0, 100 - errs * 18 - warns * 6) };
}
