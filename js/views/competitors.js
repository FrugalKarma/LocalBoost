import { html, raw, icon, toast, sleep, openModal, limit } from '../core.js';
import { t, fmtNumber } from '../i18n.js';
import { getState, update } from '../store.js';
import { COMPETITORS, YOU_BASE, reachOn } from '../data.js';
import { getBiz, displayName } from '../business.js';
import { actions, rerender } from '../registry.js';
import { pageHead, aiNotice } from './shared.js';

const STEPS = ['maps', 'social', 'web', 'offers'];
const scan = { active: false, step: 0 };
const METRICS = ['rating', 'reviews', 'visibility', 'reach', 'posts'];

/* ---------- data ---------- */
function you() {
  const s = getState(); const b = getBiz();
  return { id: 'you', name: displayName(), you: true, rating: YOU_BASE.rating, reviews: YOU_BASE.reviews, visibility: YOU_BASE.visibility, reach: reachOn(new Date()), posts: b.instagram ? 2 : 0, booking: !!s.site.generated, afternoon: !!s.site.generated };
}
const estimate = (c) => ({ ...c, visibility: Math.min(95, Math.round(38 + c.rating * 8 + Math.min(c.reviews, 300) / 12)), reach: Math.round(c.reviews * 13 + c.posts * 140), custom: true });
const rivals = () => [...COMPETITORS, ...getState().competitors.custom.map(estimate)];
const avg = (list, k) => list.reduce((a, c) => a + c[k], 0) / Math.max(1, list.length);
const fmt = (k, v) => (k === 'rating' ? fmtNumber(v, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : k === 'posts' ? fmtNumber(v, { maximumFractionDigits: 1 }) : fmtNumber(Math.round(v)));

/** Gaps and strengths, computed from the numbers (not hand-written per business). */
function insights(me, list) {
  const out = [];
  const top = [...list].sort((a, b) => b.reach - a.reach)[0];
  if (me.reach < top.reach) out.push({ kind: 'improve', key: 'reach', v: { pct: Math.round((top.reach / me.reach - 1) * 100), name: top.name } });
  if (me.visibility < avg(list, 'visibility')) out.push({ kind: 'improve', key: 'visibility', v: { you: me.visibility, avg: Math.round(avg(list, 'visibility')) } });
  if (me.posts < avg(list, 'posts')) out.push({ kind: 'improve', key: 'posts', v: { you: fmt('posts', me.posts), avg: fmt('posts', avg(list, 'posts')) } });
  const nb = list.filter((c) => c.booking).length; if (!me.booking && nb) out.push({ kind: 'improve', key: 'booking', v: { n: nb, total: list.length } });
  const na = list.filter((c) => c.afternoon).length; if (!me.afternoon && na) out.push({ kind: 'improve', key: 'afternoon', v: { n: na, total: list.length } });
  if (me.reviews < avg(list, 'reviews')) out.push({ kind: 'improve', key: 'reviews', v: { you: me.reviews, avg: Math.round(avg(list, 'reviews')) } });
  if (me.rating >= Math.max(...list.map((c) => c.rating))) out.push({ kind: 'strength', key: 'rating', v: { v: fmt('rating', me.rating) } });
  if (me.booking) out.push({ kind: 'strength', key: 'bookingOk', v: {} });
  return out;
}

/* ---------- charts ---------- */
function barGroup(k, all) {
  const max = Math.max(...all.map((c) => c[k])) || 1;
  const rows = [...all].sort((a, b) => b[k] - a[k]);
  return html`<div class="cmp-group has-src" tabindex="0" data-src="compare"><h4>${t(`comp.m.${k}`)}</h4>
    ${rows.map((c) => html`<div class="cmp-row ${c.you ? 'is-you' : ''}"><span class="cmp-name">${c.name}</span><span class="cmp-bar"><i style="width:${Math.round((c[k] / max) * 100)}%"></i></span><b class="mono">${fmt(k, c[k])}</b></div>`)}</div>`;
}

function radar(me, list) {
  const axes = METRICS; const size = 260; const c = size / 2; const R = 96;
  const all = [me, ...list]; const maxOf = (k) => Math.max(...all.map((x) => x[k])) || 1;
  const pt = (i, f) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / axes.length; return [c + Math.cos(a) * R * f, c + Math.sin(a) * R * f]; };
  const poly = (vals) => axes.map((k, i) => pt(i, Math.max(0.04, vals[k] / maxOf(k))).map((n) => n.toFixed(1)).join(',')).join(' ');
  const mean = Object.fromEntries(axes.map((k) => [k, avg(list, k)]));
  const rings = [0.33, 0.66, 1].map((f) => `<polygon points="${axes.map((_, i) => pt(i, f).map((n) => n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="currentColor" stroke-opacity=".16"/>`).join('');
  const spokes = axes.map((_, i) => { const [x, y] = pt(i, 1); return `<line x1="${c}" y1="${c}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="currentColor" stroke-opacity=".16"/>`; }).join('');
  const labels = axes.map((k, i) => { const [x, y] = pt(i, 1.2); return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" class="axis">${t(`comp.m.${k}`)}</text>`; }).join('');
  return html`<svg class="radar" viewBox="-50 0 ${size + 100} ${size}" role="img" aria-label="${t('comp.radar')}">${raw(rings + spokes)}
    <polygon points="${poly(mean)}" fill="currentColor" fill-opacity=".14" stroke="currentColor" stroke-opacity=".6" stroke-width="1.5" stroke-dasharray="4 3"/>
    <polygon points="${poly(me)}" fill="var(--yellow-500)" fill-opacity=".28" stroke="var(--yellow-500)" stroke-width="2.5"/>${raw(labels)}</svg>`;
}

/* ---------- view ---------- */
const yn = (v) => html`<span class="badge badge-${v ? 'live' : 'inference'}">${t(v ? 'comp.yes' : 'comp.no')}</span>`;

function placeCard(c) {
  return html`<article class="place ${c.you ? 'is-you' : ''}"><div class="place-top"><strong>${c.name}</strong>${c.you ? html`<span class="badge badge-live">${t('comp.you')}</span>` : html`<span class="muted small">${c.dist || t('comp.yourInput')}</span>`}
    ${c.custom ? html`<button class="icon-btn" data-act="remove-comp" data-id="${c.id}" aria-label="${t('comp.remove')}">${icon('x', 16)}</button>` : ''}</div>
    <dl class="place-stats"><div><dt>${t('comp.m.rating')}</dt><dd>★ ${fmt('rating', c.rating)}</dd></div><div><dt>${t('comp.m.reviews')}</dt><dd>${fmt('reviews', c.reviews)}</dd></div><div><dt>${t('comp.m.visibility')}</dt><dd>${c.visibility}</dd></div>
      <div><dt>${t('comp.m.reach')}</dt><dd>${fmt('reach', c.reach)}</dd></div><div><dt>${t('comp.m.posts')}</dt><dd>${fmt('posts', c.posts)}</dd></div></dl>
    <p class="place-flags"><span>${t('comp.booking')} ${yn(c.booking)}</span><span>${t('comp.afternoon')} ${yn(c.afternoon)}</span></p>${c.custom ? html`<p class="muted small">${t('comp.estimated')}</p>` : ''}</article>`;
}

export const competitors = {
  id: 'competitors',
  render() {
    const s = getState();
    const head = pageHead({ title: t('comp.title'), sub: t('comp.sub'),
      actions: s.competitors.scanned ? html`<button class="btn btn-secondary" data-act="add-comp">${icon('upload', 18)} ${t('comp.add')}</button>` : '' });
    if (!s.business.loaded) return html`${head}<section class="card empty-hero"><div class="empty-ic">${icon('compare', 34)}</div><h2>${t('start.noBusinessTitle')}</h2><p class="muted">${t('start.noBusinessBody')}</p>
      <button class="btn btn-primary btn-lg" data-act="go" data-route="overview">${t('start.goCollect')}</button></section>`;
    if (scan.active) return html`${head}<section class="card scan" aria-live="polite"><p class="tag">${t('comp.scanning')}</p><ol class="steps">${STEPS.map((k, i) => html`<li class="${i < scan.step ? 'done' : i === scan.step ? 'now' : ''}"><span class="dot"></span>${t(`comp.step.${k}`)}</li>`)}</ol><div class="bar-indet"><i></i></div></section>`;
    if (!s.competitors.scanned) return html`${head}<section class="card empty-hero"><div class="empty-ic">${icon('compare', 34)}</div><h2>${t('comp.emptyTitle')}</h2><p class="muted">${t('comp.emptyBody')}</p>
      <button class="btn btn-primary btn-lg" data-act="scan-comp">${icon('sparkle', 18)} ${t('comp.scan')}</button></section>`;
    const me = you(); const list = rivals(); const all = [me, ...list]; const tips = insights(me, list);
    return html`${head}${aiNotice()}
    <div class="banner banner-warn" role="status">${icon('info', 18)} <span>${t('comp.sampleNote')}</span></div>
    <h2 class="section-h">${t('comp.nearby')}</h2><div class="places">${all.map(placeCard)}</div>
    <div class="bento"><section class="card span-7"><p class="tag">${t('tag.evidence')} · ${t('comp.compare')}</p><div class="cmp-grid">${METRICS.map((k) => barGroup(k, all))}</div></section>
      <section class="card span-5"><p class="tag">${t('tag.signal')} · ${t('comp.radar')}</p><div class="has-src" tabindex="0" data-src="compare">${radar(me, list)}</div>
        <p class="radar-legend"><span><i class="y"></i>${t('comp.you')}</span><span><i class="g"></i>${t('comp.avg')}</span></p></section>
      <section class="card card-accent span-12"><p class="tag">${t('tag.action')} · ${t('comp.improve')}</p>
        ${tips.length ? html`<ul class="tips">${tips.map((x) => html`<li class="tip tip-${x.kind}"><span class="tip-ic">${icon(x.kind === 'improve' ? 'next' : 'check', 16)}</span><span>${t(`comp.imp.${x.key}`, x.v)}</span></li>`)}</ul>` : html`<p>${t('comp.noGaps')}</p>`}
        <p class="muted small">${t('comp.honest')}</p></section></div>`;
  },
};

actions['scan-comp'] = async () => {
  if (scan.active) return;
  scan.active = true; scan.step = 0; rerender();
  for (let i = 0; i < STEPS.length; i++) { scan.step = i; rerender(); await sleep(620); }
  scan.active = false;
  update((st) => ({ competitors: { ...st.competitors, scanned: true } }));
  toast(t('comp.scanned'), 'success'); rerender();
};

actions['remove-comp'] = (el) => {
  update((st) => ({ competitors: { ...st.competitors, custom: st.competitors.custom.filter((c) => c.id !== el.dataset.id) } }));
  rerender();
};

actions['add-comp'] = async () => {
  const f = (id, label, type, extra = '') => html`<label class="field"><span>${label}</span><input id="${id}" type="${type}" ${raw(extra)}></label>`;
  const res = await openModal({
    title: t('comp.add'),
    body: html`<p class="muted">${t('comp.addBody')}</p>${f('cc-name', t('comp.fName'), 'text', 'maxlength="40" autocomplete="off"')}
      <div class="field-pair">${f('cc-rating', t('comp.m.rating'), 'number', 'min="1" max="5" step="0.1" value="4.2" inputmode="decimal"')}${f('cc-reviews', t('comp.m.reviews'), 'number', 'min="0" max="99999" value="120" inputmode="numeric"')}</div>
      ${f('cc-posts', t('comp.m.posts'), 'number', 'min="0" max="50" step="0.5" value="2" inputmode="decimal"')}
      <label class="check"><input id="cc-book" type="checkbox"><span>${t('comp.booking')}</span></label><label class="check"><input id="cc-aft" type="checkbox"><span>${t('comp.afternoon')}</span></label>`,
    actions: [{ label: t('common.cancel'), kind: 'btn-ghost', value: false }, {
      label: t('comp.addOk'), kind: 'btn-primary',
      collect: () => {
        const v = (id) => document.getElementById(id);
        const name = limit(v('cc-name').value.trim(), 40); if (!name) return { error: true };
        const num = (id, a, b, d) => { const n = Number(v(id).value); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
        return { id: `c${Date.now()}`, name, dist: '', rating: num('cc-rating', 1, 5, 4), reviews: Math.round(num('cc-reviews', 0, 99999, 0)), posts: num('cc-posts', 0, 50, 0), booking: v('cc-book').checked, afternoon: v('cc-aft').checked };
      },
    }],
  });
  if (!res || typeof res !== 'object') return;
  if (res.error) return toast(t('comp.needName'), 'error');
  update((st) => ({ competitors: { ...st.competitors, custom: [...st.competitors.custom, res].slice(0, 8) } }));
  toast(t('comp.addedToast'), 'success'); rerender();
};
