# LocalBoost v1.0-redesign: gap report

Date: 30 October 2026. Scope: Phase 1 (redesign of all 10 screens) and Phase 2 (real, server-side AI with open questions).
Every change is a separate commit on `main` (`design: …`, `feat(ai): …`).

---

## 1. What works as intended

### Redesign ("Copou Ledger")
- **Navigation by journey stage.** A colour-coded tab rail (Home, Observe, Analyse, Act, Measure) replaces the 10-item auto-hiding sidebar; it sits on the right on desktop and along the bottom on phones. Done stages get a tick. Stages with several screens (Observe, Act) show sub-tabs in the stage colour. Settings and Account live in the account menu.
- **All 10 screens redesigned**, every existing feature kept: Home (map, next-step card), Signals, Competitors, AI Diagnosis, Mission Control, Temporary Website, Action Pack, Proof Board, Settings, Account.
- **Burgundy palette** from the original app, softened (rose, mustard, sage stage colours), with a full **dark theme**; Archivo for headings, Lexend for text.
- **5 languages** (RO, EN, FR, DE, HU) for every new string; `npm run check` verifies the keys match in all five.
- **Mobile**: 44 px touch targets, no sideways overflow at 390 px (checked on every screen), bottom tab bar.
- **Offline (PWA)**: new files are in the service-worker precache; `npm run check` passes.

### Real AI
- **Open questions** ("Ask LocalBoost" panel, top bar and "Ask about this" on the diagnosis): any question in any of the 5 languages, answered by Claude on the server, **streamed word by word**, grounded in the business context (profile, signals, diagnosis, mission, assets, checkpoint, competitors).
- **Runs on the server only.** The API key never reaches the browser (`npm run check` step 6). Same code for `node server.mjs` and Vercel (`api/chat.js`).
- **Model:** `claude-haiku-5-5` by default for chat and the 5 structured roles; switch with `LOCALBOOST_MODEL` / `LOCALBOOST_CHAT_MODEL` (for example `claude-sonnet-5-5`).
- **Error handling, loading states, fallbacks**, all tested in a browser against a streaming mock of the Messages API (`scripts/mock-ai.mjs`):
  - typing indicator, then word-by-word text; **Stop** keeps the partial answer;
  - **Try again** on: upstream error, rate limit (429/529), no first word in 15 s, connection failure, message over 2,000 characters;
  - **no API key** → the panel says AI is not set up and links to the right screen (it never invents an answer);
  - failed questions are not re-sent as history; conversation kept in this browser (last 30 messages); "New chat" clears it.
- **Structured AI steps** (diagnosis, assets, website copy, name ideas) now get 16 s per call / 25 s per step instead of 8 s total, and still fall back to the local analysis with a visible notice.
- **Android-ready server:** CORS allows the Capacitor app (`https://localhost`, `capacitor://localhost`, configurable); Settings has an **AI server address** field for the APK.

---

## 2. Not possible with the current setup, why, and what to change

