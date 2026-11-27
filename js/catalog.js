// Custom Premium catalog: website tiers (paid once), the monthly fee and the extras, each extra with a short
// explanation, a small before/after example built in HTML, and a clip. Also a full-screen presentation of the
// extras, for showing a business owner on a phone. Prices in euro live here; the words live in the locales (catalog.*).
import { html, icon } from './core.js';
import { t, ta, getLang } from './i18n.js';

export const MONTHLY = 74.99;
export const SETUP_FROM = 100;
const TIERS = [{ id: 'start', from: 100, to: 250 }, { id: 'plus', from: 250, to: 450 }, { id: 'pro', from: 450 }];
// [id, price, unit] — unit: once (default) | month | from | own (the client pays the provider directly); price 0 = included
export const EXTRAS = [['domain', 0, 'own'], ['email', 3, 'month'], ['page', 25], ['lang', 5], ['logo', 50], ['photo', 50, 'from'], ['edit', 10], ['audit', 49], ['redesign', 100, 'from']];
const CLIPS = new Set(['domain', 'email', 'page', 'lang', 'logo', 'photo', 'edit']); // extras that have a clip in /media

const money = (n) => n.toLocaleString(getLang(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const extraPrice = ([, n, unit]) => (unit === 'own' ? t('catalog.own') : n ? t(`catalog.${unit || 'once'}`, { p: n }) : t('catalog.included'));
const ba = (before, after) => html`<div class="xd-ba"><div class="xd-side is-before"><span class="xd-lbl">${t('catalog.before')}</span>${before}</div>
  <span class="xd-arrow" aria-hidden="true">${icon('next', 18)}</span><div class="xd-side is-after"><span class="xd-lbl">${t('catalog.after')}</span>${after}</div></div>`;

/** A small, original before/after picture of what one extra does. Fictional example business: Cafeneaua Aurora. */
export function demo(id) {
  const D = (k) => t(`catalog.demo.${k}`);
  const body = {
    domain: () => ba(html`<div class="xd-url">arcton.site/s/cafeneaua-aurora</div>`, html`<div class="xd-url">${icon('lock', 14)}<b>cafeneauaaurora.ro</b></div>`),
    email: () => ba(html`<div class="xd-mail"><small>${D('from')}</small><span>aurora.cafea1987@yahoo.com</span></div>`, html`<div class="xd-mail"><small>${D('from')}</small><b>contact@cafeneauaaurora.ro</b></div>`),
    page: () => html`<div class="xd-site"><div class="xd-tabs"><span>${D('home')}</span><span>${D('menu')}</span><span class="is-new">+ ${D('events')}</span></div>
      <div class="xd-blocks is-after"><b>${D('eventsTitle')}</b><i></i><i></i><i class="short"></i></div></div>`,
    lang: () => html`<div class="xd-site"><div class="xd-tabs"><span>Aurora</span><span class="xd-pill"><em>RO</em><em class="is-after is-on">EN</em></span></div>
      <p class="xd-h">Cafea de specialitate în Copou</p><p class="xd-h is-after xd-en">Specialty coffee in Copou</p></div>`,
    logo: () => ba(html`<div class="xd-logo-plain">Cafeneaua Aurora</div>`, html`<div class="xd-logo"><span class="xd-mark" aria-hidden="true"><i></i></span><span><b>AURORA</b><small>${D('logoSub')}</small></span></div>`),
    photo: () => ba(html`<div class="xd-photo is-dull"></div><small class="xd-cap">${D('photoBefore')}</small>`, html`<div class="xd-photo is-pro"><i></i></div><small class="xd-cap">${D('photoAfter')}</small>`),
    audit: () => html`<ul class="xd-audit">${ta('catalog.demo.auditRows').map((r, i) => html`<li class="${i === 2 ? 'is-fix' : ''}">${icon(i === 2 ? 'info' : 'check', 14)}<span>${r}</span></li>`)}</ul>`,
    edit: () => html`<div class="xd-edit"><p class="xd-bubble"><small>${D('you')}</small>${D('editAsk')}</p>
      <div class="xd-price-row"><span>Cappuccino</span><s>12 lei</s><b class="is-after">14 lei</b></div></div>`,
  }[id];
  return body ? html`<div class="xd xd--${id}" aria-hidden="true">${body()}</div>` : '';
}

const clip = (id) => !CLIPS.has(id) ? '' : html`<video class="xd-video" controls preload="none" playsinline poster="/media/extra-${id}.jpg" aria-label="${t('catalog.clip', { name: t(`catalog.extras.${id}`) })}"><source src="/media/extra-${id}.mp4" type="video/mp4"></video>`;

/** What Custom Premium includes and costs: website tiers (paid once), the monthly fee, extras that open with an example. */
export function catalog() {
  const tierPrice = (x) => (x.to ? t('catalog.range', { from: x.from, to: x.to }) : t('catalog.from', { p: x.from }));
  return html`<details class="catalog card" id="catalog"><summary><span>${t('catalog.summary')}</span>${icon('down', 18)}</summary>
    <p class="catalog-intro">${t('catalog.intro', { monthly: money(MONTHLY) })}</p>
    <h3>${t('catalog.setupTitle')}</h3>
    <div class="catalog-tiers">${TIERS.map((x) => html`<article class="catalog-tier"><h4>${t(`catalog.tiers.${x.id}.name`)}</h4><p class="catalog-price">${tierPrice(x)}</p><p class="muted small">${t(`catalog.tiers.${x.id}.for`)}</p>
      <ul>${ta(`catalog.tiers.${x.id}.features`).map((f) => html`<li>${icon('check', 16)}<span>${f}</span></li>`)}</ul></article>`)}</div>
    <h3>${t('catalog.monthlyTitle', { monthly: money(MONTHLY) })}</h3>
    <ul class="catalog-list">${ta('catalog.monthly').map((f) => html`<li>${icon('check', 16)}<span>${f}</span></li>`)}</ul>
    <div class="catalog-x-head"><h3>${t('catalog.extrasTitle')}</h3><button type="button" class="btn btn-secondary btn-sm" data-present>${icon('play', 16)} ${t('catalog.present')}</button></div>
    <p class="muted small catalog-x-hint">${t('catalog.extrasHint')}</p>
    <div class="catalog-extras">${EXTRAS.map((e) => html`<details class="xrow"><summary><span>${t(`catalog.extras.${e[0]}`)}</span><b>${extraPrice(e)}</b>${icon('down', 16)}</summary>
      <div class="xrow-body"><p>${t(`catalog.info.${e[0]}`)}</p>${demo(e[0])}${clip(e[0])}</div></details>`)}</div>
    <ul class="catalog-promises">${ta('catalog.promises').map((f) => html`<li>${icon('check', 16)}<span>${f}</span></li>`)}</ul>
    <ul class="catalog-notes muted small">${ta('catalog.notes').map((f) => html`<li>${f}</li>`)}</ul>
  </details>`;
}

/** Full-screen presentation of the extras: one per screen, swipe or arrows. */
export function openPresentation() {
  if (document.getElementById('xp')) return;
  const last = document.activeElement;
  const n = EXTRAS.length;
  const box = document.createElement('div');
  box.id = 'xp'; box.className = 'xp'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'xp-title');
  box.innerHTML = html`<div class="xp-top"><img src="/icons/logo.svg" alt="" width="28" height="28"><h2 id="xp-title">${t('catalog.presentTitle')}</h2>
      <button type="button" class="icon-btn" data-xp="close" aria-label="${t('common.close')}">${icon('x')}</button></div>
    <div class="xp-track" tabindex="0">${EXTRAS.map((e, i) => html`<section class="xp-slide" aria-label="${i + 1} / ${n}">
      <p class="xp-count">${i + 1} / ${n}</p><h3>${t(`catalog.extras.${e[0]}`)}</h3><p class="xp-price">${extraPrice(e)}</p>
      <p class="xp-info">${t(`catalog.info.${e[0]}`)}</p>${demo(e[0])}${clip(e[0])}</section>`)}</div>
    <div class="xp-nav"><button type="button" class="btn btn-ghost" data-xp="prev">${icon('prev', 18)} ${t('catalog.prev')}</button>
      <div class="xp-dots">${EXTRAS.map((e, i) => html`<button type="button" data-xp="go" data-i="${i}" aria-label="${t(`catalog.extras.${e[0]}`)}"></button>`)}</div>
      <button type="button" class="btn btn-primary" data-xp="next">${t('catalog.next')} ${icon('next', 18)}</button></div>`.s;
  document.body.appendChild(box); document.documentElement.classList.add('xp-open');
  const track = box.querySelector('.xp-track'); const dots = [...box.querySelectorAll('.xp-dots button')];
  const at = () => Math.round(track.scrollLeft / track.clientWidth);
  const go = (i) => track.scrollTo({ left: Math.max(0, Math.min(n - 1, i)) * track.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  const mark = () => { const i = at(); dots.forEach((d, k) => d.setAttribute('aria-current', k === i ? 'true' : 'false')); box.querySelectorAll('video').forEach((v, k) => k !== i && v.pause()); };
  const close = () => { box.remove(); document.documentElement.classList.remove('xp-open'); document.removeEventListener('keydown', key, true); if (location.hash === '#prezentare') history.replaceState(null, '', location.pathname); last?.focus?.(); };
  const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } else if (e.key === 'ArrowRight') go(at() + 1); else if (e.key === 'ArrowLeft') go(at() - 1); };
  box.addEventListener('click', (e) => { const b = e.target.closest('[data-xp]'); if (!b) return; const k = b.dataset.xp; if (k === 'close') close(); else if (k === 'next') go(at() + 1); else if (k === 'prev') go(at() - 1); else go(+b.dataset.i); });
  track.addEventListener('scroll', () => requestAnimationFrame(mark), { passive: true });
  document.addEventListener('keydown', key, true); mark(); box.querySelector('[data-xp="close"]').focus();
}
document.addEventListener('click', (e) => { if (e.target.closest('[data-present]')) openPresentation(); });
