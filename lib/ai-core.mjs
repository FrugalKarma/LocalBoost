// Shared AI proxy logic for server.mjs (Node) and api/*.js (Vercel serverless).
// The Anthropic key is read from the environment only and never reaches the browser.
// Structured roles (/api/ai) answer HTTP 200 with an `error` field so the client falls back quietly.
// Open questions (/api/chat) stream Server-Sent Events: meta -> delta* -> done | error.
import { PROMPTS, MODEL_DEFAULT, CHAT_SYSTEM } from '../js/prompts.js';

const KEY = () => process.env.ANTHROPIC_API_KEY || '';
const MODEL = () => process.env.LOCALBOOST_MODEL || MODEL_DEFAULT;
const CHAT_MODEL = () => process.env.LOCALBOOST_CHAT_MODEL || MODEL();
const BASE = () => (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
const ROLE_TIMEOUT_MS = () => Number(process.env.LOCALBOOST_AI_TIMEOUT_MS) || 15000; // one structured call
const CHAT_FIRST_TOKEN_MS = 15000; // no first word within this -> timeout
const CHAT_TOTAL_MS = 60000; // hard cap for one streamed answer
const PER_IP_PER_HOUR = () => Number(process.env.LOCALBOOST_IP_LIMIT) || 40;
const PER_DAY_TOTAL = () => Number(process.env.LOCALBOOST_DAILY_LIMIT) || 800;
const ACCESS_CODE = () => process.env.LOCALBOOST_ACCESS_CODE || ''; // optional: required in the x-access-code header
const ORIGINS = () => (process.env.LOCALBOOST_ALLOWED_ORIGINS || 'capacitor://localhost,https://localhost,http://localhost').split(',').map((s) => s.trim()).filter(Boolean);
const LANGS = ['ro', 'en', 'fr', 'de', 'hu'];
const MAX_MSG = 2000; const MAX_TURNS = 12; const MAX_CONTEXT = 8000;

// best-effort limits (in memory, per warm instance). Protects the key from casual abuse; see docs for a shared store.
const hits = new Map(); let day = { d: '', n: 0 };
function allowed(ip) {
  const now = Date.now(); const today = new Date().toISOString().slice(0, 10);
  if (day.d !== today) day = { d: today, n: 0 };
  if (day.n >= PER_DAY_TOTAL()) return false;
  const list = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
  if (list.length >= PER_IP_PER_HOUR()) { hits.set(ip, list); return false; }
  list.push(now); hits.set(ip, list); day.n++;
  if (hits.size > 5000) hits.clear();
  return true;
}

export const aiHealth = () => ({ ok: true, ai: !!KEY(), chat: !!KEY() });

/** CORS for the packaged Android/iOS app (Capacitor) and any extra origins listed in LOCALBOOST_ALLOWED_ORIGINS. */
export function corsHeaders(origin) {
  if (!origin || !ORIGINS().includes(origin)) return {};
  return { 'access-control-allow-origin': origin, vary: 'Origin', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type, x-access-code', 'access-control-max-age': '600' };
}

function gate(code, ip) {
  if (!KEY()) return 'ai_not_configured';
  if (ACCESS_CODE() && code !== ACCESS_CODE()) return 'ai_not_configured'; // behaves like "no AI" for strangers
  if (!allowed(ip)) return 'rate_limited';
  return null;
}
const headers = () => ({ 'content-type': 'application/json', 'x-api-key': KEY(), 'anthropic-version': '2023-06-01' });

/* ---------- structured roles (analyst, strategist, creator, namer, builder) ---------- */
export async function runAI(body, { ip = 'unknown', code = '' } = {}) {
  const role = PROMPTS[body?.role];
  if (!KEY()) return { error: 'ai_not_configured' };
  if (!role) return { error: 'unknown_role' };
  const blocked = gate(code, ip); if (blocked) return { error: blocked };
  const lang = LANGS.includes(body.lang) ? body.lang : 'en';
  try {
    const r = await fetch(`${BASE()}/v1/messages`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({
        model: MODEL(), max_tokens: 1400,
        system: `${role.system}\nSchema: ${role.schema}`,
        messages: [{ role: 'user', content: `lang: ${lang}\ndata (JSON, sample business):\n${JSON.stringify(body.payload ?? {}).slice(0, 12000)}` }],
      }),
      signal: AbortSignal.timeout(ROLE_TIMEOUT_MS()),
    });
    if (!r.ok) { console.error('[ai] upstream status', r.status); return { error: r.status === 429 ? 'rate_limited' : 'upstream', status: r.status }; }
    const data = await r.json();
    return { text: data.content?.map((c) => c.text || '').join('') || '', model: data.model || MODEL() };
  } catch (e) {
    console.error('[ai] upstream failure:', e.name); // never log the key or the payload
    return { error: 'timeout' };
  }
}

/* ---------- open questions (streamed) ---------- */
/** Validate and trim the conversation; returns { messages, context, lang } or { error }. */
export function prepareChat(body) {
  const raw = Array.isArray(body?.messages) ? body.messages : [];
  const messages = raw.slice(-MAX_TURNS).map((m) => ({ role: m?.role === 'assistant' ? 'assistant' : 'user', content: String(m?.content ?? '').trim() }))
    .filter((m) => m.content);
  if (!messages.length || messages[messages.length - 1].role !== 'user') return { error: 'bad_request' };
  if (messages.some((m) => m.role === 'user' && m.content.length > MAX_MSG)) return { error: 'too_long' };
  messages.forEach((m) => { m.content = m.content.slice(0, 4000); }); // long assistant turns are trimmed, not rejected
  while (messages.length && messages[0].role !== 'user') messages.shift(); // the API expects the first turn from the user
  for (let i = messages.length - 1; i > 0; i--) { // merge consecutive turns from the same side (e.g. a retry after an error)
    if (messages[i].role === messages[i - 1].role) { messages[i - 1].content += `\n\n${messages[i].content}`; messages.splice(i, 1); }
  }
  const lang = LANGS.includes(body?.lang) ? body.lang : 'en';
  const context = JSON.stringify(body?.context ?? {}).slice(0, MAX_CONTEXT);
  return { messages, context, lang };
}

/**
 * Stream an answer. `emit(event)` is called with { type: 'meta' | 'delta' | 'done' | 'error', ... }.
 * `clientSignal` aborts the upstream call when the browser disconnects or presses Stop.
 */
export async function streamChat(body, { ip = 'unknown', code = '', emit, clientSignal } = {}) {
  const prep = prepareChat(body);
  if (prep.error) return emit({ type: 'error', error: prep.error });
  const blocked = gate(code, ip); if (blocked) return emit({ type: 'error', error: blocked });
  const ctrl = new AbortController();
  const total = setTimeout(() => ctrl.abort('timeout'), CHAT_TOTAL_MS);
  let first = setTimeout(() => ctrl.abort('timeout'), CHAT_FIRST_TOKEN_MS);
  clientSignal?.addEventListener('abort', () => ctrl.abort('client'), { once: true });
  const system = `${CHAT_SYSTEM}\nlang: ${prep.lang}\nCONTEXT (JSON; demo data about a fictional business unless marked user):\n${prep.context}`;
  let sentAny = false;
  try {
    const r = await fetch(`${BASE()}/v1/messages`, {
      method: 'POST', headers: headers(), signal: ctrl.signal,
      body: JSON.stringify({ model: CHAT_MODEL(), max_tokens: 1024, stream: true, system, messages: prep.messages }),
    });
    if (!r.ok || !r.body) {
      console.error('[chat] upstream status', r.status);
      return emit({ type: 'error', error: r.status === 429 || r.status === 529 ? 'rate_limited' : 'upstream' });
    }
    emit({ type: 'meta', model: CHAT_MODEL() });
    const dec = new TextDecoder(); let buf = ''; let stop = 'end_turn';
    for await (const chunk of r.body) {
      buf += dec.decode(chunk, { stream: true }).replace(/\r\n/g, '\n');
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i); buf = buf.slice(i + 2);
        const line = block.split('\n').find((l) => l.startsWith('data:'));
        if (!line) continue;
        let ev; try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }
        if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
          if (first) { clearTimeout(first); first = null; }
          sentAny = true; emit({ type: 'delta', text: ev.delta.text });
        } else if (ev.type === 'message_delta' && ev.delta?.stop_reason) stop = ev.delta.stop_reason;
        else if (ev.type === 'error') { console.error('[chat] stream error', ev.error?.type); return emit({ type: 'error', error: ev.error?.type === 'overloaded_error' ? 'rate_limited' : 'upstream', partial: sentAny }); }
      }
    }
    emit({ type: 'done', stop });
  } catch (e) {
    const why = ctrl.signal.reason === 'client' ? 'aborted' : 'timeout';
    if (why !== 'aborted') console.error('[chat] upstream failure:', e.name);
    emit({ type: 'error', error: why, partial: sentAny });
  } finally { clearTimeout(total); if (first) clearTimeout(first); }
}
