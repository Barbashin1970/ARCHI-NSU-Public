# Разбор: дубль витрины на GitHub Pages

Дата: 2026-11-19. Разбор написан до правок кода. Образцы — PROMPT-Professor
(`tools/dlya-pages.py`, `.github/workflows/pages.yml`), NSK_OpenData_Bot
(`docs/PAGES-DEMO-RAZBOR.md`) и навык vault `knowledge/skills/publish-github-pages.md`.

## Сводка

1. **Зачем.** `archi-nsu.vercel.app` из российских сетей без VPN не открывается
   (сообщение владельца 19.11.2026), а `*.github.io` открывается: демо NSK на github.io
   заказчик открывал из мэрии сам (`~/NSK_OpenData_Bot/docs/PAGES-DEMO-RAZBOR.md`,
   «Закрыто»). Нужен дубль витрины на `https://barbashin1970.github.io/ARCHI-NSU-Public/`.
   Vercel остаётся основным, правки идут туда же, куда шли.
2. **Где.** В этом же репозитории, как в NSK и PROMPT-Professor. Pages на бесплатном
   тарифе публикует только из публичного репозитория; владелец открыл его 19.11.2026:
   «тут ничего закрытого нет», «всё уже публично». Первый вариант разбора — отдельный
   публичный репозиторий только с файлами сайта — снят тем же днём.
3. **Пути.** Страницы ссылаются от корня (`/style.css`, `/img/…`, `/`), а Pages раздаёт
   сайт в подпапке `/ARCHI-NSU-Public/`. Копию с приставкой собирает `tools/dlya_pages.py`;
   `index.html` для Vercel не меняется.
4. **Что уезжает на Pages** — только список `PUBLIKUETSYA`: страницы, стили, скрипт,
   значки, `img/`. README, стратегия, `ishodniki-kartinok/` видны на github.com, но по
   адресу сайта не отдаются — так же, как на Vercel (`.vercelignore`).
5. **Адрес.** `canonical`, `og:url`, `og:image`, `sitemap.xml` и `robots.txt` в копии
   указывают на github.io. Карточка ссылки в мессенджере берёт картинку по `og:image`,
   и с vercel.app она из России не загрузится.
6. **Обновление — само.** Push в `main` → Vercel, как раньше, и workflow Pages рядом.

## Опись перед открытием (урок vault `private-repo-made-public-leaks-history`)

| Что | Команда | Результат 19.11.2026 |
|---|---|---|
| Ключи и токены во всей истории | `git log -p --all`, поиск по шаблонам `re_…`, `sk-…`, `ghp_…`, `github_pat_…`, токен Telegram, `AKIA…`, `PRIVATE KEY`, `API_KEY=`/`TOKEN=`/`SECRET=`/`PASSWORD=` | совпадений 0 из 36 коммитов |
| Пути, которых нет в дереве, но есть в истории | `git log --all --name-only` против `git ls-files` | `api/zayavka.js`, `politika.html`, `proverka-vremennaya.html`, `arhi.ico`, `img/2026-09-13_13-57-40.png` |
| `.env` и серверные функции в истории | `git log --all -- 'api/*' '.env*'` | `.env` не было никогда; `api/zayavka.js` — в трёх коммитах, снят в `c91db1b` |
| Видимость и форки | `api.github.com/repos/Barbashin1970/ARCHI-NSU-Public` | `public`, Pages выключены, форков 0 |

Открыты вместе с репозиторием и известны владельцу: `АРХИ-Айбим-стратегия-2026-09-13.md`,
`ishodniki-kartinok/` и README прежней редакции — в истории (порядок публикации, абзац о правах
на данные МЕТА и Айбим). В дереве README с 19.11.2026 короткий: цель репозитория и адреса —
просьба владельца.

## Схема

```
push в main
  ├─▶ Vercel: archi-nsu.vercel.app — корень как есть, минус .vercelignore    (как было)
  └─▶ .github/workflows/pages.yml
        ├─ configure-pages@v6 — Pages не включены → остановка; иначе base_path и base_url
        ├─ tools/dlya_pages.py --osnova <base_path> --adres <base_url> --vyhod _pages
        │    ├─ копия по списку PUBLIKUETSYA
        │    ├─ /x → /ARCHI-NSU-Public/x в атрибутах и url(); vercel.app → github.io
        │    └─ самопроверка → остановка: адрес без основы, ссылка на файл или якорь,
        │       которых нет в копии, след vercel.app, файл не того вида (.md, .sh, .py, …)
        ├─ upload-pages-artifact@v5 (path: _pages)
        └─ deploy-pages@v5 → https://barbashin1970.github.io/ARCHI-NSU-Public/
```

