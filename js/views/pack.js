// Action Studio (route "pack"): one offer, designed everywhere it needs to appear.
// Tabs: Offer · Social post · Stickers · Words (headlines, captions, hashtags) · 7-day plan · Reviews & QR.
// Free can design and preview everything; exporting, printing and AI writing need Pro.
import { html, raw, icon, toast, copyText, confirmDialog, limit, slug as slugify, $ } from '../core.js';
import { t, ta } from '../i18n.js';
import { getState, update } from '../store.js';
import { getAssets, ensureAssetsSync, regenAsset, runAssets } from '../ai.js';
import { actions, inputs, rerender } from '../registry.js';
import { pageHead } from './shared.js';
import { needSignals } from '../collect.js';
import { getBiz, displayName } from '../business.js';
import { can, upgradePrompt, lockBadge } from '../plans.js';
import { repliesSection, posterSection } from './tools.js';
import { stickerSvg, postSvg, defaultSticker, FONTS, FONT_IDS, PALETTES, PALETTE_IDS, ICON_IDS, ICONS, SHAPES, RINGS, FORMATS, LAYOUTS, stickerColors, downloadText, downloadPng, inlinePhoto, printSheet } from '../studio.js';
import { siteLang } from '../website.js';

const TABS = [['offer', 'percent'], ['post', 'share'], ['stickers', 'star'], ['words', 'copy'], ['plan', 'calendar'], ['reviews', 'reply']];
let tab = 'offer';
let busy = false;
let printCm = 6;

/* ---------- studio state (edits are kept; AI or templates fill what is empty) ---------- */
const city = () => (getBiz().city || '').split(',')[0].trim();
function seed() {
  let a = getAssets() || ensureAssetsSync(); const b = getBiz(); const name = displayName();
  if (getState().example) a = { ...a, offer: { title: t('example.offerTitle'), body: t('example.offerBody'), cta: t('example.offerCta') }, post: { text: t('example.postText'), cta: t('example.offerCta') }, merch: { ...a.merch, stickerText: 'BRUNCH CLUB' } };
  const badge = (a.offer.title.match(/-?\d+\s?%|\d+\s?(lei|€|eur|ron)|gratis|free|2\s?\+\s?1|1\s?\+\s?1/i) || [''])[0];
  return {
    offer: { title: a.offer.title, body: a.offer.body, cta: a.offer.cta, badge: badge || t('studio.badgeDefault'), until: '', terms: '' },
    post: { format: 'square', layout: 'bold', palette: 'aurora', font: 'bold', headline: a.offer.title, body: a.offer.body, cta: a.offer.cta, badge: badge || t('studio.badgeDefault'), photo: '', caption: `${a.post.text}\n\n→ ${a.post.cta}`, hashtags: hashtags().join(' ') },
    stickers: [
      defaultSticker({ top: name.toUpperCase(), center: (a.merch.stickerText || '').split(/\s+/).slice(0, 2).join(' ').slice(0, 12) || 'HELLO', bottom: `${city().toUpperCase()} · ${new Date().getFullYear()}`, icon: b.category === 'salon' ? 'scissors' : b.category === 'shop' ? 'bag' : b.category === 'restaurant' ? 'fork' : 'coffee' }),
      defaultSticker({ shape: 'scallop', palette: 'sunset', font: 'bold', icon: 'percent', top: t('studio.stOffer').toUpperCase(), center: (badge || '-20%').toUpperCase(), bottom: name.toUpperCase(), ring: 'dotted' }),
      defaultSticker({ shape: 'bubble', palette: 'mint', font: 'hand', icon: 'heart', top: t('studio.stThanks'), center: '', bottom: `@${b.instagram || slugify(name)}`, ring: 'none', inner: false }),
    ],
    active: null, plan: { done: {} }, saved: Date.now(),
  };
}
function hashtags() {
  const b = getBiz(); const c = slugify(city()).replace(/-/g, ''); const n = slugify(displayName()).replace(/-/g, '');
  return [...new Set([c && `#${c}`, n && `#${n}`, ...ta(`studio.tags.${b.category}`).map((x) => `#${x}${c && x.length < 8 ? c : ''}`), ...ta(`studio.tags.${b.category}`).map((x) => `#${x}`), '#local'].filter(Boolean))].slice(0, 9);
}
const studio = () => { let s = getState().studio; if (!s?.offer) { s = seed(); update({ studio: s }); } return s; };
const setStudio = (fn) => update((st) => ({ studio: { ...(st.studio || seed()), ...fn(st.studio || seed()) } }));
const activeSticker = () => { const s = studio(); return s.stickers.find((x) => x.id === s.active) || s.stickers[0]; };
const exportGate = () => (can('pack') ? true : (upgradePrompt('pack'), false));
const fileBase = () => slugify(displayName() || 'arcton') || 'arcton';

