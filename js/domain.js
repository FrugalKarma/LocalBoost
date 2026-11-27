// "Your domain" on the Website → Publish panel (Custom Premium): the client types their domain, copies two DNS
// records into their registrar account, and the app checks until the site answers there. Server: lib/domains.mjs.
import { html, icon, toast, copyText, confirmDialog } from './core.js';
import { t } from './i18n.js';
import { actions, inputs, rerender } from './registry.js';
import { currentPlan } from './plans.js';
import { viewingClient } from './cloud.js';
import { domainStatus, setDomain, removeDomain } from './sources.js';

let st = null; let loading = false; let busy = false; let draft = ''; let err = ''; let checkedAt = 0;
const REGISTRARS = ['romarg', 'clausweb', 'hostico', 'other'];

/** Loads the status at most once a minute (each look asks Vercel and the DNS). */
function load(force = false) {
  if (loading || (!force && Date.now() - checkedAt < 60_000)) return;
  loading = true; checkedAt = Date.now();
  domainStatus().then((r) => { loading = false; if (r.ok) { st = r.data; err = ''; } else err = r.error; rerender(); });
}

export function domainBlock() {
  if (currentPlan() !== 'business' && !viewingClient()) return html`<p class="muted small dom-up">${icon('star', 14)} ${t('dom.upsell')} <a href="#/plans">${t('dom.upsellLink')}</a></p>`;
  load();
  const head = html`<h3 class="pub-h">${t('dom.title')}</h3>`;
  if (err === 'schema_old') return html`${head}<p class="muted small">${t('dom.schema')}</p>`;
  if (!st) return html`${head}<p class="muted small"><i class="spin"></i> ${t('dom.loading')}</p>`;
  if (!st.domain) {
    return html`${head}<p class="muted small">${t('dom.intro')}</p>
      <form class="dom-form" data-dom-form novalidate><label class="field"><span>${t('dom.label')}</span><input data-in="dom-draft" value="${draft}" placeholder="cafeneauaaurora.ro" maxlength="253" autocomplete="off" spellcheck="false" inputmode="url"></label>
        <button type="submit" class="btn btn-primary" ${busy ? 'disabled' : ''}>${busy ? html`<i class="spin"></i>` : icon('external', 16)} ${t('dom.connect')}</button></form>
      <p class="muted small">${t('dom.buyHint')}</p>`;
  }
  const state = st.live ? 'live' : st.apexOk ? 'pending' : 'dns';
  return html`${head}
    <div class="dom-state is-${state}" role="status">${icon(st.live ? 'check' : 'clock', 18)}<div><b>${st.domain}</b><span>${t(`dom.state.${state}`)}</span></div></div>
    ${st.live ? html`<div class="btn-row"><a class="btn btn-secondary btn-sm" href="https://${st.domain}" target="_blank" rel="noopener">${icon('external', 15)} ${t('common.open')}</a></div><p class="muted small">${t('dom.liveNext')}</p>` : html`
    <p class="small">${t('dom.steps')}</p>
    <div class="table-wrap"><table class="dom-table"><thead><tr><th>${t('dom.colType')}</th><th>${t('dom.colName')}</th><th>${t('dom.colValue')}</th><th><span class="sr-only">${t('dom.colOk')}</span></th></tr></thead>
      <tbody>${st.records.map((r) => html`<tr><td>${r.type}</td><td><code>${r.name}</code></td><td><code>${r.value}</code> <button type="button" class="link-btn" data-act="dom-copy" data-v="${r.value}">${t('actions.copy')}</button></td><td>${r.ok ? html`<span class="pc-yes" aria-label="${t('dom.ok')}">${icon('check', 16)}</span>` : ''}</td></tr>`)}</tbody></table></div>
    <details class="dom-help"><summary>${t('dom.helpTitle')}</summary><ul>${REGISTRARS.map((k) => html`<li><b>${t(`dom.reg.${k}.name`)}</b> ${t(`dom.reg.${k}.how`)}</li>`)}</ul><p class="muted small">${t('dom.helpNote')}</p></details>
    ${st.auto ? '' : html`<p class="muted small">${icon('info', 14)} ${t('dom.manual')}</p>`}`}
    <div class="btn-row">${st.live ? '' : html`<button type="button" class="btn btn-primary btn-sm" data-act="dom-check" ${loading ? 'disabled' : ''}>${loading ? html`<i class="spin"></i>` : icon('refresh', 15)} ${t('dom.check')}</button>`}
      <button type="button" class="btn btn-ghost btn-sm danger" data-act="dom-remove">${t('dom.remove')}</button></div>`;
}

inputs['dom-draft'] = (el) => { draft = el.value.slice(0, 253); };
document.addEventListener('submit', async (e) => {
  if (!e.target.matches?.('[data-dom-form]')) return;
  e.preventDefault(); if (busy) return;
  busy = true; rerender();
  const r = await setDomain(draft.trim()); busy = false;
  if (r.ok) { st = r.data; draft = ''; checkedAt = Date.now(); toast(t('dom.saved'), 'success'); }
  else toast(t(`dom.err.${['bad_domain', 'domain_taken', 'not_published', 'rate_limited'].includes(r.error) ? r.error : 'failed'}`), 'error');
  rerender();
});
actions['dom-check'] = () => { load(true); rerender(); };
actions['dom-copy'] = async (el) => { const ok = await copyText(el.dataset.v); toast(t(ok ? 'common.copied' : 'common.copyFailed'), ok ? 'success' : 'error'); };
actions['dom-remove'] = async () => {
  if (!(await confirmDialog(t('dom.removeTitle'), t('dom.removeBody', { d: st?.domain || '' }), t('dom.remove')))) return;
  const r = await removeDomain();
  if (r.ok) { st = r.data; toast(t('dom.removed'), 'info'); } else toast(t('common.errorGeneric'), 'error');
  rerender();
};
