// Small moments of delight: confetti for milestones, a time-of-day greeting and a daily streak.
// Everything respects "reduce motion" (system setting or Settings → Display).
const reduced = () => document.documentElement.dataset.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches;
const COLORS = ['#8B5CF6', '#38BDF8', '#F472B6', '#34D399', '#FBBF24', '#A78BFA'];

/** Bursts confetti from an element (or the screen centre). */
export function confetti(from) {
  if (reduced()) return;
  const r = from?.getBoundingClientRect?.(); const ox = r ? r.left + r.width / 2 : innerWidth / 2; const oy = r ? r.top + r.height / 2 : innerHeight / 3;
  const c = Object.assign(document.createElement('canvas'), { width: innerWidth * devicePixelRatio, height: innerHeight * devicePixelRatio });
  Object.assign(c.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 2000 });
  c.setAttribute('aria-hidden', 'true'); document.body.append(c);
  const g = c.getContext('2d'); g.scale(devicePixelRatio, devicePixelRatio);
  const parts = Array.from({ length: 90 }, () => { const a = Math.random() * Math.PI * 2; const v = 4 + Math.random() * 7;
    return { x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5, w: 5 + Math.random() * 6, h: 3 + Math.random() * 4, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: COLORS[(Math.random() * COLORS.length) | 0], round: Math.random() < 0.3 }; });
  const t0 = performance.now();
  const tick = (now) => {
    const life = (now - t0) / 1600; g.clearRect(0, 0, innerWidth, innerHeight);
    parts.forEach((p) => { p.vy += 0.28; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      g.save(); g.globalAlpha = Math.max(0, 1 - life); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c;
      if (p.round) { g.beginPath(); g.arc(0, 0, p.h, 0, Math.PI * 2); g.fill(); } else g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore(); });
    if (life < 1) requestAnimationFrame(tick); else c.remove();
  };
  requestAnimationFrame(tick);
}

/** 'morning' | 'afternoon' | 'evening' | 'night' for the greeting. */
export function dayPart(d = new Date()) { const h = d.getHours(); return h < 5 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : h < 22 ? 'evening' : 'night'; }
export const PART_EMOJI = { morning: '☀️', afternoon: '🌤️', evening: '🌆', night: '🌙' };

/** Consecutive days the app was opened (kept on this device). */
export function streak() {
  const key = 'arcton.streak'; const today = new Date().toISOString().slice(0, 10);
  let s = { last: '', n: 0 }; try { s = JSON.parse(localStorage.getItem(key) || '') || s; } catch { /* first visit */ }
  if (s.last !== today) { const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10); s = { last: today, n: s.last === y ? s.n + 1 : 1 }; try { localStorage.setItem(key, JSON.stringify(s)); } catch { /* ignore */ } }
  return s.n;
}
