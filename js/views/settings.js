import { html, icon, toast, openModal, confirmDialog, downloadBlob, demoBadge } from '../core.js';
import { t, LANGS, getLang, setLang, fmtDate } from '../i18n.js';
import { getState, update, resetAll } from '../store.js';
import { PROMPTS, MODEL_DEFAULT } from '../prompts.js';
import { aiTrace } from '../ai.js';
import { canPrompt, promptInstall, isInstalled } from '../pwa.js';
import { seedFullDemo } from '../seed.js';
import { actions, inputs, rerender } from '../registry.js';
import { pageHead } from './shared.js';
import { currentTheme, applyTheme, themeTransition } from '../theme.js';

const CONNECTORS = [
  { id: 'gbp', perms: 'read-business-info, read-reviews' },
  { id: 'reviews', perms: 'read-reviews' },
  { id: 'website', perms: 'fetch-public-page' },
  { id: 'social', perms: 'read-public-posts' },
  { id: 'csv', perms: 'local-file', ready: true },
  { id: 'screenshot', perms: 'local-file' },
  { id: 'voice', perms: 'microphone' },
  { id: 'api', perms: 'api-key (server side)' },
];

export const settings = {
  id: 'settings',
  render() {
    const s = getState(); const lang = getLang();
    const row = (title, desc, ctl, id = '') => html`<section class="set-row" ${id ? html`id="${id}"` : ''}><div class="set-label"><h2>${title}</h2>${desc ? html`<p>${desc}</p>` : ''}</div><div class="set-ctl">${ctl}</div></section>`;
    return html`${pageHead({ note: '09', title: t('settings.title'), sub: t('settings.sub') })}
    <div class="set-list">
      ${row(t('settings.language'), '', html`<div class="seg seg-wide" role="group" aria-label="${t('settings.language')}">${LANGS.map((l) => html`<button aria-pressed="${lang === l.code}" data-act="set-lang" data-lang="${l.code}">${l.name}</button>`)}</div>`)}
      ${row(t('settings.theme'), '', html`<div class="seg seg-wide" role="group" aria-label="${t('settings.theme')}">${['light', 'dark'].map((m) => html`<button aria-pressed="${currentTheme() === m}" data-act="set-theme" data-theme="${m}">${icon(m === 'dark' ? 'moon' : 'sun', 16)} ${t(`settings.${m}`)}</button>`)}</div>`)}
      ${row(t('settings.install'), isInstalled() ? t('settings.installedAlready') : t('settings.installBody'), html`<div class="btn-row"><button class="btn btn-primary" data-act="install" ${isInstalled() ? 'disabled' : ''}>${icon('install', 18)} ${t('actions.install')}</button>
          <button class="btn btn-ghost" data-act="help">${icon('help', 18)} ${t('settings.openHelp')}</button></div>`)}
      ${row(t('settings.ai'), t('settings.aiBody'), html`<label class="field"><span>${t('settings.aiSim')}</span><select data-in="ai-sim">${['off', 'timeout', 'error'].map((v) => html`<option value="${v}" ${s.aiSim === v ? 'selected' : ''}>${t(`settings.sim_${v}`)}</option>`)}</select></label>
          <div class="btn-row"><button class="btn btn-secondary" data-act="transparency">${icon('eye', 18)} ${t('settings.transparency')}</button></div>`)}
      ${row(t('settings.data'), t('settings.dataBody'), html`<div class="btn-row"><button class="btn btn-secondary" data-act="export-data">${icon('download', 18)} ${t('actions.exportData')}</button>
          <button class="btn btn-secondary" data-act="seed-demo">${icon('sparkle', 18)} ${t('settings.loadComplete')}</button></div>`)}
      ${row(t('settings.connected'), html`${t('settings.connectedBody')} ${demoBadge()}`, html`<ul class="conn-list">${[...CONNECTORS].sort((a, b) => !!b.ready - !!a.ready).map((c) => html`<li>
          <div class="conn-txt"><strong>${t(`conn.${c.id}`)}</strong><small>${t(`conn.${c.id}Desc`)}</small><small class="conn-perm">${t('settings.permissions')}: ${c.perms}</small></div>
          <span class="badge badge-${c.ready ? 'live' : 'inference'}">${t(c.ready ? 'settings.statusReady' : 'settings.statusNotConnected')}</span>
          <button class="btn btn-ghost btn-sm" data-act="connector-retry" data-id="${c.id}" aria-label="${t('actions.retry')}: ${t(`conn.${c.id}`)}">${icon('refresh', 15)}</button></li>`)}</ul>
          <p class="conn-ok">${icon('check', 16)} ${t('settings.demoAvailable')}</p>`, 'connected')}
    </div>
    <section class="danger-zone"><div><h2>${t('actions.resetDemo')}</h2><p>${t('settings.resetBody')}</p></div>
      <button class="btn btn-secondary danger" data-act="reset-demo">${icon('trash', 18)} ${t('actions.resetDemo')}</button></section>`;
  },
};

