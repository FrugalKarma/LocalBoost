const KEY = 'localboost.theme';

export function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function applyTheme(mode) {
  document.documentElement.dataset.theme = mode;
  try { localStorage.setItem(KEY, mode); } catch { /* ignore */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'dark' ? '#260B18' : '#54172A');
}

export function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* ignore */ }
  applyTheme(saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
}

export function toggleTheme() { applyTheme(currentTheme() === 'dark' ? 'light' : 'dark'); }

/** Runs `change` (which switches the theme and re-renders) inside a circular reveal from `origin`, or a soft fade. */
export function themeTransition(origin, change) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  if (reduced || document.visibilityState !== 'visible') { change(); return; } // hidden pages never paint a transition frame
  if (!document.startViewTransition) {
    root.classList.add('theme-fade'); change(); setTimeout(() => root.classList.remove('theme-fade'), 520); return;
  }
  const r = origin?.getBoundingClientRect?.();
  const x = r ? r.left + r.width / 2 : window.innerWidth - 40; const y = r ? r.top + r.height / 2 : 30;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const vt = document.startViewTransition(() => { change(); });
  vt.ready.then(() => {
    root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 650, easing: 'cubic-bezier(.4,0,.2,1)', pseudoElement: '::view-transition-new(root)' });
  }).catch(() => {});
}
