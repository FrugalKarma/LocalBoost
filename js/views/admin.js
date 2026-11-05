// Admin area: every client account, with open (view and edit), disable / enable and delete.
import { html, icon, $, toast, confirmDialog } from '../core.js';
import { t, getLang } from '../i18n.js';
import { actions, inputs, go } from '../registry.js';
import { api, isAdmin, authOn } from '../auth.js';
import { loadExample, EXAMPLES } from '../example.js';
import { openClient } from '../cloud.js';
import { pageHead } from './shared.js';

let clients = null; // null = not loaded yet
let loadErr = null;
let loading = false;
let q = '';
let busyId = null;

const fmt = (iso) => {
  if (!iso) return t('admin.never');
  try { return new Intl.DateTimeFormat(getLang(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)); } catch { return iso; }
};
const STAGE_ORDER = ['new', 'start', 'observe', 'diagnose', 'act', 'measure'];

// Without Supabase (customer accounts off) the admin area runs as a demo with fictional clients,
// so the owner can show how it works. Opening a client loads the matching example business.
const demo = () => !authOn();
const daysAgo = (d) => new Date(Date.now() - d * 864e5).toISOString();
const DEMO = () => [
  { id: 'demo-cafe', kind: 'cafe', email: 'salut@aurora.example', role: 'client', disabled: false, plan: 'business', created_at: daysAgo(40), business: { name: EXAMPLES.cafe.business.name, category: 'cafe', city: 'Iași', stage: 'act', updated_at: daysAgo(0.1) } },
  { id: 'demo-salon', kind: 'salon', email: 'programari@lumen.example', role: 'client', disabled: false, plan: 'pro', created_at: daysAgo(22), business: { name: EXAMPLES.salon.business.name, category: 'salon', city: 'Iași', stage: 'diagnose', updated_at: daysAgo(2) } },
  { id: 'demo-restaurant', kind: 'restaurant', email: 'rezervari@bistrocopou.example', role: 'client', disabled: false, plan: 'free', created_at: daysAgo(9), business: { name: EXAMPLES.restaurant.business.name, category: 'restaurant', city: 'Iași', stage: 'observe', updated_at: daysAgo(5) } },
  { id: 'demo-new', kind: null, email: 'nou.client@example.ro', role: 'client', disabled: false, plan: 'free', created_at: daysAgo(1), business: null },
  { id: 'demo-off', kind: null, email: 'spam.account@example.com', role: 'client', disabled: true, plan: 'free', created_at: daysAgo(60), business: null },
];
async function load() {
  if (demo()) { clients ||= DEMO(); loadErr = null; paintBody(); return; }
  loading = true; loadErr = null; paintBody();
  const r = await api('/api/admin?op=clients');
  loading = false;
  if (r.status === 200) clients = r.body.clients || [];
  else loadErr = r.body.error || 'error';
  paintBody();
}

