# Access control matrix

Who may do what, checked on the server. "Own" = rows whose `owner` / `id` is the caller's user id.

| Action | Visitor (not signed in) | Client: Free | Client: Pro | Client: Business | Admin |
|---|---|---|---|---|---|
| Sign up, sign in, reset password | yes (after launch, rate limited) | – | – | – | – |
| Read / save own business data (`/api/data`) | no | own | own | own | own + any client (Admin area) |
| AI analysis | no | 3 per month | no monthly cap | no monthly cap | unlimited |
| AI requests of any kind, per day (`LIMITS.ai`) | no | 25 | 150 | 300 | unlimited |
| Google lookups, per month (`LIMITS.places`) | no | 20 | 100 | 250 | unlimited |
| Other AI tools (chat, replies, growth pack) | no | no | yes | yes | yes |
| Publish website, booking inbox, visit stats, photo upload | no | no | no | own | own |
| See / change / delete booking requests | no | – | – | own only | own only |
| Send a booking request to a published site | yes (5 per 10 min per IP, 60 per hour per site) | – | – | – | – |
| Ask for a paid plan (`plan-request`) | no | yes (higher plan only) | yes (Business only) | no | – |
| Join the launch waiting list (`waitlist`) | yes (5 per 10 min per IP) | – | – | – | – |
| Record a bank transfer (`paid`), see payments, see / email the waiting list | no | no | no | no | yes |
| Change a plan, role, disable or delete accounts, create accounts | no | no | no | no | yes |
| Change own role or plan | never | never | never | never | – |

Notes
- A client can never set `role`, `plan`, `disabled` or AI counters: no client endpoint writes those columns.
- `plan-request` only records what the client asked to pay for; the plan changes when the admin records the payment (`paid`, sets `plan_until`) or switches it by hand (no end date).
- A paid plan works until `plan_until` plus 7 days of grace, then counts as Free until renewed.
- The waiting list and payments tables have row-level security on and no policies: only the server reads them.
- The owner login (`bf.` token) acts as admin and exists only through `ARCTON_OWNER_*` variables.
