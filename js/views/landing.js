// Public front page: what a visitor sees when nobody is signed in (after launch day).
// It explains Arcton Ai in one screen, shows the three steps, the plans and the questions people ask,
// and leads to "Create a free account". Everything on the hero mock-up is the fictional example café, and says so.
import { html, icon } from '../core.js';
import { t, ta, LANGS, getLang, setLang } from '../i18n.js';
import { BRAND } from '../brand.js';
import { openLegal } from '../legalText.js';
import { PLANS } from './plans.js';
import { mountain } from '../mountain.js';

let handlers = { signup() {}, signin() {} };
let shown = false;
let io = null;

const STEPS = ['observe', 'analyse', 'act'];
const FEATURES = [['diagnosis', 'diagnosis'], ['website', 'website'], ['compare', 'competitors'], ['pack', 'studio'], ['reply', 'replies'], ['sparkle', 'chat']];
const FAQ = ['tech', 'data', 'ai', 'price', 'cancel', 'fit'];

function langSelect() {
  return html`<label class="lang"><span class="sr-only">${t('settings.language')}</span>${icon('globe', 16)}<select data-land-lang aria-label="${t('settings.language')}">${LANGS.map((l) => html`<option value="${l.code}" ${getLang() === l.code ? 'selected' : ''}>${l.label}</option>`)}</select></label>`;
}

/** The hero picture: the orb with three glass cards from the example café. Built from HTML, so it is sharp and follows the language. */
function heroVisual() {
  return html`<div class="lp-visual" aria-hidden="true">
    ${mountain([{ label: t('journey.observe'), sub: `218 ${t('land.v.read').toLowerCase()}` }, { label: t('journey.diagnose'), sub: t('land.v.conf') }, { label: t('journey.act'), sub: t('land.v.moveText') }].map((x, i) => ({ ...x, done: i < 2 })), 2, { links: false })}
    <div class="lp-float lp-f3"><p class="lp-k">${t('land.v.rating')}</p><p class="lp-rate"><b>4,6</b><span>→</span><b class="up">4,7</b></p><p class="lp-k2">${t('land.v.requests')}</p></div>
    <p class="lp-caption">${t('land.v.caption')}</p>
  </div>`;
}

