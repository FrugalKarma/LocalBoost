// Plans: what each one includes, the owner's current plan and how to change it.
// Paid plans are bought by bank transfer: the client sees the details and a reference, tells us it is sent,
// and the admin switches the plan when the money arrives (Admin area). Card payments are not used.
import { html, icon, openModal, toast, copyText } from '../core.js';
import { actions } from '../registry.js';
import { BRAND } from '../brand.js';
import { t, ta, getLang } from '../i18n.js';
import { pageHead } from './shared.js';
import { currentPlan, PLAN_RANK, noPlanPrompt } from '../plans.js';
import { authOn, signedIn, userEmail, userId, supportEmail, requestPlan, planRequest, planUntil } from '../auth.js';

// No free plan: a new account sees everything but needs a plan (or a free trial the owner grants) to use it.
export const PLANS = [
  { id: 'pro', price: 39.99, featured: true },
  { id: 'business', price: 79.99 },
];
/** 39.99 → "39,99" in Romanian, "39.99" in English. */
export const money = (n) => n.toLocaleString(getLang(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// rows of the comparison table: [key, pro, business] (true / false / text key)
const ROWS = [
  ['analysis', 'pc.v.noMonthly', 'pc.v.noMonthly'],
  ['designer', true, true],
  ['publish', 'pc.v.basicSite', 'pc.v.basicSite'],
  ['bookings', 'pc.v.waEmail', 'pc.v.inbox'],
  ['stats', false, true],
  ['download', false, true],
  ['branding', false, true],
  ['chat', true, true],
  ['pack', true, true],
  ['replies', true, true],
  ['poster', true, true],
  ['competitors', true, true],
  ['custom', 'pc.v.onRequest', 'pc.v.onRequest'],
];
/** Extras priced per client: own domain, premium site. Asked for by email. */
export const extrasCard = (cls = 'plan', cta = '') => html`<article class="${cls} is-extras">
  ${cls === 'plan' ? html`<h2>${t('plans.custom.name')}</h2>` : html`<h3>${t('plans.custom.name')}</h3>`}<p class="${cls === 'plan' ? 'plan-for' : 'lp-for'}">${t('plans.custom.for')}</p>
  <p class="${cls === 'plan' ? 'plan-price' : 'lp-price'}"><b>${t('plans.custom.price')}</b></p>
  <ul>${ta('plans.custom.features').map((f) => html`<li>${icon('check', 16)}<span>${f}</span></li>`)}</ul>${cta}</article>`;

export const plans = {
  id: 'plans',
  render() {
    const cur = currentPlan(); const accounts = authOn() && signedIn(); const mail = supportEmail() || BRAND.email;
    const cell = (v) => (v === true ? html`<span class="pc-yes" aria-label="${t('pc.yes')}">${icon('check', 18)}</span>` : v === false ? html`<span class="pc-no" aria-label="${t('pc.no')}">—</span>` : html`<span>${t(v)}</span>`);
    return html`${pageHead({ title: t('plans.title'), sub: t('plans.sub') })}
    ${accounts ? html`<div class="plan-now card"><div><p class="tag">${t('plans.yourPlan')}</p><h2>${t(`plans.${cur}.name`)}</h2>
        ${cur === 'free' ? html`<p class="muted">${t('plans.noPlanBody')}</p><button type="button" class="btn btn-secondary" data-act="trial-ask">${icon('star', 16)} ${t(planRequest() === 'trial' ? 'noplan.asked' : 'noplan.ask')}</button>` : ''}
        ${cur !== 'free' && planUntil() ? html`<p class="plan-until">${t('plans.until', { date: planUntil().split('-').reverse().join('.') })} <button type="button" class="link-btn" data-act="plan-pay" data-plan="${cur}">${t('plans.renew')}</button></p>` : ''}</div>
      ${cur !== 'business' ? html`<div class="plan-how"><b>${t('plans.howTitle')}</b><p class="muted">${t(supportEmail() ? 'plans.howBodyMail' : 'plans.howBody', { email: supportEmail() })}</p></div>` : html`<p class="muted">${t('plans.topPlan')}</p>`}</div>`
      : html`<p class="plans-soon" role="status">${icon('info', 18)} ${t('plans.noAccounts')}</p>`}
    <div class="plans">${PLANS.map((p) => { const isCur = accounts && p.id === cur; const lower = accounts && PLAN_RANK[p.id] < PLAN_RANK[cur]; return html`<article class="plan ${p.featured ? 'is-featured' : ''} ${isCur ? 'is-current' : ''}">
      ${p.featured ? html`<span class="plan-flag">${t('plans.popular')}</span>` : ''}
      <h2>${t(`plans.${p.id}.name`)}</h2><p class="plan-for">${t(`plans.${p.id}.for`)}</p>
      <p class="plan-price"><b>€${money(p.price)}</b><span>${t('plans.perMonth')}</span></p>
      <ul>${ta(`plans.${p.id}.features`).map((f) => html`<li>${icon('check', 16)}${f}</li>`)}</ul>
      ${isCur ? html`<span class="btn btn-secondary is-static">${icon('check', 16)} ${t('plans.current')}</span>`
        : lower || !accounts ? '' : planRequest() === p.id ? html`<span class="btn btn-secondary is-static">${icon('clock', 16)} ${t('pay.pending')}</span>`
          : html`<button type="button" class="btn ${p.featured ? 'btn-primary' : 'btn-secondary'}" data-act="plan-pay" data-plan="${p.id}">${t('plans.ask', { plan: t(`plans.${p.id}.name`) })}</button>`}
      ${!isCur && !lower && accounts ? html`<p class="plan-terms">${t('pay.terms', { price: money(p.price) })}</p>` : ''}
    </article>`; })}${extrasCard('plan', mail ? html`<a class="btn btn-secondary" href="mailto:${mail}?subject=${encodeURIComponent(t('plans.custom.subject'))}">${t('plans.custom.cta')}</a>` : '')}</div>
    <section class="card pc-card"><h2>${t('pc.title')}</h2>
      <div class="table-wrap"><table class="pc-table"><thead><tr><th scope="col">${t('pc.feature')}</th>${PLANS.map((p) => html`<th scope="col" class="${accounts && p.id === cur ? 'is-current' : ''}">${t(`plans.${p.id}.name`)}<small>€${money(p.price)}</small></th>`)}</tr></thead>
        <tbody>${ROWS.map(([k, ...vals]) => html`<tr><th scope="row">${t(`pc.r.${k}`)}</th>${vals.map((v, i) => html`<td class="${accounts && PLANS[i].id === cur ? 'is-current' : ''}">${cell(v)}</td>`)}</tr>`)}</tbody></table></div></section>
    <p class="muted small plans-note">${t('plans.note')}</p>`;
  },
};

/** Reference the client writes on the transfer, so the admin can match the payment to the account. */
const payRef = () => `ARCTON-${userId().replace(/-/g, '').slice(0, 8).toUpperCase()}`;

actions['plan-pay'] = async (el) => {
  const plan = PLANS.find((x) => x.id === el.dataset.plan); if (!plan) return;
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
