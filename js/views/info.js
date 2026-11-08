// Info centre: what Arcton Ai is, what is coming, questions and answers, contact and company details, legal texts.
// Tabs live in the address (#/info?faq, #/info?privacy …) so every section can be linked to.
import { html, raw, icon, toast, copyText } from '../core.js';
import { t, ta } from '../i18n.js';
import { pageHead } from './shared.js';
import { BRAND, LEGAL_VERSION, contactEmail } from '../brand.js';
import { LEGAL_DOCS, legalBody } from '../legalText.js';
import { consentRecord, showConsent } from '../legal.js';
import { actions, inputs } from '../registry.js';
import { supportEmail } from '../auth.js';

const TABS = ['about', 'roadmap', 'faq', 'contact', 'legal'];
const TAB_ICON = { about: 'help', roadmap: 'mission', faq: 'info', contact: 'share', legal: 'check' };
const VALUES = [['eye', 'v1'], ['sparkle', 'v2'], ['check', 'v3'], ['account', 'v4']];
const ROAD = [['now', 'r1'], ['now', 'r2'], ['next', 'r3'], ['next', 'r4'], ['next', 'r5'], ['later', 'r6'], ['later', 'r7'], ['later', 'r8']];
const FAQ_N = 12;
let faqQ = '';

const current = () => {
  const q = (location.hash.split('?')[1] || 'about').split('&')[0];
  if (LEGAL_DOCS.includes(q)) return { tab: 'legal', doc: q };
  if (q === 'legal') return { tab: 'legal', doc: 'terms' };
  return { tab: TABS.includes(q) ? q : 'about', doc: 'terms' };
};
const mail = () => contactEmail() || supportEmail();

function about() {
  return html`<section class="info-hero"><div><p class="tag">${BRAND.company}</p><h2>${t('info.heroTitle')}</h2><p>${t('info.heroBody', { app: BRAND.app })}</p><p>${t('info.heroBody2')}</p></div>
      <div class="hero-mark" aria-hidden="true"><img src="/icons/logo.svg" alt="" width="260" height="260"></div></section>
    <h2>${t('info.howTitle')}</h2>
    <div class="info-grid">${['observe', 'diagnose', 'act'].map((s, i) => html`<article class="card info-card"><span class="info-ic">${i + 1}</span><h3>${t(`journey.${s}`)}</h3><p>${t(`info.how.${s}`)}</p></article>`)}</div>
    <h2>${t('info.valuesTitle')}</h2>
    <div class="info-grid">${VALUES.map(([ic, k]) => html`<article class="card info-card"><span class="info-ic">${icon(ic, 18)}</span><h3>${t(`info.${k}t`)}</h3><p>${t(`info.${k}`)}</p></article>`)}</div>`;
}

function roadmap() {
  return html`<p class="muted">${t('info.roadIntro')}</p>
    <ol class="road">${ROAD.map(([st, k]) => html`<li><span class="road-when">${t(`info.when.${st}`)}</span><div><h3>${t(`info.${k}t`)} <span class="road-st ${st}">${t(`info.st.${st}`)}</span></h3><p>${t(`info.${k}`)}</p></div></li>`)}</ol>
    <p class="muted small" style="margin-top:16px">${t('info.roadIdea')}${mail() ? html` <a href="mailto:${mail()}?subject=${encodeURIComponent(`${BRAND.app} idea`)}">${mail()}</a>` : ''}</p>`;
}

function faq() {
  const q = faqQ.trim().toLowerCase();
  const items = Array.from({ length: FAQ_N }, (_, i) => [t(`info.faq.q${i + 1}`), t(`info.faq.a${i + 1}`)]).filter(([a, b]) => !q || `${a} ${b}`.toLowerCase().includes(q));
  return html`<label class="field faq-search"><span>${t('info.faqSearch')}</span><input type="search" data-in="faq-q" value="${faqQ}" placeholder="${t('info.faqPh')}" autocomplete="off"></label>
    <div class="faq" id="faq-list">${items.length ? items.map(([a, b]) => html`<details><summary>${a}</summary><p>${b}</p></details>`) : html`<p class="muted">${t('info.faqNone')}</p>`}</div>`;
}