/* ---------- small controls ---------- */
const field = (label, k, v, { area = false, max = 160, rows = 3, attr = 'st', hint = '' } = {}) => html`<label class="field"><span>${label}${area ? '' : html` <small class="count">${String(v || '').length}/${max}</small>`}</span>
  ${area ? html`<textarea data-in="${attr}" data-k="${k}" maxlength="${max}" rows="${rows}">${v || ''}</textarea>` : html`<input type="text" data-in="${attr}" data-k="${k}" maxlength="${max}" value="${v || ''}">`}${hint ? html`<small class="muted">${hint}</small>` : ''}</label>`;
const chips = (attr, k, opts, cur, label = (o) => t(`studio.${k}.${o}`)) => html`<div class="chips" role="group">${opts.map((o) => html`<button type="button" class="chip ${cur === o ? 'on' : ''}" aria-pressed="${cur === o}" data-act="${attr}" data-k="${k}" data-v="${o}">${label(o)}</button>`)}</div>`;
const swatches = (attr, cur) => html`<div class="swatches" role="group" aria-label="${t('studio.palette')}">${PALETTE_IDS.map((p) => html`<button type="button" class="sw ${cur === p ? 'on' : ''}" aria-pressed="${cur === p}" data-act="${attr}" data-k="palette" data-v="${p}" title="${t(`studio.pal.${p}`)}"><i style="background:${PALETTES[p][0]}"></i><i style="background:${PALETTES[p][1]}"></i><i style="background:${PALETTES[p][3]}"></i><span>${t(`studio.pal.${p}`)}</span></button>`)}</div>`;
const group = (title, body, extra = '') => html`<section class="ctl-group"><h3>${title}${extra}</h3>${body}</section>`;

/* ---------- tabs ---------- */
function offerTab() {
  const o = studio().offer; const name = displayName();
  return html`<div class="studio-grid">
    <div class="studio-ctl card">
      ${group(t('studio.h.offer'), html`${field(t('studio.offerTitle'), 'title', o.title, { attr: 'st-offer', max: 80 })}${field(t('studio.offerBody'), 'body', o.body, { attr: 'st-offer', area: true, max: 280 })}
        <div class="field-pair">${field(t('studio.cta'), 'cta', o.cta, { attr: 'st-offer', max: 32 })}${field(t('studio.badge'), 'badge', o.badge, { attr: 'st-offer', max: 9, hint: t('studio.badgeHint') })}</div>
        <div class="field-pair">${field(t('studio.until'), 'until', o.until, { attr: 'st-offer', max: 40 })}${field(t('studio.terms'), 'terms', o.terms, { attr: 'st-offer', max: 120 })}</div>`)}
      ${group(t('studio.h.useIt'), html`<div class="btn-grid">
        <button class="btn btn-secondary" data-act="offer-to-site">${icon('website', 16)} ${t('studio.toSite')}</button>
        <button class="btn btn-secondary" data-act="offer-to-post">${icon('share', 16)} ${t('studio.toPost')}</button>
        <button class="btn btn-secondary" data-act="offer-to-sticker">${icon('star', 16)} ${t('studio.toSticker')}</button>
        <button class="btn btn-secondary" data-act="offer-copy">${icon('copy', 16)} ${t('actions.copy')}</button></div>`)}
      <div class="btn-row"><button class="btn btn-ghost btn-sm" data-act="regen-asset" data-kind="offer">${icon('refresh', 15)} ${t('studio.newVariant')}</button></div>
    </div>
    <div class="studio-stage">
      <article class="offer-card">
        <span class="oc-badge">${o.badge}</span>
        <p class="oc-name">${name}</p><h2>${o.title}</h2><p>${o.body}</p>
        <div class="oc-foot"><span class="oc-cta">${o.cta} ${icon('next', 16)}</span>${o.until ? html`<small>${t('studio.validUntil', { d: o.until })}</small>` : ''}</div>
        ${o.terms ? html`<p class="oc-terms">${o.terms}</p>` : ''}
      </article>
      <p class="muted small">${icon('info', 14)} ${t('studio.offerTip')}</p>
    </div></div>`;
}

