// Phone notifications for the owner (Web Push). The phone makes its own key pair; the server keeps only the push
// address and the public keys, and encrypts every message for this phone (lib/webpush.mjs).

const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

/** 'on' | 'off' | 'blocked' (the person said no in the browser) | 'ios-home' (iPhone: open the app from the Home Screen first) | 'unsupported' */
export async function pushState() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return ios() && !standalone() ? 'ios-home' : 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const reg = await navigator.serviceWorker.getRegistration(); const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

const keyBytes = (b64u) => Uint8Array.from(atob(b64u.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/** Asks the browser, subscribes, returns the subscription as JSON (send it to the server), or { error }. */
export async function subscribe(publicKey) {
  if (await Notification.requestPermission() !== 'granted') return { error: 'blocked' };
  const reg = await navigator.serviceWorker.ready;
  try {
    const old = await reg.pushManager.getSubscription(); if (old) await old.unsubscribe(); // a new server key needs a new subscription
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
    return { sub: sub.toJSON() };
  } catch { return { error: 'failed' }; }
}

/** Stops notifications on this device; returns the push address so the server can forget it. */
export async function unsubscribe() {
  const reg = await navigator.serviceWorker.getRegistration(); const sub = await reg?.pushManager.getSubscription();
  if (!sub) return ''; const endpoint = sub.endpoint; await sub.unsubscribe().catch(() => {}); return endpoint;
}
