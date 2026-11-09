// Sending email through Resend (RESEND_API_KEY). Used by the weekly digest, the launch email and payment receipts.
export const mailFrom = () => process.env.LOCALBOOST_MAIL_FROM || 'Arcton Ai <onboarding@resend.dev>';
export const mailOn = () => !!(process.env.RESEND_API_KEY || '').trim();
export const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Sends mails ({ to, subject, text, html, headers? }; from is added). Returns how many were accepted. */
export async function sendMails(mails) {
  const key = (process.env.RESEND_API_KEY || '').trim(); if (!key || !mails.length) return 0;
  let sent = 0;
  for (let i = 0; i < mails.length; i += 100) { // Resend batch: up to 100 emails per call
    const part = mails.slice(i, i + 100).map((m) => ({ from: mailFrom(), ...m }));
    const r = await fetch('https://api.resend.com/emails/batch', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify(part), signal: AbortSignal.timeout(20000) }).catch(() => null);
    if (r?.ok) sent += part.length;
  }
  return sent;
}

/** A plain Bordo email: title, paragraphs, one button, footer. Returns { text, html }. */
export function simpleMail({ title, lines = [], button, foot = [] }) {
  const text = [title, '', ...lines, '', ...(button ? [`${button.label}: ${button.url}`, ''] : []), ...foot].join('\n');
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:auto;color:#1A1414;font-size:16px;line-height:1.55">
<p style="margin:0 0 6px;color:#8E1B2C;font-weight:700;letter-spacing:.12em;font-size:12px">ARCTON AI</p><h1 style="margin:0 0 18px;font-size:24px;font-weight:700">${esc(title)}</h1>
${lines.map((l) => `<p style="margin:0 0 14px">${esc(l)}</p>`).join('')}
${button ? `<p style="margin:22px 0 30px"><a href="${esc(button.url)}" style="display:inline-block;padding:12px 22px;background:#8E1B2C;color:#fff;text-decoration:none;font-weight:600">${esc(button.label)}</a></p>` : ''}
<p style="margin:0;color:#8C827A;font-size:12px">${foot.map(esc).join('<br>')}</p></div>`;
  return { text, html };
}