function render() {
  const year = new Date().getFullYear();
  return html`<div class="lp">
  <header class="lp-nav"><div class="lp-nav-in">
    <a class="lp-brand" href="/" data-land="top"><img src="/icons/logo.svg" alt="" width="34" height="34"><strong>${BRAND.app}</strong></a>
    <nav class="lp-links" aria-label="${t('land.navAria')}">${['how', 'plans', 'faq'].map((k) => html`<button type="button" class="lp-link" data-land="to" data-to="${k}">${t(`land.nav.${k}`)}</button>`)}</nav>
    <div class="lp-tools">${langSelect()}<button type="button" class="btn btn-ghost btn-sm lp-signin" data-land="signin">${t('land.signin')}</button>
      <button type="button" class="btn btn-primary btn-sm" data-land="signup">${t('land.ctaShort')}</button></div>
  </div></header>

  <main id="main" tabindex="-1">
  <section class="lp-hero" id="top">
    <div class="lp-hero-copy">
      <p class="eyebrow">${t('land.eyebrow')}</p>
      <h1>${t('land.h1a')}<span>${t('land.h1b')}</span></h1>
      <p class="lp-lede">${t('land.lede')}</p>
      <div class="lp-cta"><button type="button" class="btn btn-primary btn-lg" data-land="signup">${t('land.cta')} ${icon('next', 18)}</button></div>
      <p class="lp-note">${icon('check', 15)} ${t('land.note')}</p>
    </div>
    ${heroVisual()}
  </section>

  <section class="lp-sec lp-how" id="how" aria-labelledby="how-h">
    <div class="lp-sec-head"><p class="eyebrow">${t('land.how.eyebrow')}</p><h2 id="how-h">${t('land.how.title')}</h2></div>
    <ol class="lp-steps">${STEPS.map((k, i) => html`<li class="lp-reveal" style="--d:${i * 90}ms"><span class="lp-n">${['I', 'II', 'III'][i]}</span><h3>${t(`land.how.${k}`)}</h3><p>${t(`land.how.${k}Body`)}</p></li>`)}</ol>
  </section>

  <section class="lp-sec" aria-labelledby="feat-h">
    <div class="lp-sec-head"><p class="eyebrow">${t('land.feat.eyebrow')}</p><h2 id="feat-h">${t('land.feat.title')}</h2></div>
    <div class="lp-feats">${FEATURES.map(([ic, k], i) => html`<article class="lp-feat lp-reveal ${i === 0 || i === 1 ? 'is-wide' : ''}" style="--d:${(i % 3) * 80}ms"><span class="lp-ic">${icon(ic, 22)}</span><h3>${t(`land.feat.${k}`)}</h3><p>${t(`land.feat.${k}Body`)}</p></article>`)}</div>
  </section>

  <section class="lp-truth lp-reveal" aria-labelledby="truth-h">
    <p class="eyebrow">${t('land.truth.eyebrow')}</p>
    <h2 id="truth-h">${t('land.truth.title')}</h2>
    <p class="lp-truth-body">${t('land.truth.body')}</p>
    <ul>${['p1', 'p2', 'p3'].map((k) => html`<li>${icon('check', 18)}<span>${t(`land.truth.${k}`, { company: BRAND.company })}</span></li>`)}</ul>
  </section>

  <section class="lp-sec" id="plans" aria-labelledby="plans-h">
    <div class="lp-sec-head"><p class="eyebrow">${t('land.plans.eyebrow')}</p><h2 id="plans-h">${t('land.plans.title')}</h2><p class="lp-sub">${t('land.plans.sub')}</p></div>
    <div class="lp-plans">${PLANS.map((p) => html`<article class="lp-plan lp-reveal ${p.featured ? 'is-featured' : ''}">
      ${p.featured ? html`<span class="lp-flag">${t('plans.popular')}</span>` : ''}
      <h3>${t(`plans.${p.id}.name`)}</h3><p class="lp-for">${t(`plans.${p.id}.for`)}</p>
      <p class="lp-price"><b>€${p.price}</b><span>${t('plans.perMonth')}</span></p>
      <ul>${ta(`plans.${p.id}.features`).map((f) => html`<li>${icon('check', 16)}<span>${f}</span></li>`)}</ul>
      <button type="button" class="btn ${p.featured ? 'btn-primary' : 'btn-secondary'}" data-land="signup">${t(p.price ? 'land.plans.start' : 'land.plans.free')}</button></article>`)}</div>
    <p class="lp-pay">${icon('info', 16)} ${t('land.plans.pay')}</p>
  </section>

  <section class="lp-sec lp-faq" id="faq" aria-labelledby="faq-h">
    <div class="lp-sec-head"><p class="eyebrow">${t('land.faq.eyebrow')}</p><h2 id="faq-h">${t('land.faq.title')}</h2></div>
    <div class="lp-qs">${FAQ.map((k) => html`<details><summary>${t(`land.faq.${k}`)}<span class="lp-plus" aria-hidden="true"></span></summary><p>${t(`land.faq.${k}A`)}</p></details>`)}</div>
  </section>

  <section class="lp-final lp-reveal">
    <h2>${t('land.final.title')}</h2><p>${t('land.final.body')}</p>
    <button type="button" class="btn btn-primary btn-lg" data-land="signup">${t('land.cta')} ${icon('next', 18)}</button>
  </section>
  </main>

  <footer class="lp-foot"><div class="lp-foot-in">
    <div class="lp-foot-brand"><img src="/icons/logo.svg" alt="" width="32" height="32"><div><strong>${BRAND.app}</strong><span>${t('land.footTag')}</span></div></div>
    <ul class="lp-legal">${['terms', 'privacy', 'ai', 'cookies'].map((d) => html`<li><button type="button" class="link-btn" data-land="legal" data-doc="${d}">${t(`legal.${d}`)}</button></li>`)}</ul>
    <p class="lp-copy">© ${year} ${BRAND.company}${BRAND.cui ? ` · CUI ${BRAND.cui}` : ''}${BRAND.regNo ? ` · ${BRAND.regNo}` : ''}</p>
  </div></footer>
  </div>`;
}

function reveal() {
  io?.disconnect();
  const els = document.querySelectorAll('.lp-reveal');
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) { els.forEach((e) => e.classList.add('is-in')); return; }
  io = new IntersectionObserver((list) => list.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach((e) => io.observe(e));
}

function paint() {
  const app = document.getElementById('app'); if (!app) return;
  document.body.dataset.route = 'landing';
  document.title = `${BRAND.app} · ${t('land.titleTag')}`;
  app.innerHTML = render().s;
  reveal();
}

/** Show the front page. opts: { signup(), signin(), example() } */
export function showLanding(opts = {}) {
  handlers = { ...handlers, ...opts };
  shown = true; paint(); window.scrollTo(0, 0);
}
export function hideLanding() { shown = false; io?.disconnect(); }
export function repaintLanding() { if (shown) { const y = window.scrollY; paint(); window.scrollTo(0, y); } }

document.addEventListener('click', (e) => {
  if (!shown) return;
  const b = e.target.closest('[data-land]'); if (!b) return;
  const k = b.dataset.land;
  if (k === 'legal') return openLegal(b.dataset.doc);
  if (k === 'top') { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  if (k === 'to') { document.getElementById(b.dataset.to)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); return; }
  if (handlers[k]) { hideLanding(); handlers[k](); }
});
document.addEventListener('change', (e) => { if (shown && e.target.matches('[data-land-lang]')) setLang(e.target.value); });
