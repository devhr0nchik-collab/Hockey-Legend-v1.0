// ============================================================
// HOCKEY LEGEND — Data Pack
// ============================================================
// По умолчанию всё вымышленное (безопасно для публикации).
// Активация реальных данных — по кнопке в меню (см. далее).
// Подключается ПОСЛЕ script.js.
// ============================================================

import { LEAGUE_DATA, generateLogoSlug, isDatapackActive } from './script.js';
import { migrateSaveWithMap } from './src/features/save/migrations';

console.log('📦 datapack.js загружен');

// ============ СЛОВАРЬ ПЕРЕИМЕНОВАНИЙ (NHL) ============
// real → fake
const TEAM_RENAMES = {
    "Boston Bruins": "Boston Bears",
    "Buffalo Sabres": "Buffalo Blades",
    "Detroit Red Wings": "Detroit Wings",
    "Florida Panthers": "Florida Pumas",
    "Montreal Canadiens": "Montreal Royals",
    "Ottawa Senators": "Ottawa Parliament",
    "Tampa Bay Lightning": "Tampa Bay Bolts",
    "Toronto Maple Leafs": "Toronto Maples",
    "Carolina Hurricanes": "Carolina Storm",
    "Columbus Blue Jackets": "Columbus Admirals",
    "New Jersey Devils": "New Jersey Demons",
    "New York Islanders": "New York Mariners",
    "New York Rangers": "New York Knights",
    "Philadelphia Flyers": "Philadelphia Aviators",
    "Pittsburgh Penguins": "Pittsburgh Icebreakers",
    "Washington Capitals": "Washington Generals",
    "Chicago Blackhawks": "Chicago Falcons",
    "Colorado Avalanche": "Colorado Summit",
    "Dallas Stars": "Dallas Titans",
    "Minnesota Wild": "Minnesota Northmen",
    "Nashville Predators": "Nashville Hunters",
    "St. Louis Blues": "St. Louis Symphony",
    "Utah Mammoth": "Utah Bisons",
    "Winnipeg Jets": "Winnipeg Pilots",
    "Anaheim Ducks": "Anaheim Drakes",
    "Calgary Flames": "Calgary Blaze",
    "Edmonton Oilers": "Edmonton Drillers",
    "Los Angeles Kings": "Los Angeles Monarchs",
    "San Jose Sharks": "San Jose Waves",
    "Seattle Kraken": "Seattle Thunder",
    "Vancouver Canucks": "Vancouver Mounties",
    "Vegas Golden Knights": "Vegas Jackpots",

    // ============ КХЛ ============
    "СКА": "Нева Гвардия",
    "Спартак": "Гладиаторы Москва",
    "Торпедо": "Автозаводцы",
    "Лада": "Волга Моторс",
    "Сочи": "Черноморские Дельфины",
    "Динамо Минск": "Зубры Минск",
    "ЦСКА": "Армейцы Москвы",
    "Динамо Москва": "Динамовцы Москвы",
    "Локомотив": "Железнодорожники",
    "Северсталь": "Сталь Череповец",
    "Шанхайские Драконы": "Шанхайские Тигры",
    "Ак Барс": "Казанские Барсы",
    "Автомобилист": "Уральские Моторы",
    "Нефтехимик": "Нефтяники Нижнекамск",
    "Металлург Магнитогорск": "Магнитка Сталь",
    "Трактор": "Челябинские Танки",
    "Авангард": "Омские Соколы",
    "Амур": "Хабаровские Тигры",
    "Адмирал": "Владивостокские Моряки",
    "Барыс": "Астана Степные Орлы",
    "Салават Юлаев": "Уфа Батыры",
    "Сибирь": "Новосибирские Волки",

    // ============ AHL ============
    "Charlotte Checkers": "Charlotte Stallions",
    "Hartford Wolf Pack": "Hartford Wolves",
    "Hershey Bears": "Hershey Cubs",
    "Lehigh Valley Phantoms": "Lehigh Valley Ghosts",
    "Providence Bruins": "Providence Foxes",
    "Springfield Thunderbirds": "Springfield Storm",
    "Wilkes-Barre Scranton Penguins": "Wilkes-Barre Icehawks",
    "Cleveland Monsters": "Cleveland Gargoyles",
    "Belleville Senators": "Belleville Parliament",
    "Hamilton Hammers": "Hamilton Anvils",
    "Laval Rocket": "Laval Comets",
    "Rochester Americans": "Rochester Freedom",
    "Syracuse Crunch": "Syracuse Bears",
    "Toronto Marlies": "Toronto Pillars",
    "Utica Comets": "Utica Snowcaps",
    "Tucson Roadrunners": "Tucson Coyotes",
    "Chicago Wolves": "Chicago Pack",
    "Grand Rapids Griffins": "Grand Rapids Ravens",
    "Iowa Wild": "Iowa Plains",
    "Manitoba Moose": "Manitoba Bisons",
    "Milwaukee Admirals": "Milwaukee Captains",
    "Rockford IceHogs": "Rockford Boars",
    "Texas Stars": "Texas Longhorns",
    "Colorado Eagles": "Colorado Hawks",
    "Abbotsford Canucks": "Abbotsford Lumberjacks",
    "Bakersfield Condors": "Bakersfield Vultures",
    "Calgary Wranglers": "Calgary Rustlers",
    "Coachella Valley Firebirds": "Coachella Valley Blaze",
    "Henderson Silver Knights": "Henderson Steel Knights",
    "Ontario Reign": "Ontario Crowns",
    "San Diego Gulls": "San Diego Tides",
    "San Jose Barracuda": "San Jose Pikes",

    // ============ ВХЛ (32 клуба) ============
    "АКМ Тула": "Тульские Оружейники",
    "Барс Казань": "Волжские Барсы",
    "Буран Воронеж": "Воронежские Вихри",
    "Горняк-УГМК": "Уральские Горняки",
    "Дизель Пенза": "Пензенские Моторы",
    "Динамо-Алтай": "Алтайские Динамовцы",
    "Динамо СПб": "Динамовцы Невы",
    "Зауралье": "Зауральские Волки",
    "Звезда Москва": "Московские Звёзды",
    "Ижсталь": "Ижевские Сталевары",
    "Кристалл Саратов": "Саратовские Кристаллы",
    "Магнитка": "Магнитогорские Кузнецы",
    "Металлург Новокузнецк": "Новокузнецкие Сталевары",
    "Молот": "Молотобойцы",
    "Нефтяник Альметьевск": "Альметьевские Нефтяники",
    "Олимпия": "Кировские Олимпийцы",
    "Омские Крылья": "Омские Лётчики",
    "Ростов": "Ростовские Донцы",
    "Рубин Тюмень": "Тюменские Рубины",
    "Рязань-ВДВ": "Рязанские Десантники",
    "СКА-ВМФ": "Морские Львы",
    "Сокол Красноярск": "Красноярские Соколы",
    "Торос": "Уральские Торосы",
    "ХК Калуга": "Калужские Космонавты",
    "ХК Норильск": "Норильские Металлурги",
    "ХК Тамбов": "Тамбовские Волки",
    "Химик": "Воскресенские Химики",
    "ЦСКВВС": "Самарские Лётчики",
    "Челны": "Камские Волки",
    "Челмет": "Челябинские Металлурги",
    "Югра": "Югорские Медведи",
    "Южный Урал": "Южноуральские Металлурги",

    // ============ МХЛ (34 клуба) ============
    // Западная конференция
    "Академия Михайлова": "Академия Тульская",
    "Академия СКА": "Академия Невы",
    "Алмаз": "Череповецкие Алмазы",
    "Амурские Тигры": "Хабаровские Тигрята",
    "Динамо-Шинник": "Бобруйские Динамовцы",
    "Красная Армия": "Красные Курсанты",
    "Красная машина Атлант": "Красные Атланты",
    "Красная машина Юниор": "Красные Юниоры",
    "Крылья Советов": "Московские Крылья",
    "Локо": "Ярославские Локомотивы",
    "МХК Динамо-Москва": "Молодые Динамовцы Москвы",
    "МХК Динамо СПб": "Молодые Динамовцы Невы",
    "МХК Спартак": "Молодые Гладиаторы",
    "МХК Спартак МАХ": "Молодые Гладиаторы МАХ",
    "Сахалинские Акулы": "Сахалинские Косатки",
    "СКА-1946": "Нева-1946",
    "Тайфун": "Приморские Тайфуны",
    // Восточная конференция
    "Авто": "Екатеринбургские Автомобилисты",
    "АКМ-Юниор": "Тульские Юниоры",
    "Белые Медведи": "Челябинские Белые Медведи",
    "Ирбис": "Казанские Ирбисы",
    "Красноярские Рыси": "Красноярские Рысята",
    "Кузнецкие Медведи": "Новокузнецкие Медведи",
    "Локо-76": "Ярославские Юниоры",
    "Мамонты Югры": "Югорские Мамонты",
    "МХК Молот": "Молодые Молотобойцы",
    "Омские Ястребы": "Омские Ястребята",
    "Реактор": "Димитровградские Реакторы",
    "Сибирские Снайперы": "Новосибирские Снайперы",
    "Снежные Барсы": "Астанинские Барсята",
    "Спутник": "Нижнетагильские Спутники",
    "Стальные Лисы": "Магнитогорские Лисы",
    "Толпар": "Уфимские Толпары",
    "Чайка": "Нижегородские Чайки",

    // ============ SHL (Швеция, 14) ============
    "Brynäs IF": "Brynäs Ravens",
    "Djurgårdens IF": "Djurgården Stags",
    "Färjestads BK": "Färjestad Flames",
    "Frölunda HC": "Frölunda Surf",
    "HV71": "HV Vikings",
    "IF Björklöven": "Björklöven Beavers",
    "IF Malmö Redhawks": "Malmö Falcons",
    "Linköping HC": "Linköping Legion",
    "Luleå HF": "Luleå Icehawks",
    "Örebro HK": "Örebro Blades",
    "Rögle BK": "Rögle Rams",
    "Skellefteå AIK": "Skellefteå Storm",
    "Timrå IK": "Timrå Tigers",
    "Växjö Lakers": "Växjö Vipers",

    // ============ Liiga (Финляндия, 16) ============
    "Tappara Tampere": "Tampere Titans",
    "KooKoo Kouvola": "Kouvola Kites",
    "SaiPa Lappeenranta": "Lappeenranta Lynx",
    "Ilves Tampere": "Tampere Panthers",
    "JYP Jyväskylä": "Jyväskylä Jets",
    "Lukko Rauma": "Rauma Rocks",
    "KalPa Kuopio": "Kuopio Kings",
    "Ässät Pori": "Pori Bulls",
    "Kiekko-Espoo": "Espoo Eagles",
    "HIFK Helsinki": "Helsinki Hounds",
    "Pelicans": "Lahti Plovers",
    "HPK Hämeenlinna": "Hämeenlinna Hurricanes",
    "TPS Turku": "Turku Tritons",
    "Kärpät": "Oulu Wolverines",
    "Jukurit Mikkeli": "Mikkeli Mustangs",
    "Sport Vaasa": "Vaasa Vipers",

    // ============ DEL (Германия, 14) ============
    "Adler Mannheim": "Mannheim Ravens",
    "Eisbären Berlin": "Berlin Icebears",
    "Augsburger Panther": "Augsburg Blizzards",
    "Grizzlys Wolfsburg": "Wolfsburg Grizzlies",
    "Dresdner Eislöwen": "Dresden Ice Lions",
    "Iserlohn Roosters": "Iserlohn Rhinos",
    "ERC Ingolstadt": "Ingolstadt Ironhawks",
    "Kölner Haie": "Cologne Sharks",
    "Löwen Frankfurt": "Frankfurt Wanderers",
    "Nürnberg Ice Tigers": "Nürnberg Ice Wolves",
    "Red Bull München": "Munich Ice Bulls",
    "Fischtown Pinguins": "Bremerhaven Penguins",
    "Schwenninger Wild Wings": "Schwenningen Wings",
    "Straubing Tigers": "Straubing Wildcats",

    // ============ NL Switzerland (Швейцария, 14) ============
    "HC Davos": "Davos Avalanche",
    "Fribourg-Gottéron": "Fribourg Dragons",
    "ZSC Lions": "Zurich Ice",
    "Genève-Servette": "Geneva Tridents",
    "HC Lugano": "Lugano Leopards",
    "Lausanne HC": "Lausanne Lightning",
    "Rapperswil-Jona Lakers": "Rapperswil Waves",
    "EV Zug": "Zug Warriors",
    "SC Bern": "Bern Bears",
    "EHC Biel": "Biel Badgers",
    "SCL Tigers": "Langnau Lycans",
    "EHC Kloten": "Kloten Cobras",
    "HC Ambrì-Piotta": "Ambrì Chargers",
    "HC Ajoie": "Ajoie Wasps",

    // ============ Czech Extraliga (Чехия, 14) ============
    "Bílí Tygři Liberec": "Liberec White Tigers",
    "BK Mladá Boleslav": "Mladá Boleslav Knights",
    "HC Dynamo Pardubice": "Pardubice Mustangs",
    "HC Energie Karlovy Vary": "Karlovy Vary Sparks",
    "HC Kometa Brno": "Brno Comets",
    "HC Litvínov": "Litvínov Lions",
    "HC Motor České Budějovice": "České Budějovice Motors",
    "HC Oceláři Třinec": "Třinec Steelers",
    "HC Olomouc": "Olomouc Owls",
    "HC Škoda Plzeň": "Plzeň Pilots",
    "HC Sparta Praha": "Prague Spartans",
    "HC Vítkovice Ridera": "Vítkovice Riders",
    "Mountfield HK": "Hradec Králové Hawks",
    "HC Dukla Jihlava": "Jihlava Dukes",

    // ============ Беларусь: Экстралига (14) ============
    "Металлург Жлобин": "Жлобинские Сталевары",
    "Славутич Смоленск": "Смоленские Витязи",
    "Юность Минск": "Минская Молодость",
    "Шахтер Солигорск": "Солигорские Шахтёры",
    "Витебск": "Витебские Рыцари",
    "Лида": "Лидские Грифоны",
    "Гомель": "Гомельские Рыси",
    "Неман Гродно": "Гродненские Неманы",
    "Динамо-Молодечно": "Молодечненские Динамовцы",
    "Брест": "Брестские Крепости",
    "Химик Новополоцк": "Новополоцкие Химики",
    "Локомотив Орша": "Оршанские Локомотивы",
    "Могилев": "Могилёвские Львы",
    "Авиатор Барановичи": "Барановичские Авиаторы",

    // ============ Беларусь: Высшая лига (12) ============
    "Динамо-Олимпик": "Олимпийские Динамовцы",
    "Пинские ястребы": "Пинские Соколы",
    "Белсталь": "Белорусские Сталевары",
    "Рыси Гомель": "Гомельские Рысята",
    "Рыцари Лида": "Лидские Витязи",
    "Юниор Минск": "Минские Юниоры",
    "Локо Орша": "Оршанские Юниоры",
    "Прогресс Гродно": "Гродненские Прогрессисты",
    "Медведи Витебск": "Витебские Медведи",
    "Нефтехимик Новополоцк": "Новополоцкие Нефтяники",
    "Днепровские Львы": "Днепровские Витязи",
    "Зубры": "Белорусские Зубры",

    // ============ ICE_HL (Австрия, 3) ============
    "Red Bull Salzburg": "Salzburg Eagles",
    "KAC Klagenfurt": "Klagenfurt Knights",
    "Graz 99ers": "Graz Gladiators"
};
// fake → real (обратный словарь для активации датапака)
const TEAM_RENAMES_REVERSE = {};
Object.keys(TEAM_RENAMES).forEach(real => {
    TEAM_RENAMES_REVERSE[TEAM_RENAMES[real]] = real;
});

