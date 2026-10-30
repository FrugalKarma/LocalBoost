// PWA: service worker registration, controlled updates, install prompt.
import { toast } from './core.js';
import { t } from './i18n.js';

let deferred = null;
const subs = new Set();
export const onInstallChange = (fn) => { subs.add(fn); return () => subs.delete(fn); };
const notify = () => subs.forEach((fn) => fn());

export const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const canPrompt = () => !!deferred;

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; notify(); });
window.addEventListener('appinstalled', () => { deferred = null; toast(t('pwa.installed'), 'success'); notify(); });

export async function promptInstall() {
  if (!deferred) return 'unavailable';
  deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null; notify();
  return outcome;
}

export async function registerSW() {
  if (!('serviceWorker' in navigator) || !/^https:|^http:\/\/localhost|^http:\/\/127\.0\.0\.1/.test(location.origin)) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    const offer = (worker) => showUpdate(worker);
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) offer(nw); });
    });
    // reload only when an UPDATE took control; the very first install (no previous controller) must not interrupt the user
    let hadController = !!navigator.serviceWorker.controller; let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) { hadController = true; return; }
      if (!reloading) { reloading = true; location.reload(); }
    });
  } catch (e) { console.warn('[LocalBoost] service worker not registered:', e.message); }
}

function showUpdate(worker) {
  const bar = document.getElementById('update-bar');
  if (!bar) return;
  bar.hidden = false;
  bar.innerHTML = `<span></span><button class="btn btn-primary btn-sm" type="button"></button>`;
  bar.firstChild.textContent = t('pwa.updateReady');
  const b = bar.querySelector('button'); b.textContent = t('pwa.reload');
  b.onclick = () => worker.postMessage({ type: 'SKIP_WAITING' });
}
