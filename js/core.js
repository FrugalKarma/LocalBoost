import { t } from './i18n.js';

/* ---------- safe templating ---------- */
export class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(s);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toS = (v) => (v instanceof Raw ? v.s : Array.isArray(v) ? v.map(toS).join('') : v === false || v == null ? '' : esc(v));
export function html(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => { out += toS(v) + strings[i + 1]; });
  return new Raw(out);
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- icons ---------- */
const P = {
  overview: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/>',
  signals: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12l6-6"/>',
  diagnosis: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M8 11.5l2 2 3.5-4"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"/>',
  compare: '<path d="M5 20V11M10 20V5M15 20v-6M20 20V8"/><path d="M3 20h18"/>',
  mission: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  website: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M3 9h18M8 21h8M12 17v4"/>',
  pack: '<path d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8"/>',
  proof: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  present: '<path d="M3 4h18v12H3zM8 21l4-5 4 5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  account: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>',
  moon: '<path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18-3-3-3-15 0-18z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5h10"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  next: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  prev: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  share: '<path d="M4 12v7h16v-7M12 3v12M7 8l5-5 5 5"/>',
  refresh: '<path d="M20 11a8 8 0 10-2 6M20 4v7h-7"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  max: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  volume: '<path d="M4 9v6h4l5 4V5L8 9zM17 8a5 5 0 010 8"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6"/>',
  pin: '<path d="M12 21s7-6 7-12a7 7 0 10-14 0c0 6 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  plug: '<path d="M9 2v6M15 2v6M7 8h10v4a5 5 0 01-10 0zM12 17v5"/>',
  upload: '<path d="M12 17V5M7 10l5-5 5 5M4 21h16"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 115 0c0 1.5-2.5 2-2.5 4M12 17h.01"/>',
  install: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 7v7M9 11l3 3 3-3"/>',
  sparkle: '<path d="M13 2L5 13.5h6L10 22l8-11.5h-6z"/>',
  more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
};
export function icon(name, size = 20) {
  return raw(`<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name] || ''}</svg>`);
}

/* ---------- toast ---------- */
export function toast(message, kind = 'info', ms = 3600) {
  let host = $('#toasts');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 240); }, ms);
}

/* ---------- modal ---------- */
let lastFocus = null;
export function closeModal() {
  const m = $('#modal-root');
  if (!m) return;
  m.innerHTML = '';
  m.hidden = true;
  lastFocus?.focus?.();
}
/**
 * body: Raw html. actions: [{label, kind, act, value}] -> resolves with the clicked value (or null on dismiss).
 */
export function openModal({ title, body, actions = [], wide = false }) {
  return new Promise((resolve) => {
    const m = $('#modal-root');
    lastFocus = document.activeElement;
    m.hidden = false;
    m.innerHTML = html`<div class="modal-backdrop" data-modal-dismiss></div>
      <div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-head"><h2 id="modal-title">${title}</h2>
          <button class="icon-btn" data-modal-dismiss aria-label="${t('common.close')}">${icon('x')}</button></div>
        <div class="modal-body">${body}</div>
        ${actions.length ? html`<div class="modal-foot">${actions.map((a, i) => html`<button class="btn ${a.kind || 'btn-secondary'}" data-modal-act="${i}">${a.label}</button>`)}</div>` : ''}
      </div>`.s;
    const finish = (v) => { m.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey, true); closeModal(); resolve(v); };
    const onClick = (e) => {
      if (e.target.closest('[data-modal-dismiss]')) return finish(null);
      const b = e.target.closest('[data-modal-act]');
      if (b) { const a = actions[+b.dataset.modalAct]; finish(a.collect ? a.collect() : (a.value ?? true)); } // collect() reads form fields before the dialog closes
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); finish(null); }
      if (e.key === 'Tab') {
        const f = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', m).filter((x) => !x.disabled);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    m.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey, true);
    ($('[data-modal-act]', m) || $('.icon-btn', m))?.focus();
  });
}
export const confirmDialog = (title, message, okLabel) =>
  openModal({
    title,
    body: html`<p>${message}</p>`,
    actions: [
      { label: t('common.cancel'), kind: 'btn-ghost', value: false },
      { label: okLabel || t('common.confirm'), kind: 'btn-primary', value: true },
    ],
  }).then((v) => v === true);

/* ---------- utilities ---------- */
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const limit = (s, n) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, n);
export const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function demoBadge(extra = '') {
  return html`<span class="badge badge-demo ${extra}">${t('common.demoData')}</span>`;
}
