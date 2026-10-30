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
    <div class="bento">
      <section class="card span-6"><p class="tag">${t('account.profile')}</p>
        <div class="avatar-row"><span class="avatar" aria-hidden="true">${(name || '?').slice(0, 1).toUpperCase()}</span>
          <div><strong>${name}</strong><p class="muted small">${t('account.role')} · ${demoBadge()}</p></div></div>
        <label class="field"><span>${t('account.displayName')}</span><input type="text" maxlength="40" value="${name}" data-in="profile-name" autocomplete="off"></label>
        <p class="muted small">${t('account.noLogin')}</p></section>
      <section class="card span-6"><p class="tag">${t('account.workspace')}</p>
        <h3>${displayName()} — ${t('account.demoWorkspace')}</h3>
        <dl class="plan"><div><dt>${t('account.plan')}</dt><dd>${t('account.planValue')}</dd></div>
          <div><dt>${t('account.dataMode')}</dt><dd>${t('common.demoData')}</dd></div>
          <div><dt>${t('account.separation')}</dt><dd>${t('account.separationBody', { n: s.userSignals.length })}</dd></div></dl></section>
    </div>`;
  },
};

inputs['profile-name'] = (el) => { update({ profile: { name: limit(el.value, 40) || 'Ana Demo' } }); };
