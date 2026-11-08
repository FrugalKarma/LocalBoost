# Access control matrix

Who may do what, checked on the server. "Own" = rows whose `owner` / `id` is the caller's user id.

| Action | Visitor (not signed in) | Client: Free | Client: Pro | Client: Business | Admin |
|---|---|---|---|---|---|
| Sign up, sign in, reset password | yes (after launch, rate limited) | – | – | – | – |
| Read / save own business data (`/api/data`) | no | own | own | own | own + any client (Admin area) |
| AI analysis | no | 3 per month | unlimited | unlimited | unlimited |
| Other AI tools (chat, replies, growth pack) | no | no | yes | yes | yes |
| Publish website, booking inbox, visit stats, photo upload | no | no | no | own | own |
| See / change / delete booking requests | no | – | – | own only | own only |
| Send a booking request to a published site | yes (5 per 10 min per IP, 60 per hour per site) | – | – | – | – |
| Ask for a paid plan (`plan-request`) | no | yes (higher plan only) | yes (Business only) | no | – |
| Change a plan, role, disable or delete accounts, create accounts | no | no | no | no | yes |
| Change own role or plan | never | never | never | never | – |

Notes
- A client can never set `role`, `plan`, `disabled` or AI counters: no client endpoint writes those columns.
- `plan-request` only records what the client asked to pay for; the plan changes when the admin switches it after the money arrives.
- The owner login (`bf.` token) acts as admin and exists only through `ARCTON_OWNER_*` variables.
