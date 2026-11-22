// Bookings: everything customers asked for through the website (plus bookings the owner took by phone), grouped by day.
// Confirm or decline, call / WhatsApp / email the customer in one tap, add a booking by hand, and get a phone
// notification for each new one. The list is loaded from the server and kept in memory only (customers' details).
import { html, icon, toast, confirmDialog, openModal, $ } from '../core.js';
import { t, getLang, fmtDate } from '../i18n.js';
import { actions, rerender } from '../registry.js';
import { pageHead } from './shared.js';
import { authOn, signedIn, pushPublicKey } from '../auth.js';
import { setRequestStatus, deleteRequest, addBooking, bookingPush } from '../sources.js';
import { loadSiteData, getSiteData } from '../insights.js';
import { getBiz } from '../business.js';
import { pushState, subscribe, unsubscribe } from '../push.js';
import { viewingClient } from '../cloud.js';

const FILTERS = ['new', 'upcoming', 'all', 'past'];
let filter = 'upcoming'; let pState = null; let busy = false;
const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const isPhone = (c) => !/@/.test(c) && c.replace(/\D/g, '').length >= 6;
/** wa.me wants the number in international form; Romanian mobiles are written 07xx. */
const waNumber = (c) => { let d = c.replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); else if (/^0[1-9]/.test(d)) d = `40${d.slice(1)}`; return d; };
const when = (r) => [r.date ? fmtDate(`${r.date}T12:00:00`, { day: 'numeric', month: 'long' }) : '', r.time || ''].filter(Boolean).join(', ');
function waText(r) {
  const key = r.status === 'declined' ? 'bookings.wa.declined' : r.status === 'confirmed' || r.status === 'done' ? 'bookings.wa.confirmed' : 'bookings.wa.ask';
  return t(key, { name: r.name.split(' ')[0], biz: getBiz().name || '', when: when(r) || t('bookings.wa.soon'), n: r.party || '' }).replace(/\s+,/g, ',');
}
function dayLabel(d) {
  if (!d) return t('bookings.noDate');
  if (d === today()) return t('bookings.today');
  if (d === plusDays(1)) return t('bookings.tomorrow');
  return new Date(`${d}T12:00:00`).toLocaleDateString(getLang(), { weekday: 'long', day: 'numeric', month: 'long' });
}
function visible(list) {
  const now = today();
  const keep = { new: (r) => r.status === 'new', upcoming: (r) => r.status !== 'declined' && r.status !== 'done' && (!r.date || r.date >= now), past: (r) => r.date && r.date < now, all: () => true }[filter];
  const rows = list.filter(keep);
  // upcoming: soonest first; others: newest booking day first; no date at the end
  const k = (r) => `${r.date || (filter === 'upcoming' ? '9999' : '0000')} ${r.time || '99:99'}`;
  return rows.sort((a, b) => (filter === 'upcoming' ? k(a).localeCompare(k(b)) : k(b).localeCompare(k(a))));
}

function item(r) {
  const tel = isPhone(r.contact); const st = r.status;
  const move = (status, label, kind = 'btn-secondary', ic = '') => html`<button class="btn ${kind} btn-sm" data-act="bk-status" data-id="${r.id}" data-status="${status}">${ic ? icon(ic, 15) : ''} ${t(label)}</button>`;
  return html`<li class="bk bk-${st}">
    <div class="bk-time">${r.time || '—'}</div>
    <div class="bk-main"><div class="bk-top"><strong>${r.name}</strong>${r.party ? html`<span class="bk-party">${icon('account', 14)} ${t('website.people', { n: r.party })}</span>` : ''}<span class="bk-pill">${t(`bookings.status.${st}`)}</span></div>
      ${r.message ? html`<p class="bk-msg">“${r.message}”</p>` : ''}
      <p class="muted small">${r.contact} · ${t('bookings.received', { date: fmtDate(r.created_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })}</p>
      <div class="bk-acts">
        ${tel ? html`<a class="btn btn-ghost btn-sm" href="tel:${r.contact.replace(/[^\d+]/g, '')}">${icon('phone', 15)} ${t('bookings.call')}</a>
          <a class="btn btn-ghost btn-sm" href="https://wa.me/${waNumber(r.contact)}?text=${encodeURIComponent(waText(r))}" target="_blank" rel="noopener">${icon('chat', 15)} WhatsApp</a>`
          : html`<a class="btn btn-ghost btn-sm" href="mailto:${r.contact}?subject=${encodeURIComponent(getBiz().name || '')}&body=${encodeURIComponent(waText(r))}">${icon('mail', 15)} ${t('bookings.email')}</a>`}
        ${st === 'new' ? html`${move('confirmed', 'bookings.confirm', 'btn-primary', 'check')}${move('declined', 'bookings.decline', 'btn-ghost')}` : ''}
        ${st === 'confirmed' ? html`${move('done', 'bookings.markDone', 'btn-secondary', 'check')}${move('declined', 'bookings.cancel', 'btn-ghost')}` : ''}
        ${st === 'declined' || st === 'done' ? move('new', 'bookings.reopen', 'btn-ghost') : ''}
        <button class="icon-btn" data-act="bk-del" data-id="${r.id}" aria-label="${t('admin.delete')}">${icon('trash', 15)}</button></div></div></li>`;
}