function contact() {
  const m = mail();
  const rows = [['company', BRAND.company], ['cui', BRAND.cui], ['regNo', BRAND.regNo], ['address', BRAND.address], ['country', BRAND.country], ['email', m], ['privacy', BRAND.privacyEmail], ['dpo', BRAND.dpo]].filter(([, v]) => v);
  return html`<div class="info-grid">
    <article class="card info-card"><span class="info-ic">${icon('share', 18)}</span><h3>${t('info.contactTitle')}</h3><p>${t(m ? 'info.contactBody' : 'info.contactNone')}</p>
      ${m ? html`<div class="btn-row"><a class="btn btn-primary btn-sm" href="mailto:${m}">${icon('share', 15)} ${m}</a><button class="btn btn-ghost btn-sm" data-act="copy-mail" data-mail="${m}">${icon('copy', 15)} ${t('actions.copy')}</button></div>` : ''}</article>
    <article class="card info-card"><span class="info-ic">${icon('check', 18)}</span><h3>${t('info.companyTitle')}</h3><dl class="company">${rows.map(([k, v]) => html`<dt>${t(`info.co.${k}`)}</dt><dd>${v}</dd>`)}</dl></article>
    <article class="card info-card"><span class="info-ic">${icon('eye', 18)}</span><h3>${t('info.privacyTitle')}</h3><p>${t('info.privacyBody')}</p>
      <div class="btn-row"><a class="btn btn-secondary btn-sm" href="#/info?privacy">${t('legal.privacy')}</a><a class="btn btn-ghost btn-sm" href="#/settings?data">${t('settings.yourData')}</a></div></article>
  </div>`;
}

function legal(doc) {
  const rec = consentRecord();
  return html`<div class="legal-nav" role="tablist">${LEGAL_DOCS.map((d) => html`<a class="btn btn-sm ${d === doc ? 'btn-primary' : 'btn-secondary'}" role="tab" aria-selected="${d === doc}" href="#/info?${d}">${t(`legal.${d}`)}</a>`)}</div>
    <p class="legal-note">${rec ? t('legal.acceptedOn', { date: new Date(rec.at || Date.now()).toLocaleDateString(), version: rec.v }) : html`${t('legal.notAccepted')} <button class="link-btn" data-act="consent-open">${t('consent.accept')}</button>`}</p>
    <article class="card" style="padding:clamp(18px,3vw,32px)">${legalBody(doc)}</article>
    <div class="btn-row" style="margin-top:14px"><button class="btn btn-ghost btn-sm" data-act="legal-print">${icon('download', 15)} ${t('legal.print')}</button></div>`;
}

export const info = {
  id: 'info',
  render() {
    const { tab, doc } = current();
    const body = { about, roadmap, faq, contact, legal: () => legal(doc) }[tab]();
    return html`${pageHead({ title: t('info.title', { app: BRAND.app }), sub: t('info.sub') })}
      <nav class="info-tabs" aria-label="${t('info.title', { app: BRAND.app })}">${TABS.map((k) => html`<a href="#/info?${k}" ${raw(tab === k ? 'aria-current="page"' : '')}>${icon(TAB_ICON[k], 16)} ${t(`info.tab.${k}`)}</a>`)}</nav>
      ${body}`;
  },
};

inputs['faq-q'] = (el) => {
  faqQ = el.value.slice(0, 80);
  const list = document.getElementById('faq-list'); if (!list) return;
  const q = faqQ.trim().toLowerCase();
  const items = Array.from({ length: FAQ_N }, (_, i) => [t(`info.faq.q${i + 1}`), t(`info.faq.a${i + 1}`)]).filter(([a, b]) => !q || `${a} ${b}`.toLowerCase().includes(q));
  list.innerHTML = (items.length ? html`${items.map(([a, b]) => html`<details ${q ? 'open' : ''}><summary>${a}</summary><p>${b}</p></details>`)}` : html`<p class="muted">${t('info.faqNone')}</p>`).s;
};
actions['copy-mail'] = async (el) => { const ok = await copyText(el.dataset.mail); toast(ok ? t('common.copied') : t('common.copyFailed'), ok ? 'success' : 'error'); };
actions['consent-open'] = () => { location.hash = '#/overview'; setTimeout(showConsent, 50); };
actions['legal-print'] = () => window.print();
export { LEGAL_VERSION };
