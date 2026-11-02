import { html, icon, toast, copyText, downloadBlob, confirmDialog, sleep, $, limit, slug as slugify } from '../core.js';
import { t, getLang, LANGS, fmtDate, fmtNumber } from '../i18n.js';
import { getState, update, updateSite, defaultSite } from '../store.js';
import { runBuilder } from '../ai.js';
import { resolveCopy, resolveDoc, exportHtml, suggestedSlug, siteHours } from '../website.js';
import { buildDocument, THEMES, LAYOUTS, FONTS_LIST, RADII, THEME_ACCENT } from '../siteTemplate.js';
import { actions, inputs, rerender } from '../registry.js';
import { pageHead } from './shared.js';
import { needSignals } from '../collect.js';
import { getBiz, cleanPhone, cleanEmail } from '../business.js';
import { authOn, signedIn } from '../auth.js';
import { serverCaps, publishSite, unpublishSite, setRequestStatus, deleteRequest, siteUrl } from '../sources.js';
import { loadSiteData, getSiteData, dailySeries } from '../insights.js';
import { viewingClient } from '../cloud.js';
import { barSeries } from '../charts.js';

const ACCENTS = ['#F1C84B', '#F59E0B', '#14B8A6', '#2563EB', '#EF4444', '#8B5CF6', '#10B981'];
let device = 'desktop';
let busy = null; // 'gen' | 'hero' | 'services' | 'faq' | 'publish'
let tab = 'text'; // text | info | look | publish
let caps = null;
let slugDraft = null;

const field = (label, name, value, { area = false, max = 200, hint = '', kind = 'site-field', type = 'text' } = {}) => html`<label class="field"><span>${label}</span>
  ${area ? html`<textarea data-in="${kind}" data-field="${name}" maxlength="${max}" rows="3">${value}</textarea>`
    : html`<input type="${type}" data-in="${kind}" data-field="${name}" maxlength="${max}" value="${value}">`}${hint ? html`<small class="muted">${hint}</small>` : ''}</label>`;

export function refreshPreview() {
  const f = $('#site-frame');
  if (f) f.srcdoc = buildDocument(resolveDoc(), { preview: true });
}
let timer;
const refreshSoon = () => { clearTimeout(timer); timer = setTimeout(refreshPreview, 160); };

