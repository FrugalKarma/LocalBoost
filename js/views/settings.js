import { html, icon, toast, openModal, confirmDialog, downloadBlob } from '../core.js';
import { t, LANGS, getLang, setLang, fmtDate } from '../i18n.js';
import { getState, resetAll, cloudData } from '../store.js';
import { PROMPTS, MODEL_DEFAULT } from '../prompts.js';
import { aiTrace } from '../ai.js';
import { canPrompt, promptInstall, isInstalled } from '../pwa.js';
import { serverCaps, resetCaps } from '../sources.js';
import { resetAiAvailability } from '../ai.js';
import { actions, inputs, rerender } from '../registry.js';
import { pageHead } from './shared.js';
import { currentTheme, applyTheme, themeTransition } from '../theme.js';
import { apiBase, setApiBase } from '../api.js';
import { getDisplay, setDisplay, DISPLAY } from '../display.js';
import { consentRecord } from '../legal.js';
import { isExample } from '../example.js';
import { BRAND } from '../brand.js';
import { authOn, signedIn } from '../auth.js';

// What this server has switched on (from /api/health), shown honestly: connected or not set up.
const CONNECTORS = ['ai', 'places', 'sitecheck', 'accounts', 'sites'];
let caps = null;

export const settings = {
  id: 'settings',
  render() {
    const s = getState(); const lang = getLang();
    const row = (title, desc, ctl, id = '') => html`<section class="set-row" ${id ? html`id="${id}"` : ''}><div class="set-label"><h2>${title}</h2>${desc ? html`<p>${desc}</p>` : ''}</div><div class="set-ctl">${ctl}</div></section>`;
    return html`${pageHead({ title: t('settings.title'), sub: t('settings.sub') })}
    <div class="set-list">
      ${row(t('settings.language'), '', html`<div class="seg seg-wide" role="group" aria-label="${t('settings.language')}">${LANGS.map((l) => html`<button aria-pressed="${lang === l.code}" data-act="set-lang" data-lang="${l.code}">${l.name}</button>`)}</div>`)}
      ${row(t('settings.theme'), '', html`<div class="seg seg-wide" role="group" aria-label="${t('settings.theme')}">${['light', 'dark'].map((m) => html`<button aria-pressed="${currentTheme() === m}" data-act="set-theme" data-theme="${m}">${icon(m === 'dark' ? 'moon' : 'sun', 16)} ${t(`settings.${m}`)}</button>`)}</div>`)}
      ${row(t('settings.display'), t('settings.displayBody'), html`<div class="disp">${Object.entries(DISPLAY).map(([k, opts]) => html`<div class="disp-row"><span>${t(`settings.disp.${k}`)}</span><div class="seg" role="group" aria-label="${t(`settings.disp.${k}`)}">${opts.map((o) => html`<button aria-pressed="${getDisplay()[k] === o}" data-act="set-display" data-k="${k}" data-v="${o}">${t(`settings.dispOpt.${o}`)}</button>`)}</div></div>`)}</div>`)}
      ${row(t('example.settingsTitle'), t('example.settingsBody'), html`<div class="btn-row">${isExample() ? html`<button class="btn btn-secondary" data-act="example-clear">${icon('trash', 18)} ${t('example.clear')}</button>` : html`<button class="btn btn-primary" data-act="example-load">${icon('sparkle', 18)} ${t('example.load')}</button>`}</div>`, 'example')}
      ${row(t('settings.install'), isInstalled() ? t('settings.installedAlready') : t('settings.installBody'), html`<div class="btn-row"><button class="btn btn-primary" data-act="install" ${isInstalled() ? 'disabled' : ''}>${icon('install', 18)} ${t('actions.install')}</button>
          <button class="btn btn-ghost" data-act="help">${icon('help', 18)} ${t('settings.openHelp')}</button></div>`)}
      ${row(t('settings.ai'), t('settings.aiBody'), html`<p class="legal-note">${icon('info', 15)} ${t('settings.aiNotice')}</p><div class="btn-row"><button class="btn btn-secondary" data-act="transparency">${icon('eye', 18)} ${t('settings.transparency')}</button><a class="btn btn-ghost" href="#/info?ai">${t('legal.ai')}</a></div>`)}
      ${row(t('chat.apiTitle'), t('chat.apiBody'), html`<form class="api-form" data-api-form novalidate><label class="field"><span>${t('chat.apiTitle')}</span>
          <input id="api-base" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://your-app.vercel.app" value="${apiBase()}"></label>
          <button type="submit" class="btn btn-secondary">${icon('check', 18)} ${t('chat.apiSave')}</button></form>`, 'ai-server')}
      ${row(t('settings.yourData'), t('settings.yourDataBody'), (() => { const rec = consentRecord(); return html`<dl class="facts"><div><dt>${t('settings.consent')}</dt><dd>${rec ? t('legal.acceptedOn', { date: new Date(rec.at || Date.now()).toLocaleDateString(), version: rec.v }) : t('legal.notAccepted')}</dd></div>
          <div><dt>${t('settings.stored')}</dt><dd>${t(authOn() && signedIn() ? 'settings.storedCloud' : 'settings.storedDevice')}</dd></div></dl>
        <div class="btn-row"><button class="btn btn-secondary" data-act="export-data">${icon('download', 18)} ${t('actions.exportData')}</button>
          <a class="btn btn-ghost" href="#/info?privacy">${t('legal.privacy')}</a><a class="btn btn-ghost" href="#/info?cookies">${t('legal.cookies')}</a>
          ${authOn() && signedIn() ? html`<a class="btn btn-ghost" href="#/account">${t('account.deleteTitle')}</a>` : ''}</div>`; })(), 'data')}
      ${row(t('settings.connected'), t('settings.connectedBody'), html`<ul class="conn-list">${CONNECTORS.map((id) => { const on = caps ? !!caps[id] : null;
          return html`<li><div class="conn-txt"><strong>${t(`conn.${id}`)}</strong><small>${t(`conn.${id}Desc`)}</small>${on === false ? html`<small class="conn-perm">${t(`conn.${id}How`)}</small>` : ''}</div>
          <span class="badge badge-${on ? 'live' : 'inference'}">${on == null ? '…' : t(on ? 'settings.statusReady' : 'settings.statusNotConnected')}</span></li>`; })}</ul>
          <div class="btn-row"><button class="btn btn-ghost btn-sm" data-act="recheck-caps">${icon('refresh', 15)} ${t('settings.recheck')}</button></div>`, 'connected')}
    </div>
    <section class="danger-zone"><div><h2>${t('settings.resetTitle')}</h2><p>${t('settings.resetBody')}</p></div>
      <button class="btn btn-secondary danger" data-act="reset-data">${icon('trash', 18)} ${t('settings.resetBtn')}</button></section>`;
  },
  mount() { if (!caps) serverCaps().then((c) => { caps = c; rerender(); }); if (/\?data/.test(location.hash)) document.getElementById('data')?.scrollIntoView(); },
};