## Решения

| # | Решение | Почему |
|---|---|---|
| Р-1 | Pages — из этого же репозитория, источник GitHub Actions | Решение владельца 19.11.2026; так устроены NSK и PROMPT-Professor. Deploy from a branch из корня прогнал бы через Jekyll весь репозиторий и отдавал бы README по адресу сайта |
| Р-2 | Копия по списку разрешённого (`PUBLIKUETSYA`), а не «всё, кроме» | Ошибка в списке исключений публикует внутренний файл по адресу сайта (урок vault `vercelignore-negation-leaks-readme`); ошибка в списке разрешённого — пропавшая картинка, и её ловит самопроверка |
| Р-3 | Основу приписывает копия, исходник не меняется | Vercel публикует корень как есть; так же в PROMPT-Professor |
| Р-4 | Основа и адрес берутся из `configure-pages` (`base_path`, `base_url`), а не вписаны | Адрес различает регистр имени репозитория; при переименовании или своём домене копия поправится сама, без правки кода |
| Р-5 | `canonical`, `og:*`, карта сайта в копии — на github.io | Дубль нужен, чтобы открываться из России: канонический адрес на vercel.app отправил бы поиск по закрытому адресу, `og:image` оттуда не загрузился бы в карточке ссылки |
| Р-6 | Workflow запускается на любой push в `main`, кроме правок только `*.md`, `docs/`, `ishodniki-kartinok/` (`paths-ignore`) | Список «что считается сайтом» живёт в одном месте — `PUBLIKUETSYA`; список путей запуска рядом с ним разошёлся бы с ним при первом новом файле |
| Р-7 | Заголовки `vercel.json` на Pages не повторяются | Pages своих заголовков не принимает. Замер `curl -sI https://barbashin1970.github.io/PROMPT-Professor/` 19.11.2026: `content-type`, `cache-control: max-age=600`, `strict-transport-security`, `access-control-allow-origin: *`; `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` нет. Витрина без форм и входа: показ в чужой рамке ей не опасен, `Referrer-Policy` браузеры и так ставят `strict-origin-when-cross-origin` |
| Р-8 | `.github/`, `tools/`, `docs/`, `_pages/` — в `.vercelignore` | Всё, что уехало на Vercel, отдаётся по своему адресу; сборщик и разбор на сайте не нужны |

## Разрывы

| # | Разрыв | Важность | Закрывает |
|---|---|---|---|
| 1 | Витрина не открывается из России без VPN | несущий | весь разбор |
| 2 | Адреса от корня: на Pages это `barbashin1970.github.io/`, а не `/ARCHI-NSU-Public/` | несущий | Р-3, самопроверка |
| 3 | README и стратегия отдавались бы по адресу сайта, если публиковать корень | важный | Р-1, Р-2 |
| 4 | Страница «адреса нет» отдаётся на любой глубине: относительные пути в ней сломались бы на `/ARCHI-NSU-Public/a/b` | важный | основа приписывается и в `404.html` |
| 5 | Карточка ссылки и поиск ведут на vercel.app | важный | Р-5 |
| 6 | Заголовки безопасности `vercel.json` на Pages не ставятся | низкий, принят | Р-7 |

## Чего не делаем сейчас

| Не делаем | Почему |
|---|---|
| Чистку истории | Секретов в ней нет (опись); снятое в ней — уже снятые с сайта страницы и функция без ключей |
| Заголовки безопасности через `<meta>` | `X-Frame-Options` в `<meta>` браузеры не читают, `frame-ancestors` в `<meta>` CSP не действует |
| Свой домен | Нужны домен и DNS; github.io уже открывается |
| Замер доступности из российской сети без VPN | Отсюда не сделать; проверяет владелец с телефона без VPN — «Инструкция», шаг 4 |

## Инструкция: что сделать на GitHub (один раз)

