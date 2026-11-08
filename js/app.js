import { html, icon, $, $$, toast, closeModal, confirmDialog } from './core.js';
import { t, initLang, setLang, onLang, LANGS, getLang } from './i18n.js';
import { initTheme, toggleTheme, currentTheme, themeTransition, useAppStyles } from './theme.js';
import { animateNumbers } from './motion.js';
import { getState, subscribe } from './store.js';
import { actions, inputs, setRerender, go } from './registry.js';
import { registerSW, onInstallChange } from './pwa.js';
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
import { plans } from './views/plans.js';
import { info } from './views/info.js';
import { BRAND } from './brand.js';
import { needsConsent, showConsent } from './legal.js';
import { applyDisplay } from './display.js';
import { isExample, loadExample, clearExample } from './example.js';
import { currentPlan } from './plans.js';
import { launchGate } from './launch.js';
import { journeyState } from './views/shared.js';
import { displayName, getBiz } from './business.js';
import './chat.js'; // "Ask Arcton" panel (registers its own actions)
import { admin } from './views/admin.js';
import { showSignin, repaintSignin, authErrorText } from './views/signin.js';
import { showLanding, repaintLanding } from './views/landing.js';
import { ridge, animateRidge, trailButton, trailMap } from './ridge.js';
import { scene } from './scene.js';
import { loadAuthConfig, authOn, signedIn, isAdmin, userEmail, userId, onAuthChange, readAuthHash, adoptLinkSession, signOut, refreshMe } from './auth.js';
import { loadOwn, flush, viewingClient, closeClient, onCloud, localOwner } from './cloud.js';

const views = Object.fromEntries([overview, signals, competitors, diagnosis, mission, website, pack, proof, settings, account, admin, plans, info].map((v) => [v.id, v]));
let route = 'overview';
let pendingAnchor = null;
let screen = 'boot'; // boot | signin | loading | app

