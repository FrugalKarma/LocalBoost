// Website designer: sections you can reorder, add and edit (also by clicking them in the preview),
// photos, design styles, opening hours, booking settings, SEO and sharing, a quality check, undo/redo,
// and publishing (Business plan). Free and Pro see the full designer with a watermarked preview.
import { html, raw, icon, toast, copyText, downloadBlob, confirmDialog, openModal, $, $$, limit, slug as slugify } from '../core.js';
import { t, tIn, getLang, LANGS, fmtDate, fmtNumber } from '../i18n.js';
import { getState, update } from '../store.js';
import { runBuilder } from '../ai.js';
import { resolveDoc, previewOpts, exportHtml, suggestedSlug, siteHours, draftSections, ensureSiteV2, newSection, siteLang, ADDABLE, SECTION_ICON, PRESET_FOR, publicSiteUrl } from '../website.js';
import { buildDocument, auditDoc, PRESETS, PRESET_LIST, FONT_PAIRS, FONTS_LIST, RADII, HERO_STYLES, contrast, inkOn } from '../siteTemplate.js';
import { actions, inputs, rerender } from '../registry.js';
import { pageHead } from './shared.js';
import { needSignals } from '../collect.js';
import { getBiz, cleanPhone, cleanEmail } from '../business.js';
import { authOn, signedIn } from '../auth.js';
import { serverCaps, publishSite, unpublishSite, setRequestStatus, deleteRequest } from '../sources.js';
import { loadSiteData, getSiteData, dailySeries } from '../insights.js';
import { viewingClient } from '../cloud.js';
import { barSeries } from '../charts.js';
import { addPhotos } from '../images.js';
import { can, currentPlan, upgradePrompt } from '../plans.js';
import { qrSvg } from '../qr.js';
import { isExample } from '../example.js';
import { confetti } from '../fun.js';

const TABS = ['sections', 'design', 'details', 'booking', 'seo', 'publish'];
const TAB_ICON = { sections: 'layers', design: 'palette', details: 'pin', booking: 'calendar', seo: 'globe', publish: 'external' };
let device = 'desktop';
let tab = 'sections';
let selected = 'hero';
let busy = null;
let caps = null;
let slugDraft = null;
let dragId = null;

/* ---------- undo / redo ---------- */
const hist = { stack: [], i: -1, last: 0 };
const snap = () => JSON.stringify({ site: getState().site, business: getState().business });
function record(force = false) {
  const now = Date.now();
  if (!force && now - hist.last < 900 && hist.i >= 0) { hist.stack[hist.i] = snap(); return; } // typing: one step per pause
  hist.stack = hist.stack.slice(0, hist.i + 1); hist.stack.push(snap()); if (hist.stack.length > 60) hist.stack.shift();
  hist.i = hist.stack.length - 1; hist.last = now; paintToolbar();
}
function restore(k) {
  const target = hist.i + k; if (target < 0 || target >= hist.stack.length) return;
  hist.i = target; const st = JSON.parse(hist.stack[target]);
  update({ site: st.site, business: st.business }); hist.last = 0;
  paintPanel(); refreshPreview(); paintToolbar();
}

/* ---------- state helpers ---------- */
const site = () => getState().site;
const sections = () => site().sections || [];
const secById = (id) => sections().find((s) => s.id === id);
function setSite(patch, { force = false, preview = true } = {}) {
  update((s) => ({ site: { ...s.site, ...(typeof patch === 'function' ? patch(s.site) : patch) } }));
  record(force); if (preview) refreshSoon();
}
function setSection(id, fn, opts) { setSite((st) => ({ sections: st.sections.map((s) => (s.id === id ? { ...s, ...fn(s) } : s)) }), opts); }

/* ---------- preview ---------- */
export function refreshPreview() {
  const f = $('#site-frame'); if (!f) return;
  f.srcdoc = buildDocument(resolveDoc(), previewOpts());
  f.onload = () => { if (selected && selected !== 'hero') f.contentWindow?.postMessage({ lb: 'goto', id: selected, instant: true }, '*'); };
  paintQuality();
}
let timer;
const refreshSoon = () => { clearTimeout(timer); timer = setTimeout(refreshPreview, 180); };
window.addEventListener('message', (e) => {
  const f = $('#site-frame'); if (!f || e.source !== f.contentWindow) return;
  const m = e.data; if (!m || m.lb !== 'pick' || !secById(m.id)) return;
  selected = m.id; tab = 'sections'; paintTabs(); paintPanel();
  $(`[data-sec-row="${m.id}"]`)?.scrollIntoView({ block: 'nearest' });
});
const goto = (id) => $('#site-frame')?.contentWindow?.postMessage({ lb: 'goto', id }, '*');

/* ---------- small form builders ---------- */
const fld = (label, attrs, value, { area = false, hint = '', max = 200, rows = 3, type = 'text', ph = '' } = {}) => html`<label class="field"><span>${label}</span>
  ${area ? html`<textarea ${raw(attrs)} maxlength="${max}" rows="${rows}" placeholder="${ph}">${value || ''}</textarea>` : html`<input type="${type}" ${raw(attrs)} maxlength="${max}" value="${value || ''}" placeholder="${ph}">`}
  ${hint ? html`<small class="muted">${hint}</small>` : ''}</label>`;
const sf = (s, k, label, opts = {}) => fld(label, `data-in="sec-field" data-id="${s.id}" data-k="${k}"`, s[k], opts);
const counter = (v, max) => html`<small class="count ${String(v || '').length > max ? 'over' : ''}">${String(v || '').length}/${max}</small>`;

function photoField(label, url, { act, alt = null, altAttrs = '', id = '' }) {
  return html`<div class="photo-field"><span class="pf-label">${label}</span>
    <div class="pf-row">${url ? html`<img src="${url}" alt="" class="pf-thumb">` : html`<span class="pf-empty">${icon('image', 22)}</span>`}
      <div class="pf-acts"><button type="button" class="btn btn-secondary btn-sm" data-act="${act}" data-id="${id}" ${busy === `photo-${act}-${id}` ? 'disabled' : ''}>${busy === `photo-${act}-${id}` ? html`<i class="spin"></i>` : icon('upload', 15)} ${t(url ? 'bld.photoChange' : 'bld.photoAdd')}</button>
        ${url ? html`<button type="button" class="btn btn-ghost btn-sm" data-act="${act}-remove" data-id="${id}">${t('bld.remove')}</button>` : ''}</div></div>
    ${url && alt !== null ? fld(t('bld.alt'), altAttrs, alt, { max: 160, hint: t('bld.altHint') }) : ''}</div>`;
}

function listEditor(s, list, keys, labels, { listKey = 'items', group = null } = {}) {
  const base = group == null ? `data-id="${s.id}" data-list="${listKey}"` : `data-id="${s.id}" data-group="${group}"`;
  return html`<ol class="li-edit">${list.map((it, i) => html`<li>
    <div class="li-fields">${keys.map((k, j) => (k === 'd' || k === 'a'
      ? html`<label class="field"><span>${labels[j]}</span><textarea ${raw(base)} data-in="item-field" data-i="${i}" data-k="${k}" rows="2" maxlength="${k === 'a' ? 600 : 300}">${it[k] || ''}</textarea></label>`
      : html`<label class="field ${k === 'price' ? 'f-price' : ''}"><span>${labels[j]}</span><input ${raw(base)} data-in="item-field" data-i="${i}" data-k="${k}" maxlength="${k === 'price' ? 24 : 160}" value="${it[k] || ''}"></label>`))}</div>
    <div class="li-acts"><button type="button" class="icon-btn" ${raw(base)} data-act="item-move" data-i="${i}" data-dir="-1" ${i ? '' : 'disabled'} aria-label="${t('bld.moveUp')}">${icon('up', 15)}</button>
      <button type="button" class="icon-btn" ${raw(base)} data-act="item-move" data-i="${i}" data-dir="1" ${i < list.length - 1 ? '' : 'disabled'} aria-label="${t('bld.moveDown')}">${icon('down', 15)}</button>
      <button type="button" class="icon-btn" ${raw(base)} data-act="item-remove" data-i="${i}" aria-label="${t('bld.remove')}">${icon('trash', 15)}</button></div></li>`)}</ol>
    <button type="button" class="btn btn-secondary btn-sm" ${raw(base)} data-act="item-add">${icon('plus', 15)} ${t('bld.addItem')}</button>`;
}

