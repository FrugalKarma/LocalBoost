import { html, icon, toast, copyText, downloadBlob, confirmDialog, sleep, $, limit } from '../core.js';
import { t, getLang, LANGS } from '../i18n.js';
import { getState, update, updateSite, defaultSite } from '../store.js';
import { runBuilder } from '../ai.js';
import { resolveCopy, resolveDoc, shareUrl, exportZip, exportHtml, exportPitchCard, PREVIEW_PATH } from '../website.js';
import { buildDocument, sectionList, THEMES, LAYOUTS, FONTS_LIST, RADII, THEME_ACCENT } from '../siteTemplate.js';
import { actions, inputs, rerender } from '../registry.js';
import { pageHead, aiNotice } from './shared.js';
import { needSignals } from '../collect.js';

const ACCENTS = ['#F59E0B', '#14B8A6', '#2563EB', '#EF4444', '#8B5CF6', '#10B981'];
let device = 'desktop';
let busy = null; // 'gen' | 'hero' | 'offer' | 'faq'

const field = (label, name, value, { area = false, max = 200 } = {}) => html`<label class="field"><span>${label}</span>
  ${area ? html`<textarea data-in="site-field" data-field="${name}" maxlength="${max}" rows="3">${value}</textarea>`
    : html`<input type="text" data-in="site-field" data-field="${name}" maxlength="${max}" value="${value}">`}</label>`;

export function refreshPreview() {
  const f = $('#site-frame');
  if (f) f.srcdoc = buildDocument(resolveDoc());
}
let timer;
const refreshSoon = () => { clearTimeout(timer); timer = setTimeout(refreshPreview, 140); };

