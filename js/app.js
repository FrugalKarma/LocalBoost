import { html, raw, icon, $, $$, toast, demoBadge, closeModal } from './core.js';
import { t, initLang, setLang, onLang, LANGS, getLang } from './i18n.js';
import { initTheme, toggleTheme, currentTheme, themeTransition } from './theme.js';
import { getState, update } from './store.js';
import { actions, inputs, setRerender, ROUTES, go } from './registry.js';
import { registerSW, onInstallChange } from './pwa.js';
import { seedFullDemo, seedSignalsDemo } from './seed.js';
import { getSiteFrames } from './views/website.js';
import { overview } from './views/overview.js';
import { signals } from './views/signals.js';
import { diagnosis } from './views/diagnosis.js';
import { mission } from './views/mission.js';
import { website } from './views/website.js';
import { pack } from './views/pack.js';
import { proof } from './views/proof.js';
import { settings } from './views/settings.js';
import { account } from './views/account.js';
import { competitors } from './views/competitors.js';
import { journeyState } from './views/shared.js';
import { displayName, getBiz } from './business.js';
import './chat.js'; // "Ask LocalBoost" panel (registers its own actions)

const views = Object.fromEntries([overview, signals, competitors, diagnosis, mission, website, pack, proof, settings, account].map((v) => [v.id, v]));
let route = 'overview';
let pendingAnchor = null;

