// Collecting signals: the business's Google listing (rating, latest reviews), a check of its website,
// whatever the owner pasted (reviews, comments, questions) and, when the AI is on, the themes across all of it.
import { getState, update } from './store.js';
import { toast, limit } from './core.js';
import { t } from './i18n.js';
import { actions, rerender, go } from './registry.js';
import { getBiz } from './business.js';
import { serverCaps, placeDetails, checkWebsite } from './sources.js';
import { runThemes } from './ai.js';

export const scan = { active: false, step: 0, steps: [] };

/** Copies what Google says about the business into the profile (fills only what the owner left empty). */
export function applyPlace(p, fetchedAt = new Date().toISOString()) {
  update((s) => {
    const b = s.business;
    const place = { id: p.id, name: p.name, address: p.address, lat: p.lat, lng: p.lng, rating: p.rating, reviewCount: p.reviewCount, mapsUrl: p.mapsUrl, website: p.website, phone: p.phone || b.place?.phone || '', hours: p.hours || b.place?.hours || [], fetchedAt };
    return { business: { ...b, place, address: b.address || p.address || '', phone: b.phone || p.phone || '', website: b.website || (p.website ? p.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : '') } };
  });
}

export async function collectSignals() {
  const s = getState();
  if (scan.active || !s.business.loaded) return;
  const caps = await serverCaps();
  const b = getBiz();
  scan.steps = [b.place?.id && 'google', b.website && 'website', 'notes', 'themes'].filter(Boolean);
  scan.active = true; scan.step = 0; rerender();
  const errors = {};
  const next = { ...getState().signals };
  for (let i = 0; i < scan.steps.length; i++) {
    scan.step = i; rerender();
    const k = scan.steps[i];
    if (k === 'google') {
      if (!caps.places) errors.google = 'places_not_configured';
      else {
        const r = await placeDetails(b.place.id);
        if (r.ok) { applyPlace(r.data.place, r.data.fetchedAt); next.google = { rating: r.data.place.rating, reviewCount: r.data.place.reviewCount, reviews: r.data.place.reviews, fetchedAt: r.data.fetchedAt }; }
        else errors.google = r.error;
      }
    }
    if (k === 'website') {
      const r = await checkWebsite(b.website);
      if (r.ok) next.site = { ...r.data.result, checkedAt: r.data.checkedAt };
      else errors.website = r.error;
    }
    if (k === 'themes') {
      const texts = [...(next.google?.reviews || []).map((v) => ({ source: 'Google', rating: v.rating, text: v.text })), ...next.notes.map((n) => ({ source: n.source, kind: n.kind, text: n.text }))];
      if (texts.length >= 2) {
        const th = await runThemes(texts);
        next.themes = th;
        if (th.mode !== 'ai') errors.themes = th.reason || 'not_configured';
      } else next.themes = null;
    }
    if (k === 'notes') await new Promise((r) => setTimeout(r, 250));
  }
  update({ signals: { ...next, errors, collectedAt: new Date().toISOString() } });
  scan.active = false; scan.step = scan.steps.length;
  toast(t(Object.keys(errors).length ? 'collect.partial' : 'collect.done'), Object.keys(errors).length ? 'info' : 'success');
  rerender();
}

/* ---------- things the owner pastes in ---------- */
export const NOTE_KINDS = ['review', 'question', 'comment', 'message'];
/** Splits pasted text into separate items (blank line or new line), max 100 per paste. */
export function addNotes(text, kind, source) {
  const parts = String(text || '').split(/\n\s*\n|\r?\n/).map((x) => limit(x.trim(), 1200)).filter((x) => x.length >= 4).slice(0, 100);
  if (!parts.length) return 0;
  const k = NOTE_KINDS.includes(kind) ? kind : 'review';
  const now = Date.now();
  update((s) => ({ signals: { ...s.signals, notes: [...parts.map((p, i) => ({ id: `n${now}${i}`, kind: k, source: limit(source || '', 40), text: p, at: now })), ...s.signals.notes].slice(0, 300) } }));
  return parts.length;
}
export function removeNote(id) { update((s) => ({ signals: { ...s.signals, notes: s.signals.notes.filter((n) => n.id !== id) } })); }

export const hasSignals = () => !!getState().signals?.collectedAt;

/** Guard for steps that need data: explains what to press instead of showing empty results. */
export function needSignals() {
  const s = getState();
  if (hasSignals()) return false;
  toast(t(s.business.loaded ? 'start.needSignals' : 'start.needBusiness'), 'info');
  go(s.business.loaded ? 'signals' : 'overview');
  return true;
}

actions['collect-signals'] = () => collectSignals();
