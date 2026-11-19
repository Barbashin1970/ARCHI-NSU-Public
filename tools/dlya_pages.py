#!/usr/bin/env python3
"""Дубль витрины для GitHub Pages: копия сайта с адресами под подпапку репозитория.

Витрина ссылается от корня (/style.css, /img/…, /), а Pages раздаёт её в подпапке —
https://barbashin1970.github.io/ARCHI-NSU-Public/. Копия приписывает основу к каждому адресу
от корня, в атрибутах страниц и в url() стилей, и ставит адрес дубля вместо адреса Vercel
в canonical, og:*, sitemap.xml и robots.txt. Исходные файлы не меняются: их как есть
публикует Vercel.

    python3 tools/dlya_pages.py --osnova /ARCHI-NSU-Public \\
        --adres https://barbashin1970.github.io/ARCHI-NSU-Public --vyhod _pages

Копируется только перечисленное в PUBLIKUETSYA: README, стратегия и исходники снимков лежат
в том же корне и на сайт не уезжают. В конце — самопроверка; нарушение — остановка,
и workflow копию не публикует.

Зовёт .github/workflows/pages.yml; локально — для проверки (_pages/ в .gitignore).
Разбор: docs/PAGES-DUBL-RAZBOR.md.
"""

import argparse
import re
import shutil
import sys
from pathlib import Path
from urllib.parse import unquote

KOREN = Path(__file__).resolve().parent.parent

# То, что отдаётся людям, — то же, что Vercel публикует из корня. Список разрешённого,
# а не «всё, кроме»: забытая здесь картинка остановит самопроверку, а забытое в списке
# исключений молча уехало бы на сайт.
PUBLIKUETSYA = (
    "index.html", "404.html", "style.css", "public.css", "public.js",
    "favicon.svg", "favicon.ico", "robots.txt", "sitemap.xml", "img",
)
# Виды файлов, которым место на сайте. Любой другой в копии — остановка.
VIDY = {".html", ".css", ".js", ".svg", ".ico", ".jpg", ".jpeg", ".png", ".webp", ".txt", ".xml"}
TEKSTOVYE = {".html", ".css", ".js", ".svg", ".txt", ".xml"}

ADRES_VERCEL = "https://archi-nsu.vercel.app"

# --- замена: разбор атрибутов ------------------------------------------------------------
ATRIBUT = re.compile(r"""(\s)([A-Za-z][\w:.-]*)(\s*=\s*)(["'])(.*?)\4""", re.S)
# атрибуты, значение которых — адрес; прочие не меняются, но проверяются все
ADRESNYE = {"href", "src", "srcset", "action", "formaction", "poster", "data",
            "data-src", "data-srcset", "xlink:href"}
URL_V_STILE = re.compile(r"""url\(\s*(["']?)([^"')\s]*)\1\s*\)""")

# --- самопроверка: плоский поиск, мимо разбора атрибутов ----------------------------------
# Ошибка разбора не должна прятать адрес и от замены, и от проверки разом, поэтому
# проверка ищет по-своему: любое ="/…" или ='/…' в тексте файла.
ZNACHENIE_OT_KORNYA = re.compile(r"""=\s*(["'])(/(?!/)[^"']*)\1""")
SRCSET = re.compile(r"""srcset\s*=\s*(["'])(.*?)\1""", re.S | re.I)
URL_OT_KORNYA = re.compile(r"""url\(\s*["']?(/(?!/)[^"')\s]*)""")
# строка в скрипте, похожая на адрес от корня: '/img/x.jpg'; одиночная '/' сюда не попадает
ADRES_V_STROKE = re.compile(r"""(["'])(/[A-Za-z0-9_][^"'\s]*)\1""")
SSYLKA_S_YAKOREM = re.compile(r"""\shref\s*=\s*["']([^"']*#[^"']+)["']""")
ID = re.compile(r"""\sid\s*=\s*["']([^"']+)["']""")


