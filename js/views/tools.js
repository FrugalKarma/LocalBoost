// Pro tools on the Growth pack page: replies to Google reviews and a printable QR poster
// (for the Google review form or the owner's website).
import { html, raw, icon, toast, copyText, downloadBlob, slug as slugify, limit } from '../core.js';
import { t, tIn, ta } from '../i18n.js';
import { getState, update } from '../store.js';
import { runReplies } from '../ai.js';
import { actions, inputs, rerender } from '../registry.js';
import { getBiz } from '../business.js';
import { can, upgradePrompt, lockBadge } from '../plans.js';
import { qrSvg } from '../qr.js';
import { FONT_PAIRS } from '../siteTemplate.js';
import { resolveDoc, siteLang, publicSiteUrl } from '../website.js';

let busy = false;
let posterTarget = null;
let posterStyle = 'brand';

const reviewUrl = () => { const b = getBiz(); const id = b.place?.id; return id ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(id)}` : b.reviewLink; };
// links Google gives for "ask for reviews" (Business Profile), or a Maps link to the place
const REVIEW_HOSTS = /^(g\.page|maps\.app\.goo\.gl|goo\.gl|search\.google\.com|(www\.)?google\.[a-z.]+|maps\.google\.[a-z.]+)$/i;
export function cleanReviewLink(v) {
  try { const u = new URL(String(v || '').trim()); return u.protocol === 'https:' && REVIEW_HOSTS.test(u.hostname) ? u.href.slice(0, 300) : ''; } catch { return ''; }
}
const mapsReviewsUrl = () => getBiz().place?.mapsUrl || '';
const reviews = () => (getState().signals?.google?.reviews || []).filter((r) => r.text);
const firstName = (a) => String(a || '').trim().split(/\s+/)[0] || '';

/** Template replies when the AI is off: picked by rating, in the review's own site language. */
function templateReply(r, i) {
  const b = getBiz(); const lang = siteLang(); const pool = ta(r.rating >= 4 ? 'replies.tplGood' : r.rating === 3 ? 'replies.tplMid' : 'replies.tplBad', lang);
  const s = pool[i % pool.length] || '';
  const contact = b.phone || b.email || '';
  return s.replace(/\{name\}/g, firstName(r.author) || tIn(lang, 'replies.there')).replace(/\{biz\}/g, b.name || '').replace(/\{contact\}/g, contact).replace(/\s+\(\)/, '').trim();
}

export function repliesSection() {
  const list = reviews(); const saved = getState().replies || {};
  const locked = !can('replies');
  return html`<section class="card tool-card" id="replies">
    <div class="tool-head"><span class="tool-ic">${icon('reply', 22)}</span><div><h2>${t('replies.title')} ${locked ? lockBadge('replies') : ''}</h2><p class="muted">${t('replies.sub')}</p></div>
      ${list.length ? html`<button class="btn btn-primary btn-sm" data-act="replies-gen" ${busy ? 'disabled' : ''}>${busy ? html`<i class="spin"></i>` : icon('sparkle', 16)} ${t(Object.keys(saved).length ? 'replies.regen' : 'replies.gen')}</button>` : ''}</div>
    ${!list.length ? html`<p class="muted">${t('replies.none')}</p><button class="btn btn-secondary btn-sm" data-act="go" data-route="signals">${t('collect.refresh')}</button>`
      : html`<ol class="reply-list">${list.map((r, i) => html`<li class="reply ${r.rating <= 3 ? 'is-low' : ''}">
        <div class="reply-review"><span class="stars" aria-label="${t('replies.stars', { n: r.rating })}">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span> <b>${r.author}</b>${r.time ? html` <small class="muted">${r.time}</small>` : ''}
          <p>“${r.text.length > 320 ? `${r.text.slice(0, 320)}…` : r.text}”</p></div>
        ${saved[i] != null ? html`<label class="field"><span>${t('replies.yours')}</span><textarea data-in="reply-edit" data-i="${i}" rows="4" maxlength="1200">${saved[i]}</textarea></label>
          <div class="btn-row"><button class="btn btn-secondary btn-sm" data-act="reply-copy" data-i="${i}">${icon('copy', 15)} ${t('actions.copy')}</button>
            ${mapsReviewsUrl() ? html`<a class="btn btn-ghost btn-sm" href="${mapsReviewsUrl()}" target="_blank" rel="noopener">${icon('external', 15)} ${t('replies.openGoogle')}</a>` : ''}</div>` : ''}
      </li>`)}</ol>
      <p class="muted small">${icon('info', 14)} ${t('replies.how')}</p>`}
  </section>`;
}

/* ---------- poster ---------- */
function posterTargets() {
  const st = getState().site; const out = [];
  if (reviewUrl()) out.push({ id: 'review', url: reviewUrl() });
  if (st.slug && st.publishedAt) out.push({ id: 'site', url: publicSiteUrl(st.slug) });
  return out;
}
function posterSvg(target, style, lang) {
  const T = (k, v) => { let s = tIn(lang, k); for (const [a, b] of Object.entries(v || {})) s = s.replace(`{${a}}`, b); return s; };
  const doc = resolveDoc(); const pal = doc.design.palette; const name = doc.biz.name;
  const dark = style === 'mono' ? '#111111' : pal.brand; const bg = style === 'mono' ? '#ffffff' : pal.bg; const ink = style === 'mono' ? '#111111' : pal.text;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const head = target.id === 'review' ? T('poster.reviewHead') : T('poster.siteHead');
  const sub = target.id === 'review' ? T('poster.reviewSub') : T('poster.siteSub');
  const qr = qrSvg(target.url, { size: 360, dark: '#111111', light: '#ffffff' }).replace('<svg ', '<svg x="120" y="330" ');
  const short = target.url.replace(/^https?:\/\//, '').replace(/\?.*$/, target.id === 'review' ? '' : '');
  const wrap = (s, n) => { const w = String(s).split(' '); const lines = ['']; w.forEach((x) => { if ((lines[lines.length - 1] + ' ' + x).trim().length > n) lines.push(x); else lines[lines.length - 1] = (lines[lines.length - 1] + ' ' + x).trim(); }); return lines; };
  const tspans = (lines, x, y0, dy) => lines.map((l, i) => `<tspan x="${x}" y="${y0 + i * dy}">${esc(l)}</tspan>`).join('');
  const font = FONT_PAIRS[doc.design.fonts]?.h || 'Georgia, serif';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 849" width="600" height="849" role="img" aria-label="${esc(head)}">
  <rect width="600" height="849" fill="${bg}"/><rect x="0" y="0" width="600" height="14" fill="${dark}"/>
  <text x="300" y="80" text-anchor="middle" font-family="${esc(font)}" font-size="26" font-weight="700" fill="${ink}" letter-spacing="1">${esc(name.toUpperCase().slice(0, 34))}</text>
  <text text-anchor="middle" font-family="${esc(font)}" font-size="44" font-weight="700" fill="${dark}">${tspans(wrap(head, 20), 300, 160, 52)}</text>
  <text text-anchor="middle" font-family="Arial, sans-serif" font-size="19" fill="${ink}">${tspans(wrap(sub, 46), 300, 272, 26)}</text>
  <rect x="104" y="314" width="392" height="392" rx="22" fill="#ffffff" stroke="${dark}" stroke-width="4"/>${qr}
  <text x="300" y="752" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="${ink}">${esc(T('poster.scan'))}</text>
  ${target.id === 'review' ? `<text x="300" y="782" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" fill="#E8A600" letter-spacing="6">★★★★★</text>` : `<text x="300" y="784" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" fill="${ink}">${esc(short.slice(0, 60))}</text>`}
  <rect x="0" y="835" width="600" height="14" fill="${dark}"/></svg>`;
}

export function posterSection() {
  const targets = posterTargets(); const locked = !can('poster');
  const target = targets.find((x) => x.id === posterTarget) || targets[0];
  return html`<section class="card tool-card" id="poster">
    <div class="tool-head"><span class="tool-ic">${icon('qr', 22)}</span><div><h2>${t('poster.title')} ${locked ? lockBadge('poster') : ''}</h2><p class="muted">${t('poster.sub')}</p></div></div>
    ${!target ? html`<p class="muted">${t('poster.none')}</p>` : html`<div class="poster-wrap">
      <div class="poster-prev ${locked ? 'is-locked' : ''}">${raw(posterSvg(target, posterStyle, siteLang()))}${locked ? html`<span class="poster-lock">${icon('lock', 18)} ${t('plans.pro.name')}</span>` : ''}</div>
      <div class="poster-ctl">
        ${targets.length > 1 ? html`<div class="seg seg-wide" role="group" aria-label="${t('poster.for')}">${targets.map((x) => html`<button type="button" aria-pressed="${x.id === target.id}" data-act="poster-target" data-v="${x.id}">${t(`poster.t.${x.id}`)}</button>`)}</div>` : html`<p><b>${t(`poster.t.${target.id}`)}</b></p>`}
        <div class="seg seg-wide" role="group" aria-label="${t('poster.style')}">${['brand', 'mono'].map((s) => html`<button type="button" aria-pressed="${posterStyle === s}" data-act="poster-style" data-v="${s}">${t(`poster.s.${s}`)}</button>`)}</div>
        <p class="muted small">${t('poster.tip')}</p>
        <div class="btn-row"><button class="btn btn-primary" data-act="poster-print">${icon('download', 16)} ${t('poster.print')}</button>
          <button class="btn btn-secondary" data-act="poster-svg">${icon('download', 16)} SVG</button>
          <button class="btn btn-ghost" data-act="poster-link">${icon('copy', 16)} ${t('poster.copyLink')}</button></div>
      </div></div>`}
  </section>`;
}

/* ---------- actions ---------- */
actions['replies-gen'] = async () => {
  if (!can('replies')) return upgradePrompt('replies');
  if (busy) return; busy = true; rerender();
  const list = reviews();
  const r = await runReplies(list);
  const out = {};
  list.forEach((rv, i) => { const ai = r.replies?.find((x) => x.index === i)?.reply; out[i] = ai || templateReply(rv, i); });
  update({ replies: out }); busy = false; rerender();
  toast(r.mode === 'ai' ? t('replies.toastAi') : t('replies.toastTpl'), r.mode === 'ai' ? 'success' : 'info');
  document.getElementById('replies')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
};
inputs['reply-edit'] = (el) => update((s) => ({ replies: { ...(s.replies || {}), [el.dataset.i]: limit(el.value, 1200) } }));
actions['reply-copy'] = async (el) => { const ok = await copyText((getState().replies || {})[el.dataset.i] || ''); toast(ok ? t('common.copied') : t('common.copyFailed'), ok ? 'success' : 'error'); };
actions['poster-target'] = (el) => { posterTarget = el.dataset.v; rerender(); };
actions['poster-style'] = (el) => { posterStyle = el.dataset.v; rerender(); };
const curTarget = () => { const ts = posterTargets(); return ts.find((x) => x.id === posterTarget) || ts[0]; };
actions['poster-link'] = async () => { const ok = await copyText(curTarget()?.url || ''); toast(ok ? t('common.copied') : t('common.copyFailed'), ok ? 'success' : 'error'); };
actions['poster-svg'] = () => {
  if (!can('poster')) return upgradePrompt('poster');
  const tg = curTarget(); if (!tg) return;
  downloadBlob(`${slugify(getBiz().name || 'poster')}-${tg.id}-poster.svg`, new Blob([posterSvg(tg, posterStyle, siteLang())], { type: 'image/svg+xml' }));
};
actions['poster-print'] = () => {
  if (!can('poster')) return upgradePrompt('poster');
  const tg = curTarget(); if (!tg) return;
  const root = document.createElement('div'); root.id = 'print-root'; root.innerHTML = posterSvg(tg, posterStyle, siteLang());
  document.body.append(root); document.body.classList.add('printing');
  const done = () => { root.remove(); document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => { window.print(); setTimeout(done, 1500); }, 60);
};

/* ---------- asking customers for reviews (every plan) ---------- */
let askDraft = '';
const fill = (s, link) => s.replace(/\{biz\}/g, getBiz().name || '').replace(/\{link\}/g, link);
export function askSection() {
  const link = reviewUrl(); const fromGoogle = !!getBiz().place?.id;
  return html`<section class="card tool-card ask-card" id="ask">
    <div class="tool-head"><span class="tool-ic">${icon('star', 22)}</span><div><h2>${t('ask.title')}</h2><p class="muted">${t('ask.sub')}</p></div></div>
    ${link ? html`<div class="ask-link"><code>${link.replace(/^https:\/\//, '').slice(0, 64)}${link.length > 72 ? '…' : ''}</code>
        <button class="btn btn-secondary btn-sm" data-act="ask-copy-link">${icon('copy', 15)} ${t('ask.copyLink')}</button>
        <a class="btn btn-ghost btn-sm" href="${link}" target="_blank" rel="noopener">${icon('external', 15)} ${t('ask.test')}</a>
        ${fromGoogle ? '' : html`<button class="btn btn-ghost btn-sm" data-act="ask-link-clear">${t('ask.change')}</button>`}</div>
      <ol class="ask-msgs">${ta('ask.tpl').map((m, i) => { const txt = fill(m.text, link); return html`<li><b>${m.label}</b><p>${txt}</p>
        <div class="btn-row"><a class="btn btn-primary btn-sm" href="https://wa.me/?text=${encodeURIComponent(txt)}" target="_blank" rel="noopener">${icon('share', 15)} WhatsApp</a>
          <a class="btn btn-secondary btn-sm" href="sms:?&body=${encodeURIComponent(txt)}">${icon('reply', 15)} SMS</a>
          <button class="btn btn-ghost btn-sm" data-act="ask-copy" data-i="${i}">${icon('copy', 15)} ${t('actions.copy')}</button></div></li>`; })}</ol>
      <ul class="ask-tips">${ta('ask.tips').map((x) => html`<li>${icon('check', 14)} ${x}</li>`)}</ul>`
    : html`<form class="ask-form" data-ask-form novalidate><label class="field"><span>${t('ask.linkLabel')}</span>
        <input type="url" data-in="ask-link" value="${askDraft}" placeholder="https://g.page/r/…/review" maxlength="300" inputmode="url"></label>
        <button type="submit" class="btn btn-primary">${t('ask.save')}</button></form>
      <p class="muted small">${icon('info', 14)} ${t('ask.linkHow')}</p>`}
  </section>`;
}
inputs['ask-link'] = (el) => { askDraft = el.value.slice(0, 300); };
document.addEventListener('submit', (e) => {
  if (!e.target.matches?.('[data-ask-form]')) return;
  e.preventDefault();
  const v = cleanReviewLink(e.target.querySelector('input')?.value);
  if (!v) return toast(t('ask.bad'), 'error');
  update((s) => ({ business: { ...s.business, reviewLink: v } })); askDraft = '';
  toast(t('ask.saved'), 'success'); rerender();
});
actions['ask-link-clear'] = () => { askDraft = getBiz().reviewLink; update((s) => ({ business: { ...s.business, reviewLink: '' } })); rerender(); };
actions['ask-copy-link'] = async () => { const ok = await copyText(reviewUrl()); toast(t(ok ? 'common.copied' : 'common.copyFailed'), ok ? 'success' : 'error'); };
actions['ask-copy'] = async (el) => { const m = ta('ask.tpl')[Number(el.dataset.i)]; if (!m) return; const ok = await copyText(fill(m.text, reviewUrl())); toast(t(ok ? 'common.copied' : 'common.copyFailed'), ok ? 'success' : 'error'); };
