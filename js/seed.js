// Ready-made "completed demo" state, used by ?seed=full (screenshots, QA, rehearsal).
import { update, updateSite } from './store.js';
import { ensureAssetsSync, ensureDiagnosisSync } from './ai.js';
import { MISSION_HOURS } from './data.js';
import { saveBiz, EXAMPLE } from './business.js';
import { localNames } from './names.js';

export function seedFullDemo() {
  const now = Date.now();
  saveBiz(EXAMPLE);
  ensureDiagnosisSync(); ensureAssetsSync();
  const agents = { analyst: 'fallback', strategist: 'fallback', creator: 'fallback', builder: 'fallback', scout: 'fallback' };
  update({
    signalsCollected: true,
    mission: { status: 'active', startedAt: now - 3600e3, checkpointAt: now - 3600e3 + MISSION_HOURS * 3600e3, agents, fallbacks: Object.keys(agents) },
    names: { mode: 'fallback', ...localNames(), timestamp: new Date().toISOString() },
    competitors: { scanned: true, custom: [] },
    checkpoint: { reach: 2810, requests: 6, ctaClicks: 23, visibility: 82, recordedAt: now, demo: true },
    bookings: [{ party: 4, slot: '15:00–16:00', at: now - 600e3, demo: true }],
  });
  updateSite({ generated: true });
}