function pushBox() {
  if (!pushPublicKey() || viewingClient()) return ''; // notifications belong on the owner's own phone
  const s = pState;
  if (s === 'on') return html`<div class="bk-push"><span class="pill pill-on">${icon('check', 14)} ${t('bookings.pushOn')}</span><button class="btn btn-ghost btn-sm" data-act="bk-push-test">${t('admin.leads.test')}</button><button class="btn btn-ghost btn-sm" data-act="bk-push-off">${t('admin.leads.off')}</button></div>`;
  if (s === 'off') return html`<div class="bk-push"><button class="btn btn-secondary btn-sm" data-act="bk-push-on">${icon('sparkle', 15)} ${t('bookings.pushAsk')}</button></div>`;
  if (s === 'ios-home' || s === 'blocked') return html`<p class="muted small">${icon('info', 14)} ${t(s === 'ios-home' ? 'admin.leads.ios' : 'admin.leads.blocked')}</p>`;
  return '';
}

export const bookings = {
  id: 'bookings',
  render() {
    const head = pageHead({ title: t('bookings.title'), sub: t('bookings.sub'),
      actions: html`<button class="btn btn-primary" data-act="bk-add">${icon('plus', 18)} ${t('bookings.add')}</button><button class="btn btn-ghost" data-act="bk-reload" aria-label="${t('actions.retry')}">${icon('refresh', 18)}</button>` });
    if (!authOn() || !signedIn()) return html`${head}<div class="card empty-hero"><p class="muted">${t('bookings.off')}</p></div>`;
    const sd = getSiteData();
    if (!sd) return html`${head}<div class="card"><p class="muted"><i class="spin"></i> ${t('admin.leads.loading')}</p></div>`;
    if (!sd.available) return html`${head}<div class="card empty-hero"><p class="muted">${t('bookings.noSite')}</p><button class="btn btn-primary" data-act="go" data-route="website">${t('nav.website')}</button></div>`;
    const list = sd.requests || []; const now = today();
    const counts = { new: list.filter((r) => r.status === 'new').length, today: list.filter((r) => r.date === now && r.status !== 'declined').length,
      week: list.filter((r) => r.date >= now && r.date <= plusDays(7) && (r.status === 'confirmed' || r.status === 'new')).length };
    const rows = visible(list); const groups = [];
    rows.forEach((r) => { const g = groups[groups.length - 1]; if (g && g.d === (r.date || '')) g.items.push(r); else groups.push({ d: r.date || '', items: [r] }); });
    return html`${head}
      <div class="bk-stats"><div><b>${counts.new}</b><span>${t('bookings.statNew')}</span></div><div><b>${counts.today}</b><span>${t('bookings.statToday')}</span></div><div><b>${counts.week}</b><span>${t('bookings.statWeek')}</span></div></div>
      <div class="bk-bar"><div class="seg" role="group" aria-label="${t('bookings.title')}">${FILTERS.map((f) => html`<button aria-pressed="${filter === f}" data-act="bk-filter" data-f="${f}">${t(`bookings.f.${f}`)}${f === 'new' && counts.new ? html` <span class="badge badge-live">${counts.new}</span>` : ''}</button>`)}</div>${pushBox()}</div>
      ${groups.length ? groups.map((g) => html`<section class="card bk-day"><h2 class="bk-day-h">${dayLabel(g.d)} <small class="muted">${t(g.items.length === 1 ? 'bookings.oneBooking' : 'bookings.nBookings', { n: g.items.length })}</small></h2><ul class="bk-list">${g.items.map(item)}</ul></section>`)
        : html`<div class="card empty-hero"><p class="muted">${t(list.length ? 'bookings.emptyFilter' : 'bookings.empty')}</p></div>`}`;
  },
  mount() {
    if (!getSiteData()) loadSiteData().then(() => rerender()).catch(() => {});
    if (pState == null) pushState().then((s) => { pState = s; rerender(); }).catch(() => { pState = 'unsupported'; });
  },
};

