import { html, limit, icon, toast, confirmDialog, $, openModal } from '../core.js';
import { t, getLang } from '../i18n.js';
import { getState, update } from '../store.js';
import { inputs, actions } from '../registry.js';
import { displayName } from '../business.js';
import { pageHead } from './shared.js';
import { authOn, signedIn, userEmail, isAdmin, changePassword, api, signOut } from '../auth.js';
import { cloudStatus, onCloud, flush, viewingClient } from '../cloud.js';
import { currentPlan } from '../plans.js';
import { authErrorText } from './signin.js';

function syncLine() {
  const { status, savedAt } = cloudStatus();
  if (status === 'saving') return t('account.syncSaving');
  if (status === 'offline') return t('account.syncOffline');
  if (status === 'error') return t('account.syncError');
  if (savedAt) return t('account.syncAt', { time: new Intl.DateTimeFormat(getLang(), { timeStyle: 'short' }).format(savedAt) });
  return t('account.sync');
}
onCloud(() => { const el = $('#sync-line'); if (el) el.textContent = syncLine(); });

function accountRows() {
  if (!authOn() || !signedIn()) return '';
  return html`
    <section class="set-row"><div class="set-label"><h2>${t('account.signIn')}</h2><p>${t('account.signedInAs', { email: userEmail() })}</p></div>
      <div class="set-ctl"><div class="btn-row">
        <button class="btn btn-secondary" data-act="change-password">${t('account.changePassword')}</button>
        <button class="btn btn-ghost" data-act="sign-out">${icon('external', 18)} ${t('account.signOut')}</button></div></div></section>
    <section class="set-row"><div class="set-label"><h2>${t('account.cloud')}</h2><p>${t('account.cloudWorkspace')}</p></div>
      <div class="set-ctl"><p class="sync-line" id="sync-line" role="status">${syncLine()}</p></div></section>`;
}

export const account = {
  id: 'account',
  render() {
    const s = getState(); const name = s.profile.name || (userEmail() || '').split('@')[0];
    const live = authOn() && signedIn();
    const role = t(live && isAdmin() ? 'account.roleAdmin' : 'account.roleClient');
    return html`${pageHead({ title: t('account.title'), sub: t(live ? 'account.subLive' : 'account.sub') })}
    <section class="profile-hero">
      <span class="avatar-lg" aria-hidden="true">${(name || '?').slice(0, 1).toUpperCase()}</span>
      <div class="profile-main"><h2>${name || displayName()}</h2><p>${role}</p>
        <label class="field"><span>${t('account.displayName')}</span><input type="text" maxlength="40" value="${name}" data-in="profile-name" autocomplete="off"></label>
        ${live ? '' : html`<p class="small profile-note">${t('account.noLogin')}</p>`}</div>
    </section>
    <div class="set-list">
      ${accountRows()}
      <section class="set-row"><div class="set-label"><h2>${t('account.workspace')}</h2><p>${displayName()}</p></div>
        <div class="set-ctl"><dl class="facts"><div><dt>${t('account.plan')}</dt><dd>${t(`plans.${currentPlan()}.name`)} · <a href="#/plans">${t('account.seePlans')}</a></dd></div>
          <div><dt>${t('account.dataMode')}</dt><dd>${t(live ? 'account.dataCloud' : 'account.dataDevice')}</dd></div></dl></div></section>
    </div>
    ${live && !isAdmin() && !viewingClient() ? html`<section class="danger-zone"><div><h2>${t('account.deleteTitle')}</h2><p>${t('account.deleteBody')}</p></div>
      <button class="btn btn-secondary danger" data-act="delete-account">${icon('trash', 18)} ${t('account.deleteTitle')}</button></section>` : ''}`;
  },
};

inputs['profile-name'] = (el) => { update({ profile: { name: limit(el.value, 40) } }); };

actions['change-password'] = async () => {
  const pw = await openModal({
    title: t('account.changePassword'),
    body: html`<label class="field"><span>${t('signin.passwordNew')}</span><input id="new-pw" type="password" autocomplete="new-password" minlength="8" maxlength="72"></label><p class="small">${t('signin.passwordHint')}</p>`,
    actions: [{ label: t('common.cancel'), kind: 'btn-ghost', value: null }, { label: t('signin.newSave'), kind: 'btn-primary', collect: () => $('#new-pw')?.value || '' }],
  });
  if (pw == null) return;
  if (pw.length < 8) return toast(authErrorText('weak_password'), 'error');
  const r = await changePassword(pw);
  toast(r.error ? authErrorText(r.error) : t('account.passwordSaved'), r.error ? 'error' : 'success');
};

actions['delete-account'] = async () => {
  if (!(await confirmDialog(t('account.deleteConfirmTitle'), t('account.deleteConfirmBody'), t('account.deleteTitle')))) return;
  await flush();
  const r = await api('/api/data', { method: 'DELETE' });
  if (r.status !== 200) return toast(r.body.error === 'admin_self' ? t('account.adminNoDelete') : t('common.errorGeneric'), 'error');
  toast(t('account.deleted'), 'success');
  await signOut('deleted');
};
