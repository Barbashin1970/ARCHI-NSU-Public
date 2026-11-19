#!/bin/sh
# Перенос оформления из изделия в визитку.
#
# Что делает: копирует файл стилей, значок и картинки из ~/ARCHI-NSU/web.
# Кто зовёт:  человек после правки оформления в изделии.
#
# `index.html` НЕ ТРОГАЕТСЯ НАМЕРЕННО. У визитки своя шапка (без переходов
# в рабочие разделы), свои разделы «как выглядит», «состав поставки»
# и «заявка», которых в изделии нет вовсе. Слепой перенос затёр бы их молча,
# и обнаружилось бы это на живом сайте.
set -e

IZDELIE="$HOME/ARCHI-NSU/web"
cd "$(dirname "$0")"

[ -d "$IZDELIE" ] || { echo "  Изделия нет: $IZDELIE"; exit 1; }

cp "$IZDELIE/style.css"   style.css
cp "$IZDELIE/favicon.svg" favicon.svg
# Значок переименовывается при переносе. В изделии он `arhi.ico`, здесь —
# `favicon.ico`: по этому имени его просят браузеры и мессенджеры сами,
# не читая разметку, и под именем `arhi.ico` он лежал впустую.
cp "$IZDELIE/arhi.ico"    favicon.ico

# Картинки витрины: ужимаются так же, как при первой сборке.
sips -s format jpeg -s formatOptions 82 -Z 1600 "$IZDELIE/img/geroy-2.png" --out img/geroy-2.jpg >/dev/null
sips -s format jpeg -s formatOptions 82 -Z 1600 "$IZDELIE/img/archi.png"   --out img/archi.jpg   >/dev/null
cp "$IZDELIE/img/geroy.jpg" img/geroy.jpg
cp "$IZDELIE/img/planr.png" img/planr.png

echo "  Перенесено: style.css, значки, картинки витрины."
echo "  index.html не тронут — текст переносится руками."
echo
echo "  Дальше: git add -A && git commit && git push — Vercel и GitHub Pages соберут сами."
