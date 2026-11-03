import { html, raw, icon, toast, openModal, limit } from '../core.js';
import { t, fmtNumber, fmtDate } from '../i18n.js';
import { getState, update } from '../store.js';
import { getBiz, displayName } from '../business.js';
import { actions, rerender } from '../registry.js';
import { pageHead } from './shared.js';
import { serverCaps, nearbyPlaces } from '../sources.js';
import { competitorList, liveMetrics } from '../insights.js';
import { isExample } from '../example.js';

const METRICS = ['rating', 'reviewCount', 'distance'];
let metric = 'rating';
let busy = false;
let caps = null;

const fmt = (k, v) => (v == null ? '—' : k === 'rating' ? fmtNumber(v, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : k === 'distance' ? (v >= 1000 ? `${fmtNumber(v / 1000, { maximumFractionDigits: 1 })} km` : `${v} m`) : fmtNumber(Math.round(v)));
const avg = (list, k) => { const v = list.map((c) => c[k]).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

function me() {
  const b = getBiz(); const m = liveMetrics();
  return { id: 'you', name: displayName(), you: true, rating: m.rating, reviewCount: m.reviewCount, distance: 0, website: b.website || (getState().site.publishedAt ? 'localboost' : '') };
}

/** Gaps and strengths, computed only from the numbers on this screen. */
function insights(you, list) {
  const out = [];
  const r = avg(list, 'rating'); const n = avg(list, 'reviewCount'); const withSite = list.filter((c) => c.website).length;
  if (you.rating != null && r != null && you.rating < r - 0.05) out.push({ kind: 'improve', key: 'rating', v: { you: fmt('rating', you.rating), avg: fmt('rating', r) } });
  if (you.reviewCount != null && n != null && you.reviewCount < n) out.push({ kind: 'improve', key: 'reviews', v: { you: you.reviewCount, avg: Math.round(n) } });
  if (!you.website && withSite) out.push({ kind: 'improve', key: 'website', v: { n: withSite, total: list.length } });
  const top = [...list].filter((c) => c.reviewCount != null).sort((a, b) => b.reviewCount - a.reviewCount)[0];
  if (top && you.reviewCount != null && top.reviewCount > you.reviewCount * 2) out.push({ kind: 'improve', key: 'leader', v: { name: top.name, n: top.reviewCount } });
  if (you.rating != null && r != null && you.rating >= Math.max(...list.map((c) => c.rating || 0))) out.push({ kind: 'strength', key: 'bestRating', v: { v: fmt('rating', you.rating) } });
  if (you.reviewCount != null && n != null && you.reviewCount >= n * 1.3) out.push({ kind: 'strength', key: 'moreReviews', v: {} });
  return out;
}

function barGroup(k, all) {
  const rows = all.filter((c) => c[k] != null && !(k === 'distance' && c.you));
  const max = Math.max(1, ...rows.map((c) => c[k]));
  const sorted = [...rows].sort((a, b) => (k === 'distance' ? a[k] - b[k] : b[k] - a[k]));
  return html`<div class="cmp-group"><h4>${t(`comp.m.${k}`)}</h4>
    ${sorted.map((c) => html`<div class="cmp-row ${c.you ? 'is-you' : ''}"><span class="cmp-name">${c.name}</span><span class="cmp-bar"><i style="width:${Math.round((c[k] / max) * 100)}%"></i></span><b class="mono">${fmt(k, c[k])}</b></div>`)}</div>`;
}

export const competitors = {
  id: 'competitors',
  render() {
    const s = getState(); const b = getBiz();
    const list = competitorList(); const fetchedAt = s.competitors?.fetchedAt;
    const canSearch = caps?.places && b.place?.lat != null;
    const head = pageHead({ title: t('comp.title'), sub: t('comp.sub'),
      actions: html`${canSearch ? html`<button class="btn btn-primary" data-act="scan-comp" ${busy ? 'disabled' : ''}>${busy ? html`<i class="spin"></i>` : icon('refresh', 18)} ${t(fetchedAt ? 'comp.refresh' : 'comp.scan')}</button>` : ''}
        <button class="btn btn-secondary" data-act="add-comp">${icon('upload', 18)} ${t('comp.add')}</button>` });
    if (!s.business.loaded) return html`${head}<section class="card empty-hero"><div class="empty-ic">${icon('compare', 34)}</div><h2>${t('start.noBusinessTitle')}</h2><p class="muted">${t('start.noBusinessBody')}</p>
      <button class="btn btn-primary btn-lg" data-act="go" data-route="overview">${t('start.goCollect')}</button></section>`;
    if (!list.length) {
      const why = !caps?.places ? 'comp.noPlaces' : !b.place ? 'comp.noListing' : 'comp.emptyBody';
      return html`${head}<section class="card empty-hero"><div class="empty-ic">${icon('compare', 34)}</div><h2>${t('comp.emptyTitle')}</h2><p class="muted">${t(why)}</p>
        <div class="btn-row center">${canSearch ? html`<button class="btn btn-primary btn-lg" data-act="scan-comp" ${busy ? 'disabled' : ''}>${busy ? html`<i class="spin"></i>` : icon('sparkle', 18)} ${t('comp.scan')}</button>` : ''}
          ${caps?.places && !b.place ? html`<button class="btn btn-primary btn-lg" data-act="edit-biz-go">${t('comp.linkListing')}</button>` : ''}
          <button class="btn btn-secondary btn-lg" data-act="add-comp">${t('comp.add')}</button></div></section>`;
    }
    const you = me(); const all = [you, ...list]; const tips = insights(you, list);
    const ranked = [...all].filter((c) => c.rating != null).sort((a, z) => z.rating - a.rating || (z.reviewCount || 0) - (a.reviewCount || 0));
    const rank = ranked.findIndex((c) => c.you) + 1;
    const fixes = tips.filter((x) => x.kind === 'improve'); const wins = tips.filter((x) => x.kind === 'strength');
    return html`${head}
    <div class="cmp-top">
      <section class="cmp-fix"><p class="tag">${t('comp.improve')}</p>
        <h2>${rank ? t('ledger.rankOf', { n: rank, total: ranked.length }) : t('comp.noRank')}</h2>
        ${fixes.length ? html`<ol class="fix-list">${fixes.map((x) => html`<li>${t(`comp.imp.${x.key}`, x.v)}</li>`)}</ol>` : html`<p>${t('comp.noGaps')}</p>`}
        ${wins.length ? html`<ul class="win-list">${wins.map((x) => html`<li>${icon('check', 16)} ${t(`comp.imp.${x.key}`, x.v)}</li>`)}</ul>` : ''}
        <p class="small fix-note">${fetchedAt ? t('comp.source', { date: fmtDate(fetchedAt) }) : t('comp.sourceManual')}</p></section>
      <section class="card cmp-chart"><div class="cmp-chart-head"><h2 class="card-title">${t('comp.compare')}</h2>
        <div class="seg" role="group" aria-label="${t('comp.compare')}">${METRICS.map((k) => html`<button aria-pressed="${metric === k}" data-act="comp-metric" data-k="${k}">${t(`comp.m.${k}`)}</button>`)}</div></div>
        ${barGroup(metric, all)}</section>
    </div>
    <h2 class="section-h">${t('comp.nearby')}</h2>
    <div class="place-table pt-real" role="table" aria-label="${t('comp.nearby')}">
      <div class="pt-row pt-head" role="row"><span role="columnheader">${t('comp.nearby')}</span>${METRICS.map((k) => html`<span role="columnheader">${t(`comp.m.${k}`)}</span>`)}<span role="columnheader">${t('comp.website')}</span><span></span></div>
      ${all.map((c) => html`<div class="pt-row ${c.you ? 'is-you' : ''}" role="row">
        <span class="pt-name" role="cell"><strong>${c.mapsUrl ? html`<a href="${c.mapsUrl}" target="_blank" rel="noopener">${c.name}</a>` : c.name}</strong>${c.you ? html`<span class="badge badge-live">${t('comp.you')}</span>` : html`<small>${c.custom ? t('comp.yourInput') : c.address || ''}</small>`}</span>
        ${METRICS.map((k) => html`<span role="cell" data-l="${t(`comp.m.${k}`)}">${k === 'rating' && c[k] != null ? '★ ' : ''}${c.you && k === 'distance' ? '—' : fmt(k, c[k])}</span>`)}
        <span role="cell" data-l="${t('comp.website')}"><span class="badge badge-${c.website ? 'live' : 'inference'}">${t(c.website ? 'comp.yes' : 'comp.no')}</span></span>
        <span role="cell" class="pt-x">${c.custom ? html`<button class="icon-btn" data-act="remove-comp" data-id="${c.id}" aria-label="${t('comp.remove')}">${icon('x', 16)}</button>` : ''}</span></div>`)}
    </div>
    <p class="muted small">${t('comp.attribution')}</p>`;
  },
  mount() { if (!caps) serverCaps().then((c) => { caps = c; rerender(); }); },
};

actions['scan-comp'] = async () => {
  const b = getBiz(); if (busy || b.place?.lat == null) return;
  if (isExample()) return toast(t('example.noRefresh'), 'info');
  busy = true; rerender();
  const r = await nearbyPlaces({ lat: b.place.lat, lng: b.place.lng, category: b.category, self: b.place.id, q: `${t(`biz.cat.${b.category}`)} ${b.city}` });
  busy = false;
  if (!r.ok) { toast(t(r.error === 'rate_limited' ? 'comp.errRate' : 'comp.errFailed'), 'error'); return rerender(); }
  update((st) => ({ competitors: { ...st.competitors, list: r.data.places, fetchedAt: r.data.fetchedAt } }));
  toast(t('comp.scanned', { n: r.data.places.length }), 'success'); rerender();
};
actions['edit-biz-go'] = () => { location.hash = '#/overview'; setTimeout(() => actions['edit-biz']?.(), 50); };
actions['comp-metric'] = (el) => { metric = el.dataset.k; rerender(); };
actions['remove-comp'] = (el) => {
  update((st) => ({ competitors: { ...st.competitors, custom: st.competitors.custom.filter((c) => c.id !== el.dataset.id) } }));
  rerender();
};

actions['add-comp'] = async () => {
  const f = (id, label, type, extra = '') => html`<label class="field"><span>${label}</span><input id="${id}" type="${type}" ${raw(extra)}></label>`;
  const res = await openModal({
    title: t('comp.add'),
    body: html`<p class="muted">${t('comp.addBody')}</p>${f('cc-name', t('comp.fName'), 'text', 'maxlength="60" autocomplete="off"')}
      <div class="field-pair">${f('cc-rating', t('comp.m.rating'), 'number', 'min="1" max="5" step="0.1" inputmode="decimal"')}${f('cc-reviews', t('comp.m.reviewCount'), 'number', 'min="0" max="99999" inputmode="numeric"')}</div>
      <label class="check"><input id="cc-site" type="checkbox"><span>${t('comp.hasWebsite')}</span></label>`,
    actions: [{ label: t('common.cancel'), kind: 'btn-ghost', value: false }, {
      label: t('comp.addOk'), kind: 'btn-primary',
      collect: () => {
        const v = (id) => document.getElementById(id);
        const name = limit(v('cc-name').value.trim(), 60); if (!name) return { error: true };
        const num = (id, a, b) => { const raw0 = v(id).value; if (raw0 === '') return null; const n = Number(raw0); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : null; };
        const r = num('cc-reviews', 0, 99999);
        return { id: `c${Date.now()}`, name, rating: num('cc-rating', 1, 5), reviewCount: r == null ? null : Math.round(r), website: v('cc-site').checked ? 'yes' : '' };
      },
    }],
  });
  if (!res || typeof res !== 'object') return;
  if (res.error) return toast(t('comp.needName'), 'error');
  update((st) => ({ competitors: { ...st.competitors, custom: [...(st.competitors.custom || []), res].slice(0, 12) } }));
  toast(t('comp.addedToast'), 'success'); rerender();
};