// ============ ПРИМЕНЕНИЕ ФЕЙКОВЫХ НАЗВАНИЙ К ДАННЫМ ============
function applyFakeTeamNames() {
    if (typeof LEAGUE_DATA === 'undefined') return;
    Object.keys(LEAGUE_DATA).forEach(lk => {
        const ld = LEAGUE_DATA[lk];
        if (!ld || !ld.divisions) return;
        ld.divisions.forEach(div => {
            div.clubs = div.clubs.map(c => TEAM_RENAMES[c] || c);
        });
    });
    console.log('📦 Фейковые названия клубов применены');
}

// ============ МИГРАЦИЯ СЕЙВА (real <-> fake) ============
// Логика вынесена в src/features/save/migrations.ts (чистые функции + тесты).

function migrateSaveToFake(data) { return migrateSaveWithMap(data, TEAM_RENAMES, Object.keys(LEAGUE_DATA)); }
function migrateSaveToReal(data) { return migrateSaveWithMap(data, TEAM_RENAMES_REVERSE, Object.keys(LEAGUE_DATA)); }

// ============ ЭКСПОРТ В WINDOW ============
window.TEAM_RENAMES = TEAM_RENAMES;
window.TEAM_RENAMES_REVERSE = TEAM_RENAMES_REVERSE;
window.migrateSaveToFake = migrateSaveToFake;
window.applyFakeTeamNames = applyFakeTeamNames;

