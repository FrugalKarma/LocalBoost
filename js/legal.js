// Acceptance of the Terms, the Privacy Notice and the AI notice.
// Asked once per version (LEGAL_VERSION). Kept on this device and, when signed in, on the account
// (profiles.terms_version / terms_accepted_at) so there is a record of who accepted what and when.
import { html, icon, $ } from './core.js';
import { t } from './i18n.js';
import { LEGAL_VERSION, BRAND } from './brand.js';
import { authOn, signedIn, getSession, recordConsent } from './auth.js';
import { viewingClient } from './cloud.js';

const KEY = 'arcton.consent';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
let open = false;

export const consentRecord = () => {
  const local = read(); const s = getSession();
  if (s?.termsVersion === LEGAL_VERSION) return { v: s.termsVersion, at: s.termsAt || local?.at || null, where: 'account' };
  return local?.v === LEGAL_VERSION ? { ...local, where: 'device' } : null;
};
export const needsConsent = () => !viewingClient() && !consentRecord();

export function showConsent() {
  if (open || !needsConsent()) return;
  if (/^#\/info/.test(location.hash)) return; // reading the texts: ask again when they leave
  open = true;
  const m = $('#modal-root'); m.hidden = false;
  const pts = [['help', 'consent.p1t', 'consent.p1'], ['sparkle', 'consent.p2t', 'consent.p2'], ['eye', 'consent.p3t', 'consent.p3'], ['check', 'consent.p4t', 'consent.p4']];
  m.innerHTML = html`<div class="modal-backdrop"></div>
    <div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="consent-title">
      <div class="modal-head"><h2 id="consent-title">${t('consent.title', { app: BRAND.app })}</h2></div>
      <div class="modal-body consent"><p>${t('consent.intro', { app: BRAND.app, company: BRAND.company })}</p>
        <ul class="consent-points">${pts.map(([ic, h, b]) => html`<li><span class="info-ic">${icon(ic, 18)}</span><div><b>${t(h)}</b><span>${t(b)}</span></div></li>`)}</ul>
        <p class="consent-links"><a href="#/info?terms" data-consent-read>${t('legal.terms')}</a><a href="#/info?privacy" data-consent-read>${t('legal.privacy')}</a><a href="#/info?ai" data-consent-read>${t('legal.ai')}</a><a href="#/info?cookies" data-consent-read>${t('legal.cookies')}</a></p>
        <label class="check"><input type="checkbox" id="consent-ok"><span>${t('consent.agree', { company: BRAND.company })}</span></label>
        <label class="check"><input type="checkbox" id="consent-age"><span>${t('consent.age')}</span></label>
      </div>
      <div class="modal-foot"><button class="btn btn-primary" data-consent-accept disabled>${t('consent.accept')}</button></div></div>`.s;
  const btn = $('[data-consent-accept]', m);
  const sync = () => { btn.disabled = !($('#consent-ok', m).checked && $('#consent-age', m).checked); };
  m.addEventListener('change', sync);
  const close = () => { m.hidden = true; m.innerHTML = ''; open = false; m.removeEventListener('change', sync); m.removeEventListener('click', onClick); document.removeEventListener('keydown', trap, true); };
  const onClick = async (e) => {
    if (e.target.closest('[data-consent-read]')) { close(); return; } // the link navigates to the text
    if (!e.target.closest('[data-consent-accept]') || btn.disabled) return;
    const rec = { v: LEGAL_VERSION, at: new Date().toISOString() };
    try { localStorage.setItem(KEY, JSON.stringify(rec)); } catch { /* storage blocked: asked again next time */ }
    if (authOn() && signedIn()) recordConsent(LEGAL_VERSION).catch(() => {});
    close();
  };
  const trap = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); } };
  m.addEventListener('click', onClick);
  document.addEventListener('keydown', trap, true);
  $('#consent-ok', m).focus();
}

/** Clears the record on this device (used by "withdraw consent" in Settings). */
export function withdrawConsent() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
