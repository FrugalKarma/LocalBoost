// Vercel serverless: sign-up, sign-in, tokens and password reset. Logic lives in lib/auth-core.mjs.
import { corsHeaders } from '../lib/ai-core.mjs';
import { vercelAccount } from '../lib/auth-core.mjs';

export default function handler(req, res) { return vercelAccount('auth', req, res, corsHeaders); }