function postTab() {
  const p = studio().post; const b = getBiz();
  const g = getState().signals?.google; const best = (g?.reviews || []).filter((r) => r.rating >= 5 && r.text).sort((a, z) => a.text.length - z.text.length)[0];
  const data = postData(p, best);
  return html`<div class="studio-grid">
    <div class="studio-ctl card">
      ${group(t('studio.h.format'), chips('st-post-set', 'format', Object.keys(FORMATS), p.format))}
      ${group(t('studio.h.layout'), chips('st-post-set', 'layout', LAYOUTS, p.layout))}
      ${p.layout === 'quote' && !best ? html`<p class="callout small">${icon('info', 15)} ${t('studio.noQuote')}</p>` : ''}
      ${group(t('studio.h.palette'), swatches('st-post-set', p.palette))}
      ${group(t('studio.h.font'), chips('st-post-set', 'font', FONT_IDS, p.font, (f) => html`<span style="font-family:${raw(FONTS[f])}">${t(`studio.font.${f}`)}</span>`))}
      ${group(t('studio.h.text'), html`${p.layout === 'quote' ? '' : field(t('studio.headline'), 'headline', p.headline, { attr: 'st-post', max: 70 })}
        ${p.layout === 'quote' ? '' : field(t('studio.body'), 'body', p.body, { attr: 'st-post', area: true, max: 160, rows: 2 })}
        <div class="field-pair">${field(t('studio.cta'), 'cta', p.cta, { attr: 'st-post', max: 26 })}${p.layout === 'offer' ? field(t('studio.badge'), 'badge', p.badge, { attr: 'st-post', max: 9 }) : ''}</div>`)}
      ${p.layout === 'photo' ? group(t('studio.h.photo'), html`${photos().length ? html`<div class="photo-pick">${photos().map((u) => html`<button type="button" class="${p.photo === u ? 'on' : ''}" data-act="st-post-set" data-k="photo" data-v="${u}"><img src="${u}" alt=""></button>`)}</div>` : html`<p class="muted small">${t('studio.noPhotos')}</p>`}
        <button class="btn btn-secondary btn-sm" data-act="st-post-photo">${icon('upload', 15)} ${t('studio.uploadPhoto')}</button>`) : ''}
    </div>
    <div class="studio-stage">
      <div class="post-frame fmt-${p.format}">
        <div class="pf-head"><i></i><div><b>${b.instagram ? `@${b.instagram}` : displayName()}</b><small>${t('studio.sponsoredNot')}</small></div></div>
        <div class="pf-img">${raw(postSvg(data, { width: 520 }))}</div>
        <div class="pf-cap"><b>${b.instagram || slugify(displayName())}</b> ${p.caption.slice(0, 140)}${p.caption.length > 140 ? '…' : ''}</div></div>
      <div class="btn-row">
        <button class="btn btn-primary" data-act="post-png">${icon('download', 16)} PNG ${FORMATS[p.format].join('×')} ${can('pack') ? '' : lockBadge('pack')}</button>
        <button class="btn btn-secondary" data-act="post-svg">${icon('download', 16)} SVG</button>
        <button class="btn btn-ghost" data-act="tab-words">${icon('copy', 16)} ${t('studio.editCaption')}</button></div>
      <p class="muted small">${icon('info', 14)} ${t('studio.postTip')}</p>
    </div></div>`;
}
function photos() {
  const s = getState().site || {}; const out = [];
  (s.sections || []).forEach((x) => { if (x.image) out.push(x.image); (x.images || []).forEach((g) => out.push(g.url)); });
  if (s.seo?.image) out.push(s.seo.image); if (getState().studio?.post?.upload) out.push(getState().studio.post.upload);
  return [...new Set(out)].slice(0, 12);
}
function postData(p, best) {
  return { ...p, name: displayName(), handle: getBiz().instagram, quote: best?.text, author: best?.author, stars: best?.rating,
    headline: p.layout === 'quote' ? (best ? `${best.text.slice(0, 150)}${best.text.length > 150 ? '…' : ''}` : t('studio.noQuote')) : p.headline, body: p.layout === 'quote' ? '' : p.body };
}

