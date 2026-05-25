# embed-banner-nagar

Interactive square (1:1) scratch-reveal album banner for `<iframe>` embeds on
partner media sites. Bottom layer is the album cover; top layer is the "nagar"
that the user wipes away with mouse or finger to reveal the cover. Tap/click
opens the album landing through a stable internal redirector (`/go`) so the
final URL can be swapped on release day without re-issuing embed code.

## Stack

- Vite + vanilla TypeScript (strict)
- Canvas 2D API (no external libs)
- GA4 via `gtag`
- Cloudflare Pages (static) + Pages Functions (`/go` redirector)

## Architecture (layered)

```
src/
  app/                              bootstrap + global CSS
  pages/                            page-level composition
  features/album-banner/
    shared/    types & constants
    api/       config loader
    model/     pure logic (no DOM/Canvas)
    controller/canvas + pointer + analytics + navigation
    ui/        DOM element factories (no events)
  shared/
    config/    typed env
    lib/
      analytics/  load-ga, send-ga-event
      dom/        open-external-url, get-query-param
functions/
  go.ts        Cloudflare Pages Function -> 302 ALBUM_URL
public/
  cover.jpg, nagar.png              swap in real assets
```

Layer rules:

- `app -> pages -> features -> shared`
- inside a feature: `shared -> api -> model -> controller -> ui`
- `model/*` must not touch `window`, `document`, `Canvas`, `fetch`, `gtag`
- `ui/*` does not import `controller/*`
- browser APIs are confined to `controller/*` and `shared/lib/{dom,analytics}`

## Local dev

```sh
npm install
cp .env.example .env
npm run dev          # http://localhost:5173
npm run typecheck
npm run build
npm run preview      # http://localhost:4173
```

In dev with empty `VITE_GA4_ID`, `gtag` is stubbed to `console.debug`.

## Deploy (Cloudflare Pages)

1. Connect repo to Cloudflare Pages, build command `npm run build`, output `dist`.
2. Configure Pages env vars in dashboard:
   - `ALBUM_URL` (used by `functions/go.ts`)
   - `VITE_GA4_ID` (build-time, baked into bundle)
3. To change the redirect target on release day, update `ALBUM_URL` in the
   Cloudflare Pages dashboard — no rebuild, no partner re-embed required.

Verify:

```sh
curl -I https://<domain>/go     # expect: 302 Location: <ALBUM_URL>
```

## Embed snippet (for media partners)

```html
<iframe
  src="https://<domain>/"
  width="600" height="600"
  style="border:0; aspect-ratio:1/1; max-width:100%;"
  loading="lazy"
  referrerpolicy="no-referrer-when-downgrade"
  title="Album banner"></iframe>
```

## GA4 events

| Event | When | Dedup |
|---|---|---|
| `banner_impression` | banner enters viewport (>=50%) | once per session |
| `banner_scratch_start` | first pointer movement during press | once per session |
| `banner_reveal_complete` | >=60% of the nagar erased | once per session |
| `banner_click` | tap (<250ms, <10px) on the banner | every click |

## Assets

`public/cover.jpg` and `public/nagar.png` are 4x4 placeholders. Replace with
real artwork (square, >=600x600, ideally PNG/WebP). Nagar should fully cover
the canvas — transparency only where reveal should already show through.
