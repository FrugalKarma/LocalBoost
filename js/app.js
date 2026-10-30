import { html, icon, $, $$, toast, demoBadge, closeModal } from './core.js';
import { t, initLang, setLang, onLang, LANGS, getLang } from './i18n.js';
import { initTheme, toggleTheme, currentTheme, themeTransition } from './theme.js';
import { getState, update } from './store.js';
import { actions, inputs, setRerender, ROUTES, go } from './registry.js';
import { registerSW, onInstallChange } from './pwa.js';
import { seedFullDemo } from './seed.js';
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

const views = Object.fromEntries([overview, signals, competitors, diagnosis, mission, website, pack, proof, settings, account].map((v) => [v.id, v]));
let route = 'overview';
let pendingAnchor = null;

const parseRoute = () => { const r = (location.hash.replace(/^#\/?/, '') || 'overview').split('?')[0]; return views[r] ? r : 'overview'; };

function navItem(r, i, mobile) {
  const label = t(`nav.${r.id}`);
  return html`<a class="nav-item" href="#/${r.id}" data-nav="${r.id}" ${route === r.id ? 'aria-current="page"' : ''} title="${label}">
    ${icon(r.icon, 22)}<span class="nav-label">${label}</span></a>`;
}

function shell() {
  const mobileRoutes = ROUTES.filter((r) => r.mobile);
  return html`
  <a class="skip" href="#main">${t('common.skip')}</a>
  <div class="side-hot" aria-hidden="true"></div>
  <aside class="sidebar" id="sidebar" aria-label="${t('common.navigation')}">
    <div class="brand"><img class="brand-logo" src="/icons/logo.png" alt="" width="40" height="40"><div><strong>LocalBoost</strong><small class="mono">Signal-to-Action OS</small></div></div>
    <nav class="nav">${ROUTES.map((r, i) => navItem(r, i))}</nav>
    <div class="side-foot"><p class="mono small">${t('common.demoData')}</p><p class="small">${t('common.sideNote')}</p></div>
  </aside>
  <div class="overlay" id="overlay" data-act="close-drawer" hidden></div>
  <div class="content">
    <header class="topbar">
      <button class="icon-btn menu-toggle" data-act="toggle-side" aria-label="${t('common.menu')}" title="${t('common.menu')}">${icon('menu', 22)}</button>
      <span class="top-brand" aria-hidden="true"><img class="brand-logo" src="/icons/logo.png" alt="" width="28" height="28"><strong>LocalBoost</strong></span>
      <h2 class="topbar-title" id="topbar-title">${t(`nav.${route}`)}</h2>
      <span class="spacer"></span>
      <span class="badge badge-offline" id="offline-badge" hidden>${t('common.offline')}</span>
      ${demoBadge('hide-sm')}
      <label class="lang"><span class="sr-only">${t('settings.language')}</span>${icon('globe', 16)}<select data-in="lang-select" aria-label="${t('settings.language')}">${LANGS.map((l) => html`<option value="${l.code}" ${getLang() === l.code ? 'selected' : ''}>${l.label}</option>`)}</select></label>
      <button class="icon-btn ${spinTheme ? 'spin-once' : ''}" data-act="toggle-theme" aria-label="${t('settings.theme')}" title="${t('settings.theme')}">${icon(currentTheme() === 'dark' ? 'sun' : 'moon', 20)}</button>
      <div class="menu-wrap"><button class="icon-btn" data-act="account-menu" aria-haspopup="true" aria-expanded="false" aria-label="${t('nav.account')}">${icon('account', 20)}</button>
        <div class="menu" id="account-menu" hidden role="menu">
          <p class="menu-name">${getState().profile.name}<small>${t('account.role')}</small></p>
          <a role="menuitem" href="#/account">${icon('account', 16)} ${t('nav.account')}</a><a role="menuitem" href="#/settings">${icon('settings', 16)} ${t('nav.settings')}</a>
          <button role="menuitem" data-act="help">${icon('help', 16)} ${t('settings.openHelp')}</button></div></div>
    </header>
    <main id="main" tabindex="-1"></main>
  </div>
  <nav class="bottom-nav" aria-label="${t('common.navigation')}">${mobileRoutes.map((r) => navItem(r, 0, true))}
    <button class="nav-item" data-act="open-drawer" aria-label="${t('common.menu')}">${icon('menu', 22)}<span class="nav-label">${t('common.menu')}</span></button></nav>`;
}

function renderView(keepScroll = false) {
  const main = $('#main'); if (!main) return;
  const y = window.scrollY;
  const v = views[route];
  document.body.dataset.route = route;
  try { main.innerHTML = v.render().s; v.mount?.(); }
  catch (e) { console.error('[LocalBoost] render failed', e); main.innerHTML = html`<div class="card empty-hero"><h2>${t('common.errorGeneric')}</h2><button class="btn btn-primary" data-act="go" data-route="overview">${t('nav.overview')}</button></div>`.s; }
  $('#topbar-title').textContent = t(`nav.${route}`);
  $$('[data-nav]').forEach((a) => (a.dataset.nav === route ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  document.title = `${t(`nav.${route}`)} · LocalBoost`;
  if (keepScroll) window.scrollTo(0, y);
  if (pendingAnchor) { document.getElementById(pendingAnchor)?.scrollIntoView(); pendingAnchor = null; }
}

let spinTheme = false; let sideCollapsed = false; let pinnedOpen = false; let suppressPeek = false; let peekTimer = null;
const isMobile = () => window.matchMedia('(max-width: 767px)').matches;

function renderAll() {
  const app = document.getElementById('app');
  app.innerHTML = shell().s;
  app.classList.toggle('side-collapsed', sideCollapsed);
  renderView(true);
  updateOnline();
}

const rerender = () => renderView(true);
setRerender((o) => (o?.full ? renderAll() : rerender()));

function onRoute() {
  route = parseRoute();
  closeDrawer();
  $('#account-menu') && ($('#account-menu').hidden = true);
  renderView();
  if (!pendingAnchor) { window.scrollTo(0, 0); $('#main')?.focus({ preventScroll: true }); }
}

function closeDrawer() { $('#sidebar')?.classList.remove('open'); const o = $('#overlay'); if (o) o.hidden = true; }
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
  if (e.target.closest('.nav-item[href]')) {
    closeDrawer();
    if (!isMobile() && e.target.closest('#sidebar')) { // desktop: hide the sidebar after a selection; hover the left edge to bring it back
      sideCollapsed = true; pinnedOpen = false; suppressPeek = true;
      $('#app').classList.add('side-collapsed'); $('#app').classList.remove('peek');
      if (e.detail > 0) document.activeElement?.blur?.();
    }
  }
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
actions['open-drawer'] = () => { $('#sidebar').classList.add('open'); $('#overlay').hidden = false; $('#sidebar a')?.focus(); };
actions['close-drawer'] = closeDrawer;
actions['toggle-side'] = () => {
  if (isMobile()) return actions['open-drawer']();
  pinnedOpen = !pinnedOpen; suppressPeek = false;
  if (pinnedOpen) setPeek(true); else { $('#sidebar').blur(); $('#app').classList.remove('peek'); }
};

/* desktop sidebar: slides in on hover over the left edge and the page shrinks aside to stay visible */
function setPeek(on) {
  clearTimeout(peekTimer);
  const app = $('#app'); const sb = $('#sidebar');
  if (!app || !sb || isMobile() || !app.classList.contains('side-collapsed')) return;
  if (on) {
    app.style.setProperty('--push', String(Math.max(0.7, (window.innerWidth - sb.offsetWidth) / window.innerWidth)));
    app.classList.add('peek');
  } else {
    peekTimer = setTimeout(() => { if (!pinnedOpen && !sb.matches(':focus-within')) app.classList.remove('peek'); }, 160);
  }
}
const inSide = (el) => el instanceof Element && el.closest('.side-hot, #sidebar');
document.addEventListener('mouseover', (e) => { if (!suppressPeek && inSide(e.target)) setPeek(true); });
document.addEventListener('mouseout', (e) => { if (inSide(e.target) && !inSide(e.relatedTarget)) { suppressPeek = false; setPeek(false); } });
document.addEventListener('focusin', (e) => { if (inSide(e.target) && !suppressPeek) setPeek(true); });
document.addEventListener('focusout', (e) => { if (inSide(e.target) && !inSide(e.relatedTarget)) setPeek(false); });
actions['account-menu'] = (el) => {
  const m = $('#account-menu'); m.hidden = !m.hidden; el.setAttribute('aria-expanded', String(!m.hidden));
  if (!m.hidden) $('a', m).focus();
};
actions['toggle-theme'] = (el) => { themeTransition(el, () => { spinTheme = true; toggleTheme(); renderAll(); spinTheme = false; }); };
inputs['lang-select'] = (el) => setLang(el.value);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeDrawer(); const m = $('#account-menu'); if (m && !m.hidden) { m.hidden = true; $('[data-act="account-menu"]')?.focus(); } }
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