// ============ АВТО-ПРИМЕНЕНИЕ ПРИ ЗАГРУЗКЕ ============
// Выбор режима делает script.js (loadGame/resetGame). Здесь ничего не трогаем,
// чтобы не сбить состояние между menu → new game / load game.

// ============ ФАРМ-КЛУБЫ NHL → AHL (работает с ФЕЙКОВЫМИ названиями) ============
// После переименования NHL и AHL, getFarmClub в script.js перестала находить
// пары (ключ "Boston Bruins" не совпадает с "Boston Bears"). Переопределяем.
const FARM_PAIRS_FAKE = {
    "Boston Bears": "Providence Foxes",
    "Buffalo Blades": "Rochester Freedom",
    "Detroit Wings": "Grand Rapids Ravens",
    "Florida Pumas": "Charlotte Stallions",
    "Montreal Royals": "Laval Comets",
    "Ottawa Parliament": "Belleville Parliament",
    "Tampa Bay Bolts": "Syracuse Bears",
    "Toronto Maples": "Toronto Pillars",
    "Carolina Storm": "Chicago Pack",
    "Columbus Admirals": "Cleveland Gargoyles",
    "New Jersey Demons": "Utica Snowcaps",
    "New York Mariners": "Hamilton Anvils",
    "New York Knights": "Hartford Wolves",
    "Philadelphia Aviators": "Lehigh Valley Ghosts",
    "Pittsburgh Icebreakers": "Wilkes-Barre Icehawks",
    "Washington Generals": "Hershey Cubs",
    "Chicago Falcons": "Rockford Boars",
    "Colorado Summit": "Colorado Hawks",
    "Dallas Titans": "Texas Longhorns",
    "Minnesota Northmen": "Iowa Plains",
    "Nashville Hunters": "Milwaukee Captains",
    "St. Louis Symphony": "Springfield Storm",
    "Utah Bisons": "Tucson Coyotes",
    "Winnipeg Pilots": "Manitoba Bisons",
    "Anaheim Drakes": "San Diego Tides",
    "Calgary Blaze": "Calgary Rustlers",
    "Edmonton Drillers": "Bakersfield Vultures",
    "Los Angeles Monarchs": "Ontario Crowns",
    "San Jose Waves": "San Jose Pikes",
    "Seattle Thunder": "Coachella Valley Blaze",
    "Vancouver Mounties": "Abbotsford Lumberjacks",
    "Vegas Jackpots": "Henderson Steel Knights"
};

