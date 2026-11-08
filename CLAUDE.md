# Arcton Ai: rules for AI coding assistants

Vanilla-JS PWA (`js/`, `css/`) with serverless functions (`api/` → `lib/*-core.mjs`). Local server: `node server.mjs`. Before every commit: `node scripts/check.mjs` must pass.

## Security rules (never break these)

- Secrets (Supabase service key, Anthropic, Google Places, Resend) live only in environment variables on the server. Never in `js/`, never in git, never in chat.
- The browser never talks to Supabase tables. Every read and write goes through `lib/*-core.mjs`, which checks the user first.
- Plan, role and AI quota are decided on the server (`requireUser`, `requireAI`, `planOf`). Whatever the browser stores (session, plan) only changes what the UI shows.
- Every query that touches a client's rows filters by the caller's id (`owner=eq.${owner}`), never by an id taken only from the request.
- Public endpoints are rate limited per IP and globally; keep it that way for anything new (see `throttled` in `lib/site-core.mjs`, `limited` in `lib/owner-core.mjs`).
- Validate input on the server: known ops only, allow-lists for enums, length caps, ignore unknown fields.
- No inline scripts in the app (CSP). Third-party requests from pages need a reason: fonts are self-hosted in `fonts/` so no visitor IP goes to Google.

## Who can do what (access control matrix)

See [docs/ACCESS.md](docs/ACCESS.md). Any new endpoint or field must be added there first, then implemented to match.