def s_osnovoj(adres, osnova):
    """'/x' → '/Repo/x'. Внешние, относительные, '//host', якоря и уже с основой — как есть."""
    if not osnova or not adres.startswith("/") or adres.startswith("//"):
        return adres
    if adres == osnova or adres.startswith(osnova + "/"):
        return adres
    return osnova + adres


def v_css(tekst, osnova):
    def zamena(m):
        novyy = s_osnovoj(m.group(2), osnova)
        return m.group(0) if novyy == m.group(2) else m.group(0).replace(m.group(2), novyy, 1)
    return URL_V_STILE.sub(zamena, tekst)


def v_html(tekst, osnova):
    def atribut(m):
        probel, imya, ravno, kavychka, znachenie = m.groups()
        if imya.lower() in ADRESNYE:
            if imya.lower().endswith("srcset"):
                znachenie = ", ".join(
                    " ".join([s_osnovoj(slova[0], osnova)] + slova[1:])
                    for slova in (kusok.split() for kusok in znachenie.split(",")) if slova)
            else:
                znachenie = s_osnovoj(znachenie, osnova)
        return probel + imya + ravno + kavychka + znachenie + kavychka
    return v_css(ATRIBUT.sub(atribut, tekst), osnova)


def sobrat(istochnik, vyhod, osnova, adres):
    """Копия по списку PUBLIKUETSYA с основой и адресом дубля. Возвращает число замен адреса."""
    if vyhod.exists():
        shutil.rmtree(vyhod)
    vyhod.mkdir(parents=True)
    for imya in PUBLIKUETSYA:
        otkuda = istochnik / imya
        if otkuda.is_dir():
            shutil.copytree(otkuda, vyhod / imya, ignore=shutil.ignore_patterns(".*"))
        elif otkuda.is_file():
            shutil.copy2(otkuda, vyhod / imya)
        else:
            sys.exit(f"СТОП: {imya} есть в PUBLIKUETSYA, а в корне его нет")
    zamen_adresa = 0
    for fajl in sorted(vyhod.rglob("*")):
        vid = fajl.suffix.lower()
        if not fajl.is_file() or vid not in TEKSTOVYE:
            continue
        bylo = fajl.read_text(encoding="utf-8")
        zamen_adresa += bylo.count(ADRES_VERCEL)
        tekst = bylo.replace(ADRES_VERCEL, adres)
        if vid in (".html", ".svg"):
            tekst = v_html(tekst, osnova)
        elif vid == ".css":
            tekst = v_css(tekst, osnova)
        if tekst != bylo:
            fajl.write_text(tekst, encoding="utf-8")
    return zamen_adresa


def adresa_ot_kornya(tekst, vid):
    najdeno = []
    if vid in (".html", ".svg"):
        najdeno += [m.group(2) for m in ZNACHENIE_OT_KORNYA.finditer(tekst)]
        for m in SRCSET.finditer(tekst):
            najdeno += [kusok.split()[0] for kusok in m.group(2).split(",") if kusok.split()]
    if vid in (".html", ".svg", ".css"):
        najdeno += [m.group(1) for m in URL_OT_KORNYA.finditer(tekst)]
    if vid == ".js":
        najdeno += [m.group(2) for m in ADRES_V_STROKE.finditer(tekst)]
    return [a for a in najdeno if a.startswith("/") and not a.startswith("//")]


def celevoy_fajl(put, osnova):
    """'/Repo/img/x.jpg#y' → 'img/x.jpg'; '/Repo/' → 'index.html'."""
    ostatok = put[len(osnova):] if osnova else put
    ostatok = unquote(ostatok.split("#")[0].split("?")[0]).lstrip("/")
    if ostatok == "" or ostatok.endswith("/"):
        ostatok += "index.html"
    return ostatok


