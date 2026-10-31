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
- статика без серверних функцій: тестова збірка на GitHub Pages, для релізу
  є конфіг Cloudflare Pages (`wrangler.toml`)

## Як влаштовано

Увесь вміст сторінки лежить в `index.html`. JS лише додає стирання поверх
готової розмітки:

- без JS (`html.no-js`) видно обкладинку і всі посилання;
- поки зображення вантажаться (`cover--loading`), видно розмиту й притемнену
  копію обкладинки з CSS і лоадер. Справжню обкладинку сховано, щоб на
  поганому інтернеті вона не просвічувала. Цей клас ставить inline-скрипт в
  `index.html`, тож лоадер не чекає на JS-модуль;
- коли обидва зображення завантажені (`cover--ready`), на canvas плямами
  збирається нагар. Шар обкладинки під ним вмикається, лише коли нагар
  суцільний (`cover--canvas`), і тоді ж можна стирати;
- картинку, що не завантажилась, JS запитує ще раз через 1 с. Якщо й друга
  спроба не вдалась, без нагару лишаються розмита заглушка й кнопка
  (`cover--nagar-failed`), а без обкладинки лишається нагар без кнопки
  (`cover--image-failed`);
- якщо canvas не стартував, лишається обкладинка без стирання (`cover--static`).

Що бачить людина:

1. Обкладинка, заголовок і кнопки платформ з'являються один за одним з легким
   підйомом, за 0,7 с.
2. Поки вантажаться зображення, на місці обкладинки тьмяне червоне світіння,
   як жар під нагаром. Якщо це триває довше за 400 мс, з'являється
   кільце-лоадер, після 3 с під ним напис «Завантажуємо обкладинку…». На
   швидкому інтернеті лоадера не видно.
3. Коли все завантажилось, нагар збирається на жарі плямами за 1,1 с, це
   розсипання з пункту 4, програне навпаки. Разом з ним за краї на сторінку
   виходить трохи кіптяви, тож квадрат не обривається рівною лінією. Потім
   з'являються напис «Зітри нагар» і кнопка «Відкрити обкладинку».
   Через 1,2 с, якщо ніхто не почав стирати, нагар сам показує короткий мазок.
4. Обкладинка відкривається, коли стерто 85 % площі або натиснуто кнопку.
   Решта шару разом з кіптявою за краями розсипається плямами за 1,1 с,
   обкладинка коротко «вдихає».
5. Коли відкриту обкладинку гортають вгору, кіптява повертається від країв:
   наповзає на обкладинку (до третини площі) і перетікає з неї на сторінку,
   десь ледь торкаючись краю, десь язиками. Обкладинка й сторінка навколо неї
   — один шар на окремому canvas `cover__halo`, тож на межі немає лінії. Якщо
   горнути назад, кіптява сходить.
6. На десктопі з мишкою під відкритою обкладинкою після розсипання
   з'являється червоне світіння. Під курсором вона трохи збільшується (×1,05) і
   нахиляється за ним до 6°, як картка в руці, з відблиском під курсором,
   а червона тінь під нею, що у спокої лежить знизу справа, зсувається за
   курсором; коли курсор іде, все повертається на місце з легким
   пружинням. Ореол кіптяви
   нахиляється разом з нею, а світіння гасне, коли кіптява повертається.

Під заголовком «Про альбом» лежить обкладинка як конверт платівки: із зерном
паперу, стертим колом від диска й світлою кромкою. Коли секцію гортають
вгору, з конверта праворуч виїжджає платівка і, викочуючись, повертає
наклейку рівно; на зворотному скролі вона заїжджає назад. Платівка
намальована в CSS. Поки обкладинку в першому екрані не відкрито, конверт
укритий нагаром, щоб не показати її раніше. Унизу на ньому та сама кнопка
«Відкрити обкладинку»: вона відкриває обкладинку і в першому екрані, тож
нагору повертатися не треба.
Де браузер уміє прив'язати анімацію до скролу (`animation-timeline: view()`,
Chrome і Safari/iOS 26), платівку рухає сам браузер, разом зі скролом; JS лише
рахує, де виїзд закінчується. В інших браузерах JS ставить положення на кожен
кадр скролу.

З `prefers-reduced-motion: reduce` немає появи першого екрана, збирання
нагару, демо-мазка, розсипання й повернення кіптяви, збільшення й нахилу
обкладинки, виїзду платівки: шар зникає одразу, світіння лишається, платівка
вже лежить виїханою.
Лоадер крутиться й тоді.

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
                 demo stroke, soot field, settle level, card tilt
      controller/canvas, mask, pointer handling, scroll settle, soot halo,
                 card tilt
      mount.ts   binds the controller to the markup in index.html
    record-sleeve/            record sliding out of the sleeve on scroll
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

## Deploy

### GitHub Pages (тестова збірка)

Живе на https://cultural-forces.github.io/nagar-embed-banner/. GitHub Pages
роздає гілку `gh-pages` як є, автоматичної збірки немає: `dist` з `main`
треба зібрати й закомітити туди вручну.

```sh
git switch main && git pull
# VITE_GA4_ID порожній, поки немає справжнього ID; інакше підставиться той, що в .env
VITE_GA4_ID= VITE_SITE_URL=https://cultural-forces.github.io/nagar-embed-banner npm run build
git worktree add --detach ../gh-pages-deploy origin/gh-pages
cd ../gh-pages-deploy
git rm -rq . && cp -R ../nagar-embed-banner/dist/. . && touch .nojekyll
git add -A && git commit -m "deploy build of $(git -C ../nagar-embed-banner rev-parse --short HEAD)"
git push origin HEAD:gh-pages
cd - && git worktree remove ../gh-pages-deploy
```

`.nojekyll` вимикає Jekyll, інакше GitHub пропустить файли, які той вважає
службовими. `public/_headers` GitHub Pages ігнорує і ставить свої заголовки
кешування.

### Cloudflare Pages (реліз)

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

У день релізу: підставити посилання від BestMusic, закомітити й задеплоїти (на
Cloudflare Pages збірка запускається сама, на GitHub Pages вручну, див. Deploy).

## GA4 events

| Event | When | Params | Dedup |
|---|---|---|---|
| `page_view` | page load (sent by gtag) | source, device, city, UTM | — |
| `scratch_start` | first erase stroke | — | once per page load |
| `cover_reveal` | 85% erased, the button on the cover or the one on the sleeve | `method`: `scratch` / `button` / `sleeve` | once per page load |
| `platform_click` | click on a platform link | `platform` | every click |
| `social_click` | click on a social link | `network` | every click |
| `cover_error` | an image failed to load after a retry, or canvas failed to start | `message` | every time |

## Assets

- `src/assets/cover.webp` і `src/assets/nagar.webp`: обкладинка і шар нагару,
  квадрат 1080×1080, WebP.
- Розмита копія обкладинки для заглушки вбудована в `app.css`
  (`.cover__stage::before`) як data URI на 198 байт. Після заміни
  `cover.webp` її треба перегенерувати, команда в коментарі поруч.
- `src/assets/fonts/`: Unbounded Black, окремо кирилиця й латиниця, обидва
  файли з `preload` в `index.html`.
- `public/og.jpg` (1200×630) і `public/apple-touch-icon.png` зроблені з
  обкладинки. Після заміни обкладинки їх треба перегенерувати.
- `public/favicon.svg` тимчасовий: червона «Н» на чорному.
