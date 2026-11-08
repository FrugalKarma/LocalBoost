// Vercel serverless: the weekly email digest (cron, Mondays) and its unsubscribe link. Logic lives in lib/digest-core.mjs.
import { vercelDigest } from '../lib/digest-core.mjs';

export default function handler(req, res) { return vercelDigest(req, res); }
