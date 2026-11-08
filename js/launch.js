// Launch page ("coming soon"): shown instead of the app until the launch moment set on the server
// (/api/auth?op=config → maintenance). The owner password unlocks it for 30 days on that browser;
// a signed-in owner passes straight through. When the countdown ends the page reloads into the app.
import { html, raw, toast, copyText, $ } from './core.js';
import { scene } from './scene.js';
import { t, LANGS, getLang, setLang, onLang } from './i18n.js';
import { apiUrl } from './api.js';
import { BRAND } from './brand.js';
import { getSession } from './auth.js';
import { confetti } from './fun.js';

const PASS = 'arcton.preview';
const CFG = 'arcton.launch';
// shared links and the calendar invite point at the public address (local dev keeps its own origin)
const SITE = /localhost|127\.0\.0\.1/.test(location.hostname) ? location.origin : 'https://www.arcton.site';
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };

async function post(body) {
  try {
    const r = await fetch(apiUrl('/api/auth'), { method: 'POST', headers: { 'content-type': 'application/json', ...(getSession()?.owner ? { authorization: `Bearer ${getSession().access_token}` } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(12000) });
    let j = {}; try { j = await r.json(); } catch { /* empty */ }
    return r.ok ? j : { error: j.error || 'failed', status: r.status };
  } catch { return { error: 'network' }; }
}

/** Resolves when the app may start: at once when the launch page is off, otherwise after unlocking. */
export async function launchGate() {
  let cfg = null;
  try { const r = await fetch(apiUrl('/api/auth?op=config'), { cache: 'no-store', signal: AbortSignal.timeout(5000) }); if (r.ok) cfg = (await r.json()).maintenance || null; } catch { /* offline */ }
  if (cfg) write(CFG, cfg); else cfg = read(CFG); // offline: last known answer
  if (!cfg?.on) return;
  const launch = Date.parse(cfg.launch);
  if (Number.isFinite(launch) && Date.now() >= launch) return;
  const pass = read(PASS);
  if (pass?.pass || getSession()?.owner) {
    const r = await post({ op: 'preview-check', pass: pass?.pass });
    if (r.ok || (r.error === 'network' && pass?.exp * 1000 > Date.now())) return;
    if (!r.error) write(PASS, null); // expired or changed password
  }
  return new Promise((resolve) => show(launch, resolve));
}

/* ---------- the page ---------- */
let timer = null;
function parts(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
const pad = (n) => String(n).padStart(2, '0');
const dateText = (ms) => new Intl.DateTimeFormat(getLang(), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Bucharest' }).format(ms);

// The climb to launch day: the trail runs from the foot of the mountain to the peak (30 days), the diamond is today.
const WINDOW = 30 * 86400e3;
const TRAIL = 'M600 900 C 760 760, 880 520, 900 380 S 1020 260, 1060 170';
const climbed = (launch) => Math.min(1, Math.max(0, 1 - (launch - Date.now()) / WINDOW));

function page(launch, unlockOpen, err) {
  const p = parts(launch - Date.now());
  const unit = (k, v) => html`<div class="cd-unit ${k === 's' ? 'is-s' : ''}"><b data-cd="${k}">${k === 'd' ? v : pad(v)}</b><span>${t(`soon.unit.${k}`)}</span></div>`;
  const pct = Math.round(climbed(launch) * 100);
  return html`<div class="cd">
    <div class="cd-scene" aria-hidden="true">${raw(scene(2))}
      <svg class="cd-trail" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice"><path class="cd-route" d="${TRAIL}"/><path class="cd-walked" id="cd-walked" d="${TRAIL}" pathLength="1" style="stroke-dashoffset:${1 - pct / 100}"/>
        <g id="cd-me"><rect x="-7" y="-7" width="14" height="14" transform="rotate(45)" class="cd-me"/><rect x="-14" y="-14" width="28" height="28" transform="rotate(45)" class="cd-me-ring"/>
          <text x="20" y="5" class="cd-here">${t('soon.here', { p: pct })}</text></g>
        <rect x="1053" y="163" width="14" height="14" transform="rotate(45 1060 170)" class="cd-peak"/><line x1="1060" y1="150" x2="1060" y2="112" class="cd-leader"/></svg>
      <p class="cd-peak-l"><b>III</b>${t('soon.peak', { date: new Intl.DateTimeFormat(getLang(), { day: '2-digit', month: '2-digit', timeZone: 'Europe/Bucharest' }).format(launch) })}<small>${t('soon.peakSub')}</small></p></div>
    <header class="cd-top"><span class="cd-brand"><img src="/icons/logo.svg" alt="" width="28" height="28"><b>${BRAND.app}</b></span>
      <label class="cd-lang"><span class="sr-only">${t('settings.language')}</span><select data-soon="lang" aria-label="${t('settings.language')}">${LANGS.map((l) => html`<option value="${l.code}" ${getLang() === l.code ? 'selected' : ''}>${l.label}</option>`)}</select></label></header>
    <main class="cd-main" id="main">
      <p class="cd-k">${t('soon.badge', { date: dateText(launch) })}</p>
      <h1>${t('soon.headA')} <em>${t('soon.headB')}</em> ${t('soon.headC')}</h1>
      <p class="cd-lede">${t('soon.lede', { app: BRAND.app })}</p>
      <div class="cd-clock" role="timer" aria-live="off" aria-label="${t('soon.left')}">${unit('d', p.d)}${unit('h', p.h)}${unit('m', p.m)}${unit('s', p.s)}</div>
      <div class="cd-actions">
        <button class="cd-btn is-primary" data-soon="calendar">${t('soon.remind')}</button>
        <button class="cd-btn" data-soon="share">${t('soon.share')}</button></div>
      <ol class="cd-feats">${['f1', 'f2', 'f3', 'f4'].map((k, i) => html`<li><i>${['I', 'II', 'III', 'IV'][i]}</i><div><b>${t(`soon.${k}t`)}</b><span>${t(`soon.${k}`)}</span></div></li>`)}</ol>
    </main>
    <footer class="cd-foot">
      ${unlockOpen ? html`<form class="cd-unlock" data-soon-form novalidate><label><span>${t('soon.pw')}</span>
          <input id="soon-pw" type="password" autocomplete="current-password" maxlength="200"></label>
          <button type="submit" class="cd-btn is-primary">${t('soon.unlock')}</button>
          ${err ? html`<p class="cd-err" role="alert">${t(err === 'rate_limited' ? 'signin.err.rate_limited' : err === 'network' ? 'signin.err.network' : 'soon.wrong')}</p>` : ''}</form>`
        : html`<button class="cd-link" data-soon="unlock">${t('soon.access')}</button>`}
      <p>© ${new Date().getFullYear()} ${BRAND.company} · <button class="cd-link" data-soon="privacy">${t('legal.privacy')}</button></p>
    </footer></div>`;
}

/** Puts the diamond at today's point on the trail. */
function placeMe(launch) {
  const path = document.getElementById('cd-walked'); const me = document.getElementById('cd-me'); if (!path || !me) return;
  const L = path.getTotalLength(); const pt = path.getPointAtLength(L * climbed(launch));
  me.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
  const peak = document.querySelector('.cd-leader')?.getBoundingClientRect(); const l = document.querySelector('.cd-peak-l');
  if (peak && l) { l.style.left = `${peak.left}px`; l.style.top = `${peak.top - 8}px`; }
}

function show(launch, resolve) {
  let open = false; let err = null;
  const app = document.getElementById('app');
  document.body.dataset.route = 'soon';
  document.title = `${BRAND.app} · ${t('soon.short', { date: dateText(launch) })}`;
  const paint = () => { app.innerHTML = page(launch, open, err).s; placeMe(launch); if (open) $('#soon-pw')?.focus(); };
  paint();
  const onResize = () => placeMe(launch); window.addEventListener('resize', onResize);
  clearInterval(timer);
  timer = setInterval(() => {
    const left = launch - Date.now();
    if (left <= 0) { clearInterval(timer); confetti(); setTimeout(() => location.reload(), 1200); return; }
    const p = parts(left);
    Object.entries(p).forEach(([k, v]) => { const el = app.querySelector(`[data-cd="${k}"]`); const txt = k === 'd' ? String(v) : pad(v); if (el && el.textContent !== txt) { el.textContent = txt; el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick'); } });
  }, 1000);
  const stopLang = onLang(() => { document.title = `${BRAND.app} · ${t('soon.short', { date: dateText(launch) })}`; paint(); });
  const finish = () => { window.removeEventListener('resize', onResize); clearInterval(timer); app.removeEventListener('click', onClick); app.removeEventListener('submit', onSubmit); app.removeEventListener('change', onChange); stopLang?.(); delete document.body.dataset.route; resolve(); };
  const onChange = (e) => { if (e.target.matches('[data-soon="lang"]')) setLang(e.target.value); };
  const onClick = async (e) => {
    const b = e.target.closest('[data-soon]'); if (!b) return;
    const k = b.dataset.soon;
    if (k === 'unlock') { open = true; err = null; paint(); }
    if (k === 'privacy') { const { openLegal } = await import('./legalText.js'); openLegal('privacy'); }
    if (k === 'share') {
      const data = { title: BRAND.app, text: t('soon.shareText', { date: dateText(launch) }), url: SITE };
      if (navigator.share) { try { await navigator.share(data); return; } catch { /* closed */ } }
      const ok = await copyText(`${data.text} ${data.url}`); toast(ok ? t('soon.copied') : t('common.copyFailed'), ok ? 'success' : 'error');
    }
    if (k === 'calendar') {
      const d = new Date(launch); const ymd = (x) => x.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Arcton Ai//Launch//EN\r\nBEGIN:VEVENT\r\nUID:launch@arcton.site\r\nDTSTAMP:${ymd(new Date())}\r\nDTSTART:${ymd(d)}\r\nDTEND:${ymd(new Date(launch + 3600e3))}\r\nSUMMARY:${BRAND.app} ${t('soon.calTitle')}\r\nURL:${SITE}\r\nDESCRIPTION:${SITE}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })), download: 'arcton-ai-launch.ics' }); document.body.append(a); a.click(); a.remove();
    }
  };
  const onSubmit = async (e) => {
    if (!e.target.matches('[data-soon-form]')) return;
    e.preventDefault();
    const pw = $('#soon-pw')?.value || ''; if (!pw) return;
    const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true;
    const r = await post({ op: 'preview-unlock', password: pw });
    if (r.pass) { write(PASS, { pass: r.pass, exp: r.exp }); confetti(btn); setTimeout(finish, 500); return; }
    err = r.error; paint();
  };
  app.addEventListener('click', onClick); app.addEventListener('submit', onSubmit); app.addEventListener('change', onChange);
}
