# nagar-promo

Промосторінка альбому «НАГАР» гурту Проспект Соборний. Обкладинка вкрита
шаром нагару, який людина стирає мишкою або пальцем. Нижче кнопки стрімінгових
платформ, опис, соцмережі й логотипи партнерів.

Дизайн і план робіт: [docs/superpowers/specs/2026-10-31-nagar-promo-page-design.md](docs/superpowers/specs/2026-10-31-nagar-promo-page-design.md).

## Stack

- Vite + vanilla TypeScript (strict), без фреймворків
- Canvas 2D API + Pointer Events
- GA4 via `gtag`
- Cloudflare Pages, статика без серверних функцій

## Як влаштовано

Увесь вміст сторінки лежить в `index.html`. JS лише додає стирання поверх
готової розмітки:

- без JS (`html.no-js`) видно обкладинку і всі посилання;
- поки зображення вантажаться, нагар показує звичайний `<img>`;
- коли обидва зображення завантажені, його місце займає canvas (`cover--canvas`);
- якщо canvas не стартував, лишається обкладинка без стирання (`cover--static`).

```
src/
  app/                        bootstrap + global CSS
  pages/promo-page.ts         composition + GA4 event names
  features/
    cover-scratch/
      shared/    constants & types
      model/     pure logic: brush alpha, erased ratio, line sampling
      controller/canvas, mask, pointer handling
      mount.ts   binds the controller to the markup in index.html
    link-tracking/            delegated clicks on [data-platform] / [data-social]
  shared/
    config/    typed env
    lib/analytics/  load-ga, send-ga-event
  assets/      cover.webp, nagar.webp (hashed by Vite)
public/        og.jpg, favicon.svg, apple-touch-icon.png, _headers
```

Layer rules:

- `app -> pages -> features -> shared`
- inside a feature: `shared -> model -> controller -> mount`
- `model/*` must not touch `window`, `document`, `Canvas`, `fetch`, `gtag`
- browser APIs are confined to `controller/*`, `mount.ts` and `shared/lib/analytics`

## Local dev

```sh
npm install
cp .env.example .env
npm run dev          # http://localhost:5173
npm test
npm run typecheck
npm run build        # fails without VITE_SITE_URL
npm run preview      # http://localhost:4173
```

In dev with empty `VITE_GA4_ID`, `gtag` is stubbed to `console.debug`.

## Env

| Variable | Що це |
|---|---|
| `VITE_GA4_ID` | ID потоку GA4, `G-…` |
| `VITE_SITE_URL` | публічна адреса без слеша в кінці, для `og:url` і `og:image` |

Обидві змінні вбудовуються під час збірки, тож після зміни потрібен новий деплой.

## Deploy (Cloudflare Pages)

1. Підключити репозиторій, build command `npm run build`, output `dist`.
2. Задати `VITE_GA4_ID` і `VITE_SITE_URL` у налаштуваннях Pages.
3. `public/_headers` кешує `assets/*` назавжди (у назвах файлів є хеш).

## Посилання і тексти

Посилання на платформи, соцмережі, опис і логотипи партнерів правляться прямо в
`index.html`. Місця, які ще чекають на матеріали, позначені коментарями `TODO`.
У день релізу: підставити посилання від BestMusic, закомітити, дочекатися деплою.

## GA4 events

| Event | When | Params | Dedup |
|---|---|---|---|
| `page_view` | page load (sent by gtag) | source, device, city, UTM | — |
| `scratch_start` | first erase stroke | — | once per page load |
| `cover_reveal` | 60% erased or the button | `method`: `scratch` / `button` | once per page load |
| `platform_click` | click on a platform link | `platform` | every click |
| `social_click` | click on a social link | `network` | every click |
| `cover_error` | canvas failed to start | `message` | every time |

## Assets

`src/assets/cover.webp` і `src/assets/nagar.webp` зараз заглушки з прототипу.
Справжні: квадрат, експорт у WebP близько 860 px по стороні. `public/og.jpg`
(1200×630) і `public/apple-touch-icon.png` згенеровані із заглушки обкладинки,
`public/favicon.svg` тимчасовий.
