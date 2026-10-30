// Local mock of the Anthropic Messages API, for testing the real AI code path without a key or network.
//   node scripts/mock-ai.mjs                       (port 5199)
//   ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://localhost:5199 node server.mjs
// It deliberately returns messy output (code fences, trailing commas) to exercise JSON repair.
import http from 'node:http';

const replies = {
  analyst: '```json\n{"problems":[{"title":"MOCK: afternoon offer unclear","evidence":["Website does not explain 14:00-18:00"],"kind":"fact","confidence":88,},{"title":"MOCK: no visible CTA","evidence":["No CTA above the fold"],"kind":"fact","confidence":90}],"facts":["Rating 4.7"],"inferences":["Demand peaks 14:00-18:00"],"needs_owner":["Confirm seats"],}\n```',
  strategist: '{"opportunity":{"title":"MOCK: Coffee break 14:00-18:00","why_now":"Search interest peaks in the window.","hypothesis":"If the offer is visible with a CTA, requests rise within 48h.","impact":"+15% reach, 5 requests (target)","audience":"Remote workers and small groups","confidence":84,"baseline":{"visibility":78,"reach":2400,"requests":0},"target":{"reach_pct":15,"requests":5}}}',
  creator: '{"offer":{"title":"MOCK Coffee break","body":"Coffee and pastry 14-18.","cta":"Reserve"},"post":{"text":"MOCK post: reserve your table","cta":"Reserve"},"headlines":["MOCK 1","MOCK 2","MOCK 3"],"merch":{"concept":"MOCK sticker","sticker_text":"MOCK 14-18"}}',
  builder: '{"headline":"MOCK headline for Copou","subheadline":"MOCK sub","cta":"Reserve","offer_title":"MOCK offer","offer_text":"MOCK offer text","faq":[{"q":"MOCK q?","a":"MOCK a"}]}',
};

http.createServer(async (req, res) => {
  let body = ''; for await (const c of req) body += c;
  let role = 'analyst';
  try { const sys = JSON.parse(body).system || ''; role = Object.keys(replies).find((k) => sys.includes({ analyst: 'analyse local-business', strategist: 'pick ONE opportunity', creator: 'turn the hypothesis', builder: 'scannable local website' }[k])) || role; } catch { /* default */ }
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ model: 'mock-model', content: [{ type: 'text', text: replies[role] }] }));
}).listen(5199, () => console.log('mock Anthropic API on http://localhost:5199'));
