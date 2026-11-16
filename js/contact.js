// "Talk to us": people interested in Arcton Ai write here instead of calling a public number.
// The message is stored and the owner gets a notification on their phone (lib/auth-core.mjs op 'contact').
// One form, used on the launch page, the front page and Info → Contact. Submits are handled here, for every copy.
import { html } from './core.js';
import { t, getLang } from './i18n.js';
import { apiUrl } from './api.js';

const sent = new Set(); // places where this visitor already sent a message (until the page reloads)

/** The form, or the thank-you note once sent. `from`: 'launch' | 'landing' | 'info'. */
export function contactForm(from, err = '') {
  if (sent.has(from)) return html`<div class="ct-done" role="status"><b>${t('ct.doneT')}</b><p>${t('ct.done')}</p></div>`;
  const id = (k) => `ct-${from}-${k}`;
  return html`<form class="ct-form" data-contact="${from}" novalidate>
    <div class="ct-row"><label class="field" for="${id('name')}"><span>${t('ct.name')}</span><input id="${id('name')}" name="name" autocomplete="name" maxlength="80" required></label>
      <label class="field" for="${id('reply')}"><span>${t('ct.reply')}</span><input id="${id('reply')}" name="reply" autocomplete="email" inputmode="email" maxlength="120" placeholder="${t('ct.replyPh')}" required></label></div>
    <label class="field" for="${id('msg')}"><span>${t('ct.msg')}</span><textarea id="${id('msg')}" name="message" rows="4" maxlength="2000" placeholder="${t('ct.msgPh')}" required></textarea></label>
    <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" class="ct-hp">
    <label class="ct-consent"><input type="checkbox" name="consent" required><span>${t('ct.consent')} <button type="button" class="link-btn ct-priv" data-ct-privacy>${t('legal.privacy')}</button></span></label>
    ${err ? html`<p class="ct-err" role="alert">${t(err)}</p>` : ''}
    <button type="submit" class="${from === 'launch' ? 'ct-send' : 'btn btn-primary ct-send'}">${t('ct.send')}</button>
  </form>`;
}

const ERR = { invalid_reply: 'ct.errReply', consent_required: 'ct.errConsent', rate_limited: 'signin.err.rate_limited', network: 'signin.err.network', bad_request: 'ct.errFill' };

document.addEventListener('submit', async (e) => {
  const f = e.target.closest?.('form[data-contact]'); if (!f) return;
  e.preventDefault();
  const from = f.dataset.contact; const v = (k) => (f.elements[k]?.value || '').trim();
  const show = (err) => { // keeps what the person typed
    const keep = { name: v('name'), reply: v('reply'), message: v('message'), consent: f.elements.consent.checked };
    const box = document.createElement('div'); box.innerHTML = contactForm(from, err).s; const nf = box.firstElementChild; f.replaceWith(nf);
    if (nf.tagName !== 'FORM') { nf.setAttribute('tabindex', '-1'); nf.focus(); return; }
    for (const [k, x] of Object.entries(keep)) { if (k === 'consent') nf.elements.consent.checked = x; else nf.elements[k].value = x; }
    nf.querySelector('.ct-err')?.scrollIntoView({ block: 'nearest' });
    (err === 'ct.errReply' ? nf.elements.reply : err === 'ct.errConsent' ? nf.elements.consent : nf.elements.name).focus();
  };
  if (!v('name') || !v('reply') || v('message').length < 2) return show('ct.errFill');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('reply')) && !/^\+?[\d\s().-]{6,20}$/.test(v('reply'))) return show('ct.errReply');
  if (!f.elements.consent.checked) return show('ct.errConsent');
  const btn = f.querySelector('.ct-send'); btn.disabled = true; btn.textContent = t('ct.sending');
  let r; try {
    const res = await fetch(apiUrl('/api/auth'), { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ op: 'contact', name: v('name'), reply: v('reply'), message: v('message'), consent: true, website: v('website'), from, lang: getLang() }) });
    r = res.ok ? { ok: true } : { error: (await res.json().catch(() => ({}))).error || 'failed' };
  } catch { r = { error: 'network' }; }
  if (r.ok) { sent.add(from); return show(''); }
  show(ERR[r.error] || 'ct.errFail');
});
document.addEventListener('click', async (e) => {
  if (!e.target.closest?.('[data-ct-privacy]')) return;
  const { openLegal } = await import('./legalText.js'); openLegal('privacy');
});
