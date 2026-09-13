"use strict";

/*
 * Приём заявки с визитки и письмо владельцу.
 *
 * Что делает: проверяет заявку и отправляет её письмом через Resend.
 * Кто зовёт:  форма на index.html, запросом POST /api/zayavka.
 * Что читает: тело запроса и переменные окружения.
 * Что пишет:  письмо на POCHTA_VLADELCA и строку в журнал Vercel.
 *
 * ЗАВИСИМОСТЕЙ НЕТ НИ ОДНОЙ. Resend дёргается обычным `fetch` по его же
 * открытому интерфейсу: ради одного запроса тянуть библиотеку, а с ней
 * `package.json`, `node_modules` и обновления — дороже, чем написать
 * пятнадцать строк. Node на Vercel умеет `fetch` сам.
 *
 * БЕЗ КЛЮЧА СТРАНИЦА НЕ ЛОМАЕТСЯ. Нет `RESEND_API_KEY` — заявка не теряется
 * молча: функция отвечает словами «почта не настроена, напишите на адрес»,
 * а страница показывает почтовую запаску. Это тот же приём, что режим показа
 * в самом изделии: отсутствие настройки — состояние, а не поломка.
 *
 * ЧТО СЮДА НЕ КЛАДЁТСЯ. Ни базы, ни хранения: заявка живёт в письме. База
 * потребовала бы согласия на хранение, срока хранения и ответа на вопрос,
 * кто её чистит, — ради десятка заявок в месяц это лишняя ответственность
 * по 152-ФЗ.
 */

/* Куда идёт заявка. Адрес держится в переменной окружения, а не в коде:
   в коде он попал бы в общий репозиторий и в сборщики адресов. */
const POCHTA = process.env.POCHTA_VLADELCA || "";
const KLYUCH = process.env.RESEND_API_KEY || "";

/* От кого письмо. `onboarding@resend.dev` работает без своего домена, но
   Resend пускает его ТОЛЬКО на адрес владельца учётной записи — для нашего
   случая этого достаточно. Свой домен — потом, одной переменной. */
const OTPRAVITEL = process.env.OTPRAVITEL_PISMA
    || "Визитка АРХИ <onboarding@resend.dev>";

const CELI = {
    pokaz: "Показ на 40 минут",
    distributiv: "Дистрибутив для самостоятельной проверки",
    pilot: "Обсудить пилот на объекте",
    drugoe: "Другое"
};

/* Столько секунд человеку нужно, чтобы заполнить форму. Всё, что быстрее, —
   рассылочный робот: он заполняет поля мгновенно. */
const BYSTREE_CHELOVEKA_SEK = 3;

const POCHTA_OBRAZEC = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* Сколько заявок с одного адреса пропускаем за час.
 *
 * ПОЧЕМУ ТАК ГРУБО. Обе ловушки выше — поле-приманка и время заполнения —
 * стерегут форму, а не этот адрес: и пустое «отчество», и `sekund: 99`
 * подделываются запросом мимо страницы за одну строку. Значит нужна мера,
 * которая не спрашивает отправителя о нём самом. Счётчик по адресу —
 * такая мера.
 *
 * ЧЕГО ОНА НЕ УМЕЕТ. Память живёт внутри одного запущенного экземпляра
 * функции: Vercel держит их несколько и гасит простаивающие, поэтому
 * рассылка с десяти адресов или после паузы счётчик обойдёт. Это заслон
 * от случайного перебора, а не от осады. Настоящий предел — квота Resend
 * в 3 000 писем в месяц; ради десятка заявок заводить хранилище дороже,
 * чем пережить редкий прорыв.
 */
const ZAYAVOK_S_ADRESA_V_CHAS = 5;
const CHAS_MS = 60 * 60 * 1000;
const schetchik = new Map();

