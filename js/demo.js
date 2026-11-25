// Public demo (arcton.site/?demo): a visitor without an account explores the example café, with a guided tour
// of pop-ups. Nothing reaches the server in demo: the AI uses its local rules, publishing and Google look-ups are off.
import { html, icon, toast } from './core.js';
import { t } from './i18n.js';
import { go } from './registry.js';
import { isExample, loadExample, clearExample } from './example.js';

const KEY = 'arcton-demo';
export const isDemo = () => { try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; } };
const setDemo = (on) => { try { if (on) sessionStorage.setItem(KEY, '1'); else sessionStorage.removeItem(KEY); } catch { /* private mode: demo lasts this page only */ } };

/** Actions that would call Google or publish something: refused in demo with one friendly line. */
export const DEMO_BLOCKED = new Set(['lookup-go', 'lookup-pick', 'qs-go', 'qs-pick', 'scan-comp', 'collect-signals', 'bk-push-on', 'bk-push-off', 'unpublish-site']);
export const demoBlocked = () => toast(t('demo.blocked'), 'info', 4200);

export function startDemo({ tour = true } = {}) {
  setDemo(true);
  if (!isExample()) loadExample('cafe');
  if (tour) setTimeout(() => startTour(), 700);
}
export function exitDemo() { stopTour(); setDemo(false); if (isExample()) clearExample(); }

/* ---------- guided tour ---------- */
// Each step opens a screen and points at one thing on it; a step whose target is missing shows centred.
const STEPS = [
  { key: 'welcome', route: 'overview' },
  { key: 'next', route: 'overview', sel: ['.cr-move', '.cr-grid', '.next-bar'] },
  { key: 'signals', route: 'signals', sel: ['.sig-card', '.theme-list', '.card'] },
  { key: 'analysis', route: 'diagnosis', sel: ['[data-act="run-analysis"]', '.opp2', '.card'] },
  { key: 'compare', route: 'competitors', sel: ['.cx-kpis'] },
  { key: 'goals', route: 'competitors', sel: ['.cx-goals'] },
  { key: 'studio', route: 'pack', sel: ['.studio-tabs', '.tool-card', '.card'] },
  { key: 'site', route: 'website', sel: ['.site-preview', '.site-frame', '[data-act="gen-site"]', '.card'] },
  { key: 'ask', route: null, sel: ['.btn-ask'] },
  { key: 'end', route: null },
];
let step = -1; let root = null; let target = null;

export function startTour(at = 0) { step = at; show(); }
export function stopTour() {
  step = -1; target = null; root?.remove(); root = null;
  window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); document.removeEventListener('keydown', onKey);
}

function onKey(e) {
  if (step < 0) return;
  if (e.key === 'Escape') { e.preventDefault(); stopTour(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
}
function move(d) { const n = step + d; if (n < 0) return; if (n >= STEPS.length) return stopTour(); step = n; show(); }

const find = (sels = []) => { for (const s of sels) { const el = [...document.querySelectorAll(s)].find((x) => x.getClientRects().length && x.offsetParent !== null); if (el) return el; } return null; };

function show() {
  const s = STEPS[step]; if (!s) return stopTour();
  const here = (location.hash.replace(/^#\/?/, '').split(/[/?]/)[0]) || 'overview';
  const wait = s.route && s.route !== here ? 520 : 60;
  if (s.route && s.route !== here) go(s.route);
  if (!root) {
    root = document.createElement('div'); root.className = 'tour'; document.body.append(root);
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true); document.addEventListener('keydown', onKey);
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tour]'); if (!b) return;
      const k = b.dataset.tour;
      if (k === 'next') move(1); else if (k === 'back') move(-1); else if (k === 'close') stopTour();
      else if (k === 'signup') { stopTour(); document.dispatchEvent(new CustomEvent('arcton:demo-signup')); }
    });
  }
  root.innerHTML = '';
  setTimeout(() => {
    if (step < 0 || STEPS[step] !== s) return;
    target = s.sel ? find(s.sel) : null;
    const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    // phones: the card is a sheet at the bottom, so bring the target to the top of the screen instead of the middle
    if (target && window.innerWidth <= 640) window.scrollTo({ top: window.scrollY + target.getBoundingClientRect().top - 130, behavior });
    else if (target) target.scrollIntoView({ block: 'center', behavior });
    const last = step === STEPS.length - 1; const n = STEPS.length - 2; // welcome and end are not counted
    root.innerHTML = html`<div class="tour-spot" aria-hidden="true"></div>
      <div class="tour-card ${target ? '' : 'is-center'}" role="dialog" aria-modal="false" aria-labelledby="tour-t" tabindex="-1">
        ${step > 0 && !last ? html`<p class="tour-n">${t('demo.tour.count', { n: step, total: n })}</p>` : html`<p class="tour-n">${icon('sparkle', 16)} ${t('demo.tour.label')}</p>`}
        <h2 id="tour-t">${t(`demo.tour.${s.key}.title`)}</h2>
        <p>${t(`demo.tour.${s.key}.body`)}</p>
        <div class="tour-actions">
          ${last ? html`<button type="button" class="btn btn-secondary btn-sm" data-tour="close">${t('demo.tour.explore')}</button><button type="button" class="btn btn-primary btn-sm" data-tour="signup">${t('demo.signup')}</button>`
            : html`<button type="button" class="link-btn" data-tour="close">${t('demo.tour.skip')}</button><span class="tour-sp"></span>
              ${step > 0 ? html`<button type="button" class="btn btn-secondary btn-sm" data-tour="back">${t('demo.tour.back')}</button>` : ''}
              <button type="button" class="btn btn-primary btn-sm" data-tour="next">${t(step === 0 ? 'demo.tour.start' : 'demo.tour.go')} ${icon('next', 15)}</button>`}
        </div></div>`.s;
    place(); setTimeout(place, 420); // again after the smooth scroll settles
    root.querySelector('.tour-card')?.focus({ preventScroll: true });
  }, wait);
}

/** Spotlight on the target and the card beside it (below, above, or as a bottom sheet on phones). */
function place() {
  if (!root) return;
  const spot = root.querySelector('.tour-spot'); const card = root.querySelector('.tour-card'); if (!spot || !card) return;
  if (!target || !target.isConnected) { spot.style.display = 'none'; return; }
  const r = target.getBoundingClientRect(); const pad = 8;
  Object.assign(spot.style, { display: 'block', left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
  if (window.innerWidth <= 640) { card.classList.add('is-sheet'); card.style.left = card.style.top = ''; return; }
  card.classList.remove('is-sheet');
  const cw = card.offsetWidth; const ch = card.offsetHeight; const vw = window.innerWidth; const vh = window.innerHeight; const gap = 16;
  let top = r.bottom + gap; let left = Math.min(vw - cw - 12, Math.max(12, r.left + r.width / 2 - cw / 2));
  if (top + ch > vh - 12) top = r.top - ch - gap;
  if (top < 12) { // no room above or below a tall target: beside it, on the wider side
    top = Math.min(vh - ch - 12, Math.max(12, r.top + Math.min(r.height, vh) / 2 - ch / 2));
    left = r.left > vw - r.right ? Math.max(12, r.left - cw - gap) : Math.min(vw - cw - 12, r.right + gap);
  }
  card.style.left = `${left}px`; card.style.top = `${top}px`;
}
