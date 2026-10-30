import { html, limit, demoBadge } from '../core.js';
import { t } from '../i18n.js';
import { getState, update } from '../store.js';
import { inputs } from '../registry.js';
import { displayName } from '../business.js';
import { pageHead } from './shared.js';

export const account = {
  id: 'account',
  render() {
    const s = getState(); const name = s.profile.name;
    return html`${pageHead({ note: '10', title: t('account.title'), sub: t('account.sub') })}
    <section class="profile-hero">
      <span class="avatar-lg" aria-hidden="true">${(name || '?').slice(0, 1).toUpperCase()}</span>
      <div class="profile-main"><h2>${name}</h2><p>${t('account.role')} · ${demoBadge()}</p>
        <label class="field"><span>${t('account.displayName')}</span><input type="text" maxlength="40" value="${name}" data-in="profile-name" autocomplete="off"></label>
        <p class="small profile-note">${t('account.noLogin')}</p></div>
    </section>
    <div class="set-list">
      <section class="set-row"><div class="set-label"><h2>${t('account.workspace')}</h2><p>${displayName()} — ${t('account.demoWorkspace')}</p></div>
        <div class="set-ctl"><dl class="facts"><div><dt>${t('account.plan')}</dt><dd>${t('account.planValue')}</dd></div>
          <div><dt>${t('account.dataMode')}</dt><dd>${t('common.demoData')}</dd></div>
          <div><dt>${t('account.separation')}</dt><dd>${t('account.separationBody', { n: s.userSignals.length })}</dd></div></dl></div></section>
    </div>`;
  },
};

inputs['profile-name'] = (el) => { update({ profile: { name: limit(el.value, 40) || 'Ana Demo' } }); };
