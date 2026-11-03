import { html, icon, toast, limit } from '../core.js';
import { t, fmtDate } from '../i18n.js';
import { getState } from '../store.js';
import { getBiz } from '../business.js';
import { actions, inputs, rerender } from '../registry.js';
import { pageHead, scanCard } from './shared.js';
import { scan, addNotes, removeNote, hasSignals, NOTE_KINDS } from '../collect.js';
import { signalList, SITE_KEYS } from '../insights.js';
import { serverCaps } from '../sources.js';

let filter = 'all';
let caps = null;
const form = { text: '', kind: 'review', source: '' };
const TYPES = ['review', 'question', 'comment', 'message', 'website'];
const TYPE_ICON = { review: 'star', question: 'help', comment: 'share', message: 'share', website: 'website' };
const stars = (n) => html`<span class="stars-sm" aria-label="${n}/5">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`;

function sourceCards() {
  const s = getState().signals || {}; const b = getBiz(); const err = s.errors || {};
  const g = s.google; const site = s.site; const th = s.themes;
  const card = (ic, title, body, ok) => html`<div class="src-card ${ok ? 'ok' : ''}"><span class="src-ic">${icon(ic, 18)}</span><div><strong>${title}</strong><small>${body}</small></div></div>`;
  return html`<div class="src-cards">
    ${card('star', 'Google', !b.place ? t('signals.googleNotLinked') : err.google ? t(`signals.err.${err.google === 'places_not_configured' ? 'places' : 'failed'}`) : g ? t('signals.googleOk', { r: g.rating ?? '–', n: g.reviewCount ?? 0, m: (g.reviews || []).length }) : t('signals.pending'), !!g)}
    ${card('website', t('signals.siteCheck'), !b.website ? t('signals.noWebsiteShort') : err.website ? t('signals.err.failed') : site ? (site.error ? t('signals.siteError') : t('signals.siteOk', { score: site.score })) : t('signals.pending'), !!site && !site.error)}
    ${card('upload', t('signals.yourNotes'), t('signals.notesN', { n: s.notes?.length || 0 }), (s.notes?.length || 0) > 0)}
    ${card('sparkle', t('signals.themes'), th?.items?.length ? t('signals.themesN', { n: th.items.length }) : th?.mode === 'none' ? t('signals.themesNoAi') : t('signals.themesNeed'), !!th?.items?.length)}
  </div>`;
}

function addForm() {
  return html`<form class="card note-form" data-note-form novalidate><h2 class="card-title">${t('signals.addTitle')}</h2>
    <p class="muted small">${t('signals.addBody')}</p>
    <label class="field"><span>${t('signals.addText')}</span><textarea id="note-text" data-in="note-text" rows="4" maxlength="20000" placeholder="${t('signals.addPh')}">${form.text}</textarea></label>
    <div class="field-pair"><label class="field"><span>${t('signals.addKind')}</span><select data-in="note-kind">${NOTE_KINDS.map((k) => html`<option value="${k}" ${form.kind === k ? 'selected' : ''}>${t(`signals.kind.${k}`)}</option>`)}</select></label>
      <label class="field"><span>${t('signals.addSource')}</span><input type="text" data-in="note-source" value="${form.source}" maxlength="40" placeholder="${t('signals.addSourcePh')}" list="note-sources"></label></div>
    <datalist id="note-sources">${['Google', 'Instagram', 'Facebook', 'TikTok', 'WhatsApp', 'Email', t('signals.inPerson')].map((x) => html`<option value="${x}">`)}</datalist>
    <div class="btn-row"><button type="submit" class="btn btn-primary">${icon('check', 18)} ${t('signals.addOk')}</button>
      <button type="button" class="btn btn-ghost" data-act="csv-import">${icon('upload', 18)} ${t('signals.importCsv')}</button></div></form>`;
}

function siteChecklist() {
  const site = getState().signals?.site;
  if (!site || site.error) return '';
  return html`<details class="card site-checks"><summary><span class="tag">${t('signals.siteDetails', { score: site.score })}</span></summary>
    <p class="muted small">${site.url} · ${site.ms} ms · ${site.kb} KB${site.checkedAt ? ` · ${fmtDate(site.checkedAt)}` : ''}</p>
    <ul class="check-list">${SITE_KEYS.filter((k) => k in site.checks).map((k) => html`<li class="${site.checks[k] ? 'pass' : 'fail'}">${icon(site.checks[k] ? 'check' : 'x', 15)}<span><strong>${t(`check.${k}.label`)}</strong>${site.checks[k] ? '' : html`<small>${t(`check.${k}.fix`)}</small>`}</span></li>`)}</ul></details>`;
}

