// Guided reveal: the business and its signals only appear when the presenter presses the buttons.
import { getState, update } from './store.js';
import { sleep, toast } from './core.js';
import { t } from './i18n.js';
import { actions, rerender, go } from './registry.js';
import { saveBiz, EXAMPLE } from './business.js';

export const SCAN_STEPS = ['reviews', 'questions', 'website', 'search'];
export const scan = { active: false, step: 0 };

export async function collectSignals() {
  if (scan.active || !getState().business.loaded) return;
  scan.active = true; scan.step = 0; rerender();
  for (let i = 0; i < SCAN_STEPS.length; i++) { scan.step = i; rerender(); await sleep(650); }
  scan.step = SCAN_STEPS.length;
  update({ signalsCollected: true });
  scan.active = false;
  toast(t('start.collected'), 'success');
  rerender();
}

export function loadSample() {
  saveBiz(EXAMPLE);
  toast(t('start.loadedToast'), 'success');
  rerender();
}

/** Guard for steps that need data: explains what to press instead of showing results early. */
export function needSignals() {
  const s = getState();
  if (s.signalsCollected) return false;
  toast(t(s.business.loaded ? 'start.needSignals' : 'start.needBusiness'), 'info');
  go(s.business.loaded ? 'signals' : 'overview');
  return true;
}

actions['collect-signals'] = () => collectSignals();
actions['load-sample'] = () => loadSample();
