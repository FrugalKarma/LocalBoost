import { html, icon, toast, limit } from '../core.js';
import { t, fmtNumber } from '../i18n.js';
import { getState } from '../store.js';
import { getDiagnosis } from '../ai.js';
import { streetMap, barSeries } from '../charts.js';
import { scan, hasSignals } from '../collect.js';
import { actions, inputs, rerender } from '../registry.js';
import { CATEGORIES, GOALS, emptyDraft, getBiz, displayName, validate, saveBiz } from '../business.js';
import { journey, nextAction, scanCard } from './shared.js';
import { serverCaps, findPlaces } from '../sources.js';
import { liveMetrics, competitorList, loadSiteData, dailySeries, getSiteData } from '../insights.js';

/* ---------- business details form ---------- */
let draft = emptyDraft();
let editing = false;
let caps = null;
const lookup = { q: '', busy: false, results: null, error: null };

const NEEDS = [['name', 1], ['category', 2], ['city', 3], ['goal', 4], ['website', 5], ['instagram', 6], ['tiktok', 7], ['facebook', 8]];

function field(name, label, hint, opts = {}) {
  const none = opts.none; const off = none && draft[none];
  return html`<div class="field"><span>${label}${opts.optional ? html` <small class="muted">· ${t('biz.optional')}</small>` : ''}</span>
    <div class="field-row"><div class="input-wrap">${opts.prefix ? html`<i class="prefix">${opts.prefix}</i>` : ''}
      <input type="${opts.type || 'text'}" data-in="biz-field" data-field="${name}" value="${draft[name] || ''}" maxlength="${opts.max || 60}" placeholder="${hint}" autocomplete="off" class="${opts.prefix ? 'has-prefix' : ''}" ${off ? 'disabled' : ''}></div>
      ${none ? html`<button type="button" class="btn ${off ? 'btn-primary' : 'btn-secondary'} btn-sm" aria-pressed="${!!off}" data-act="biz-none" data-field="${none}">${off ? html`${icon('check', 15)} ${t('biz.noneActive')}` : t('biz.none')}</button>` : ''}</div></div>`;
}

function googleLookup() {
  if (!caps?.places) return html`<p class="muted small lookup-off">${icon('info', 15)} ${t('biz.googleOff')}</p>`;
  const picked = draft.place;
  return html`<section class="lookup"><p class="tag">${t('biz.googleTitle')}</p>
    ${picked ? html`<div class="lookup-picked">${icon('check', 18)}<div><strong>${picked.name}</strong><small>${picked.address}${picked.rating ? ` · ★ ${picked.rating} (${picked.reviewCount})` : ''}</small></div>
      <button type="button" class="btn btn-ghost btn-sm" data-act="lookup-clear">${t('biz.googleChange')}</button></div>`
    : html`<p class="muted small">${t('biz.googleBody')}</p>
      <div class="lookup-row"><input type="search" id="lookup-q" data-in="lookup-q" value="${lookup.q}" placeholder="${t('biz.googlePh')}" maxlength="120" autocomplete="off">
        <button type="button" class="btn btn-secondary" data-act="lookup-go" ${lookup.busy ? 'disabled' : ''}>${lookup.busy ? html`<i class="spin"></i>` : icon('signals', 18)} ${t('biz.googleFind')}</button></div>
      ${lookup.error ? html`<p class="small err-line" role="alert">${t(`biz.googleErr.${lookup.error}`)}</p>` : ''}
      ${lookup.results ? (lookup.results.length ? html`<ul class="lookup-list">${lookup.results.map((p, i) => html`<li><button type="button" data-act="lookup-pick" data-i="${i}">
        <strong>${p.name}</strong><small>${p.address}</small>${p.rating ? html`<span class="lookup-rate">★ ${p.rating} · ${p.reviewCount}</span>` : ''}</button></li>`)}</ul>`
        : html`<p class="muted small">${t('biz.googleNone')}</p>`) : ''}`}</section>`;
}

