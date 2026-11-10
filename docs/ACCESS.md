# Access control matrix

Who may do what, checked on the server. "Own" = rows whose `owner` / `id` is the caller's user id.

| Action | Visitor (not signed in) | Client: no plan | Client: Growth (`pro`) | Client: Custom Premium (`business`) | Admin |
|---|---|---|---|---|---|
| Sign up, sign in, reset password | yes (after launch, rate limited) | – | – | – | – |
| Read / save own business data (`/api/data`) | no | own | own | own | own + any client (Admin area) |
| AI analysis | no | no | no monthly cap | no monthly cap | unlimited |
| AI requests of any kind, per day (`LIMITS.ai`) | no | 0 | 150 | 300 | unlimited |
| Google lookups, per month (`LIMITS.places`) | no | 0 | 100 | 250 | unlimited |
| Other AI tools (chat, replies, growth pack) | no | no | yes | yes | yes |
| Publish website, booking inbox, visit stats, no branding, download | no | no | own | own | own |
| Photo upload (used by the preview too) | no | own | own | own | own |
| See / change / delete booking requests | no | – | – | own only | own only |
| Send a booking request to a published site | yes (5 per 10 min per IP, 60 per hour per site) | – | – | – | – |
| Ask for a paid plan (`plan-request`) | no | yes (higher plan only) | yes (Business only) | no | – |
| Ask the owner for a free trial (`trial-request`, 3 per hour, note ≤ 500 chars) | no | yes | no | no | – |
| Start a free trial (`trial`: Pro or Business, 7/14/30 days) | no | no | no | no | yes |
| Join the launch waiting list (`waitlist`) | yes (5 per 10 min per IP) | – | – | – | – |
| Record a bank transfer (`paid`), see payments, see / email the waiting list | no | no | no | no | yes |
| Change a plan, role, disable or delete accounts, create accounts | no | no | no | no | yes |
| Change own role or plan | never | never | never | never | – |

Notes
- Plan ids in the database stay `pro` and `business`; the app shows them as Growth (€49.99/month) and Custom Premium (priced per client: premium site, own domain, managing, WhatsApp support done by the team).
- A client can never set `role`, `plan`, `disabled` or AI counters: no client endpoint writes those columns.
- `plan-request` only records what the client asked to pay for; the plan changes when the admin records the payment (`paid`, sets `plan_until`) or switches it by hand (no end date).
- A paid plan works until `plan_until` plus 7 days of grace, then counts as no plan until renewed. A free trial is a plan with `plan_until` set, so it ends the same way.
- Accounts without a plan (`plan = 'free'` in the database) can open every page, but the server answers `plan_required` to Google and AI calls and to publishing.
- The waiting list and payments tables have row-level security on and no policies: only the server reads them.
- The owner login (`bf.` token) acts as admin and exists only through `ARCTON_OWNER_*` variables.