1. `https://github.com/Barbashin1970/ARCHI-NSU-Public/settings/pages` →
   **Build and deployment → Source: GitHub Actions**. Без этого запуск остановится на
   `configure-pages` («Get Pages site failed») — первым шагом, до сборки.
2. Push в `main` — запуск начнётся сам. Или **Actions → «Дубль витрины на GitHub Pages» →
   Run workflow**.
3. Упал с «Branch "main" is not allowed to deploy to github-pages» —
   **Settings → Environments → github-pages → Deployment branches** → добавить `main`.
4. Открыть с телефона без VPN `https://barbashin1970.github.io/ARCHI-NSU-Public/` —
   **регистр как в имени репозитория**. Первые 1–2 минуты возможен 404; Pages кэширует
   до 10 минут.

## Закрыто

Проверено локально 19.11.2026. Сценарии проверки лежат вне репозитория, в рабочей папке
сессии; их шаги перечислены ниже.

- **Р-2, Р-3, разрывы 2–4 — сборка.** `python3 tools/dlya_pages.py --osnova /ARCHI-NSU-Public
  --adres https://barbashin1970.github.io/ARCHI-NSU-Public --vyhod <папка>/ARCHI-NSU-Public` →
  «файлов 27, адресов от корня 30 (все с основой и ведут к файлам копии), адрес Vercel заменён
  5 раз». `diff` против исходника: `index.html` — 26 строк, `404.html` — 7, `robots.txt`
  и `sitemap.xml` — по 1; `style.css`, `public.css`, `public.js`, `favicon.svg` — 0.
- **Самопроверка не лжёт.** Подложено четыре поломки, каждая остановлена: исходник без замен —
  35 нарушений (30 адресов без основы, 3 следа vercel.app, нет `canonical` и `og:url`
  на github.io); `README.md` в копии — 1; нет `img/chat-svodka.jpg` — 1; якорь `#zayavka-net`
  в `404.html` — 1. Готовая копия — 0.
- **Браузер.** Копия раздана сервером, повторяющим Pages: сайт в `/ARCHI-NSU-Public/`,
  отсутствующий адрес — своя `404.html` со статусом 404. Chrome без окна, 1280×900:
  все запросы страницы — под `/ARCHI-NSU-Public/`, все 200; снимок копии побайтно совпал
  со снимком исходника, разданного из корня, как на Vercel. `/ARCHI-NSU-Public/net/takoy/stranicy` —
  404 со стилями, снимок побайтно как у исходной `404.html`; адрес без косой — 301 на адрес
  с косой; `/ARCHI-NSU-Public/README.md` и `/ARCHI-NSU-Public/tools/dlya_pages.py` — 404.
- **Живой сайт** (коммит `a8e8b90`; запуск workflow
  [44465530518](https://github.com/Barbashin1970/ARCHI-NSU-Public/actions/runs/44465530518) —
  успех; выкатки `github-pages` 05:29:38Z и Vercel Production 05:29:40Z, UTC):
  10 живых адресов — 200 (главная, стили, скрипт, значки, картинки, в том числе `og:image`,
  `robots.txt`, `sitemap.xml`); 9 лишних — 404 (README, сборщик, разбор, стратегия, исходник
  снимка, `vercel.json`, workflow, `obnovit-iz-izdeliya.sh`, несуществующий путь — со своей
  страницей «Такого адреса здесь нет» и стилями по основе). Без косой — 301 на адрес с косой;
  строчными `/archi-nsu-public/` — 404; `content-type: text/html; charset=utf-8`,
  `cache-control: max-age=600`. Живая главная побайтно равна локальной копии, снимок живого
  дубля в Chrome побайтно равен снимку исходника.
- **Vercel после нового `.vercelignore`** — проверен после выкатки `a8e8b90` (статус коммита
  «Deployment has completed»): главная, стили, картинка — 200; `/README.md`,
  `/tools/dlya_pages.py`, `/docs/PAGES-DUBL-RAZBOR.md`, `/.github/workflows/pages.yml`,
  несуществующий адрес — 404; `x-vizitka: arhi` на месте.
- **Остаётся за владельцем:** открыть дубль с телефона без VPN (инструкция, шаг 4) — из этой
  сети замер не сделать.