function stickersTab() {
  const s = studio(); const d = activeSticker(); const col = stickerColors(d);
  const colorRow = (k) => html`<label class="color-mini"><input type="color" data-in="st-color" data-k="${k}" value="${col[k]}"><span>${t(`studio.col.${k}`)}</span></label>`;
  return html`<div class="studio-grid sticker-grid">
    <div class="studio-ctl card">
      ${group(t('studio.h.shape'), html`<div class="shape-pick">${SHAPES.map((sh) => html`<button type="button" class="${d.shape === sh ? 'on' : ''}" aria-pressed="${d.shape === sh}" data-act="st-set" data-k="shape" data-v="${sh}" title="${t(`studio.shape.${sh}`)}">${raw(stickerSvg({ ...d, shape: sh, top: '', bottom: '', center: '', icon: 'none', inner: false }, { size: 40, uid: `sh-${sh}` }))}<span>${t(`studio.shape.${sh}`)}</span></button>`)}</div>`)}
      ${group(t('studio.h.text'), html`${field(t('studio.top'), 'top', d.top, { attr: 'st-text', max: 28 })}${field(t('studio.center'), 'center', d.center, { attr: 'st-text', max: 14 })}${field(t('studio.bottom'), 'bottom', d.bottom, { attr: 'st-text', max: 30 })}
        ${chips('st-set', 'font', FONT_IDS, d.font, (f) => html`<span style="font-family:${raw(FONTS[f])}">${t(`studio.font.${f}`)}</span>`)}`)}
      ${group(t('studio.h.icon'), html`<div class="icon-pick">${ICON_IDS.map((ic) => html`<button type="button" class="${d.icon === ic ? 'on' : ''}" aria-pressed="${d.icon === ic}" data-act="st-set" data-k="icon" data-v="${ic}" title="${t(`studio.icon.${ic}`)}">${ic === 'none' ? html`<span>∅</span>` : raw(`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[ic]}</svg>`)}</button>`)}</div>`)}
      ${group(t('studio.h.colours'), html`${swatches('st-set', d.palette)}<div class="color-row-mini">${['bg', 'ring', 'text', 'icon', 'inner'].map(colorRow)}</div>
        ${d.colors ? html`<button class="link-btn" data-act="st-colors-reset">${t('studio.resetColours')}</button>` : ''}`)}
      ${group(t('studio.h.details'), html`${chips('st-set', 'ring', RINGS, d.ring)}
        <label class="check"><input type="checkbox" data-in="st-inner" ${d.inner ? 'checked' : ''}><span>${t('studio.innerDisc')}</span></label>
        <label class="field range"><span>${t('studio.rotate')} <small>${d.rotate}°</small></span><input type="range" min="-30" max="30" step="1" value="${d.rotate}" data-in="st-range" data-k="rotate"></label>`)}
    </div>
    <div class="studio-stage">
      <div class="sticker-stage" style="--stc:${col.bg}">${raw(stickerSvg(d, { size: 320, uid: 'main' }))}</div>
      <div class="btn-row">
        <button class="btn btn-primary" data-act="st-png">${icon('download', 16)} PNG ${can('pack') ? '' : lockBadge('pack')}</button>
        <button class="btn btn-secondary" data-act="st-svg">${icon('download', 16)} SVG</button>
        <button class="btn btn-secondary" data-act="st-dup">${icon('copy', 16)} ${t('studio.duplicate')}</button>
        <button class="btn btn-ghost" data-act="st-random">${icon('sparkle', 16)} ${t('studio.surprise')}</button></div>
      <div class="print-box card"><div><b>${t('studio.printTitle')}</b><p class="muted small">${t('studio.printBody', { n: Math.floor(19 / (printCm + 0.4)) * Math.floor(27.7 / (printCm + 0.4)) })}</p></div>
        ${chips('st-cm', 'cm', ['4', '5', '6', '8', '10'], String(printCm), (c) => `${c} cm`)}
        <div class="btn-row"><button class="btn btn-secondary btn-sm" data-act="st-print" data-all="0">${icon('download', 15)} ${t('studio.printThis')}</button><button class="btn btn-ghost btn-sm" data-act="st-print" data-all="1">${t('studio.printAll')}</button></div></div>
      <h3 class="pan-h">${t('studio.myStickers', { n: s.stickers.length })}</h3>
      <div class="st-gallery">${s.stickers.map((x) => html`<div class="st-item ${x.id === d.id ? 'on' : ''}"><button type="button" data-act="st-pick" data-id="${x.id}" aria-label="${t('studio.edit')}">${raw(stickerSvg(x, { size: 96, uid: `g-${x.id}` }))}</button>
        ${s.stickers.length > 1 ? html`<button type="button" class="icon-btn st-del" data-act="st-del" data-id="${x.id}" aria-label="${t('bld.remove')}">${icon('x', 14)}</button>` : ''}</div>`)}
        ${s.stickers.length < 12 ? html`<button type="button" class="st-add" data-act="st-new">${icon('plus', 22)}<span>${t('studio.newSticker')}</span></button>` : ''}</div>
      <h3 class="pan-h">${t('studio.templates')}</h3>
      <div class="st-templates">${TEMPLATES().map((tp, i) => html`<button type="button" data-act="st-template" data-i="${i}" title="${t(`studio.tpl.${tp.k}`)}">${raw(stickerSvg(tp.d, { size: 76, uid: `tp${i}` }))}<span>${t(`studio.tpl.${tp.k}`)}</span></button>`)}</div>
    </div></div>`;
}
const TEMPLATES = () => { const n = displayName().toUpperCase(); const c = city().toUpperCase(); const ig = getBiz().instagram;
  return [
    { k: 'loyalty', d: defaultSticker({ shape: 'circle', palette: 'coffee', font: 'classic', icon: 'coffee', top: n, center: '10 = 1', bottom: t('studio.tplLoyalty').toUpperCase(), ring: 'double' }) },
    { k: 'review', d: defaultSticker({ shape: 'star', palette: 'night', font: 'bold', icon: 'star', top: t('studio.tplReviewTop').toUpperCase(), center: '★★★★★', bottom: n, ring: 'none' }) },
    { k: 'insta', d: defaultSticker({ shape: 'square', palette: 'candy', font: 'modern', icon: 'camera', top: t('studio.tplInsta'), center: '', bottom: ig ? `@${ig}` : n, ring: 'solid' }) },
    { k: 'local', d: defaultSticker({ shape: 'hexagon', palette: 'mint', font: 'bold', icon: 'pin', top: t('studio.tplLocal').toUpperCase(), center: c.slice(0, 12), bottom: n, ring: 'dashed' }) },
    { k: 'gift', d: defaultSticker({ shape: 'ticket', palette: 'sunset', font: 'bold', icon: 'gift', top: t('studio.tplGift').toUpperCase(), center: '-10%', bottom: n, ring: 'dotted', inner: false }) },
    { k: 'new', d: defaultSticker({ shape: 'scallop', palette: 'aurora', font: 'hand', icon: 'sparkle', top: t('studio.tplNew').toUpperCase(), center: 'NEW', bottom: n, ring: 'solid' }) },
  ]; };