function matches(c) {
  if (!q) return true;
  const hay = `${c.email} ${c.business?.name || ''} ${c.business?.city || ''}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

function stagePill(stage) {
  const s = STAGE_ORDER.includes(stage) ? stage : 'new';
  const n = STAGE_ORDER.indexOf(s);
  return html`<span class="stage-pill" data-stage="${s}"><span class="stage-dots" aria-hidden="true">${[2, 3, 4, 5].map((i) => html`<i class="${n >= i ? 'on' : ''}"></i>`)}</span>${t(`admin.stage.${s}`)}</span>`;
}

function row(c) {
  const b = c.business; const admin = c.role === 'admin'; const busy = busyId === c.id;
  return html`<li class="client ${c.disabled ? 'is-off' : ''}">
    <div class="client-main">
      <span class="client-av" aria-hidden="true">${(b?.name || c.email || '?').slice(0, 1).toUpperCase()}</span>
      <div class="client-txt"><strong>${b?.name || html`<em>${t('admin.noBusiness')}</em>`}</strong>
        <small>${c.email}${b?.city ? ` · ${b.city}` : ''}</small></div>
    </div>
    <div class="client-stage">${stagePill(b?.stage)}</div>
    <div class="client-when"><small>${t('admin.colUpdated')}</small>${fmt(b?.updated_at)}</div>
    <div class="client-plan">${admin ? '' : html`<label><span class="sr-only">${t('admin.plan')}: ${c.email}</span><select data-in="admin-plan" data-id="${c.id}" ${busy ? 'disabled' : ''}>${['free', 'pro', 'business'].map((p) => html`<option value="${p}" ${c.plan === p ? 'selected' : ''}>${t(`plans.${p}.name`)}</option>`)}</select></label>`}</div>
    <div class="client-status">${admin ? html`<span class="badge badge-admin">${t('admin.roleAdmin')}</span>`
      : html`<span class="badge ${c.disabled ? 'badge-off' : 'badge-on'}">${t(c.disabled ? 'admin.statusDisabled' : 'admin.statusActive')}</span>`}</div>
    <div class="client-acts">
      <button class="btn btn-primary btn-sm" data-act="admin-open" data-id="${c.id}" ${busy ? 'disabled' : ''}>${icon('eye', 16)} ${t('admin.open')}</button>
      ${admin ? '' : html`<button class="btn btn-secondary btn-sm" data-act="admin-toggle" data-id="${c.id}" ${busy ? 'disabled' : ''}>${t(c.disabled ? 'admin.enable' : 'admin.disable')}</button>
      <button class="btn btn-ghost btn-sm danger" data-act="admin-delete" data-id="${c.id}" ${busy ? 'disabled' : ''} aria-label="${t('admin.delete')}: ${c.email}">${icon('trash', 16)}</button>`}
    </div></li>`;
}

function body() {
  if (loadErr) return html`<div class="card empty-hero"><p>${t('admin.loadError')}</p><button class="btn btn-primary" data-act="admin-reload">${icon('refresh', 18)} ${t('actions.retry')}</button></div>`;
  if (!clients) return html`<ul class="client-list" aria-busy="true">${[0, 1, 2].map(() => html`<li class="client sk"><span class="skel" style="width:60%"></span></li>`)}</ul>`;
  const list = clients.filter(matches);
  if (!clients.length) return html`<div class="card empty-hero"><p>${t('admin.empty')}</p></div>`;
  if (!list.length) return html`<p class="admin-none">${t('admin.noMatch', { q })}</p>`;
  return html`<ul class="client-list">${list.map(row)}</ul>`;
}

function counts() {
  const cl = (clients || []).filter((c) => c.role !== 'admin');
  const off = cl.filter((c) => c.disabled).length;
  const active = cl.filter((c) => !c.disabled && c.business?.updated_at && Date.now() - Date.parse(c.business.updated_at) < 7 * 864e5).length;
  return [[cl.length, t('admin.total')], [active, t('admin.activeWeek')], [off, t('admin.disabled')]];
}

function paintBody() {
  const el = $('#admin-body'); if (el) el.innerHTML = body().s;
  const k = $('#admin-kpis'); if (k) k.innerHTML = kpis().s;
}
const kpis = () => html`${counts().map(([n, l]) => html`<div class="kpi"><b>${clients ? n : '–'}</b><span>${l}</span></div>`)}`;

export const admin = {
  id: 'admin',
  render() {
    if (!isAdmin()) return html`<div class="card empty-hero"><p>${t('admin.notAdmin')}</p></div>`;
    return html`${pageHead({ note: 'A', title: t('admin.title'), sub: t('admin.sub') })}
      ${demo() ? html`<div class="example-bar demo-admin" role="status">${icon('sparkle', 18)}<p><b>${t('admin.demoTitle')}</b> ${t('admin.demoBody')}</p></div>` : ''}
      <div class="admin-bar">
        <div class="admin-kpis" id="admin-kpis">${kpis()}</div>
        <label class="field admin-search"><span class="sr-only">${t('admin.search')}</span>${icon('signals', 18)}
          <input type="search" data-in="admin-q" placeholder="${t('admin.search')}" value="${q}" autocomplete="off"></label>
        <button class="icon-btn" data-act="admin-reload" aria-label="${t('actions.retry')}" title="${t('actions.retry')}">${icon('refresh', 18)}</button>
      </div>
      <div id="admin-body" aria-live="polite">${body()}</div>`;
  },
  mount() { if (isAdmin() && !loading) load(); },
};

inputs['admin-q'] = (el) => { q = el.value.trim().slice(0, 80); const b = $('#admin-body'); if (b) b.innerHTML = body().s; };
document.addEventListener('input', (e) => { if (e.target.matches?.('[data-in="admin-q"]')) inputs['admin-q'](e.target); }); // type="search" is not in the app's text-input list
actions['admin-reload'] = () => load();
inputs['admin-plan'] = async (el) => {
  const c = find(el.dataset.id); if (!c) return;
  const plan = el.value;
  if (demo()) { c.plan = plan; toast(t('admin.planSet', { email: c.email, plan: t(`plans.${plan}.name`) }), 'success'); return paintBody(); }
  busyId = c.id;
  const r = await api('/api/admin', { method: 'POST', body: { op: 'plan', id: c.id, plan } });
  busyId = null;
  if (r.status === 200) { c.plan = plan; toast(t('admin.planSet', { email: c.email, plan: t(`plans.${plan}.name`) }), 'success'); }
  else { toast(t('common.errorGeneric'), 'error'); }
  paintBody();
};

actions['admin-open'] = async (el) => {
  if (demo()) { const c = find(el.dataset.id); if (!c?.kind) return toast(t('admin.demoEmpty'), 'info'); loadExample(c.kind); toast(t('admin.demoOpened', { name: c.business.name }), 'success'); go('overview'); return; }
  busyId = el.dataset.id; paintBody();
  const r = await openClient(el.dataset.id);
  busyId = null;
  if (r !== 'ok') { paintBody(); return toast(t('admin.loadError'), 'error'); }
  go('overview');
};

const find = (id) => clients?.find((c) => c.id === id);
actions['admin-toggle'] = async (el) => {
  const c = find(el.dataset.id); if (!c) return;
  const off = !c.disabled;
  if (off && !(await confirmDialog(t('admin.confirmDisableTitle', { email: c.email }), t('admin.confirmDisableBody'), t('admin.disable')))) return;
  if (demo()) { c.disabled = off; toast(t(off ? 'admin.toastDisabled' : 'admin.toastEnabled'), 'success'); return paintBody(); }
  busyId = c.id; paintBody();
  const r = await api('/api/admin', { method: 'POST', body: { op: off ? 'disable' : 'enable', id: c.id } });
  busyId = null;
  if (r.status === 200) { c.disabled = off; toast(t(off ? 'admin.toastDisabled' : 'admin.toastEnabled'), 'success'); }
  else toast(t(r.body.error === 'admin_self' ? 'admin.adminSelf' : 'common.errorGeneric'), 'error');
  paintBody();
};
actions['admin-delete'] = async (el) => {
  const c = find(el.dataset.id); if (!c) return;
  if (!(await confirmDialog(t('admin.confirmDeleteTitle', { email: c.email }), t('admin.confirmDeleteBody'), t('admin.delete')))) return;
  if (demo()) { clients = clients.filter((x) => x.id !== c.id); toast(t('admin.toastDeleted'), 'success'); return paintBody(); }
  busyId = c.id; paintBody();
  const r = await api('/api/admin', { method: 'POST', body: { op: 'delete', id: c.id } });
  busyId = null;
  if (r.status === 200) { clients = clients.filter((x) => x.id !== c.id); toast(t('admin.toastDeleted'), 'success'); }
  else toast(t(r.body.error === 'admin_self' ? 'admin.adminSelf' : 'common.errorGeneric'), 'error');
  paintBody();
};
