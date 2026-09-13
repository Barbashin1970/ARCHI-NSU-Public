"use strict";

/* Поведение визитки.
 *
 * Что делает: закрепляет шапку при прокрутке. Больше ничего.
 * Кто зовёт:  index.html одним подключением.
 * Что читает: положение прокрутки.
 * Что пишет:  класс на шапке.
 *
 * ЗДЕСЬ БЫЛА ОТПРАВКА ЗАЯВКИ. Форма, её проверка, ловушка для роботов
 * и сборка почтового адреса по частям — всё снято 13.09.2026 вместе
 * с серверной функцией. Заявка уходила письмом в тот же ящик, в который
 * человек может написать сам; посредник обслуживался ключом к почтовой
 * службе, переменными окружения и согласием по 152-ФЗ. Осталась ссылка
 * `mailto:` прямо в разметке — ей скрипт не нужен, и работает она
 * при отключённых скриптах тоже.
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

    /* Точная высота шапки — в переменную, которой пользуется scroll-padding-top
       в public.css. Отдаём ЧИСТЫЙ замер, без прибавок: воздух между шапкой
       и заголовком добавляет сам CSS, и живёт эта величина в одном месте.
     *
     * ЗАЧЕМ ЭТО СКРИПТОМ, ЕСЛИ В CSS УЖЕ ЕСТЬ ЗНАЧЕНИЯ. В CSS они ступенями
     * по ширине окна, а ступени зависят от того, на сколько строк перенеслось
     * меню, — то есть от ширины русских слов в системном шрифте. На Windows
     * шрифт другой, и точки перелома сдвинутся. Скрипт не гадает: он меряет.
     *
     * CSS при этом остаётся самостоятельным. Не выполнился скрипт — работает
     * запас из медиазапросов; выполнился — работает замер.
     */
    function otmeritShapku() {
        var shapka = document.querySelector("header.shapka");
        if (!shapka) { return; }
        var vysota = Math.round(shapka.getBoundingClientRect().height);
        if (!vysota) { return; }
        document.documentElement.style.setProperty("--vysota-shapki", vysota + "px");
    }

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

    /* Ширина окна поменялась — меню могло перенестись на другое число строк,
       и шапка сменила высоту. Меряем заново, но не на каждое событие: в кадре
       достаточно одного замера, иначе перетаскивание края окна выливается
       в сотни пересчётов раскладки. Тот же приём, что у прокрутки выше. */
    function sledit() {
        var zaprosheno = false;
        window.addEventListener("resize", function () {
            if (zaprosheno) { return; }
            zaprosheno = true;
            window.requestAnimationFrame(function () {
                zaprosheno = false;
                otmeritShapku();
            });
        }, { passive: true });
    }

    function nachat() {
        otmeritShapku();
        nastroitShapku();
        sledit();
        /* Второй замер после загрузки шрифтов: системный шрифт подставляется
           сразу, но если браузер заменил его на ходу, высота строки меню могла
           измениться вместе с числом строк. */
        window.addEventListener("load", otmeritShapku);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", nachat);
    } else {
        nachat();
    }
})();