function wordsTab() {
  const a = getAssets() || ensureAssetsSync(); const p = studio().post; const max = 2200; const full = `${p.caption}\n\n${p.hashtags}`;
  return html`<div class="studio-grid">
    <div class="studio-ctl card">
      ${group(t('studio.h.caption'), html`<label class="field"><span>${t('studio.caption')} <small class="count ${full.length > max ? 'over' : ''}">${full.length}/${max}</small></span><textarea data-in="st-post" data-k="caption" rows="7" maxlength="2000">${p.caption}</textarea></label>
        <div class="emoji-row">${['✨', '☕', '🥐', '❤️', '📍', '🎉', '👉', '🔥', '🌿', '⭐'].map((e) => html`<button type="button" data-act="st-emoji" data-e="${e}" aria-label="${e}">${e}</button>`)}</div>
        <label class="field"><span>${t('studio.hashtags')}</span><input type="text" data-in="st-post" data-k="hashtags" value="${p.hashtags}" maxlength="300"></label>
        <div class="btn-row"><button class="btn btn-primary btn-sm" data-act="caption-copy">${icon('copy', 15)} ${t('studio.copyCaption')}</button><button class="btn btn-ghost btn-sm" data-act="tags-reset">${icon('refresh', 15)} ${t('studio.tagsAgain')}</button><button class="btn btn-ghost btn-sm" data-act="regen-asset" data-kind="post">${icon('sparkle', 15)} ${t('studio.newVariant')}</button></div>`)}
    </div>
    <div class="studio-stage">
      <section class="card words-card"><h3>${t('pack.headlines')}</h3>
        <ol class="hl-list">${a.headlines.map((h, i) => html`<li><span>${h}</span><div class="btn-row"><button class="btn btn-ghost btn-sm" data-act="hl-copy" data-i="${i}">${icon('copy', 14)}</button><button class="btn btn-ghost btn-sm" data-act="hl-site" data-i="${i}" title="${t('studio.useOnSite')}">${icon('website', 14)}</button><button class="btn btn-ghost btn-sm" data-act="hl-post" data-i="${i}" title="${t('studio.useOnPost')}">${icon('share', 14)}</button></div></li>`)}</ol>
        <button class="btn btn-ghost btn-sm" data-act="regen-asset" data-kind="headlines">${icon('refresh', 15)} ${t('studio.newVariant')}</button></section>
      <section class="card words-card"><h3>${t('pack.merch')}</h3><p>${a.merch.concept}</p>
        <button class="btn btn-secondary btn-sm" data-act="tab-stickers">${icon('star', 15)} ${t('studio.designIt')}</button></section>
      <p class="muted small">${icon('info', 14)} ${t('pack.noAutoPublish')}</p>
    </div></div>`;
}

const PLAN = [['post', 'share', 'post'], ['story', 'camera', 'post'], ['replies', 'reply', 'reviews'], ['stickers', 'star', 'stickers'], ['quote', 'star', 'post'], ['weekend', 'calendar', 'post'], ['measure', 'proof', null]];
function planTab() {
  const done = studio().plan?.done || {}; const n = PLAN.filter((_, i) => done[i]).length;
  const day = (i) => { const d = new Date(); d.setDate(d.getDate() + i); return new Intl.DateTimeFormat(siteLang(), { weekday: 'short', day: 'numeric', month: 'short' }).format(d); };
  return html`<div class="plan-head card"><div><h2>${t('studio.planTitle')}</h2><p class="muted">${t('studio.planBody')}</p></div>
      <div class="plan-prog"><b>${n}/7</b><span class="bar"><i style="width:${(n / 7) * 100}%"></i></span></div>
      <button class="btn btn-secondary btn-sm" data-act="plan-ics">${icon('calendar', 15)} ${t('studio.addCalendar')}</button></div>
    <ol class="week">${PLAN.map(([k, ic, go], i) => html`<li class="${done[i] ? 'done' : ''}">
      <label class="wk-check"><input type="checkbox" data-in="plan-done" data-i="${i}" ${done[i] ? 'checked' : ''}><span class="sr-only">${t('studio.markDone')}</span></label>
      <span class="wk-day">${day(i)}</span><span class="wk-ic">${icon(ic, 18)}</span>
      <div><b>${t(`studio.plan.${k}`)}</b><p>${t(`studio.plan.${k}Body`)}</p></div>
      ${go ? html`<button class="btn btn-ghost btn-sm" data-act="tab-${go}">${t('common.open')} ${icon('next', 14)}</button>` : html`<a class="btn btn-ghost btn-sm" href="#/proof">${t('common.open')} ${icon('next', 14)}</a>`}</li>`)}</ol>`;
}

