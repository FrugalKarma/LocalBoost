import { html, raw, icon, toast, openModal, limit } from '../core.js';
import { t, fmtNumber, fmtDate } from '../i18n.js';
import { getState, update } from '../store.js';
import { getBiz, displayName } from '../business.js';
import { actions, inputs, rerender } from '../registry.js';
import { pageHead } from './shared.js';
import { serverCaps, nearbyPlaces } from '../sources.js';
import { competitorList, liveMetrics } from '../insights.js';
import { isExample } from '../example.js';

const METRICS = ['rating', 'reviewCount', 'distance'];
let metric = 'rating';
let busy = false;
let caps = null;
let pace = 10; // new reviews a week, for the goal calculator

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
  // ratings sit between 4 and 5 almost everywhere: start the bar just below the lowest one so the gaps show
  const lo = k === 'rating' ? Math.max(0, Math.floor((Math.min(...rows.map((c) => c[k])) - 0.3) * 10) / 10) : 0;
  const w = (v) => Math.max(3, Math.round(((v - lo) / Math.max(0.1, max - lo)) * 100));
  const sorted = [...rows].sort((a, b) => (k === 'distance' ? a[k] - b[k] : b[k] - a[k]));
  return html`<div class="cmp-group"><h4>${t(`comp.m.${k}`)}</h4>
    ${sorted.map((c) => html`<div class="cmp-row ${c.you ? 'is-you' : ''}"><span class="cmp-name">${c.name}</span><span class="cmp-bar"><i style="width:${w(c[k])}%"></i></span><b>${fmt(k, c[k])}</b></div>`)}
    ${lo > 0 ? html`<p class="small muted cx-axis">${t('comp.chartFrom', { v: fmt('rating', lo) })}</p>` : ''}</div>`;
}

const sign = (n, f) => (n > 0 ? `+${f(n)}` : n < 0 ? `−${f(-n)}` : f(0));

/** Four headline numbers: rating, reviews, websites and the nearest rival, each against the area. */
function kpis(you, list) {
  const r = avg(list, 'rating'); const n = avg(list, 'reviewCount');
  const withSite = list.filter((c) => c.website).length;
  const near = list.filter((c) => c.distance != null).sort((a, b) => a.distance - b.distance);
  const close = near.filter((c) => c.distance <= 500).length;
  const tile = (label, value, delta, tone, note) => html`<div class="cx-kpi"><span class="cx-kpi-l">${label}</span><b class="cx-kpi-v">${value}</b>
    ${delta ? html`<span class="cx-delta is-${tone}">${delta}</span>` : ''}${note ? html`<small>${note}</small>` : ''}</div>`;
  const dr = you.rating != null && r != null ? Math.round((you.rating - r) * 10) / 10 : null;
  const dn = you.reviewCount != null && n ? Math.round(((you.reviewCount - n) / n) * 100) : null;
  return html`<div class="cx-kpis">
    ${tile(t('comp.kpi.rating'), you.rating != null ? `★ ${fmt('rating', you.rating)}` : '—', dr != null ? t('comp.kpi.vsAvg', { d: sign(dr, (x) => fmt('rating', x)) }) : '', dr == null ? '' : dr >= 0 ? 'good' : 'bad', r != null ? t('comp.kpi.avg', { v: fmt('rating', r) }) : '')}
    ${tile(t('comp.kpi.reviews'), you.reviewCount != null ? fmtNumber(you.reviewCount) : '—', dn != null ? t('comp.kpi.vsAvgPct', { d: sign(dn, (x) => fmtNumber(x)) }) : '', dn == null ? '' : dn >= 0 ? 'good' : 'bad', n ? t('comp.kpi.avg', { v: fmtNumber(Math.round(n)) }) : '')}
    ${tile(t('comp.kpi.site'), you.website ? t('comp.yes') : t('comp.no'), t('comp.kpi.siteOf', { n: withSite, total: list.length }), you.website ? 'good' : 'bad', '')}
    ${tile(t('comp.kpi.nearest'), near[0] ? fmt('distance', near[0].distance) : '—', close ? t('comp.kpi.within', { n: close }) : '', 'neutral', near[0]?.name || '')}
  </div>`;
}