function bizForm() {
  return html`<section class="hero-card solo"><div class="hero-copy">
      <p class="field-note on-dark">${t('overview.eyebrow')}</p>
      <h1 class="hero-title">${t('biz.title')}</h1><p class="hero-lede">${t('biz.sub')}</p></div></section>
    <div class="bento"><form class="card span-7 biz-form" data-biz-form novalidate>
      ${googleLookup()}
      ${field('name', t('biz.name'), t('biz.namePh'), { none: 'noName', max: 80 })}
      <div class="field-pair"><label class="field"><span>${t('biz.category')}</span><select data-in="biz-select" data-field="category">${CATEGORIES.map((c) => html`<option value="${c}" ${draft.category === c ? 'selected' : ''}>${t(`biz.cat.${c}`)}</option>`)}</select></label>
        <label class="field"><span>${t('biz.goal')}</span><select data-in="biz-select" data-field="goal">${GOALS.map((c) => html`<option value="${c}" ${draft.goal === c ? 'selected' : ''}>${t(`biz.goalOpt.${c}`)}</option>`)}</select></label></div>
      ${field('city', t('biz.city'), t('biz.cityPh'), { max: 80 })}
      ${field('address', t('biz.address'), t('biz.addressPh'), { max: 200, optional: true })}
      <div class="field-pair">${field('phone', t('biz.phone'), '+40 7xx xxx xxx', { max: 30, optional: true, type: 'tel' })}${field('whatsapp', t('biz.whatsapp'), '+40 7xx xxx xxx', { max: 30, optional: true, type: 'tel' })}</div>
      ${field('email', t('biz.email'), 'contact@…', { max: 120, optional: true, type: 'email' })}
      ${field('website', t('biz.website'), 'www.example.ro', { none: 'noWebsite', max: 160 })}
      ${field('instagram', t('biz.instagram'), t('biz.handlePh'), { none: 'noInstagram', prefix: '@', max: 30 })}
      ${field('tiktok', t('biz.tiktok'), t('biz.handlePh'), { none: 'noTiktok', prefix: '@', max: 30 })}
      ${field('facebook', t('biz.facebook'), t('biz.handlePh'), { none: 'noFacebook', prefix: '@', max: 30 })}
      <p class="muted small">${t('biz.noneNote')}</p>
      <div class="btn-row"><button type="submit" class="btn btn-primary btn-lg" data-act="biz-save">${icon('check', 18)} ${t('biz.continue')}</button>
        ${editing ? html`<button type="button" class="btn btn-ghost" data-act="biz-cancel">${t('common.cancel')}</button>` : ''}</div></form>
      <aside class="card card-accent span-5"><p class="tag">${t('biz.needTitle')}</p>
        <ol class="needs">${NEEDS.map(([k]) => html`<li><strong>${t(`biz.need.${k}`)}</strong><span>${t(`biz.why.${k}`)}</span></li>`)}</ol></aside></div>`;
}

const chip = (label, value, none) => html`<span class="biz-chip ${value ? '' : 'is-none'}"><b>${label}</b> ${value || t(none ? 'biz.noneShort' : 'biz.notSet')}</span>`;
function summary() {
  const b = getBiz();
  return html`<div class="biz-chips">${chip('Google', b.place ? '✓' : '', true)}${chip('Instagram', b.instagram && `@${b.instagram}`, true)}${chip('Facebook', b.facebook && `@${b.facebook}`, true)}${chip(t('biz.website'), b.website, true)}${chip(t('biz.goal'), t(`biz.goalOpt.${b.goal}`))}
    <button class="btn btn-ghost btn-sm on-dark" data-act="edit-biz">${icon('settings', 15)} ${t('biz.edit')}</button></div>`;
}
function heroHead() {
  const b = getBiz();
  return html`<p class="field-note on-dark">${t('overview.eyebrow')}</p>
    <h1 class="hero-title">${displayName()}</h1>
    <p class="hero-meta">${icon('pin', 16)} ${b.city} · ${t(`biz.cat.${b.category}`)}</p>${summary()}`;
}

