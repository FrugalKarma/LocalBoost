// Free one-page report the field team leaves with a business owner: their Google profile against the places
// nearby, the three things to fix first, and a QR code to the demo. Admin only; printed from the browser (Save as PDF).
import { html, raw, icon, toast, $ } from './core.js';
import { t, getLang } from './i18n.js';
import { actions, inputs } from './registry.js';
import { findPlaces, placeDetails, nearbyPlaces } from './sources.js';
import { qrSvg } from './qr.js';

const REP_KEY = 'arcton-field-rep';
let q = ''; let results = null; let busy = false; let report = null; let err = '';
const rep = () => { try { return localStorage.getItem(REP_KEY) || ''; } catch { return ''; } };

/** Google's primary type → the app's competitor categories (lib/places-core.mjs TYPES). */
function categoryOf(type = '') {
  if (/cafe|coffee/.test(type)) return { category: 'cafe' };
  if (/restaurant|bistro|pizz/.test(type)) return { category: 'restaurant' };
  if (/salon|barber|beauty|nail|spa/.test(type)) return { category: 'salon' };
  if (/store|shop/.test(type)) return { category: 'shop' };
  return { category: 'other', q: type.replace(/_/g, ' ') || 'shop' };
}
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const fmt1 = (n) => (n == null ? '–' : n.toLocaleString(getLang(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

/** Everything the report says, from the place and its neighbours. Exported for the self-check. */
export function analyse(place, nearby) {
  const others = nearby.filter((p) => p.rating != null);
  const areaRating = avg(others.map((p) => p.rating)); const areaReviews = avg(others.map((p) => p.reviewCount || 0));
  const all = [...others, place].filter((p) => p.rating != null).sort((a, b) => (b.rating - a.rating) || ((b.reviewCount || 0) - (a.reviewCount || 0)));
  const rank = place.rating != null && all.length > 1 ? all.indexOf(place) + 1 : null; // no neighbours: no ranking
  const top = [...others].sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0)).slice(0, 3);
  const fixes = [];
  if (areaReviews != null && (place.reviewCount || 0) < areaReviews) fixes.push(['reviews', { n: place.reviewCount || 0, m: Math.round(areaReviews) }]);
  if (areaRating != null && place.rating != null && place.rating < areaRating - 0.05) fixes.push(['rating', { r: fmt1(place.rating), a: fmt1(areaRating) }]);
  if (!place.website) fixes.push(['site', {}]);
  if (!(place.hours || []).length) fixes.push(['hours', {}]);
  if (!place.phone) fixes.push(['phone', {}]);
  if ((place.reviews || []).some((v) => v.rating <= 3)) fixes.push(['negative', {}]);
  if (fixes.length < 3) fixes.push(['replies', {}]);
  if (fixes.length < 3) fixes.push(['posts', {}]);
  return { areaRating, areaReviews, rank, total: all.length, top, fixes: fixes.slice(0, 3) };
}

export function fieldSection() {
  return html`<section class="card admin-sec field-sec" id="field-report"><div class="admin-sec-head"><div><h2>${t('field.title')}</h2><p class="muted small">${t('field.sub')}</p></div></div>
    <form class="field-form" data-field-form novalidate>
      <label class="field"><span>${t('field.search')}</span><input type="search" data-in="field-q" value="${q}" placeholder="${t('field.searchPh')}" maxlength="160" autocomplete="off"></label>
      <label class="field"><span>${t('field.rep')}</span><input type="text" data-in="field-rep" value="${rep()}" placeholder="${t('field.repPh')}" maxlength="80" autocomplete="off"></label>
      <button type="submit" class="btn btn-primary" ${busy ? 'disabled' : ''}>${busy ? html`<i class="spin"></i>` : icon('signals', 16)} ${t('field.find')}</button>
    </form>
    ${err ? html`<p class="small err-line" role="alert">${err}</p>` : ''}
    ${results && !report ? html`<ul class="field-results">${results.map((p, i) => html`<li><button type="button" class="link-btn" data-act="field-pick" data-i="${i}"><b>${p.name}</b> <small class="muted">${p.address}</small></button></li>`)}</ul>` : ''}
    ${report ? html`<div class="field-actions"><button type="button" class="btn btn-primary" data-act="field-print">${icon('download', 16)} ${t('field.print')}</button><button type="button" class="btn btn-ghost" data-act="field-clear">${t('field.other')}</button></div>
      <div class="fr-wrap">${page(report)}</div>` : ''}
  </section>`;
}

/** The printable page (A4). Light colours on purpose: it is printed. */
function page({ place, a, at }) {
  const url = `${location.origin}/?demo`; const who = rep();
  const stat = (v, l) => html`<div class="fr-stat"><b>${v}</b><span>${l}</span></div>`;
  return html`<article class="fr-page" lang="${getLang()}">
    <header class="fr-head"><img src="/icons/logo.svg" alt="" width="34" height="34"><div><p class="fr-kicker">${t('field.kicker')}</p><h3>${place.name}</h3><p class="fr-addr">${place.address}</p></div></header>
    <div class="fr-stats">${stat(fmt1(place.rating), t('field.statRating'))}${stat(place.reviewCount || 0, t('field.statReviews'))}${stat(a.rank ? `${a.rank} / ${a.total}` : '–', t('field.statRank'))}</div>
    <p class="fr-area">${a.areaRating != null ? t('field.area', { r: fmt1(a.areaRating), n: Math.round(a.areaReviews), k: a.total - 1 }) : t('field.noArea')}</p>
    <h4>${t('field.fixTitle')}</h4>
    <ol class="fr-fixes">${a.fixes.map(([k, v]) => html`<li><b>${t(`field.fix.${k}.t`, v)}</b><span>${t(`field.fix.${k}.b`, v)}</span></li>`)}</ol>
    ${a.top.length ? html`<h4>${t('field.topTitle')}</h4><table class="fr-top"><thead><tr><th>${t('field.colName')}</th><th>${t('field.statRating')}</th><th>${t('field.statReviews')}</th><th>${t('field.colSite')}</th></tr></thead>
      <tbody>${a.top.map((p) => html`<tr><td>${p.name}</td><td>${fmt1(p.rating)}</td><td>${p.reviewCount || 0}</td><td>${p.website ? t('field.yes') : t('field.no')}</td></tr>`)}</tbody></table>` : ''}
    <footer class="fr-foot"><div class="fr-qr">${raw(qrSvg(url, { size: 120 }))}</div><div><p><b>${t('field.ctaTitle')}</b></p><p>${t('field.ctaBody')}</p>${who ? html`<p class="fr-rep">${t('field.contact', { who })}</p>` : ''}
      <p class="fr-src">${t('field.source', { date: new Date(at).toLocaleDateString(getLang()) })}</p></div></footer>
  </article>`;
}

const rerender = () => { const el = $('#field-report'); if (el) el.outerHTML = fieldSection().s; };
inputs['field-q'] = (el) => { q = el.value.slice(0, 160); };
inputs['field-rep'] = (el) => { try { localStorage.setItem(REP_KEY, el.value.slice(0, 80)); } catch { /* storage blocked: the name is just not remembered */ } };
document.addEventListener('submit', async (e) => {
  if (!e.target.matches?.('[data-field-form]')) return;
  e.preventDefault();
  if (q.trim().length < 3) { err = t('biz.googleErr.short'); return rerender(); }
  busy = true; err = ''; report = null; rerender();
  const r = await findPlaces(q.trim()); busy = false;
  if (r.ok) results = r.data.places || []; else { results = null; err = t(`biz.googleErr.${['rate_limited', 'network', 'places_key', 'quota_reached', 'no_credits'].includes(r.error) ? r.error : 'failed'}`); }
  if (results && !results.length) err = t('field.none');
  rerender();
});
actions['field-pick'] = async (el) => {
  const hit = results?.[Number(el.dataset.i)]; if (!hit) return;
  busy = true; rerender();
  const d = await placeDetails(hit.id);
  if (!d.ok) { busy = false; err = t('biz.googleErr.failed'); return rerender(); }
  const place = d.data.place; const c = categoryOf(place.type);
  const n = place.lat != null ? await nearbyPlaces({ lat: place.lat, lng: place.lng, category: c.category, self: place.id, q: c.q }) : { ok: false };
  const a = analyse(place, n.ok ? n.data.places : []);
  busy = false; report = { place, a, at: Date.now() }; rerender();
  if (!n.ok) toast(t('field.noNearby'), 'info');
};
actions['field-clear'] = () => { report = null; rerender(); };
actions['field-print'] = () => {
  if (!report) return;
  const root = document.createElement('div'); root.id = 'print-root'; root.innerHTML = page(report).s;
  document.body.append(root); document.body.classList.add('printing');
  const done = () => { root.remove(); document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => { window.print(); setTimeout(done, 1500); }, 60);
};
