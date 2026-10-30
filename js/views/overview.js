import { html, icon, toast, limit } from '../core.js';
import { t, fmtNumber } from '../i18n.js';
import { getState, update } from '../store.js';
import { getDiagnosis } from '../ai.js';
import { BUSINESS, THEMES, reachStats, resolveRange } from '../data.js';
import { scoreRing, hourlyChart, reachChart, fieldMap } from '../charts.js';
import { scan } from '../collect.js';
import { actions, inputs, rerender } from '../registry.js';
import { CATEGORIES, GOALS, EXAMPLE, emptyDraft, getBiz, displayName, validate, saveBiz } from '../business.js';
import { journey, nextAction, scanCard } from './shared.js';

/* ---------- business details form (what the owner has to provide) ---------- */
const QS = new URLSearchParams(location.search); // ?prefill=1 and ?open=1 exist only for rehearsal and screenshots
let draft = QS.has('prefill') ? { ...EXAMPLE } : emptyDraft();
let editing = false;

const NEEDS = [['name', 1], ['category', 2], ['city', 3], ['goal', 4], ['website', 5], ['instagram', 6], ['tiktok', 7], ['facebook', 8]];

function field(name, label, hint, opts = {}) {
  const none = opts.none; const off = none && draft[none];
  return html`<div class="field"><span>${label}${opts.optional ? html` <small class="muted">· ${t('biz.optional')}</small>` : ''}</span>
    <div class="field-row"><div class="input-wrap">${opts.prefix ? html`<i class="prefix">${opts.prefix}</i>` : ''}
      <input type="text" data-in="biz-field" data-field="${name}" value="${draft[name]}" maxlength="${opts.max || 60}" placeholder="${hint}" autocomplete="off" class="${opts.prefix ? 'has-prefix' : ''}" ${off ? 'disabled' : ''}></div>
      ${none ? html`<button type="button" class="btn ${off ? 'btn-primary' : 'btn-secondary'} btn-sm" aria-pressed="${!!off}" data-act="biz-none" data-field="${none}">${off ? html`${icon('check', 15)} ${t('biz.noneActive')}` : t('biz.none')}</button>` : ''}</div></div>`;
}

function bizForm() {
  return html`<section class="hero-card solo"><div class="hero-copy">
      <p class="field-note on-dark">${t('overview.eyebrow')}</p>
      <h1 class="hero-title">${t('biz.title')}</h1><p class="hero-lede">${t('biz.sub')}</p>
      <div class="hero-cta"><button class="btn btn-primary btn-lg" data-act="biz-example">${icon('sparkle', 18)} ${t('biz.fillExample')}</button></div></div></section>
    <div class="bento"><form class="card span-7 biz-form" data-biz-form novalidate>
      ${field('name', t('biz.name'), t('biz.namePh'), { none: 'noName' })}
      <div class="field-pair"><label class="field"><span>${t('biz.category')}</span><select data-in="biz-select" data-field="category">${CATEGORIES.map((c) => html`<option value="${c}" ${draft.category === c ? 'selected' : ''}>${t(`biz.cat.${c}`)}</option>`)}</select></label>
        <label class="field"><span>${t('biz.goal')}</span><select data-in="biz-select" data-field="goal">${GOALS.map((c) => html`<option value="${c}" ${draft.goal === c ? 'selected' : ''}>${t(`biz.goalOpt.${c}`)}</option>`)}</select></label></div>
      ${field('city', t('biz.city'), t('biz.cityPh'))}
      ${field('website', t('biz.website'), 'www.example.ro', { none: 'noWebsite', max: 120 })}
      ${field('instagram', t('biz.instagram'), t('biz.handlePh'), { none: 'noInstagram', prefix: '@', max: 30 })}
      ${field('tiktok', t('biz.tiktok'), t('biz.handlePh'), { none: 'noTiktok', prefix: '@', max: 30 })}
      ${field('facebook', t('biz.facebook'), t('biz.handlePh'), { none: 'noFacebook', prefix: '@', max: 30 })}
      <p class="muted small">${t('biz.noneNote')}</p>
      <div class="btn-row"><button type="submit" class="btn btn-primary btn-lg" data-act="biz-save">${icon('check', 18)} ${t('biz.continue')}</button>
        ${editing ? html`<button type="button" class="btn btn-ghost" data-act="biz-cancel">${t('common.cancel')}</button>` : ''}</div></form>
      <aside class="card card-accent span-5"><p class="tag">${t('tag.evidence')} · ${t('biz.needTitle')}</p>
        <ol class="needs">${NEEDS.map(([k, n]) => html`<li><strong>${t(`biz.need.${k}`)}</strong><span>${t(`biz.why.${k}`)}</span></li>`)}</ol></aside></div>`;
}

