import { html, icon, toast, limit, slug } from '../core.js';
import { t } from '../i18n.js';
import { getState, update } from '../store.js';
import { SIGNALS, SIGNAL_TYPES } from '../data.js';
import { socialSignals } from '../business.js';
import { actions, rerender } from '../registry.js';
import { pageHead, statusBadge, scanCard } from './shared.js';
import { scan } from '../collect.js';
import { meter } from '../charts.js';

let filter = 'all';
const TYPE_ICON = { review: 'star', social: 'share', question: 'help', website: 'website', search: 'signals' };

function allSignals() {
  const st = getState();
  const user = st.userSignals.map((s) => ({ ...s, type: 'review', status: 'live', user: true }));
  const ready = st.business.loaded && st.signalsCollected;
  const demo = ready ? [...SIGNALS, ...socialSignals().used].map((s) => ({ ...s, evidence: t(`d.${s.id}`) })) : [];
  return [...demo, ...user];
}

export const signals = {
  id: 'signals',
  render() {
    const st = getState();
    const collected = st.business.loaded && st.signalsCollected;
    const list = allSignals().filter((s) => filter === 'all' || s.type === filter);
    if (!collected && !list.length) {
      const head = pageHead({ note: '02', title: t('signals.title'), sub: t('signals.sub'),
        actions: html`<button class="btn btn-secondary" data-act="csv-import">${icon('upload', 18)} ${t('signals.importCsv')}</button>` });
      if (scan.active) return html`${head}${scanCard()}`;
      return html`${head}<section class="card empty-hero"><div class="empty-ic">${icon('signals', 34)}</div>
        <h2>${t(st.business.loaded ? 'start.signalsEmptyTitle' : 'start.noBusinessTitle')}</h2><p class="muted">${t(st.business.loaded ? 'start.signalsEmptyBody' : 'start.noBusinessBody')}</p>
        ${st.business.loaded
          ? html`<button class="btn btn-primary btn-lg" data-act="collect-signals">${icon('signals', 18)} ${t('start.collectSignals')}</button>`
          : html`<button class="btn btn-primary btn-lg" data-act="load-sample">${icon('plug', 18)} ${t('start.loadSample')}</button>`}</section>`;
    }
    return html`
    ${pageHead({ note: '02', title: t('signals.title'), sub: t('signals.sub'),
      actions: html`<button class="btn btn-secondary" data-act="csv-import">${icon('upload', 18)} ${t('signals.importCsv')}</button>
        <button class="btn btn-ghost" data-act="go" data-route="settings" data-hash="connected">${icon('plug', 18)} ${t('signals.connect')}</button>` })}
    <div class="chips" role="group" aria-label="${t('signals.filter')}">
      ${['all', ...SIGNAL_TYPES].map((k) => html`<button class="chip" aria-pressed="${filter === k}" data-act="filter-signals" data-type="${k}">${t(`signals.type.${k}`)}</button>`)}
    </div>
    <p class="muted small">${t('signals.legend')}</p>
    <div class="notice" role="note">${icon('info', 18)}<p>${t('signals.socialNote')}${socialSignals().skipped.length ? html` ${t('signals.socialMissing', { nets: socialSignals().skipped.map((n) => ({ instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook' }[n])).join(', ') })}` : ''}</p></div>
    ${list.length ? html`<div class="signal-list">${list.map((s, i) => html`
      <article class="signal ${s.user ? 'signal-user' : ''}" style="--i:${i}">
        <div class="signal-ic">${icon(TYPE_ICON[s.type] || 'signals', 22)}</div>
        <div class="signal-body">
          <div class="signal-top"><span class="tag">${t(`signals.type.${s.type}`)} · ${s.source}</span>${statusBadge(s.status)}${s.user ? html`<span class="badge badge-user">${t('signals.userData')}</span>` : ''}</div>
          <p class="evidence">“${s.evidence}”</p>
          <div class="signal-conf has-src" tabindex="0" data-src="confidence"><span class="label-mono">${t('common.confidence')} ${s.confidence ?? 60}%</span>${meter(s.confidence ?? 60, t('common.confidence'))}</div>
        </div></article>`)}</div>`
      : html`<div class="empty"><p>${t('signals.empty')}</p><button class="btn btn-secondary" data-act="filter-signals" data-type="all">${t('signals.showAll')}</button></div>`}`;
  },
};

actions['filter-signals'] = (el) => { filter = el.dataset.type; rerender(); };

actions['csv-import'] = () => {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.csv,text/csv,text/plain';
  inp.onchange = async () => {
    const file = inp.files?.[0]; if (!file) return;
    if (file.size > 200_000) return toast(t('signals.csvTooBig'), 'error');
    try {
      const rows = (await file.text()).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 51);
      if (/^"?(text|review|comment|evidence)/i.test(rows[0])) rows.shift();
      const imported = rows.slice(0, 50).map((r, i) => {
        const text = limit(r.replace(/,\s*"?\d(\.\d)?"?\s*$/, '').replace(/^"|"$/g, ''), 300);
        return { id: `csv-${Date.now()}-${i}-${slug(text).slice(0, 8)}`, source: 'CSV import', evidence: text, confidence: 60 };
      }).filter((x) => x.evidence.length > 3);
      if (!imported.length) return toast(t('signals.csvEmpty'), 'error');
      update((s) => ({ userSignals: [...s.userSignals, ...imported].slice(0, 50) }));
      toast(t('signals.csvOk', { n: imported.length }), 'success');
      rerender();
    } catch (e) { console.error('[LocalBoost] csv', e); toast(t('common.errorGeneric'), 'error'); }
  };
  inp.click();
};
