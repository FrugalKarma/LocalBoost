// Local mock of the Anthropic Messages API, for testing the real AI code path without a key or network.
//   node scripts/mock-ai.mjs                       (port 5199)
//   ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://localhost:5199 node server.mjs
// Structured roles return deliberately messy JSON (code fences, trailing commas) to exercise JSON repair.
// Chat (stream: true) streams Server-Sent Events like the real API. Test words in the last question:
//   SLOW -> no first token for 20 s (client/server timeout), FAIL -> HTTP 500, BUSY -> HTTP 429.
import http from 'node:http';

const replies = {
  analyst: '```json\n{"problems":[{"title":"MOCK: afternoon offer unclear","evidence":["Website does not explain 14:00-18:00"],"kind":"fact","confidence":88,},{"title":"MOCK: no visible CTA","evidence":["No CTA above the fold"],"kind":"fact","confidence":90}],"facts":["Rating 4.7"],"inferences":["Demand peaks 14:00-18:00"],"needs_owner":["Confirm seats"],}\n```',
  strategist: '{"opportunity":{"title":"MOCK: Coffee break 14:00-18:00","why_now":"Search interest peaks in the window.","hypothesis":"If the offer is visible with a CTA, requests rise within 48h.","impact":"+15% reach, 5 requests (target)","audience":"Remote workers and small groups","confidence":84,"baseline":{"visibility":78,"reach":2400,"requests":0},"target":{"reach_pct":15,"requests":5}}}',
  creator: '{"offer":{"title":"MOCK Coffee break","body":"Coffee and pastry 14-18.","cta":"Reserve"},"post":{"text":"MOCK post: reserve your table","cta":"Reserve"},"headlines":["MOCK 1","MOCK 2","MOCK 3"],"merch":{"concept":"MOCK sticker","sticker_text":"MOCK 14-18"}}',
  builder: '{"headline":"MOCK headline for Copou","subheadline":"MOCK sub","cta":"Reserve","offer_title":"MOCK offer","offer_text":"MOCK offer text","faq":[{"q":"MOCK q?","a":"MOCK a"}]}',
  namer: '{"handles":["mock.copou","mock_cafe"],"names":[]}',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

http.createServer(async (req, res) => {
  let body = ''; for await (const c of req) body += c;
  let json = {}; try { json = JSON.parse(body); } catch { /* empty */ }
  if (json.stream) {
    const last = String(json.messages?.at(-1)?.content || '');
    if (/FAIL/.test(last)) { res.writeHead(500, { 'content-type': 'application/json' }); return res.end('{"type":"error"}'); }
    if (/BUSY/.test(last)) { res.writeHead(429, { 'content-type': 'application/json' }); return res.end('{"type":"error"}'); }
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const ev = (o) => res.write(`event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`);
    ev({ type: 'message_start', message: { model: 'mock-model' } });
    if (/SLOW/.test(last)) await sleep(20000);
    const ctx = /CONTEXT[^\n]*\n([\s\S]*)$/.exec(json.system || '')?.[1] || '';
    const biz = /"name":"([^"]+)"/.exec(ctx)?.[1] || 'your business';
    const text = `**MOCK answer** for ${biz} (lang ${/lang: (\w+)/.exec(json.system || '')?.[1]}).\nYou asked: "${last.slice(0, 80)}"\n- First, a concrete step.\n- Then a second one.\n- Turns in this chat: ${json.messages.length}.`;
    for (const piece of text.match(/.{1,12}/gs)) { if (res.destroyed) return; ev({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: piece } }); await sleep(40); }
    ev({ type: 'message_delta', delta: { stop_reason: 'end_turn' } }); ev({ type: 'message_stop' });
    return res.end();
  }
  let role = 'analyst';
  const sys = json.system || '';
  role = Object.keys(replies).find((k) => sys.includes({ analyst: 'analyse local-business', strategist: 'pick ONE opportunity', creator: 'turn the hypothesis', builder: 'scannable local website', namer: 'social-media handles' }[k])) || role;
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ model: 'mock-model', content: [{ type: 'text', text: replies[role] }] }));
}).listen(5199, () => console.log('mock Anthropic API on http://localhost:5199'));