const parseRoute = () => { const r = (location.hash.replace(/^#\/?/, '') || 'overview').split('?')[0]; return views[r] && (r !== 'admin' || isAdmin()) ? r : 'overview'; };

/* ---------- navigation: the ridge (js/ridge.js); Settings and Account are in the account menu ---------- */
const FOOT_LINKS = [['info', 'help'], ['plans', 'star'], ['settings', 'settings'], ['account', 'account']];
function footLinks() {
  return html`${FOOT_LINKS.map(([r]) => html`<li><a href="#/${r}">${t(`nav.${r}`)}</a></li>`)}
    ${isAdmin() ? html`<li><a href="#/admin">${t('nav.admin')}</a></li>` : ''}<li><a href="#/info?legal">${t('info.tab.legal')}</a></li>`;
}

const subnav = () => html``; // sub-pages live on the ridge (laptop) and on the route map (phone)

const levelOf = (r) => (['diagnosis', 'competitors', 'proof'].includes(r) ? 1 : ['mission', 'website', 'pack'].includes(r) ? 2 : 0);
function paintScene() {
  const layer = $('#scene-layer'); if (!layer) return;
  const lv = levelOf(route); const cur = layer.lastElementChild;
  if (cur && Number(cur.dataset.lv) === lv) return;
  const up = cur && lv > Number(cur.dataset.lv);
  const el = document.createElement('div'); el.className = `scene-pane ${cur ? (up ? 'in-up' : 'in-down') : ''}`; el.dataset.lv = String(lv); el.innerHTML = scene(lv);
  if (cur) { cur.classList.add(up ? 'out-up' : 'out-down'); setTimeout(() => cur.remove(), 1400); }
  layer.append(el);
}
function updateChrome() {
  const rg = $('.ridge'); if (rg) { rg.innerHTML = ridge(route, journeyState()).s; animateRidge(rg, route); }
  const ts = $('#trail-slot'); if (ts) ts.innerHTML = trailButton(route).s;
  paintScene();
  const links = $('.foot-links'); if (links) links.innerHTML = footLinks().s;
  const sub = $('#subnav-slot'); if (sub) sub.innerHTML = subnav().s;
  const biz = $('#top-biz'); const b = getState().business;
  if (biz) biz.textContent = b.loaded ? `${displayName()} · ${getBiz().city || ''}` : '';
  const vc = viewingClient(); const bar = $('#viewing-slot');
  if (bar) bar.innerHTML = vc ? html`<div class="viewing-bar" role="status">${icon('eye', 18)}<p><strong>${t('admin.viewing', { name: b.loaded ? displayName() : t('admin.noBusiness'), email: vc.email })}</strong>
    <span>${t(vc.disabled ? 'admin.viewingOff' : 'admin.viewingNote')}</span></p><button class="btn btn-sm" data-act="admin-exit">${t('admin.back')}</button></div>`.s : '';
  document.body.classList.toggle('is-viewing', !!vc);
  const ex = $('#example-slot');
  if (ex) ex.innerHTML = isExample() && !vc ? html`<div class="example-bar" role="status">${icon('sparkle', 18)}<p><b>${t('example.barTitle')}</b> ${t('example.barBody', { name: displayName() })}</p>
    <button class="btn btn-sm btn-secondary" data-act="example-clear">${t('example.clear')}</button></div>`.s : '';
  const promo = $('#side-promo');
  if (promo) promo.innerHTML = currentPlan() !== 'business' && !vc ? html`<div class="foot-promo"><b>${t('promo.title', { plan: t(`plans.${currentPlan() === 'free' ? 'pro' : 'business'}.name`) })}</b><span>${t(currentPlan() === 'free' ? 'promo.pro' : 'promo.business')}</span><a href="#/plans">${t('promo.cta')}</a></div>`.s : '';
}

function shell() {
  return html`
  <a class="skip" href="#main">${t('common.skip')}</a>
  <div class="scene-layer" id="scene-layer" aria-hidden="true"></div>
  <div class="content">
    <header class="hdr">
      <div class="hdr-in">
        <a class="hdr-brand" href="#/overview"><img src="/icons/logo.svg" alt="" width="34" height="34"><span><strong>${BRAND.app}</strong><small class="top-biz" id="top-biz"></small></span></a>
        <nav class="ridge" aria-label="${t('brand.journey')}">${ridge(route, journeyState())}</nav>
        <div class="trail-slot" id="trail-slot">${trailButton(route)}</div>
        <div class="hdr-tools">
          <span class="badge badge-offline" id="offline-badge" hidden>${t('common.offline')}</span>
          <button class="btn-ask" data-act="chat-open" aria-label="${t('chat.title')}"><span class="hide-sm">${t('chat.open')}</span><span class="ai-orb" aria-hidden="true"></span></button>
          <label class="lang"><span class="sr-only">${t('settings.language')}</span>${icon('globe', 16)}<select data-in="lang-select" aria-label="${t('settings.language')}">${LANGS.map((l) => html`<option value="${l.code}" ${getLang() === l.code ? 'selected' : ''}>${l.label}</option>`)}</select></label>
          <button class="icon-btn ${spinTheme ? 'spin-once' : ''}" data-act="toggle-theme" aria-label="${t('settings.theme')}" title="${t('settings.theme')}">${icon(currentTheme() === 'dark' ? 'sun' : 'moon', 20)}</button>
          <div class="menu-wrap"><button class="icon-btn" data-act="account-menu" aria-haspopup="true" aria-expanded="false" aria-label="${t('nav.account')}">${icon('account', 20)}</button>
            <div class="menu" id="account-menu" hidden role="menu">
              <p class="menu-name">${getState().profile.name || displayName()}<small>${signedIn() ? userEmail() : t('account.roleClient')}</small></p>
              ${isAdmin() ? html`<a role="menuitem" href="#/admin">${icon('overview', 16)} ${t('nav.admin')}</a>` : ''}
              <a role="menuitem" href="#/account">${icon('account', 16)} ${t('nav.account')}</a><a role="menuitem" href="#/plans">${icon('star', 16)} ${t('nav.plans')}</a><a role="menuitem" href="#/settings">${icon('settings', 16)} ${t('nav.settings')}</a>
              <a role="menuitem" href="#/info">${icon('help', 16)} ${t('nav.info')}</a><a role="menuitem" href="#/info?legal">${icon('info', 16)} ${t('info.tab.legal')}</a>
              ${signedIn() ? html`<button role="menuitem" data-act="sign-out">${icon('external', 16)} ${t('account.signOut')}</button>` : html`<button role="menuitem" data-act="open-signin">${icon('account', 16)} ${t('signin.signIn')}</button>`}</div></div>
        </div>
      </div>
      <div id="subnav-slot"></div>
    </header>
    <div id="viewing-slot"></div>
    <div id="example-slot"></div>
    <main id="main" tabindex="-1"></main>
    <footer class="foot">
      <div class="foot-in">
        <div class="foot-brand"><img src="/icons/logo.svg" alt="" width="40" height="40"><div><strong>${BRAND.app}</strong><p>${t('brand.tagline')}</p></div></div>
        <div id="side-promo"></div>
        <ul class="foot-links">${footLinks()}</ul>
      </div>
      <p class="foot-legal">© ${new Date().getFullYear()} ${BRAND.company}</p>
    </footer>
  </div>`;
}

let lastShown = ''; // numbers count up when a screen opens, not on every small update
/** When a screen opens: a label naming its step of the journey above the title, and one short entrance. */
function enterPage(main) {
  main.classList.remove('page-in'); void main.offsetWidth; main.classList.add('page-in');
}
function renderView(keepScroll = false) {
  const main = $('#main'); if (!main) return;
  const y = window.scrollY;
  const v = views[route];
  document.body.dataset.route = route;
  try { main.innerHTML = v.render().s; v.mount?.(); if (route !== lastShown) { lastShown = route; enterPage(main); animateNumbers(main); } }
  catch (e) { console.error('[Arcton] render failed', e); main.innerHTML = html`<div class="card empty-hero"><h2>${t('common.errorGeneric')}</h2><button class="btn btn-primary" data-act="go" data-route="overview">${t('nav.overview')}</button></div>`.s; }
  updateChrome();
  document.title = `${t(`nav.${route}`)} · ${BRAND.app}`;
  if (keepScroll) window.scrollTo(0, y);
  if (pendingAnchor) { document.getElementById(pendingAnchor)?.scrollIntoView(); pendingAnchor = null; }
}

let spinTheme = false;

function renderAll() {
  if (screen !== 'app') return;
  const app = document.getElementById('app');
  app.innerHTML = shell().s;
  renderView(true);
  updateOnline();
}

const rerender = () => renderView(true);
setRerender((o) => { if (screen !== 'app') return; if (o?.full) renderAll(); else rerender(); });

function onRoute() {
  if (screen !== 'app') return;
  route = parseRoute();
  $('#account-menu') && ($('#account-menu').hidden = true);
  renderView();
  if (!pendingAnchor) { window.scrollTo(0, 0); $('#main')?.focus({ preventScroll: true }); }
  if (route !== 'info' && needsConsent()) showConsent();
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
  if (!fn) { console.warn('[Arcton] no handler for', el.dataset.act); return; }
  try { const r = fn(el, e); if (r?.catch) r.catch((err) => { console.error(err); toast(t('common.errorGeneric'), 'error'); }); }
  catch (err) { console.error(err); toast(t('common.errorGeneric'), 'error'); }
});

const textual = (el) => el.matches('input[type="text"], input[type="search"], input[type="number"], input[type="color"], input[type="range"], textarea');
document.addEventListener('input', (e) => { const el = e.target.closest('[data-in]'); if (el && textual(el)) inputs[el.dataset.in]?.(el, e); });
document.addEventListener('change', (e) => { const el = e.target.closest('[data-in]'); if (el && !textual(el)) inputs[el.dataset.in]?.(el, e); });

actions.go = (el) => {
  pendingAnchor = el.dataset.hash || null;
  const target = `#/${el.dataset.route}`;
  if (location.hash === target) onRoute(); else location.hash = target;
};
window.addEventListener('scroll', () => document.body.classList.toggle('is-scrolled', window.scrollY > 40), { passive: true });
actions['trail-open'] = () => {
  let root = document.getElementById('trail-root');
  if (!root) { root = document.createElement('div'); root.id = 'trail-root'; document.body.append(root); }
  root.innerHTML = trailMap(route, journeyState()).s; document.body.classList.add('trail-open');
  root.querySelector('.tm-pt.is-cur, .tm-pt')?.focus();
};
actions['trail-close'] = () => { const root = document.getElementById('trail-root'); if (root) root.innerHTML = ''; document.body.classList.remove('trail-open'); };
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('trail-open')) actions['trail-close'](); });
actions['account-menu'] = (el) => {
  const m = $('#account-menu'); m.hidden = !m.hidden; el.setAttribute('aria-expanded', String(!m.hidden));
  if (!m.hidden) $('a', m).focus();
};
actions['toggle-theme'] = (el) => { themeTransition(el, () => { spinTheme = true; toggleTheme(); renderAll(); spinTheme = false; }); };
inputs['lang-select'] = (el) => setLang(el.value);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { const m = $('#account-menu'); if (m && !m.hidden) { m.hidden = true; $('[data-act="account-menu"]')?.focus(); } }
});