export const signals = {
  id: 'signals',
  render() {
    const st = getState();
    const head = pageHead({ title: t('signals.title'), sub: t('signals.sub'),
      actions: st.business.loaded ? html`<button class="btn btn-primary" data-act="collect-signals" ${scan.active ? 'disabled' : ''}>${icon('refresh', 18)} ${t(hasSignals() ? 'collect.refresh' : 'start.collectSignals')}</button>` : '' });
    if (!st.business.loaded) {
      return html`${head}<section class="card empty-hero"><div class="empty-ic">${icon('signals', 34)}</div><h2>${t('start.noBusinessTitle')}</h2><p class="muted">${t('start.noBusinessBody')}</p>
        <button class="btn btn-primary btn-lg" data-act="go" data-route="overview">${t('start.goCollect')}</button></section>`;
    }
    if (scan.active) return html`${head}${scanCard()}`;
    const every = signalList();
    const list = every.filter((s) => filter === 'all' || s.type === filter);
    return html`${head}
    ${hasSignals() ? sourceCards() : html`<section class="card"><p>${t('collect.intro')}</p></section>`}
    <div class="sig-split">
      <div>
        ${every.length ? html`<div class="sig-filters" role="group" aria-label="${t('signals.filter')}">
          ${['all', ...TYPES].map((k) => { const n = k === 'all' ? every.length : every.filter((s) => s.type === k).length;
            return n || k === 'all' ? html`<button class="sig-filter" aria-pressed="${filter === k}" data-act="filter-signals" data-type="${k}">${k === 'all' ? '' : icon(TYPE_ICON[k], 16)}${t(`signals.type.${k}`)}<b>${n}</b></button>` : ''; })}
        </div>` : ''}
        ${list.length ? html`<div class="sig-board">${list.map((s, i) => html`
          <article class="sig-card" data-type="${s.type}" style="--i:${i}">
            <div class="sig-top"><span class="sig-type">${icon(TYPE_ICON[s.type] || 'signals', 16)}${t(`signals.type.${s.type}`)}</span>${s.rating ? stars(s.rating) : ''}
              ${s.user ? html`<button class="icon-btn sig-x" data-act="remove-note" data-id="${s.id}" aria-label="${t('signals.remove')}">${icon('x', 15)}</button>` : ''}</div>
            <blockquote class="sig-quote">${s.text}</blockquote>
            <div class="sig-foot"><span class="sig-src">${s.source}${s.author ? ` · ${s.author}` : ''}${s.when ? ` · ${s.when}` : ''}</span></div>
          </article>`)}</div>`
          : html`<div class="empty"><p>${t(every.length ? 'signals.empty' : 'signals.none')}</p>${every.length ? html`<button class="btn btn-secondary" data-act="filter-signals" data-type="all">${t('signals.showAll')}</button>` : ''}</div>`}
        ${siteChecklist()}
      </div>
      ${addForm()}
    </div>
    ${hasSignals() ? html`<section class="next-bar"><div><p class="tag">${t('journey.diagnose')} · ${t('ledger.nextStep')}</p><strong>${st.diagnosis ? t('diagnosis.title') : t('next.analysis')}</strong></div>
      ${st.diagnosis ? html`<button class="btn btn-primary btn-lg" data-act="go" data-route="diagnosis">${t('common.open')} ${icon('next', 18)}</button>`
        : html`<button class="btn btn-primary btn-lg" data-act="run-analysis-go">${icon('sparkle', 18)} ${t('actions.runAnalysis')}</button>`}</section>` : ''}`;
  },
  mount() { if (!caps) serverCaps().then((c) => { caps = c; }); },
};

actions['filter-signals'] = (el) => { filter = el.dataset.type; rerender(); };
actions['remove-note'] = (el) => { removeNote(el.dataset.id); rerender(); };
inputs['note-text'] = (el) => { form.text = el.value.slice(0, 20000); };
inputs['note-kind'] = (el) => { form.kind = el.value; };
inputs['note-source'] = (el) => { form.source = limit(el.value, 40); };
document.addEventListener('input', (e) => { if (e.target.matches?.('#note-text')) form.text = e.target.value.slice(0, 20000); });
document.addEventListener('submit', (e) => {
  if (!e.target.matches('[data-note-form]')) return;
  e.preventDefault();
  const n = addNotes(form.text, form.kind, form.source);
  if (!n) return toast(t('signals.addEmpty'), 'error');
  form.text = '';
  toast(t('signals.added', { n }), 'success'); rerender();
});

actions['csv-import'] = () => {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.csv,.txt,text/csv,text/plain';
  inp.onchange = async () => {
    const file = inp.files?.[0]; if (!file) return;
    if (file.size > 500_000) return toast(t('signals.csvTooBig'), 'error');
    try {
      const rows = (await file.text()).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (/^"?(text|review|comment|evidence|recenzie|avis)/i.test(rows[0])) rows.shift();
      const text = rows.slice(0, 100).map((r) => r.replace(/,\s*"?\d(\.\d)?"?\s*$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')).join('\n');
      const n = addNotes(text, form.kind, form.source || 'CSV');
      if (!n) return toast(t('signals.csvEmpty'), 'error');
      toast(t('signals.csvOk', { n }), 'success'); rerender();
    } catch (e) { console.error('[Arcton] csv', e); toast(t('common.errorGeneric'), 'error'); }
  };
  inp.click();
};
