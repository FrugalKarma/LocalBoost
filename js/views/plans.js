// Plans: what each one includes, the owner's current plan and how to change it.
// Online payment is not switched on yet; until then the LocalBoost team sets the plan (Admin area).
import { html, icon } from '../core.js';
import { t, ta } from '../i18n.js';
import { pageHead } from './shared.js';
import { currentPlan, aiAllowance, PLAN_RANK } from '../plans.js';
import { authOn, signedIn, userEmail, supportEmail } from '../auth.js';

export const PLANS = [
  { id: 'free', price: 0 },
  { id: 'pro', price: 19, featured: true },
  { id: 'business', price: 49 },
];
// rows of the comparison table: [key, free, pro, business] (true / false / text key)
const ROWS = [
  ['analysis', 'pc.v.ai3', 'pc.v.unlimited', 'pc.v.unlimited'],
  ['designer', true, true, true],
  ['preview', 'pc.v.watermark', 'pc.v.watermark', 'pc.v.clean'],
  ['publish', false, false, true],
  ['bookings', false, false, true],
  ['stats', false, false, true],
  ['download', false, false, true],
  ['branding', false, false, true],
  ['chat', false, true, true],
  ['pack', false, true, true],
  ['replies', false, true, true],
  ['poster', false, true, true],
  ['competitors', true, true, true],
];

export const plans = {
  id: 'plans',
  render() {
    const cur = currentPlan(); const accounts = authOn() && signedIn(); const ai = aiAllowance();
    const cell = (v) => (v === true ? html`<span class="pc-yes" aria-label="${t('pc.yes')}">${icon('check', 18)}</span>` : v === false ? html`<span class="pc-no" aria-label="${t('pc.no')}">—</span>` : html`<span>${t(v)}</span>`);
    return html`${pageHead({ title: t('plans.title'), sub: t('plans.sub') })}
    ${accounts ? html`<div class="plan-now card"><div><p class="tag">${t('plans.yourPlan')}</p><h2>${t(`plans.${cur}.name`)}</h2>
        ${ai ? html`<p class="muted">${t('plans.aiLeft', { n: Math.max(0, ai.limit - ai.used), limit: ai.limit })}</p>` : ''}</div>
      ${cur !== 'business' ? html`<div class="plan-how"><b>${t('plans.howTitle')}</b><p class="muted">${t(supportEmail() ? 'plans.howBodyMail' : 'plans.howBody', { email: supportEmail() })}</p></div>` : html`<p class="muted">${t('plans.topPlan')}</p>`}</div>`
      : html`<p class="plans-soon" role="status">${icon('info', 18)} ${t('plans.noAccounts')}</p>`}
    <div class="plans">${PLANS.map((p) => { const isCur = accounts && p.id === cur; const lower = accounts && PLAN_RANK[p.id] < PLAN_RANK[cur]; return html`<article class="plan ${p.featured ? 'is-featured' : ''} ${isCur ? 'is-current' : ''}">
      ${p.featured ? html`<span class="plan-flag">${t('plans.popular')}</span>` : ''}
      <h2>${t(`plans.${p.id}.name`)}</h2><p class="plan-for">${t(`plans.${p.id}.for`)}</p>
      <p class="plan-price"><b>€${p.price}</b><span>${t('plans.perMonth')}</span></p>
      <ul>${ta(`plans.${p.id}.features`).map((f) => html`<li>${icon('check', 16)}${f}</li>`)}</ul>
      ${isCur ? html`<span class="btn btn-secondary is-static">${icon('check', 16)} ${t('plans.current')}</span>`
        : lower || !accounts ? '' : html`<a class="btn ${p.featured ? 'btn-primary' : 'btn-secondary'}" href="mailto:${supportEmail()}?subject=${encodeURIComponent(`LocalBoost ${t(`plans.${p.id}.name`)}`)}&body=${encodeURIComponent(t('plans.mailBody', { plan: t(`plans.${p.id}.name`), email: userEmail() }))}">${t('plans.ask', { plan: t(`plans.${p.id}.name`) })}</a>`}
    </article>`; })}</div>
    <section class="card pc-card"><h2>${t('pc.title')}</h2>
      <div class="table-wrap"><table class="pc-table"><thead><tr><th scope="col">${t('pc.feature')}</th>${PLANS.map((p) => html`<th scope="col" class="${accounts && p.id === cur ? 'is-current' : ''}">${t(`plans.${p.id}.name`)}<small>€${p.price}</small></th>`)}</tr></thead>
        <tbody>${ROWS.map(([k, ...vals]) => html`<tr><th scope="row">${t(`pc.r.${k}`)}</th>${vals.map((v, i) => html`<td class="${accounts && PLANS[i].id === cur ? 'is-current' : ''}">${cell(v)}</td>`)}</tr>`)}</tbody></table></div></section>
    <p class="muted small plans-note">${t('plans.note')}</p>`;
  },
};
