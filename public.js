"use strict";

/* Поведение визитки.
 *
 * Что делает: закрепляет шапку при прокрутке и отправляет заявку.
 * Кто зовёт:  index.html одним подключением.
 * Что читает: форму.
 * Что пишет:  запрос в /api/zayavka и ответ человеку под кнопкой.
 *
 * ЭТО НЕ obshchee.js ИЗДЕЛИЯ. Тот перерисовывает меню разделов, опрашивает
 * состояние сервера и показывает версию — всё это требует работающего
 * изделия, которого у визитки нет. Копия того файла печатала бы в подвале
 * «сервер изделия не отвечает», и посетитель читал бы это как поломку
 * изделия, а не как отсутствие у визитки бэкенда.
 *
 * Ничего свежее того, что умеет Safari: страницу открывают с чего угодно,
 * включая рабочий компьютер заказчика с корпоративным браузером.
 */

(function () {
    var POROG_PIKSELEY = 8;

    function nastroitShapku() {
        var shapka = document.querySelector("header.shapka");
        if (!shapka) { return; }
        var zaprosheno = false;

        function obnovit() {
            zaprosheno = false;
            shapka.classList.toggle("prokruchena",
                window.pageYOffset > POROG_PIKSELEY);
        }
        function poprosit() {
            if (!zaprosheno) {
                zaprosheno = true;
                window.requestAnimationFrame(obnovit);
            }
        }
        window.addEventListener("scroll", poprosit, { passive: true });
        obnovit();
    }

    /* --- Заявка ---------------------------------------------------------- */

    /* Сколько заняло заполнение, страница только СООБЩАЕТ — полем `sekund`.
       Решает сервер (api/zayavka.js): проверка, живущая на странице, снимается
       вместе с ней, а рассылочные роботы страницу и не открывают. */

    var NAZVANIYA_POLEY = {
        imya: "имя",
        organizaciya: "организация",
        pochta: "рабочая почта",
        cel: "что нужно",
        soglasie: "согласие на обработку данных"
    };

    function skazat(gnezdo, tekst, vid) {
        gnezdo.textContent = tekst;
        gnezdo.className = "otvet-formy" + (vid ? " " + vid : "");
    }

    function pometit(forma, imena) {
        var pervoe = null;
        Array.prototype.forEach.call(forma.elements, function (pole) {
            var obolochka = pole.closest ? pole.closest(".pole") : null;
            if (!obolochka) { return; }
            var ne_tak = imena.indexOf(pole.name) !== -1;
            obolochka.classList.toggle("ne-tak", ne_tak);
            if (ne_tak && !pervoe) { pervoe = pole; }
        });
        if (pervoe && pervoe.focus) { pervoe.focus(); }
    }

    /* Проверка та же, что на сервере, и это не дублирование ради удобства:
       здесь она отвечает человеку сразу, там — стережёт от запроса мимо
       страницы. Ответ сервера всё равно главнее. */
    function chegoNeHvataet(dannye) {
        var net = [];
        if (!dannye.imya || dannye.imya.length < 2) { net.push("imya"); }
        if (!dannye.organizaciya || dannye.organizaciya.length < 2) {
            net.push("organizaciya");
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(dannye.pochta || "")) {
            net.push("pochta");
        }
        if (!dannye.cel) { net.push("cel"); }
        if (!dannye.soglasie) { net.push("soglasie"); }
        return net;
    }

    function nastroitFormu() {
        var forma = document.getElementById("forma-zayavki");
        var otvet = document.getElementById("otvet-formy");
        if (!forma || !otvet) { return; }

        var otkryta = Date.now();

        forma.addEventListener("submit", function (sobytie) {
            sobytie.preventDefault();

            var d = {
                imya: forma.imya.value.trim(),
                organizaciya: forma.organizaciya.value.trim(),
                pochta: forma.pochta.value.trim(),
                cel: forma.cel.value,
                soobshchenie: forma.soobshchenie.value.trim(),
                soglasie: forma.soglasie.checked,
                otchestvo: forma.otchestvo.value,          /* ловушка */
                sekund: Math.round((Date.now() - otkryta) / 1000)
            };

            var net = chegoNeHvataet(d);
            if (net.length) {
                pometit(forma, net);
                skazat(otvet, "Не заполнено: "
                    + net.map(function (n) { return NAZVANIYA_POLEY[n]; }).join(", ")
                    + ".", "ne-udalos");
                return;
            }
            pometit(forma, []);

            var knopka = forma.querySelector(".knopka-zayavki");
            knopka.disabled = true;
            skazat(otvet, "Отправляю…");

            fetch("/api/zayavka", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(d)
            }).then(function (o) {
                return o.json().then(function (telo) {
                    return { kod: o.status, telo: telo };
                });
            }).then(function (r) {
                if (r.telo && r.telo.ok) {
                    forma.reset();
                    skazat(otvet, "Заявка ушла. Отвечу в течение рабочего дня.",
                        "udalos");
                    return;
                }
                /* Причина называется словами, а не кодом: человек, прочитавший
                   «ошибка 500», напишет нам об этом в лучшем случае. */
                skazat(otvet, (r.telo && r.telo.oshibka)
                    || ("Не отправилось (код " + r.kod + "). Напишите на почту — "
                        + "ссылка ниже."), "ne-udalos");
            }).catch(function () {
                skazat(otvet, "Не отправилось: связь не отвечает. "
                    + "Напишите на почту — ссылка ниже.", "ne-udalos");
            }).then(function () {
                knopka.disabled = false;
            });
        });
    }

    /* Почтовая запаска заполняется скриптом, а не стоит в разметке буквами:
       адрес, написанный в HTML открытым текстом, собирают рассыльщики. */
    function sobratZapasku() {
        var ssylka = document.getElementById("pochta-zapaska");
        if (!ssylka) { return; }
        var adres = ["banksnab", "gmail.com"].join("@");
        ssylka.href = "mailto:" + adres
            + "?subject=" + encodeURIComponent("Платформа АРХИ — заявка")
            + "&body=" + encodeURIComponent(
                "Организация:\nЧто нужно (показ / дистрибутив / пилот):\n"
                + "Сколько объектов:\n");
    }

    function nachat() {
        nastroitShapku();
        nastroitFormu();
        sobratZapasku();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", nachat);
    } else {
        nachat();
    }
})();
