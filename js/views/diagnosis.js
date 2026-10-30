import { html, icon, toast, copyText, sleep } from '../core.js';
import { t, fmtDate } from '../i18n.js';
import { getState } from '../store.js';
import { runDiagnosis, getDiagnosis, reasonKey, AI_TIMEOUT_MS } from '../ai.js';
import { SIGNALS } from '../data.js';
import { actions, rerender, go } from '../registry.js';
import { pageHead, aiNotice } from './shared.js';
import { needSignals } from '../collect.js';
import { meter } from '../charts.js';

const run = { active: false, step: 0 };
const STEPS = ['read', 'extract', 'prioritize', 'validate'];

export async function runAnalysis() {
  if (run.active || needSignals()) return;
  run.active = true; run.step = 0; rerender();
  const ticker = setInterval(() => { run.step = Math.min(run.step + 1, STEPS.length - 1); rerender({ soft: true }); }, 600);
  try {
    const [res] = await Promise.all([runDiagnosis({ onStep: (n) => { run.step = Math.max(run.step, n); } }), sleep(2000)]);
    run.step = STEPS.length;
    if (res.mode === 'ai') toast(t('diagnosis.toastAi'), 'success');
    else toast(t('diagnosis.toastFallback'), 'info');
  } catch (e) {
    console.error('[LocalBoost] analysis', e);
    toast(t('common.errorGeneric'), 'error');
  } finally { clearInterval(ticker); run.active = false; rerender(); }
}

export function recommendationText() {
  const d = getDiagnosis(); if (!d) return '';
  const o = d.data.opportunity;
  return `${o.title}\n\n${t('diagnosis.why')}: ${o.why}\n${t('diagnosis.hypothesis')}: ${o.hypothesis}\n${t('diagnosis.impact')}: ${o.impact}\n${t('common.confidence')}: ${o.confidence}%\n\n(${t('common.demoData')} · ${fmtDate(d.timestamp)})`;
}

const list = (items) => html`<ul class="plain">${items.map((x) => html`<li>${x}</li>`)}</ul>`;