export const website = {
  id: 'website',
  render() {
    const site = getState().site;
    const head = pageHead({ note: '05', title: t('website.title'), sub: t('website.sub'),
      actions: site.generated ? html`<button class="btn btn-primary" data-act="present-site">${icon('present', 18)} ${t('actions.presentWebsite')}</button>` : '' });
    if (!site.generated) {
      return html`${head}<section class="card empty-hero"><div class="empty-ic">${icon('website', 34)}</div><h2>${t('website.emptyTitle')}</h2><p class="muted">${t('website.emptyBody')}</p>
        <button class="btn btn-primary btn-lg" data-act="gen-site" ${busy ? 'disabled' : ''}>${busy === 'gen' ? html`<i class="spin"></i> ${t('website.generating')}` : html`${icon('sparkle', 18)} ${t('actions.generateWebsite')}`}</button></section>`;
    }
    const c = resolveCopy(); const lang = c.lang;
    const rb = (sec) => html`<button class="btn btn-ghost btn-sm" data-act="regen" data-section="${sec}" ${busy ? 'disabled' : ''}>${busy === sec ? html`<i class="spin"></i>` : icon('refresh', 15)} ${t('website.regen')} · ${t(`website.sec_${sec}`)}</button>`;
    return html`${head}${aiNotice()}
    <div class="site-toolbar">
      <div class="seg" role="group" aria-label="${t('website.device')}">${['desktop', 'tablet', 'phone'].map((d) => html`<button aria-pressed="${device === d}" data-act="device" data-device="${d}">${t(`website.${d}`)}</button>`)}</div>
      <div class="urlbar mono" title="${t('website.internalUrl')}">${icon('globe', 15)} ${PREVIEW_PATH}</div>
      <div class="btn-row">
        <button class="btn btn-secondary btn-sm" data-act="share-site">${icon('share', 16)} ${t('actions.share')}</button>
        <button class="btn btn-secondary btn-sm" data-act="open-public">${icon('external', 16)} ${t('actions.openPublic')}</button>
        <button class="btn btn-secondary btn-sm" data-act="export-zip">${icon('download', 16)} ZIP</button>
        <button class="btn btn-ghost btn-sm" data-act="export-html">HTML</button>
        <button class="btn btn-ghost btn-sm" data-act="export-card">${icon('download', 16)} PNG</button>
        <button class="btn btn-ghost btn-sm" data-act="reset-site">${icon('trash', 16)} ${t('actions.reset')}</button>
      </div>
    </div>
    <div class="site-layout">
      <div class="preview-stage"><div class="device device-${device}"><iframe id="site-frame" title="${t('website.previewTitle')}" sandbox="allow-scripts allow-forms"></iframe></div>
        <p class="muted small">${t('website.previewNote')}</p></div>
      <aside class="card controls" aria-label="${t('website.controls')}">
        <h2 class="card-title">${t('website.controls')}</h2>
        ${field(t('website.headline'), 'headline', c.headline, { max: 110 })}
        ${field(t('website.subheadline'), 'sub', c.sub, { area: true, max: 240 })}
        ${field(t('website.cta'), 'cta', c.cta, { max: 40 })}
        <div class="field"><span>${t('website.accent')}</span><div class="swatches">${ACCENTS.map((a) => html`<button class="swatch" style="background:${a}" aria-label="${a}" aria-pressed="${site.accent === a}" data-act="accent" data-color="${a}"></button>`)}
          <input type="color" data-in="site-accent" value="${site.accent}" aria-label="${t('website.accent')}"></div></div>
        <label class="field"><span>${t('website.layout')}</span><select data-in="site-select" data-field="layout">${LAYOUTS.map((l) => html`<option value="${l}" ${site.layout === l ? 'selected' : ''}>${t(`website.layout_${l}`)}</option>`)}</select></label>
        <div class="field"><span>${t('website.theme')}</span><div class="theme-grid" role="group" aria-label="${t('website.theme')}">${THEMES.map((l) => html`<button class="theme-chip theme-${l}" aria-pressed="${site.theme === l}" data-act="set-site-theme" data-theme="${l}" title="${t(`wx.theme_${l}`)}"><i></i><span>${t(`wx.theme_${l}`)}</span></button>`)}</div></div>
        <label class="field"><span>${t('wx.font')}</span><select data-in="site-select" data-field="font">${FONTS_LIST.map((l) => html`<option value="${l}" ${site.font === l ? 'selected' : ''}>${t(`wx.font_${l}`)}</option>`)}</select></label>
        <label class="field"><span>${t('wx.radius')}</span><select data-in="site-select" data-field="radius">${RADII.map((l) => html`<option value="${l}" ${site.radius === l ? 'selected' : ''}>${t(`wx.radius_${l}`)}</option>`)}</select></label>
        <label class="field"><span>${t('website.language')}</span><select data-in="site-select" data-field="lang">${LANGS.map((l) => html`<option value="${l.code}" ${lang === l.code ? 'selected' : ''}>${l.name}</option>`)}</select></label>
        <fieldset class="toggles"><legend>${t('website.sections')}</legend>
          ${[['showBooking', 'website.showBooking'], ['showReviews', 'website.showReviews'], ['showLocation', 'website.showLocation']].map(([k, label]) => html`<label class="check"><input type="checkbox" data-in="site-toggle" data-field="${k}" ${site[k] ? 'checked' : ''}><span>${t(label)}</span></label>`)}</fieldset>
        <div class="regen-row"><span class="label-mono">${t('website.regenTitle')}</span>${rb('hero')}${rb('offer')}${rb('faq')}</div>
        <details class="more"><summary>${t('website.moreContent')}</summary>
          ${field(t('website.offerTitle'), 'offerTitle', c.offerTitle, { max: 80 })}
          ${field(t('website.offerText'), 'offerText', c.offerText, { area: true, max: 300 })}
          ${field(t('website.locationField'), 'location', c.location, { max: 80 })}
          ${field(t('website.hours'), 'hours', c.hours, { area: true, max: 300 })}
          ${c.services.map((s, i) => html`<div class="pair"><p class="label-mono">${t('website.service')} ${i + 1}</p>${field(t('website.name'), `svc-${i}-n`, s.n, { max: 50 })}${field(t('website.desc'), `svc-${i}-d`, s.d, { max: 160 })}</div>`)}
          ${c.faq.map((f, i) => html`<div class="pair"><p class="label-mono">FAQ ${i + 1}</p>${field(t('website.question'), `faq-${i}-q`, f.q, { max: 140 })}${field(t('website.answer'), `faq-${i}-a`, f.a, { area: true, max: 300 })}</div>`)}
        </details>
      </aside>
    </div>`;
  },
  mount() { refreshPreview(); },
};