// Датапак лишь дополняет базовый резолвер script.js (фейковые пары).
// undefined → script.js использует свои реальные пары.
window.getFarmClubOverride = function(nhlClub) {
    return FARM_PAIRS_FAKE[nhlClub];
};

window.FARM_PAIRS_FAKE = FARM_PAIRS_FAKE;

// ============ SVG-ГЕНЕРАТОР ЩИТОВ (для fallback) ============
function getShieldColors(club) {
    let h = 0;
    for (let i = 0; i < club.length; i++) h = (h * 31 + club.charCodeAt(i)) | 0;
    h = Math.abs(h);
    const h1 = h % 360;
    const h2 = (h1 + 25 + (h % 80)) % 360;
    return [`hsl(${h1}, 62%, 40%)`, `hsl(${h2}, 70%, 22%)`];
}

function getClubAbbr(club) {
    const clean = club.replace(/[^\wА-Яа-яЁё\s]/g, ' ').trim();
    const words = clean.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return '??';
    if (words.length === 1) return words[0].substring(0, 3).toUpperCase();
    return words.slice(0, 3).map(w => w[0]).join('').toUpperCase();
}

function generateShieldSVG(club) {
    const [c1, c2] = getShieldColors(club);
    const abbr = getClubAbbr(club);
    const fs = abbr.length <= 2 ? 15 : abbr.length === 3 ? 13 : 11;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 44">
        <defs>
            <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="${c1}"/>
                <stop offset="100%" stop-color="${c2}"/>
            </linearGradient>
        </defs>
        <path d="M2 2 L38 2 L38 26 Q38 40 20 42 Q2 40 2 26 Z"
              fill="url(#g)" stroke="rgba(255,255,255,0.55)" stroke-width="1.5"/>
        <path d="M2 2 L38 2 L38 12 L2 12 Z"
              fill="rgba(255,255,255,0.08)"/>
        <text x="20" y="27" text-anchor="middle"
              font-family="Arial, sans-serif" font-weight="900" font-size="${fs}"
              fill="white" stroke="rgba(0,0,0,0.45)" stroke-width="0.6"
              paint-order="stroke">${abbr}</text>
    </svg>`;
}

// ============ ЗАГРУЗКА ЛОГОТИПОВ ИЗ GITHUB RELEASES ============
const LOGO_BASE_URL = "https://github.com/devhr0nchik-collab/hockey-legend-logos/releases/download/v1.0-logos/";

// Заменяем рендер логотипов из script.js на «PNG с GitHub + SVG-fallback».
window.__teamLogoRenderer = function(club, leagueKey) {
    // SVG-щит всегда генерируем — он нужен как fallback, если PNG не загрузится
    const svg = generateShieldSVG(club);
    const fallbackB64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));

    // Без датапака — только SVG-щит (не грузим ничего с GitHub)
    if (!isDatapackActive()) {
        return `<img class="team-logo-img" src="${fallbackB64}" alt="${club}" />`;
    }

    // С датапаком — реальный логотип с GitHub, с fallback на SVG при ошибке
    const slug = generateLogoSlug(club);
    const url = LOGO_BASE_URL + slug + '.png';
    return `<img class="team-logo-img" src="${url}" alt="${club}" onerror="this.onerror=null;this.src='${fallbackB64}';" />`;
};

// ============ ПРИМЕНЕНИЕ РЕАЛЬНЫХ НАЗВАНИЙ К КЛУБАМ ============
function applyRealTeamNames() {
    if (typeof LEAGUE_DATA === 'undefined') return;
    Object.keys(LEAGUE_DATA).forEach(lk => {
        const ld = LEAGUE_DATA[lk];
        if (!ld || !ld.divisions) return;
        ld.divisions.forEach(div => {
            div.clubs = div.clubs.map(c => TEAM_RENAMES_REVERSE[c] || c);
        });
    });
    console.log('📦 Реальные названия клубов применены');
}


window.applyRealTeamNames = applyRealTeamNames;
window.migrateSaveToReal = migrateSaveToReal;

// Автозапуск отменён — script.js сам решит, что применять.
// См. блок инициализации в конце script.js.

console.log('📦 datapack.js полностью загружен');
