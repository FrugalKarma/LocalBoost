# Tooluri AI și contribuția AI

## A. AI în produs (la rulare)

| Componentă | Ce face | Când rulează cu adevărat |
| --- | --- | --- |
| **Signal Analyst** (`prompts.js`) | extrage max. 3 probleme recurente din semnale; separă fapte de inferențe; confidence 0–100 | cu `ANTHROPIC_API_KEY` configurat pe server |
| **Opportunity Strategist** | alege o oportunitate, ipoteză testabilă, baseline și țintă | idem |
| **Action Creator** | ofertă, postare, 3 titluri, concept de sticker (toate cu CTA) | idem |
| **Website Builder** | headline ≤ 12 cuvinte, subheadline, CTA, ofertă, FAQ | idem |
| **Fallback local determinist** | aceleași scheme, conținut scris în `js/locales/*.js` | oricând AI nu răspunde în 8 s, lipsește cheia, JSON-ul nu se poate repara sau ești offline |

- Model implicit: `claude-sonnet-5-5` (se schimbă cu `LOCALBOOST_MODEL`).
- Toate răspunsurile trebuie să fie JSON; `repairJSON()` elimină gardurile de cod, virgulele finale și ghilimelele curbe, apoi fiecare rol trece printr-un validator cu limite de lungime. Ce nu trece validarea → fallback local.
- Prompturile sunt vizibile în aplicație: **Settings → View AI/tool transparency** (inclusiv ultimele apeluri, rol, rezultat și durată).
- Fiecare recomandare afișează sursele, timestamp-ul, confidence-ul, ce este **fapt**, ce este **inferență** și ce **trebuie confirmat de proprietar**. Etichete: `AI model (server side)` vs `Deterministic local analysis`; `DEMO DATA` pe toate datele simulate.
- AI-ul **nu publică și nu trimite nimic**. Postarea se marchează „gata” și se copiază; publicarea este manuală, după confirmare.

## B. Ce NU face AI-ul în demo

- Nu are acces la conturi reale (Google Business Profile, rețele sociale etc.): conectorii sunt doar pregătiți (ecran de setup, permisiuni, status, retry). Singurul conector funcțional este **importul CSV local** (date marcate USER DATA, separate de DEMO DATA).
- Recenziile din demo sunt **text simulat** scris pentru acest proiect; nu sunt recenzii reale.
- Țintele (+15% reach, ≥ 5 cereri) sunt obiective de experiment, nu predicții; rezultatele apar doar dacă le introduci tu la checkpoint (marcate „demo values entered” / „entered by owner”).

## C. Contribuția AI la construirea proiectului

Aplicația a fost construită în întregime într-o sesiune **Claude Code (Claude Sonnet 5.5)** pornind de la brief-ul „Prompt master LocalBoost”:

- arhitectură, design system, UX și copy în 4 limbi;
- cod JS fără dependențe (router, store, i18n, generator de website sanitizat, ZIP writer, PWA, Pitch Mode);
- scripturi de verificare, build, iconuri PNG generate din cod, capturi automate;
- testare în browser: flux complet, 4 limbi × 10 ecrane (chei lipsă și overflow), timeout AI simulat, offline (server oprit), XSS în website builder, import CSV, export ZIP (CRC verificat), mobil/landscape.

Omul decide: businessul demo, tonul ofertelor, ce se publică, valorile reale la checkpoint.

## D. Alte tooluri

| Tool | Rol |
| --- | --- |
| Node.js (fără pachete npm) | server, build, verificări |
| Microsoft Edge / Chrome headless | capturi pentru submission |
| Google Fonts: Fraunces, Manrope, IBM Plex Mono | tipografie (3 familii; fallback Georgia / system-ui) |
| Web APIs: Service Worker, Cache API, Web App Manifest, `postMessage`, `sandbox` iframe, Canvas | PWA, preview izolat, export PNG |
