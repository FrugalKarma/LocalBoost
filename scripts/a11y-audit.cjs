// Accessibility audit (WCAG 2.2 AA basics) with Playwright, no network needed. Run against local servers:
// launch page on :5190 (maintenance on), front page on :5183 (accounts on), app on :5184 (accounts off).
// Checks: control names, input labels, alt text, contrast, keyboard reach + visible focus, lang/title/h1/main,
// clickable non-buttons, 24px targets, focus inside aria-hidden, reflow at 320 px.  usage: node scripts/a11y-audit.cjs
const { chromium } = require('playwright'); const fs = require('fs');
const PAGES = [
  ['launch', 'http://localhost:5190/', {}],
  ['landing', 'http://localhost:5183/', {}],
  ['signin', 'http://localhost:5183/', { act: async (p) => { await p.click('[data-land="signin"]'); await p.waitForTimeout(800); } }],
  ...['overview', 'signals', 'diagnosis', 'competitors', 'proof', 'mission', 'website', 'pack', 'plans', 'settings', 'info'].map((r) => [r, `http://localhost:5184/#/${r}`, { example: true }]),
  ['trail-map', 'http://localhost:5184/#/overview', { example: true, phoneOnly: true, act: async (p) => { await p.click('[data-act="trail-open"]'); await p.waitForTimeout(600); } }],
];

