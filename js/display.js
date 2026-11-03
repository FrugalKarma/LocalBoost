// Display preferences (this device): text size, motion, contrast, density. Applied before first paint by app.js.
const KEY = 'arcton.display';
export const DISPLAY = { text: ['normal', 'large', 'xl'], motion: ['auto', 'reduce'], contrast: ['normal', 'more'] };
export function getDisplay() {
  let d = {}; try { d = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { /* ignore */ }
  return { text: DISPLAY.text.includes(d.text) ? d.text : 'normal', motion: DISPLAY.motion.includes(d.motion) ? d.motion : 'auto', contrast: DISPLAY.contrast.includes(d.contrast) ? d.contrast : 'normal' };
}
export function applyDisplay(d = getDisplay()) {
  const r = document.documentElement;
  r.dataset.text = d.text; r.dataset.motion = d.motion; r.dataset.contrast = d.contrast;
}
export function setDisplay(k, v) {
  const d = { ...getDisplay(), [k]: v };
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignore */ }
  applyDisplay(d); return d;
}