/* ---------- field handling ---------- */
function setOverride(name, value) {
  const site = getState().site; const o = { ...site.overrides };
  const m = name.match(/^(svc|faq)-(\d)-(\w)$/);
  const v = limit(value, 320);
  if (m) {
    const [, kind, idx, key] = m; const c = resolveCopy();
    const arr = (kind === 'svc' ? c.services : c.faq).map((x) => ({ ...x }));
    const slot = kind === 'svc' ? (key === 'n' ? 'n' : 'd') : key;
    if (arr[+idx]) arr[+idx][slot] = v;
    o[kind === 'svc' ? 'services' : 'faq'] = arr;
  } else o[name] = v;
  updateSite({ overrides: o });
}
inputs['site-field'] = (el) => { setOverride(el.dataset.field, el.value); refreshSoon(); };
inputs['site-select'] = (el) => { updateSite({ [el.dataset.field]: el.value || null }); if (el.dataset.field === 'lang') rerender(); else refreshPreview(); };
inputs['site-toggle'] = (el) => { updateSite({ [el.dataset.field]: el.checked }); refreshPreview(); };
inputs['site-accent'] = (el) => { updateSite({ accent: el.value }); refreshSoon(); };

actions['set-site-theme'] = (el) => { updateSite({ theme: el.dataset.theme, accent: THEME_ACCENT[el.dataset.theme] }); rerender(); };
actions.accent = (el) => { updateSite({ accent: el.dataset.color }); rerender(); };
actions.device = (el) => { device = el.dataset.device; rerender(); };

export async function generateSite() {
  if (busy || needSignals()) return; busy = 'gen'; rerender();
  const [r] = await Promise.all([runBuilder(), sleep(1100)]);
  updateSite({ generated: true, overrides: {}, variants: { hero: 0, offer: 0, faq: 0 }, ai: r.mode === 'ai' ? { lang: getLang(), copy: r.copy } : null });
  busy = null; rerender();
  toast(r.mode === 'ai' ? t('website.toastAi') : t('website.toastLocal'), r.mode === 'ai' ? 'success' : 'info');
}
actions['gen-site'] = () => generateSite();

actions.regen = async (el) => {
  const sec = el.dataset.section; if (busy) return;
  busy = sec; rerender();
  const r = await runBuilder();
  const site = getState().site; const o = { ...site.overrides };
  ({ hero: ['headline', 'sub', 'cta'], offer: ['offerTitle', 'offerText'], faq: ['faq'] })[sec].forEach((k) => delete o[k]);
  const variants = { ...site.variants };
  if (r.mode === 'ai') { variants[sec] = 0; updateSite({ overrides: o, variants, ai: { lang: getLang(), copy: { ...(site.ai?.copy || {}), ...r.copy } } }); }
  else { variants[sec] = (variants[sec] || 0) + 1; updateSite({ overrides: o, variants }); }
  busy = null; rerender();
  toast(t('website.toastRegen', { section: t(`website.sec_${sec}`) }), 'success');
};

actions['reset-site'] = async () => {
  if (!(await confirmDialog(t('website.resetTitle'), t('website.resetBody'), t('actions.reset')))) return;
  update({ site: defaultSite() }); rerender(); toast(t('website.toastReset'), 'info');
};