/* ---------- section editors ---------- */
function sectionEditor(s) {
  const lang = siteLang(); const T = (k) => tIn(lang, k);
  const title = sf(s, 'title', t('bld.secTitle'), { max: 90, ph: T(`site.${{ services: 'servicesTitle', menu: 'menuTitle', gallery: 'galleryTitle', about: 'aboutTitle', reviews: 'reviewsTitle', visit: 'visitTitle', faq: 'faqTitle', contact: 'contactTitle', booking: `bookTitle.${getBiz().goal || 'bookings'}` }[s.type] || 'servicesTitle'}`) });
  const ai = (what) => html`<button type="button" class="btn btn-ghost btn-sm ai-btn" data-act="ai-write" data-what="${what}" ${busy ? 'disabled' : ''}>${busy === `ai-${what}` ? html`<i class="spin"></i>` : icon('sparkle', 15)} ${t('bld.aiWrite')}</button>`;
  switch (s.type) {
    case 'hero': return html`${sf(s, 'headline', t('bld.headline'), { max: 120, hint: t('bld.headlineHint') })}${sf(s, 'sub', t('bld.sub'), { area: true, max: 280 })}${sf(s, 'cta', t('bld.cta'), { max: 40 })}
      ${photoField(t('bld.coverPhoto'), s.image, { act: 'photo-sec', id: s.id, alt: s.imageAlt, altAttrs: `data-in="sec-field" data-id="${s.id}" data-k="imageAlt"` })}${ai('hero')}`;
    case 'about': return html`${title}${sf(s, 'text', t('bld.aboutText'), { area: true, max: 1600, rows: 6, ph: t('bld.aboutPh') })}
      ${photoField(t('bld.photo'), s.image, { act: 'photo-sec', id: s.id, alt: s.imageAlt, altAttrs: `data-in="sec-field" data-id="${s.id}" data-k="imageAlt"` })}${ai('about')}`;
    case 'services': return html`${title}${listEditor(s, s.items, ['n', 'price', 'd'], [t('bld.itemName'), t('bld.price'), t('bld.itemDesc')])}${ai('services')}`;
    case 'menu': return html`${title}${sf(s, 'note', t('bld.menuNote'), { max: 200, ph: t('bld.menuNotePh') })}
      ${s.groups.map((g, gi) => html`<fieldset class="grp"><legend><input aria-label="${t('bld.groupName')}" data-in="group-name" data-id="${s.id}" data-group="${gi}" value="${g.name}" maxlength="60" placeholder="${t('bld.groupName')}"></legend>
        ${listEditor(s, g.items, ['n', 'price', 'd'], [t('bld.itemName'), t('bld.price'), t('bld.itemDesc')], { group: gi })}
        <button type="button" class="btn btn-ghost btn-sm danger" data-act="group-remove" data-id="${s.id}" data-group="${gi}">${icon('trash', 15)} ${t('bld.groupRemove')}</button></fieldset>`)}
      <button type="button" class="btn btn-secondary btn-sm" data-act="group-add" data-id="${s.id}">${icon('plus', 15)} ${t('bld.groupAdd')}</button>`;
    case 'gallery': return html`${title}<div class="gal-edit">${s.images.map((g, i) => html`<figure><img src="${g.url}" alt="">
        <label class="field"><span>${t('bld.alt')}</span><input data-in="gal-alt" data-id="${s.id}" data-i="${i}" value="${g.alt}" maxlength="160"></label>
        <div class="li-acts"><button type="button" class="icon-btn" data-act="gal-move" data-id="${s.id}" data-i="${i}" data-dir="-1" ${i ? '' : 'disabled'} aria-label="${t('bld.moveUp')}">${icon('up', 15)}</button>
          <button type="button" class="icon-btn" data-act="gal-move" data-id="${s.id}" data-i="${i}" data-dir="1" ${i < s.images.length - 1 ? '' : 'disabled'} aria-label="${t('bld.moveDown')}">${icon('down', 15)}</button>
          <button type="button" class="icon-btn" data-act="gal-remove" data-id="${s.id}" data-i="${i}" aria-label="${t('bld.remove')}">${icon('trash', 15)}</button></div></figure>`)}</div>
      <button type="button" class="btn btn-secondary" data-act="gal-add" data-id="${s.id}" ${busy === 'gal' ? 'disabled' : ''}>${busy === 'gal' ? html`<i class="spin"></i>` : icon('upload', 16)} ${t('bld.galAdd')}</button><p class="muted small">${t('bld.galHint')}</p>`;
    case 'offer': return html`${sf(s, 'label', t('bld.offerLabel'), { max: 40 })}${sf(s, 'title', t('bld.offerTitle'), { max: 90 })}${sf(s, 'text', t('bld.offerText'), { area: true, max: 400 })}${sf(s, 'until', t('bld.offerUntil'), { max: 40, ph: t('bld.offerUntilPh') })}`;
    case 'faq': return html`${title}${listEditor(s, s.items, ['q', 'a'], [t('bld.question'), t('bld.answer')])}${ai('faq')}`;
    case 'reviews': {
      const g = getState().signals?.google; const hidden = new Set(site().hiddenReviews || []);
      const good = (g?.reviews || []).map((r, i) => ({ ...r, i })).filter((r) => (r.rating || 0) >= 4);
      return html`${title}${good.length ? html`<p class="muted small">${t('bld.reviewsPick')}</p><ul class="rv-pick">${good.map((r) => html`<li><label class="check"><input type="checkbox" data-in="review-show" data-i="${r.i}" ${hidden.has(r.i) ? '' : 'checked'}><span><b>${'★'.repeat(r.rating)}</b> “${r.text.slice(0, 140)}${r.text.length > 140 ? '…' : ''}” <small>${r.author}</small></span></label></li>`)}</ul>`
        : html`<p class="muted">${t('bld.reviewsNone')}</p><button type="button" class="btn btn-secondary btn-sm" data-act="go" data-route="signals">${t('collect.refresh')}</button>`}`;
    }
    case 'visit': return html`${title}<p class="muted small">${t('bld.visitNote')}</p><button type="button" class="btn btn-secondary btn-sm" data-act="bld-tab" data-tab="details">${icon('pin', 15)} ${t('bld.tab.details')}</button>`;
    case 'booking': return html`${title}${sf(s, 'sub', t('bld.sub'), { area: true, max: 240 })}<button type="button" class="btn btn-secondary btn-sm" data-act="bld-tab" data-tab="booking">${icon('calendar', 15)} ${t('bld.tab.booking')}</button>`;
    case 'contact': return html`${title}${sf(s, 'sub', t('bld.sub'), { area: true, max: 240, ph: t('bld.contactPh') })}`;
    default: return '';
  }
}

const secLabel = (s) => s.title && s.type !== 'hero' ? s.title : t(`bld.type.${s.type}`);
function emptyHint(s) {
  const d = resolveDoc(); const vis = new Set(d.sections.filter((x) => x.on).map((x) => x.id));
  if (!s.on) return t('bld.hidden');
  if (s.type === 'reviews' && !d.biz.reviews.length) return t('bld.emptyReviews');
  if (s.type === 'gallery' && !s.images?.length) return t('bld.emptyGallery');
  if (s.type === 'menu' && !s.groups?.some((g) => g.items.some((i) => i.n))) return t('bld.emptyMenu');
  if (s.type === 'about' && !s.text) return t('bld.emptyAbout');
  if (s.type === 'offer' && !(s.title && s.text)) return t('bld.emptyOffer');
  return vis.has(s.id) ? '' : '';
}