const chip = (label, value, none) => html`<span class="biz-chip ${value ? '' : 'is-none'}"><b>${label}</b> ${value || t(none ? 'biz.noneShort' : 'biz.notSet')}</span>`;

function summary() {
  const b = getBiz();
  return html`<div class="biz-chips">${chip('Instagram', b.instagram && `@${b.instagram}`, true)}${chip('TikTok', b.tiktok && `@${b.tiktok}`, true)}${chip('Facebook', b.facebook && `@${b.facebook}`, true)}${chip(t('biz.website'), b.website, true)}${chip(t('biz.goal'), t(`biz.goalOpt.${b.goal}`))}
    <button class="btn btn-ghost btn-sm on-dark" data-act="edit-biz">${icon('settings', 15)} ${t('biz.edit')}</button></div>`;
}

function heroHead() {
  const b = getBiz();
  return html`<p class="field-note on-dark">${t('overview.eyebrow')}</p>
    <h1 class="hero-title">${displayName()}</h1>
    <p class="hero-meta">${icon('pin', 16)} ${b.city} · ${t(`biz.cat.${b.category}`)}</p>${summary()}`;
}

function preCollect() {
  return html`<section class="hero-card solo"><div class="hero-copy">${heroHead()}
    <p class="hero-lede">${t('start.lockedBody')}</p>
    <div class="hero-cta"><button class="btn btn-primary btn-lg" data-act="collect-signals" ${scan.active ? 'disabled' : ''}>${icon('signals', 18)} ${t('start.collectSignals')}</button></div></div></section>
    ${scan.active ? scanCard() : html`<section class="card card-lock"><p>${t('start.locked')}</p></section>`}`;
}

