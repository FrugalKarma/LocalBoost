// Launch page ("coming soon"): shown instead of the app until the launch moment set on the server
// (/api/auth?op=config → maintenance). The owner password unlocks it for 30 days on that browser;
// a signed-in owner passes straight through. When the countdown ends the page reloads into the app.
import { html, icon, toast, copyText, $ } from './core.js';
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

function page(launch, unlockOpen, err) {
  const p = parts(launch - Date.now());
  const unit = (k, v) => html`<div class="cd-unit"><b data-cd="${k}">${k === 'd' ? v : pad(v)}</b><span>${t(`soon.unit.${k}`)}</span></div>`;
  return html`<div class="soon">
    <div class="soon-blob b1"></div><div class="soon-blob b2"></div><div class="soon-blob b3"></div>
    <header class="soon-top"><span class="soon-brand"><img src="/icons/logo.svg" alt="" width="40" height="40"><b>${BRAND.app}</b></span>
      <label class="lang"><span class="sr-only">${t('settings.language')}</span>${icon('globe', 16)}<select data-soon="lang" aria-label="${t('settings.language')}">${LANGS.map((l) => html`<option value="${l.code}" ${getLang() === l.code ? 'selected' : ''}>${l.label}</option>`)}</select></label></header>
    <main class="soon-main" id="main">
      <p class="soon-badge"><span aria-hidden="true">🚧</span> ${t('soon.badge', { date: dateText(launch) })}</p>
      <h1>${t('soon.title')}</h1>
      <p class="soon-lede">${t('soon.lede', { app: BRAND.app })}</p>
      <div class="countdown" role="timer" aria-live="off" aria-label="${t('soon.left')}">${unit('d', p.d)}<i>:</i>${unit('h', p.h)}<i>:</i>${unit('m', p.m)}<i>:</i>${unit('s', p.s)}</div>
      <div class="soon-actions">
        <button class="btn btn-primary btn-lg" data-soon="share">${icon('share', 18)} ${t('soon.share')}</button>
        <button class="btn btn-secondary btn-lg" data-soon="calendar">${icon('calendar', 18)} ${t('soon.remind')}</button></div>
      <ul class="soon-feats">${[['👀', 'f1'], ['🌐', 'f2'], ['🎨', 'f3'], ['📈', 'f4']].map(([e, k]) => html`<li><span class="sf-e" aria-hidden="true">${e}</span><div><b>${t(`soon.${k}t`)}</b><span>${t(`soon.${k}`)}</span></div></li>`)}</ul>
    </main>
    <footer class="soon-foot">
      ${unlockOpen ? html`<form class="soon-unlock" data-soon-form novalidate><label class="field"><span>${t('soon.pw')}</span>
          <input id="soon-pw" type="password" autocomplete="current-password" maxlength="200"></label>
          <button type="submit" class="btn btn-primary">${icon('check', 16)} ${t('soon.unlock')}</button>
          ${err ? html`<p class="soon-err" role="alert">${t(err === 'rate_limited' ? 'signin.err.rate_limited' : err === 'network' ? 'signin.err.network' : 'soon.wrong')}</p>` : ''}</form>`
        : html`<button class="link-btn" data-soon="unlock">${icon('account', 15)} ${t('soon.access')}</button>`}
      <p>© ${new Date().getFullYear()} ${BRAND.company} · <button class="link-btn" data-soon="privacy">${t('legal.privacy')}</button></p>
    </footer></div>`;
}

function show(launch, resolve) {
  let open = false; let err = null;
  const app = document.getElementById('app');
  document.body.dataset.route = 'soon';
  document.title = `${BRAND.app} · ${t('soon.short', { date: dateText(launch) })}`;
  const paint = () => { app.innerHTML = page(launch, open, err).s; if (open) $('#soon-pw')?.focus(); };
  paint();
  clearInterval(timer);
  timer = setInterval(() => {
    const left = launch - Date.now();
    if (left <= 0) { clearInterval(timer); confetti(); setTimeout(() => location.reload(), 1200); return; }
    const p = parts(left);
    Object.entries(p).forEach(([k, v]) => { const el = app.querySelector(`[data-cd="${k}"]`); const txt = k === 'd' ? String(v) : pad(v); if (el && el.textContent !== txt) { el.textContent = txt; el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick'); } });
  }, 1000);
  const stopLang = onLang(() => { document.title = `${BRAND.app} · ${t('soon.short', { date: dateText(launch) })}`; paint(); });
  const finish = () => { clearInterval(timer); app.removeEventListener('click', onClick); app.removeEventListener('submit', onSubmit); app.removeEventListener('change', onChange); stopLang?.(); delete document.body.dataset.route; resolve(); };
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