function sectionsPanel() {
  const list = sections();
  return html`<p class="muted small">${t('bld.sectionsIntro')}</p>
  <ol class="sec-list" aria-label="${t('bld.tab.sections')}">${list.map((s, i) => {
    const hint = emptyHint(s); const open = selected === s.id;
    return html`<li class="sec-row ${open ? 'open' : ''} ${s.on ? '' : 'off'}" data-sec-row="${s.id}" draggable="${s.type === 'hero' ? 'false' : 'true'}">
      <div class="sec-head">
        <span class="drag" aria-hidden="true">${s.type === 'hero' ? '' : icon('grip', 16)}</span>
        <button type="button" class="sec-name" data-act="sec-select" data-id="${s.id}" aria-expanded="${open}">${icon(SECTION_ICON[s.type] || 'overview', 16)}<span><b>${secLabel(s)}</b>${hint ? html`<small>${hint}</small>` : ''}</span></button>
        <div class="sec-acts">
          ${s.type === 'hero' ? '' : html`<button type="button" class="icon-btn" data-act="sec-move" data-id="${s.id}" data-dir="-1" ${i > 1 ? '' : 'disabled'} aria-label="${t('bld.moveUp')}: ${secLabel(s)}">${icon('up', 15)}</button>
          <button type="button" class="icon-btn" data-act="sec-move" data-id="${s.id}" data-dir="1" ${i < list.length - 1 ? '' : 'disabled'} aria-label="${t('bld.moveDown')}: ${secLabel(s)}">${icon('down', 15)}</button>`}
          <button type="button" class="icon-btn" data-act="sec-toggle" data-id="${s.id}" aria-pressed="${s.on}" aria-label="${t(s.on ? 'bld.hide' : 'bld.show')}: ${secLabel(s)}">${icon(s.on ? 'eye' : 'eyeOff', 15)}</button>
          ${ADDABLE.includes(s.type) ? html`<button type="button" class="icon-btn" data-act="sec-remove" data-id="${s.id}" aria-label="${t('bld.remove')}: ${secLabel(s)}">${icon('trash', 15)}</button>` : ''}
        </div></div>
      ${open ? html`<div class="sec-body">${sectionEditor(s)}</div>` : ''}</li>`;
  })}</ol>
  <details class="dd add-sec"><summary class="btn btn-primary">${icon('plus', 16)} ${t('bld.addSection')}</summary>
    <div class="dd-menu add-menu" role="menu">${ADDABLE.map((ty) => html`<button role="menuitem" data-act="sec-add" data-type="${ty}">${icon(SECTION_ICON[ty], 18)}<span><b>${t(`bld.type.${ty}`)}</b><small>${t(`bld.typeDesc.${ty}`)}</small></span></button>`)}</div></details>`;
}

/* ---------- design ---------- */
function presetCard(id) {
  const p = PRESETS[id]; const cur = (site().design?.preset || PRESET_FOR[getBiz().category]) === id; const pal = p.palette;
  return html`<button type="button" class="preset ${cur ? 'on' : ''}" data-act="preset" data-preset="${id}" aria-pressed="${cur}">
    <span class="pv" style="background:${pal.bg};color:${pal.text}"><i style="background:${pal.brand}"></i><b style="font-family:${raw(FONT_PAIRS[p.fonts].h)}">Aa</b><em style="background:${pal.accent}"></em><u style="background:${pal.surface};border-color:${pal.text}22"></u></span>
    <span class="pn">${t(`bld.preset.${id}`)}</span></button>`;
}
function designPanel() {
  const d = site().design || {}; const presetId = d.preset || PRESET_FOR[getBiz().category]; const base = PRESETS[presetId];
  const pal = { ...base.palette, ...(d.palette || {}) };
  const ratio = (a, b) => contrast(a, b);
  const badge = (r, min = 4.5) => html`<span class="ratio ${r >= min ? 'ok' : 'bad'}" title="WCAG">${r.toFixed(1)}:1 ${r >= min ? '✓' : '!'}</span>`;
  const color = (k) => html`<label class="color-row"><input type="color" data-in="pal" data-k="${k}" value="${pal[k]}" aria-label="${t(`bld.pal.${k}`)}"><span><b>${t(`bld.pal.${k}`)}</b><small>${t(`bld.palDesc.${k}`)}</small></span>
    ${k === 'text' ? badge(ratio(pal.text, pal.bg)) : k === 'surface' ? badge(ratio(pal.text, pal.surface)) : k === 'brand' ? badge(ratio(pal.brand, inkOn(pal.brand)), 4.5) : k === 'accent' ? badge(ratio(pal.accent, inkOn(pal.accent)), 3) : ''}</label>`;
  const seg = (k, opts, cur) => html`<div class="seg seg-wide" role="group" aria-label="${t(`bld.${k}`)}">${opts.map((o) => html`<button type="button" aria-pressed="${cur === o}" data-act="design-set" data-k="${k}" data-v="${o}">${t(`bld.${k}Opt.${o}`)}</button>`)}</div>`;
  return html`<h3 class="pan-h">${t('bld.styles')}</h3><p class="muted small">${t('bld.stylesIntro')}</p>
    <div class="presets">${PRESET_LIST.map(presetCard)}</div>
    ${photoField(t('bld.logo'), site().logo, { act: 'photo-logo' })}
    <h3 class="pan-h">${t('bld.colours')}</h3>${['brand', 'accent', 'bg', 'surface', 'text'].map(color)}
    ${Object.keys(d.palette || {}).length ? html`<button type="button" class="btn btn-ghost btn-sm" data-act="pal-reset">${icon('refresh', 15)} ${t('bld.palReset')}</button>` : ''}
    <h3 class="pan-h">${t('bld.fonts')}</h3>
    <div class="font-grid">${FONTS_LIST.map((f) => html`<button type="button" class="font-opt ${(d.fonts || base.fonts) === f ? 'on' : ''}" aria-pressed="${(d.fonts || base.fonts) === f}" data-act="design-set" data-k="fonts" data-v="${f}"><b style="font-family:${raw(FONT_PAIRS[f].h)}">${t(`bld.font.${f}`)}</b><small>${FONT_PAIRS[f].h.split(',')[0].replace(/'/g, '')} + ${FONT_PAIRS[f].b.split(',')[0].replace(/'/g, '')}</small></button>`)}</div>
    <h3 class="pan-h">${t('bld.heroStyle')}</h3>${seg('heroStyle', HERO_STYLES, d.heroStyle || base.heroStyle)}
    <h3 class="pan-h">${t('bld.radius')}</h3>${seg('radius', RADII, d.radius || base.radius)}
    <h3 class="pan-h">${t('bld.density')}</h3>${seg('density', ['cozy', 'airy'], d.density || 'cozy')}`;
}

