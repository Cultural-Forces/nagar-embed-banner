# nagar-promo

Промосторінка альбому «НАГАР» гурту Проспект Соборний. Обкладинка вкрита
шаром нагару, який людина стирає мишкою або пальцем. Нижче кнопки стрімінгових
платформ, опис альбому з цитатою, соцмережі й логотипи партнерів.

Дизайн і план робіт: [docs/superpowers/specs/2026-10-31-nagar-promo-page-design.md](docs/superpowers/specs/2026-10-31-nagar-promo-page-design.md).

## Stack

- Vite + vanilla TypeScript (strict), без фреймворків
- Canvas 2D API + Pointer Events
- GA4 via `gtag`
- Vitest для чистої логіки в `model/*`
- Cloudflare Pages, статика без серверних функцій

## Як влаштовано

Увесь вміст сторінки лежить в `index.html`. JS лише додає стирання поверх
готової розмітки:

- без JS (`html.no-js`) видно обкладинку і всі посилання;
- поки зображення вантажаться, нагар показує звичайний `<img>`;
- коли обидва зображення завантажені, його місце займає canvas (`cover--canvas`);
- якщо canvas не стартував, лишається обкладинка без стирання (`cover--static`).

Що бачить людина:

1. На нагарі напис «Зітри нагар». Через 1,2 с, якщо ніхто не почав стирати,
   нагар сам показує короткий мазок.
2. Обкладинка відкривається, коли стерто 85 % площі або натиснуто «Показати
   обкладинку». Решта шару розсипається плямами за 1,1 с, обкладинка коротко
   «вдихає».
3. Коли відкриту обкладинку гортають вгору, кіптява повертається від країв:
   наповзає на обкладинку (до третини площі) і перетікає з неї на сторінку,
   десь ледь торкаючись краю, десь язиками. Обкладинка й сторінка навколо неї
   — один шар на окремому canvas `cover__halo`, тож на межі немає лінії. Якщо
   горнути назад, кіптява сходить.

З `prefers-reduced-motion: reduce` немає демо-мазка, розсипання й повернення
кіптяви: шар зникає одразу.

Тимчасово: параметр `?hint=text-gesture|text|gesture|cutout` перемикає варіант
підказки, щоб їх порівняти. За замовчуванням `text-gesture`. Коли варіант
оберуть, параметр і зайві варіанти треба прибрати з `pages/promo-page.ts` і
`mount.ts`.

```
src/
  app/                        bootstrap + global CSS
  pages/promo-page.ts         composition + GA4 event names
  features/
    cover-scratch/
      shared/    constants & types
      model/     pure logic: brush alpha, erased ratio, line sampling,
                 demo stroke, soot field, settle level
      controller/canvas, mask, pointer handling, scroll settle, soot halo
      mount.ts   binds the controller to the markup in index.html
    link-tracking/            delegated clicks on [data-platform] / [data-social]
  shared/
    config/    typed env
    lib/analytics/  load-ga, send-ga-event
  assets/      cover.webp, nagar.webp, fonts/ (hashed by Vite)
public/        og.jpg, favicon.svg, apple-touch-icon.png, _headers
```

Layer rules:

- `app -> pages -> features -> shared`
- inside a feature: `shared -> model -> controller -> mount`
- `model/*` must not touch `window`, `document`, `Canvas`, `fetch`, `gtag`
- browser APIs are confined to `controller/*`, `mount.ts` and `shared/lib/analytics`

Усі числа стирання (радіус пензля, поріг, тривалості, розміри полів) лежать у
`features/cover-scratch/shared/constants.ts` з коментарями.

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
| `VITE_SITE_URL` | публічна адреса `https://…` без слеша в кінці, для `og:url` і `og:image` |

Обидві змінні вбудовуються під час збірки, тож після зміни потрібен новий деплой.
Якщо в `VITE_SITE_URL` є шлях (`https://org.github.io/nagar`), Vite бере його як
`base`, і сторінка працює з підпапки.

## Deploy (Cloudflare Pages)

1. Підключити репозиторій, build command `npm run build`, output `dist`.
2. Задати `VITE_GA4_ID` і `VITE_SITE_URL` у налаштуваннях Pages.
3. `public/_headers` кешує `assets/*` назавжди (у назвах файлів є хеш).

## Посилання і тексти

Посилання на платформи, соцмережі, опис і логотипи партнерів правляться прямо в
`index.html`. Місця, які ще чекають на матеріали, позначені коментарями `TODO`:

- посилання на альбом на платформах від BestMusic;
- фінальний текст опису;
- посилання на сторінки гурту;
- логотипи партнерів у SVG.

У день релізу: підставити посилання від BestMusic, закомітити, дочекатися деплою.

## GA4 events

| Event | When | Params | Dedup |
|---|---|---|---|
| `page_view` | page load (sent by gtag) | source, device, city, UTM | — |
| `scratch_start` | first erase stroke | — | once per page load |
| `cover_reveal` | 85% erased or the button | `method`: `scratch` / `button` | once per page load |
| `platform_click` | click on a platform link | `platform` | every click |
| `social_click` | click on a social link | `network` | every click |
| `cover_error` | canvas failed to start | `message` | every time |

## Assets

- `src/assets/cover.webp` і `src/assets/nagar.webp`: обкладинка і шар нагару,
  квадрат, WebP близько 860 px по стороні.
- `src/assets/fonts/`: Unbounded Black, окремо кирилиця й латиниця, обидва
  файли з `preload` в `index.html`.
- `public/og.jpg` (1200×630) і `public/apple-touch-icon.png` зроблені з
  обкладинки. Після заміни обкладинки їх треба перегенерувати.
- `public/favicon.svg` тимчасовий: червона «Н» на чорному.