function slishkomChasto(adres) {
    if (!adres) { return false; }
    const teper = Date.now();

    /* Подчистка заодно с проверкой: отдельного дворника у функции,
       которая засыпает между запросами, быть не может. */
    for (const [kto, kogda] of schetchik) {
        if (teper - kogda[0] > CHAS_MS) { schetchik.delete(kto); }
    }

    const bylo = (schetchik.get(adres) || []).filter((k) => teper - k < CHAS_MS);
    if (bylo.length >= ZAYAVOK_S_ADRESA_V_CHAS) { return true; }
    bylo.push(teper);
    schetchik.set(adres, bylo);
    return false;
}

/* Откуда пришёл запрос.
 *
 * Браузер проставляет `Origin` сам, и подделать его со страницы нельзя —
 * поэтому чужой сайт не сможет отправлять заявки нашей формой. Запрос
 * вообще без `Origin` (curl, почтовый клиент, старый браузер) пропускается:
 * отказ по его отсутствию отрезал бы и живых людей, а ловушки выше никуда
 * не делись.
 */
function chuzhoyIstochnik(zapros) {
    const istochnik = zapros.headers && (zapros.headers.origin
        || zapros.headers.Origin);
    if (!istochnik) { return false; }
    const svoy = zapros.headers.host || zapros.headers.Host || "";
    return istochnik.replace(/^https?:\/\//, "") !== svoy;
}

function obrezat(znachenie, dlina) {
    return String(znachenie === undefined || znachenie === null ? "" : znachenie)
        .trim().slice(0, dlina);
}

/* Заголовок письма собирается из чужого текста, а в заголовке перевод строки
   означает новый заголовок. Вырезается здесь, а не «где-нибудь потом». */
function bezPerevodovStrok(tekst) {
    return tekst.replace(/[\r\n]+/g, " ");
}

function ekranirovat(tekst) {
    return String(tekst)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function proverit(telo) {
    const d = {
        imya: obrezat(telo.imya, 80),
        organizaciya: obrezat(telo.organizaciya, 120),
        pochta: obrezat(telo.pochta, 120),
        cel: obrezat(telo.cel, 20),
        soobshchenie: obrezat(telo.soobshchenie, 2000),
        soglasie: telo.soglasie === true,
        otchestvo: obrezat(telo.otchestvo, 80),
        sekund: Number(telo.sekund) || 0
    };

    if (d.imya.length < 2) { return { oshibka: "Не заполнено имя." }; }
    if (d.organizaciya.length < 2) { return { oshibka: "Не заполнена организация." }; }
    if (!POCHTA_OBRAZEC.test(d.pochta)) { return { oshibka: "Почта записана неверно." }; }
    if (!CELI[d.cel]) { return { oshibka: "Выберите, что нужно." }; }
    if (!d.soglasie) {
        return { oshibka: "Без согласия на обработку данных заявку принять нельзя." };
    }
    /* Ловушки молча: роботу не сообщают, на чём он попался, иначе следующая
       рассылка обойдёт проверку. Для человека этот путь недостижим. */
    if (d.otchestvo) { return { molcha: "ловушка заполнена" }; }
    if (d.sekund < BYSTREE_CHELOVEKA_SEK) {
        return { molcha: "форма отправлена быстрее человека: " + d.sekund + " с" };
    }
    return { dannye: d };
}

function pismo(d) {
    const stroki = [
        ["Кто", d.imya],
        ["Организация", d.organizaciya],
        ["Почта", d.pochta],
        ["Что нужно", CELI[d.cel]]
    ];
    const tekst = stroki.map((s) => s[0] + ": " + s[1]).join("\n")
        + (d.soobshchenie ? "\n\nСообщение:\n" + d.soobshchenie : "");
    const html = "<h2>Заявка с визитки АРХИ</h2><table cellpadding=\"6\">"
        + stroki.map((s) => "<tr><td><b>" + s[0] + "</b></td><td>"
            + ekranirovat(s[1]) + "</td></tr>").join("")
        + "</table>"
        + (d.soobshchenie
            ? "<p><b>Сообщение</b><br>"
              + ekranirovat(d.soobshchenie).replace(/\n/g, "<br>") + "</p>"
            : "");
    return { tekst, html };
}

module.exports = async (zapros, otvet) => {
    if (zapros.method !== "POST") {
        return otvet.status(405).json({ ok: false, oshibka: "Только POST." });
    }

    /* Тело разбирается под присмотром. Vercel обычно разбирает JSON сам,
       но при чужом заголовке типа отдаёт строку как есть — и сломанная
       строка роняла бы функцию с 500 вместо честного «не разобрал».
       Первым же это находит любой сканер уязвимостей. */
    let telo;
    try {
        telo = typeof zapros.body === "string"
            ? JSON.parse(zapros.body || "{}") : (zapros.body || {});
    } catch (sboy) {
        return otvet.status(400).json({ ok: false, oshibka: "Заявка не разобрана." });
    }
    if (typeof telo !== "object" || telo === null || Array.isArray(telo)) {
        return otvet.status(400).json({ ok: false, oshibka: "Заявка не разобрана." });
    }

    /* Запрос с чужой страницы нашей формой — не заявка. Молча, как ловушки:
       отказ словами подсказал бы, что именно обходить. */
    if (chuzhoyIstochnik(zapros)) {
        console.log("заявка отброшена: чужой источник",
            zapros.headers.origin || zapros.headers.Origin);
        return otvet.status(200).json({ ok: true });
    }

    const itog = proverit(telo);
    if (itog.molcha) {
        /* Роботу отвечаем как человеку, которому всё удалось: иначе рассылка
           видит отказ и подбирает обход. В журнал причина пишется. */
        console.log("заявка отброшена:", itog.molcha);
        return otvet.status(200).json({ ok: true });
    }
    if (itog.oshibka) {
        return otvet.status(400).json({ ok: false, oshibka: itog.oshibka });
    }
    const d = itog.dannye;

    /* Сетевой адрес берётся из заголовка, который проставляет сам Vercel;
       первый в списке — тот, кто пришёл, остальные дописаны по пути. */
    const otkuda = String((zapros.headers && (zapros.headers["x-forwarded-for"]
        || zapros.headers["x-real-ip"])) || "").split(",")[0].trim();

    if (slishkomChasto(otkuda)) {
        console.log("заявка отброшена: с адреса уже пришло",
            ZAYAVOK_S_ADRESA_V_CHAS, "за час");
        return otvet.status(429).json({
            ok: false,
            oshibka: "С этого адреса уже пришло несколько заявок. "
                + "Напишите письмом — ссылка ниже, ответ будет тот же."
        });
    }

    if (!KLYUCH || !POCHTA) {
        /* Заявка не теряется: человеку прямо сказано, что делать дальше. */
        console.error("почта не настроена: нет RESEND_API_KEY либо POCHTA_VLADELCA;"
            + " заявка от " + d.pochta + " не отправлена");
        return otvet.status(503).json({
            ok: false,
            oshibka: "Почта на сайте пока не настроена. Напишите письмом — "
                + "ссылка ниже, ответ будет тот же."
        });
    }

    const { tekst, html } = pismo(d);

    try {
        const poslano = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + KLYUCH,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                from: OTPRAVITEL,
                to: [POCHTA],
                /* Ответ уходит прямо заявителю: нажал «Ответить» — и письмо
                   ему, а не в пустоту. */
                reply_to: d.pochta,
                subject: bezPerevodovStrok(
                    "Заявка АРХИ: " + d.organizaciya + " — " + CELI[d.cel]),
                text: tekst,
                html: html
            })
        });

        if (!poslano.ok) {
            const prichina = await poslano.text();
            console.error("Resend отказал:", poslano.status, prichina.slice(0, 300));
            return otvet.status(502).json({
                ok: false,
                oshibka: "Почтовая служба не приняла письмо. Напишите на адрес "
                    + "ниже — ответ будет тот же."
            });
        }

        console.log("заявка принята:", d.organizaciya, "·", CELI[d.cel]);
        return otvet.status(200).json({ ok: true });
    } catch (sboy) {
        console.error("заявка не ушла:", sboy && sboy.message);
        return otvet.status(502).json({
            ok: false,
            oshibka: "Письмо не ушло: почтовая служба не отвечает. "
                + "Напишите на адрес ниже."
        });
    }
};
