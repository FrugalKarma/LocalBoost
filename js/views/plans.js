// Subscription plans. Shown so owners know what is coming; paying is not switched on yet,
// so every button is disabled and everyone is on Free.
import { html, icon } from '../core.js';
import { t, ta } from '../i18n.js';
import { pageHead } from './shared.js';

export const PLANS = [
  { id: 'free', price: 0, current: true },
  { id: 'pro', price: 19, featured: true },
  { id: 'business', price: 49 },
];

export const plans = {
  id: 'plans',
  render() {
    return html`${pageHead({ title: t('plans.title'), sub: t('plans.sub') })}
    <p class="plans-soon" role="status">${icon('clock', 18)} ${t('plans.soon')}</p>
    <div class="plans">${PLANS.map((p) => html`<article class="plan ${p.featured ? 'is-featured' : ''} ${p.current ? 'is-current' : ''}">
      ${p.featured ? html`<span class="plan-flag">${t('plans.popular')}</span>` : ''}
      <h2>${t(`plans.${p.id}.name`)}</h2><p class="plan-for">${t(`plans.${p.id}.for`)}</p>
      <p class="plan-price"><b>€${p.price}</b><span>${t('plans.perMonth')}</span></p>
      <ul>${ta(`plans.${p.id}.features`).map((f) => html`<li>${icon('check', 16)}${f}</li>`)}</ul>
      ${p.current ? html`<button class="btn btn-secondary" disabled aria-disabled="true">${t('plans.current')}</button>`
        : html`<button class="btn btn-primary" disabled aria-disabled="true" title="${t('plans.soon')}">${t('plans.choose')} · ${t('plans.comingSoon')}</button>`}
    </article>`)}</div>
    <p class="muted small plans-note">${t('plans.note')}</p>`;
  },
};