function preCollect() {
  const b = getBiz();
  const src = [[!!b.place, 'google'], [!!b.website, 'website'], [true, 'notes'], [true, 'themes']];
  return html`<section class="hero-card solo"><div class="hero-copy">${heroHead()}
    <p class="hero-lede">${t('collect.intro')}</p>
    <ul class="src-list">${src.map(([on, k]) => html`<li class="${on ? '' : 'is-off'}">${icon(on ? 'check' : 'x', 15)} ${t(`collect.src.${k}${on ? '' : 'Off'}`)}</li>`)}</ul>
    <div class="hero-cta"><button class="btn btn-primary btn-lg" data-act="collect-signals" ${scan.active ? 'disabled' : ''}>${icon('signals', 18)} ${t('start.collectSignals')}</button>
      <button class="btn btn-secondary on-dark" data-act="go" data-route="signals">${t('collect.addOwn')}</button></div></div></section>
    ${scan.active ? scanCard() : ''}`;
}

/* ---------- Home: map + next-step card ---------- */
const stepList = (s) => [s.business.loaded, hasSignals(), !!s.diagnosis, s.mission?.status === 'active', !!s.site?.generated, !!s.checkpoint];
const STAGE_OF_NEXT = { analysis: 'diagnose', mission: 'act', website: 'act', proof: 'measure' };
const num = (v, d = '—') => (v == null ? d : fmtNumber(v));

/** Pins at their real positions relative to the business (equirectangular is fine at street scale). */
function pins() {
  const me = getBiz().place;
  if (me?.lat == null) return { me: null, others: [] };
  const list = competitorList().filter((c) => c.lat != null).slice(0, 6);
  const k = Math.cos((me.lat * Math.PI) / 180);
  const d = list.map((c) => ({ c, dx: (c.lng - me.lng) * k, dy: c.lat - me.lat }));
  const max = Math.max(1e-4, ...d.map((p) => Math.hypot(p.dx, p.dy)));
  return { me, others: d.map((p) => ({ ...p.c, x: 47 + (p.dx / max) * 36, y: 43 - (p.dy / max) * 30 })) };
}

function mapCard(m) {
  const p = pins();
  return html`<section class="map-card" aria-label="${t('ledger.mapAria')}">${streetMap()}
    ${p.others.length ? html`<a class="map-chip" href="#/competitors">${icon('pin', 15)} ${t('ledger.mapLabel', { n: p.others.length })}</a>`
      : html`<a class="map-chip" href="#/competitors">${icon('compare', 15)} ${t('ledger.mapNoComp')}</a>`}
    ${p.others.map((c) => html`<span class="pin pin-other" style="left:${c.x.toFixed(1)}%;top:${c.y.toFixed(1)}%">${c.name}<span>${c.rating ?? '–'}</span></span>`)}
    <span class="pin-ring" style="left:47%;top:43%" aria-hidden="true"></span>
    <span class="pin pin-you" style="left:47%;top:43%"><b>${displayName()}<em>${m.rating ?? '–'}</em></b></span>
    <div class="map-stats">
      <div class="map-stat has-src" tabindex="0" data-src="rating"><strong class="brand">${m.rating != null ? fmtNumber(m.rating, { minimumFractionDigits: 1 }) : '—'}</strong><span>${t('overview.rating')}</span></div>
      <div class="map-stat has-src" tabindex="0" data-src="reviews"><strong>${num(m.reviewCount)}</strong><span>${t('overview.reviews')}</span></div>
      <div class="map-stat has-src" tabindex="0" data-src="views"><strong>${num(m.views)}</strong><span>${t('overview.views7')}</span></div>
      <div class="map-stat has-src" tabindex="0" data-src="requests"><strong class="${m.requests ? 'up' : ''}">${num(m.requests)}</strong><span>${t('overview.requests7')}</span></div>
    </div></section>`;
}