document.addEventListener('submit', (e) => {
  if (!e.target.matches('[data-api-form]')) return;
  e.preventDefault();
  const ok = setApiBase(document.getElementById('api-base')?.value || '');
  toast(ok ? t('chat.apiSaved') : t('chat.apiInvalid'), ok ? 'success' : 'error');
});

actions['set-lang'] = (el) => { setLang(el.dataset.lang); };
actions['set-theme'] = (el) => { if (currentTheme() === el.dataset.theme) return; themeTransition(el, () => { applyTheme(el.dataset.theme); rerender({ full: true }); }); };
actions['recheck-caps'] = () => { resetCaps(); resetAiAvailability(); caps = null; serverCaps().then((c) => { caps = c; rerender(); }); rerender(); };

actions.install = async () => {
  if (canPrompt()) { const r = await promptInstall(); toast(r === 'accepted' ? t('pwa.installed') : t('pwa.dismissed'), r === 'accepted' ? 'success' : 'info'); }
  else actions.help();
};

actions.help = () => openModal({
  title: t('help.title'), wide: true,
  body: html`<h3>${t('help.flow')}</h3><ol class="plain">${[1, 2, 3, 4, 5, 6, 7].map((n) => html`<li>${t(`help.step${n}`)}</li>`)}</ol>
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
  const payload = { exportedAt: new Date().toISOString(), app: BRAND.app, operator: BRAND.company, consent: consentRecord(), data: cloudData() };
  downloadBlob('arcton-ai-data.json', new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  toast(t('settings.toastExport'), 'success');
};
actions['reset-data'] = async () => {
  if (!(await confirmDialog(t('settings.resetTitle'), t('settings.resetBody'), t('settings.resetBtn')))) return;
  resetAll(); toast(t('settings.toastReset'), 'info'); rerender();
};

actions['set-display'] = (el) => { setDisplay(el.dataset.k, el.dataset.v); rerender(); };
