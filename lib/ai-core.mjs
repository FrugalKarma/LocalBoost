// Shared AI proxy logic for server.mjs (Node) and api/*.js (Vercel serverless).
// The Anthropic key is read from the environment only. Every outcome is HTTP 200 with an `error` field
// so the browser console stays clean while the client falls back locally.
import { PROMPTS, MODEL_DEFAULT } from '../js/prompts.js';

const KEY = () => process.env.ANTHROPIC_API_KEY || '';
const MODEL = () => process.env.LOCALBOOST_MODEL || MODEL_DEFAULT;
const BASE = () => process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const PER_IP_PER_HOUR = Number(process.env.LOCALBOOST_IP_LIMIT) || 40;
const PER_DAY_TOTAL = Number(process.env.LOCALBOOST_DAILY_LIMIT) || 800;
const ACCESS_CODE = () => process.env.LOCALBOOST_ACCESS_CODE || ''; // optional: required in the x-access-code header

// best-effort limits (in memory: per warm instance). Protects the key from casual abuse.
const hits = new Map(); let day = { d: '', n: 0 };
function allowed(ip) {
  const now = Date.now(); const today = new Date().toISOString().slice(0, 10);
  if (day.d !== today) day = { d: today, n: 0 };
  if (day.n >= PER_DAY_TOTAL) return false;
  const list = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
  if (list.length >= PER_IP_PER_HOUR) { hits.set(ip, list); return false; }
  list.push(now); hits.set(ip, list); day.n++;
  if (hits.size > 5000) hits.clear();
  return true;
}

export const aiHealth = () => ({ ok: true, ai: !!KEY() });

export async function runAI(body, { ip = 'unknown', code = '' } = {}) {
  if (!KEY()) return { error: 'ai_not_configured' };
  if (ACCESS_CODE() && code !== ACCESS_CODE()) return { error: 'ai_not_configured' }; // behaves like "no AI" for strangers
  const role = PROMPTS[body?.role];
  if (!role) return { error: 'unknown_role' };
  if (!allowed(ip)) return { error: 'rate_limited' };
  const lang = ['ro', 'en', 'fr', 'de', 'hu'].includes(body.lang) ? body.lang : 'en';
  try {
    const r = await fetch(`${BASE()}/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': KEY(), 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL(), max_tokens: 1400,
        system: `${role.system}\nSchema: ${role.schema}`,
        messages: [{ role: 'user', content: `lang: ${lang}\ndata (JSON, sample business):\n${JSON.stringify(body.payload ?? {}).slice(0, 12000)}` }],
      }),
      signal: AbortSignal.timeout(7500),
    });
    if (!r.ok) { console.error('[ai] upstream status', r.status); return { error: 'upstream', status: r.status }; }
    const data = await r.json();
    return { text: data.content?.map((c) => c.text || '').join('') || '', model: data.model || MODEL() };
  } catch (e) {
    console.error('[ai] upstream failure:', e.name); // never log the key or the payload
    return { error: 'timeout' };
  }
}