export const pack = {
  id: 'pack',
  render() {
    const a = getAssets();
    const head = pageHead({ title: t('studio.title'), sub: t('studio.sub'),
      actions: html`<button class="btn btn-primary" data-act="gen-assets" ${busy ? 'disabled' : ''}>${busy ? html`<i class="spin"></i>` : icon('sparkle', 18)} ${a ? t('actions.regenerateAll') : t('actions.generateAssets')} ${can('pack') ? '' : lockBadge('pack')}</button>` });
    studio();
    const body = { offer: offerTab, post: postTab, stickers: stickersTab, words: wordsTab, plan: planTab, reviews: () => html`<div class="tools-row">${repliesSection()}${posterSection()}</div>` }[tab]();
    return html`${head}
      <div class="engine-bar ${a?.mode === 'ai' ? 'is-ai' : 'is-local'}" role="status"><span class="engine-dot" aria-hidden="true"></span><span class="engine-text">${t(a?.mode === 'ai' ? 'pack.modeAi' : 'studio.modeLocal')}</span></div>
      <nav class="studio-tabs" role="tablist">${TABS.map(([k, ic]) => html`<button role="tab" aria-selected="${tab === k}" data-act="studio-tab" data-tab="${k}">${icon(ic, 17)}<span>${t(`studio.tab.${k}`)}</span></button>`)}</nav>
      <div class="studio-body">${body}</div>`;
  },
};

/* ---------- actions ---------- */
actions['studio-tab'] = (el) => { tab = el.dataset.tab; rerender(); };
['offer', 'post', 'stickers', 'words', 'plan', 'reviews'].forEach((k) => { actions[`tab-${k}`] = () => { tab = k; rerender(); window.scrollTo({ top: 0 }); }; });
actions['gen-assets'] = async () => {
  if (needSignals()) return;
  if (!can('pack')) return upgradePrompt('pack');
  busy = true; rerender();
  const mode = await runAssets(); busy = false;
  if (getState().studio && await confirmDialog(t('studio.refillTitle'), t('studio.refillBody'), t('studio.refill'))) update({ studio: { ...seed(), stickers: getState().studio.stickers } });
  toast(mode === 'ai' ? t('pack.toastAi') : t('pack.toastLocal'), mode === 'ai' ? 'success' : 'info'); rerender();
};
actions['regen-asset'] = (el) => {
  ensureAssetsSync(); regenAsset(el.dataset.kind); const a = getAssets(); const k = el.dataset.kind;
  if (k === 'offer') setStudio((s) => ({ offer: { ...s.offer, title: a.offer.title, body: a.offer.body, cta: a.offer.cta } }));
  if (k === 'post') setStudio((s) => ({ post: { ...s.post, caption: `${a.post.text}\n\n→ ${a.post.cta}` } }));
  rerender(); toast(t('pack.toastRegen'), 'success');
};