const pct = (v) => `${v >= 0 ? '+' : ''}${fmtNumber(v, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** One theme with an expandable "why": reasons with counts, plus a know-vs-complain split where it applies. */
function themeRow(th, maxM) {
  const sum = th.reasons.reduce((a, b) => a + b, 0);
  return html`<li class="theme-item"><details ${QS.has('open') ? 'open' : ''}><summary class="has-src" data-src="themes">
      <span class="theme-row"><span>${t(`overview.theme.${th.id}`)}</span><span class="mono">${th.mentions}</span></span>
      <span class="meter meter-${th.tone}"><i style="width:${Math.round((th.mentions / maxM) * 100)}%"></i></span></summary>
    <div class="theme-body"><p>${t(`overview.why.${th.id}`)}</p>
      <ul class="reasons">${th.reasons.map((n, i) => html`<li><span>${t(`overview.reason.${th.id}.${i + 1}`)}</span><b class="mono">${n}</b><i class="reason-bar"><u style="width:${Math.round((n / sum) * 100)}%"></u></i></li>`)}</ul>
      ${th.split ? html`<div class="split" role="img" aria-label="${th.split[0]} / ${th.split[1]}"><div class="split-bar"><span class="know" style="flex:${th.split[0]}">${th.split[0]}</span><span class="ask" style="flex:${th.split[1]}">${th.split[1]}</span></div>
        <div class="split-legend"><span><i class="know"></i>${t(`overview.split.${th.id}.a`)}</span><span><i class="ask"></i>${t(`overview.split.${th.id}.b`)}</span></div></div>` : ''}
    </div></details></li>`;
}

function rangeBar(stats) {
  const r = getState().range; const cur = r.preset;
  return html`<div class="range-bar"><div class="seg" role="group" aria-label="${t('range.title')}">${['7d', '30d', '8w', '90d', 'custom'].map((k) => html`<button aria-pressed="${cur === k}" data-act="set-range" data-preset="${k}">${t(`range.${k}`)}</button>`)}</div>
    ${cur === 'custom' ? html`<div class="range-dates"><label class="field"><span>${t('range.from')}</span><input type="date" data-in="range-date" data-field="from" value="${ymd(stats.from)}" max="${ymd(new Date())}"></label>
      <label class="field"><span>${t('range.to')}</span><input type="date" data-in="range-date" data-field="to" value="${ymd(stats.to)}" max="${ymd(new Date())}"></label></div>` : ''}</div>`;
}
export const overview = {
  id: 'overview',
  render() {
    const s = getState();
    if (!s.business.loaded || editing) return bizForm();
    if (!s.signalsCollected) return preCollect();
    const d = getDiagnosis();
    const opp = d?.data.opportunity;
    const na = nextAction();
    const maxM = Math.max(...THEMES.map((x) => x.mentions));
    const stats = reachStats(s.range);
    return html`
    <section class="hero-card">
      <div class="hero-copy">
        ${heroHead()}
        <p class="hero-lede">${t('overview.lede')}</p>
        <div class="kpis">
          <div class="kpi has-src" tabindex="0" data-src="rating"><span class="kpi-v">${fmtNumber(BUSINESS.rating, { minimumFractionDigits: 1 })}</span><span class="kpi-l">${t('overview.rating')}</span></div>
          <div class="kpi has-src" tabindex="0" data-src="reach" data-dyn="1"><span class="kpi-v">${fmtNumber(stats.end / 1000, { maximumFractionDigits: 1 })}k</span><span class="kpi-l">${t('overview.reach')}</span></div>
          <div class="kpi has-src" tabindex="0" data-src="trend" data-dyn="1"><span class="kpi-v ${stats.changePct >= 0 ? 'kpi-up' : ''}">${pct(stats.changePct)}</span><span class="kpi-l">${t('overview.trend')}</span></div>
        </div>
        <div class="hero-cta"><button class="btn btn-primary btn-lg" data-act="go" data-route="mission">${t('actions.startMission')} ${icon('next', 18)}</button></div>
      </div>
      <div class="hero-art">${fieldMap()}<div class="hero-score has-src" tabindex="0" data-src="score"><p class="label-mono">${t('overview.score')}</p>${scoreRing(BUSINESS.visibility)}</div></div>
    </section>

    <div class="bento">
      <article class="card span-7 self-start">
        <p class="tag">${t('tag.signal')} · ${t('overview.hourlyTitle')}</p>
        <h2 class="card-title">${t('overview.hourlyHeadline')}</h2>
        <div class="has-src" tabindex="0" data-src="hourly">${hourlyChart()}</div>
        <p class="muted">${t('overview.hourlyNote')}</p>
      </article>

      <article class="card span-5 self-start">
        <p class="tag">${t('tag.evidence')} · ${t('overview.pulse')}</p>
        <div class="pulse-row has-src" tabindex="0" data-src="rating"><span class="big-num">${fmtNumber(BUSINESS.rating, { minimumFractionDigits: 1 })}</span><span class="stars" aria-hidden="true">★★★★★</span></div>
        <ul class="themes">${THEMES.map((th) => themeRow(th, maxM))}</ul>
        <p class="muted small">${t('overview.themesNote')}</p>
      </article>

      <article class="card card-accent span-5">
        <p class="tag">${t('tag.action')} · ${t('overview.opportunity')}</p>
        ${opp
          ? html`<h2 class="card-title">${opp.title}</h2><p>${opp.impact}</p><p class="mono small has-src" tabindex="0" data-src="confidence">${t('common.confidence')} ${opp.confidence}%</p>`
          : html`<h2 class="card-title">${t('overview.noOpportunity')}</h2><p class="muted">${t('overview.noOpportunityBody')}</p>`}
        <div class="next-action"><span class="label-mono">${t('overview.nextAction')}</span>
          <strong>${t(na.key)}</strong>
          <button class="btn btn-secondary" data-act="go" data-route="${na.route}">${t('common.open')} ${icon('next', 16)}</button></div>
      </article>

      <article class="card span-7">
        <p class="tag">${t('tag.checkpoint')} · ${t('overview.journey')}</p>
        ${journey()}
        ${rangeBar(stats)}
        <div class="reach-row"><div class="reach-main has-src" tabindex="0" data-src="reachChart" data-dyn="1"><p class="label-mono">${t('overview.reachTrend')}</p>${reachChart(stats)}</div>
          <dl class="reach-stats">
            <div class="has-src" tabindex="0" data-src="reachEnd" data-dyn="1"><dt>${t('range.end')}</dt><dd>${fmtNumber(stats.end)}</dd></div>
            <div class="has-src" tabindex="0" data-src="reachVsStart" data-dyn="1"><dt>${t('range.vsStart')}</dt><dd class="${stats.changePct >= 0 ? 'up' : 'down'}">${pct(stats.changePct)}</dd></div>
            <div class="has-src" tabindex="0" data-src="reachVsPrev" data-dyn="1"><dt>${t('range.vsPrev')}</dt><dd class="${stats.vsPrevPct >= 0 ? 'up' : 'down'}">${pct(stats.vsPrevPct)}</dd></div></dl></div>
        <p class="muted small">${t('range.note')}</p>
      </article>
    </div>`;
  },
};

/* ---------- form handlers ---------- */
inputs['biz-field'] = (el) => { draft[el.dataset.field] = limit(el.value, 120); };
inputs['biz-select'] = (el) => { draft[el.dataset.field] = el.value; };
actions['biz-none'] = (el) => { const f = el.dataset.field; draft[f] = !draft[f]; rerender(); };
actions['biz-example'] = () => { draft = { ...EXAMPLE }; rerender(); toast(t('biz.exampleToast'), 'info'); };
actions['edit-biz'] = () => { const b = getState().business; draft = { ...emptyDraft(), name: b.name || '', category: b.category || 'cafe', city: b.city || '', goal: b.goal || 'bookings', website: b.website || '', instagram: b.instagram || '', tiktok: b.tiktok || '', facebook: b.facebook || '', noName: !!b.noName, noWebsite: !!b.noWebsite, noInstagram: !!b.noInstagram, noTiktok: !!b.noTiktok, noFacebook: !!b.noFacebook }; editing = true; rerender(); };
actions['biz-cancel'] = () => { editing = false; rerender(); };
actions['biz-save'] = (el, e) => {
  e.preventDefault();
  const err = validate(draft);
  if (err) return toast(t(err), 'error');
  saveBiz(draft); editing = false; toast(t('biz.savedToast'), 'success'); rerender();
};
document.addEventListener('submit', (e) => { if (e.target.matches('[data-biz-form]')) { e.preventDefault(); actions['biz-save'](null, e); } });

actions['set-range'] = (el) => {
  const preset = el.dataset.preset;
  if (preset === 'custom') { const c = resolveRange(getState().range); update({ range: { preset, from: ymd(c.from), to: ymd(c.to) } }); } else update({ range: { preset, from: '', to: '' } });
  rerender();
};
inputs['range-date'] = (el) => {
  const r = { ...getState().range, [el.dataset.field]: el.value, preset: 'custom' };
  const res = resolveRange(r);
  if (!res.custom) return toast(t('range.invalid'), 'error');
  update({ range: r }); rerender();
};