function deckCard(na, steps) {
  const key = na.key.split('.')[1];
  const stage = STAGE_OF_NEXT[key] || 'diagnose';
  const done = steps.filter(Boolean).length;
  const th = getState().signals?.themes?.items || [];
  return html`<div class="deck"><article class="deck-card" style="--sc:var(--st-${stage})">
    <div class="deck-top"><i aria-hidden="true"></i>${t(`journey.${stage}`)} · ${t('ledger.nextStep')}<small>${t('ledger.stepOf', { n: Math.min(done + 1, steps.length), total: steps.length })}</small></div>
    <div class="progress-dots" aria-hidden="true">${steps.map((d) => html`<i class="${d ? 'on' : ''}"></i>`)}</div>
    <h2>${t(na.key)}</h2>
    <p>${t(`ledger.body.${key}`)}</p>
    ${key === 'analysis' && th.length ? html`<div class="deck-chips">${th.slice(0, 4).map((x) => html`<span class="${x.tone === 'pos' ? 'pos' : 'gap'}">${x.label} · ${x.mentions}</span>`)}</div>` : ''}
    <div class="deck-actions">${key === 'analysis'
      ? html`<button class="btn btn-primary btn-lg" data-act="run-analysis-go">${icon('sparkle', 18)} ${t('actions.runAnalysis')}</button>
        <button class="btn btn-secondary" data-act="go" data-route="signals">${t('ledger.lookFirst')}</button>`
      : html`<button class="btn btn-primary btn-lg" data-act="go" data-route="${na.route}">${t('common.open')} ${icon('next', 18)}</button>`}</div>
  </article></div>`;
}

function themesCard() {
  const s = getState().signals || {}; const items = s.themes?.items || [];
  const max = Math.max(1, ...items.map((x) => x.mentions));
  return html`<article class="card span-5 self-start"><p class="tag">${t('overview.pulse')}</p>
    ${items.length ? html`<ul class="themes">${items.map((x) => html`<li class="theme-item"><details><summary>
      <span class="theme-row"><span>${x.label}</span><span class="mono">${x.mentions}</span></span>
      <span class="meter meter-${x.tone}"><i style="width:${Math.round((x.mentions / max) * 100)}%"></i></span></summary>
      <div class="theme-body">${(x.quotes || []).map((q) => html`<p class="quote-sm">“${q}”</p>`)}</div></details></li>`)}</ul>
      <p class="muted small">${t('overview.themesNote')}</p>`
    : html`<p class="muted">${t(s.themes?.mode === 'none' ? 'overview.themesNoAi' : 'overview.themesEmpty')}</p>
      <button class="btn btn-secondary btn-sm" data-act="go" data-route="signals">${t('collect.addOwn')}</button>`}</article>`;
}

function siteCard() {
  const sd = getSiteData(); const site = getState().site;
  const live = sd?.available && sd.site?.published;
  const series = live ? dailySeries(30) : null;
  return html`<article class="card span-7"><p class="tag">${t('overview.journey')}</p>${journey()}
    <div class="site-mini"><div><h3>${t('overview.siteTitle')}</h3>
      <p class="muted small">${live ? t('overview.siteLive') : site.generated ? t('overview.siteDraft') : t('overview.siteNone')}</p></div>
      ${live ? barSeries(series.map((d) => d.views), t('website.views30')) : html`<button class="btn btn-secondary btn-sm" data-act="go" data-route="website">${t('common.open')} ${icon('next', 16)}</button>`}</div></article>`;
}