/* ---------- details: contact, opening hours, announcement ---------- */
function hoursEditor() {
  const h = siteHours(); const names = (() => { const f = new Intl.DateTimeFormat(getLang(), { weekday: 'long' }); return [1, 2, 3, 4, 5, 6, 7].map((i) => f.format(new Date(Date.UTC(2024, 0, i, 12)))); })();
  const week = h || Array.from({ length: 7 }, (_, i) => ({ closed: i === 6, r: [['09:00', '18:00']] }));
  return html`<div class="hours-ed" role="group" aria-label="${t('bld.hours')}">${week.map((d, i) => html`<div class="hr ${d.closed ? 'closed' : ''}">
    <span class="hr-day">${names[i]}</span>
    <label class="hr-open"><input type="checkbox" data-in="hr-open" data-d="${i}" ${d.closed ? '' : 'checked'}><span>${t(d.closed ? 'bld.closed' : 'bld.open')}</span></label>
    ${d.closed ? '' : html`<span class="hr-times">${d.r.map((r, j) => html`<span class="hr-range"><input type="time" data-in="hr-time" data-d="${i}" data-j="${j}" data-k="0" value="${r[0]}" aria-label="${names[i]} ${t('bld.from')}"><span>–</span><input type="time" data-in="hr-time" data-d="${i}" data-j="${j}" data-k="1" value="${r[1]}" aria-label="${names[i]} ${t('bld.to')}">
      ${j ? html`<button type="button" class="icon-btn" data-act="hr-range-remove" data-d="${i}" aria-label="${t('bld.remove')}">${icon('x', 14)}</button>` : ''}</span>`)}
      ${d.r.length < 2 ? html`<button type="button" class="link-btn" data-act="hr-range-add" data-d="${i}">${t('bld.addBreak')}</button>` : ''}</span>`}</div>`)}</div>
    <div class="btn-row"><button type="button" class="btn btn-ghost btn-sm" data-act="hr-copy">${t('bld.hoursCopy')}</button>
      ${getBiz().place?.hoursStruct ? html`<button type="button" class="btn btn-ghost btn-sm" data-act="hr-google">${icon('refresh', 15)} ${t('bld.hoursGoogle')}</button>` : ''}</div>
    ${!h ? html`<p class="muted small">${t('bld.hoursNone')}</p>` : ''}`;
}
function detailsPanel() {
  const b = getBiz(); const a = site().announcement || {};
  const bi = (k, label, opts = {}) => fld(label, `data-in="biz-info" data-k="${k}"`, b[k] || (k === 'address' ? b.place?.address : ''), opts);
  return html`<p class="muted small">${t('bld.detailsIntro')}</p>
    <div class="field-pair">${bi('phone', t('biz.phone'), { type: 'tel', max: 30 })}${bi('whatsapp', t('biz.whatsapp'), { type: 'tel', max: 30, hint: t('biz.whatsappHint') })}</div>
    ${bi('email', t('biz.email'), { type: 'email', max: 120, hint: t('bld.emailHint') })}${bi('address', t('biz.address'), { max: 200 })}
    <h3 class="pan-h">${t('bld.hours')}</h3>${hoursEditor()}
    ${fld(t('bld.hoursNote'), 'data-in="biz-info" data-k="hoursNote"', b.hoursNote || getState().business.hoursNote, { max: 160, ph: t('bld.hoursNotePh') })}
    <h3 class="pan-h">${t('bld.announcement')}</h3>
    <label class="check"><input type="checkbox" data-in="ann-on" ${a.on ? 'checked' : ''}><span>${t('bld.annShow')}</span></label>
    ${fld(t('bld.annText'), 'data-in="ann-text"', a.text, { max: 160, ph: t('bld.annPh') })}`;
}

/* ---------- booking settings ---------- */
function bookingPanel() {
  const bk = site().booking || {}; const doc = resolveDoc();
  const chk = (k, label, val) => html`<label class="check"><input type="checkbox" data-in="bk-flag" data-k="${k}" ${val ? 'checked' : ''}><span>${label}</span></label>`;
  const where = can('inbox') ? t('bld.bkWhereInbox') : getBiz().whatsapp ? t('bld.bkWhereWa') : getBiz().email ? t('bld.bkWhereMail') : t('bld.bkWhereNone');
  return html`<p class="muted small">${t('bld.bookingIntro')}</p>
    <fieldset class="toggles"><legend>${t('bld.bkAsk')}</legend>${chk('askDate', t('bld.bkDate'), doc.booking.askDate)}${chk('askTime', t('bld.bkTime'), doc.booking.askTime)}${chk('askParty', t('bld.bkParty'), doc.booking.askParty)}${chk('askService', t('bld.bkService'), doc.booking.askService)}</fieldset>
    ${doc.booking.askService ? fld(t('bld.bkServices'), 'data-in="bk-services"', (bk.services?.length ? bk.services : doc.booking.services).join('\n'), { area: true, max: 1200, rows: 5, hint: t('bld.bkServicesHint') }) : ''}
    ${fld(t('bld.bkNote'), 'data-in="bk-note"', bk.note, { area: true, max: 240, ph: t('bld.bkNotePh') })}
    ${doc.biz.hours ? html`<p class="muted small">${icon('clock', 14)} ${t('bld.bkSlots')}</p>` : ''}
    <div class="callout">${icon('info', 18)}<p><b>${t('bld.bkWhere')}</b> ${where}</p></div>`;
}

/* ---------- SEO and sharing ---------- */
function seoPanel() {
  const seo = site().seo || {}; const doc = resolveDoc(); const b = doc.biz; const hero = doc.sections.find((s) => s.type === 'hero');
  const title = seo.title || [b.name, b.kind && b.city ? `${b.kind}, ${b.city}` : b.city].filter(Boolean).join(' · ');
  const desc = seo.description || [hero?.sub, b.address].filter(Boolean).join(' · ').slice(0, 160);
  const url = site().slug ? publicSiteUrl(site().slug) : `${location.host}/s/${suggestedSlug()}`;
  const img = seo.image || hero?.image || '';
  return html`<label class="field"><span>${t('bld.seoTitle')} ${counter(seo.title || title, 60)}</span><input data-in="seo" data-k="title" maxlength="70" value="${seo.title}" placeholder="${title}"></label>
    <label class="field"><span>${t('bld.seoDesc')} ${counter(seo.description || desc, 160)}</span><textarea data-in="seo" data-k="description" maxlength="170" rows="3" placeholder="${desc}">${seo.description}</textarea></label>
    <h3 class="pan-h">${t('bld.seoGoogle')}</h3>
    <div class="serp"><small>${url.replace(/^https?:\/\//, '')}</small><b>${title.slice(0, 60)}${title.length > 60 ? '…' : ''}</b><p>${desc.slice(0, 158)}${desc.length > 158 ? '…' : ''}</p></div>
    <h3 class="pan-h">${t('bld.seoShare')}</h3>
    <div class="share-card">${img ? html`<img src="${img}" alt="">` : html`<span class="sc-empty">${t('bld.seoNoImage')}</span>`}<div><small>${url.replace(/^https?:\/\//, '').split('/')[0]}</small><b>${title}</b><p>${desc.slice(0, 110)}</p></div></div>
    ${photoField(t('bld.seoImage'), seo.image, { act: 'photo-seo' })}
    <label class="field"><span>${t('website.language')}</span><select data-in="site-lang">${LANGS.map((l) => html`<option value="${l.code}" ${siteLang() === l.code ? 'selected' : ''}>${l.name}</option>`)}</select></label>`;
}

