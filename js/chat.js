// "Ask LocalBoost": open questions answered by the server-side model, streamed word by word.
// States: idle -> sending (typing dots) -> streaming -> done | stopped | error (retry) | fallback (no AI: links to screens).
import { html, raw, esc, icon, $, toast } from './core.js';
import { t, getLang } from './i18n.js';
import { getState, update } from './store.js';
import { actions, go } from './registry.js';
import { apiUrl } from './api.js';
import { aiAvailable, getDiagnosis, getAssets, signalPayload } from './ai.js';
import { getBiz, displayName } from './business.js';
import { COMPETITORS, MISSION_HOURS } from './data.js';

const MAX_LEN = 2000; const KEEP = 30;
const FIRST_TOKEN_MS = 20000; const TOTAL_MS = 75000;
let animateNext = false; let isOpen = false; let busy = false; let ctrl = null; let live = null; let msgs = [];

/* ---------- what the model knows about the business ---------- */
function context() {
  const s = getState(); const ctx = { screen: (location.hash.replace(/^#\/?/, '') || 'overview').split('?')[0], dataMode: 'demo' };
  if (!s.business.loaded) return { ...ctx, business: null, note: 'No business has been added yet.' };
  const b = getBiz();
  ctx.business = { name: displayName(), city: b.city, category: b.category, goal: b.goal, website: b.website || null, instagram: b.instagram || null, tiktok: b.tiktok || null, facebook: b.facebook || null };
  if (s.signalsCollected) { const p = signalPayload(); ctx.metrics = { rating: p.business.rating, visibility: p.business.visibility, reach: p.business.reach, trend: p.business.trend }; ctx.signals = p.signals.map((x) => ({ type: x.type, source: x.source, evidence: x.evidence, data: x.data || 'demo' })); }
  if (s.diagnosis) { const d = getDiagnosis(); const o = d.data.opportunity; ctx.diagnosis = { engine: d.mode, opportunity: { title: o.title, why: o.why, hypothesis: o.hypothesis, impact: o.impact, confidence: o.confidence }, problems: d.data.problems.map((x) => x.title), ownerMustConfirm: d.data.needsOwner }; }
  if (s.mission) ctx.mission = { status: s.mission.status, hoursLeft: s.mission.checkpointAt ? Math.max(0, Math.ceil((s.mission.checkpointAt - Date.now()) / 3.6e6)) : MISSION_HOURS };
  if (s.assets) { const a = getAssets(); ctx.assets = { offer: a.offer.title, offerText: a.offer.body, post: a.post.text, headlines: a.headlines }; }
  if (s.site?.generated) ctx.website = 'generated';
  if (s.checkpoint) ctx.checkpoint = { reach: s.checkpoint.reach, requests: s.checkpoint.requests, ctaClicks: s.checkpoint.ctaClicks, visibility: s.checkpoint.visibility };
  if (s.competitors?.scanned) ctx.competitors = COMPETITORS.map((c) => ({ name: c.name, rating: c.rating, reviews: c.reviews, visibility: c.visibility, booking: c.booking, afternoonOffer: c.afternoon }));
  return ctx;
}

/* ---------- honest fallback when no model is available: point to the right screen ---------- */
const ROUTES = [
  [/review|recenz|avis|bewert|értékel|signal|semnal|jel/i, 'signals'], [/compet|concur|konkur|versen/i, 'competitors'],
  [/diagnos|analy|analiz|problem/i, 'diagnosis'], [/mission|misiun|küldet|48/i, 'mission'], [/site|web|pagin|page|seite|oldal/i, 'website'],
  [/post|offer|ofert|offre|angebot|ajánlat|instagram|caption|headline|titlu|sticker|merch/i, 'pack'], [/result|rezultat|résultat|ergebnis|eredmény|measure|checkpoint|proof/i, 'proof'],
];
const routeFor = (q) => (ROUTES.find(([re]) => re.test(q)) || [null, 'overview'])[1];

/* ---------- rendering ---------- */
// Tiny, safe markdown: escape first, then **bold** and "- " bullet lists.
function md(text) {
  const lines = esc(text).split('\n'); let out = ''; let list = false;
  for (const l of lines) {
    const b = /^\s*[-*•]\s+(.*)$/.exec(l);
    const line = (b ? b[1] : l).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    if (b) { if (!list) { out += '<ul>'; list = true; } out += `<li>${line}</li>`; continue; }
    if (list) { out += '</ul>'; list = false; }
    if (line.trim()) out += `<p>${line}</p>`;
  }
  return raw(out + (list ? '</ul>' : ''));
}

function bubble(m, i) {
  if (m.role === 'user') return html`<div class="msg msg-user"><p>${m.content}</p></div>`;
  return html`<div class="msg msg-ai" data-i="${i}">
    ${m.pending && !m.content ? html`<p class="typing" aria-label="${t('chat.thinking')}"><i></i><i></i><i></i></p>` : html`<div class="msg-text">${md(m.content)}</div>`}
    ${m.stopped ? html`<p class="msg-note">${t('chat.stopped')}</p>` : ''}
    ${m.fallback ? html`<p class="msg-note">${t('chat.err_not_configured')}</p><button class="btn btn-secondary btn-sm" data-chat="go" data-route="${m.fallback}">${t('chat.fallbackGo', { screen: t(`nav.${m.fallback}`) })} ${icon('next', 15)}</button>` : ''}
    ${m.error ? html`<p class="msg-err" role="alert">${icon('info', 15)} ${t(`chat.err_${m.error}`)}</p><button class="btn btn-secondary btn-sm" data-chat="retry">${icon('refresh', 15)} ${t('chat.retry')}</button>` : ''}
  </div>`;
}

function emptyState() {
  return html`<div class="chat-empty"><span class="chat-empty-ic">${icon('sparkle', 26)}</span><p>${t('chat.empty')}</p>
    <div class="chat-suggest">${[1, 2, 3, 4].map((n) => html`<button class="chip" data-chat="suggest" data-q="${t(`chat.s${n}`)}">${t(`chat.s${n}`)}</button>`)}</div></div>`;
}

function render() {
  const root = $('#chat-root'); if (!root) return;
  const input = $('#chat-input'); const draft = input ? input.value : ''; const hadFocus = document.activeElement === input;
  const enter = animateNext ? 'enter' : ''; animateNext = false; // slide in once per opening, not on every redraw
  root.innerHTML = html`<div class="chat-backdrop ${enter}" data-chat="close"></div>
  <section class="chat ${enter}" role="dialog" aria-modal="true" aria-labelledby="chat-title">
    <header class="chat-head"><span class="chat-mark" aria-hidden="true">${icon('sparkle', 18)}</span>
      <div class="chat-titles"><h2 id="chat-title">${t('chat.title')}</h2>
        <span class="chat-status ${live ? 'on' : live === false ? 'off' : ''}">${live === null ? '' : t(live ? 'chat.live' : 'chat.offline')}</span></div>
      <button class="icon-btn" data-chat="clear" aria-label="${t('chat.clear')}" title="${t('chat.clear')}" ${busy || !msgs.length ? 'disabled' : ''}>${icon('refresh', 18)}</button>
      <button class="icon-btn" data-chat="close" aria-label="${t('chat.close')}" title="${t('chat.close')}">${icon('x', 18)}</button></header>
    <div class="chat-log" id="chat-log" aria-live="polite" aria-busy="${busy}">${msgs.length ? msgs.map(bubble) : emptyState()}</div>
    <form class="chat-form" id="chat-form">
      <label class="sr-only" for="chat-input">${t('chat.placeholder')}</label>
      <textarea id="chat-input" rows="1" maxlength="${MAX_LEN}" placeholder="${t('chat.placeholder')}"></textarea>
      ${busy ? html`<button type="button" class="btn btn-secondary chat-send" data-chat="stop">${icon('x', 16)} ${t('chat.stop')}</button>`
        : html`<button type="submit" class="btn btn-primary chat-send" aria-label="${t('chat.send')}">${icon('next', 18)}</button>`}
    </form>
    <p class="chat-foot">${t('chat.foot')}</p></section>`.s;
  const ta = $('#chat-input'); ta.value = draft; grow(ta);
  if (hadFocus || !busy) ta.focus({ preventScroll: true });
  scrollEnd();
}
const scrollEnd = () => { const log = $('#chat-log'); if (log) log.scrollTop = log.scrollHeight; };
const grow = (ta) => { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`; };

/** Repaint only the streaming bubble, so typing in the box is never interrupted. */
function paint(i) {
  const el = $(`#chat-log .msg-ai[data-i="${i}"]`); if (!el) return render();
  el.outerHTML = bubble(msgs[i], i).s; scrollEnd();
}

const save = () => update({ chat: msgs.filter((m) => !m.pending).slice(-KEEP).map(({ role, content, error, stopped, fallback }) => ({ role, content, error, stopped, fallback })) });

/* ---------- transport ---------- */
async function ask(text) {
  const q = String(text || '').trim();
  if (!q || busy) return;
  if (q.length > MAX_LEN) return toast(t('chat.err_too_long'), 'error');
  // Only completed exchanges go back to the model: a question whose answer failed (error, fallback, empty) is left out.
  const history = [];
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i]; const next = msgs[i + 1];
    if (m.role === 'user' && next?.role === 'assistant' && next.content && !next.error && !next.fallback) history.push({ role: 'user', content: m.content }, { role: 'assistant', content: next.content });
  }
  msgs.push({ role: 'user', content: q });
  const a = { role: 'assistant', content: '', pending: true }; msgs.push(a); const idx = msgs.length - 1;
  busy = true; render();
  const finish = (patch = {}) => { Object.assign(a, { pending: false }, patch); busy = false; ctrl = null; save(); render(); };

  const sim = getState().aiSim; // rehearsal switch in Settings
  if (sim === 'error') return finish({ error: 'http' });
  if (!navigator.onLine) return finish({ error: 'unreachable' });
  live = await aiAvailable();
  if (!live) return finish({ fallback: routeFor(q) });

  ctrl = new AbortController(); const c = ctrl;
  let firstTimer = setTimeout(() => c.abort('timeout'), sim === 'timeout' ? 1500 : FIRST_TOKEN_MS);
  const totalTimer = setTimeout(() => c.abort('timeout'), TOTAL_MS);
  try {
    if (sim === 'timeout') await new Promise((_, rej) => c.signal.addEventListener('abort', () => rej(new Error('timeout')), { once: true }));
    const res = await fetch(apiUrl('/api/chat'), { method: 'POST', headers: { 'content-type': 'application/json' }, signal: c.signal,
      body: JSON.stringify({ messages: [...history, { role: 'user', content: q }], context: context(), lang: getLang() }) });
    if (!res.ok || !res.body) throw Object.assign(new Error('http'), { kind: res.status === 429 ? 'rate_limited' : 'http' });
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let k;
      while ((k = buf.indexOf('\n\n')) >= 0) {
        const line = buf.slice(0, k).split('\n').find((l) => l.startsWith('data:')); buf = buf.slice(k + 2);
        if (!line) continue;
        let ev; try { ev = JSON.parse(line.slice(5)); } catch { continue; }
        if (ev.type === 'delta') { if (firstTimer) { clearTimeout(firstTimer); firstTimer = null; } a.content += ev.text; a.pending = false; paint(idx); }
        else if (ev.type === 'error') {
          if (ev.error === 'ai_not_configured') { live = false; return finish({ fallback: routeFor(q) }); }
          if (ev.error === 'aborted') return finish({ stopped: true });
          throw Object.assign(new Error(ev.error), { kind: ['rate_limited', 'timeout', 'too_long'].includes(ev.error) ? ev.error : 'http' });
        }
      }
    }
    finish();
  } catch (e) {
    if (c.signal.reason === 'user') finish({ stopped: true });
    else if (c.signal.aborted) finish({ error: 'timeout' });
    else finish({ error: e.kind || 'unreachable' });
  } finally { clearTimeout(firstTimer); clearTimeout(totalTimer); }
}