/* ---------- "where does this number come from?" tooltip ---------- */
// Any element with data-src="<key>" explains its origin on hover, keyboard focus or a long press with a finger.
let tipEl = null; let tipTimer = null; let longPress = null;
function showTip(el) {
  const key = el.dataset.src; if (!key) return;
  tipEl ||= Object.assign(document.createElement('div'), { id: 'src-tip', role: 'tooltip' });
  if (!tipEl.isConnected) document.body.appendChild(tipEl);
  tipEl.innerHTML = html`<strong>${t('src.label')}</strong><p>${t(`src.${key}`)}</p>`.s;
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

// An email link opened in a tab that already runs the app only changes the hash: start over to read it.
window.addEventListener('hashchange', () => { if (/(^|[#&])(access_token|error_description)=/.test(location.hash)) location.reload(); else onRoute(); });
window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);
onLang(() => { if (screen === 'signin') repaintSignin(); else if (screen === 'landing') repaintLanding(); else renderAll(); closeModal(); });
onInstallChange(() => { if (route === 'settings') rerender(); });

/* ---------- accounts ---------- */
actions['sign-out'] = async () => { await flush(); await signOut('signout'); };
actions['example-load'] = async () => {
  if (getState().business.loaded && !isExample() && !(await confirmDialog(t('example.replaceTitle'), t('example.replaceBody'), t('example.load')))) return;
  loadExample(); toast(t('example.loaded'), 'success'); go('overview'); renderAll();
};
actions['example-clear'] = async () => {
  if (!(await confirmDialog(t('example.clearTitle'), t('example.clearBody'), t('example.clear')))) return;
  clearExample(); toast(t('example.cleared'), 'info'); go('overview'); renderAll();
};
actions['open-signin'] = () => { screen = 'signin'; showSignin({ onDone: async (k) => { await enterApp(k); if (isAdmin()) go('admin'); }, onBack: () => startApp() }); };
actions['admin-exit'] = async () => { await closeClient(); go('admin'); renderAll(); };

// Data changed on the server side (sign-in load, an edit from elsewhere, admin opening a client): redraw.
subscribe((_s, meta) => { if (meta.remote && screen === 'app') renderAll(); });
onCloud((e) => { if (e.conflict) toast(t('admin.toastConflict'), 'info'); });
onAuthChange((s, reason) => {
  if (s || !authOn()) { if (!s && !authOn() && route === 'admin') go('overview'); if (screen === 'app' && reason !== 'refresh') renderAll(); return; }
  closeModal(); history.replaceState(null, '', location.pathname + location.search);
  const notice = reason === 'disabled' ? { kind: 'error', text: authErrorText('account_disabled') } : reason === 'expired' ? { kind: 'info', text: authErrorText('session_expired') } : null;
  screen = 'signin'; showSignin({ notice, onDone: enterApp });
});

function showLoading() {
  screen = 'loading';
  document.getElementById('app').innerHTML = html`<div class="auth-loading" role="status"><img src="/icons/logo.svg" alt="" width="56" height="56"><p>${t('signin.loading')}</p></div>`.s;
}

/** Signed in (or accounts off): load the account's business, then show the app. */
async function enterApp(kind = 'resume') {
  if (authOn() && signedIn()) {
    refreshMe().catch(() => {}); // plan may have changed since the last visit
    if (kind === 'resume' && localOwner() === userId()) { startApp(); loadOwn(); return; } // this browser already holds their data: open now, refresh quietly
    showLoading();
    const r = await loadOwn();
    if (!signedIn()) return; // signed out meanwhile (disabled / expired): the sign-in screen is already up
    if (r === 'error') { screen = 'signin'; return showSignin({ notice: { kind: 'error', text: authErrorText('network') }, onDone: enterApp }); }
  }
  startApp();
}

/** Front page for visitors; its buttons lead to sign-up, sign-in or the example business. */
function openLanding() {
  screen = 'landing';
  const auth = (mode) => () => { screen = 'signin'; showSignin({ mode, onDone: enterApp, onBack: openLanding, backKey: 'signin.backHome' }); };
  showLanding({ signup: auth('signup'), signin: auth('signin') });
}

function startApp() {
  screen = 'app';
  route = parseRoute();
  renderAll();
  document.documentElement.dataset.ready = '1';
  if (needsConsent()) showConsent(); // first visit, or the terms changed: ask before anything is used
}

/* ---------- boot ---------- */
async function boot() {
  initTheme(); initLang(); applyDisplay();
  const q = new URLSearchParams(location.search);
  if (q.get('lang') && LANGS.some((l) => l.code === q.get('lang'))) { setLang(q.get('lang')); }
  if (q.get('theme') === 'dark' || q.get('theme') === 'light') { document.documentElement.dataset.theme = q.get('theme'); }
  registerSW();
  window.__arcton = window.__localboost = { go, getState }; // debug handle for QA
  await launchGate(); // before launch day: the coming-soon page, until unlocked
  useAppStyles(); // the app has its own stylesheet; the launch page keeps its own
  const link = readAuthHash(); // came back from an email link (confirm sign-up / reset password)
  const on = await loadAuthConfig();
  if (!on) return startApp();
  if (link?.error) { screen = 'signin'; return showSignin({ notice: { kind: 'error', text: authErrorText(link.error) }, onDone: enterApp }); }
  if (link?.session) {
    const r = await adoptLinkSession(link.session);
    if (r.error) { screen = 'signin'; return showSignin({ notice: { kind: 'error', text: authErrorText(r.error === 'session_expired' ? 'link_invalid' : r.error) }, onDone: enterApp }); }
    if (link.type === 'recovery') { screen = 'signin'; return showSignin({ mode: 'newpw', onDone: enterApp }); }
    return enterApp('link');
  }
  if (!signedIn()) return openLanding();
  return enterApp('resume');
}
boot();

// opening screen: shown briefly on every cold start, then fades out
const splash = document.getElementById('splash');
if (splash) {
  const minShow = 1300;
  setTimeout(() => { splash.classList.add('gone'); setTimeout(() => splash.remove(), 450); }, minShow);
}