export const overview = {
  id: 'overview',
  render() {
    const s = getState();
    if (!s.business.loaded || editing) return bizForm();
    if (!hasSignals()) return preCollect();
    const d = getDiagnosis(); const opp = s.diagnosis ? d?.data.opportunity : null;
    const na = nextAction();
    const m = liveMetrics();
    const first = String(s.profile?.name || '').split(' ')[0];
    const steps = stepList(s); const done = steps.filter(Boolean).length;
    return html`
    <header class="home-head">
      <div><h1>${first ? t('ledger.hello', { name: first }) : displayName()}</h1>
        <p class="home-step">${t('ledger.stepOf', { n: Math.min(done + 1, steps.length), total: steps.length })} · ${t(na.key)}</p></div>
      <p class="muted home-lede">${t('overview.lede')}</p>
    </header>
    <div class="home-grid">
      ${mapCard(m)}
      <div class="home-side">${deckCard(na, steps)}
        <section class="biz-card"><p class="tag">${t('ledger.bizTitle')}</p><h2 class="card-title">${displayName()}</h2>
          <p class="muted small">${icon('pin', 15)} ${getBiz().address || getBiz().city} · ${t(`biz.cat.${getBiz().category}`)}</p>${summary()}
          <p class="muted small">${t('overview.collectedAt', { date: new Date(s.signals.collectedAt).toLocaleDateString() })} <button class="link-btn" data-act="collect-signals">${t('collect.refresh')}</button></p></section>
      </div>
    </div>
    <div class="bento">
      ${themesCard()}
      <article class="card card-accent span-7 self-start">
        <p class="tag">${t('overview.opportunity')}</p>
        ${opp
          ? html`<h2 class="card-title">${opp.title}</h2><p>${opp.impact}</p><p class="mono small">${t('common.confidence')} ${opp.confidence}%</p>
            <div class="btn-row"><button class="btn btn-secondary" data-act="go" data-route="diagnosis">${t('common.open')} ${icon('next', 16)}</button></div>`
          : html`<h2 class="card-title">${t('overview.noOpportunity')}</h2><p class="muted">${t('overview.noOpportunityBody')}</p>`}
      </article>
      ${siteCard()}
    </div>`;
  },
  mount() {
    if (!caps) serverCaps().then((c) => { caps = c; if (!getState().business.loaded || editing) rerender(); });
    if (getState().business.loaded && !getSiteData()) loadSiteData().then((d) => { if (d?.available) rerender(); });
  },
};

/* ---------- form handlers ---------- */
inputs['biz-field'] = (el) => { draft[el.dataset.field] = limit(el.value, 200); };
inputs['biz-select'] = (el) => { draft[el.dataset.field] = el.value; };
inputs['lookup-q'] = (el) => { lookup.q = limit(el.value, 120); };
document.addEventListener('input', (e) => { if (e.target.matches?.('[data-in="lookup-q"]')) lookup.q = limit(e.target.value, 120); });
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches?.('#lookup-q')) { e.preventDefault(); actions['lookup-go'](); } });
actions['biz-none'] = (el) => { const f = el.dataset.field; draft[f] = !draft[f]; rerender(); };
actions['edit-biz'] = () => { const b = getBiz(); draft = { ...emptyDraft(), ...b }; editing = true; rerender(); };
actions['biz-cancel'] = () => { editing = false; rerender(); };
actions['biz-save'] = (el, e) => {
  e.preventDefault();
  const err = validate(draft);
  if (err) return toast(t(err), 'error');
  saveBiz(draft); editing = false; toast(t('biz.savedToast'), 'success'); rerender();
};
document.addEventListener('submit', (e) => { if (e.target.matches('[data-biz-form]')) { e.preventDefault(); actions['biz-save'](null, e); } });

actions['lookup-go'] = async () => {
  const q = (lookup.q || [draft.name, draft.city].filter(Boolean).join(' ')).trim();
  if (q.length < 3) { lookup.error = 'short'; return rerender(); }
  lookup.q = q; lookup.busy = true; lookup.error = null; rerender();
  const r = await findPlaces(q);
  lookup.busy = false;
  if (r.ok) lookup.results = r.data.places; else { lookup.results = null; lookup.error = ['rate_limited', 'network', 'places_key'].includes(r.error) ? r.error : 'failed'; }
  rerender();
};
actions['lookup-pick'] = (el) => {
  const p = lookup.results?.[Number(el.dataset.i)]; if (!p) return;
  const cityGuess = p.address.split(',').map((x) => x.trim()).filter((x) => !/\d{4,}/.test(x) && !/^(romania|românia)$/i.test(x)).slice(-1)[0] || '';
  draft = { ...draft, place: { ...p, fetchedAt: new Date().toISOString() }, name: draft.name || p.name, address: draft.address || p.address, city: draft.city || cityGuess,
    website: draft.website || (p.website ? p.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : ''), noName: false, noWebsite: draft.noWebsite && !p.website };
  lookup.results = null; rerender();
};
actions['lookup-clear'] = () => { draft = { ...draft, place: null }; rerender(); };
