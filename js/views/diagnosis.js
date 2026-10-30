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
        <p class="muted small">${t('diagnosis.timeoutNote', { s: AI_TIMEOUT_MS / 1000 })}</p><div class="bar-indet"><i></i></div></section>
        <div class="skel-opp" aria-hidden="true"><i class="skel w40"></i><i class="skel w80 tall"></i><div class="skel-row"><i class="skel"></i><i class="skel"></i><i class="skel"></i></div></div>`;
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
    const C = 2 * Math.PI * 40;
    return html`${head}
    <div class="engine-bar ${isAi ? 'is-ai' : 'is-local'}" role="status">
      <span class="engine-dot" aria-hidden="true"></span>
      <span class="engine-text"><strong>${isAi ? t('diagnosis.engineAi') : t('diagnosis.fallbackTitle')}</strong>${isAi ? '' : html` ${t(reasonKey(d.reason))}`}</span>
      <span class="engine-meta">${fmtDate(d.timestamp)} · ${(d.durationMs / 1000).toFixed(1)} s</span>
      ${isAi ? '' : html`<button class="btn btn-secondary btn-sm" data-act="run-analysis">${icon('refresh', 16)} ${t('actions.retry')}</button>`}
    </div>
    <details class="sig-about"><summary>${icon('info', 16)} ${t('ai.noticeTitle')}</summary><p>${t('ai.notice')}</p></details>

    <section class="opp2">
      <div class="opp2-head"><div><p class="tag">${t('diagnosis.opportunity')}</p><h2 class="opp2-title">${o.title}</h2></div>
        <div class="opp2-ring has-src" tabindex="0" data-src="confidence"><svg viewBox="0 0 100 100" width="104" height="104" role="img" aria-label="${t('common.confidence')}: ${o.confidence}%">
          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-opacity=".18" stroke-width="9"/>
          <circle cx="50" cy="50" r="40" fill="none" stroke="var(--yellow-400)" stroke-width="9" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - o.confidence / 100)).toFixed(1)}" transform="rotate(-90 50 50)"/>
          <text x="50" y="56" text-anchor="middle" class="ring-num">${o.confidence}%</text></svg><span>${t('common.confidence')}</span></div></div>
      <ol class="chain">
        <li><span class="chain-k">${t('diagnosis.why')}</span><p>${o.why}</p></li>
        <li><span class="chain-k">${t('diagnosis.hypothesis')}</span><p>${o.hypothesis}</p></li>
        <li><span class="chain-k">${t('diagnosis.impact')}</span><p>${o.impact}</p></li>
      </ol>
      <div class="btn-row"><button class="btn btn-primary btn-lg" data-act="go" data-route="mission">${t('actions.startMission')} ${icon('next', 18)}</button>
        <button class="btn btn-secondary" data-act="copy-reco">${icon('copy', 18)} ${t('actions.copyReco')}</button>
        <button class="btn btn-secondary" data-act="chat-open" data-q="${t('chat.qDiagnosis')}">${icon('sparkle', 18)} ${t('chat.askDiagnosis')}</button></div>
    </section>

    <div class="dia-grid">
      <section><h2 class="section-h">${t('diagnosis.problems')}</h2>
        <div class="prob-list">${d.data.problems.map((p, i) => html`<article class="prob" style="--i:${i}">
          <span class="prob-n" aria-hidden="true">${i + 1}</span>
          <div class="prob-body"><div class="prob-top"><h3>${p.title}</h3><span class="badge badge-${p.kind === 'fact' ? 'live' : 'inference'}">${t(`diagnosis.kind.${p.kind}`)}</span></div>
            ${p.evidence.map((e) => html`<p class="prob-ev">${e}</p>`)}
            <span class="sig-conf has-src" tabindex="0" data-src="confidence">${t('common.confidence')} <b>${p.confidence}%</b>${meter(p.confidence, t('common.confidence'))}</span></div></article>`)}</div></section>
      <aside class="confirm-card"><h2>${t('diagnosis.needsOwner')}</h2>
        <ul>${d.data.needsOwner.map((x) => html`<li><span class="confirm-box" aria-hidden="true"></span>${x}</li>`)}</ul></aside>
    </div>

    <details class="card explain">
      <summary><span class="tag">${t('diagnosis.explain')}</span></summary>
      <div class="explain-meta">
        <div><span class="label-mono">${t('diagnosis.engine')}</span><strong>${isAi ? t('diagnosis.engineAi') : t('diagnosis.engineLocal')}</strong></div>
        <div><span class="label-mono">${t('diagnosis.timestamp')}</span><strong>${fmtDate(d.timestamp)}</strong></div>
        <div><span class="label-mono">${t('diagnosis.dataMode')}</span><strong>${t('common.demoData')}</strong></div>
        <div><span class="label-mono">${t('diagnosis.duration')}</span><strong>${(d.durationMs / 1000).toFixed(1)} s</strong></div>
      </div>
      ${isAi && d.lang !== document.documentElement.lang ? html`<p class="muted small">${t('diagnosis.langNote')}</p>` : ''}
      <div class="grid-2">
        <div><h4>${t('diagnosis.facts')}</h4>${list(d.data.facts)}</div>
        <div><h4>${t('diagnosis.inferences')}</h4>${list(d.data.inferences)}</div>
      </div>
      <h4>${t('diagnosis.sources')}</h4>
      <div class="chips">${[...SIGNALS.map((s) => s.source + ' · ' + s.id), ...getState().userSignals.map((s) => s.source)].map((s) => html`<span class="chip chip-static">${s}</span>`)}</div>
      <p class="muted small">${t('diagnosis.noRealData')}</p>
    </details>`;
  },
};

actions['run-analysis'] = () => runAnalysis();
actions['run-analysis-go'] = () => { go('diagnosis'); setTimeout(runAnalysis, 60); };
actions['copy-reco'] = async () => {
  const ok = await copyText(recommendationText());
  toast(ok ? t('common.copied') : t('common.copyFailed'), ok ? 'success' : 'error');
};
