// Plans: what each one includes, the owner's current plan and how to change it.
// Paid plans are bought by bank transfer: the client sees the details and a reference, tells us it is sent,
// and the admin switches the plan when the money arrives (Admin area). Card payments are not used.
import { html, icon, openModal, toast, copyText, $ } from '../core.js';
import { actions } from '../registry.js';
import { BRAND, paymentsOpen } from '../brand.js';
import { t, ta, getLang } from '../i18n.js';
import { pageHead } from './shared.js';
import { catalog, MONTHLY, SETUP_FROM } from '../catalog.js';
export { catalog };
import { currentPlan, PLAN_RANK, noPlanPrompt, CREDITS, CREDIT_USES, CREDIT_PACKS, creditsText } from '../plans.js';
import { authOn, signedIn, userEmail, userId, supportEmail, requestPlan, planRequest, planUntil, credits, requestCredits, refreshMe } from '../auth.js';

// No free plan: a new account sees everything but needs a plan (or a free trial the owner grants) to use it.
// Internal ids stay 'pro' and 'business' (database, server): 'pro' is shown as Growth, 'business' as Custom Premium.
export const PLANS = [
  { id: 'pro', price: 49.99, featured: true, video: 'growth' },
  // Custom Premium: the website is paid once (by tier, written offer), then a fixed monthly fee
  { id: 'business', price: null, monthly: MONTHLY, setupFrom: SETUP_FROM, video: 'premium' },
];
/** 49.99 → "49,99" in Romanian, "49.99" in English. */
export const money = (n) => n.toLocaleString(getLang(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const priceText = (p) => (p.price || p.monthly ? `€${money(p.price || p.monthly)}` : t('plans.business.price'));
/** Price line of a plan card: the monthly price, plus the one-time website for Custom Premium. */
export const priceLine = (p, cls) => html`<p class="${cls}"><b>${priceText(p)}</b>${p.price || p.monthly ? html`<span>${t('plans.perMonth')}</span>` : ''}</p>${p.setupFrom ? html`<p class="plan-setup">${t('plans.business.setup', { p: p.setupFrom })}</p>` : ''}`;

// rows of the comparison table: [key, Growth, Custom Premium] (true / false / text key)
const ROWS = [
  ['credits', 'pc.v.cr400', 'pc.v.cr800'],
  ['analysis', true, true],
  ['designer', true, true],
  ['publish', 'pc.v.ownSite', 'pc.v.premiumSite'],
  ['domain', false, true],
  ['bookings', true, true],
  ['stats', true, true],
  ['branding', true, true],
  ['download', true, true],
  ['chat', true, true],
  ['pack', true, true],
  ['replies', true, true],
  ['poster', true, true],
  ['competitors', true, true],
  ['managing', false, true],
  ['support', 'pc.v.supEmail', 'pc.v.supFull'],
];
/** Credits explained: what uses them, how many each plan has, the packs. live: the signed-in client's balance and buy buttons. */
export function creditsInfo(live = false) {
  const c = live ? credits() : null; const left = c ? Math.max(0, c.allow - c.used) : 0;
  const row = (name, val) => html`<li><span>${name}</span><b>${val}</b></li>`;
  return html`<section class="card credits" id="credits" aria-labelledby="cr-h">
    <h2 id="cr-h">${t('credits.title')}</h2><p class="credits-intro">${t('credits.intro')}</p>
    ${c ? html`<div class="credits-now"><p class="credits-big">${t('credits.leftWord')} <b>${fmtN(left + c.extra)}</b></p>
      <div class="credits-meter" role="meter" aria-valuemin="0" aria-valuemax="${c.allow}" aria-valuenow="${left}" aria-label="${t('credits.meterLabel')}"><span style="width:${c.allow ? Math.round((left / c.allow) * 100) : 0}%"></span></div>
      <p class="small muted">${t(c.trial ? 'credits.nowTrial' : 'credits.nowMonth', { left: fmtN(left), allow: fmtN(c.allow) })}${c.extra ? ` ${t('credits.nowExtra', { n: creditsText(c.extra) })}` : ''}</p></div>` : ''}
    <div class="credits-grid">
      <div><h3>${t('credits.allowTitle')}</h3><ul class="credits-list">
        ${row(t('plans.pro.name'), t('credits.perMonth', { n: creditsText(CREDITS.pro) }))}${row(t('plans.business.name'), t('credits.perMonth', { n: creditsText(CREDITS.business) }))}${row(t('credits.trialName'), t('credits.whole', { n: creditsText(CREDITS.trial) }))}</ul>
        <p class="small muted">${t('credits.allowNote')}</p></div>
      <div><h3>${t('credits.costTitle')}</h3><ul class="credits-list">${CREDIT_USES.map(([k, n]) => row(t(`credits.use.${k}`), creditsText(n)))}</ul>
        <p class="small muted">${t('credits.costNote')}</p></div>
    </div>
    <h3>${t('credits.packsTitle')}</h3>
    <div class="credits-packs">${CREDIT_PACKS.map(([n, p]) => html`<div class="credits-pack"><b>+${creditsText(n)}</b><span>${money(p)} €</span>
      ${!c ? '' : c.request === n ? html`<small>${icon('clock', 14)} ${t('credits.pending')}</small>` : html`<button type="button" class="btn btn-secondary btn-sm" data-act="credits-buy" data-pack="${n}">${t(paymentsOpen() ? 'credits.buyOne' : 'credits.askOne')}</button>`}</div>`)}</div>
    <p class="small muted">${t(paymentsOpen() ? 'credits.packsNote' : 'credits.packsFree')}</p>
  </section>`;
}
const fmtN = (n) => n.toLocaleString(getLang());
let creditsAt = 0; // last balance refresh, so a redraw does not ask the server again

/** Short ad that shows what the plan does. Music only, the words are on screen. */
export const planVideo = (p) => html`<figure class="plan-video"><video controls preload="none" playsinline poster="/media/plan-${p.video}.jpg" aria-label="${t('plans.videoLabel', { plan: t(`plans.${p.id}.name`) })}"><source src="/media/plan-${p.video}.mp4" type="video/mp4"></video></figure>`;

export const plans = {
  id: 'plans',
  render() {
    const cur = currentPlan(); const accounts = authOn() && signedIn();
    const cell = (v) => (v === true ? html`<span class="pc-yes" aria-label="${t('pc.yes')}">${icon('check', 18)}</span>` : v === false ? html`<span class="pc-no" aria-label="${t('pc.no')}">—</span>` : html`<span>${t(v)}</span>`);
    const cta = (p) => {
      if (!paymentsOpen() && p.price) return cur === 'free' ? html`<button type="button" class="btn ${p.featured ? 'btn-primary' : 'btn-secondary'}" data-act="trial-ask">${t('noplan.ask')}</button>` : '';
      if (p.price) return html`<button type="button" class="btn ${p.featured ? 'btn-primary' : 'btn-secondary'}" data-act="plan-pay" data-plan="${p.id}">${t('plans.ask', { plan: t(`plans.${p.id}.name`) })}</button>`;
      return html`<button type="button" class="btn btn-secondary" data-act="custom-ask">${t('plans.business.cta')}</button>`;
    };
    return html`${pageHead({ title: t('plans.title'), sub: t('plans.sub') })}
    ${accounts ? html`<div class="plan-now card"><div><p class="tag">${t('plans.yourPlan')}</p><h2>${t(`plans.${cur}.name`)}</h2>
        ${cur === 'free' ? html`<p class="muted">${t('plans.noPlanBody')}</p><button type="button" class="btn btn-secondary" data-act="trial-ask">${icon('star', 16)} ${t(planRequest() === 'trial' ? 'noplan.asked' : 'noplan.ask')}</button>` : ''}
        ${cur !== 'free' && planUntil() ? html`<p class="plan-until">${t('plans.until', { date: planUntil().split('-').reverse().join('.') })} ${paymentsOpen() ? html`<button type="button" class="link-btn" data-act="${cur === 'pro' ? 'plan-pay' : 'custom-ask'}" data-plan="${cur}">${t('plans.renew')}</button>` : ''}</p>` : ''}</div>
      ${cur !== 'business' ? html`<div class="plan-how"><b>${t('plans.howTitle')}</b><p class="muted">${t(!paymentsOpen() ? 'plans.howFree' : supportEmail() ? 'plans.howBodyMail' : 'plans.howBody', { email: supportEmail() })}</p></div>` : html`<p class="muted">${t('plans.topPlan')}</p>`}</div>`
      : html`<p class="plans-soon" role="status">${icon('info', 18)} ${t('plans.noAccounts')}</p>`}
    <div class="plans">${PLANS.map((p) => { const isCur = accounts && p.id === cur; const lower = accounts && PLAN_RANK[p.id] < PLAN_RANK[cur]; return html`<article class="plan ${p.featured ? 'is-featured' : 'is-premium'} ${isCur ? 'is-current' : ''}">
      ${p.featured ? html`<span class="plan-flag">${t('plans.popular')}</span>` : ''}
      <h2>${t(`plans.${p.id}.name`)}</h2><p class="plan-for">${t(`plans.${p.id}.for`)}</p>
      ${planVideo(p)}
      ${priceLine(p, 'plan-price')}
      <ul>${ta(`plans.${p.id}.features`).map((f) => html`<li>${icon('check', 16)}${f}</li>`)}</ul>
      ${isCur ? html`<span class="btn btn-secondary is-static">${icon('check', 16)} ${t('plans.current')}</span>`
        : lower || !accounts ? '' : planRequest() === p.id ? html`<span class="btn btn-secondary is-static">${icon('clock', 16)} ${t(p.price ? 'pay.pending' : 'plans.business.asked')}</span>` : cta(p)}
      ${!isCur && !lower && accounts && p.price && paymentsOpen() ? html`<p class="plan-terms">${t('pay.terms', { price: money(p.price) })}</p>` : ''}
    </article>`; })}</div>
    ${creditsInfo(accounts && cur !== 'free')}
    ${catalog()}
    <section class="card pc-card"><h2>${t('pc.title')}</h2>
      <div class="table-wrap"><table class="pc-table"><thead><tr><th scope="col">${t('pc.feature')}</th>${PLANS.map((p) => html`<th scope="col" class="${accounts && p.id === cur ? 'is-current' : ''}">${t(`plans.${p.id}.name`)}<small>${priceText(p)}</small></th>`)}</tr></thead>
        <tbody>${ROWS.map(([k, ...vals]) => html`<tr><th scope="row">${t(`pc.r.${k}`)}</th>${vals.map((v, i) => html`<td class="${accounts && PLANS[i].id === cur ? 'is-current' : ''}">${cell(v)}</td>`)}</tr>`)}</tbody></table></div></section>
    <p class="muted small plans-note">${t('plans.note')}</p>`;
  },
  mount() {
    if (authOn() && signedIn() && Date.now() - creditsAt > 60_000) { creditsAt = Date.now(); refreshMe().catch(() => {}); } // the balance changes with every AI call
    if (location.hash.includes('?credits')) document.getElementById('credits')?.scrollIntoView({ block: 'start' });
  },
};

/** Custom Premium: the client says what they want; the owner answers with a written offer. */
actions['custom-ask'] = async () => {
  if (!(authOn() && signedIn())) { location.hash = '#/plans'; return; }
  const v = await openModal({
    title: t('plans.business.askTitle'),
    body: html`<p>${t('plans.business.askBody')}</p><label class="field"><span>${t('plans.business.noteLabel')}</span><textarea id="cp-note" rows="4" maxlength="500" placeholder="${t('plans.business.notePh')}"></textarea></label>`,
    actions: [{ label: t('common.cancel'), kind: 'btn-ghost', value: null }, { label: t('plans.business.send'), kind: 'btn-primary', collect: () => ({ note: $('#cp-note').value.trim() }) }],
  });
  if (!v) return;
  const j = await requestPlan('business', v.note);
  toast(t(j.planRequest ? 'plans.business.sent' : j.error === 'rate_limited' ? 'noplan.rate' : 'common.errorGeneric'), j.planRequest ? 'success' : 'error');
};

/** Reference the client writes on the transfer, so the admin can match the payment to the account. */
const payRef = () => `ARCTON-${userId().replace(/-/g, '').slice(0, 8).toUpperCase()}`;

actions['plan-pay'] = async (el) => {
  const plan = PLANS.find((x) => x.id === el.dataset.plan); if (!plan) return;
  if (!plan.price) return actions['custom-ask']();
  const name = t(`plans.${plan.id}.name`);
  const row = (k, v, copy) => html`<div><dt>${t(`pay.${k}`)}</dt><dd><span>${v}</span>${copy ? html`<button type="button" class="link-btn" data-copy="${v}">${t('actions.copy')}</button>` : ''}</dd></div>`;
  const ready = BRAND.iban && BRAND.cui;
  const body = html`<p>${t('pay.intro', { plan: name, price: money(plan.price) })}</p>
    ${ready ? html`<dl class="pay-dl">${row('to', BRAND.company)}${row('iban', BRAND.iban, true)}${BRAND.bank ? row('bank', BRAND.bank) : ''}${row('amount', `${money(plan.price)} EUR`)}${row('ref', payRef(), true)}</dl>`
      : html`<p class="auth-notice auth-info">${t('pay.notReady', { email: supportEmail() || BRAND.email })}</p>`}
    <p class="muted small">${t('pay.terms', { price: money(plan.price) })}</p><p class="muted small">${t('pay.after')}</p>`;
  const onCopy = (e) => { const b = e.target.closest('[data-copy]'); if (b) copyText(b.dataset.copy); };
  document.addEventListener('click', onCopy);
  const ok = await openModal({ title: t('pay.title', { plan: name }), body, actions: [{ label: t('common.cancel'), kind: 'btn-ghost', value: false }, ...(ready ? [{ label: t('pay.sent'), kind: 'btn-primary', value: true }] : [])] });
  document.removeEventListener('click', onCopy);
  if (!ok) return;
  const j = await requestPlan(plan.id);
  if (j.planRequest) toast(t('pay.thanks'), 'success'); else toast(t('pay.error'), 'error');
};

actions['trial-ask'] = () => noPlanPrompt();

/** A credit pack, paid by bank transfer like the plans; the admin adds the credits when the money arrives. */
actions['credits-buy'] = async (el) => {
  const pack = CREDIT_PACKS.find(([n]) => n === Number(el.dataset.pack)); if (!pack) return;
  const [n, price] = pack; const ready = paymentsOpen();
  if (!ready) { // launch period: no payments yet, the team adds the credits for free
    if (!(await openModal({ title: t('credits.askTitle', { n: creditsText(n) }), body: html`<p>${t('credits.askBody')}</p>`, actions: [{ label: t('common.cancel'), kind: 'btn-ghost', value: false }, { label: t('credits.askSend'), kind: 'btn-primary', value: true }] }))) return;
    const j = await requestCredits(n);
    return toast(t(j.creditRequest ? 'credits.askThanks' : j.error === 'rate_limited' ? 'noplan.rate' : 'pay.error'), j.creditRequest ? 'success' : 'error');
  }
  const row = (k, v, copy) => html`<div><dt>${t(`pay.${k}`)}</dt><dd><span>${v}</span>${copy ? html`<button type="button" class="link-btn" data-copy="${v}">${t('actions.copy')}</button>` : ''}</dd></div>`;
  const body = html`<p>${t('credits.payIntro', { n: creditsText(n), price: money(price) })}</p>
    ${ready ? html`<dl class="pay-dl">${row('to', BRAND.company)}${row('iban', BRAND.iban, true)}${BRAND.bank ? row('bank', BRAND.bank) : ''}${row('amount', `${money(price)} EUR`)}${row('ref', `${payRef()}-C${n}`, true)}</dl>`
      : html`<p class="auth-notice auth-info">${t('pay.notReady', { email: supportEmail() || BRAND.email })}</p>`}
    <p class="muted small">${t('credits.payAfter')}</p>`;
  const onCopy = (e) => { const b = e.target.closest('[data-copy]'); if (b) copyText(b.dataset.copy); };
  document.addEventListener('click', onCopy);
  const ok = await openModal({ title: t('credits.payTitle', { n: creditsText(n) }), body, actions: [{ label: t('common.cancel'), kind: 'btn-ghost', value: false }, ...(ready ? [{ label: t('pay.sent'), kind: 'btn-primary', value: true }] : [])] });
  document.removeEventListener('click', onCopy);
  if (!ok) return;
  const j = await requestCredits(n);
  toast(t(j.creditRequest ? 'credits.thanks' : j.error === 'rate_limited' ? 'noplan.rate' : 'pay.error'), j.creditRequest ? 'success' : 'error');
};