const parseRoute = () => { const r = (location.hash.replace(/^#\/?/, '') || 'overview').split('?')[0]; return views[r] ? r : 'overview'; };

/* ---------- journey navigation: Home + the four stages, each with its own colour ---------- */
// Settings and Account are reached from the account menu; they belong to no stage.
const STAGES = [
  { id: 'home', routes: ['overview'], n: '' },
  { id: 'observe', routes: ['signals', 'competitors'], n: '01' },
  { id: 'diagnose', routes: ['diagnosis'], n: '02' },
  { id: 'act', routes: ['mission', 'website', 'pack'], n: '03' },
  { id: 'measure', routes: ['proof'], n: '04' },
];
const stageOf = (r) => STAGES.find((s) => s.routes.includes(r)) || null;
const stageLabel = (s) => (s.id === 'home' ? t('nav.home') : t(`journey.${s.id}`));

function stageTab(s) {
  const cur = stageOf(route)?.id === s.id;
  const done = s.id !== 'home' && journeyState()[s.id];
  const mark = s.id === 'home' ? icon('pin', 16) : done ? icon('check', 14) : s.n;
  return html`<a class="stage-tab" data-stage="${s.id}" href="#/${s.routes[0]}" ${raw(cur ? 'aria-current="page"' : '')} title="${stageLabel(s)}">
    <span class="stage-n" aria-hidden="true">${mark}</span><span class="stage-label">${stageLabel(s)}</span></a>`;
}

function subnav() {
  const s = stageOf(route);
  if (!s || s.routes.length < 2) return html``;
  return html`<nav class="subnav" data-stage="${s.id}" aria-label="${stageLabel(s)}">${s.routes.map((r) => html`<a class="subnav-item" href="#/${r}" ${raw(r === route ? 'aria-current="page"' : '')}>${icon(ROUTES.find((x) => x.id === r)?.icon || 'next', 18)}${t(`nav.${r}`)}</a>`)}</nav>`;
}

function updateChrome() {
  const tabs = $('.stage-tabs'); if (tabs) tabs.innerHTML = html`${STAGES.map(stageTab)}`.s;
  const sub = $('#subnav-slot'); if (sub) sub.innerHTML = subnav().s;
  const biz = $('#top-biz'); const b = getState().business;
  if (biz) biz.textContent = b.loaded ? `${displayName()} · ${getBiz().city || ''}` : '';
}

function shell() {
  return html`
  <a class="skip" href="#main">${t('common.skip')}</a>
  <div class="content">
    <header class="topbar">
      <a class="top-brand" href="#/overview"><img class="brand-logo" src="/icons/logo.png" alt="" width="34" height="34"><strong>LocalBoost</strong></a>
      <span class="top-biz" id="top-biz"></span>
      <span class="spacer"></span>
      <span class="badge badge-offline" id="offline-badge" hidden>${t('common.offline')}</span>
      ${demoBadge('hide-sm')}
      <button class="btn btn-ask" data-act="chat-open" aria-label="${t('chat.title')}">${icon('sparkle', 18)}<span class="hide-sm">${t('chat.open')}</span></button>
      <label class="lang"><span class="sr-only">${t('settings.language')}</span>${icon('globe', 16)}<select data-in="lang-select" aria-label="${t('settings.language')}">${LANGS.map((l) => html`<option value="${l.code}" ${getLang() === l.code ? 'selected' : ''}>${l.label}</option>`)}</select></label>
      <button class="icon-btn ${spinTheme ? 'spin-once' : ''}" data-act="toggle-theme" aria-label="${t('settings.theme')}" title="${t('settings.theme')}">${icon(currentTheme() === 'dark' ? 'sun' : 'moon', 20)}</button>
      <div class="menu-wrap"><button class="icon-btn" data-act="account-menu" aria-haspopup="true" aria-expanded="false" aria-label="${t('nav.account')}">${icon('account', 20)}</button>
        <div class="menu" id="account-menu" hidden role="menu">
          <p class="menu-name">${getState().profile.name}<small>${t('account.role')}</small></p>
          <a role="menuitem" href="#/account">${icon('account', 16)} ${t('nav.account')}</a><a role="menuitem" href="#/settings">${icon('settings', 16)} ${t('nav.settings')}</a>
          <button role="menuitem" data-act="help">${icon('help', 16)} ${t('settings.openHelp')}</button></div></div>
    </header>
    <div id="subnav-slot"></div>
    <main id="main" tabindex="-1"></main>
  </div>
  <nav class="stage-tabs" aria-label="${t('common.navigation')}">${STAGES.map(stageTab)}</nav>`;
}

function renderView(keepScroll = false) {
  const main = $('#main'); if (!main) return;
  const y = window.scrollY;
  const v = views[route];
  document.body.dataset.route = route;
  try { main.innerHTML = v.render().s; v.mount?.(); }
  catch (e) { console.error('[LocalBoost] render failed', e); main.innerHTML = html`<div class="card empty-hero"><h2>${t('common.errorGeneric')}</h2><button class="btn btn-primary" data-act="go" data-route="overview">${t('nav.overview')}</button></div>`.s; }
  updateChrome();
  document.title = `${t(`nav.${route}`)} · LocalBoost`;
  if (keepScroll) window.scrollTo(0, y);
  if (pendingAnchor) { document.getElementById(pendingAnchor)?.scrollIntoView(); pendingAnchor = null; }
}

let spinTheme = false;

function renderAll() {
  const app = document.getElementById('app');
  app.innerHTML = shell().s;
  renderView(true);
  updateOnline();
}

const rerender = () => renderView(true);
setRerender((o) => (o?.full ? renderAll() : rerender()));

function onRoute() {
  route = parseRoute();
  $('#account-menu') && ($('#account-menu').hidden = true);
  renderView();
  if (!pendingAnchor) { window.scrollTo(0, 0); $('#main')?.focus({ preventScroll: true }); }
}

// navigator.onLine can be wrong (some browsers report false on localhost), so confirm with a real request.
async function updateOnline() {
  const b = $('#offline-badge'); if (!b) return;
  if (navigator.onLine) { b.hidden = true; return; }
  try { await fetch('/manifest.json', { cache: 'no-store' }); b.hidden = true; } catch { b.hidden = false; }
}

/* ---------- global events ---------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  const menu = $('#account-menu');
  if (menu && !menu.hidden && !e.target.closest('.menu-wrap')) menu.hidden = true;
  if (e.target.closest('#account-menu a, #account-menu button')) menu && (menu.hidden = true);
  if (!el) return;
  const fn = actions[el.dataset.act];
  if (!fn) { console.warn('[LocalBoost] no handler for', el.dataset.act); return; }
  try { const r = fn(el, e); if (r?.catch) r.catch((err) => { console.error(err); toast(t('common.errorGeneric'), 'error'); }); }
  catch (err) { console.error(err); toast(t('common.errorGeneric'), 'error'); }
});

const textual = (el) => el.matches('input[type="text"], input[type="number"], input[type="color"], textarea');
document.addEventListener('input', (e) => { const el = e.target.closest('[data-in]'); if (el && textual(el)) inputs[el.dataset.in]?.(el, e); });
document.addEventListener('change', (e) => { const el = e.target.closest('[data-in]'); if (el && !textual(el)) inputs[el.dataset.in]?.(el, e); });

actions.go = (el) => {
  pendingAnchor = el.dataset.hash || null;
  const target = `#/${el.dataset.route}`;
  if (location.hash === target) onRoute(); else location.hash = target;
};
actions['account-menu'] = (el) => {
  const m = $('#account-menu'); m.hidden = !m.hidden; el.setAttribute('aria-expanded', String(!m.hidden));
  if (!m.hidden) $('a', m).focus();
};
actions['toggle-theme'] = (el) => { themeTransition(el, () => { spinTheme = true; toggleTheme(); renderAll(); spinTheme = false; }); };
inputs['lang-select'] = (el) => setLang(el.value);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { const m = $('#account-menu'); if (m && !m.hidden) { m.hidden = true; $('[data-act="account-menu"]')?.focus(); } }
});

window.addEventListener('message', (e) => {
  const d = e.data;
  if (!d || d.lb !== 'booking') return;
  if (!getSiteFrames().some((f) => f.contentWindow === e.source)) return; // only our own sandboxed preview
  update((s) => ({ bookings: [...s.bookings, { party: Math.min(99, Number(d.party) || 1), slot: String(d.slot || '').slice(0, 20), at: Date.now(), demo: true }].slice(-200) }));
  toast(t('website.toastBooking'), 'success');
});

/* ---------- "where does this number come from?" tooltip ---------- */
// Any element with data-src="<key>" explains its origin on hover, keyboard focus or a long press with a finger.
let tipEl = null; let tipTimer = null; let longPress = null;
function showTip(el) {
  const key = el.dataset.src; if (!key) return;
  tipEl ||= Object.assign(document.createElement('div'), { id: 'src-tip', role: 'tooltip' });
  if (!tipEl.isConnected) document.body.appendChild(tipEl);
  const origin = key === 'checkpointVal' ? t('src.userEntered') : t('src.simulated');
  tipEl.innerHTML = html`<strong>${t('src.label')}</strong><p>${t(`src.${key}`)}</p>${el.dataset.dyn ? html`<small class="dyn">${t('src.dynamic')}</small>` : ''}<small>${origin}</small>`.s;
  tipEl.hidden = false;
  const r = el.getBoundingClientRect(); const w = tipEl.offsetWidth; const h = tipEl.offsetHeight;
  const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
  const top = r.bottom + 8 + h > window.innerHeight ? Math.max(8, r.top - h - 8) : r.bottom + 8;
  tipEl.style.left = `${left}px`; tipEl.style.top = `${top}px`;
  clearTimeout(tipTimer);
}
const hideTip = (delay = 0) => { clearTimeout(tipTimer); tipTimer = setTimeout(() => { if (tipEl) tipEl.hidden = true; }, delay); };
const srcOf = (e) => (e.target instanceof Element ? e.target.closest('[data-src]') : null);
document.addEventListener('mouseover', (e) => { const el = srcOf(e); if (el) showTip(el); });
document.addEventListener('mouseout', (e) => { if (srcOf(e)) hideTip(60); });
document.addEventListener('focusin', (e) => { const el = srcOf(e); if (el) showTip(el); });
document.addEventListener('focusout', () => hideTip(60));
document.addEventListener('touchstart', (e) => {
  const el = srcOf(e); clearTimeout(longPress);
  if (el) longPress = setTimeout(() => { showTip(el); hideTip(3500); }, 380);
  else hideTip(0);
}, { passive: true });
['touchend', 'touchmove', 'touchcancel'].forEach((ev) => document.addEventListener(ev, () => clearTimeout(longPress), { passive: true }));
document.addEventListener('contextmenu', (e) => { if (srcOf(e) && e.pointerType !== 'mouse') e.preventDefault(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTip(0); });
let tipScrollY = 0;
window.addEventListener('scroll', () => { if (Math.abs(window.scrollY - tipScrollY) > 60) hideTip(0); }, { passive: true });
document.addEventListener('mouseover', () => { tipScrollY = window.scrollY; }, { passive: true });

window.addEventListener('hashchange', onRoute);
window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);
onLang(() => { renderAll(); closeModal(); });
onInstallChange(() => { if (route === 'settings') rerender(); });

/* ---------- boot ---------- */
function boot() {
  initTheme(); initLang();
  const q = new URLSearchParams(location.search);
  if (q.get('lang') && LANGS.some((l) => l.code === q.get('lang'))) { setLang(q.get('lang')); }
  if (q.get('theme') === 'dark' || q.get('theme') === 'light') { document.documentElement.dataset.theme = q.get('theme'); }
  if (q.get('seed') === 'full') seedFullDemo();
  if (q.get('seed') === 'signals') seedSignalsDemo();
  route = parseRoute();
  renderAll();
  registerSW();
  document.documentElement.dataset.ready = '1';
  window.__localboost = { go, getState }; // debug handle for QA
}
boot();

// opening screen: shown briefly on every cold start, then fades out
const splash = document.getElementById('splash');
if (splash) {
  const minShow = 1300;
  setTimeout(() => { splash.classList.add('gone'); setTimeout(() => splash.remove(), 450); }, minShow);
}