export const diagnosis = {
  id: 'diagnosis',
  render() {
    const d = getDiagnosis();
    const head = pageHead({ note: '03', title: t('diagnosis.title'), sub: t('diagnosis.sub'),
      actions: html`<button class="btn btn-primary" data-act="run-analysis" ${run.active ? 'disabled' : ''}>${icon('sparkle', 18)} ${d ? t('actions.rerun') : t('actions.runAnalysis')}</button>` });
    if (run.active) {
      return html`${head}<section class="card loading-card" aria-live="polite"><p class="tag">${t('diagnosis.running')}</p>
        <ol class="steps">${STEPS.map((k, i) => html`<li class="${i < run.step ? 'done' : i === run.step ? 'now' : ''}"><span class="dot"></span>${t(`diagnosis.step.${k}`)}</li>`)}</ol>
        <p class="muted small">${t('diagnosis.timeoutNote', { s: AI_TIMEOUT_MS / 1000 })}</p><div class="bar-indet"><i></i></div></section>`;
    }
    if (!d && !getState().signalsCollected) {
      return html`${head}<section class="card empty-hero"><div class="empty-ic">${icon('signals', 34)}</div><h2>${t('start.needSignalsTitle')}</h2><p class="muted">${t(getState().business.loaded ? 'start.needSignals' : 'start.needBusiness')}</p>
        <button class="btn btn-primary btn-lg" data-act="go" data-route="${getState().business.loaded ? 'signals' : 'overview'}">${icon('next', 18)} ${t('start.goCollect')}</button></section>`;
    }
    if (!d) {
      return html`${head}<section class="card empty-hero"><div class="empty-ic">${icon('diagnosis', 34)}</div><h2>${t('diagnosis.emptyTitle')}</h2><p class="muted">${t('diagnosis.emptyBody')}</p>
        <button class="btn btn-primary btn-lg" data-act="run-analysis">${icon('sparkle', 18)} ${t('actions.runAnalysis')}</button></section>`;
    }
    const o = d.data.opportunity; const isAi = d.mode === 'ai';
    return html`${head}${aiNotice()}
    ${isAi ? '' : html`<div class="banner banner-warn" role="status"><div>${icon('info', 18)} <strong>${t('diagnosis.fallbackTitle')}</strong> ${t(reasonKey(d.reason))}</div>
      <button class="btn btn-secondary btn-sm" data-act="run-analysis">${icon('refresh', 16)} ${t('actions.retry')}</button></div>`}
    <section class="opp card card-accent">
      <p class="tag">${t('tag.action')} · ${t('diagnosis.opportunity')}</p>
      <h2 class="opp-title">${o.title}</h2>
      <div class="opp-grid">
        <div><p class="label-mono">${t('diagnosis.why')}</p><p>${o.why}</p></div>
        <div><p class="label-mono">${t('diagnosis.hypothesis')}</p><p>${o.hypothesis}</p></div>
        <div><p class="label-mono">${t('diagnosis.impact')}</p><p>${o.impact}</p></div>
        <div class="has-src" tabindex="0" data-src="confidence"><p class="label-mono">${t('common.confidence')}</p><p class="big-num sm">${o.confidence}%</p>${meter(o.confidence, t('common.confidence'))}</div>
      </div>
      <div class="btn-row"><button class="btn btn-primary" data-act="go" data-route="mission">${t('actions.startMission')} ${icon('next', 18)}</button>
        <button class="btn btn-secondary" data-act="copy-reco">${icon('copy', 18)} ${t('actions.copyReco')}</button></div>
    </section>

    <h2 class="section-h">${t('diagnosis.problems')}</h2>
    <div class="grid-3">${d.data.problems.map((p, i) => html`<article class="card" style="--i:${i}">
      <div class="signal-top"><span class="tag">${t('tag.signal')} ${i + 1}</span><span class="badge badge-${p.kind === 'fact' ? 'live' : 'inference'}">${t(`diagnosis.kind.${p.kind}`)}</span></div>
      <h3>${p.title}</h3>${p.evidence.map((e) => html`<p class="evidence small">“${e}”</p>`)}
      <p class="mono small has-src" tabindex="0" data-src="confidence">${t('common.confidence')} ${p.confidence}%</p>${meter(p.confidence, t('common.confidence'))}</article>`)}</div>

    <section class="card explain">
      <p class="tag">${t('tag.evidence')} · ${t('diagnosis.explain')}</p>
      <div class="explain-meta">
        <div><span class="label-mono">${t('diagnosis.engine')}</span><strong>${isAi ? t('diagnosis.engineAi') : t('diagnosis.engineLocal')}</strong></div>
        <div><span class="label-mono">${t('diagnosis.timestamp')}</span><strong>${fmtDate(d.timestamp)}</strong></div>
        <div><span class="label-mono">${t('diagnosis.dataMode')}</span><strong>${t('common.demoData')}</strong></div>
        <div><span class="label-mono">${t('diagnosis.duration')}</span><strong>${(d.durationMs / 1000).toFixed(1)} s</strong></div>
      </div>
      ${isAi && d.lang !== document.documentElement.lang ? html`<p class="muted small">${t('diagnosis.langNote')}</p>` : ''}
      <div class="grid-3">
        <div><h4>${t('diagnosis.facts')}</h4>${list(d.data.facts)}</div>
        <div><h4>${t('diagnosis.inferences')}</h4>${list(d.data.inferences)}</div>
        <div><h4>${t('diagnosis.needsOwner')}</h4>${list(d.data.needsOwner)}</div>
      </div>
      <h4>${t('diagnosis.sources')}</h4>
      <div class="chips">${[...SIGNALS.map((s) => s.source + ' · ' + s.id), ...getState().userSignals.map((s) => s.source)].map((s) => html`<span class="chip chip-static">${s}</span>`)}</div>
      <p class="muted small">${t('diagnosis.noRealData')}</p>
    </section>`;
  },
};

actions['run-analysis'] = () => runAnalysis();
actions['run-analysis-go'] = () => { go('diagnosis'); setTimeout(runAnalysis, 60); };
actions['copy-reco'] = async () => {
  const ok = await copyText(recommendationText());
  toast(ok ? t('common.copied') : t('common.copyFailed'), ok ? 'success' : 'error');
};