/* ---------- publish ---------- */
function qrBlock(url) {
  return html`<div class="qr-box">${raw(qrSvg(url, { size: 132, label: url }))}<div><b>${t('bld.qrTitle')}</b><p class="muted small">${t('bld.qrBody')}</p>
    <div class="btn-row"><button type="button" class="btn btn-secondary btn-sm" data-act="qr-download" data-url="${url}">${icon('download', 15)} SVG</button><button type="button" class="btn btn-ghost btn-sm" data-act="go" data-route="pack" data-hash="poster">${t('bld.qrPoster')}</button></div></div></div>`;
}
function publishPanel() {
  const st = site(); const sd = getSiteData(); const audit = auditDoc(resolveDoc());
  const online = !!(st.slug && st.publishedAt && sd?.site?.published !== false);
  const checklist = html`<div class="qa"><div class="qa-head"><span class="qa-score ${audit.score >= 80 ? 'good' : audit.score >= 55 ? 'mid' : 'low'}">${audit.score}</span><div><b>${t('bld.qaTitle')}</b><small>${t(audit.items.length ? 'bld.qaSome' : 'bld.qaAll')}</small></div></div>
    ${audit.items.length ? html`<ul class="qa-list">${audit.items.map((x) => html`<li class="${x.level}">${icon(x.level === 'error' ? 'x' : 'info', 15)}<span>${t(`qa.${x.key}`, x.vars || {})}</span><button type="button" class="link-btn" data-act="qa-fix" data-key="${x.key}">${t('bld.qaFix')}</button></li>`)}</ul>` : ''}</div>`;
  if (viewingClient()) return html`${checklist}<p class="muted">${t('website.adminNoPublish')}</p>`;
  if (!can('publish')) {
    return html`${checklist}<div class="upsell"><span class="upsell-ic">${icon('external', 22)}</span><h3>${t('bld.upTitle')}</h3><p>${t('bld.upBody', { plan: t(`plans.${currentPlan()}.name`) })}</p>
      <ul>${['upLive', 'upInbox', 'upStats', 'upBrand', 'upDownload'].map((k) => html`<li>${icon('check', 15)} ${t(`bld.${k}`)}</li>`)}</ul>
      <button type="button" class="btn btn-primary" data-act="go" data-route="plans">${t('bld.upCta')}</button></div>`;
  }
  if (!caps?.sites || !authOn() || !signedIn()) {
    return html`${checklist}<div class="pub-off"><h3>${t('website.pubOffTitle')}</h3><p class="muted">${t('website.pubOffBody')}</p>
      <button class="btn btn-secondary" data-act="export-html">${icon('download', 18)} ${t('website.download')}</button></div>`;
  }
  const slug = slugDraft ?? st.slug ?? suggestedSlug();
  const stats = dailySeries(30); const sum = (k, n) => stats.slice(-n).reduce((a, d) => a + d[k], 0);
  const reqs = sd?.requests || []; const fresh = reqs.filter((r) => r.status === 'new').length;
  return html`${checklist}
    ${online ? html`<div class="pub-live"><span class="pub-dot" aria-hidden="true"></span><div><strong>${t('website.live')}</strong>
      <a href="${publicSiteUrl(st.slug)}" target="_blank" rel="noopener">${publicSiteUrl(st.slug).replace(/^https?:\/\//, '')}</a></div></div>
      <div class="btn-row"><button class="btn btn-secondary btn-sm" data-act="copy-site-link">${icon('copy', 16)} ${t('actions.copy')}</button>
        <a class="btn btn-secondary btn-sm" href="${publicSiteUrl(st.slug)}" target="_blank" rel="noopener">${icon('external', 16)} ${t('common.open')}</a></div>` : html`<p class="muted">${t('website.pubIntro')}</p>`}
    <form class="slug-form" data-slug-form novalidate><label class="field"><span>${t('website.address')}</span>
      <span class="slug-wrap"><i>${publicSiteUrl('').replace(/^https?:\/\//, '')}</i><input id="site-slug" value="${slug}" maxlength="40" autocomplete="off" spellcheck="false" inputmode="url"></span>
      <small class="muted">${t('website.slugHint')}</small></label>
      <div class="btn-row"><button type="submit" class="btn btn-primary" ${busy === 'publish' ? 'disabled' : ''}>${busy === 'publish' ? html`<i class="spin"></i>` : icon('external', 18)} ${t(online ? 'website.update' : 'website.publish')}</button>
        ${online ? html`<button type="button" class="btn btn-ghost danger" data-act="unpublish-site">${t('website.unpublish')}</button>` : ''}</div></form>
    <label class="check"><input type="checkbox" data-in="branding" ${st.branding !== false ? 'checked' : ''}><span>${t('bld.branding')}</span></label>
    ${online ? html`<p class="muted small">${t('website.updatedNote', { date: fmtDate(st.publishedAt) })}</p>
    ${qrBlock(publicSiteUrl(st.slug))}
    <h3 class="pub-h">${t('website.statsTitle')}</h3>
    <div class="pub-stats"><div><b>${fmtNumber(sum('views', 7))}</b><span>${t('website.views7')}</span></div><div><b>${fmtNumber(sum('clicks', 7))}</b><span>${t('website.clicks7')}</span></div><div><b>${fmtNumber(sum('requests', 30))}</b><span>${t('website.requests30')}</span></div></div>
    ${barSeries(stats.map((d) => d.views), t('website.views30'))}
    <h3 class="pub-h">${t('website.requestsTitle')} ${fresh ? html`<span class="badge badge-live">${t('website.newN', { n: fresh })}</span>` : ''}
      <button class="icon-btn" data-act="reload-site-data" aria-label="${t('actions.retry')}">${icon('refresh', 16)}</button></h3>
    ${reqs.length ? html`<ul class="req-list">${reqs.map((r) => html`<li class="req ${r.status === 'done' ? 'is-done' : ''}">
      <div class="req-main"><strong>${r.name}</strong><a href="${/@/.test(r.contact) ? `mailto:${r.contact}` : `tel:${r.contact.replace(/[^\d+]/g, '')}`}">${r.contact}</a>
        <small>${[r.date, r.time, r.party ? t('website.people', { n: r.party }) : ''].filter(Boolean).join(' · ')}${r.message ? html`<br>“${r.message}”` : ''}</small>
        <small class="muted">${fmtDate(r.created_at)}</small></div>
      <div class="req-acts"><button class="btn btn-secondary btn-sm" data-act="req-status" data-id="${r.id}" data-status="${r.status === 'done' ? 'new' : 'done'}">${r.status === 'done' ? t('website.reopen') : html`${icon('check', 15)} ${t('website.handled')}`}</button>
        <button class="icon-btn" data-act="req-delete" data-id="${r.id}" aria-label="${t('admin.delete')}">${icon('trash', 15)}</button></div></li>`)}</ul>`
      : html`<p class="muted small">${t('website.noRequests')}</p>`}` : ''}
    <hr class="pub-sep"><p class="muted small">${t('website.downloadBody')}</p>
    <button class="btn btn-ghost btn-sm" data-act="export-html">${icon('download', 16)} ${t('website.download')}</button>`;
}

/* ---------- layout ---------- */
const PANELS = { sections: sectionsPanel, design: designPanel, details: detailsPanel, booking: bookingPanel, seo: seoPanel, publish: publishPanel };
function paintPanel() { const el = $('#bld-panel'); if (el) el.innerHTML = PANELS[tab]().s; }
function paintTabs() { $$('.bld-tabs [role="tab"]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab))); $('#bld-panel')?.setAttribute('aria-labelledby', `btab-${tab}`); }
function paintToolbar() {
  const u = $('[data-act="undo"]'); const r = $('[data-act="redo"]');
  if (u) u.disabled = hist.i <= 0; if (r) r.disabled = hist.i >= hist.stack.length - 1;
}
function paintQuality() {
  const el = $('#qa-chip'); if (!el) return; const a = auditDoc(resolveDoc());
  el.className = `qa-chip ${a.score >= 80 ? 'good' : a.score >= 55 ? 'mid' : 'low'}`; el.querySelector('b').textContent = a.score;
}

export const website = {
  id: 'website',
  render() {
    const st = site();
    const head = pageHead({ title: t('website.title'), sub: t('bld.sub2') });
    if (!st.generated) {
      return html`${head}<section class="card empty-hero bld-empty"><div class="empty-ic">${icon('website', 34)}</div><h2>${t('website.emptyTitle')}</h2><p class="muted">${t('website.emptyBody')}</p>
        <button class="btn btn-primary btn-lg" data-act="gen-site" ${busy ? 'disabled' : ''}>${busy === 'gen' ? html`<i class="spin"></i> ${t('website.generating')}` : html`${icon('sparkle', 18)} ${t('actions.generateWebsite')}`}</button>
        ${can('publish') ? '' : html`<p class="muted small">${t('bld.previewOnlyNote')}</p>`}</section>`;
    }
    const online = st.slug && st.publishedAt;
    return html`${head}
    <div class="bld">
      <aside class="bld-side card" aria-label="${t('website.controls')}">
        <div class="bld-tabs" role="tablist" aria-label="${t('website.controls')}">${TABS.map((k) => html`<button role="tab" id="btab-${k}" aria-selected="${tab === k}" aria-controls="bld-panel" data-act="bld-tab" data-tab="${k}">${icon(TAB_ICON[k], 16)}<span>${t(`bld.tab.${k}`)}</span>${k === 'publish' && !can('publish') ? html`<i class="tab-lock" aria-hidden="true">${icon('lock', 12)}</i>` : ''}</button>`)}</div>
        <div id="bld-panel" role="tabpanel" aria-labelledby="btab-${tab}" class="bld-panel">${PANELS[tab]()}</div>
      </aside>
      <div class="bld-stage">
        <div class="bld-bar">
          <div class="bld-tools"><button type="button" class="icon-btn" data-act="undo" aria-label="${t('bld.undo')}" title="${t('bld.undo')} (Ctrl+Z)" ${hist.i <= 0 ? 'disabled' : ''}>${icon('prev', 18)}</button>
            <button type="button" class="icon-btn" data-act="redo" aria-label="${t('bld.redo')}" title="${t('bld.redo')} (Ctrl+Y)" ${hist.i >= hist.stack.length - 1 ? 'disabled' : ''}>${icon('next', 18)}</button></div>
          <div class="seg seg-sm" role="group" aria-label="${t('website.device')}">${['desktop', 'tablet', 'phone'].map((d) => html`<button aria-pressed="${device === d}" data-act="device" data-device="${d}">${t(`website.${d}`)}</button>`)}</div>
          <button type="button" class="qa-chip" id="qa-chip" data-act="bld-tab" data-tab="publish" title="${t('bld.qaTitle')}">${icon('check', 15)}<b>–</b><span>${t('bld.quality')}</span></button>
          <span class="bld-url">${online ? html`${icon('globe', 15)} ${publicSiteUrl(st.slug).replace(/^https?:\/\//, '')}` : ''}</span>
          <button type="button" class="btn btn-secondary btn-sm" data-act="bld-full">${icon('max', 16)} <span class="hide-sm">${t('bld.fullPreview')}</span></button>
          <button type="button" class="btn btn-primary btn-sm" data-act="bld-tab" data-tab="publish">${icon('external', 16)} ${t(online ? 'website.live' : 'website.publish')}</button>
        </div>
        <div class="preview-stage"><div class="device device-${device}"><iframe id="site-frame" title="${t('website.previewTitle')}" sandbox="allow-scripts allow-forms"></iframe></div></div>
        <p class="muted small browser-note">${icon('info', 14)} ${t('bld.clickHint')}</p>
      </div>
    </div>`;
  },
  mount() {
    ensureSiteV2();
    if (site().generated && hist.i < 0) record(true);
    refreshPreview(); paintToolbar();
    if (!caps) serverCaps().then((c) => { caps = c; if (tab === 'publish') paintPanel(); });
    if (!getSiteData()) loadSiteData().then(() => { if (tab === 'publish') paintPanel(); });
    initDrag();
  },
};

/* ---------- drag to reorder ---------- */
function initDrag() {
  const list = $('.sec-list'); if (!list || list.dataset.dnd) return; list.dataset.dnd = '1';
  list.addEventListener('dragstart', (e) => { const li = e.target.closest('[data-sec-row]'); if (!li) return; dragId = li.dataset.secRow; li.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
  list.addEventListener('dragend', () => { dragId = null; $$('.sec-row.dragging, .sec-row.drop').forEach((x) => x.classList.remove('dragging', 'drop')); });
  list.addEventListener('dragover', (e) => { if (!dragId) return; e.preventDefault(); const li = e.target.closest('[data-sec-row]'); $$('.sec-row.drop').forEach((x) => x.classList.remove('drop')); if (li && li.dataset.secRow !== 'hero') li.classList.add('drop'); });
  list.addEventListener('drop', (e) => {
    e.preventDefault(); const li = e.target.closest('[data-sec-row]'); if (!dragId || !li || li.dataset.secRow === 'hero') return;
    const arr = [...sections()]; const from = arr.findIndex((s) => s.id === dragId); const to = arr.findIndex((s) => s.id === li.dataset.secRow);
    if (from < 1 || to < 1 || from === to) return;
    const [m] = arr.splice(from, 1); arr.splice(to, 0, m);
    setSite({ sections: arr }, { force: true }); paintPanel(); initDrag();
  });
}
const repaint = () => { paintPanel(); if (tab === 'sections') { const l = $('.sec-list'); if (l) delete l.dataset.dnd; initDrag(); } };

/* ---------- tabs, devices, undo ---------- */
actions['bld-tab'] = (el) => { tab = el.dataset.tab; paintTabs(); repaint(); $(`#btab-${tab}`)?.focus(); };
actions.device = (el) => { device = el.dataset.device; $$('[data-act="device"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.device === device))); const d = $('.device'); if (d) d.className = `device device-${device}`; };
actions.undo = () => restore(-1);
actions.redo = () => restore(1);
document.addEventListener('keydown', (e) => {
  if (document.body.dataset.route !== 'website' || !(e.ctrlKey || e.metaKey)) return;
  if (e.target.matches?.('input, textarea')) return; // let fields undo their own text
  if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); restore(-1); } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); restore(1); }
});
document.addEventListener('click', (e) => {
  $$('details.dd[open]').forEach((d) => { if (!d.contains(e.target) || e.target.closest('.dd-menu button')) d.removeAttribute('open'); });
});
actions['bld-full'] = () => {
  const doc = buildDocument(resolveDoc(), { ...previewOpts(), preview: false, watermark: previewOpts().watermark });
  openModal({ title: t('bld.fullPreview'), wide: true, body: html`<div class="full-prev"><iframe sandbox="allow-scripts allow-forms allow-popups" title="${t('website.previewTitle')}" srcdoc="${doc}"></iframe></div>`, actions: [{ label: t('common.close'), kind: 'btn-primary', value: true }] });
};

/* ---------- sections ---------- */
actions['sec-select'] = (el) => { selected = selected === el.dataset.id ? '' : el.dataset.id; repaint(); if (selected) goto(selected); };
actions['sec-toggle'] = (el) => { setSection(el.dataset.id, (s) => ({ on: !s.on }), { force: true }); repaint(); };
actions['sec-move'] = (el) => {
  const arr = [...sections()]; const i = arr.findIndex((s) => s.id === el.dataset.id); const j = i + Number(el.dataset.dir);
  if (i < 1 || j < 1 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]];
  setSite({ sections: arr }, { force: true }); repaint(); $(`[data-sec-row="${el.dataset.id}"] [data-act="sec-move"][data-dir="${el.dataset.dir}"]`)?.focus();
};
actions['sec-remove'] = async (el) => {
  const s = secById(el.dataset.id); if (!s) return;
  if (!(await confirmDialog(t('bld.removeTitle', { name: secLabel(s) }), t('bld.removeBody'), t('bld.remove')))) return;
  setSite((st) => ({ sections: st.sections.filter((x) => x.id !== s.id) }), { force: true }); repaint();
};
actions['sec-add'] = (el) => {
  const s = newSection(el.dataset.type);
  const arr = [...sections()]; const at = Math.max(1, arr.findIndex((x) => x.type === 'booking')); arr.splice(at < 1 ? arr.length : at, 0, s);
  setSite({ sections: arr }, { force: true }); selected = s.id; repaint(); setTimeout(() => goto(s.id), 300);
};
inputs['sec-field'] = (el) => { const k = el.dataset.k; setSection(el.dataset.id, () => ({ [k]: limit(el.value, 1600) })); };
inputs['item-field'] = (el) => {
  const { id, list, group, i, k } = el.dataset; const v = limit(el.value, 600);
  setSection(id, (s) => (group != null ? { groups: s.groups.map((g, gi) => (gi === +group ? { ...g, items: g.items.map((it, ii) => (ii === +i ? { ...it, [k]: v } : it)) } : g)) }
    : { [list]: s[list].map((it, ii) => (ii === +i ? { ...it, [k]: v } : it)) }));
};
inputs['group-name'] = (el) => { const g = +el.dataset.group; setSection(el.dataset.id, (s) => ({ groups: s.groups.map((x, i) => (i === g ? { ...x, name: limit(el.value, 60) } : x)) })); };
const listOp = (el, fn) => {
  const { id, list, group } = el.dataset;
  setSection(id, (s) => (group != null ? { groups: s.groups.map((g, gi) => (gi === +group ? { ...g, items: fn(g.items) } : g)) } : { [list]: fn(s[list]) }), { force: true });
  repaint();
};
const blank = (el) => (el.dataset.list === 'items' && secById(el.dataset.id)?.type === 'faq' ? { q: '', a: '' } : { n: '', d: '', price: '' });
actions['item-add'] = (el) => listOp(el, (a) => [...a, blank(el)].slice(0, 24));
actions['item-remove'] = (el) => listOp(el, (a) => a.filter((_, i) => i !== +el.dataset.i));
actions['item-move'] = (el) => listOp(el, (a) => { const b = [...a]; const i = +el.dataset.i; const j = i + Number(el.dataset.dir); if (j < 0 || j >= b.length) return b; [b[i], b[j]] = [b[j], b[i]]; return b; });
actions['group-add'] = (el) => { setSection(el.dataset.id, (s) => ({ groups: [...s.groups, { name: '', items: [{ n: '', d: '', price: '' }] }].slice(0, 8) }), { force: true }); repaint(); };
actions['group-remove'] = (el) => { setSection(el.dataset.id, (s) => ({ groups: s.groups.filter((_, i) => i !== +el.dataset.group) }), { force: true }); repaint(); };
inputs['review-show'] = (el) => { const i = +el.dataset.i; setSite((st) => { const h = new Set(st.hiddenReviews || []); if (el.checked) h.delete(i); else h.add(i); return { hiddenReviews: [...h] }; }, { force: true }); };

/* ---------- photos ---------- */
async function withPhotos(key, kind, multiple, apply) {
  if (busy) return; busy = key; repaint();
  const r = await addPhotos(kind, { multiple });
  busy = null;
  if (r.photos.length) apply(r.photos);
  if (r.failed) toast(t('bld.photoFailed', { n: r.failed }), 'error');
  repaint();
}
actions['photo-sec'] = (el) => withPhotos(`photo-photo-sec-${el.dataset.id}`, secById(el.dataset.id)?.type === 'hero' ? 'hero' : 'about', false, ([p]) => setSection(el.dataset.id, (s) => ({ image: p.url, imageAlt: s.imageAlt || '' }), { force: true }));
actions['photo-sec-remove'] = (el) => { setSection(el.dataset.id, () => ({ image: '', imageAlt: '' }), { force: true }); repaint(); };
actions['photo-logo'] = () => withPhotos('photo-photo-logo-', 'logo', false, ([p]) => setSite({ logo: p.url }, { force: true }));
actions['photo-logo-remove'] = () => { setSite({ logo: '' }, { force: true }); repaint(); };
actions['photo-seo'] = () => withPhotos('photo-photo-seo-', 'seo', false, ([p]) => setSite((st) => ({ seo: { ...st.seo, image: p.url } }), { force: true }));
actions['photo-seo-remove'] = () => { setSite((st) => ({ seo: { ...st.seo, image: '' } }), { force: true }); repaint(); };
actions['gal-add'] = (el) => withPhotos('gal', 'gallery', true, (ps) => setSection(el.dataset.id, (s) => ({ images: [...s.images, ...ps.map((p) => ({ url: p.url, alt: '' }))].slice(0, 12) }), { force: true }));
actions['gal-remove'] = (el) => { setSection(el.dataset.id, (s) => ({ images: s.images.filter((_, i) => i !== +el.dataset.i) }), { force: true }); repaint(); };
actions['gal-move'] = (el) => { setSection(el.dataset.id, (s) => { const b = [...s.images]; const i = +el.dataset.i; const j = i + Number(el.dataset.dir); if (j >= 0 && j < b.length) [b[i], b[j]] = [b[j], b[i]]; return { images: b }; }, { force: true }); repaint(); };
inputs['gal-alt'] = (el) => { const i = +el.dataset.i; setSection(el.dataset.id, (s) => ({ images: s.images.map((g, ii) => (ii === i ? { ...g, alt: limit(el.value, 160) } : g)) })); };

/* ---------- AI writing (free for every plan: it only drafts text) ---------- */
actions['ai-write'] = async (el) => {
  const what = el.dataset.what; if (busy) return;
  busy = `ai-${what}`; repaint();
  const r = await runBuilder();
  busy = null;
  if (r.mode !== 'ai') { repaint(); return toast(t('bld.aiOff'), 'info'); }
  const c = r.copy;
  const id = what === 'hero' ? 'hero' : sections().find((s) => s.type === what)?.id;
  if (what === 'hero') setSection(id, () => ({ headline: c.headline, sub: c.subheadline, cta: c.cta }), { force: true });
  if (what === 'about' && c.about) setSection(id, () => ({ text: c.about }), { force: true });
  if (what === 'services' && c.services?.length) setSection(id, (s) => ({ items: c.services.map((x, i) => ({ n: x.n, d: x.d, price: s.items[i]?.price || '' })) }), { force: true });
  if (what === 'faq' && c.faq?.length) setSection(id, () => ({ items: c.faq }), { force: true });
  setSite({ ai: { lang: getLang(), copy: c } }); repaint(); toast(t('bld.aiDone'), 'success');
};

/* ---------- design ---------- */
actions.preset = (el) => { setSite((st) => ({ design: { ...st.design, preset: el.dataset.preset, palette: {}, fonts: null, radius: null, heroStyle: null } }), { force: true }); repaint(); };
actions['design-set'] = (el) => { setSite((st) => ({ design: { ...st.design, [el.dataset.k]: el.dataset.v } }), { force: true }); repaint(); };
inputs.pal = (el) => { setSite((st) => ({ design: { ...st.design, palette: { ...(st.design.palette || {}), [el.dataset.k]: el.value } } })); };
document.addEventListener('change', (e) => { if (e.target.matches?.('[data-in="pal"]') && document.body.dataset.route === 'website') repaint(); });
actions['pal-reset'] = () => { setSite((st) => ({ design: { ...st.design, palette: {} } }), { force: true }); repaint(); };

/* ---------- details ---------- */
inputs['biz-info'] = (el) => {
  const k = el.dataset.k; const v = limit(el.value, 200);
  update((s) => ({ business: { ...s.business, [k]: k === 'email' ? (cleanEmail(v) || v.trim()) : k === 'address' || k === 'hoursNote' ? v : cleanPhone(v) } })); record(); refreshSoon();
};
const week = () => JSON.parse(JSON.stringify(siteHours() || Array.from({ length: 7 }, (_, i) => ({ closed: i === 6, r: [['09:00', '18:00']] }))));
const setHours = (w, force = true) => { update((s) => ({ business: { ...s.business, hours: w } })); record(force); refreshSoon(); };
inputs['hr-open'] = (el) => { const w = week(); const d = w[+el.dataset.d]; d.closed = !el.checked; if (!d.closed && !d.r.length) d.r = [['09:00', '18:00']]; setHours(w); repaint(); };
inputs['hr-time'] = (el) => { if (!/^\d{2}:\d{2}$/.test(el.value)) return; const w = week(); const d = w[+el.dataset.d]; if (d.r[+el.dataset.j]) d.r[+el.dataset.j][+el.dataset.k] = el.value; setHours(w, false); };
actions['hr-range-add'] = (el) => { const w = week(); const d = w[+el.dataset.d]; const last = d.r[d.r.length - 1]?.[1] || '14:00'; d.r.push([last, '22:00']); setHours(w); repaint(); };
actions['hr-range-remove'] = (el) => { const w = week(); w[+el.dataset.d].r.splice(1); setHours(w); repaint(); };
actions['hr-copy'] = () => { const w = week(); for (let i = 1; i < 5; i++) w[i] = JSON.parse(JSON.stringify(w[0])); setHours(w); repaint(); toast(t('bld.hoursCopied'), 'success'); };
actions['hr-google'] = () => { update((s) => { const b = { ...s.business }; delete b.hours; return { business: b }; }); record(true); refreshSoon(); repaint(); };
inputs['ann-on'] = (el) => { setSite((st) => ({ announcement: { ...st.announcement, on: el.checked } }), { force: true }); };
inputs['ann-text'] = (el) => { setSite((st) => ({ announcement: { ...st.announcement, text: limit(el.value, 160), on: st.announcement?.on || !!el.value } })); };

/* ---------- booking ---------- */
inputs['bk-flag'] = (el) => { setSite((st) => ({ booking: { ...st.booking, [el.dataset.k]: el.checked } }), { force: true }); if (el.dataset.k === 'askService') repaint(); };
inputs['bk-services'] = (el) => { setSite((st) => ({ booking: { ...st.booking, services: el.value.split('\n').map((x) => limit(x.trim(), 60)).filter(Boolean).slice(0, 20) } })); };
inputs['bk-note'] = (el) => { setSite((st) => ({ booking: { ...st.booking, note: limit(el.value, 240) } })); };

/* ---------- SEO ---------- */
inputs.seo = (el) => { setSite((st) => ({ seo: { ...st.seo, [el.dataset.k]: limit(el.value, el.dataset.k === 'title' ? 70 : 170) } }), { preview: false }); clearTimeout(seoTimer); seoTimer = setTimeout(() => { const f = document.activeElement; const pos = f?.selectionStart; paintPanel(); const n = $(`[data-in="seo"][data-k="${el.dataset.k}"]`); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch { /* ignore */ } } refreshPreview(); }, 500); };
let seoTimer;
inputs['site-lang'] = (el) => { setSite({ lang: el.value }, { force: true }); repaint(); };
inputs.branding = (el) => { if (!can('noBranding')) { el.checked = true; return upgradePrompt('noBranding'); } setSite({ branding: el.checked }, { force: true }); };

/* ---------- quality fixes: jump to the right place ---------- */
actions['qa-fix'] = (el) => {
  const k = el.dataset.key;
  const to = { textContrast: ['design'], surfaceContrast: ['design'], altText: ['sections', sections().find((s) => s.type === 'gallery' && s.images.some((g) => !g.alt))?.id || sections().find((s) => s.image && !s.imageAlt)?.id || 'hero'],
    noHero: ['sections', 'hero'], noContact: ['details'], noBooking: ['sections', 'booking'], noHours: ['details'], noAddress: ['details'], noDescription: ['seo'], noPhotos: ['sections', 'hero'], noReviews: ['sections', 'reviews'] }[k] || ['sections'];
  tab = to[0]; if (to[1]) { selected = to[1]; if (to[1] === 'booking' || to[1] === 'hero' || to[1] === 'reviews') { const s = sections().find((x) => x.type === to[1]); if (s) { selected = s.id; if (!s.on) setSection(s.id, () => ({ on: true }), { force: true }); } } }
  paintTabs(); repaint(); if (selected) goto(selected);
};

/* ---------- generate ---------- */
export async function generateSite() {
  if (busy || needSignals()) return; busy = 'gen'; rerender();
  const r = await runBuilder();
  const b = getBiz();
  update((s) => ({ site: { ...s.site, v: 2, generated: true, sections: draftSections(r.mode === 'ai' ? r.copy : null), design: { preset: PRESET_FOR[b.category], palette: {}, fonts: null, radius: null, heroStyle: null, density: 'cozy' }, ai: r.mode === 'ai' ? { lang: getLang(), copy: r.copy } : null } }));
  busy = null; selected = 'hero'; tab = 'sections'; hist.stack = []; hist.i = -1; rerender();
  toast(r.mode === 'ai' ? t('website.toastAi') : t('website.toastLocal'), r.mode === 'ai' ? 'success' : 'info');
}
actions['gen-site'] = () => generateSite();

actions['reset-site'] = async () => {
  if (!(await confirmDialog(t('website.resetTitle'), t('website.resetBody'), t('actions.reset')))) return;
  const { slug, publishedAt } = site();
  update((s) => ({ site: { ...s.site, generated: false, sections: [], slug, publishedAt } })); hist.stack = []; hist.i = -1; rerender(); toast(t('website.toastReset'), 'info');
};
actions['export-html'] = () => {
  if (!can('download')) return upgradePrompt('download');
  try { downloadBlob(`${slugify(getBiz().name || 'website') || 'website'}.html`, exportHtml()); toast(t('website.toastExport'), 'success'); }
  catch (e) { console.error(e); toast(t('common.errorGeneric'), 'error'); }
};
actions['qr-download'] = (el) => downloadBlob(`${slugify(getBiz().name || 'site')}-qr.svg`, new Blob([qrSvg(el.dataset.url, { size: 1024 })], { type: 'image/svg+xml' }));

/* ---------- publishing ---------- */
const PUB_ERR = { slug_taken: 'website.errTaken', bad_slug: 'website.errSlug', network: 'website.errNetwork', sites_not_configured: 'website.pubOffBody', plan_required: 'bld.upTitle', data_too_large: 'bld.tooLarge' };
document.addEventListener('submit', async (e) => {
  if (!e.target.matches('[data-slug-form]')) return;
  e.preventDefault();
  if (busy) return;
  if (!can('publish')) return upgradePrompt('publish');
  if (isExample()) return toast(t('example.noPublish'), 'info');
  const slug = slugify($('#site-slug')?.value || '').slice(0, 40).replace(/^-+|-+$/g, '');
  slugDraft = slug;
  if (slug.length < 3) return toast(t('website.errSlug'), 'error');
  const doc = resolveDoc();
  if (JSON.stringify(doc).includes('data:image/')) return toast(t('bld.localPhotos'), 'error');
  busy = 'publish'; paintPanel();
  const r = await publishSite(slug, doc);
  busy = null;
  if (r.ok) { update((s) => ({ site: { ...s.site, slug, publishedAt: Date.now() } })); slugDraft = null; await loadSiteData(true); toast(t('website.toastPublished'), 'success'); confetti(); }
  else toast(t(PUB_ERR[r.error] || 'common.errorGeneric'), 'error');
  paintPanel();
});
actions['unpublish-site'] = async () => {
  if (!(await confirmDialog(t('website.unpublishTitle'), t('website.unpublishBody'), t('website.unpublish')))) return;
  const r = await unpublishSite();
  if (!r.ok) return toast(t('common.errorGeneric'), 'error');
  update((s) => ({ site: { ...s.site, publishedAt: null } })); await loadSiteData(true); toast(t('website.toastUnpublished'), 'info'); paintPanel();
};
actions['copy-site-link'] = async () => { const ok = await copyText(publicSiteUrl(site().slug)); toast(ok ? t('common.copied') : t('common.copyFailed'), ok ? 'success' : 'error'); };
actions['reload-site-data'] = async () => { await loadSiteData(true); paintPanel(); };
actions['req-status'] = async (el) => { const r = await setRequestStatus(Number(el.dataset.id), el.dataset.status); if (!r.ok) return toast(t('common.errorGeneric'), 'error'); await loadSiteData(true); paintPanel(); };
actions['req-delete'] = async (el) => {
  if (!(await confirmDialog(t('website.reqDeleteTitle'), t('website.reqDeleteBody'), t('admin.delete')))) return;
  const r = await deleteRequest(Number(el.dataset.id)); if (!r.ok) return toast(t('common.errorGeneric'), 'error');
  await loadSiteData(true); paintPanel();
};

export const getSiteFrames = () => [$('#site-frame')].filter(Boolean);
