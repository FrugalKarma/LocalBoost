// DEMO DATA - fictional business "Cafeneaua Copou". Never presented as live data.
export const BUSINESS = {
  id: 'cafeneaua-copou',
  name: 'Cafeneaua Copou',
  city: 'Copou, Iași',
  rating: 4.7,
  visibility: 78,
  reach: 2400,
  trend: 31.8,
  windowStart: 14,
  windowEnd: 18,
  services: ['specialty', 'workspace', 'meetings', 'groups', 'pastry', 'break'],
};

// text lives in the locale files under d.<id>.evidence
export const SIGNALS = [
  { id: 'rev-atmosphere', type: 'review', source: 'Google Reviews', confidence: 88, status: 'demo' },
  { id: 'rev-coffee', type: 'review', source: 'Google Reviews', confidence: 85, status: 'demo' },
  { id: 'q-hours', type: 'question', source: 'Customer questions', confidence: 82, status: 'demo' },
  { id: 'web-afternoon', type: 'website', source: 'Website audit', confidence: 79, status: 'demo' },
  { id: 'web-cta', type: 'website', source: 'Website audit', confidence: 91, status: 'demo' },
  { id: 'search-window', type: 'search', source: 'Local search trends', confidence: 74, status: 'inference' },
];

export const SIGNAL_TYPES = ['review', 'social', 'question', 'website', 'search'];

// sample comments from social accounts; shown only for networks the business has added (real ones need an official API connection)
export const SOCIAL_SIGNALS = [
  { id: 'soc-instagram', net: 'instagram', type: 'social', source: 'Instagram comments', confidence: 70, status: 'demo' },
  { id: 'soc-tiktok', net: 'tiktok', type: 'social', source: 'TikTok comments', confidence: 66, status: 'demo' },
  { id: 'soc-facebook', net: 'facebook', type: 'social', source: 'Facebook comments', confidence: 72, status: 'demo' },
];

// relative search interest by hour (08..21) - DEMO DATA
export const HOURLY = [22, 34, 41, 38, 45, 52, 88, 94, 100, 91, 63, 48, 36, 28];
export const HOURLY_START = 8;

// local reach: a deterministic simulated curve so any chosen period gives consistent numbers (today = 2.4k, 8 weeks ago = 1.82k)
export const REACH_NOW = 2400;
const REACH_K = (2400 / 1820 - 1) / 56;
const DAY = 864e5;
export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const hash = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
export function reachOn(date) {
  const day = startOfDay(date); const days = Math.max(0, Math.round((startOfDay(new Date()) - day) / DAY));
  const noise = days === 0 ? 0 : (hash(Math.floor(day.getTime() / DAY)) - 0.5) * 0.03;
  return Math.round((REACH_NOW / (1 + REACH_K * days)) * (1 + noise));
}
export const RANGE_PRESETS = { '7d': 7, '30d': 30, '8w': 56, '90d': 90 };
/** Resolve the selected period to concrete dates. */
export function resolveRange(range) {
  const today = startOfDay(new Date());
  if (range?.preset === 'custom' && range.from && range.to) {
    const from = startOfDay(range.from); const to = startOfDay(range.to);
    if (!Number.isNaN(+from) && !Number.isNaN(+to) && from < to && to <= today) return { from, to, days: Math.round((to - from) / DAY), custom: true };
  }
  const days = RANGE_PRESETS[range?.preset] || 56;
  return { from: new Date(today - days * DAY), to: today, days, custom: false };
}
/** Reach series, change versus the start and versus the previous period of the same length. */
export function reachStats(range) {
  const { from, to, days } = resolveRange(range);
  const step = Math.max(1, Math.ceil(days / 48));
  const points = [];
  for (let d = 0; d <= days; d += step) points.push({ date: new Date(+from + d * DAY), value: reachOn(new Date(+from + d * DAY)) });
  if (points[points.length - 1].date < to) points.push({ date: to, value: reachOn(to) });
  const avg = (a, b) => { let s = 0; let n = 0; for (let d = 0; d <= Math.round((b - a) / DAY); d++) { s += reachOn(new Date(+a + d * DAY)); n++; } return s / n; };
  const prevFrom = new Date(+from - days * DAY);
  const end = points[points.length - 1].value; const start = points[0].value;
  return { points, end, start, changePct: (end / start - 1) * 100, vsPrevPct: (avg(from, to) / avg(prevFrom, new Date(+from - DAY)) - 1) * 100, from, to, days };
}

// themes mined from reviews and questions (mention counts) - DEMO DATA
// reasons: counts behind each theme; split: [guests who knew, guests who asked or complained]
export const THEMES = [
  { id: 'atmosphere', mentions: 38, tone: 'pos', reasons: [18, 11, 9] },
  { id: 'coffee', mentions: 31, tone: 'pos', reasons: [16, 9, 6] },
  { id: 'hours', mentions: 17, tone: 'gap', reasons: [7, 6, 4], split: [6, 11] },
  { id: 'seats', mentions: 12, tone: 'gap', reasons: [5, 4, 3], split: [4, 8] },
];

// nearby places - FICTIONAL sample data (a real version needs a places/maps connector)
export const YOU_BASE = { rating: 4.7, reviews: 126, visibility: 78 };
export const COMPETITORS = [
  { id: 'bolta', name: 'Café Bolta', dist: '0.4 km', rating: 4.5, reviews: 214, visibility: 84, reach: 3300, posts: 5, booking: true, afternoon: true },
  { id: 'lumea', name: 'Lumea Cafelei', dist: '0.7 km', rating: 4.3, reviews: 163, visibility: 71, reach: 2150, posts: 3, booking: false, afternoon: true },
  { id: 'roastery', name: 'The Roastery', dist: '1.1 km', rating: 4.6, reviews: 305, visibility: 88, reach: 3900, posts: 6, booking: true, afternoon: false },
  { id: 'studio', name: 'Studio Brew', dist: '1.4 km', rating: 4.2, reviews: 88, visibility: 63, reach: 1480, posts: 1, booking: false, afternoon: false },
  { id: 'parc', name: 'Cafeneaua din Parc', dist: '1.9 km', rating: 4.4, reviews: 141, visibility: 69, reach: 1920, posts: 2, booking: false, afternoon: true },
];
export const BASELINE = { visibility: 78, reach: 2400, requests: 0 };
export const TARGET = { reachPct: 15, requests: 5, ctaClicks: 'up' };
export const MISSION_HOURS = 48;

export const SLOTS = ['14:00–15:00', '15:00–16:00', '16:00–17:00', '17:00–18:00'];
