// Sign-in screen (shown instead of the app when accounts are on and nobody is signed in).
// Modes: signin · signup · reset (ask for a link) · resetSent · confirm (check inbox) · newpw (from a reset link).
import { html, icon, $, toast, limit } from '../core.js';
import { t, LANGS, getLang } from '../i18n.js';
import { signIn, signUp, sendReset, changePassword, ownerSignIn, authOn } from '../auth.js';
import { BRAND, LEGAL_VERSION } from '../brand.js';
import { openLegal } from '../legalText.js';

let mode = 'signin';
let email = '';
let notice = null; // { kind: 'error' | 'info', text }
let busy = false;
let showPw = false;
let agreed = false;
let done = () => {};

const KNOWN = ['invalid_credentials', 'email_not_confirmed', 'account_disabled', 'email_taken', 'weak_password', 'same_password', 'invalid_email', 'rate_limited',
  'signup_disabled', 'network', 'auth_unreachable', 'database_unreachable', 'session_expired', 'link_invalid', 'auth_not_configured', 'terms_required', 'accounts_soon'];
export const authErrorText = (code) => t(`signin.err.${code === 'otp_expired' || code === 'access_denied' ? 'link_invalid' : KNOWN.includes(code) ? code : 'generic'}`);

/** onDone(kind) runs after a successful sign-in, sign-up or password change. */
let onBack = null;
let backKey = 'signin.backToApp';
export function showSignin(opts = {}) {
  onBack = opts.onBack || null; backKey = opts.backKey || 'signin.backToApp';
  mode = opts.mode || 'signin';
  notice = opts.notice || null;
  if (opts.onDone) done = opts.onDone;
  busy = false; paint();
}

const points = () => html`<ul class="auth-points">${['qs.p1', 'land.truth.p2', 'qs.p3'].map((k) => html`<li>${icon('check', 16)}<span>${t(k)}</span></li>`)}</ul>`;

function pwField(id, label, autocomplete) {
  return html`<label class="field"><span>${label}</span>
    <span class="pw-wrap"><input id="${id}" type="${showPw ? 'text' : 'password'}" autocomplete="${autocomplete}" minlength="8" maxlength="72" required>
    <button type="button" class="pw-toggle" data-auth="toggle-pw" aria-pressed="${showPw}">${showPw ? t('signin.hide') : t('signin.show')}</button></span></label>`;
}
const emailField = () => html`<label class="field"><span>${t('signin.email')}</span><input id="auth-email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" maxlength="254" required value="${email}"></label>`;
const submit = (label) => html`<button type="submit" class="btn btn-primary auth-submit" ${busy ? 'disabled' : ''}>${busy ? html`<span class="spin" aria-hidden="true"></span>${t('signin.working')}` : label}</button>`;

function form() {
  if (mode === 'confirm' || mode === 'resetSent') {
    const confirm = mode === 'confirm';
    return html`<div class="auth-msg"><span class="auth-msg-ic" aria-hidden="true">${icon('check', 26)}</span>
      <h2>${t(confirm ? 'signin.confirmTitle' : 'signin.resetSentTitle')}</h2>
      <p>${t(confirm ? 'signin.confirmBody' : 'signin.resetSent', { email })}</p>
      <button class="btn btn-secondary" data-auth="mode" data-mode="signin">${t('signin.back')}</button></div>`;
  }
  if (mode === 'reset') {
    return html`<form data-auth-form="reset" novalidate><h2>${t('signin.resetTitle')}</h2><p class="auth-lead">${t('signin.resetBody')}</p>
      ${emailField()}${submit(t('signin.resetSend'))}
      <button type="button" class="link-btn" data-auth="mode" data-mode="signin">${t('signin.back')}</button></form>`;
  }
  if (mode === 'newpw') {
    return html`<form data-auth-form="newpw" novalidate><h2>${t('signin.newTitle')}</h2><p class="auth-lead">${t('signin.passwordHint')}</p>
      ${pwField('auth-password', t('signin.passwordNew'), 'new-password')}${submit(t('signin.newSave'))}</form>`;
  }
  const up = mode === 'signup';
  if (!authOn()) return html`<form data-auth-form="signin" novalidate><h2>${t('signin.signInTitle')}</h2>
      ${emailField()}${pwField('auth-password', t('signin.password'), 'current-password')}${submit(t('signin.signIn'))}
      <p class="small auth-terms">${t('signin.soonNote')}</p></form>`;
  return html`<div class="auth-tabs" role="tablist">
      <button role="tab" aria-selected="${!up}" data-auth="mode" data-mode="signin">${t('signin.signInTab')}</button>
      <button role="tab" aria-selected="${up}" data-auth="mode" data-mode="signup">${t('signin.signUpTab')}</button></div>
    <form data-auth-form="${mode}" novalidate>
      <h2>${t(up ? 'signin.signUpTitle' : 'signin.signInTitle')}</h2>
      ${emailField()}
      ${pwField('auth-password', t('signin.password'), up ? 'new-password' : 'current-password')}
      ${up ? html`<p class="small auth-hint">${t('signin.passwordHint')}</p>` : html`<button type="button" class="link-btn auth-forgot" data-auth="mode" data-mode="reset">${t('signin.forgot')}</button>`}
      ${submit(t(up ? 'signin.signUp' : 'signin.signIn'))}
      ${up ? html`<label class="check auth-consent"><input type="checkbox" id="auth-agree" ${agreed ? 'checked' : ''}><span>${t('signin.agree', { company: BRAND.company })}
        <button type="button" class="link-btn" data-auth="legal" data-doc="terms">${t('legal.terms')}</button> · <button type="button" class="link-btn" data-auth="legal" data-doc="privacy">${t('legal.privacy')}</button> · <button type="button" class="link-btn" data-auth="legal" data-doc="ai">${t('legal.ai')}</button></span></label>` : html`<p class="small auth-terms">${t('signin.signinLegal')} <button type="button" class="link-btn" data-auth="legal" data-doc="privacy">${t('legal.privacy')}</button></p>`}
    </form>`;
}