def proverit(vyhod, osnova, adres):
    """Список нарушений; пустой — копия годна к публикации."""
    oshibki = []
    for imya in ("index.html", "404.html"):
        if not (vyhod / imya).is_file():
            oshibki.append(f"нет {imya}")
    stranicy = {}
    adresov = 0
    adres_v_tekste = re.compile(re.escape(adres) + r"""([^\s"'<>)]*)""")
    for fajl in sorted(p for p in vyhod.rglob("*") if p.is_file()):
        otn = fajl.relative_to(vyhod).as_posix()
        vid = fajl.suffix.lower()
        if vid not in VIDY:
            oshibki.append(f"{otn}: файлу такого вида на сайте не место")
            continue
        if vid not in TEKSTOVYE:
            continue
        tekst = fajl.read_text(encoding="utf-8")
        if vid == ".html":
            stranicy[otn] = tekst
        if "vercel.app" in tekst:
            oshibki.append(f"{otn}: остался адрес Vercel")
        puti = adresa_ot_kornya(tekst, vid)
        adresov += len(puti)
        puti += [(osnova or "") + (m.group(1) or "/") for m in adres_v_tekste.finditer(tekst)]
        for put in puti:
            if osnova and put != osnova and not put.startswith(osnova + "/"):
                oshibki.append(f"{otn}: {put} — адрес от корня без основы {osnova}")
            elif not (vyhod / celevoy_fajl(put, osnova)).is_file():
                oshibki.append(f"{otn}: {put} — такого файла в копии нет")
    # якоря: «#id» и «/Repo/#id» ведут к id, который на той странице есть
    idy = {otn: set(ID.findall(tekst)) for otn, tekst in stranicy.items()}
    for otn, tekst in stranicy.items():
        for m in SSYLKA_S_YAKOREM.finditer(tekst):
            chast, yakor = m.group(1).split("#", 1)
            if chast == "":
                cel = otn
            elif chast.startswith("/") and not chast.startswith("//"):
                cel = celevoy_fajl(chast, osnova)
            else:
                continue
            if cel in idy and yakor not in idy[cel]:
                oshibki.append(f"{otn}: {m.group(1)} — якоря #{yakor} на {cel} нет")
    glavnaya = stranicy.get("index.html", "")
    for nuzhno in (f'<link rel="canonical" href="{adres}/">',
                   f'<meta property="og:url" content="{adres}/">'):
        if nuzhno not in glavnaya:
            oshibki.append(f"index.html: нет {nuzhno}")
    return oshibki, adresov


def main():
    argumenty = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    argumenty.add_argument("--osnova", required=True,
                           help="подпапка сайта на Pages: /ARCHI-NSU-Public; пустая — корень домена")
    argumenty.add_argument("--adres", required=True,
                           help="адрес дубля без косой на конце: https://barbashin1970.github.io/ARCHI-NSU-Public")
    argumenty.add_argument("--vyhod", default=str(KOREN / "_pages"), help="куда положить копию")
    a = argumenty.parse_args()
    osnova = "/" + a.osnova.strip("/") if a.osnova.strip("/") else ""
    adres = a.adres.rstrip("/")
    vyhod = Path(a.vyhod).resolve()
    if not adres.startswith("https://") or (osnova and not adres.endswith(osnova)):
        sys.exit(f"СТОП: адрес {adres} — не https или не кончается основой {osnova}")
    if KOREN.is_relative_to(vyhod) or (vyhod.is_relative_to(KOREN)
                                        and not vyhod.is_relative_to(KOREN / "_pages")):
        sys.exit(f"СТОП: {vyhod} стирается перед сборкой; внутри репозитория копия живёт только в _pages/")

    zamen_adresa = sobrat(KOREN, vyhod, osnova, adres)
    oshibki, adresov = proverit(vyhod, osnova, adres)
    if oshibki:
        print("СТОП — самопроверка копии:\n  " + "\n  ".join(oshibki[:30]))
        sys.exit(1)
    fajlov = sum(1 for p in vyhod.rglob("*") if p.is_file())
    print(f"{vyhod.name}/ — копия витрины под {osnova}/: файлов {fajlov}, "
          f"адресов от корня {adresov} (все с основой и ведут к файлам копии), "
          f"адрес Vercel заменён {zamen_adresa} раз.")


if __name__ == "__main__":
    main()
