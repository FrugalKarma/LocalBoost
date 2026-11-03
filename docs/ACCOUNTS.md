# Accounts and the admin area

LocalBoost can run with accounts: every business owner signs in with email and password, their work is saved to their account (so it follows them to any device), and one or more **admins** see every client.

Accounts are **off** until the three Supabase variables below are set. With them off, the app works exactly as before: on one device, no sign-in.

## What you get

| For | What |
| --- | --- |
| Business owners | Create account, sign in, forgot password (email link), change password, sign out, **delete my account** (required by Google Play), work saved automatically about a second after every change |
| Admins | **Admin** in the account menu: every client with business, email, city, journey stage, last save and status; search; **Open** a client to see and edit all of their screens (a yellow bar shows whose data it is, edits save to their account); **Disable / Enable** (signs them out and blocks sign-in, data kept); **Delete** (account and data, permanent) |
| Your AI bill | With accounts on, `/api/ai` and `/api/chat` only answer signed-in, enabled users |

## How it is built

- **Supabase** handles passwords, sessions and emails (Supabase Auth) and stores the data (Postgres).
- The browser never talks to Supabase directly. It calls `/api/auth`, `/api/data` and `/api/admin` on your own server (Vercel functions or `server.mjs`). Those use the secret key, which never reaches the browser or the Android app.
- Tables: `sites`, `site_requests` and `site_stats` hold published websites, their booking requests and daily visit counts. `profiles` (email, role `client` or `admin`, disabled) and `businesses` (one row per owner, the whole workspace as JSON plus name, city and stage for the admin list). Row-level security is on with no policies, so only the server can read or write them.
- Saves carry a version number. If the owner and the admin edit the same business at the same time, the second save gets the newer copy instead of overwriting it.
- Signing out clears that browser's copy, so a shared computer never shows the previous person's business.
- The first time someone signs in on a browser that already holds work from before accounts existed, that work is uploaded to their account.

## Set it up (about 10 minutes)

1. **Create a Supabase project** at supabase.com (free tier is fine). Pick the EU (Frankfurt) region if your clients are in Romania.
2. **Create the tables.** Supabase → *SQL Editor* → *New query* → paste all of [`supabase/schema.sql`](../supabase/schema.sql) → *Run*. (Already ran an older version? Run it again: it only adds what is missing.)
3. **Point emails at your site.** Supabase → *Authentication* → *URL Configuration*:
   - *Site URL*: your Vercel address, e.g. `https://local-boost-livid.vercel.app`
   - *Redirect URLs*: add the same address with `/**` at the end.
4. **Copy three values into Vercel.** Supabase → *Project Settings* → *API Keys* (and *Data API* for the URL). In Vercel → *Settings* → *Environment Variables* add:

   | Variable | Where it comes from |
   | --- | --- |
   | `SUPABASE_URL` | Project URL, `https://xxxx.supabase.co` |
   | `SUPABASE_ANON_KEY` | the **publishable** (or legacy *anon*) key |
   | `SUPABASE_SERVICE_ROLE_KEY` | the **secret** (or legacy *service_role*) key. Keep it secret: only ever in Vercel. |

   Then *Deployments* → latest → *Redeploy*.
5. **Make yourself admin.** Open the site, *Create account* with your email, confirm it from your inbox, then run in the SQL Editor:

   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```

   Sign out and in again: **Admin** appears in the account menu.

### Plans and photos (after updating to the November 2026 version)

- **Run `supabase/schema.sql` again** in the SQL Editor. It is safe to rerun. It adds:
  - `profiles.plan` (default `free`) and the monthly AI counter;
  - the record of accepted terms (`terms_version`, `terms_accepted_at`);
  - the public `site-media` storage bucket for website photos (3 MB each, JPG/PNG/WebP).
- **Set a client's plan** in *Admin* (the Plan menu on each client) or in SQL: `update public.profiles set plan = 'business' where email = 'client@example.com';`. The client sees it the next time they open the app. Admins always have every feature.
- Only **Business** can publish. If a client drops to Free or Pro, their site stops being served (it is kept, and comes back when they return to Business).
- **Booking emails (optional):** set `RESEND_API_KEY` and `LOCALBOOST_MAIL_FROM` (e.g. `LocalBoost <bookings@yourdomain.com>`, a domain verified in Resend). The owner gets an email for each new request, at the email in their business details or their account email.

### Optional

- **Email confirmation** is on by default in Supabase (new users must click a link). To let people in immediately, turn off *Authentication → Sign In / Providers → Email → Confirm email*.
- **Your own sender address.** Supabase's built-in email is limited to a few messages per hour. Before launch, set up custom SMTP (*Authentication → Emails → SMTP Settings*) with Resend, Brevo, Postmark or similar.
- **Email texts** (in Romanian, with your logo): *Authentication → Emails → Templates*.

## Try it without Supabase

```bash
npm run mock:supabase                      # fake Supabase on http://localhost:5299 (data in memory)
# second terminal (PowerShell: $env:SUPABASE_URL="http://localhost:5299"; …)
SUPABASE_URL=http://localhost:5299 SUPABASE_ANON_KEY=mock-public SUPABASE_SERVICE_ROLE_KEY=mock-secret npm start
```

Create an account in the app, then make it admin with `http://localhost:5299/mock/role?email=you@example.com`, or change its plan with `http://localhost:5299/mock/plan?email=you@example.com&plan=business`.

## Limits and next steps

- The admin list loads up to 1,000 accounts at once; add paging before that.
- Email and password only. Google sign-in can be added in Supabase later without changing the data.
- The Android app signs in the same way (set the server address in Settings). Email links open in the browser, not the app; a deep link is a later step.
- There is no audit log of admin edits yet beyond `updated_by` on each business row.