// offer
inputs['st-offer'] = (el) => setStudio((s) => ({ offer: { ...s.offer, [el.dataset.k]: limit(el.value, 300) } }));
document.addEventListener('input', (e) => { if (e.target.matches?.('[data-in="st-offer"],[data-in="st-post"],[data-in="st-text"]') && document.body.dataset.route === 'pack') { clearTimeout(repaintT); repaintT = setTimeout(() => repaintKeep(e.target), 220); } });
let repaintT;
function repaintKeep(el) { const k = el.dataset.k; const at = el.dataset.in; const pos = el.selectionStart; rerender(); const n = $(`[data-in="${at}"][data-k="${k}"]`); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch { /* ignore */ } } }
const offerText = () => { const o = studio().offer; return `${o.title}\n${o.body}${o.until ? `\n${t('studio.validUntil', { d: o.until })}` : ''}\n→ ${o.cta}${o.terms ? `\n${o.terms}` : ''}`; };
actions['offer-copy'] = async () => { const ok = await copyText(offerText()); toast(ok ? t('common.copied') : t('common.copyFailed'), ok ? 'success' : 'error'); };
actions['offer-to-site'] = () => {
  const site = getState().site; const o = studio().offer;
  if (!site?.generated) { toast(t('studio.siteFirst'), 'info'); return; }
  const secs = [...site.sections]; let off = secs.find((x) => x.type === 'offer');
  if (!off) { off = { id: `offer-${Date.now().toString(36)}`, type: 'offer', on: true, title: '', label: '', text: '', until: '' }; secs.splice(Math.max(1, secs.findIndex((x) => x.type === 'booking')), 0, off); }
  update({ site: { ...site, sections: secs.map((x) => (x.id === off.id ? { ...x, on: true, title: o.title, text: o.body, until: o.until, label: o.badge || x.label } : x)) } });
  toast(t('studio.onSite'), 'success');
};
actions['offer-to-post'] = () => { const o = studio().offer; setStudio((s) => ({ post: { ...s.post, layout: 'offer', headline: o.title, body: o.body, cta: o.cta, badge: o.badge } })); tab = 'post'; rerender(); };
actions['offer-to-sticker'] = () => { const o = studio().offer; const d = defaultSticker({ shape: 'scallop', palette: 'sunset', icon: 'percent', top: displayName().toUpperCase(), center: (o.badge || 'OFFER').toUpperCase(), bottom: o.title.toUpperCase().slice(0, 28), ring: 'dotted' }); setStudio((s) => ({ stickers: [...s.stickers, d].slice(-12), active: d.id })); tab = 'stickers'; rerender(); };

// post
inputs['st-post'] = (el) => setStudio((s) => ({ post: { ...s.post, [el.dataset.k]: limit(el.value, 2000) } }));
actions['st-post-set'] = (el) => { setStudio((s) => ({ post: { ...s.post, [el.dataset.k]: el.dataset.v } })); rerender(); };
actions['st-post-photo'] = async () => {
  const { addPhotos } = await import('../images.js'); const r = await addPhotos('hero', { multiple: false });
  if (r.photos[0]) { setStudio((s) => ({ post: { ...s.post, photo: r.photos[0].url, upload: r.photos[0].url } })); rerender(); }
};
const currentPostSvg = async (w) => { const p = studio().post; const g = getState().signals?.google; const best = (g?.reviews || []).filter((r) => r.rating >= 5 && r.text).sort((a, z) => a.text.length - z.text.length)[0];
  const d = postData(p, best); if (d.layout === 'photo' && d.photo) d.photo = await inlinePhoto(d.photo); return postSvg(d, { width: w }); };
actions['post-png'] = async () => { if (!exportGate()) return; try { await downloadPng(`${fileBase()}-post-${studio().post.format}.png`, await currentPostSvg(1080), 1080); toast(t('studio.saved'), 'success'); } catch { toast(t('studio.pngFail'), 'error'); } };
actions['post-svg'] = async () => { if (!exportGate()) return; downloadText(`${fileBase()}-post.svg`, await currentPostSvg(1080)); };
actions['caption-copy'] = async () => { const p = studio().post; const ok = await copyText(`${p.caption}\n\n${p.hashtags}`.trim()); toast(ok ? t('common.copied') : t('common.copyFailed'), ok ? 'success' : 'error'); };
actions['tags-reset'] = () => { setStudio((s) => ({ post: { ...s.post, hashtags: hashtags().join(' ') } })); rerender(); };
actions['st-emoji'] = (el) => { const ta_ = $('[data-in="st-post"][data-k="caption"]'); const pos = ta_?.selectionStart ?? studio().post.caption.length; setStudio((s) => ({ post: { ...s.post, caption: s.post.caption.slice(0, pos) + el.dataset.e + s.post.caption.slice(pos) } })); rerender(); };
actions['hl-copy'] = async (el) => { const ok = await copyText(getAssets().headlines[+el.dataset.i]); toast(ok ? t('common.copied') : t('common.copyFailed'), ok ? 'success' : 'error'); };
actions['hl-post'] = (el) => { setStudio((s) => ({ post: { ...s.post, headline: getAssets().headlines[+el.dataset.i] } })); tab = 'post'; rerender(); };
actions['hl-site'] = (el) => {
  const site = getState().site; if (!site?.generated) return toast(t('studio.siteFirst'), 'info');
  update({ site: { ...site, sections: site.sections.map((x) => (x.type === 'hero' ? { ...x, headline: getAssets().headlines[+el.dataset.i] } : x)) } }); toast(t('studio.onSite'), 'success');
};