/* ---------- publish tab ---------- */
function publishPanel() {
  const site = getState().site; const sd = getSiteData();
  const online = !!(site.slug && site.publishedAt && sd?.site?.published !== false);
  if (viewingClient()) return html`<p class="muted">${t('website.adminNoPublish')}</p>`;
  if (!caps?.sites || !authOn() || !signedIn()) {
    return html`<div class="pub-off"><h3>${t('website.pubOffTitle')}</h3><p class="muted">${t('website.pubOffBody')}</p>
      <button class="btn btn-secondary" data-act="export-html">${icon('download', 18)} ${t('website.download')}</button></div>`;
  }
  const slug = slugDraft ?? site.slug ?? suggestedSlug();
  const stats = dailySeries(30); const sum = (k, n) => stats.slice(-n).reduce((a, d) => a + d[k], 0);
  const reqs = sd?.requests || []; const fresh = reqs.filter((r) => r.status === 'new').length;
  return html`
    ${online ? html`<div class="pub-live"><span class="pub-dot" aria-hidden="true"></span><div><strong>${t('website.live')}</strong>
      <a href="${siteUrl(site.slug)}" target="_blank" rel="noopener">${siteUrl(site.slug).replace(/^https?:\/\//, '')}</a></div></div>
      <div class="btn-row"><button class="btn btn-secondary btn-sm" data-act="copy-site-link">${icon('copy', 16)} ${t('actions.copy')}</button>
        <a class="btn btn-secondary btn-sm" href="${siteUrl(site.slug)}" target="_blank" rel="noopener">${icon('external', 16)} ${t('common.open')}</a></div>`
    : html`<p class="muted">${t('website.pubIntro')}</p>`}
    <form class="slug-form" data-slug-form novalidate><label class="field"><span>${t('website.address')}</span>
      <span class="slug-wrap"><i>${siteUrl('').replace(/^https?:\/\//, '')}</i><input id="site-slug" value="${slug}" maxlength="40" autocomplete="off" spellcheck="false" inputmode="url"></span>
      <small class="muted">${t('website.slugHint')}</small></label>
      <div class="btn-row"><button type="submit" class="btn btn-primary" ${busy === 'publish' ? 'disabled' : ''}>${busy === 'publish' ? html`<i class="spin"></i>` : icon('external', 18)} ${t(online ? 'website.update' : 'website.publish')}</button>
        ${online ? html`<button type="button" class="btn btn-ghost danger" data-act="unpublish-site">${t('website.unpublish')}</button>` : ''}</div></form>
    ${online ? html`<p class="muted small">${t('website.updatedNote', { date: fmtDate(site.publishedAt) })}</p>
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

/* ---------- business info tab: what customers need to reach you ---------- */
function infoPanel() {
  const b = getBiz(); const hours = siteHours();
  return html`<p class="muted small">${t('website.infoNote')}</p>
    ${field(t('biz.phone'), 'phone', b.phone, { max: 30, kind: 'biz-info', type: 'tel' })}
    ${field(t('biz.whatsapp'), 'whatsapp', b.whatsapp, { max: 30, kind: 'biz-info', type: 'tel', hint: t('biz.whatsappHint') })}
    ${field(t('biz.email'), 'email', b.email, { max: 120, kind: 'biz-info', type: 'email' })}
    ${field(t('biz.address'), 'address', b.address || b.place?.address || '', { max: 200, kind: 'biz-info' })}
    ${field(t('website.hours'), 'hours', hours.join('\n'), { area: true, max: 600, hint: b.place?.hours?.length ? t('website.hoursFromGoogle') : t('website.hoursHint') })}`;
}

export const website = {
  id: 'website',
  render() {
    const site = getState().site;
    const head = pageHead({ title: t('website.title'), sub: t('website.sub') });
    if (!site.generated) {
      return html`${head}<section class="card empty-hero"><div class="empty-ic">${icon('website', 34)}</div><h2>${t('website.emptyTitle')}</h2><p class="muted">${t('website.emptyBody')}</p>
        <button class="btn btn-primary btn-lg" data-act="gen-site" ${busy ? 'disabled' : ''}>${busy === 'gen' ? html`<i class="spin"></i> ${t('website.generating')}` : html`${icon('sparkle', 18)} ${t('actions.generateWebsite')}`}</button></section>`;
    }
    const c = resolveCopy(); const lang = c.lang;
    const rb = (sec) => html`<button class="btn btn-ghost btn-sm" data-act="regen" data-section="${sec}" ${busy ? 'disabled' : ''}>${busy === sec ? html`<i class="spin"></i>` : icon('refresh', 15)} ${t(`website.sec_${sec}`)}</button>`;
    const tabBtn = (k) => html`<button role="tab" id="wtab-${k}" aria-selected="${tab === k}" aria-controls="wpanel" data-act="site-tab" data-tab="${k}">${t(`website.tab_${k}`)}</button>`;
    const online = site.slug && site.publishedAt;
    return html`${head}
    <div class="site-layout site-layout2">
      <div class="browser">
        <div class="browser-bar">
          <div class="seg seg-sm" role="group" aria-label="${t('website.device')}">${['desktop', 'tablet', 'phone'].map((d) => html`<button aria-pressed="${device === d}" data-act="device" data-device="${d}">${t(`website.${d}`)}</button>`)}</div>
          <div class="urlbar">${icon('globe', 15)} <span>${online ? siteUrl(site.slug).replace(/^https?:\/\//, '') : t('website.notPublished')}</span></div>
          <div class="browser-actions">
            <button class="btn btn-primary btn-sm" data-act="site-tab" data-tab="publish">${icon('external', 16)} ${t(online ? 'website.live' : 'website.publish')}</button>
            <details class="dd"><summary class="btn btn-ghost btn-sm" aria-label="${t('ledger.more')}">${icon('more', 18)}</summary>
              <div class="dd-menu dd-right" role="menu"><button role="menuitem" data-act="export-html">${icon('download', 16)} ${t('website.download')}</button>
                <button role="menuitem" class="danger" data-act="reset-site">${icon('trash', 16)} ${t('actions.reset')}</button></div></details>
          </div>
        </div>
        <div class="preview-stage"><div class="device device-${device}"><iframe id="site-frame" title="${t('website.previewTitle')}" sandbox="allow-scripts allow-forms"></iframe></div></div>
        <p class="muted small browser-note">${t('website.previewNote')}</p>
      </div>
      <aside class="card controls controls2" aria-label="${t('website.controls')}">
        <div class="wtabs" role="tablist" aria-label="${t('website.controls')}">${['text', 'info', 'look', 'publish'].map(tabBtn)}</div>
        <div id="wpanel" role="tabpanel" aria-labelledby="wtab-${tab}">
        ${tab === 'text' ? html`
        ${field(t('website.headline'), 'headline', c.headline, { max: 110 })}
        ${field(t('website.subheadline'), 'sub', c.sub, { area: true, max: 240 })}
        ${field(t('website.cta'), 'cta', c.cta, { max: 40 })}
        <div class="regen-row"><span class="label-mono">${t('website.regenTitle')}</span>${rb('hero')}${rb('services')}${rb('faq')}</div>
        <details class="more"><summary>${t('website.moreContent')}</summary>
          ${field(t('website.offerTitle'), 'offerTitle', c.offerTitle, { max: 80 })}
          ${field(t('website.offerText'), 'offerText', c.offerText, { area: true, max: 300 })}
          ${c.services.map((s, i) => html`<div class="pair"><p class="label-mono">${t('website.service')} ${i + 1}</p>${field(t('website.name'), `svc-${i}-n`, s.n, { max: 60 })}${field(t('website.desc'), `svc-${i}-d`, s.d, { max: 200 })}</div>`)}
          ${c.faq.map((f, i) => html`<div class="pair"><p class="label-mono">FAQ ${i + 1}</p>${field(t('website.question'), `faq-${i}-q`, f.q, { max: 140 })}${field(t('website.answer'), `faq-${i}-a`, f.a, { area: true, max: 400 })}</div>`)}
        </details>
        <label class="field"><span>${t('website.language')}</span><select data-in="site-select" data-field="lang">${LANGS.map((l) => html`<option value="${l.code}" ${lang === l.code ? 'selected' : ''}>${l.name}</option>`)}</select></label>
        <fieldset class="toggles"><legend>${t('website.sections')}</legend>
          ${[['showBooking', 'website.showBooking'], ['showReviews', 'website.showReviews'], ['showLocation', 'website.showLocation'], ['showOffer', 'website.showOffer']].map(([k, label]) => html`<label class="check"><input type="checkbox" data-in="site-toggle" data-field="${k}" ${site[k] !== false ? 'checked' : ''}><span>${t(label)}</span></label>`)}</fieldset>` : ''}
        ${tab === 'info' ? infoPanel() : ''}
        ${tab === 'look' ? html`
        <div class="field"><span>${t('website.theme')}</span><div class="theme-grid" role="group" aria-label="${t('website.theme')}">${THEMES.map((l) => html`<button class="theme-chip theme-${l}" aria-pressed="${site.theme === l}" data-act="set-site-theme" data-theme="${l}" title="${t(`wx.theme_${l}`)}"><i></i><span>${t(`wx.theme_${l}`)}</span></button>`)}</div></div>
        <div class="field"><span>${t('website.accent')}</span><div class="swatches">${ACCENTS.map((a) => html`<button class="swatch" style="background:${a}" aria-label="${a}" aria-pressed="${site.accent === a}" data-act="accent" data-color="${a}"></button>`)}
          <input type="color" data-in="site-accent" value="${site.accent}" aria-label="${t('website.accent')}"></div></div>
        <label class="field"><span>${t('website.layout')}</span><select data-in="site-select" data-field="layout">${LAYOUTS.map((l) => html`<option value="${l}" ${site.layout === l ? 'selected' : ''}>${t(`website.layout_${l}`)}</option>`)}</select></label>
        <label class="field"><span>${t('wx.font')}</span><select data-in="site-select" data-field="font">${FONTS_LIST.map((l) => html`<option value="${l}" ${site.font === l ? 'selected' : ''}>${t(`wx.font_${l}`)}</option>`)}</select></label>
        <label class="field"><span>${t('wx.radius')}</span><select data-in="site-select" data-field="radius">${RADII.map((l) => html`<option value="${l}" ${site.radius === l ? 'selected' : ''}>${t(`wx.radius_${l}`)}</option>`)}</select></label>` : ''}
        ${tab === 'publish' ? publishPanel() : ''}
        </div>
      </aside>
    </div>`;
  },
  mount() {
    refreshPreview();
    if (!caps) serverCaps().then((c) => { caps = c; if (tab === 'publish') rerender(); });
    if (!getSiteData()) loadSiteData().then(() => { if (tab === 'publish') rerender(); });
  },
};

/* ---------- field handling ---------- */
function setOverride(name, value) {
  const site = getState().site; const o = { ...site.overrides };
  const m = name.match(/^(svc|faq)-(\d)-(\w)$/);
  const v = limit(value, 600);
  if (m) {
    const [, kind, idx, key] = m; const c = resolveCopy();
    const arr = (kind === 'svc' ? c.services : c.faq).map((x) => ({ ...x }));
    if (arr[+idx]) arr[+idx][key] = v;
    o[kind === 'svc' ? 'services' : 'faq'] = arr;
  } else o[name] = v;
  updateSite({ overrides: o });
}
inputs['site-field'] = (el) => { setOverride(el.dataset.field, el.value); refreshSoon(); };
inputs['biz-info'] = (el) => {
  const k = el.dataset.field; const v = limit(el.value, 200);
  update((s) => ({ business: { ...s.business, [k]: k === 'email' ? (cleanEmail(v) || v.trim()) : k === 'address' ? v : cleanPhone(v) } }));
  refreshSoon();
};
inputs['site-select'] = (el) => { updateSite({ [el.dataset.field]: el.value || null }); if (el.dataset.field === 'lang') rerender(); else refreshPreview(); };
inputs['site-toggle'] = (el) => { updateSite({ [el.dataset.field]: el.checked }); refreshPreview(); };
inputs['site-accent'] = (el) => { updateSite({ accent: el.value }); refreshSoon(); };

actions['set-site-theme'] = (el) => { updateSite({ theme: el.dataset.theme, accent: THEME_ACCENT[el.dataset.theme] }); rerender(); };
actions.accent = (el) => { updateSite({ accent: el.dataset.color }); rerender(); };
actions.device = (el) => { device = el.dataset.device; rerender(); };
actions['site-tab'] = (el) => { tab = el.dataset.tab; rerender(); $(`#wtab-${tab}`)?.focus(); };
document.addEventListener('click', (e) => {
  document.querySelectorAll('details.dd[open]').forEach((d) => { if (!d.contains(e.target) || e.target.closest('.dd-menu button')) d.removeAttribute('open'); });
});

export async function generateSite() {
  if (busy || needSignals()) return; busy = 'gen'; rerender();
  const [r] = await Promise.all([runBuilder(), sleep(900)]);
  updateSite({ generated: true, overrides: {}, variants: { hero: 0, services: 0, faq: 0 }, ai: r.mode === 'ai' ? { lang: getLang(), copy: r.copy } : null });
  busy = null; rerender();
  toast(r.mode === 'ai' ? t('website.toastAi') : t('website.toastLocal'), r.mode === 'ai' ? 'success' : 'info');
}
actions['gen-site'] = () => generateSite();

actions.regen = async (el) => {
  const sec = el.dataset.section; if (busy) return;
  busy = sec; rerender();
  const r = await runBuilder();
  const site = getState().site; const o = { ...site.overrides };
  ({ hero: ['headline', 'sub', 'cta'], services: ['services'], faq: ['faq'] })[sec].forEach((k) => delete o[k]);
  const variants = { ...site.variants };
  if (r.mode === 'ai') { variants[sec] = 0; updateSite({ overrides: o, variants, ai: { lang: getLang(), copy: { ...(site.ai?.copy || {}), ...r.copy } } }); }
  else { variants[sec] = (variants[sec] || 0) + 1; updateSite({ overrides: o, variants }); }
  busy = null; rerender();
  toast(t('website.toastRegen', { section: t(`website.sec_${sec}`) }), 'success');
};

actions['reset-site'] = async () => {
  if (!(await confirmDialog(t('website.resetTitle'), t('website.resetBody'), t('actions.reset')))) return;
  const { slug, publishedAt } = getState().site;
  update({ site: { ...defaultSite(), slug, publishedAt } }); rerender(); toast(t('website.toastReset'), 'info');
};

actions['export-html'] = () => {
  try { downloadBlob(`${slugify(getBiz().name || 'website') || 'website'}.html`, exportHtml()); toast(t('website.toastExport'), 'success'); }
  catch (e) { console.error(e); toast(t('common.errorGeneric'), 'error'); }
};

/* ---------- publishing ---------- */
const PUB_ERR = { slug_taken: 'website.errTaken', bad_slug: 'website.errSlug', network: 'website.errNetwork', sites_not_configured: 'website.pubOffBody' };
document.addEventListener('submit', async (e) => {
  if (!e.target.matches('[data-slug-form]')) return;
  e.preventDefault();
  if (busy) return;
  const slug = slugify($('#site-slug')?.value || '').slice(0, 40).replace(/^-+|-+$/g, '');
  slugDraft = slug;
  if (slug.length < 3) return toast(t('website.errSlug'), 'error');
  busy = 'publish'; rerender();
  const r = await publishSite(slug, resolveDoc());
  busy = null;
  if (r.ok) { updateSite({ slug, publishedAt: Date.now() }); slugDraft = null; await loadSiteData(true); toast(t('website.toastPublished'), 'success'); }
  else toast(t(PUB_ERR[r.error] || 'common.errorGeneric'), 'error');
  rerender();
});
inputs['site-slug'] = () => {};
actions['unpublish-site'] = async () => {
  if (!(await confirmDialog(t('website.unpublishTitle'), t('website.unpublishBody'), t('website.unpublish')))) return;
  const r = await unpublishSite();
  if (!r.ok) return toast(t('common.errorGeneric'), 'error');
  updateSite({ publishedAt: null }); await loadSiteData(true); toast(t('website.toastUnpublished'), 'info'); rerender();
};
actions['copy-site-link'] = async () => { const ok = await copyText(siteUrl(getState().site.slug)); toast(ok ? t('common.copied') : t('common.copyFailed'), ok ? 'success' : 'error'); };
actions['reload-site-data'] = async () => { await loadSiteData(true); rerender(); };
actions['req-status'] = async (el) => {
  const r = await setRequestStatus(Number(el.dataset.id), el.dataset.status);
  if (!r.ok) return toast(t('common.errorGeneric'), 'error');
  await loadSiteData(true); rerender();
};
actions['req-delete'] = async (el) => {
  if (!(await confirmDialog(t('website.reqDeleteTitle'), t('website.reqDeleteBody'), t('admin.delete')))) return;
  const r = await deleteRequest(Number(el.dataset.id));
  if (!r.ok) return toast(t('common.errorGeneric'), 'error');
  await loadSiteData(true); rerender();
};

export const getSiteFrames = () => [$('#site-frame')].filter(Boolean);
