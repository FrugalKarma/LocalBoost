# Custom Premium sites

Hand-made sites for Custom Premium clients. One folder per client, one self-contained `index.html` each
(styles and scripts inline; pictures inline or as https links; at most 3 MB).

How a site goes live:

1. Build or change `custom-sites/<client>/index.html` here (Claude does this and pushes it).
2. In the app: Admin → the client → **Site personalizat** → choose the file → **Încarcă și publică**.
3. It replaces the template site at `arcton.site/s/<slug>`. **Scoate site-ul personalizat** brings the template back.

The page runs in a sandbox (no access to the app or any account). The server adds `window.ARCTON = { api, slug }`
before `</body>`, so a booking form can send:

```js
fetch(ARCTON.api, { method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ op: 'request', slug: ARCTON.slug, name, contact, date, time, party, message, consent: true }) });
// free times for a day: GET `${ARCTON.api}?op=slots&slug=${ARCTON.slug}&date=YYYY-MM-DD` → { used: { "19:00": 6 }, cap, per }
```