| # | Blocker | Why | What you need to do |
|---|---|---|---|
| 1 | **Real AI answers are not switched on** | No Anthropic API key is configured anywhere. I tested the full path against a mock that speaks the same streaming format, not against the live API. | Create a key at <https://platform.claude.com> (Settings → API keys) and **set a monthly spend limit**. Locally (PowerShell): `$env:ANTHROPIC_API_KEY="sk-ant-…"; npm start`. On Vercel: Project → Settings → Environment Variables → `ANTHROPIC_API_KEY`. Then ask one question and check the panel shows "AI live". |
| 2 | **No hosted server yet** | The repo is ready for Vercel (`vercel.json`, `api/`), but nothing is deployed, so the web app online and the Android app have no AI. | In Vercel: Add New → Project → import `FrugalKarma/LocalBoost` → add `ANTHROPIC_API_KEY` → Deploy. The Hobby plan is fine for a demo but does not allow commercial use; use Pro ($20/month) for a real product. `api/chat.js` asks for up to 60 s per answer. |
| 3 | **The APK in the repo is the old build** | It predates the redesign and has no server address. Rebuilding needs a JDK and the Android SDK (Android Studio), which are not available to me here. | `npm run android:sync`, then in `android/`: `gradlew assembleDebug`. On the phone: Settings → **AI server address** → your Vercel URL (e.g. `https://localboost.vercel.app`). To bake it in instead, set `window.LOCALBOOST_API_BASE` in `index.html` before building. |
| 4 | **Usage limits are not reliable on Vercel** | Limits (40 questions/hour per visitor, 800/day) are kept in memory per server instance; Vercel runs many short-lived instances, so the real limit is higher. | Add a shared store (Upstash Redis or Vercel KV) and move the counters in `lib/ai-core.mjs › allowed()` there. Until then, rely on the Anthropic spend limit from #1. |
| 5 | **The optional access code cannot be used** | The server supports `LOCALBOOST_ACCESS_CODE`, but the app never sends the `x-access-code` header, so setting it would turn AI off for everyone. | Do not set it yet. Fix: add an access-code field in Settings and send the header from `js/ai.js` and `js/chat.js` (small change). Long term: real user accounts. |
| 6 | **No real business data** | Signals, competitors, reach and the map are demo data about a fictional café. Real reviews, Google Business Profile and social posts need official API access with the owner's consent (OAuth, app review), which a static demo cannot get. The AI answers are only as real as the data it is given. | Per source: a Google Cloud project with the Business Profile API approved; Meta app review for Instagram/Facebook; TikTok developer access. Each needs a server-side connector and stored tokens (a database), plus a privacy policy. CSV import already works for your own data. |
| 7 | **No accounts or sync** | Everything (business, results, chat history) lives in the browser's local storage, so it does not move between devices and is lost if the browser data is cleared. | A backend with sign-in and a database (e.g. Supabase or Firebase) if you need multiple users or devices. |

---

## 3. Technical debt and shortcuts taken

**Redesign**
- `css/ledger.css` is a **layer on top of the original 60 KB `styles.css`**, not a rewrite. Many old rules are overridden or dead (sidebar, bottom nav, old hero, peek animation). Merge the two files and delete dead rules.
- **Dead code left in place:** `placeCard()` in `views/competitors.js`; `fieldMap()` / `scoreRing()` in `charts.js`; unused `aiNotice` imports; the `.side-collapsed`/`.peek` CSS.
- **The map on Home is illustrative** (hand-drawn SVG streets), not real geography; pin positions are fixed.
- **`docs/screenshots/`, the pitch deck and parts of `README.md` show the old design** (the README also mentions a Pitch Mode and `js/pitch.js` that were already missing before this work).
- **Translations for new strings are mine.** They are complete and consistent, but a native-speaker review for RO, HU, DE and FR is recommended.
- **Screenshots during the work came from a Linux browser without Google Fonts** (fallback fonts). `scripts/screenshots.mjs` uses headless Edge, which cannot go narrower than about 500 px, so its "mobile" shots are cropped; use device emulation (e.g. Playwright) instead.
- **Line endings are mixed** (LF/CRLF warnings on commit). Add a `.gitattributes` with `* text=auto eol=lf`.
- `scripts/shot.mjs` (quick review screenshots) and the `?seed=signals` rehearsal state were added for design reviews.

**AI**
- **Not run against the live Anthropic API** (no key; see #1). The model ID `claude-haiku-5-5` comes from Anthropic's model overview page.
- **Prompt and context size** are capped by characters (8,000 for context, 2,000 per question, last 12 turns), not by tokens.
- **The chat panel** is a modal without a full focus trap; Escape closes it and focus returns to the button.
- **Errors from the AI service are logged** to the server console by type only (no payloads, no key). There is no metrics or alerting.
- **Costs** (Haiku 5.5: $0.10 / $0.50 per million input/output tokens): roughly $0.0005 per chat answer, about $0.002 per full analysis; about $0.50–1 per 1,000 answers. Check <https://platform.claude.com/docs/en/about-claude/pricing>.

---

## 4. How to try it

```bash
npm start                                   # http://localhost:5173, AI shows "not set up"
# real AI (PowerShell):
$env:ANTHROPIC_API_KEY="sk-ant-…"; npm start
# no key, but the full AI path with a fake model:
node scripts/mock-ai.mjs                     # terminal 1
$env:ANTHROPIC_API_KEY="test"; $env:ANTHROPIC_BASE_URL="http://localhost:5199"; npm start   # terminal 2
```

Rehearsal links: `/?seed=signals` (business + signals, before analysis), `/?seed=full` (everything done). In the mock, questions containing `SLOW`, `FAIL` or `BUSY` simulate a timeout, a server error and a rate limit.
