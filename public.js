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

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", nastroitShapku);
    } else {
        nastroitShapku();
    }
})();
