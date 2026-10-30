import { html, raw, esc, icon, toast, copyText, confirmDialog } from '../core.js';
import { t } from '../i18n.js';
import { getState, update } from '../store.js';
import { getAssets, ensureAssetsSync, regenAsset, runAssets } from '../ai.js';
import { actions, rerender } from '../registry.js';
import { pageHead, demoBadge, aiNotice } from './shared.js';
import { needSignals } from '../collect.js';
import { getBiz, displayName } from '../business.js';

/** Circular sticker concept, drawn as SVG (text on a circle path). */
export function stickerSvg(text, size = 200, place = '') {
  const label = esc((text || '').toUpperCase().slice(0, 34));
  return raw(`<svg class="sticker" width="${size}" height="${size}" viewBox="0 0 200 200" role="img" aria-label="${label}">
    <defs><path id="stk-${size}" d="M100 100m-72 0a72 72 0 1 1 144 0a72 72 0 1 1 -144 0"/></defs>
    <circle cx="100" cy="100" r="96" fill="#701F36"/><circle cx="100" cy="100" r="88" fill="none" stroke="#F1C84B" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round"/>
    <circle cx="100" cy="100" r="46" fill="#F1C84B"/>
    <path d="M82 92h36v22a18 18 0 01-36 0z" fill="none" stroke="#260B18" stroke-width="6" stroke-linecap="round"/><path d="M118 98h6a7 7 0 010 14h-6" fill="none" stroke="#260B18" stroke-width="5" stroke-linecap="round"/>
    <text font-family="Lexend, sans-serif" font-size="12" font-weight="500" fill="#FFE39A" letter-spacing="1.5"><textPath href="#stk-${size}" startOffset="0">${label} · ${place && label.length < 20 ? `${esc(place.toUpperCase().slice(0, 16))} ·` : ''}</textPath></text></svg>`);
}

const card = (kind, title, bodyHtml, copy) => html`<article class="card pack-card pack-${kind}">
  <div class="pack-top"><p class="tag">${t('tag.action')} · ${title}</p><span class="badge badge-inference">${t('pack.draft')}</span></div>
  ${bodyHtml}
  <div class="btn-row"><button class="btn btn-secondary btn-sm" data-act="copy-asset" data-kind="${kind}">${icon('copy', 16)} ${t('actions.copy')}</button>
    <button class="btn btn-ghost btn-sm" data-act="regen-asset" data-kind="${kind}">${icon('refresh', 16)} ${t('website.regen')}</button>
    ${kind === 'post' ? html`<button class="btn btn-primary btn-sm" data-act="publish-asset">${icon('check', 16)} ${t('pack.readyToPublish')}</button>` : ''}</div></article>`;

export const pack = {
  id: 'pack',
  render() {
    const head = pageHead({ note: '06', title: t('pack.title'), sub: t('pack.sub'),
      actions: html`<button class="btn btn-secondary" data-act="gen-assets">${icon('sparkle', 18)} ${getState().assets ? t('actions.regenerateAll') : t('actions.generateAssets')}</button>` });
    const a = getAssets();
    if (!a) return html`${head}<section class="card empty-hero"><div class="empty-ic">${icon('pack', 34)}</div><h2>${t('pack.emptyTitle')}</h2><p class="muted">${t('pack.emptyBody')}</p>
      <button class="btn btn-primary btn-lg" data-act="gen-assets">${icon('sparkle', 18)} ${t('actions.generateAssets')}</button></section>`;
    return html`${head}${aiNotice()}
    <div class="banner ${a.mode === 'ai' ? 'banner-ok' : 'banner-warn'}" role="status">${icon('info', 18)} ${t(a.mode === 'ai' ? 'pack.modeAi' : 'pack.modeLocal')} ${demoBadge()}</div>
    <div class="bento">
      <div class="span-7">${card('offer', t('pack.offer'), html`<h2 class="card-title">${a.offer.title}</h2><p>${a.offer.body}</p><p class="cta-line">→ ${a.offer.cta}</p>`)}</div>
      <div class="span-5">${card('merch', t('pack.merch'), html`<div class="merch-row">${stickerSvg(a.merch.stickerText, 150, getBiz().city.split(',')[0])}<div><p>${a.merch.concept}</p><p class="mono small">${a.merch.stickerText}</p></div></div>`)}</div>
      <div class="span-6">${card('post', t('pack.post'), html`<div class="post-mock"><div class="post-head"><i></i><div><strong>${displayName()}</strong><small>${t('pack.postMeta')}</small></div></div><p>${a.post.text}</p><p class="cta-line">→ ${a.post.cta}</p></div>`)}</div>
      <div class="span-6">${card('headlines', t('pack.headlines'), html`<ol class="headlines">${a.headlines.map((h) => html`<li>${h}</li>`)}</ol>`)}</div>
    </div>
    <p class="muted small">${t('pack.noAutoPublish')}</p>`;
  },
};

function assetText(kind) {
  const a = getAssets(); if (!a) return '';
  return ({
    offer: `${a.offer.title}\n${a.offer.body}\n→ ${a.offer.cta}`,
    merch: `${a.merch.concept}\n${a.merch.stickerText}`,
    post: `${a.post.text}\n→ ${a.post.cta}`,
    headlines: a.headlines.map((h, i) => `${i + 1}. ${h}`).join('\n'),
  })[kind];
}

actions['gen-assets'] = async (el) => {
  if (needSignals()) return;
  el.disabled = true;
  const mode = await runAssets();
  toast(mode === 'ai' ? t('pack.toastAi') : t('pack.toastLocal'), mode === 'ai' ? 'success' : 'info');
  rerender();
};
actions['copy-asset'] = async (el) => {
  const ok = await copyText(assetText(el.dataset.kind));
  toast(ok ? t('common.copied') : t('common.copyFailed'), ok ? 'success' : 'error');
};
actions['regen-asset'] = (el) => { ensureAssetsSync(); regenAsset(el.dataset.kind); rerender(); toast(t('pack.toastRegen'), 'success'); };
actions['publish-asset'] = async () => {
  const ok = await confirmDialog(t('pack.confirmTitle'), t('pack.confirmBody'), t('pack.confirmOk'));
  if (!ok) return;
  update((s) => ({ assets: { ...s.assets, approved: { ...s.assets.approved, post: true } } }));
  await copyText(assetText('post'));
  toast(t('pack.toastApproved'), 'success');
};