const refresh = async () => { await loadSiteData(true); rerender(); };
actions['bk-filter'] = (el) => { filter = el.dataset.f; rerender(); };
actions['bk-reload'] = refresh;
actions['bk-status'] = async (el) => {
  if (busy) return; busy = true;
  const r = await setRequestStatus(Number(el.dataset.id), el.dataset.status); busy = false;
  if (!r.ok) return toast(t('common.errorGeneric'), 'error');
  toast(t(`bookings.toast.${el.dataset.status}`), 'success'); refresh();
};
actions['bk-del'] = async (el) => {
  const r0 = getSiteData()?.requests?.find((x) => x.id === Number(el.dataset.id)); if (!r0) return;
  if (!(await confirmDialog(t('bookings.delTitle', { name: r0.name }), t('bookings.delBody'), t('admin.delete')))) return;
  const r = await deleteRequest(r0.id); if (!r.ok) return toast(t('common.errorGeneric'), 'error'); refresh();
};
actions['bk-add'] = async () => {
  const v = await openModal({ title: t('bookings.add'), body: html`<p class="muted small">${t('bookings.addSub')}</p>
    <label class="field"><span>${t('bookings.fName')}</span><input id="bk-name" maxlength="80" autocomplete="off"></label>
    <label class="field"><span>${t('bookings.fContact')}</span><input id="bk-contact" maxlength="120" inputmode="tel" autocomplete="off"></label>
    <div class="field-pair"><label class="field"><span>${t('bookings.fDate')}</span><input id="bk-date" type="date" value="${today()}"></label>
      <label class="field"><span>${t('bookings.fTime')}</span><input id="bk-time" type="time"></label></div>
    <label class="field"><span>${t('bookings.fParty')}</span><input id="bk-party" type="number" min="1" max="99" inputmode="numeric"></label>
    <label class="field"><span>${t('bookings.fNote')}</span><textarea id="bk-note" rows="2" maxlength="600"></textarea></label>`,
    actions: [{ label: t('common.cancel'), kind: 'btn-ghost', value: null }, { label: t('bookings.save'), kind: 'btn-primary', collect: () => ({ name: $('#bk-name').value.trim(), contact: $('#bk-contact').value.trim(), date: $('#bk-date').value, time: $('#bk-time').value, party: Number($('#bk-party').value) || null, message: $('#bk-note').value.trim() }) }] });
  if (!v) return;
  if (!v.name || v.contact.length < 5) return toast(t('bookings.needName'), 'error');
  const r = await addBooking(v); if (!r.ok) return toast(t('common.errorGeneric'), 'error');
  toast(t('bookings.added'), 'success'); refresh();
};
actions['bk-push-on'] = async () => {
  const r = await subscribe(pushPublicKey());
  if (r.error) { pState = await pushState(); rerender(); return toast(t(r.error === 'blocked' ? 'admin.leads.blocked' : 'common.errorGeneric'), 'error'); }
  const s = await bookingPush('sub', { sub: r.sub });
  if (!s.ok) { await unsubscribe(); return toast(t('common.errorGeneric'), 'error'); }
  pState = 'on'; rerender(); toast(t('bookings.pushDone'), 'success');
};
actions['bk-push-off'] = async () => { const endpoint = await unsubscribe(); if (endpoint) await bookingPush('unsub', { endpoint }); pState = await pushState(); rerender(); };
actions['bk-push-test'] = async () => { const r = await bookingPush('test'); const ok = r.ok && r.data?.sent > 0; toast(t(ok ? 'admin.leads.testSent' : 'admin.leads.testFail'), ok ? 'success' : 'error'); };