/** Market map: reviews (log scale) across, rating up; the lines are the area's averages. */
function marketMap(you, list) {
  const pts = [you, ...list].filter((c) => c.rating != null && c.reviewCount != null);
  if (pts.length < 2) return '';
  const W = 640; const H = 360; const L = 54; const R = 24; const T = 22; const B = 44;
  const lx = (v) => Math.log10(Math.max(1, v));
  const xs = pts.map((c) => lx(c.reviewCount)); const ys = pts.map((c) => c.rating);
  const x0 = Math.floor(Math.min(...xs) * 4) / 4 - 0.1; const x1 = Math.ceil(Math.max(...xs) * 4) / 4 + 0.1;
  const y0 = Math.max(1, Math.floor((Math.min(...ys) - 0.2) * 10) / 10); const y1 = Math.min(5, Math.ceil((Math.max(...ys) + 0.1) * 10) / 10);
  const X = (v) => L + ((lx(v) - x0) / (x1 - x0 || 1)) * (W - L - R); const Y = (v) => T + (1 - (v - y0) / (y1 - y0 || 1)) * (H - T - B);
  const ar = avg(list, 'rating'); const an = avg(list, 'reviewCount');
  const ticksY = []; for (let v = Math.ceil(y0 * 10) / 10; v <= y1 + 1e-9; v += (y1 - y0) > 1 ? 0.5 : 0.2) ticksY.push(Math.round(v * 10) / 10);
  const ticksX = [10, 30, 100, 300, 1000, 3000, 10000].filter((v) => lx(v) >= x0 && lx(v) <= x1);
  const q = (cls, x, y, anchor, key) => `<text class="cx-q ${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${t(`comp.map.q.${key}`)}</text>`;
  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const short = (v) => (v.length > 18 ? `${v.slice(0, 17)}…` : v);
  const dots = pts.map((c) => { const cx = X(c.reviewCount); const cy = Y(c.rating); const right = cx > W - 230;
    return `<g class="cx-dot ${c.you ? 'is-you' : ''}"><title>${esc(c.name)}: ★ ${fmt('rating', c.rating)}, ${fmtNumber(c.reviewCount)} ${esc(t('comp.m.reviewCount').toLowerCase())}</title>
      <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${c.you ? 9 : 6}"/>
      <text x="${(cx + (right ? -13 : 13)).toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="${right ? 'end' : 'start'}">${esc(c.you ? t('comp.you') : short(c.name))}</text></g>`; }).join('');
  const svg = `<svg class="cx-map-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('comp.map.title'))}">
    ${ticksY.map((v) => `<g class="cx-grid"><path d="M${L} ${Y(v).toFixed(1)}H${W - R}"/><text x="${L - 10}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${fmt('rating', v)}</text></g>`).join('')}
    ${ticksX.map((v) => `<g class="cx-grid"><text x="${X(v).toFixed(1)}" y="${H - B + 22}" text-anchor="middle">${fmtNumber(v)}</text></g>`).join('')}
    ${ar != null ? `<path class="cx-avg" d="M${L} ${Y(ar).toFixed(1)}H${W - R}"/>` : ''}${an ? `<path class="cx-avg" d="M${X(an).toFixed(1)} ${T}V${H - B}"/>` : ''}
    ${q('tr', W - R - 6, T + 14, 'end', 'lead')}${q('tl', L + 8, T + 14, 'start', 'hidden')}${q('br', W - R - 6, H - B - 10, 'end', 'known')}${q('bl', L + 8, H - B - 10, 'start', 'watch')}
    ${dots}
    <text class="cx-axis-t" x="${W - R}" y="${H - 4}" text-anchor="end">${esc(t('comp.map.x'))}</text></svg>`;
  return html`<section class="card cx-map"><h2 class="card-title">${t('comp.map.title')}</h2><p class="muted small">${t('comp.map.sub')}</p>${raw(svg)}</section>`;
}

/** What it takes to move up, from the numbers above, at a pace the owner picks. */
function goalRows(you, list) {
  const n = avg(list, 'reviewCount'); const mine = you.reviewCount ?? 0;
  const rows = [];
  const weeks = (k) => (k <= 0 ? '' : Math.ceil(k / pace) <= 1 ? t('comp.goals.week1') : t('comp.goals.weeks', { n: Math.ceil(k / pace) }));
  if (n != null) { const k = Math.ceil(n - mine); rows.push(k > 0 ? { k, text: t('comp.goals.avg', { avg: fmtNumber(Math.round(n)) }) } : { done: t('comp.goals.above') }); }
  const above = list.filter((c) => (c.reviewCount ?? 0) > mine).sort((a, b) => a.reviewCount - b.reviewCount);
  if (above[0]) rows.push({ k: above[0].reviewCount - mine + 1, text: t('comp.goals.pass', { name: above[0].name, n: fmtNumber(above[0].reviewCount) }) });
  const top = above[above.length - 1];
  if (top && top !== above[0]) rows.push({ k: top.reviewCount - mine + 1, text: t('comp.goals.lead', { name: top.name, n: fmtNumber(top.reviewCount) }) });
  if (you.rating != null && mine > 0) {
    const higher = list.map((c) => c.rating).filter((r) => r != null && r > you.rating + 0.04).sort((a, b) => a - b)[0];
    const target = higher != null ? Math.min(4.9, Math.round(higher * 10) / 10) : null;
    // five-star reviews needed: (mine·rating + 5k) / (mine + k) ≥ target
    if (target != null && target > you.rating) rows.push({ k: Math.ceil((mine * (target - you.rating)) / (5 - target)), text: t('comp.goals.rating', { v: fmt('rating', target) }) });
    else if (higher == null) rows.push({ done: t('comp.goals.best') });
  }
  return html`${rows.map((g) => (g.done ? html`<li class="is-done">${icon('check', 18)}<p>${g.done}</p></li>`
    : html`<li><b>${fmtNumber(g.k)}</b><p>${g.text}<small>${weeks(g.k)}</small></p></li>`))}`;
}
const goals = (you, list) => html`<section class="card cx-goals"><h2 class="card-title">${t('comp.goals.title')}</h2>
    <label class="cx-pace"><span id="cx-pace-t">${t('comp.goals.pace', { n: pace })}</span><input type="range" min="1" max="30" step="1" value="${pace}" data-in="comp-pace" aria-label="${t('comp.goals.paceLabel')}"></label>
    <ol class="cx-goal-list" id="cx-goals">${goalRows(you, list)}</ol>
    <p class="small muted">${t('comp.goals.note')}</p></section>`;

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
    const diff = (c) => (c.you || c.reviewCount == null || you.reviewCount == null ? '—' : sign(c.reviewCount - you.reviewCount, (x) => fmtNumber(x)));
    return html`${head}
    <div class="cx-top">
      <section class="cmp-fix cx-rank"><p class="tag">${t('comp.kpi.rank')}</p>
        ${rank ? html`<p class="cx-rank-n"><b>${rank}</b><span>${t('comp.kpi.rankOf', { total: ranked.length })}</span></p>` : html`<h2>${t('comp.noRank')}</h2>`}
        <p class="cx-sub">${t('comp.improve')}</p>
        ${fixes.length ? html`<ol class="fix-list">${fixes.map((x) => html`<li>${t(`comp.imp.${x.key}`, x.v)}</li>`)}</ol>` : html`<p>${t('comp.noGaps')}</p>`}
        ${wins.length ? html`<ul class="win-list">${wins.map((x) => html`<li>${icon('check', 16)} ${t(`comp.imp.${x.key}`, x.v)}</li>`)}</ul>` : ''}
        <p class="small fix-note">${fetchedAt ? t('comp.source', { date: fmtDate(fetchedAt) }) : t('comp.sourceManual')}</p></section>
      ${kpis(you, list)}
    </div>
    <div class="cx-two">${marketMap(you, list)}${goals(you, list)}</div>
    <section class="card cmp-chart"><div class="cmp-chart-head"><h2 class="card-title">${t('comp.compare')}</h2>
      <div class="seg" role="group" aria-label="${t('comp.compare')}">${METRICS.map((k) => html`<button aria-pressed="${metric === k}" data-act="comp-metric" data-k="${k}">${t(`comp.m.${k}`)}</button>`)}</div></div>
      ${barGroup(metric, all)}</section>
    <h2 class="section-h">${t('comp.nearby')}</h2>
    <div class="place-table pt-real cx-table" role="table" aria-label="${t('comp.nearby')}">
      <div class="pt-row pt-head" role="row"><span role="columnheader">${t('comp.nearby')}</span>${METRICS.map((k) => html`<span role="columnheader">${t(`comp.m.${k}`)}</span>`)}<span role="columnheader">${t('comp.diff')}</span><span role="columnheader">${t('comp.website')}</span><span></span></div>
      ${all.map((c) => html`<div class="pt-row ${c.you ? 'is-you' : ''}" role="row">
        <span class="pt-name" role="cell"><strong>${c.mapsUrl ? html`<a href="${c.mapsUrl}" target="_blank" rel="noopener">${c.name}</a>` : c.name}</strong>${c.you ? html`<span class="badge badge-live">${t('comp.you')}</span>` : html`<small>${c.custom ? t('comp.yourInput') : c.address || ''}</small>`}</span>
        ${METRICS.map((k) => html`<span role="cell" data-l="${t(`comp.m.${k}`)}">${k === 'rating' && c[k] != null ? '★ ' : ''}${c.you && k === 'distance' ? '—' : fmt(k, c[k])}</span>`)}
        <span role="cell" data-l="${t('comp.diff')}">${diff(c)}</span>
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
  if (!r.ok) { if (r.error !== 'no_credits') toast(t(r.error === 'rate_limited' ? 'comp.errRate' : r.error === 'quota_reached' ? 'comp.errQuota' : 'comp.errFailed'), 'error'); return rerender(); } // no credits: the app already explains
  update((st) => ({ competitors: { ...st.competitors, list: r.data.places, fetchedAt: r.data.fetchedAt } }));
  toast(t('comp.scanned', { n: r.data.places.length }), 'success'); rerender();
};
actions['edit-biz-go'] = () => { location.hash = '#/overview'; setTimeout(() => actions['edit-biz']?.(), 50); };
actions['comp-metric'] = (el) => { metric = el.dataset.k; rerender(); };
// only the numbers change while the slider moves: re-rendering the page would drop the drag
inputs['comp-pace'] = (el) => {
  pace = Math.min(30, Math.max(1, Number(el.value) || 5));
  const l = document.getElementById('cx-goals'); const tx = document.getElementById('cx-pace-t');
  if (l) l.innerHTML = goalRows(me(), competitorList()).s; if (tx) tx.textContent = t('comp.goals.pace', { n: pace });
};
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