function paint() {
  const app = document.getElementById('app'); if (!app) return;
  const keepPw = $('#auth-password')?.value || ''; // a redraw (error message, language) must not wipe what was typed
  const keepAgree = $('#auth-agree')?.checked; if (keepAgree != null) agreed = keepAgree;
  document.body.dataset.route = 'signin';
  document.title = `${t('signin.signInTab')} · ${BRAND.app}`;
  app.innerHTML = html`<div class="auth">
    <aside class="auth-side">
      <div class="auth-brand"><img src="/icons/logo.svg" alt="" width="40" height="40"><strong>${BRAND.app}</strong></div>
      <div class="orb auth-orb" aria-hidden="true"><span class="orb-glow"></span><span class="orb-core"></span><span class="orb-sheen"></span><img src="/icons/mark-light.svg" alt="" width="96" height="92"></div>
      <p class="auth-tag">${t('signin.tagline')}</p>
      ${points()}
    </aside>
    <main class="auth-main" id="main" tabindex="-1">
      <div class="auth-top">${onBack ? html`<button type="button" class="btn btn-ghost btn-sm auth-back" data-auth="back">${icon('prev', 16)} ${t(backKey)}</button>` : ''}<label class="lang"><span class="sr-only">${t('settings.language')}</span>${icon('globe', 16)}<select data-in="lang-select" aria-label="${t('settings.language')}">${LANGS.map((l) => html`<option value="${l.code}" ${getLang() === l.code ? 'selected' : ''}>${l.label}</option>`)}</select></label></div>
      <section class="auth-card">
        ${notice ? html`<p class="auth-notice auth-${notice.kind}" role="${notice.kind === 'error' ? 'alert' : 'status'}">${notice.text}</p>` : ''}
        ${form()}
      </section>
    </main></div>`.s;
  if (keepPw && $('#auth-password') && mode !== 'newpw') $('#auth-password').value = keepPw;
  const focus = notice?.kind === 'error' && $('#auth-password') && email ? $('#auth-password') : $('#auth-email') || $('#auth-password') || $('.auth-card button');
  focus?.focus({ preventScroll: true });
}

const fail = (code) => { busy = false; notice = { kind: 'error', text: authErrorText(code) }; paint(); };

async function onSubmit(kind) {
  if (busy) return;
  const e = $('#auth-email'); const p = $('#auth-password');
  if (e) email = limit(e.value.trim(), 254);
  const pw = p ? p.value : '';
  if (kind === 'signin' && e && email && !email.includes('@')) { // owner sign-in by username
    if (!pw) return fail('invalid_credentials');
    busy = true; notice = null; paint();
    const r = await ownerSignIn(email, pw);
    return r.session ? done('signin') : fail(r.error === 'rate_limited' ? 'rate_limited' : 'invalid_credentials');
  }
  if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail('invalid_email');
  if (!authOn() && kind === 'signin') return fail('accounts_soon');
  if ((kind === 'signup' || kind === 'newpw') && pw.length < 8) return fail('weak_password');
  if (kind === 'signin' && !pw) return fail('invalid_credentials');
  if (kind === 'signup') { agreed = !!$('#auth-agree')?.checked; if (!agreed) return fail('terms_required'); }
  busy = true; notice = null; paint();
  if (kind === 'signin') {
    const r = await signIn(email, pw);
    return r.session ? done('signin') : fail(r.error);
  }
  if (kind === 'signup') {
    const r = await signUp(email, pw, LEGAL_VERSION);
    if (r.session) return done('signup');
    if (r.confirm) { busy = false; mode = 'confirm'; return paint(); }
    return fail(r.error);
  }
  if (kind === 'reset') {
    const r = await sendReset(email);
    if (r.error) return fail(r.error);
    busy = false; mode = 'resetSent'; return paint();
  }
  if (kind === 'newpw') {
    const r = await changePassword(pw);
    if (r.error) return fail(r.error);
    toast(t('signin.newDone'), 'success');
    return done('newpw');
  }
}

document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-auth-form]'); if (!f) return;
  e.preventDefault(); onSubmit(f.dataset.authForm);
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-auth]'); if (!b) return;
  if (b.dataset.auth === 'mode') {
    const em = $('#auth-email'); if (em) email = em.value.trim();
    mode = b.dataset.mode; notice = null; paint();
  }
  if (b.dataset.auth === 'back') { onBack?.(); return; }
  if (b.dataset.auth === 'legal') { agreed = !!$('#auth-agree')?.checked; openLegal(b.dataset.doc); return; }
  if (b.dataset.auth === 'toggle-pw') {
    const inp = $('#auth-password'); const v = inp?.value || ''; const em = $('#auth-email'); if (em) email = em.value.trim();
    showPw = !showPw; paint(); const n = $('#auth-password'); if (n) { n.value = v; n.focus(); }
  }
});
export const repaintSignin = () => paint();
