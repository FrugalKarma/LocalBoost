// Security headers for the app pages. Used by server.mjs; scripts/check.mjs keeps vercel.json identical.
// Hosted business sites (/s/<slug>) send their own, stricter policy from lib/site-core.mjs.
import { createHash } from 'node:crypto';
import { SITE_JS } from '../js/siteTemplate.js';

// The website builder previews the site in a sandboxed srcdoc frame, which inherits this policy,
// so the site's one inline script is allowed by its hash (and nothing else inline is).
const SITE_JS_HASH = `'sha256-${createHash('sha256').update(SITE_JS).digest('base64')}'`;

export const CSP = [
  "default-src 'self'",
  `script-src 'self' ${SITE_JS_HASH}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co",
  "frame-src 'self' https://www.openstreetmap.org",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export const APP_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};