actions['set-lang'] = (el) => { setLang(el.dataset.lang); };
actions['set-theme'] = (el) => { if (currentTheme() === el.dataset.theme) return; themeTransition(el, () => { applyTheme(el.dataset.theme); rerender({ full: true }); }); };
inputs['ai-sim'] = (el) => { update({ aiSim: el.value }); toast(t('settings.toastSim'), 'info'); };

actions.install = async () => {
  if (canPrompt()) { const r = await promptInstall(); toast(r === 'accepted' ? t('pwa.installed') : t('pwa.dismissed'), r === 'accepted' ? 'success' : 'info'); }
  else actions.help();
};

actions.help = () => openModal({
  title: t('help.title'), wide: true,
  body: html`<h3>${t('help.flow')}</h3><ol class="plain">${[1, 2, 3, 4, 5, 7].map((n) => html`<li>${t(`help.step${n}`)}</li>`)}</ol>
    <h3>${t('help.installHow')}</h3><ul class="plain"><li><strong>Windows / Linux (Chrome, Edge):</strong> ${t('help.installDesktop')}</li><li><strong>macOS (Chrome, Edge, Safari 17+):</strong> ${t('help.installMac')}</li><li><strong>Android (Chrome):</strong> ${t('help.installAndroid')}</li><li><strong>iPhone / iPad (Safari):</strong> ${t('help.installIos')}</li></ul>`,
  actions: [{ label: t('common.close'), kind: 'btn-primary', value: true }],
});

actions.transparency = () => {
  const trace = aiTrace.length ? html`<table class="table"><thead><tr><th>${t('settings.role')}</th><th>${t('settings.outcome')}</th><th>ms</th><th></th></tr></thead><tbody>${aiTrace.slice(0, 8).map((x) => html`<tr><td>${x.role}</td><td>${x.outcome}</td><td>${x.ms}</td><td class="mono small">${fmtDate(x.at, { timeStyle: 'medium' })}</td></tr>`)}</tbody></table>` : html`<p class="muted">${t('settings.noCalls')}</p>`;
  openModal({
    title: t('settings.transparency'), wide: true,
    body: html`<p>${t('settings.transBody', { model: MODEL_DEFAULT })}</p>
      <ul class="plain"><li>${t('settings.trans1')}</li><li>${t('settings.trans2')}</li><li>${t('settings.trans3')}</li><li>${t('settings.trans4')}</li></ul>
      <h3>${t('settings.recentCalls')}</h3>${trace}
      <h3>${t('settings.prompts')}</h3>${Object.entries(PROMPTS).map(([id, p]) => html`<details><summary>${p.title} <span class="mono small">(${id})</span></summary><pre class="prompt">${p.system}\n\nSchema: ${p.schema}</pre></details>`)}`,
    actions: [{ label: t('common.close'), kind: 'btn-primary', value: true }],
  });
};

actions['export-data'] = () => {
  const s = getState();
  const payload = { exportedAt: new Date().toISOString(), app: 'LocalBoost', dataMode: 'demo (Cafeneaua Copou - fictional)', userData: { userSignals: s.userSignals, profile: s.profile, bookings: s.bookings }, projectState: { diagnosis: s.diagnosis, assets: s.assets, mission: s.mission, site: s.site, checkpoint: s.checkpoint } };
  downloadBlob('localboost-project.json', new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  toast(t('settings.toastExport'), 'success');
};
actions['reset-demo'] = async () => {
  if (!(await confirmDialog(t('settings.resetTitle'), t('settings.resetBody'), t('actions.resetDemo')))) return;
  resetAll(); toast(t('settings.toastReset'), 'info'); rerender();
};
actions['seed-demo'] = () => { seedFullDemo(); toast(t('settings.toastSeed'), 'success'); rerender(); };
actions['connector-retry'] = (el) => {
  const ready = CONNECTORS.find((c) => c.id === el.dataset.id)?.ready;
  toast(ready ? t('settings.retryReady') : t('settings.retryNoCreds'), ready ? 'success' : 'info');
};
