// Tiny action/input registry so views stay declarative (data-act / data-in attributes).
export const actions = {};
export const inputs = {};
let rr = () => {};
export const setRerender = (fn) => { rr = fn; };
export const rerender = (opts) => rr(opts);
export const go = (route) => { location.hash = `#/${route}`; };

export const ROUTES = [
  { id: 'overview', icon: 'overview', mobile: true },
  { id: 'signals', icon: 'signals', mobile: true },
  { id: 'competitors', icon: 'compare' },
  { id: 'diagnosis', icon: 'diagnosis', mobile: true },
  { id: 'mission', icon: 'mission', mobile: true },
  { id: 'website', icon: 'website' },
  { id: 'pack', icon: 'pack' },
  { id: 'proof', icon: 'proof' },
  { id: 'settings', icon: 'settings' },
  { id: 'account', icon: 'account' },
];