// stickers
const setSticker = (fn) => setStudio((s) => { const cur = (s.stickers.find((x) => x.id === s.active) || s.stickers[0]).id; return { active: cur, stickers: s.stickers.map((x) => (x.id === cur ? { ...x, ...fn(x) } : x)) }; });
actions['st-set'] = (el) => { const k = el.dataset.k; const v = el.dataset.v; setSticker(() => (k === 'palette' ? { palette: v, colors: null } : { [k]: v })); rerender(); };
inputs['st-text'] = (el) => setSticker(() => ({ [el.dataset.k]: limit(el.value, 30) }));
inputs['st-color'] = (el) => { setSticker((x) => ({ colors: { ...stickerColors(x), [el.dataset.k]: el.value } })); const st = $('.sticker-stage'); if (st) st.innerHTML = stickerSvg(activeSticker(), { size: 320, uid: 'main' }); };
document.addEventListener('change', (e) => { if (e.target.matches?.('[data-in="st-color"]') && document.body.dataset.route === 'pack') rerender(); });
inputs['st-inner'] = (el) => { setSticker(() => ({ inner: el.checked })); rerender(); };
inputs['st-range'] = (el) => { setSticker(() => ({ [el.dataset.k]: Number(el.value) })); const st = $('.sticker-stage'); if (st) st.innerHTML = stickerSvg(activeSticker(), { size: 320, uid: 'main' }); };
actions['st-colors-reset'] = () => { setSticker(() => ({ colors: null })); rerender(); };
actions['st-pick'] = (el) => { setStudio(() => ({ active: el.dataset.id })); rerender(); };
actions['st-new'] = () => { const d = defaultSticker({ top: displayName().toUpperCase(), bottom: city().toUpperCase(), center: '' }); setStudio((s) => ({ stickers: [...s.stickers, d], active: d.id })); rerender(); };
actions['st-dup'] = () => { const s = studio(); if (s.stickers.length >= 12) return toast(t('studio.max'), 'info'); const d = { ...activeSticker(), id: defaultSticker().id }; setStudio((x) => ({ stickers: [...x.stickers, d], active: d.id })); rerender(); };
actions['st-del'] = (el) => { setStudio((s) => ({ stickers: s.stickers.filter((x) => x.id !== el.dataset.id), active: s.active === el.dataset.id ? null : s.active })); rerender(); };
actions['st-template'] = (el) => { const tp = TEMPLATES()[+el.dataset.i]; if (!tp) return; const d = { ...tp.d, id: defaultSticker().id }; setStudio((s) => ({ stickers: [...s.stickers, d].slice(-12), active: d.id })); rerender(); };
actions['st-random'] = () => { const r = (a) => a[Math.floor(Math.random() * a.length)]; setSticker(() => ({ shape: r(SHAPES), palette: r(PALETTE_IDS), font: r(FONT_IDS), icon: r(ICON_IDS.filter((x) => x !== 'none')), ring: r(RINGS), colors: null, rotate: r([-8, -4, 0, 0, 4, 8]) })); rerender(); };
actions['st-png'] = async () => { if (!exportGate()) return; try { await downloadPng(`${fileBase()}-sticker.png`, stickerSvg(activeSticker(), { size: 200, uid: 'exp' }), 2000); toast(t('studio.saved'), 'success'); } catch { toast(t('studio.pngFail'), 'error'); } };
actions['st-svg'] = () => { if (!exportGate()) return; downloadText(`${fileBase()}-sticker.svg`, stickerSvg(activeSticker(), { size: 1000, uid: 'exp' })); };
actions['st-cm'] = (el) => { printCm = Number(el.dataset.v); rerender(); };
actions['st-print'] = (el) => { if (!exportGate()) return; printSheet(el.dataset.all === '1' ? studio().stickers : [activeSticker()], printCm); };

// plan
inputs['plan-done'] = (el) => { setStudio((s) => ({ plan: { done: { ...(s.plan?.done || {}), [el.dataset.i]: el.checked } } })); rerender(); };
actions['plan-ics'] = () => {
  const pad = (n) => String(n).padStart(2, '0'); const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const ev = PLAN.map(([k], i) => { const d = new Date(); d.setDate(d.getDate() + i); const e = new Date(d); e.setDate(e.getDate() + 1);
    const tx = (s) => String(s).replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
    return `BEGIN:VEVENT\r\nUID:arcton-${ymd(d)}-${i}@arcton.ai\r\nDTSTAMP:${ymd(new Date())}T090000Z\r\nDTSTART;VALUE=DATE:${ymd(d)}\r\nDTEND;VALUE=DATE:${ymd(e)}\r\nSUMMARY:${tx(t(`studio.plan.${k}`))}\r\nDESCRIPTION:${tx(t(`studio.plan.${k}Body`))}\r\nEND:VEVENT`; });
  downloadText(`${fileBase()}-7-day-plan.ics`, `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Arcton Ai//Action Studio//EN\r\n${ev.join('\r\n')}\r\nEND:VCALENDAR\r\n`, 'text/calendar');
};