const inPage = () => {
  const out = [];
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !e.closest('[aria-hidden="true"],[hidden],[inert]'); };
  const sel = (e) => { let s = e.tagName.toLowerCase(); if (e.id) s += '#' + e.id; const c = [...e.classList].slice(0, 2).join('.'); if (c) s += '.' + c; const a = e.getAttribute('data-act'); if (a) s += `[data-act=${a}]`; return s; };
  const name = (e) => { const lb = e.getAttribute('aria-labelledby'); if (lb) return lb.split(' ').map((i) => document.getElementById(i)?.textContent || '').join(' ').trim();
    return (e.getAttribute('aria-label') || e.innerText || e.getAttribute('title') || [...e.querySelectorAll('img[alt]')].map((i) => i.alt).join(' ') || e.value || '').trim(); };
  const add = (rule, e, extra = '') => out.push({ rule, el: sel(e), text: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 50), extra });
  // document
  if (!document.documentElement.lang) out.push({ rule: 'html-lang', el: 'html' });
  if (!document.title.trim()) out.push({ rule: 'title', el: 'title' });
  const h1 = [...document.querySelectorAll('h1')].filter(vis); if (h1.length !== 1) out.push({ rule: 'one-h1', el: 'h1', extra: `found ${h1.length}` });
  let last = 0; for (const h of [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(vis)) { const n = +h.tagName[1]; if (last && n > last + 1) add('heading-skip', h, `h${last}→h${n}`); last = n; }
  if (!document.querySelector('main, [role=main]')) out.push({ rule: 'landmark-main', el: 'main' });
  // names
  for (const e of document.querySelectorAll('button, a[href], [role=button], [role=link], [role=tab], summary')) if (vis(e) && !name(e)) add('control-name', e);
  for (const e of document.querySelectorAll('input:not([type=hidden]), select, textarea')) {
    if (!vis(e) || e.tabIndex < 0) continue;
    const ok = e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || (e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`)) || e.closest('label') || e.title;
    if (!ok) add('input-label', e, e.placeholder ? `placeholder only: ${e.placeholder}` : '');
  }
  for (const e of document.querySelectorAll('img')) if (vis(e) && !e.hasAttribute('alt')) add('img-alt', e, e.src.slice(-40));
  for (const e of document.querySelectorAll('svg')) if (vis(e) && !e.closest('[aria-hidden="true"]') && e.getAttribute('aria-hidden') !== 'true' && !e.getAttribute('aria-label') && !e.querySelector('title') && e.getAttribute('role') !== 'presentation' && !e.closest('button,a') && e.getBoundingClientRect().width > 24) add('svg-name', e);
  // clickable things that are not controls
  for (const e of document.querySelectorAll('[data-act]')) if (vis(e) && !e.matches('button, a[href], input, select, textarea, summary, [role=button], [role=link], [role=tab], [role=menuitem], [role=option], [tabindex]')) add('click-not-control', e);
  // focusable inside aria-hidden
  for (const e of document.querySelectorAll('[aria-hidden="true"] a[href], [aria-hidden="true"] button, [aria-hidden="true"] input, [aria-hidden="true"] [tabindex]:not([tabindex="-1"])')) if (e.tabIndex >= 0) add('focus-in-hidden', e);
  // target size (WCAG 2.2: 24 x 24) for controls that are not inline text links
  for (const e of document.querySelectorAll('button, [role=button], input[type=checkbox], input[type=radio], select, a.btn, .icon-btn')) { if (!vis(e)) continue; const r = e.getBoundingClientRect(); if (r.width < 24 || r.height < 24) add('target-size', e, `${Math.round(r.width)}x${Math.round(r.height)}`); }
  // contrast
  const rgb = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v[3] ?? 1 }; };
  const lum = ({ r, g, b }) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const blend = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const bgOf = (e) => { const stack = []; let n = e; while (n && n.nodeType === 1) { const s = getComputedStyle(n); if (s.backgroundImage && s.backgroundImage !== 'none' && !s.backgroundImage.startsWith('url')) return null; const c = rgb(s.backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; } n = n.parentElement; }
    let base = stack.length && stack[stack.length - 1].a >= 1 ? stack.pop() : rgb(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 }; while (stack.length) base = blend(stack.pop(), base); return base; };
  const seen = new Set();
  for (const e of document.querySelectorAll('body *')) {
    if (!vis(e) || ['SCRIPT', 'STYLE', 'SVG', 'PATH'].includes(e.tagName) || e.closest('svg')) continue;
    const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1); if (!own) continue;
    const s = getComputedStyle(e); const fg = rgb(s.color); if (!fg) continue; const bg = bgOf(e); if (!bg) continue;
    const c = blend({ ...fg, a: fg.a * Number(s.opacity) }, bg); const L1 = lum(c), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(s.fontSize); const bold = Number(s.fontWeight) >= 700; const large = size >= 24 || (bold && size >= 18.66);
    if (ratio < (large ? 3 : 4.5)) { const k = sel(e) + s.color; if (seen.has(k)) continue; seen.add(k); add('contrast', e, `${ratio.toFixed(2)}:1 ${Math.round(size)}px`); }
  }
  // reflow
  if (document.documentElement.scrollWidth > innerWidth + 1) out.push({ rule: 'reflow', el: 'html', extra: `${document.documentElement.scrollWidth} > ${innerWidth}` });
  return out;
};

async function keyboard(p) { // tab through: every stop must show a focus indicator, and focus must not get stuck
  const out = []; let prev = null; let same = 0;
  for (let i = 0; i < 80; i++) {
    await p.keyboard.press('Tab');
    const r = await p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null;
      const s = getComputedStyle(e); window.__n = (window.__n || 0) + 1; if (!e.__aid) e.__aid = window.__n; const id = e.__aid;
      const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none');
      return { id, ring, el: e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : '') + (e.dataset.act ? `[data-act=${e.dataset.act}]` : ''), text: (e.innerText || e.getAttribute('aria-label') || e.value || '').trim().slice(0, 40), vis: e.getBoundingClientRect().width > 0 }; });
    if (!r) continue;
    if (!r.ring) out.push({ rule: 'focus-visible', el: r.el, text: r.text });
    if (!r.vis) out.push({ rule: 'focus-offscreen', el: r.el, text: r.text });
    same = prev === r.id ? same + 1 : 0; prev = r.id; if (same > 3) { out.push({ rule: 'keyboard-trap', el: r.el }); break; }
  }
  return out;
}

(async () => {
  const b = await chromium.launch(); const report = {};
  for (const [dev, view] of [['desk', { viewport: { width: 1280, height: 860 } }], ['phone', { viewport: { width: 320, height: 720 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
    for (const scheme of dev === 'desk' ? ['dark', 'light'] : ['dark']) {
      const ctx = await b.newContext({ ...view, colorScheme: scheme }); const p = await ctx.newPage(); p.setDefaultTimeout(5000); let ready = false;
      for (const [name, url, o] of PAGES) {
        if (o.phoneOnly && dev !== 'phone') continue;
        await p.goto(url); await p.waitForTimeout(1800);
        for (const c of await p.$$('#modal-root input[type=checkbox]')) await c.check().catch(() => {}); await p.click('#modal-root .btn-primary').catch(() => {});
        if (o.example && !ready) { await p.evaluate(() => import('/js/example.js').then((m) => m.loadExample('cafe'))); ready = true; await p.goto(url); await p.waitForTimeout(1500); }
        if (o.act) await o.act(p).catch(() => {});
        await p.evaluate(() => { document.getElementById('splash')?.remove(); for (const a of document.getAnimations()) { try { a.finish(); } catch { a.pause(); a.currentTime = 6000; } } });
        const t0 = Date.now(); const issues = await p.evaluate(inPage); 
        const kb = dev === 'desk' && scheme === 'dark' ? await keyboard(p) : [];
        report[`${name} · ${dev} · ${scheme}`] = [...issues, ...kb];
      }
      await ctx.close();
    }
  }
  await b.close();
  
  const byRule = {}; for (const [k, v] of Object.entries(report)) for (const i of v) (byRule[i.rule] ||= []).push(`${k}: ${i.el} ${i.text ? `"${i.text}"` : ''} ${i.extra || ''}`);
  for (const [r, l] of Object.entries(byRule)) { const u = [...new Set(l)]; console.log(`\n## ${r} (${u.length})`); console.log(u.slice(0, 25).join('\n')); }
})();