function retry() {
  if (busy) return;
  let i = msgs.length - 1; while (i >= 0 && msgs[i].role !== 'user') i--;
  if (i < 0) return;
  const q = msgs[i].content; msgs = msgs.slice(0, i); ask(q);
}

/* ---------- open / close ---------- */
export function openChat(question) {
  const root = $('#chat-root'); if (!root) return;
  if (!busy) msgs = (getState().chat || []).map((m) => ({ ...m }));
  if (!isOpen) animateNext = true;
  isOpen = true; root.hidden = false; document.body.classList.add('chat-open');
  render();
  aiAvailable().then((v) => { if (live !== v) { live = v; if (isOpen && !busy) render(); } });
  if (question) ask(question);
}
export function closeChat() {
  const root = $('#chat-root'); if (!root) return;
  isOpen = false; root.hidden = true; document.body.classList.remove('chat-open');
  $('[data-act="chat-open"]')?.focus();
}

actions['chat-open'] = (el) => openChat(el?.dataset?.q || '');

document.addEventListener('click', (e) => {
  const b = e.target.closest('#chat-root [data-chat]'); if (!b) return;
  const kind = b.dataset.chat;
  if (kind === 'close') closeChat();
  else if (kind === 'suggest') ask(b.dataset.q);
  else if (kind === 'stop') ctrl?.abort('user');
  else if (kind === 'retry') retry();
  else if (kind === 'clear') { msgs = []; update({ chat: [] }); render(); }
  else if (kind === 'go') { closeChat(); go(b.dataset.route); }
});
document.addEventListener('submit', (e) => {
  if (e.target.id !== 'chat-form') return;
  e.preventDefault(); const ta = $('#chat-input'); const q = ta.value; ta.value = ''; ask(q);
});
document.addEventListener('keydown', (e) => {
  if (!isOpen) return;
  if (e.key === 'Escape') { e.stopPropagation(); closeChat(); }
  if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'chat-input') { e.preventDefault(); $('#chat-form')?.requestSubmit(); }
}, true);
document.addEventListener('input', (e) => { if (e.target.id === 'chat-input') grow(e.target); });
