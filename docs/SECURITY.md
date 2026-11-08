# Security

What protects Arcton Ai, and what you must set yourself. `node scripts/check.mjs` checks the parts it can on every build.

## Set these on Vercel (Settings → Environment Variables)

| Variable | Why |
|---|---|
| `ARCTON_ADMIN_HASH` | Your admin password, as a hash (command in docs/ACCOUNTS.md). The default hash is in the source code, so set your own before launch. |
| `ARCTON_ADMIN_SECRET` | 32+ random characters. Signs admin sessions and early-access passes. Without it, a key is derived from your other server keys. |
| `ARCTON_PREVIEW_HASH` | Optional separate early-access password for testers, so they never get the admin password. |
| `LOCALBOOST_PUBLIC_URL` | `https://www.arcton.site`. Email and booking links are built from this, never from the request's Host header. |

Keep these only on Vercel, never in the code: `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_PLACES_API_KEY`, `RESEND_API_KEY`.

In Supabase → Authentication: keep **Confirm email** on (stops account pre-hijacking), and set **Site URL** and **Redirect URLs** to `https://www.arcton.site` only.

## What the code does

- **Secrets:** API keys live on the server only. The check fails the build if something that looks like a real key appears in the repository. The git history was scanned on 2026-11-08: no real keys.
- **Files:** only the app (index.html, css, js, icons) is served. `.git`, server code, docs and the database schema are not.
- **Accounts:** passwords are hashed by Supabase (customers) and with scrypt (admin). Sessions expire, and comparisons are constant-time. Sign-in, sign-up and reset are limited per address and in total.
- **Before launch:** sign-up and sign-in need an early-access pass, checked on the server.
- **Data:** row-level security is on with no policies. The browser never talks to the database, and every query is scoped to the signed-in owner. Plans and the free AI allowance are decided on the server.
- **AI:** reviews and website text are treated as quoted data, never as instructions. Answers are shown as escaped text. The free monthly allowance is reserved with a conditional update, so parallel requests cannot exceed it, and a failed call gives the use back.
- **Website check:** it blocks private, loopback and cloud-metadata addresses (IPv4 and IPv6, including the encoded forms). It checks again when connecting and on every redirect, against DNS rebinding.
- **Redirects:** links in sign-up and reset emails can only point to arcton.site.
- **Headers:** Content-Security-Policy (no inline scripts), clickjacking protection (frame-ancestors, X-Frame-Options), HSTS, nosniff, Referrer-Policy and Permissions-Policy. Hosted business sites run in a sandbox with their own stricter policy.
- **Uploads:** JPEG, PNG and WebP only, up to 3 MB each. The type is checked from the file's first bytes, and files are stored under random names.
- **Public forms:** booking requests are rate-limited, with a honeypot field and a consent tick.
- **Third-party code:** no external scripts. Only Google Fonts stylesheets.
- **Dependencies:** `npm audit` clean on 2026-11-08 (build tools only; the app itself has no runtime dependencies).

## Still worth knowing

- Rate limits are kept in memory per server instance. On Vercel that is per warm function, so treat them as a brake, not a wall.
- DNS: every `*.arcton.site` name points to Vercel (a wildcard record). That is safe while the domain is in your Vercel account. If you ever remove it from Vercel, delete the DNS records too.