actions['share-site'] = async () => {
  const ok = await copyText(shareUrl());
  toast(ok ? t('website.toastShared') : t('common.copyFailed'), ok ? 'success' : 'error');
};
actions['open-public'] = () => { window.open(shareUrl(), '_blank', 'noopener'); };
actions['export-zip'] = () => { try { downloadBlob('cafeneaua-copou-site.zip', exportZip()); toast(t('website.toastExport'), 'success'); } catch (e) { console.error(e); toast(t('common.errorGeneric'), 'error'); } };
actions['export-html'] = () => { try { downloadBlob('cafeneaua-copou.html', exportHtml()); toast(t('website.toastExport'), 'success'); } catch (e) { console.error(e); toast(t('common.errorGeneric'), 'error'); } };
actions['export-card'] = async () => { try { downloadBlob('localboost-pitch-card.png', await exportPitchCard()); toast(t('website.toastExport'), 'success'); } catch (e) { console.error(e); toast(t('common.errorGeneric'), 'error'); } };

/* ---------- website presentation (full screen) ---------- */
let presenting = null;
export const isSitePresenting = () => !!presenting;

export function presentSite() {
  if (presenting) return;
  const doc = resolveDoc(); const total = sectionList(doc).length;
  const root = $('#present-root'); root.hidden = false;
  root.innerHTML = html`<div class="sp" role="dialog" aria-modal="true" aria-label="${t('actions.presentWebsite')}">
    <iframe id="sp-frame" sandbox="allow-scripts allow-forms" title="${t('website.previewTitle')}"></iframe>
    <div class="sp-bar"><div class="sp-progress" role="progressbar" aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="1"><i></i></div>
      <button class="btn btn-secondary" data-sp="prev" aria-label="${t('common.previous')}">${icon('prev', 18)}</button>
      <span class="mono sp-count">1 / ${total}</span>
      <button class="btn btn-primary" data-sp="next" aria-label="${t('common.next')}">${icon('next', 18)}</button>
      <button class="btn btn-ghost" data-sp="copy" aria-label="${t('actions.share')}">${icon('share', 18)}</button>
      <button class="btn btn-ghost" data-sp="exit" aria-label="${t('common.exit')} (Esc)">${icon('x', 18)} Esc</button></div></div>`.s;
  const frame = $('#sp-frame'); frame.srcdoc = buildDocument(doc, { present: true });
  let idx = 0;
  const go = (n, instant) => {
    idx = Math.max(0, Math.min(total - 1, n));
    frame.contentWindow?.postMessage({ lb: 'goto', index: idx, instant }, '*');
    $('.sp-count').textContent = `${idx + 1} / ${total}`;
    const bar = $('.sp-progress'); bar.setAttribute('aria-valuenow', idx + 1); $('i', bar).style.width = `${((idx + 1) / total) * 100}%`;
  };
  const exit = () => {
    document.removeEventListener('keydown', onKey, true); root.removeEventListener('click', onClick);
    root.hidden = true; root.innerHTML = ''; presenting = null;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  };
  const onKey = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(idx + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(idx - 1); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); exit(); }
  };
  const onClick = async (e) => {
    const b = e.target.closest('[data-sp]'); if (!b) return;
    ({ prev: () => go(idx - 1), next: () => go(idx + 1), exit, copy: async () => { toast((await copyText(shareUrl())) ? t('website.toastShared') : t('common.copyFailed'), 'success'); } })[b.dataset.sp]();
  };
  document.addEventListener('keydown', onKey, true); root.addEventListener('click', onClick);
  presenting = { exit, frame };
  root.requestFullscreen?.().catch(() => {}); // fullscreen only if the browser allows it
  $('[data-sp="next"]').focus();
}
actions['present-site'] = () => presentSite();
export const getSiteFrames = () => [$('#site-frame'), $('#sp-frame')].filter(Boolean);

