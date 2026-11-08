// Motion that carries meaning: when a screen opens, its key numbers count up to their value,
// so the eye lands on what changed. Bars and rings grow in CSS (css/app.css). Off with reduced motion.
const reduced = () => document.documentElement.dataset.motion === 'reduce' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// the numbers worth animating: stat tiles, map stats, confidence and score figures
const TARGETS = '.stat-strip b, .map-stat b, .map-stat strong, .ring-num, .big-num, .kpi strong, .qa-score b, .pub-stats b, .admin-kpis b, .plan-prog b, .cmp-top b, .result-top b';
const NUM = /^(\D{0,2})(\d{1,3}(?:[.,]\d+)?)(\D{0,3})$/; // optional prefix, the number, optional suffix like % or ★

export function animateNumbers(root) {
  if (reduced() || !root) return;
  for (const el of root.querySelectorAll(TARGETS)) {
    if (el.children.length) continue; // only plain text figures
    const m = NUM.exec(el.textContent.trim()); if (!m) continue;
    const [, pre, raw, post] = m; const sep = raw.includes(',') ? ',' : '.';
    const end = Number(raw.replace(',', '.')); if (!Number.isFinite(end) || end === 0) continue;
    const dec = (raw.split(/[.,]/)[1] || '').length;
    const t0 = performance.now(); const dur = 650 + Math.min(450, end * 4);
    el.style.fontVariantNumeric = 'tabular-nums';
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur); const e = 1 - (1 - k) ** 3;
      el.textContent = `${pre}${(end * e).toFixed(dec).replace('.', sep)}${post}`;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}
