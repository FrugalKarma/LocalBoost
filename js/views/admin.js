// Admin area: every client account, with open (view and edit), disable / enable and delete.
import { html, icon, $, toast, confirmDialog, openModal, copyText, downloadBlob } from '../core.js';
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
const dmy = (ymd) => String(ymd || '').split('-').reverse().join('.');
const until = (ymd) => Math.ceil((Date.parse(`${ymd}T00:00:00Z`) - Date.now()) / 864e5); // days left (negative: past)
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
    <div class="client-when"><small>${t('admin.colUpdated')}</small>${fmt(b?.updated_at)}${c.planUntil && !admin ? html`<small class="${until(c.planUntil) < 0 ? 'until-late' : until(c.planUntil) <= 7 ? 'until-soon' : ''}">${t(until(c.planUntil) < 0 ? 'admin.pay.expired' : 'admin.pay.until', { date: dmy(c.planUntil) })}</small>` : ''}</div>
    <div class="client-plan">${admin ? '' : html`<label><span class="sr-only">${t('admin.plan')}: ${c.email}</span><select data-in="admin-plan" data-id="${c.id}" ${busy ? 'disabled' : ''}>${['free', 'pro', 'business'].map((p) => html`<option value="${p}" ${c.plan === p ? 'selected' : ''}>${t(`plans.${p}.name`)}</option>`)}</select></label>`}${c.planRequest === 'trial' ? html`<span class="pay-flag is-trial" title="${c.planRequestNote}">${t('admin.trial.flag')}</span>${c.planRequestNote ? html`<small class="trial-note">„${c.planRequestNote}”</small>` : ''}<button type="button" class="link-btn pay-btn" data-act="admin-trial" data-id="${c.id}" ${busy ? 'disabled' : ''}>${icon('star', 14)} ${t('admin.trial.button')}</button>`
      : c.planRequest ? html`<span class="pay-flag" title="${c.planRequestAt ? new Date(c.planRequestAt).toLocaleString(getLang()) : ''}">${c.planRequest === 'business' ? t('admin.customFlag') : t('pay.adminFlag', { plan: t(`plans.${c.planRequest}.name`) })}</span>${c.planRequestNote ? html`<small class="trial-note">„${c.planRequestNote}”</small>` : ''}` : ''}${admin ? '' : html`<button type="button" class="link-btn pay-btn" data-act="admin-paid" data-id="${c.id}" ${busy ? 'disabled' : ''}>${icon('check', 14)} ${t('admin.pay.button')}</button>`}</div>
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
        <button class="btn btn-primary" data-act="admin-new">${icon('plus', 18)} ${t('admin.new.button')}</button>
      </div>
      <div id="admin-body" aria-live="polite">${body()}</div>
      <div id="admin-extra">${extra()}</div>`;
  },
  mount() { if (isAdmin() && !loading) { load(); loadExtra(); } },
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
  if (r.status === 200) { c.plan = plan; c.planRequest = null; toast(t('admin.planSet', { email: c.email, plan: t(`plans.${plan}.name`) }), 'success'); }
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

/* ---------- new client account (created by the admin, confirmed at once, temporary password) ---------- */
const SITE = 'https://www.arcton.site';
const demoPassword = () => { const c = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const r = crypto.getRandomValues(new Uint8Array(12)); return [0, 4, 8].map((i) => [...r.slice(i, i + 4)].map((b) => c[b % c.length]).join('')).join('-'); };
const ERR = { invalid_email: 'admin.new.errEmail', email_taken: 'admin.new.errTaken' };

async function newClientForm(prev = {}, err = '') {
  return openModal({
    title: t('admin.new.title'),
    body: html`<div class="new-client">
      <p class="muted">${t('admin.new.body')}</p>
      ${err ? html`<p class="auth-error" role="alert">${t(ERR[err] || 'common.errorGeneric')}</p>` : ''}
      <label class="field"><span>${t('admin.new.email')}</span><input id="nc-email" type="email" autocomplete="off" maxlength="200" value="${prev.email || ''}" placeholder="client@example.ro"></label>
      <label class="field"><span>${t('admin.plan')}</span><select id="nc-plan">${['free', 'pro', 'business'].map((p) => html`<option value="${p}" ${(prev.plan || 'free') === p ? 'selected' : ''}>${t(`plans.${p}.name`)}</option>`)}</select></label>
    </div>`,
    actions: [
      { label: t('common.cancel'), kind: 'btn-ghost', value: null },
      { label: t('admin.new.create'), kind: 'btn-primary', collect: () => ({ email: $('#nc-email')?.value.trim() || '', plan: $('#nc-plan')?.value || 'free' }) },
    ],
  });
}

function createdView(email, password) {
  const msg = t('admin.new.message', { email, password, url: SITE });
  return openModal({
    title: t('admin.new.doneTitle'),
    body: html`<div class="new-done">
      <p>${t('admin.new.doneBody', { email })}</p>
      <dl class="cred"><div><dt>${t('admin.new.email')}</dt><dd>${email}</dd></div>
        <div><dt>${t('admin.new.password')}</dt><dd><code>${password}</code></dd></div></dl>
      <p class="muted small">${t('admin.new.once')}</p>
      <label class="field"><span>${t('admin.new.messageLabel')}</span><textarea id="nc-msg" rows="6" readonly>${msg}</textarea></label>
    </div>`,
    actions: [{ label: t('admin.new.copy'), kind: 'btn-secondary', collect: () => 'copy' }, { label: t('common.close'), kind: 'btn-primary', value: null }],
  }).then(async (v) => { if (v === 'copy') { await copyText(msg); toast(t('admin.new.copied'), 'success'); } });
}

actions['admin-new'] = async () => {
  let form = {}; let err = '';
  for (;;) {
    const v = await newClientForm(form, err); if (!v) return;
    form = v;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) { err = 'invalid_email'; continue; }
    if (demo()) {
      if (clients?.some((c) => c.email === v.email.toLowerCase())) { err = 'email_taken'; continue; }
      const c = { id: `demo-${Date.now()}`, kind: null, email: v.email.toLowerCase(), role: 'client', disabled: false, plan: v.plan, created_at: new Date().toISOString(), business: null };
      clients = [c, ...(clients || [])]; paintBody();
      return createdView(c.email, demoPassword());
    }
    const r = await api('/api/admin', { method: 'POST', body: { op: 'create', email: v.email, plan: v.plan } });
    if (r.status === 200) {
      clients = [{ ...r.body.client, role: 'client', disabled: false, created_at: new Date().toISOString(), business: null }, ...(clients || [])]; paintBody();
      return createdView(r.body.client.email, r.body.password);
    }
    err = r.body?.error || 'error';
  }
};

/* ---------- bank transfers: "Plată primită" ---------- */
const PRICE = { pro: 49.99, business: null }; // same as lib/auth-core.mjs PRICE (Custom Premium is priced per client)
let payments = null; let waitlist = null; let mailOn = false;
const csv = (rows) => rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
const ref = (id) => `ARCTON-${String(id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;

async function loadExtra() {
  if (demo()) { payments ||= []; waitlist ||= []; return paintExtra(); }
  const [p, w] = await Promise.all([api('/api/admin?op=payments'), api('/api/admin?op=waitlist')]);
  payments = p.status === 200 ? p.body.payments : null; waitlist = w.status === 200 ? w.body.list : null; mailOn = !!w.body?.mail;
  paintExtra();
}
function paintExtra() { const el = $('#admin-extra'); if (el) el.innerHTML = extra().s; }
function extra() {
  const money = (n) => `${Number(n).toFixed(2).replace(/\.00$/, '')} EUR`;
  const total = (payments || []).filter((p) => p.paid_on?.slice(0, 7) === new Date().toISOString().slice(0, 7)).reduce((a, p) => a + Number(p.amount_eur), 0);
  return html`<section class="card admin-sec"><div class="admin-sec-head"><div><h2>${t('admin.pay.title')}</h2><p class="muted small">${t('admin.pay.sub', { total: money(total) })}</p></div>
      ${payments?.length ? html`<button class="btn btn-secondary btn-sm" data-act="admin-pay-csv">${icon('download', 15)} CSV</button>` : ''}</div>
    ${payments == null ? html`<p class="muted small">${t('admin.pay.none')}</p>` : !payments.length ? html`<p class="muted small">${t('admin.pay.empty')}</p>`
      : html`<table class="admin-table"><thead><tr><th>${t('admin.pay.colDate')}</th><th>${t('admin.new.email')}</th><th>${t('admin.plan')}</th><th>${t('admin.pay.colAmount')}</th><th>${t('admin.pay.colRef')}</th><th>${t('admin.pay.colUntil')}</th></tr></thead>
        <tbody>${payments.slice(0, 20).map((p) => html`<tr><td>${dmy(p.paid_on)}</td><td>${p.email}</td><td>${t(`plans.${p.plan}.name`)} · ${p.months} ${t('admin.pay.mo')}</td><td>${money(p.amount_eur)}</td><td>${p.reference}</td><td>${dmy(p.plan_until)}</td></tr>`)}</tbody></table>`}
  </section>
  <section class="card admin-sec"><div class="admin-sec-head"><div><h2>${t('admin.wait.title')}</h2><p class="muted small">${waitlist == null ? t('admin.wait.none') : t('admin.wait.sub', { n: waitlist.length })}</p></div>
      ${waitlist?.length ? html`<div class="btn-row"><button class="btn btn-secondary btn-sm" data-act="admin-wait-csv">${icon('download', 15)} CSV</button>
        <button class="btn btn-primary btn-sm" data-act="admin-wait-send" ${mailOn ? '' : 'disabled'}>${t('admin.wait.send')}</button></div>` : ''}</div>
    ${waitlist?.length && !mailOn ? html`<p class="muted small">${icon('info', 14)} ${t('admin.wait.noMail')}</p>` : ''}
  </section>`;
}
actions['admin-pay-csv'] = () => downloadBlob(`arcton-plati-${new Date().toISOString().slice(0, 10)}.csv`, new Blob([`\uFEFF${csv([['data', 'email', 'plan', 'luni', 'suma_eur', 'referinta', 'activ_pana', 'inregistrat'], ...payments.map((p) => [p.paid_on, p.email, p.plan, p.months, p.amount_eur, p.reference, p.plan_until, p.created_at])])}`], { type: 'text/csv' }));
actions['admin-wait-csv'] = () => downloadBlob(`arcton-lista-asteptare-${new Date().toISOString().slice(0, 10)}.csv`, new Blob([`\uFEFF${csv([['email', 'limba', 'inscris'], ...waitlist.map((w) => [w.email, w.lang, w.created_at])])}`], { type: 'text/csv' }));
actions['admin-wait-send'] = async () => {
  if (!(await confirmDialog(t('admin.wait.confirmTitle', { n: waitlist.length }), t('admin.wait.confirmBody'), t('admin.wait.send')))) return;
  const r = await api('/api/admin', { method: 'POST', body: { op: 'waitlist-send' } });
  if (r.status === 200) toast(t('admin.wait.sent', { n: r.body.sent, of: r.body.of }), r.body.sent === r.body.of ? 'success' : 'error');
  else toast(t(r.body.error === 'email_not_configured' ? 'admin.wait.noMail' : 'common.errorGeneric'), 'error');
  loadExtra();
};

actions['admin-paid'] = async (el) => {
  const c = find(el.dataset.id); if (!c) return;
  const today = new Date().toISOString().slice(0, 10);
  const plan0 = ['pro', 'business'].includes(c.planRequest) ? c.planRequest : (c.plan !== 'free' ? c.plan : 'pro');
  const v = await openModal({
    title: t('admin.pay.modalTitle', { email: c.email }),
    body: html`<div class="pay-form">
      <p class="muted">${t('admin.pay.modalBody')}</p>
      <div class="field-pair"><label class="field"><span>${t('admin.plan')}</span><select id="pf-plan">${['pro', 'business'].map((p) => html`<option value="${p}" ${plan0 === p ? 'selected' : ''}>${t(`plans.${p}.name`)}${PRICE[p] ? ` · ${PRICE[p]} €/${t('admin.pay.mo')}` : ''}</option>`)}</select></label>
        <label class="field"><span>${t('admin.pay.months')}</span><select id="pf-months">${[1, 3, 6, 12].map((m) => html`<option value="${m}">${m}</option>`)}</select></label></div>
      <div class="field-pair"><label class="field"><span>${t('admin.pay.colAmount')} (EUR)</span><input id="pf-amount" type="number" min="1" max="10000" step="0.01" value="${PRICE[plan0] ?? ''}"></label>
        <label class="field"><span>${t('admin.pay.colDate')}</span><input id="pf-date" type="date" max="${today}" value="${today}"></label></div>
      <label class="field"><span>${t('admin.pay.colRef')}</span><input id="pf-ref" type="text" maxlength="60" value="${ref(c.id)}"></label>
      <p class="muted small">${t('admin.pay.mailNote')}</p></div>`,
    actions: [{ label: t('common.cancel'), kind: 'btn-ghost', value: null },
      { label: t('admin.pay.confirm'), kind: 'btn-primary', collect: () => ({ plan: $('#pf-plan').value, months: Number($('#pf-months').value), amount: Number($('#pf-amount').value), paidOn: $('#pf-date').value, reference: $('#pf-ref').value.trim() }) }],
  });
  if (!v) return;
  if (!(v.amount > 0)) return toast(t('admin.pay.badAmount'), 'error');
  if (demo()) { c.plan = v.plan; c.planRequest = null; c.planUntil = today; toast(t('admin.pay.done', { plan: t(`plans.${v.plan}.name`), date: dmy(today) }), 'success'); return paintBody(); }
  busyId = c.id; paintBody();
  const r = await api('/api/admin', { method: 'POST', body: { op: 'paid', id: c.id, ...v } });
  busyId = null;
  if (r.status === 200) {
    Object.assign(c, { plan: r.body.plan, planUntil: r.body.planUntil, planRequest: null });
    toast(`${t('admin.pay.done', { plan: t(`plans.${r.body.plan}.name`), date: dmy(r.body.planUntil) })} ${t(r.body.emailed ? 'admin.pay.emailed' : 'admin.pay.notEmailed')}`, 'success');
    loadExtra();
  } else toast(t(r.body.error === 'bad_amount' ? 'admin.pay.badAmount' : 'common.errorGeneric'), 'error');
  paintBody();
};
actions['admin-trial'] = async (el) => {
  const c = find(el.dataset.id); if (!c) return;
  const v = await openModal({
    title: t('admin.trial.title', { email: c.email }),
    body: html`<div class="pay-form">${c.planRequestNote ? html`<p>„${c.planRequestNote}”</p>` : ''}<p class="muted">${t('admin.trial.body')}</p>
      <div class="field-pair"><label class="field"><span>${t('admin.plan')}</span><select id="tf-plan">${['pro', 'business'].map((p) => html`<option value="${p}">${t(`plans.${p}.name`)}</option>`)}</select></label>
        <label class="field"><span>${t('admin.trial.days')}</span><select id="tf-days">${[7, 14, 30].map((d) => html`<option value="${d}" ${d === 14 ? 'selected' : ''}>${d}</option>`)}</select></label></div></div>`,
    actions: [{ label: t('common.cancel'), kind: 'btn-ghost', value: null }, { label: t('admin.trial.confirm'), kind: 'btn-primary', collect: () => ({ plan: $('#tf-plan').value, days: Number($('#tf-days').value) }) }],
  });
  if (!v) return;
  if (demo()) { c.plan = v.plan; c.planRequest = null; return paintBody(); }
  busyId = c.id; paintBody();
  const r = await api('/api/admin', { method: 'POST', body: { op: 'trial', id: c.id, ...v } });
  busyId = null;
  if (r.status === 200) { Object.assign(c, { plan: r.body.plan, planUntil: r.body.planUntil, planRequest: null, planRequestNote: '' }); toast(`${t('admin.pay.done', { plan: t(`plans.${r.body.plan}.name`), date: dmy(r.body.planUntil) })} ${t(r.body.emailed ? 'admin.pay.emailed' : 'admin.pay.notEmailed')}`, 'success'); }
  else toast(t('common.errorGeneric'), 'error');
  paintBody();
};
// amount follows plan x months until the admin types their own
document.addEventListener('change', (e) => {
  if (!e.target.matches?.('#pf-plan, #pf-months')) return;
  const a = $('#pf-amount'); const pr = PRICE[$('#pf-plan')?.value]; if (a && pr) a.value = Math.round(PRICE[$('#pf-plan').value] * Number($('#pf-months').value) * 100) / 100;
});
