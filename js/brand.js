// Brand and company details in one place. Fill in the empty company fields before launch:
// Romanian law (Legea 365/2002, GDPR art. 13) requires the operator's identity and contact on the site.
export const BRAND = {
  app: 'Arcton Ai',
  short: 'Arcton',
  tagline: 'See what lies beneath.',
  company: 'Arcton Ai Consulting SRL',
  country: 'România',
  // ---- complete these (shown in Info → Company and in the legal pages only when filled) ----
  cui: '', // fiscal code, e.g. RO12345678
  regNo: '', // trade register number, e.g. J22/1234/2026
  address: '', // registered office
  email: '', // general contact, e.g. hello@arcton.ai
  privacyEmail: '', // privacy / data protection requests (can be the same as email)
  dpo: '', // data protection officer, if appointed (optional for a small company)
  // ---- bank transfer for Pro / Business (shown to clients who choose a paid plan) ----
  iban: '', // e.g. RO49AAAA1B31007593840000
  bank: '', // e.g. Banca Transilvania
};

/** Version of the Terms, Privacy and AI notices. Raise it when they change: everyone is asked to accept again. */
export const LEGAL_VERSION = '2026-11-08';
export const LEGAL_UPDATED = '2026-11-08';
export const contactEmail = () => BRAND.privacyEmail || BRAND.email;
