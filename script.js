import { LANG } from './i18n.js';
import { REAL_ROSTERS } from './datapack_rosters.js';
import { hashString, makeSeededRNG } from './src/core/rng';
import { generateAttributes } from './src/core/attributes';
import { getLeagueSalaryCap, calculateSalary, calculateSalaryCap, formatSalary } from './src/core/salary';
import { packPlayer, unpackPlayer, packClub, unpackClub } from './src/core/pack';
import { createIdbStore } from './src/features/save/storage';

if (window.DEBUG) console.log("✅ script.js загружен");
// ============ 1. ЭЛЕМЕНТЫ ============
const mainMenu = document.getElementById('main-menu');
const officeScreen = document.getElementById('office-screen');
const saveIndicator = document.getElementById('save-indicator');
const eventModal = document.getElementById('event-modal');
const eventTitle = document.getElementById('event-title');
const eventText = document.getElementById('event-text');
const eventDetails = document.getElementById('event-details');
const eventActions = document.getElementById('event-actions');
// Элементы модалки-смартфона (переговоры)
const negotiationModal = document.getElementById('negotiation-modal');
const phoneChatAvatar = document.getElementById('phone-chat-avatar');
const phoneChatName = document.getElementById('phone-chat-name');
const phoneChatStatus = document.getElementById('phone-chat-status');
const phoneChatBody = document.getElementById('phone-chat-body');
const phoneInputBar = document.getElementById('phone-input-bar');
const btnNewGame = document.getElementById('btn-new-game');
const btnLoadGame = document.getElementById('btn-load-game');
const btnSettings = document.getElementById('btn-settings');
const settingsModal = document.getElementById('settings-modal');
const btnSettingsClose = document.getElementById('btn-settings-close');
const btnAbout = document.getElementById('btn-about');
const aboutModal = document.getElementById('about-modal');
const btnAboutClose = document.getElementById('btn-about-close');
const btnPlayWeek = document.getElementById('btn-play-week');
const SAVE_KEY = 'hockeyLegendSave_v23';
const DB_NAME = 'hockeyLegendDB';
const DB_STORE = 'saves';
const HAS_SAVE_FLAG = 'hockeyLegendHasSave';

const idb = createIdbStore(DB_NAME, DB_STORE);
const idbSet = idb.set;
const idbGet = idb.get;
const idbDelete = idb.delete;

// ============ 2. СОСТОЯНИЕ ============
let agentName = 'Агент';
let agencyName = 'Моё агентство';
let agencyCountry = 'RU';
let agencyFlag = '🇷🇺';
let agentMoney = 3000;
let players = [];
let myRoster = [];
let currentSeason = 2026;
let currentWeek = 1;
let newsFeed = [];
let standings = {};
let teamStrengths = {};
let clubData = {};
let myPortfolio = {};
let npcAgencies = [];
let clientsTab = 'my';
let marketTab = 'all';
let marketSort = 'price_asc';
let playerTab = 'info';
let currentPlayerScreen = null;
let currentPlayerSource = 'my';
let playerReturnContext = null; // { type: 'club', clubName, league } | { type: 'national' } | null
let agencyTab = 'upgrade';

// Прокачка (7 карточек)
let upgrades = {
    office: 1, scouting: 1, reveal: 1, youth: 1,
    negotiator: 1, reputation: 1, media: 1
};

// Трансферы/ТО
let transferOffers = {};
let playerNegotiations = {}; // v1.0: объявлено наверху (было в середине файла — риск TDZ)
let activeCommissions = [];
let pendingClubReturn = [];
let poachedPlayersThisSeason = {};
let agencyPoachAttempts = {};
let closedAgencies = {};
let currentOffer = null;

// Фазы сезона
let seasonPhase = 'regular';
let transferPhaseWeeksLeft = 0;
const MID_TRANSFER_WEEKS = 6;
const OFF_TRANSFER_WEEKS = 12;
const RENEWAL_WEEKS_START = 48;
const RENEWAL_WEEKS_END = 52;

// Плей-офф
let playoffState = {};
let playoffRound = 0;

// Кубок Чемпионов
let worldCupState = null;
let standingsTab = 'table';
let currentStandingsLeague = null;
let championsHistory = {};
let clubSeasonPositions = {};
let presidentClubKey = null;
let clubHubTab = 'overview';
let clubCouncil = null;
let careerGoals = {};
let careerCounters = {
    poachSuccess: 0,
    poachFails: 0,
    clientsEverSigned: 0,
    trophiesTotal: 0,
    cupsWon: 0,
    newsCount: 0
};
let clubRosterFilter = 'all';
let seasonSchedule = {};
let expandedInfraCards = {};
let matchViewState = null;
let matchQueue = null;
let matchQueueOnFinish = null;
let matchQueueIdx = 0;

// XP
let agentXP = 0;
let agentLevel = 1;
const XP_THRESHOLDS = [0, 500, 1500, 4000, 10000, 25000, 60000, 150000, 400000, 1000000];

// NPC
let npcCooldownWeeks = 0;
let lostPlayerThisSeason = false;

// ============ СИСТЕМА СОБЫТИЙ И ЗАДАЧ ============
let activeTasks = [];
let eventCooldowns = {};
let eventHistory = [];
let weeklyEventCounter = 0;
let lastEventWeek = 0;
const EVENT_CHAINS = {};
let activeChains = [];
const MAX_EVENTS_PER_SEASON = 12;
const EVENT_MIN_COOLDOWN = 2;
const EVENT_MAX_COOLDOWN = 7;

// Пагинация
let currentPage = 1;
const ITEMS_PER_PAGE = 15;
let paginationCallback = null;

// Драфт
let draftData = { active: false, season: 0, pool: [], picks: [] };
let draftChoiceQueue = [];
let currentDraftChoice = null;

// Национальные турниры (ЧМ и Олимпиада)
let nationalTournament = null;
let nationalTournamentHistory = [];
let favoriteNationalTeam = null; // код сборной, за которую болеет игрок (например 'RU')
let datapackActive = false;      // активирован ли датапак с реальными данными
const TOURNAMENT_WEEKS = 5;
const WC_MIN_PLAYERS = 14;
const WC_ROSTER_SIZE = 25;

const NATIONAL_TEAMS = [
    { flag: '🇷🇺', name: 'Россия', code: 'RU' },
    { flag: '🇨🇦', name: 'Канада', code: 'CA' },
    { flag: '🇺🇸', name: 'США', code: 'US' },
    { flag: '🇸🇪', name: 'Швеция', code: 'SE' },
    { flag: '🇫🇮', name: 'Финляндия', code: 'FI' },
    { flag: '🇨🇿', name: 'Чехия', code: 'CZ' },
    { flag: '🇸🇰', name: 'Словакия', code: 'SK' },
    { flag: '🇩🇪', name: 'Германия', code: 'DE' },
    { flag: '🇨🇭', name: 'Швейцария', code: 'CH' },
    { flag: '🇧🇾', name: 'Беларусь', code: 'BY' },
    { flag: '🇰🇿', name: 'Казахстан', code: 'KZ' },
    { flag: '🇱🇻', name: 'Латвия', code: 'LV' }
];

// ============ СИСТЕМА ЦЕЛЕЙ КАРЬЕРЫ ============
const CAREER_GOALS = {
    agent: [
        { lvl: 1,  title: 'Подписать 1-го клиента',   desc: 'Найди первого игрока',           check: 'roster',       target: 1,   reward: { xp: 50 } },
        { lvl: 2,  title: '3 клиента',                desc: 'Начни собирать агентство',       check: 'roster',       target: 3,   reward: { money: 5000 } },
        { lvl: 3,  title: 'Продать клиента в ТО',     desc: 'Соверши первую сделку',           check: 'transfers',    target: 1,   reward: { xp: 100 } },
        { lvl: 4,  title: '5 клиентов',               desc: 'Небольшое агентство',              check: 'roster',       target: 5,   reward: { money: 20000 } },
        { lvl: 5,  title: 'Первый клиент в NHL',      desc: 'Выведи игрока в топ-лигу',        check: 'clients_in_nhl', target: 1, reward: { slot: 1 } },
        { lvl: 6,  title: '10 клиентов',              desc: 'Серьёзная команда',                check: 'roster',       target: 10,  reward: { money: 100000 } },
        { lvl: 7,  title: '3 клиента в NHL',          desc: 'Заяви о себе',                     check: 'clients_in_nhl', target: 3, reward: { rep: 2 } },
        { lvl: 8,  title: '15 клиентов',              desc: 'Крупное агентство',                 check: 'roster',       target: 15,  reward: { money: 500000 } },
        { lvl: 9,  title: '20 клиентов',              desc: 'Топ-агентство',                     check: 'roster',       target: 20,  reward: { slot: 2 } },
        { lvl: 10, title: '30 клиентов',              desc: 'Легенда агентского мира',          check: 'roster',       target: 30,  reward: { title: 'Мега-агент' } },
        { lvl: 11, title: '50 клиентов',              desc: 'Империя',                            check: 'roster',       target: 50,  reward: { money: 5000000 } },
        { lvl: 12, title: '100 клиентов',             desc: 'Бессмертие в истории',              check: 'roster',       target: 100, reward: { title: 'Легенда агентов' } }
    ],
    business: [
        { lvl: 1,  title: 'Первые $10K',              desc: 'Начни зарабатывать',                check: 'money',        target: 10000,   reward: { xp: 50 } },
        { lvl: 2,  title: '$50K',                     desc: 'Первый капитал',                    check: 'money',        target: 50000,   reward: { money: 5000 } },
        { lvl: 3,  title: '$100K',                    desc: 'Первая серьёзная сумма',            check: 'money',        target: 100000,  reward: { xp: 100 } },
        { lvl: 4,  title: 'Купить 5% акций',          desc: 'Попробуй биржу',                    check: 'portfolio_total', target: 5,    reward: { money: 10000 } },
        { lvl: 5,  title: '$500K',                    desc: 'Полумиллионер',                      check: 'money',        target: 500000,  reward: { money: 25000 } },
        { lvl: 6,  title: 'Купить 51% клуба',         desc: 'Стань президентом',                 check: 'has_president', target: 1,    reward: { xp: 500 } },
        { lvl: 7,  title: '$1M',                      desc: 'Миллионер',                          check: 'money',        target: 1000000, reward: { title: 'Миллионер' } },
        { lvl: 8,  title: '3 клуба в портфеле',       desc: 'Разные инвестиции',                 check: 'portfolio_count', target: 3, reward: { money: 100000 } },
        { lvl: 9,  title: '$10M',                     desc: 'Десять миллионов',                  check: 'money',        target: 10000000, reward: { money: 500000 } },
        { lvl: 10, title: '$50M',                     desc: 'Финансовый гигант',                 check: 'money',        target: 50000000, reward: { title: 'Магнат' } },
        { lvl: 11, title: '$100M',                    desc: 'Сто миллионов',                     check: 'money',        target: 100000000, reward: { title: 'Империя' } },
        { lvl: 12, title: '$1B',                      desc: 'Миллиардер',                        check: 'money',        target: 1000000000, reward: { title: 'Финансовый бессмертный' } }
    ],
    legend: [
        { lvl: 1,  title: 'Первый гол клиента',       desc: 'Твой игрок забил',                   check: 'client_goals', target: 1,  reward: { xp: 50 } },
        { lvl: 2,  title: 'Первый трофей клиента',    desc: 'Чемпионство игрока',                 check: 'trophies_total', target: 1, reward: { money: 10000 } },
        { lvl: 3,  title: 'Клиент в топ-10 лиги',     desc: 'Игрок в лидерах',                    check: 'client_top10', target: 1, reward: { xp: 100 } },
        { lvl: 4,  title: 'Первый Кубок',             desc: 'Твой клиент взял Кубок',            check: 'cups_won',     target: 1,  reward: { money: 100000 } },
        { lvl: 5,  title: '3 трофея',                 desc: 'Коллекция трофеев',                  check: 'trophies_total', target: 3, reward: { money: 200000 } },
        { lvl: 6,  title: 'Клиент 90+ рейтинг',       desc: 'Топ-звезда',                          check: 'client_90',    target: 1,  reward: { money: 500000 } },
        { lvl: 7,  title: '5 Кубков',                 desc: 'Пятикратный обладатель',            check: 'cups_won',     target: 5,  reward: { money: 1000000 } },
        { lvl: 8,  title: '8 трофеев',                desc: 'Серьёзная коллекция',               check: 'trophies_total', target: 8, reward: { slot: 1 } },
        { lvl: 9,  title: '10 трофеев',               desc: 'Трофейщик',                          check: 'trophies_total', target: 10, reward: { title: 'Трофейщик' } },
        { lvl: 10, title: '5 клиентов с 1000+ игр',   desc: 'Долгожители',                        check: 'clients_1000games', target: 5, reward: { money: 2000000 } },
        { lvl: 11, title: '20 трофеев',               desc: 'Зал славы клуба',                   check: 'trophies_total', target: 20, reward: { title: 'Хранитель трофеев' } },
        { lvl: 12, title: '50 трофеев',               desc: 'Бессмертие в Зале славы',            check: 'trophies_total', target: 50, reward: { title: 'Легенда хоккея' } }
    ],
    intrigue: [
        { lvl: 1,  title: 'Первая попытка переманить', desc: 'Попробуй отнять игрока',             check: 'poach_attempts', target: 1,  reward: { xp: 50 } },
        { lvl: 2,  title: 'Первое удачное переманивание', desc: 'Уведи клиента',                 check: 'poach_success', target: 1,  reward: { money: 10000 } },
        { lvl: 3,  title: 'Переманить у среднего',    desc: 'Победи крепкое агентство',           check: 'poach_success', target: 3,  reward: { xp: 100 } },
        { lvl: 4,  title: 'Закрыть 1 агентство',      desc: 'Напугай конкурента',                 check: 'closed_agencies', target: 1, reward: { money: 20000 } },
        { lvl: 5,  title: '5 переманиваний',          desc: 'Опытный охотник',                    check: 'poach_success', target: 5,  reward: { rep: 1 } },
        { lvl: 6,  title: '10 переманиваний',         desc: 'Настоящий хищник',                   check: 'poach_success', target: 10, reward: { money: 500000 } },
        { lvl: 7,  title: 'Закрыть 5 агентств',       desc: 'Гроза конкурентов',                  check: 'closed_agencies', target: 5, reward: { title: 'Хищник' } },
        { lvl: 8,  title: 'Переманить у топ-агентства', desc: 'Победи топ-3',                     check: 'poach_top',    target: 1,  reward: { slot: 1 } },
        { lvl: 9,  title: '25 переманиваний',         desc: 'Мастер интриг',                      check: 'poach_success', target: 25, reward: { title: 'Тень' } },
        { lvl: 10, title: 'Закрыть 15 агентств',      desc: 'Уничтожитель',                       check: 'closed_agencies', target: 15, reward: { money: 5000000 } },
        { lvl: 11, title: '#1 в рейтинге агентов',    desc: 'Стань первым',                        check: 'top_agent_rank', target: 1, reward: { title: 'Крёстный отец' } },
        { lvl: 12, title: 'Разорить 50 агентств',     desc: 'Император интриг',                   check: 'closed_agencies', target: 50, reward: { title: 'Император интриг' } }
    ],
    mentor: [
        { lvl: 1,  title: 'Первый юниор',             desc: 'Подпиши клиента 14-17 лет',          check: 'roster_youth', target: 1,  reward: { xp: 50 } },
        { lvl: 2,  title: 'Довести юниора до 50',     desc: 'Первый рост',                        check: 'young_reached_50', target: 1, reward: { money: 10000 } },
        { lvl: 3,  title: '3 юниора',                 desc: 'Ставка на молодость',                check: 'roster_youth', target: 3,  reward: { xp: 100 } },
        { lvl: 4,  title: 'Юниор до 70',              desc: 'Талант раскрылся',                   check: 'young_reached_70', target: 1, reward: { money: 50000 } },
        { lvl: 5,  title: '5 юниоров',                desc: 'Академия',                           check: 'roster_youth', target: 5,  reward: { slot: 1 } },
        { lvl: 6,  title: 'Юниор до NHL',             desc: 'Пробился в топ',                     check: 'young_in_nhl', target: 1, reward: { money: 200000 } },
        { lvl: 7,  title: '10 юниоров',               desc: 'Школа талантов',                     check: 'roster_youth', target: 10, reward: { title: 'Наставник' } },
        { lvl: 8,  title: '5 юниоров 80+',            desc: 'Кузница звёзд',                      check: 'young_80_count', target: 5, reward: { money: 1000000 } },
        { lvl: 9,  title: 'Юниор 90+',                desc: 'Мировая звезда',                     check: 'young_reached_90', target: 1, reward: { money: 2000000 } },
        { lvl: 10, title: '15 юниоров',               desc: 'Легендарный тренер',                 check: 'roster_youth', target: 15, reward: { title: 'Воспитатель' } },
        { lvl: 11, title: '5 юниоров в NHL',          desc: 'Они все выросли',                    check: 'young_in_nhl', target: 5, reward: { money: 5000000 } },
        { lvl: 12, title: '20 юниоров в NHL',         desc: 'Создатель звёзд',                    check: 'young_in_nhl', target: 20, reward: { title: 'Создатель' } }
    ],
    globalist: [
        { lvl: 1,  title: '2 страны в агентстве',     desc: 'Интернационал',                      check: 'countries_count', target: 2,  reward: { xp: 50 } },
        { lvl: 2,  title: '3 страны',                 desc: 'Дружба народов',                     check: 'countries_count', target: 3,  reward: { money: 10000 } },
        { lvl: 3,  title: '5 стран',                  desc: 'Международный охват',                check: 'countries_count', target: 5,  reward: { xp: 100 } },
        { lvl: 4,  title: '3 лиги',                   desc: 'Работаешь в разных',                 check: 'leagues_count',   target: 3,  reward: { money: 30000 } },
        { lvl: 5,  title: '8 стран',                  desc: 'Глобальное агентство',               check: 'countries_count', target: 8,  reward: { rep: 1 } },
        { lvl: 6,  title: '10 стран',                 desc: 'Космополит',                          check: 'countries_count', target: 10, reward: { money: 200000 } },
        { lvl: 7,  title: '5 лиг',                    desc: 'Универсал',                          check: 'leagues_count',   target: 5,  reward: { title: 'Интернационал' } },
        { lvl: 8,  title: '15 стран',                 desc: 'Мировая карта',                      check: 'countries_count', target: 15, reward: { money: 500000 } },
        { lvl: 9,  title: '8 лиг',                    desc: 'Полный охват',                       check: 'leagues_count',   target: 8,  reward: { money: 1000000 } },
        { lvl: 10, title: '20 стран',                 desc: 'Легенда мира',                       check: 'countries_count', target: 20, reward: { title: 'Глобус' } },
        { lvl: 11, title: 'Все 13 лиг',               desc: 'Абсолютный охват',                   check: 'leagues_count',   target: 13, reward: { money: 5000000 } },
        { lvl: 12, title: '25 стран',                 desc: 'Всемирное признание',                check: 'countries_count', target: 25, reward: { title: 'Космополит' } }
    ],
    media: [
        { lvl: 1,  title: 'Первая новость',           desc: 'О тебе написали',                    check: 'news_count', target: 1,   reward: { xp: 50 } },
        { lvl: 2,  title: '10 новостей',              desc: 'Заметили',                           check: 'news_count', target: 10,  reward: { money: 5000 } },
        { lvl: 3,  title: '30 новостей',              desc: 'В прессе',                            check: 'news_count', target: 30,  reward: { xp: 100 } },
        { lvl: 4,  title: '50 новостей',              desc: 'Постоянно в медиа',                  check: 'news_count', target: 50,  reward: { money: 30000 } },
        { lvl: 5,  title: '100 новостей',             desc: 'Медиа-фигура',                       check: 'news_count', target: 100, reward: { money: 100000 } },
        { lvl: 6,  title: 'Скандал в прессе',         desc: 'Плохой пиар — тоже пиар',            check: 'news_negative', target: 1, reward: { xp: 200 } },
        { lvl: 7,  title: '200 новостей',             desc: 'Легенда медиа',                      check: 'news_count', target: 200, reward: { title: 'Медиа-агент' } },
        { lvl: 8,  title: '5 скандалов',              desc: 'Скандалист',                          check: 'news_negative', target: 5, reward: { money: 500000 } },
        { lvl: 9,  title: '500 новостей',             desc: 'Медиа-империя',                      check: 'news_count', target: 500, reward: { money: 2000000 } },
        { lvl: 10, title: '10 скандалов',             desc: 'Мастер эпатажа',                     check: 'news_negative', target: 10, reward: { title: 'Скандалист' } },
        { lvl: 11, title: '800 новостей',             desc: 'Икона',                               check: 'news_count', target: 800, reward: { money: 5000000 } },
        { lvl: 12, title: '1000 новостей',            desc: 'Медиа-бессмертие',                    check: 'news_count', target: 1000, reward: { title: 'Икона медиа' } }
    ],
    president: [
        { lvl: 1,  title: 'Стать президентом',        desc: 'Первый клуб',                         check: 'has_president', target: 1,  reward: { xp: 100 } },
        { lvl: 2,  title: 'Первый сезон в клубе',     desc: 'Отыграй сезон',                       check: 'seasons_as_president', target: 1, reward: { money: 50000 } },
        { lvl: 3,  title: 'Инфраструктура 10+',       desc: 'Средний уровень',                    check: 'infra_avg',    target: 10, reward: { money: 100000 } },
        { lvl: 4,  title: 'Инфраструктура 12+',       desc: 'Прокачка идёт',                       check: 'infra_avg',    target: 12, reward: { money: 300000 } },
        { lvl: 5,  title: 'Клуб в топ-4 лиги',        desc: 'Попадание в топ',                    check: 'club_top4',    target: 1,  reward: { money: 500000 } },
        { lvl: 6,  title: 'Инфраструктура 15+',       desc: 'Серьёзная прокачка',                  check: 'infra_avg',    target: 15, reward: { title: 'Рулевой' } },
        { lvl: 7,  title: 'Кубок с клубом',           desc: 'Приведи к титулу',                     check: 'club_titles',  target: 1,  reward: { money: 2000000 } },
        { lvl: 8,  title: 'Инфраструктура 20+',       desc: 'Топ-инфраструктура',                  check: 'infra_avg',    target: 20, reward: { money: 5000000 } },
        { lvl: 9,  title: '3 Кубка с клубом',         desc: 'Династия',                            check: 'club_titles',  target: 3,  reward: { title: 'Хозяин' } },
        { lvl: 10, title: 'Инфраструктура 25',        desc: 'Максимум',                            check: 'infra_avg',    target: 25, reward: { money: 10000000 } },
        { lvl: 11, title: '5 Кубков',                 desc: 'Легендарный президент',               check: 'club_titles',  target: 5,  reward: { title: 'Династия' } },
        { lvl: 12, title: '10 Кубков',                desc: 'Император льда',                      check: 'club_titles',  target: 10, reward: { title: 'Император льда' } }
    ]
};

const GOAL_BRANCH_NAMES = {
    agent:     { icon: '🏒', name: 'Агент',      desc: 'Про игроков' },
    business:  { icon: '💰', name: 'Делец',      desc: 'Про деньги' },
    legend:    { icon: '🏆', name: 'Легенда',    desc: 'Про трофеи' },
    intrigue:  { icon: '🎭', name: 'Интриган',   desc: 'Про переманивание' },
    mentor:    { icon: '🎓', name: 'Наставник',  desc: 'Про молодёжь' },
    globalist: { icon: '🌍', name: 'Глобалист',  desc: 'Про страны и лиги' },
    media:     { icon: '📺', name: 'Медиа',      desc: 'Про прессу' },
    president: { icon: '🏛️', name: 'Президент',  desc: 'Про клубы' }
};

// ============ 3. БАЗА ЛИГ ============
export const LEAGUE_DATA = {
    "NHL": { country:"🇺🇸 США",group:"Северная Америка",min:60,max:99,playoffSpots:4,divisions:[
        {name:"Восточная • Атлантический",clubs:["Boston Bruins","Buffalo Sabres","Detroit Red Wings","Florida Panthers","Montreal Canadiens","Ottawa Senators","Tampa Bay Lightning","Toronto Maple Leafs"]},
        {name:"Восточная • Столичный",clubs:["Carolina Hurricanes","Columbus Blue Jackets","New Jersey Devils","New York Islanders","New York Rangers","Philadelphia Flyers","Pittsburgh Penguins","Washington Capitals"]},
        {name:"Западная • Центральный",clubs:["Chicago Blackhawks","Colorado Avalanche","Dallas Stars","Minnesota Wild","Nashville Predators","St. Louis Blues","Utah Mammoth","Winnipeg Jets"]},
        {name:"Западная • Тихоокеанский",clubs:["Anaheim Ducks","Calgary Flames","Edmonton Oilers","Los Angeles Kings","San Jose Sharks","Seattle Kraken","Vancouver Canucks","Vegas Golden Knights"]}]},
    "AHL": { country:"🇺🇸 США",group:"Северная Америка",min:45,max:80,playoffSpots:4,divisions:[
        {name:"Восточная • Атлантический",clubs:["Charlotte Checkers","Hartford Wolf Pack","Hershey Bears","Lehigh Valley Phantoms","Providence Bruins","Springfield Thunderbirds","Wilkes-Barre Scranton Penguins","Cleveland Monsters"]},
        {name:"Восточная • Северный",clubs:["Belleville Senators","Hamilton Hammers","Laval Rocket","Rochester Americans","Syracuse Crunch","Toronto Marlies","Utica Comets","Tucson Roadrunners"]},
        {name:"Западная • Центральный",clubs:["Chicago Wolves","Grand Rapids Griffins","Iowa Wild","Manitoba Moose","Milwaukee Admirals","Rockford IceHogs","Texas Stars","Colorado Eagles"]},
        {name:"Западная • Тихоокеанский",clubs:["Abbotsford Canucks","Bakersfield Condors","Calgary Wranglers","Coachella Valley Firebirds","Henderson Silver Knights","Ontario Reign","San Diego Gulls","San Jose Barracuda"]}]},
    "KHL": { country:"🇷🇺 Россия",group:"Россия",min:55,max:92,playoffSpots:8,divisions:[
        {name:"Западная конференция",clubs:["СКА","Спартак","Торпедо","Лада","Сочи","Динамо Минск","ЦСКА","Динамо Москва","Локомотив","Северсталь","Шанхайские Драконы"]},
        {name:"Восточная конференция",clubs:["Ак Барс","Автомобилист","Нефтехимик","Металлург Магнитогорск","Трактор","Авангард","Амур","Адмирал","Барыс","Салават Юлаев","Сибирь"]}]},
    "VHL": { country:"🇷🇺 Россия",group:"Россия",min:30,max:68,playoffSpots:16,divisions:[
        {name:"Всероссийская хоккейная лига",clubs:["АКМ Тула","Барс Казань","Буран Воронеж","Горняк-УГМК","Дизель Пенза","Динамо-Алтай","Динамо СПб","Зауралье","Звезда Москва","Ижсталь","Кристалл Саратов","Магнитка","Металлург Новокузнецк","Молот","Нефтяник Альметьевск","Олимпия","Омские Крылья","Ростов","Рубин Тюмень","Рязань-ВДВ","СКА-ВМФ","Сокол Красноярск","Торос","ХК Калуга","ХК Норильск","ХК Тамбов","Химик","ЦСКВВС","Челны","Челмет","Югра","Южный Урал"]}]},
    "MHL": { country:"🇷🇺 Россия",group:"Россия",min:5,max:60,playoffSpots:8,divisions:[
        {name:"Западная конференция",clubs:["Академия Михайлова","Академия СКА","Алмаз","Амурские Тигры","Динамо-Шинник","Красная Армия","Красная машина Атлант","Красная машина Юниор","Крылья Советов","Локо","МХК Динамо-Москва","МХК Динамо СПб","МХК Спартак","МХК Спартак МАХ","Сахалинские Акулы","СКА-1946","Тайфун"]},
        {name:"Восточная конференция",clubs:["Авто","АКМ-Юниор","Белые Медведи","Ирбис","Красноярские Рыси","Кузнецкие Медведи","Локо-76","Мамонты Югры","МХК Молот","Омские Ястребы","Реактор","Сибирские Снайперы","Снежные Барсы","Спутник","Стальные Лисы","Толпар","Чайка"]}]},
    "Belarus_Extraliga": { country:"🇧🇾 Беларусь",group:"Беларусь",min:35,max:75,playoffSpots:8,divisions:[
        {name:"Betera-Экстралига",clubs:["Металлург Жлобин","Славутич Смоленск","Юность Минск","Шахтер Солигорск","Витебск","Лида","Гомель","Неман Гродно","Динамо-Молодечно","Брест","Химик Новополоцк","Локомотив Орша","Могилев","Авиатор Барановичи"]}]},
    "Belarus_Vysshaya": { country:"🇧🇾 Беларусь",group:"Беларусь",min:3,max:55,playoffSpots:8,divisions:[
        {name:"Betera-Высшая лига",clubs:["Динамо-Олимпик","Пинские ястребы","Белсталь","Рыси Гомель","Рыцари Лида","Юниор Минск","Локо Орша","Прогресс Гродно","Медведи Витебск","Нефтехимик Новополоцк","Днепровские Львы","Зубры"]}]},
    "SHL": { country:"🇸🇪 Швеция",group:"Европа",min:55,max:90,playoffSpots:8,divisions:[
        {name:"Swedish Hockey League",clubs:["Brynäs IF","Djurgårdens IF","Färjestads BK","Frölunda HC","HV71","IF Björklöven","IF Malmö Redhawks","Linköping HC","Luleå HF","Örebro HK","Rögle BK","Skellefteå AIK","Timrå IK","Växjö Lakers"]}]},
    "Liiga": { country:"🇫🇮 Финляндия",group:"Европа",min:45,max:85,playoffSpots:8,divisions:[
        {name:"Liiga",clubs:["Tappara Tampere","KooKoo Kouvola","SaiPa Lappeenranta","Ilves Tampere","JYP Jyväskylä","Lukko Rauma","KalPa Kuopio","Ässät Pori","Kiekko-Espoo","HIFK Helsinki","Pelicans","HPK Hämeenlinna","TPS Turku","Kärpät","Jukurit Mikkeli","Sport Vaasa"]}]},
    "Czech_Extraliga": { country:"🇨🇿 Чехия",group:"Европа",min:45,max:83,playoffSpots:8,divisions:[
        {name:"Tipsport Extraliga",clubs:["Bílí Tygři Liberec","BK Mladá Boleslav","HC Dynamo Pardubice","HC Energie Karlovy Vary","HC Kometa Brno","HC Litvínov","HC Motor České Budějovice","HC Oceláři Třinec","HC Olomouc","HC Škoda Plzeň","HC Sparta Praha","HC Vítkovice Ridera","Mountfield HK","HC Dukla Jihlava"]}]},
    "DEL": { country:"🇩🇪 Германия",group:"Европа",min:40,max:80,playoffSpots:8,divisions:[
        {name:"DEL",clubs:["Adler Mannheim","Eisbären Berlin","Augsburger Panther","Grizzlys Wolfsburg","Dresdner Eislöwen","Iserlohn Roosters","ERC Ingolstadt","Kölner Haie","Löwen Frankfurt","Nürnberg Ice Tigers","Red Bull München","Fischtown Pinguins","Schwenninger Wild Wings","Straubing Tigers"]}]},
    "NL_Switzerland": { country:"🇨🇭 Швейцария",group:"Европа",min:50,max:88,playoffSpots:8,divisions:[
        {name:"National League",clubs:["HC Davos","Fribourg-Gottéron","ZSC Lions","Genève-Servette","HC Lugano","Lausanne HC","Rapperswil-Jona Lakers","EV Zug","SC Bern","EHC Biel","SCL Tigers","EHC Kloten","HC Ambrì-Piotta","HC Ajoie"]}]},
    "ICE_HL": { country:"🇦🇹 Австрия",group:"Европа",min:35,max:72,playoffSpots:2,divisions:[
        {name:"ICE Hockey League",clubs:["Red Bull Salzburg","KAC Klagenfurt","Graz 99ers"]}]}
};

const LEAGUE_NAMES = {
    "NHL":"NHL","AHL":"AHL","KHL":"КХЛ","VHL":"ВХЛ","MHL":"МХЛ",
    "Belarus_Extraliga":"Экстралига","Belarus_Vysshaya":"Высшая лига",
    "SHL":"SHL","Liiga":"Liiga","Czech_Extraliga":"Extraliga",
    "DEL":"DEL","NL_Switzerland":"National League","ICE_HL":"ICE HL"
};

// Правильно разбивает ключ вида "Belarus_Vysshaya_Прогресс Гродно" на лигу и клуб.
// Учитывает лиги с "_" в названии. Возвращает { lk, club } или null.
function splitClubKey(key) {
    if (!key || typeof key !== 'string') return null;
    const leagueKeys = Object.keys(LEAGUE_DATA).sort((a, b) => b.length - a.length);
    for (const lk of leagueKeys) {
        if (key === lk) return { lk, club: '' };
        if (key.startsWith(lk + '_')) {
            return { lk, club: key.substring(lk.length + 1) };
        }
    }
    // Fallback для неизвестных лиг
    const idx = key.indexOf('_');
    if (idx < 0) return null;
    return { lk: key.substring(0, idx), club: key.substring(idx + 1) };
}

// Возвращает локализованное название лиги
function getLeagueName(lk) {
    if (!lk) return '';
    const n = LEAGUE_NAMES[lk] || lk;
    return LANG.t(n);
}

const TEAM_LOGOS_EXCEPTIONS = {
    "ЦСКА": "cska","Нефтехимик": "neftekimik",
    "Шанхайские Драконы": "shanghai-dragons",
    "Динамо Минск": "dynamo-minsk","Динамо Москва": "dynamo-moscow",
    "Динамо-Молодечно": "dynamo-molodechno","Динамо-Олимпик": "dynamo-olimpik",
    "Шахтер Солигорск": "shakhter-soligorsk",
    "Нефтехимик Новополоцк": "neftekimik-novopolotsk",
    "ЦСКВВС": "csk-vvs","Южный Урал": "ural-orck",
    "ХК Тамбов": "hk-tambov","ХК Норильск": "hk-norilsk","ХК Калуга": "hk-kaluga"
};

const TRANSLIT_MAP = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y',
    'к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f',
    'х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
    'є':'ie','і':'i','ї':'i','ґ':'g','ў':'u','ә':'a','ғ':'g','қ':'k','ң':'n','ө':'o','ұ':'u','ү':'u',
    'һ':'h','à':'a','á':'a','â':'a','ä':'a','å':'a','ã':'a','ą':'a','æ':'ae','ç':'c','č':'c',
    'ć':'c','è':'e','é':'e','ê':'e','ë':'e','ě':'e','ę':'e','ē':'e','ė':'e','ğ':'g','ģ':'g',
    'ì':'i','í':'i','î':'i','ï':'i','ī':'i','į':'i','ı':'i','ł':'l','ĺ':'l','ľ':'l','ļ':'l',
    'ñ':'n','ń':'n','ň':'n','ņ':'n','ò':'o','ó':'o','ô':'o','ö':'o','õ':'o','ø':'o','ő':'o',
    'ō':'o','ř':'r','ŕ':'r','ś':'s','š':'s','ş':'s','ș':'s','ť':'t','ț':'t','ţ':'t','ù':'u',
    'ú':'u','û':'u','ü':'u','ů':'u','ū':'u','ų':'u','ý':'y','ÿ':'y','ž':'z','ź':'z','ż':'z',
    'þ':'th','ð':'d','ß':'ss'
};

function transliterate(str) {
    return str.toLowerCase().split('').map(ch => TRANSLIT_MAP[ch] !== undefined ? TRANSLIT_MAP[ch] : ch).join('');
}

export function generateLogoSlug(club) {
    // Если активен режим фейковых названий — берём реальное имя для slug.
    // Так логотип "Boston Bears" найдётся как boston-bruins.
    const reverse = (typeof window !== 'undefined') ? window.TEAM_RENAMES_REVERSE : null;
    const realName = (reverse && reverse[club]) ? reverse[club] : club;

    if (TEAM_LOGOS_EXCEPTIONS[realName]) return TEAM_LOGOS_EXCEPTIONS[realName];
    if (TEAM_LOGOS_EXCEPTIONS[club]) return TEAM_LOGOS_EXCEPTIONS[club];

    return transliterate(realName).replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
}

function getTeamLogoHTML(club, leagueKey) {
    // Датапак подменяет рендер логотипов (реальные PNG вместо SVG-щитов).
    if (typeof window.__teamLogoRenderer === 'function') return window.__teamLogoRenderer(club, leagueKey);
    let hash = 0;
    for (let i=0;i<club.length;i++){hash=club.charCodeAt(i)+((hash<<5)-hash);hash=hash&hash;}
    const color = `hsl(${Math.abs(hash)%360},55%,32%)`;
    const clean = club.replace(/[^\wА-Яа-яЁё\s-]/g,' ').trim();
    const words = clean.split(/[\s-]+/).filter(w=>w.length>0);
    const initials = words.length===1 ? words[0].substring(0,2).toUpperCase() : words.slice(0,3).map(w=>w[0]).join('').toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 44"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}"/><stop offset="100%" stop-color="${color}" stop-opacity="0.65"/></linearGradient></defs><path d="M2 2 L38 2 L38 26 Q38 40 20 42 Q2 40 2 26 Z" fill="url(#g)" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/><text x="20" y="27" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="13" fill="white">${initials}</text></svg>`;
    const fallback = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    // v1.0: единый источник логотипов — SVG-щит генерируется локально (быстро, без сети).
    // Реальные PNG-логотипы (датапак) подключаются поверх в datapack.js.
    return `<img class="team-logo-img" src="${fallback}" alt="${club}" />`;
}

// ============ 4. КОНСТАНТЫ ЭКОНОМИКИ ============
const UPGRADE_CARDS = {
    office:      { icon:'🏢', name:'Офис',         desc:'Слоты для клиентов',       baseCost:2000 },
    scouting:    { icon:'🔍', name:'Скаутинг',     desc:'Рейтинг доступных игроков',baseCost:3000 },
    reveal:      { icon:'🧬', name:'Раскрытие',    desc:'Видеть потенциал',         baseCost:5000 },
    youth:       { icon:'👶', name:'Молодёжь',     desc:'Мин. возраст клиентов',    baseCost:4000 },
    negotiator:  { icon:'🤝', name:'Переговорщик', desc:'Торговля и скидки',        baseCost:2500 },
    reputation:  { icon:'⭐', name:'Репутация',    desc:'Переманивание',            baseCost:1500 },
    media:       { icon:'📺', name:'Медиа',        desc:'Клубы сами приходят',      baseCost:2000 },
    trainer:     { icon:'🏋️', name:'Личный тренер',desc:'Шанс успеха тренировок',   baseCost:6000 }
};

// ============ ПРИЗОВЫЕ ЗА ТРОФЕИ ============
const LEAGUE_PRIZE_BUDGETS = {
    "NHL": 100000000, "AHL": 15000000, "KHL": 30000000, "VHL": 3000000,
    "MHL": 500000, "Belarus_Extraliga": 5000000, "Belarus_Vysshaya": 500000,
    "SHL": 20000000, "Liiga": 15000000, "Czech_Extraliga": 12000000,
    "DEL": 15000000, "NL_Switzerland": 25000000, "ICE_HL": 8000000
};

function getLeaguePrize(lk, multiplier) {
    const b = LEAGUE_PRIZE_BUDGETS[lk] || 1000000;
    return Math.round(b * multiplier);
}

// ============ КАРТОЧКИ ПРОКАЧКИ КЛУБА ============
const CLUB_UPGRADE_CARDS = {
    stadium:   { icon:'🏟', name:'Стадион',       desc:'Вместимость и дом. бонус' },
    marketing: { icon:'📣', name:'Маркетинг',     desc:'Спонсоры и доход' },
    medical:   { icon:'🏥', name:'Медцентр',      desc:'Снижение травм' },
    training:  { icon:'💪', name:'Тренировки',    desc:'Рост игроков' },
    scouting:  { icon:'🔍', name:'Скаутинг',      desc:'Качество новичков' },
    academy:   { icon:'👶', name:'Академия',      desc:'Потенциал молодёжи' }
};

function getLeagueBaseCost(lk) {
    const budgets = {"NHL":100000000,"AHL":15000000,"KHL":30000000,"VHL":3000000,"MHL":500000,
        "Belarus_Extraliga":5000000,"Belarus_Vysshaya":500000,"SHL":20000000,"Liiga":15000000,
        "Czech_Extraliga":12000000,"DEL":15000000,"NL_Switzerland":25000000,"ICE_HL":8000000};
    const b = budgets[lk] || 1000000;
    return Math.max(50, Math.round(b / 40000));
}

function clubUpgradeCost(cardKey, level, lk) {
    return Math.round(getLeagueBaseCost(lk) * Math.pow(level, 2.3));
}

function generateClubUpgrades(prestige) {
    const base = Math.max(1, Math.min(15, Math.round(prestige / 7)));
    const noise = () => Math.max(1, Math.min(15, base + randomInt(-1, 1)));
    return {
        stadium:   noise(),
        marketing: noise(),
        medical:   noise(),
        training:  noise(),
        scouting:  noise(),
        academy:   noise()
    };
}

// ============ ЭФФЕКТЫ КАРТОЧЕК (формулы) ============
function getStadiumCapacity(lvl) { return 5000 + lvl * 2500; }
function getStadiumHomeBonus(lvl) { return 0.02 + (lvl - 1) * 0.0045; }
function getMarketingSponsors(lvl) { return 1 + Math.floor(lvl / 3); }
function getMarketingMultiplier(lvl) { return 1 + (lvl - 1) * 0.10; }
function getMedicalInjuryReduction(lvl) { return (lvl - 1) * 0.025; }
function getMedicalRecoveryWeeks(lvl) { return lvl >= 20 ? 2 : lvl >= 10 ? 1 : 0; }
function getTrainingGrowthBonus(lvl) { return 1 + (lvl - 1) * 0.025; }
function getScoutingMinRating(lvl) { return 40 + Math.round((lvl - 1) * 0.75); }
function getScoutingTalentChance(lvl) { return 0.05 + (lvl - 1) * 0.0083; }
function getAcademyPotentialBonus(lvl) { return Math.round((lvl - 1) * 0.4); }

function getClubUpgradesTotal(club) {
    const u = club.upgrades || {};
    return Object.keys(CLUB_UPGRADE_CARDS).reduce((s, k) => s + (u[k] || 1), 0);
}
function getClubUpgradesAvg(club) {
    return (getClubUpgradesTotal(club) / 6).toFixed(1);
}
function getClubSalaryLoad(club) {
    const ps = players.filter(p => p.club === club.club && p.league === club.league);
    const totalSal = ps.reduce((s, p) => s + p.salary, 0) * 1000;
    if (club.budget <= 0) return totalSal > 0 ? 100 : 0;
    return Math.min(999, Math.round((totalSal / Math.max(1, club.budget)) * 100));
}

function upgradeCost(cardKey, level) {
    return Math.round(UPGRADE_CARDS[cardKey].baseCost * Math.pow(level, 2.5));
}
function weeklyCostForCard(cardKey) {
    const lvl = upgrades[cardKey];
    return Math.round((Math.pow(lvl, 2.0) - 1) * 20);
}
function totalWeeklyCost() {
    let sum = 0;
    for (const key of Object.keys(upgrades)) sum += weeklyCostForCard(key);
    sum += getTrainerWeeklyCost(); // зарплата личного тренера
    return sum;
}
function getSlots() { return 5 + upgrades.office; }
function getMaxRatingVisible() { return 30 + Math.round((upgrades.scouting - 1) * 2.9); }
// Возвращает ширину "погрешности" (±X очков) для потенциала.
// Ур. 1: ±25 (очень широко)
// Ур. 10: ±14
// Ур. 20: ±5
// Ур. 25: 0 (точное значение)
function getRevealRange() {
    if (upgrades.reveal >= 25) return 0; // 25 уровень — идеальное знание
    return Math.round(25 - (upgrades.reveal - 1) * 0.85);
}
function getMinAge() { return 18 - Math.floor((upgrades.youth - 1) / 5); }
function getTradeBonus() { return (upgrades.negotiator - 1) * 0.03; }
function getDiscountBonus() { return (upgrades.negotiator - 1) * 0.01; }
function getSignRefusalChance() { return Math.max(0, 0.60 - (upgrades.reputation - 1) * 0.025); }
function getMediaMultiplier() { return 1.0 + (upgrades.media - 1) * 0.08; }

// ============ ЛИЧНЫЙ ТРЕНЕР ============
// Шанс успеха индивидуальной тренировки: ур.1 → 50%, ур.10 → 90%, ур.20+ → 100% (макс 95%)
function getTrainerSuccessChance() {
    return Math.min(0.95, 0.50 + (upgrades.trainer - 1) * 0.05);
}
// Еженедельная зарплата тренера (добавляется в totalWeeklyCost)
function getTrainerWeeklyCost() { return Math.round(100 + Math.pow(upgrades.trainer, 1.7) * 12); }
// Стоимость одной индивидуальной тренировки клиента
const TRAINING_COST = 50000;
// Длительность тренировки в неделях
const TRAINING_WEEKS = 2;

// ============ СКАУТИНГ: БАЗА ТАЛАНТОВ ============
// Сколько игроков генерируют скауты за одно ТО: 1-7 ур. — 1, 8-15 — 2, 16-23 — 3 и т.д.
function getScoutedPlayersPerWindow() { return 1 + Math.floor(upgrades.scouting / 8); }
// Базовый рейтинг и потенциал генерируемых талантов зависят от уровня Скаутинга
function getScoutingRatingRange() {
    const s = upgrades.scouting;
    const baseMin = Math.min(55, 15 + Math.round(s * 1.4));        // ур.1 → 16, ур.25 → 50
    const baseMax = Math.min(88, 30 + Math.round(s * 2.2));        // ур.1 → 32, ур.25 → 85
    return { min: baseMin, max: baseMax };
}
// Стартовая лояльность отсканенных игроков: ур.1 → 60, ур.25 → 95
function getScoutedLoyalty() { return Math.min(95, 55 + Math.round(upgrades.scouting * 1.5)); }

// Генерация талантов — вызывается автоматически при старте каждого ТО (бесплатно)
function generateScoutedPlayers() {
    const count = getScoutedPlayersPerWindow();
    const range = getScoutingRatingRange();
    const posTemplate = ["C","C","LW","RW","D","D","G"];
    const created = [];
    const usedNames = new Set(players.map(p => p && p.name).filter(Boolean));
    for (let i = 0; i < count; i++) {
        const rating = Math.max(1, Math.min(99, randomInt(range.min, range.max)));
        // Лига подбирается под рейтинг: сильные таланты — сразу из взрослых лиг,
        // иначе getClubsForPlayer не найдёт им ни одного клуба
        let leagues;
        if (rating >= 70) leagues = ['KHL','SHL','Liiga','Czech_Extraliga','DEL','NL_Switzerland','AHL','VHL','Belarus_Extraliga','ICE_HL'];
        else if (rating >= 55) leagues = ['VHL','VHL','KHL','SHL','Liiga','Czech_Extraliga','DEL','Belarus_Extraliga','ICE_HL','AHL'];
        else if (rating >= 38) leagues = ['MHL','VHL','Belarus_Vysshaya','Belarus_Extraliga','ICE_HL','Liiga','DEL'];
        else leagues = ['MHL','MHL','Belarus_Vysshaya','VHL'];
        const ln = randomChoice(leagues);
        const pos = randomChoice(posTemplate);
        // Потенциал выше рейтинга; на высоком скаутинге — звёзды с высоким потолком
        const potMin = rating + Math.round(upgrades.scouting / 3);
        const potential = Math.min(99, Math.max(rating, potMin + randomInt(0, 20)));
        const age = randomInt(Math.max(16, getMinAge()), 21);
        const { name, nationality } = generatePlayerName(ln);
        const p = createPlayer(name, '', ln, pos, age, rating, potential, nationality);
        p.name = makeUniqueName(p.name, ln, usedNames);
        p.club = '';
        p.isScouted = true;
        p.loyalty = getScoutedLoyalty(); // повышенная лояльность — скауты наладили контакт
        players.push(p);
        created.push(p);
    }
    if (created.length > 0) {
        const names = created.map(p => `${p.name} (${p.rating})`).join(', ');
        addNews(`🔍 ${LANG.t('Отчёт скаутов')}: ${names}`, "positive");
    }
    return created;
}

// ============ 5. УТИЛИТЫ ============
function randomInt(min,max){return Math.floor(Math.random()*(max-min+1))+min;}
function randomChoice(arr){return arr[Math.floor(Math.random()*arr.length)];}
function getAllClubs(lk){const a=[];LEAGUE_DATA[lk].divisions.forEach(d=>a.push(...d.clubs));return a;}
// hashString, makeSeededRNG, generateAttributes, зарплаты и форматирование
// вынесены в src/core/* (см. импорты в начале файла).

function formatMoney(a){
    if(a>=1000000) return '$'+(a/1000000).toFixed(2)+'M';
    if(a>=1000) return '$'+(a/1000).toFixed(1)+'K';
    return '$'+Math.round(a);
}
function formatContractYears(y){
    if(!y||y<=0) return '—';
    const n=y; let w='лет';
    if(n===1) w='год'; else if(n>=2&&n<=4) w='года';
    return n+' '+w;
}

// ============ 6. ИМЕНА ============
// Связь пула с флагом (для корректной национальности)
const POOL_TO_FLAG = {
    RU:'🇷🇺', BY:'🇧🇾', UA:'🇺🇦', KZ:'🇰🇿',
    CA:'🇨🇦', US:'🇺🇸', SE:'🇸🇪', FI:'🇫🇮',
    CZ:'🇨🇿', SK:'🇸🇰', DE:'🇩🇪', CH:'🇨🇭',
    LV:'🇱🇻', LT:'🇱🇹', EE:'🇪🇪', NO:'🇳🇴',
    DK:'🇩🇰', GB:'🇬🇧', FR:'🇫🇷', JP:'🇯🇵',
    CN:'🇨🇳', KR:'🇰🇷', MD:'🇲🇩', GE:'🇬🇪',
    AM:'🇦🇲', UZ:'🇺🇿'
};

const NAME_POOLS = {
    RU: { first:["Александр","Дмитрий","Иван","Сергей","Андрей","Никита","Максим","Егор","Артем","Кирилл","Владимир","Николай","Павел","Роман","Денис","Антон","Илья","Вячеслав","Григорий","Ярослав","Валерий","Юрий","Олег","Геннадий","Пётр","Михаил","Виталий","Евгений","Виктор","Артур","Владислав","Матвей","Тимофей","Степан","Фёдор","Борис","Игорь","Константин","Лев","Тимур","Даниил","Марк","Савелий","Глеб","Родион","Всеволод","Платон","Захар","Гордей","Лука"],
        last:["Смирнов","Иванов","Кузнецов","Соколов","Петров","Волков","Морозов","Новиков","Фёдоров","Лебедев","Егоров","Павлов","Семёнов","Голубев","Виноградов","Богданов","Воронин","Жуков","Козлов","Орлов","Тихонов","Захаров","Беляев","Медведев","Никитин","Ефимов","Гусев","Крылов","Алексеев","Степанов","Яковлев","Сорокин","Сергеев","Романов","Королёв","Герасимов","Пономарёв","Григорьев","Лазарев","Филиппов","Данилов","Ефименко","Антонов","Тарасов","Белов","Комаров","Киселёв","Макаров","Андреев","Фролов"] },
    BY: { first:["Александр","Дмитрий","Андрей","Сергей","Павел","Артём","Максим","Егор","Никита","Иван","Владислав","Глеб","Даниил","Роман","Николай","Пётр","Денис","Илья","Евгений","Антон","Кирилл","Виктор","Олег","Дмитрий"],
        last:["Ковалёв","Козлов","Мороз","Лукашенко","Новик","Жук","Дубовик","Шевченко","Бондаренко","Ткачук","Рыбак","Савицкий","Куликов","Петровский","Мельник","Лях","Соколовский","Ярмоленко","Пинчук","Гурский","Ковальчук"] },
    CA: { first:["Erik","Lars","Anders","Johan","Karl","Nils","Mikael","Bjorn","Sven","Mark","Paul","Jack","Ryan","Tyler","Connor","Nathan","Logan","Brayden","Owen","Mason","Liam","Noah","Ethan","Jacob","Carter","Dylan"],
        last:["Anderson","Johnson","Smith","Brown","Wilson","Taylor","Clark","Thompson","White","Martin","Lee","Walker","Hall","Young","King","Wright","Hill","Scott","Green","Baker","Adams","Nelson","Carter","Mitchell","Roberts","Turner","Phillips","Campbell","Parker","Evans"] },
    US: { first:["Michael","David","James","John","Robert","William","Richard","Joseph","Thomas","Christopher","Daniel","Matthew","Anthony","Mark","Donald","Steven","Paul","Andrew","Kenneth","Joshua","Kevin","Brian","George","Edward","Ronald","Timothy"],
        last:["Miller","Davis","Garcia","Rodriguez","Martinez","Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin","Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson","Walker"] },
    SE: { first:["Erik","Lars","Anders","Johan","Karl","Nils","Mikael","Björn","Sven","Gustav","Oscar","Axel","Elias","Viktor","Filip","Hugo","Anton","Olle","Emil","Albin","Magnus","Kalle","Pelle","Nisse","Torbjörn"],
        last:["Andersson","Johansson","Karlsson","Nilsson","Larsson","Eriksson","Svensson","Gustafsson","Pettersson","Jonsson","Jansson","Hansson","Bengtsson","Lindberg","Lindström","Berg","Bergström","Holm","Lundqvist","Söderberg","Wallin","Ekman","Sandberg","Björk","Nyström"] },
    FI: { first:["Mikko","Jussi","Teemu","Antti","Pekka","Ville","Aleksi","Juha","Olli","Sami","Janne","Marko","Timo","Mika","Kari","Petri","Vesa","Jari","Kimmo","Jarmo","Tuomas","Eero","Aapo","Onni","Eino"],
        last:["Virtanen","Korhonen","Mäkinen","Nieminen","Hämäläinen","Laine","Heikkilä","Koskinen","Järvinen","Lehtonen","Lehtinen","Saarinen","Salminen","Heinonen","Niemi","Heikkinen","Kinnunen","Salonen","Turunen","Salo","Laitinen","Tuominen","Rantanen","Karjalainen","Mattila"] },
    CZ: { first:["Jakub","Tomáš","Petr","Martin","Lukáš","Ondřej","Jan","David","Vojtěch","Adam","Matěj","Filip","Daniel","Michal","Pavel","Josef","Milan","Václav","Karel","Zdeněk","Radek","Roman","Jiří","Aleš","Stanislav"],
        last:["Novák","Svoboda","Novotný","Dvořák","Černý","Procházka","Kučera","Veselý","Horák","Němec","Marek","Pospíšil","Pokorný","Hájek","Král","Jelínek","Růžička","Beneš","Fiala","Sedláček","Doležal","Zeman","Kolář","Navrátil","Čermák"] },
    SK: { first:["Jakub","Tomáš","Peter","Martin","Lukáš","Michal","Ján","Jozef","Matej","Adam","Samuel","Filip","Daniel","Patrik","Marek","Andrej","Milan","Vladimír","Radoslav","Miroslav"],
        last:["Horváth","Kováč","Varga","Tóth","Nagy","Baláž","Szabó","Molnár","Balog","Lukáč","Hudák","Král","Marek","Šimko","Bartko","Gajdoš","Hruška","Kollár","Krajčí","Mihálik"] },
    DE: { first:["Leon","Lukas","Felix","Maximilian","Jonas","Tim","Niklas","Jan","Moritz","Paul","Eric","Philipp","Sebastian","Tobias","Florian","Marco","Andreas","Stefan","Thomas","Michael","Martin"],
        last:["Müller","Schmidt","Schneider","Fischer","Weber","Meyer","Wagner","Becker","Schulz","Hoffmann","Koch","Bauer","Richter","Klein","Wolf","Schröder","Neumann","Schwarz","Zimmermann","Braun"] },
    CH: { first:["Luca","Noah","Leon","Nico","Jonas","Elias","Tim","Lars","Marc","Jan","Raphael","Fabian","Sebastian","Dominik","Simon","Andreas","Thomas","Daniel","Michael","Stefan"],
        last:["Müller","Meier","Schmid","Keller","Weber","Huber","Schneider","Meyer","Steiner","Fischer","Brunner","Baumann","Widmer","Frei","Zimmermann","Moser","Bühler","Gerber","Kaufmann","Lehmann"] },
    KZ: { first:["Аслан","Ерлан","Нурлан","Дархан","Тимур","Азамат","Ержан","Бауыржан","Серик","Кайрат","Аскар","Арман","Данияр","Ербол","Максат","Нурсултан","Олжас","Руслан","Санжар","Талгат"],
        last:["Ахметов","Оспанов","Ибраев","Сериков","Нурланов","Джаксыбеков","Абдуллаев","Смагулов","Касымов","Муратов","Бектурганов","Серикбаев","Омаров","Султанов","Тулегенов","Жумабаев","Сарсенов","Ахметжанов","Каримов","Исмаилов"] },
    LV: { first:["Jānis","Andris","Māris","Kārlis","Jāzeps","Jurgis","Kristaps","Raimonds","Valdis","Aivars","Guntis","Uldis","Viesturs","Ilmārs","Edgars"],
        last:["Bērziņš","Kalniņš","Ozoliņš","Jansons","Ozols","Liepiņš","Krūmiņš","Balodis","Eglītis","Pētersons","Zariņš","Kļaviņš","Celmiņš","Lejiņš","Vītols"] },
    LT: { first:["Tomas","Mantas","Darius","Marius","Andrius","Giedrius","Vytautas","Rimas","Saulius","Justas","Rolandas","Algirdas","Kęstutis","Arūnas","Linas"],
        last:["Kazlauskas","Petrauskas","Jankauskas","Stankevičius","Vasiliauskas","Žukauskas","Butkus","Paulauskas","Urbonas","Kavaliauskas","Adomaitis","Ramanauskas","Pocius","Šimkus","Baranauskas"] },
    EE: { first:["Jaan","Andres","Toomas","Mart","Peeter","Tarmo","Priit","Urmas","Indrek","Meelis","Margus","Aivar","Raivo","Anti","Sulev"],
        last:["Tamm","Saar","Sepp","Mägi","Kask","Kukk","Rebane","Ilves","Pärn","Koppel","Lepik","Kaasik","Raudsepp","Lill","Vaher"] },
    UA: { first:["Олександр","Андрій","Сергій","Дмитро","Максим","Іван","Микола","Володимир","Артем","Богдан","Олег","Павло","Роман","Віталій","Юрій"],
        last:["Шевченко","Коваленко","Бондаренко","Ткаченко","Кравченко","Олійник","Шевчук","Поліщук","Бойко","Ковальчук","Мельник","Марченко","Лисенко","Руденко","Савченко"] },
    NO: { first:["Lars","Ole","Jan","Per","Bjørn","Knut","Arne","Svein","Odd","Nils","Erik","Morten","Geir","Terje","Hans"],
        last:["Hansen","Johansen","Olsen","Larsen","Andersen","Pedersen","Nilsen","Kristiansen","Jensen","Karlsen","Johnsen","Pettersen","Eriksen","Berg","Haaland"] },
    DK: { first:["Mikkel","Lars","Anders","Mads","Kasper","Jesper","Rasmus","Jonas","Emil","Christian","Oliver","Noah","William","Magnus","Frederik"],
        last:["Jensen","Nielsen","Hansen","Pedersen","Andersen","Christensen","Larsen","Sørensen","Rasmussen","Jørgensen","Petersen","Madsen","Kristensen","Olsen","Thomsen"] },
    GB: { first:["Liam","Oliver","Noah","Harry","Jacob","Charlie","Thomas","George","Oscar","William","James","Henry","Leo","Alexander","Freddie"],
        last:["Smith","Jones","Taylor","Brown","Williams","Wilson","Johnson","Davies","Robinson","Wright","Thompson","White","Hughes","Edwards","Green"] },
    FR: { first:["Lucas","Hugo","Théo","Nathan","Enzo","Louis","Gabriel","Raphaël","Arthur","Jules","Adam","Maël","Léo","Sacha","Ethan"],
        last:["Martin","Bernard","Dubois","Thomas","Robert","Richard","Petit","Durand","Leroy","Moreau","Simon","Laurent","Lefebvre","Michel","Garcia"] },
    JP: { first:["Hiroshi","Takashi","Kenji","Yuki","Satoshi","Takeshi","Akira","Shin","Daiki","Haruto","Yuto","Ren","Sota","Riku","Kaito"],
        last:["Tanaka","Suzuki","Takahashi","Watanabe","Ito","Yamamoto","Nakamura","Kobayashi","Kato","Yoshida","Sato","Yamada","Sasaki","Matsumoto","Inoue"] },
    CN: { first:["Wei","Jun","Lei","Hao","Ming","Peng","Yong","Bin","Feng","Tao","Jian","Bo","Gang","Kai","Chao"],
        last:["Wang","Li","Zhang","Liu","Chen","Yang","Huang","Zhao","Wu","Zhou","Xu","Sun","Ma","Zhu","Hu"] },
    KR: { first:["Min-jun","Ji-ho","Seo-jun","Ha-jun","Do-yun","Eun-woo","Ji-hu","Jun-seo","Ye-jun","Si-woo","Hyun-woo","Woo-jin","Tae-yang","Jun-ho","Seung-min"],
        last:["Kim","Lee","Park","Choi","Jung","Kang","Cho","Yoon","Jang","Lim","Han","Oh","Seo","Shin","Kwon"] },
    MD: { first:["Андрей","Ион","Николай","Виктор","Дмитрий","Сергей","Александр","Юрий","Олег","Валерий"],
        last:["Попов","Иванов","Русу","Чобану","Григориу","Мунтяну","Ротару","Лунгу","Дабижа","Бодю"] },
    GE: { first:["Георгий","Давид","Ника","Лука","Ираклий","Гиорги","Левани","Сандро","Бека","Гога"],
        last:["Беридзе","Мамулашвили","Гелашвили","Капанадзе","Джапаридзе","Ломидзе","Циклаури","Кикнадзе","Харадзе","Читая"] },
    AM: { first:["Армен","Ашот","Гагик","Давид","Карен","Сурен","Тигран","Ваагн","Геворг","Арарат"],
        last:["Абрамян","Григорян","Саргсян","Оганесян","Петросян","Арутюнян","Мкртчян","Давтян","Карапетян","Манукян"] },
    UZ: { first:["Азиз","Бекзод","Джасур","Ислом","Комрон","Мухаммад","Отабек","Рустам","Санжар","Шохрух"],
        last:["Ахмедов","Исмаилов","Каримов","Мамадалиев","Набиев","Рахимов","Саидов","Турсунов","Умаров","Юсупов"] }
};

// Глобальный пул использованных имён (уникальность по всей игре)
const GLOBAL_USED_NAMES = new Set();

// ============ ИМЕНА — ВСЕГДА ЛАТИНИЦА (как в FIFA) ============
const _NAME_CYR_TO_LAT = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y',
    'к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f',
    'х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
    'і':'i','ї':'yi','є':'ye','ґ':'g',
    'ў':'u','ә':'a','ғ':'g','қ':'k','ң':'n','ө':'o','ұ':'u','ү':'u','һ':'h',
    'А':'A','Б':'B','В':'V','Г':'G','Д':'D','Е':'E','Ё':'Yo','Ж':'Zh','З':'Z','И':'I','Й':'Y',
    'К':'K','Л':'L','М':'M','Н':'N','О':'O','П':'P','Р':'R','С':'S','Т':'T','У':'U','Ф':'F',
    'Х':'Kh','Ц':'Ts','Ч':'Ch','Ш':'Sh','Щ':'Shch','Ъ':'','Ы':'Y','Ь':'','Э':'E','Ю':'Yu','Я':'Ya',
    'І':'I','Ї':'Yi','Є':'Ye','Ґ':'G',
    'Ў':'U','Ә':'A','Ғ':'G','Қ':'K','Ң':'N','Ө':'O','Ұ':'U','Ү':'U','Һ':'H'
};
function toLatin(name) {
    if (!name) return name;
    if (!/[А-Яа-яЁёІіЇїЄєҐґЎўӘәҒғҚқҢңӨөҰұҮүҺһ]/.test(name)) return name;
    return name.split('').map(ch => _NAME_CYR_TO_LAT[ch] !== undefined ? _NAME_CYR_TO_LAT[ch] : ch).join('');
}

// Пулы стран для каждой лиги — реалистичные пропорции
function getPoolPoolForLeague(leagueName) {
    if (['NHL','AHL'].includes(leagueName)) {
        return ['CA','CA','CA','CA','CA','CA','CA','CA','CA',
                'US','US','US','US','US',
                'RU','RU','SE','SE','FI','CZ','SK'];
    }
    if (leagueName === 'SHL') return ['SE','SE','SE','SE','SE','SE','SE','FI','FI','CA','US'];
    if (leagueName === 'Liiga') return ['FI','FI','FI','FI','FI','FI','FI','SE','SE','CA','US','RU'];
    if (leagueName === 'Czech_Extraliga') return ['CZ','CZ','CZ','CZ','CZ','CZ','SK','SK','SK','SE','FI','CA'];
    if (leagueName === 'DEL') return ['DE','DE','DE','DE','DE','DE','CZ','CA','US','SE','FI','SK'];
    if (leagueName === 'NL_Switzerland') return ['CH','CH','CH','CH','CH','CH','CH','SE','FI','CA','US','DE'];
    if (leagueName === 'ICE_HL') return ['DE','DE','DE','DE','CZ','CZ','CH','SK','SE','FI','CA'];
    if (['Belarus_Extraliga','Belarus_Vysshaya'].includes(leagueName)) {
        return ['BY','BY','BY','BY','BY','BY','BY','RU','RU','RU','UA','KZ','LV','LT'];
    }
    if (leagueName === 'KHL') {
        return ['RU','RU','RU','RU','RU','RU','RU','RU','RU','RU','RU','RU','RU',
                'BY','BY','KZ','KZ','UA',
                'CA','US','SE','FI','CZ','SK'];
    }
    if (leagueName === 'VHL') {
        return ['RU','RU','RU','RU','RU','RU','RU','RU','RU','RU','RU','RU','RU','RU',
                'BY','BY','KZ','UA'];
    }
    if (leagueName === 'MHL') {
        return ['RU','RU','RU','RU','RU','RU','RU','RU','RU','RU','RU','RU','RU','RU','RU','RU',
                'BY','BY','KZ','UA','LV'];
    }
    return ['RU'];
}

function generatePlayerName(leagueName) {
    const poolCodes = getPoolPoolForLeague(leagueName);
    let name = '';
    let nationality = '🇷🇺';
    let attempts = 0;
    do {
        const pool = randomChoice(poolCodes);
        const p = NAME_POOLS[pool] || NAME_POOLS.RU;
        nationality = POOL_TO_FLAG[pool] || '🇷🇺';
        name = randomChoice(p.first) + ' ' + randomChoice(p.last);
        attempts++;
    } while (GLOBAL_USED_NAMES.has(name) && attempts < 50);
    GLOBAL_USED_NAMES.add(name);
    return { name: toLatin(name), nationality };
}

function getPlayerCountry(player) {
    // 1. Если у игрока сохранена национальность — используем её
    if (player.nationality) return player.nationality;
    // 2. Эвристика по имени — для реальных игроков и старых сейвов
    return guessNationalityByName(player.name, player.league);
}

function guessNationalityByName(name, league) {
    if (!name) return '🇷🇺';
    const l = String(name).toLowerCase();
    const last = l.split(' ').slice(-1)[0] || '';

    // --- Кириллица — точно СНГ ---
    if (/[а-яё]/i.test(name)) {
        if (/(енко|чук|ко|ук)$/i.test(last) && /[іїєґў]/i.test(name)) return '🇧🇾';
        return '🇷🇺';
    }

    // --- Швеция ---
    if (/(sson|berg|ström|strom|lund|qvist|kvist|gren|holm|dahl|sjö|sjo|wallin|lindholm|lindgren|backstrom|backman|hedman|eriksson|andersson|johansson|karlsson|nilsson|larsson|svensson|gustafsson|pettersson|jonsson|jansson|hansson|bengtsson|lindberg|lindström|söderberg|soderberg|nyström|nystrom|ekman|sandberg|björk|bjork)$/.test(last)) return '🇸🇪';

    // --- Финляндия ---
    if (/(nen|mäki|maki|järvi|jarvi|koski|aho|lahti|virta|ranta|korpi|vaara|lehtonen|lehtinen|rantanen|karjalainen|virtanen|korhonen|nieminen|laine|koskinen|jarvinen|saarinen|salminen|heinonen|niemi|heikkinen|kinnunen|salonen|turunen|salo|laitinen|tuominen|mattila)$/.test(last)) return '🇫🇮';

    // --- Чехия ---
    if (/(novak|svoboda|novotny|dvorak|cerny|prochazka|kucera|vesely|horak|nemec|pospisil|hajek|kral|ruzicka|benes|fiala|sedlacek|dolezal|zeman|kolar|navratil|cermak|kubalik|palat|voracek|pastrnak|necas|hertl|faksa|chytil)$/.test(last)) return '🇨🇿';

    // --- Словакия ---
    if (/(horvath|kovac|varga|toth|nagy|balaz|szabo|molnar|balog|lukac|hudak|simko|gajdos|hruska|kollar|slafkovsky|fehervary|cejka)$/.test(last)) return '🇸🇰';

    // --- Германия ---
    if (/(müller|muller|schmidt|schneider|fischer|weber|meyer|wagner|becker|schulz|hoffmann|koch|bauer|richter|klein|wolf|schröder|schroder|neumann|schwarz|zimmermann|braun|draisaitl|seider|stützle|stutzle|reichel|sturm)$/.test(last)) return '🇩🇪';

    // --- Швейцария ---
    if (/(meier|schmid|keller|huber|brunner|baumann|widmer|frei|moser|bühler|buhler|gerber|kaufmann|lehmann|niederreiter|josi|suter|hischier|andrighetto|bertoni|siegenthaler)$/.test(last)) return '🇨🇭';

    // --- Латвия ---
    if (/(bērziņš|berzins|kalnins|ozolins|jansons|ozols|liepins|krumins|balodis|eglitis|petersons|zarins|klavins|celmins|vitols|balcers|girgensons|blueger|daugavins)$/.test(last)) return '🇱🇻';

    // --- Общие славянские окончания → СНГ ---
    if (/(ov|ev|in|sky|skiy|enko|chuk|vich|ich|its|yan|yn|yh|yov|yev)$/.test(last)) {
        // Отдельные украинские фамилии
        if (/(enko|ko|uk)$/.test(last) && /^(bondarenko|savchenko|kravchenko|tkachenko|shevchenko|kovalenko|melnyk|shevchuk|polischuk|boiko|kovalchuk|lysenko|rudenko|marchenko)$/.test(last)) return '🇺🇦';
        return '🇷🇺';
    }

    // --- Диакритика: уточнение ---
    if (/[řžě]/i.test(l)) return '🇨🇿';
    if (/[åäö]/i.test(l) && !/(nen|lä|inen|mäki|järvi)$/.test(last)) return '🇸🇪';
    if (/[äö]/i.test(l) && /(nen|lä|inen|mäki)$/.test(last)) return '🇫🇮';

    // --- Дефолт по лиге ---
    if (['KHL', 'VHL', 'MHL'].includes(league)) return '🇷🇺';
    if (['Belarus_Extraliga', 'Belarus_Vysshaya'].includes(league)) return '🇧🇾';
    if (league === 'SHL') return '🇸🇪';
    if (league === 'Liiga') return '🇫🇮';
    if (league === 'Czech_Extraliga') return '🇨🇿';
    if (league === 'DEL') return '🇩🇪';
    if (league === 'NL_Switzerland') return '🇨🇭';
    if (league === 'ICE_HL') return '🇦🇹';

    // NHL/AHL — большинство канадцы
    return '🇨🇦';
}

// ============ АВАТАРЫ ИГРОКОВ — РЕАЛИСТИЧНЫЙ СТИЛЬ ============
function getAvatarEthnicity(country) {
    if (['🇸🇪','🇫🇮','🇳🇴','🇩🇰'].includes(country)) return 'north';
    if (['🇷🇺','🇧🇾','🇺🇦'].includes(country)) return 'east';
    if (['🇩🇪','🇨🇭','🇨🇿','🇸🇰','🇫🇷','🇬🇧','🇦🇹'].includes(country)) return 'west';
    if (['🇨🇦','🇺🇸'].includes(country)) return 'na';
    if (['🇯🇵','🇨🇳','🇰🇷','🇰🇿','🇺🇿'].includes(country)) return 'asia';
    if (['🇬🇪','🇦🇲'].includes(country)) return 'caucasus';
    if (['🇱🇻','🇱🇹','🇪🇪'].includes(country)) return 'baltic';
    return 'east';
}

function hexToRgb(hex) {
    const num = parseInt(hex.replace('#',''), 16);
    return { r: num >> 16, g: (num >> 8) & 0xFF, b: num & 0xFF };
}
function rgbToHex(r,g,b) {
    return '#' + ((1 << 24) + (Math.max(0,Math.min(255,r)) << 16) + (Math.max(0,Math.min(255,g)) << 8) + Math.max(0,Math.min(255,b))).toString(16).slice(1);
}
function shadeColor(hex, percent) {
    const { r, g, b } = hexToRgb(hex);
    return rgbToHex(Math.round(r + percent * 2.55), Math.round(g + percent * 2.55), Math.round(b + percent * 2.55));
}

function getPlayerAvatarSVG(player) {
    const name = player.name || 'Unknown';
    const country = player.nationality || getPlayerCountry(player);
    const h = hashString(name);
    const ethnicity = getAvatarEthnicity(country);
    const age = player.age || 25;

    // === КОЖА ===
    const skinByEth = {
        north:   ['#f3d5b8','#f0cfae','#ecc9a4'],
        east:    ['#efcba3','#ecc49a','#e8bd90'],
        west:    ['#e8c196','#e3ba8c','#deb280'],
        baltic:  ['#f0d0b0','#ecc9a4','#e8c199'],
        caucasus:['#e3b98c','#dcae80','#d5a374'],
        asia:    ['#eecb9a','#eac490','#e5bd85'],
        na:      ['#f3d5b8','#e8c099','#c99568','#a57850','#7a5233']
    };
    const skinArr = skinByEth[ethnicity] || skinByEth.east;
    let skinI = (ethnicity === 'na') ? ((h % 8 === 0) ? 3 + (h % 2) : h % 3) : (h % skinArr.length);
    const skin = skinArr[skinI];

    // === ВОЛОСЫ ===
    let hairArr;
    if (ethnicity === 'north' || ethnicity === 'baltic') hairArr = ['#d8c49a','#b89b6d','#8f7550','#6b5540','#4a3a28'];
    else if (ethnicity === 'east') hairArr = ['#b89b6d','#8f7550','#6b5540','#4a3a28','#3a2818'];
    else if (ethnicity === 'west') hairArr = ['#7a5c3a','#5a3f28','#3a2818','#2a1a0e','#b89b6d'];
    else if (ethnicity === 'na') hairArr = (skinI >= 3) ? ['#1a1410','#241a12'] : ['#3a2818','#2a1a0e','#5a3f28','#8a6a3a'];
    else if (ethnicity === 'asia') hairArr = ['#0e0a08','#1a1410'];
    else if (ethnicity === 'caucasus') hairArr = ['#1a1410','#2a1a0e','#3a2818'];
    else hairArr = ['#3a2818','#4a3722','#5a3f28'];

    const isGrey = age >= 42 && (h >> 3) % 2 === 0;
    let hair = hairArr[h % hairArr.length];
    if (isGrey) hair = '#b0aaa0';

    // === ГЛАЗА ===
    const eyeArr = ['#5a3f28','#4a6a8a','#3a5a4a','#6b4a2a'];
    const eyeColor = eyeArr[h % eyeArr.length];

    // === ФОРМА ЛИЦА ===
    const faceShape = (h >> 4) % 3;
    const faceW = [29, 31, 30][faceShape];
    const faceH = [34, 35, 34][faceShape];

    // === СВИТЕР (яркий, сплошной) ===
    let jerseyColor, jerseyDark, jerseyTrim;
    if (player.club) {
        const hue = hashString(player.club) % 360;
        jerseyColor = `hsl(${hue}, 55%, 52%)`;
        jerseyDark  = `hsl(${hue}, 60%, 32%)`;
        jerseyTrim  = `hsl(${hue}, 65%, 68%)`;
    } else {
        const hue = hashString(name) % 360;
        jerseyColor = `hsl(${hue}, 50%, 55%)`;
        jerseyDark  = `hsl(${hue}, 55%, 35%)`;
        jerseyTrim  = `hsl(${hue}, 60%, 70%)`;
    }

    // Фон
    const bgHue = player.club ? (hashString(player.club) % 360) : 220;
    const bg1 = `hsl(${bgHue}, 25%, 14%)`;
    const bg2 = `hsl(${bgHue}, 30%, 6%)`;

    // === ГЕОМЕТРИЯ (нормальные пропорции) ===
    const cx = 60;
    const faceCy = 38;
    const eyeY = 34;
    const eyeLX = 50;
    const eyeRX = 70;
    const noseY = 48;
    const mouthY = 58;
    const chinY = faceCy + faceH - 2;
    const earY = 38;
    const earXL = cx - faceW + 2;
    const earXR = cx + faceW - 2;

    // === ШЕЯ (короткая, спрятана под воротом) ===
    const neckW = 14;
    const neckSVG = `
        <rect x="${cx-neckW/2}" y="${chinY-2}" width="${neckW}" height="18" fill="${shadeColor(skin,-12)}" rx="2"/>
    `;

    // === СВИТЕР — сбалансированные пропорции ===
    const collarY = chinY + 6;
    const shoulderW = 22;   // половина ширины плеч

    const jerseySVG = `
        <!-- Основной силуэт свитера -->
        <path d="M${cx-shoulderW-24} ${collarY+6}
                 L${cx-20} ${collarY}
                 Q${cx-15} ${collarY+8} ${cx} ${collarY+8}
                 Q${cx+15} ${collarY+8} ${cx+20} ${collarY}
                 L${cx+shoulderW+24} ${collarY+6}
                 L${cx+shoulderW+26} ${collarY+20}
                 Q${cx+shoulderW+26} 100 ${cx+shoulderW+18} 112
                 Q${cx+shoulderW+8} 120 60 120
                 Q${cx-shoulderW-8} 120 ${cx-shoulderW-18} 112
                 Q${cx-shoulderW-26} 100 ${cx-shoulderW-26} ${collarY+20}
                 Z"
              fill="${jerseyColor}"/>

        <!-- Верхняя тень для объёма -->
        <path d="M${cx-shoulderW-24} ${collarY+6}
                 L${cx-20} ${collarY}
                 Q${cx-15} ${collarY+8} ${cx} ${collarY+8}
                 Q${cx+15} ${collarY+8} ${cx+20} ${collarY}
                 L${cx+shoulderW+24} ${collarY+6}
                 L${cx+shoulderW+25} ${collarY+12}
                 L${cx+22} ${collarY+7}
                 Q${cx+15} ${collarY+13} ${cx} ${collarY+13}
                 Q${cx-15} ${collarY+13} ${cx-22} ${collarY+7}
                 L${cx-shoulderW-25} ${collarY+12}
                 Z"
              fill="${jerseyDark}" opacity="0.55"/>

        <!-- Яркий воротник -->
        <path d="M${cx-20} ${collarY}
                 Q${cx-15} ${collarY+8} ${cx} ${collarY+8}
                 Q${cx+15} ${collarY+8} ${cx+20} ${collarY}
                 L${cx+18} ${collarY-4}
                 Q${cx+13} ${collarY+3} ${cx} ${collarY+3}
                 Q${cx-13} ${collarY+3} ${cx-18} ${collarY-4}
                 Z"
              fill="${jerseyTrim}"/>

        <!-- Глубина выреза -->
        <path d="M${cx-18} ${collarY-3}
                 Q${cx-13} ${collarY+3} ${cx} ${collarY+3}
                 Q${cx+13} ${collarY+3} ${cx+18} ${collarY-3}
                 L${cx+16} ${collarY-1.5}
                 Q${cx+13} ${collarY+4} ${cx} ${collarY+4}
                 Q${cx-13} ${collarY+4} ${cx-16} ${collarY-1.5}
                 Z"
              fill="#000000" opacity="0.4"/>
    `;

    // === УШИ ===
    const earsSVG = `
        <ellipse cx="${earXL}" cy="${earY}" rx="3.5" ry="5.5" fill="${skin}"/>
        <ellipse cx="${earXL+0.8}" cy="${earY}" rx="2" ry="3.5" fill="${shadeColor(skin,-20)}" opacity="0.5"/>
        <ellipse cx="${earXR}" cy="${earY}" rx="3.5" ry="5.5" fill="${skin}"/>
        <ellipse cx="${earXR-0.8}" cy="${earY}" rx="2" ry="3.5" fill="${shadeColor(skin,-20)}" opacity="0.5"/>
    `;

    // === ГОЛОВА ===
    let headSVG;
    if (faceShape === 2) {
        headSVG = `<path d="M${cx-faceW} ${faceCy-8}
            Q${cx-faceW} ${faceCy-faceH} ${cx} ${faceCy-faceH}
            Q${cx+faceW} ${faceCy-faceH} ${cx+faceW} ${faceCy-8}
            L${cx+faceW-1} ${faceCy+8}
            Q${cx+faceW-4} ${chinY-2} ${cx+10} ${chinY}
            L${cx-10} ${chinY}
            Q${cx-faceW+4} ${chinY-2} ${cx-faceW+1} ${faceCy+8} Z" fill="${skin}"/>`;
    } else {
        headSVG = `<ellipse cx="${cx}" cy="${faceCy}" rx="${faceW}" ry="${faceH}" fill="${skin}"/>`;
    }

    // === ГЛАЗА ===
    function renderEye(ex) {
        return `
            <ellipse cx="${ex}" cy="${eyeY}" rx="4.5" ry="2.8" fill="#f5f2ea"/>
            <circle cx="${ex}" cy="${eyeY}" r="2.6" fill="${eyeColor}"/>
            <circle cx="${ex}" cy="${eyeY}" r="1.1" fill="#0a0808"/>
            <circle cx="${ex-0.8}" cy="${eyeY-0.8}" r="0.5" fill="#ffffff" opacity="0.9"/>
            <path d="M${ex-5} ${eyeY-1} Q${ex} ${eyeY-3} ${ex+5} ${eyeY-1}" stroke="${hair}" stroke-width="0.9" fill="none" opacity="0.85"/>
            <path d="M${ex-4} ${eyeY+2} Q${ex} ${eyeY+3} ${ex+4} ${eyeY+2}" stroke="${hair}" stroke-width="0.4" fill="none" opacity="0.4"/>
        `;
    }

    // === БРОВИ ===
    const browY = eyeY - 6;
    const browSVG = `
        <path d="M${eyeLX-6} ${browY+0.5} Q${eyeLX-1} ${browY-2} ${eyeLX+5} ${browY+0.3}" stroke="${hair}" stroke-width="1.6" stroke-linecap="round" fill="none" opacity="0.9"/>
        <path d="M${eyeRX-5} ${browY+0.3} Q${eyeRX+1} ${browY-2} ${eyeRX+6} ${browY+0.5}" stroke="${hair}" stroke-width="1.6" stroke-linecap="round" fill="none" opacity="0.9"/>
    `;

    // === НОС ===
    const noseSVG = `
        <path d="M${cx-1} ${eyeY+4} Q${cx-2.5} ${noseY-3} ${cx-2.5} ${noseY}" stroke="${shadeColor(skin,-30)}" stroke-width="0.8" fill="none" opacity="0.5" stroke-linecap="round"/>
        <path d="M${cx+1} ${eyeY+4} Q${cx+2.5} ${noseY-3} ${cx+2.5} ${noseY}" stroke="${shadeColor(skin,-30)}" stroke-width="0.8" fill="none" opacity="0.5" stroke-linecap="round"/>
        <path d="M${cx-2.5} ${noseY} Q${cx} ${noseY+1.5} ${cx+2.5} ${noseY}" stroke="${shadeColor(skin,-40)}" stroke-width="0.9" fill="none" opacity="0.6" stroke-linecap="round"/>
        <ellipse cx="${cx-2}" cy="${noseY+0.2}" rx="0.5" ry="0.35" fill="${shadeColor(skin,-50)}" opacity="0.7"/>
        <ellipse cx="${cx+2}" cy="${noseY+0.2}" rx="0.5" ry="0.35" fill="${shadeColor(skin,-50)}" opacity="0.7"/>
    `;

    // === РОТ ===
    const mouthSVG = `
        <path d="M${cx-4} ${mouthY} Q${cx-2} ${mouthY-1} ${cx} ${mouthY-0.5} Q${cx+2} ${mouthY-1} ${cx+4} ${mouthY}" stroke="${shadeColor(skin,-35)}" stroke-width="0.7" fill="none" opacity="0.7" stroke-linecap="round"/>
        <path d="M${cx-3.5} ${mouthY+0.5} Q${cx} ${mouthY+2} ${cx+3.5} ${mouthY+0.5}" stroke="${shadeColor(skin,-35)}" stroke-width="0.9" fill="none" opacity="0.6" stroke-linecap="round"/>
    `;

    // === ВОЛОСЫ ===
    const hairStyle = (h >> 8) % 5;
    const hairTop = faceCy - faceH + 2;
    const hairBottom = eyeY - 6;
    const hairW = faceW + 1;
    let hairSVG = '';

    if (hairStyle === 0) {
        hairSVG = `<path d="M${cx-hairW} ${hairBottom}
            Q${cx-hairW} ${hairTop-2} ${cx-8} ${hairTop-1}
            Q${cx} ${hairTop-4} ${cx+8} ${hairTop-1}
            Q${cx+hairW} ${hairTop-2} ${cx+hairW} ${hairBottom}
            Q${cx+hairW-3} ${hairBottom-2} ${cx+12} ${hairBottom-3}
            Q${cx} ${hairBottom-5} ${cx-12} ${hairBottom-3}
            Q${cx-hairW+3} ${hairBottom-2} ${cx-hairW} ${hairBottom} Z" fill="${hair}"/>`;
    } else if (hairStyle === 1) {
        hairSVG = `<path d="M${cx-hairW} ${hairBottom+2}
            Q${cx-hairW} ${hairTop-3} ${cx} ${hairTop-4}
            Q${cx+hairW} ${hairTop-3} ${cx+hairW} ${hairBottom+2}
            Q${cx+hairW-2} ${hairBottom-1} ${cx+10} ${hairBottom-3}
            Q${cx} ${hairBottom-6} ${cx-10} ${hairBottom-3}
            Q${cx-hairW+2} ${hairBottom-1} ${cx-hairW} ${hairBottom+2} Z" fill="${hair}"/>`;
    } else if (hairStyle === 2) {
        hairSVG = `<path d="M${cx-hairW-1} ${hairBottom+4}
            Q${cx-hairW-1} ${hairTop-4} ${cx} ${hairTop-5}
            Q${cx+hairW+1} ${hairTop-4} ${cx+hairW+1} ${hairBottom+4}
            L${cx+hairW-1} ${chinY-12}
            L${cx+hairW-4} ${chinY-14}
            L${cx+hairW-4} ${hairBottom}
            Q${cx+hairW-2} ${hairBottom-3} ${cx+10} ${hairBottom-5}
            Q${cx} ${hairBottom-8} ${cx-10} ${hairBottom-5}
            Q${cx-hairW+2} ${hairBottom-3} ${cx-hairW+4} ${hairBottom}
            L${cx-hairW+4} ${chinY-14}
            L${cx-hairW+1} ${chinY-12} Z" fill="${hair}"/>`;
    } else if (hairStyle === 3) {
        hairSVG = `<path d="M${cx-hairW} ${hairBottom+1}
            Q${cx-hairW} ${hairTop-1} ${cx} ${hairTop-2}
            Q${cx+hairW} ${hairTop-1} ${cx+hairW} ${hairBottom+1}
            Q${cx+hairW-4} ${hairBottom-2} ${cx+9} ${hairBottom-4}
            Q${cx} ${hairBottom-6} ${cx-9} ${hairBottom-4}
            Q${cx-hairW+4} ${hairBottom-2} ${cx-hairW} ${hairBottom+1} Z" fill="${hair}"/>`;
    } else {
        hairSVG = `<path d="M${cx-hairW} ${faceCy-8}
            Q${cx-hairW-1} ${faceCy-14} ${cx-hairW+8} ${faceCy-16}
            Q${cx-hairW+2} ${faceCy-4} ${cx-hairW+3} ${hairBottom+2}
            L${cx-hairW+1} ${hairBottom+4} Z" fill="${hair}"/>
            <path d="M${cx+hairW} ${faceCy-8}
            Q${cx+hairW+1} ${faceCy-14} ${cx+hairW-8} ${faceCy-16}
            Q${cx+hairW-2} ${faceCy-4} ${cx+hairW-3} ${hairBottom+2}
            L${cx+hairW-1} ${hairBottom+4} Z" fill="${hair}"/>`;
    }

    // === БОРОДА ===
    let beardSVG = '';
    if (age >= 25) {
        const bType = (h >> 12) % 6;
        if (age >= 32 && bType < 3) {
            beardSVG = `<path d="M${cx-faceW+6} ${mouthY-4} Q${cx-faceW+4} ${chinY-2} ${cx} ${chinY}
                Q${cx+faceW-4} ${chinY-2} ${cx+faceW-6} ${mouthY-4}
                Q${cx+faceW-8} ${chinY-6} ${cx} ${chinY-4}
                Q${cx-faceW+8} ${chinY-6} ${cx-faceW+6} ${mouthY-4} Z" fill="${hair}" opacity="0.55"/>`;
        } else if (age >= 28 && bType < 4) {
            beardSVG = `<path d="M${cx-faceW+5} ${mouthY-2} Q${cx-faceW+4} ${chinY-3} ${cx} ${chinY-1}
                Q${cx+faceW-4} ${chinY-3} ${cx+faceW-5} ${mouthY-2}
                Q${cx+faceW-9} ${chinY-7} ${cx} ${chinY-5}
                Q${cx-faceW+9} ${chinY-7} ${cx-faceW+5} ${mouthY-2} Z" fill="${hair}" opacity="0.25"/>`;
        }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <defs>
            <linearGradient id="bg_${h}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="${bg1}"/>
                <stop offset="100%" stop-color="${bg2}"/>
            </linearGradient>
            <linearGradient id="jersey_${h}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="${jerseyTrim}"/>
                <stop offset="25%" stop-color="${jerseyColor}"/>
                <stop offset="100%" stop-color="${jerseyDark}"/>
            </linearGradient>
        </defs>

        <rect width="120" height="120" fill="url(#bg_${h})"/>
        <circle cx="60" cy="35" r="44" fill="#ffffff" opacity="0.03"/>

        <!-- Слои: шея → свитер → уши → голова → лицо -->
        ${neckSVG}
        ${jerseySVG}
        ${earsSVG}
        ${headSVG}
        ${browSVG}
        ${renderEye(eyeLX)}
        ${renderEye(eyeRX)}
        ${noseSVG}
        ${mouthSVG}
        ${beardSVG}
        ${hairSVG}
    </svg>`;
}

// ============ 7. СОЗДАНИЕ ИГРОКА ============
function createPlayer(name, club, league, position, age, rating, potential, nationality) {
    // Пик драфта — по рейтингу (только 2 раунда в игре)
    let draftRound = 0, draftPickNum = 0;
    if (rating >= 85) { draftRound = 1; draftPickNum = randomInt(1, 10); }
    else if (rating >= 75) { draftRound = 1; draftPickNum = randomInt(11, 30); }
    else if (rating >= 65) { draftRound = 2; draftPickNum = randomInt(31, 60); }
    else if (rating >= 55) { draftRound = 2; draftPickNum = randomInt(61, 64); }
    // rating < 55 — не задрафтован
    const draftYear = currentSeason - age + 18;
    const draftInfo = draftRound > 0 ? `R${draftRound} Pick ${draftPickNum}` : '';

    return {name,nationality: nationality || null,club,league,position,age,rating,
        draftInfo, draftYear,
        clubLoyalty: club ? randomInt(40, 70) : 0,
        potential: potential || Math.min(100, rating + randomInt(5, 40)),
        cost: Math.max(100, (rating-10)*50),
        salary: club ? calculateSalary(rating, league) : 25,
        attributes: generateAttributes(position, rating, name),
        form:0, injuryWeeks:0, loyalty:100,
        contractYears: randomInt(1, 4),
        lastTransferSeason: 0,
        declinedRenewal: false,
        trophies: [],
        awards: [],
        character: randomChoice(['ambitious','calm','pragmatic','capricious','loyal']),
        agentId: null,
        stats:{gp:0,goals:0,assists:0,pim:0,plusMinus:0,ratingSum:0,goalsAgainst:0},
        seasonHistory:[]};
}

// ============ 7.5. СОЗДАНИЕ РЕАЛЬНОГО ИГРОКА (из REAL_ROSTERS) ============
// ============ ГЕНЕРАЦИЯ ПРАВДОПОДОБНОЙ КАРЬЕРЫ ДЛЯ РЕАЛЬНЫХ ИГРОКОВ ============
function generateFakeCareerHistory(player) {
    if (!player || !player.age) return;
    const startAge = 17;
    const currentAge = player.age;
    if (currentAge <= startAge) return;

    const currentLeague = player.league;
    const currentClub = player.club;
    const currentRating = player.rating;
    const flag = player.nationality || getPlayerCountry(player);

    // Стартовая («домашняя») лига по стране
    const homeStartLeague = {
        '🇷🇺': 'MHL', '🇧🇾': 'Belarus_Vysshaya', '🇰🇿': 'KHL', '🇱🇻': 'KHL',
        '🇨🇦': 'AHL', '🇺🇸': 'AHL', '🇸🇪': 'SHL', '🇫🇮': 'Liiga',
        '🇨🇿': 'Czech_Extraliga', '🇸🇰': 'Czech_Extraliga',
        '🇩🇪': 'DEL', '🇨🇭': 'NL_Switzerland'
    }[flag] || 'VHL';

    // Фарм-клуб для NHL-игроков
    const farmClub = (currentLeague === 'NHL') ? getFarmClub(currentClub) : null;

    // Хелпер: случайный клуб в лиге
    const randomClubIn = (lk) => {
        try {
            const clubs = getAllClubs(lk);
            if (!clubs || clubs.length === 0) return null;
            // Убираем текущий клуб, чтобы не «сидеть в нём всю жизнь»
            const filtered = clubs.filter(c => c !== currentClub);
            return randomChoice(filtered.length > 0 ? filtered : clubs);
        } catch (e) { return null; }
    };

    // Сколько сезонов до дебюта в топ-лиге игрока (последние 2–4 сезона — в текущем клубе)
    const seasonsInCurrentClub = Math.min(
        Math.max(2, Math.round((currentAge - startAge) * 0.25)),
        currentAge - startAge
    );
    const debutInCurrentClubAge = currentAge - seasonsInCurrentClub;

    const history = [];
    let simClub = null;
    let simLeague = null;
    let lastTransferAge = -99;

    for (let a = startAge; a < currentAge; a++) {
        const season = currentSeason - (currentAge - a);
        if (season < 2000) continue;

        // Рейтинг линейно растёт от 50% до 100% от текущего
        const progress = (a - startAge) / Math.max(1, currentAge - startAge);
        const baseR = Math.round(currentRating * (0.5 + progress * 0.5));
        const rating = Math.max(40, Math.min(currentRating, baseR + randomInt(-2, 2)));

        // === ВЫБОР КЛУБА И ЛИГИ ДЛЯ ЭТОГО СЕЗОНА ===
        let club, league;

        if (a >= debutInCurrentClubAge) {
            // Финальные сезоны — уже в текущем клубе
            club = currentClub;
            league = currentLeague;
        } else if (a === startAge) {
            // Первый сезон — дебют в «домашней» лиге
            if (currentLeague === 'NHL' && farmClub) {
                club = farmClub;
                league = 'AHL';
            } else if (currentLeague === homeStartLeague) {
                club = randomClubIn(currentLeague) || currentClub;
                league = currentLeague;
            } else {
                club = randomClubIn(homeStartLeague) || currentClub;
                league = homeStartLeague;
            }
        } else {
            // Средний период карьеры — переходы
            league = simLeague;
            club = simClub;

            // Иногда «поднимаемся» по лиге
            const canMoveUp = league !== currentLeague && rating >= (LEAGUE_DATA[currentLeague]?.min || 60) - 5;
            const isTransferYear = (a - lastTransferAge) >= 2;

            if (canMoveUp && Math.random() < 0.45) {
                // Скачок в целевую лигу
                const newClub = randomClubIn(currentLeague);
                if (newClub) {
                    club = newClub;
                    league = currentLeague;
                    lastTransferAge = a;
                }
            } else if (isTransferYear && Math.random() < 0.30) {
                // Трансфер внутри текущей лиги
                const newClub = randomClubIn(league);
                if (newClub && newClub !== club) {
                    club = newClub;
                    lastTransferAge = a;
                }
            }
        }

        if (!club) club = currentClub;
        if (!league) league = currentLeague;
        simClub = club;
        simLeague = league;

        // === СТАТИСТИКА СЕЗОНА ===
        const gp = randomInt(40, 82);
        let goals = 0, assists = 0, pim = 0, plusMinus = 0;
        let goalsAgainst = 0, gaa = '—';

        if (player.position === 'G') {
            goalsAgainst = randomInt(80, 200);
            gaa = (goalsAgainst / gp).toFixed(2);
            pim = randomInt(0, 20);
        } else if (player.position === 'D') {
            goals = Math.max(0, Math.round(gp * (0.03 + rating / 2500)) + randomInt(-3, 3));
            assists = Math.max(0, Math.round(gp * (0.20 + rating / 900)) + randomInt(-5, 5));
            pim = randomInt(20, 120);
            plusMinus = randomInt(-15, 25);
        } else {
            goals = Math.max(0, Math.round(gp * (0.20 + rating / 500)) + randomInt(-5, 5));
            assists = Math.max(0, Math.round(gp * (0.30 + rating / 600)) + randomInt(-5, 5));
            pim = randomInt(5, 60);
            plusMinus = randomInt(-12, 30);
        }

        history.push({
            season, club, league, gp,
            goals, assists, pim, plusMinus,
            rating,
            goalsAgainst, gaa,
            avgRating: (6.2 + Math.random() * 1.5).toFixed(1),
            age: a,
            salary: calculateSalary(rating, league),
            position: player.position
        });
    }

    player.seasonHistory = history;
}

// Таблица стран для известных реальных игроков.
// Нужна потому, что guessNationalityByName по фамилии ошибается,
// например Auston Matthews → Canada, хотя он американец.
const REAL_PLAYER_FLAGS = {
    // 🇺🇸 США
    "Auston Matthews": "🇺🇸", "Jack Eichel": "🇺🇸", "Chris Kreider": "🇺🇸",
    "Charlie McAvoy": "🇺🇸", "Matthew Tkachuk": "🇺🇸", "Brady Tkachuk": "🇺🇸",
    "Quinn Hughes": "🇺🇸", "Jack Hughes": "🇺🇸", "Luke Hughes": "🇺🇸",
    "Jake Oettinger": "🇺🇸", "Adam Fox": "🇺🇸", "Kyle Connor": "🇺🇸",
    "Clayton Keller": "🇺🇸", "J.T. Miller": "🇺🇸", "Brock Boeser": "🇺🇸",
    "Zach Werenski": "🇺🇸", "Seth Jones": "🇺🇸", "Jake Guentzel": "🇺🇸",
    "Dylan Larkin": "🇺🇸", "Trevor Zegras": "🇺🇸", "Cole Caufield": "🇺🇸",
    "Alex DeBrincat": "🇺🇸", "Patrick Kane": "🇺🇸", "Jason Robertson": "🇺🇸",
    "Jake Sanderson": "🇺🇸", "Tage Thompson": "🇺🇸", "Connor Hellebuyck": "🇺🇸",
    "John Carlson": "🇺🇸", "Brock Nelson": "🇺🇸", "Anders Lee": "🇺🇸",
    "Nick Leddy": "🇺🇸", "Brady Skjei": "🇺🇸", "Jaccob Slavin": "🇺🇸",
    "Seth Jarvis": "🇺🇸", "Noah Hanifin": "🇺🇸", "Trevor Moore": "🇺🇸",
    "Troy Terry": "🇺🇸", "Cam Fowler": "🇺🇸", "Neal Pionk": "🇺🇸",
    "K'Andre Miller": "🇺🇸", "Brock Faber": "🇺🇸", "Joel Farabee": "🇺🇸",
    "Mason McTavish": "🇺🇸", "Cutter Gauthier": "🇺🇸", "Matty Beniers": "🇺🇸",
    "Alex Turcotte": "🇺🇸", "Matthew Knies": "🇺🇸", "Joseph Woll": "🇺🇸",
    "Kyle Palmieri": "🇺🇸", "Tyson Foerster": "🇺🇸", "Owen Tippett": "🇨🇦",
    // 🇨🇦 Канада
    "Sidney Crosby": "🇨🇦", "Connor McDavid": "🇨🇦", "Nathan MacKinnon": "🇨🇦",
    "Cale Makar": "🇨🇦", "Mitch Marner": "🇨🇦", "Brayden Point": "🇨🇦",
    "Mark Stone": "🇨🇦", "Carey Price": "🇨🇦", "Steven Stamkos": "🇨🇦",
    "Ryan O'Reilly": "🇨🇦", "Drew Doughty": "🇨🇦", "Corey Perry": "🇨🇦",
    "Brad Marchand": "🇨🇦", "Patrice Bergeron": "🇨🇦", "Jamie Benn": "🇨🇦",
    "Tyler Seguin": "🇨🇦", "Logan Couture": "🇨🇦", "Brent Burns": "🇨🇦",
    "Alex Pietrangelo": "🇨🇦", "Shea Theodore": "🇨🇦", "Brayden McNabb": "🇨🇦",
    "Josh Morrissey": "🇨🇦", "Mark Scheifele": "🇨🇦", "Bo Horvat": "🇨🇦",
    "Mathew Barzal": "🇨🇦", "Ryan Nugent-Hopkins": "🇨🇦", "Darnell Nurse": "🇨🇦",
    "Zach Hyman": "🇨🇦", "Evan Bouchard": "🇨🇦", "Sam Reinhart": "🇨🇦",
    "Aaron Ekblad": "🇨🇦", "Carter Verhaeghe": "🇨🇦", "Dougie Hamilton": "🇨🇦",
    "Morgan Rielly": "🇨🇦", "John Tavares": "🇨🇦", "Max Domi": "🇨🇦",
    "Devon Levi": "🇨🇦", "Jordan Binnington": "🇨🇦", "Cam Talbot": "🇨🇦",
    "Logan Thompson": "🇨🇦", "Mackenzie Blackwood": "🇨🇦", "Adin Hill": "🇨🇦",
    "Darcy Kuemper": "🇨🇦", "Stuart Skinner": "🇨🇦", "Lawson Crouse": "🇨🇦",
    "Dylan Guenther": "🇨🇦", "Barrett Hayton": "🇨🇦", "Brett Pesce": "🇺🇸",
    // 🇸🇪 Швеция
    "Elias Pettersson": "🇸🇪", "Victor Hedman": "🇸🇪", "Mika Zibanejad": "🇸🇪",
    "Filip Forsberg": "🇸🇪", "William Karlsson": "🇸🇪", "Rasmus Dahlin": "🇸🇪",
    "Erik Karlsson": "🇸🇪", "Gabriel Landeskog": "🇸🇪", "William Nylander": "🇸🇪",
    // 🇫🇮 Финляндия
    "Aleksander Barkov": "🇫🇮", "Mikko Rantanen": "🇫🇮", "Sebastian Aho": "🇫🇮",
    "Patrik Laine": "🇫🇮", "Teuvo Teräväinen": "🇫🇮", "Juuse Saros": "🇫🇮",
    // 🇨🇿 Чехия / 🇸🇰 Словакия
    "David Pastrnak": "🇨🇿", "Ondrej Palat": "🇨🇿", "Jakub Voracek": "🇨🇿",
    "Martin Necas": "🇨🇿", "Radko Gudas": "🇨🇿",
    "Erik Cernak": "🇸🇰", "Juraj Slafkovsky": "🇸🇰",
    // 🇩🇪 Германия / 🇨🇭 Швейцария
    "Leon Draisaitl": "🇩🇪", "Moritz Seider": "🇩🇪", "Tim Stützle": "🇩🇪",
    "Nico Hischier": "🇨🇭", "Roman Josi": "🇨🇭", "Timo Meier": "🇨🇭",
    // 🇷🇺 Россия
    "Alexander Ovechkin": "🇷🇺", "Evgeni Malkin": "🇷🇺", "Nikita Kucherov": "🇷🇺",
    "Andrei Vasilevskiy": "🇷🇺", "Artemi Panarin": "🇷🇺", "Kirill Kaprizov": "🇷🇺",
    "Igor Shesterkin": "🇷🇺", "Vladimir Tarasenko": "🇷🇺", "Sergei Bobrovsky": "🇷🇺",
    "Pavel Buchnevich": "🇷🇺", "Ilya Sorokin": "🇷🇺", "Mikhail Sergachev": "🇷🇺",
    "Valeri Nichushkin": "🇷🇺", "Dmitry Orlov": "🇷🇺"
};

function createRealPlayer(data, club, league) {
    const name = toLatin(data.name);
    const position = data.pos;
    const rating = data.rating;
    const age = data.age;
    const knownFlag = REAL_PLAYER_FLAGS[name] || null;

    // Пик драфта — по рейтингу (та же логика что в createPlayer)
    let draftRound = 0, draftPickNum = 0;
    if (rating >= 85) { draftRound = 1; draftPickNum = randomInt(1, 10); }
    else if (rating >= 75) { draftRound = 1; draftPickNum = randomInt(11, 30); }
    else if (rating >= 65) { draftRound = 2; draftPickNum = randomInt(31, 60); }
    else if (rating >= 55) { draftRound = 2; draftPickNum = randomInt(61, 64); }
    const draftYear = currentSeason - age + 18;
    const draftInfo = draftRound > 0 ? `R${draftRound} Pick ${draftPickNum}` : '';

    // Потенциал: реальные игроки уже сформированы, потенциал = rating + небольшой запас
    // Молодые получают больший потенциал
    let potentialBonus = 3;
    if (age <= 21) potentialBonus = randomInt(10, 20);
    else if (age <= 25) potentialBonus = randomInt(5, 12);
    else if (age <= 29) potentialBonus = randomInt(2, 6);
    const potential = Math.min(100, rating + potentialBonus);

    const _player = {
        name, nationality: knownFlag, club, league, position, age, rating,
        draftInfo, draftYear,
        clubLoyalty: club ? randomInt(50, 80) : 0,
        potential,
        cost: Math.max(100, (rating-10)*50),
        salary: calculateSalary(rating, league),
        attributes: generateAttributes(position, rating, name),
        form: 0, injuryWeeks: 0, loyalty: 100,
        contractYears: randomInt(1, 4),
        lastTransferSeason: 0,
        declinedRenewal: false,
        trophies: [],
        awards: [],
        character: randomChoice(['ambitious','calm','pragmatic','capricious','loyal']),
        agentId: null,
        stats:{gp:0,goals:0,assists:0,pim:0,plusMinus:0,ratingSum:0,goalsAgainst:0},
        seasonHistory: []
    };

    generateFakeCareerHistory(_player);
    return _player;
}

// ============ РАСПИСАНИЕ МАТЧЕЙ ============
const WEEKS_IN_SEASON = 52;
const MATCHES_PER_WEEK = 2; // по 2 тура в неделю

function generateRoundRobin(clubs) {
    const teams = [...clubs];
    if (teams.length % 2 === 1) teams.push(null); // bye для нечётного
    const n = teams.length;
    const rounds = [];
    for (let r = 0; r < n - 1; r++) {
        const round = [];
        for (let i = 0; i < n / 2; i++) {
            const home = teams[i];
            const away = teams[n - 1 - i];
            if (home && away) round.push({ home, away });
        }
        rounds.push(round);
        // Ротация: первая команда фиксирована, остальные по кругу
        const last = teams.pop();
        teams.splice(1, 0, last);
    }
    return rounds;
}

function generateLeagueSchedule(leagueKey) {
    const clubs = getAllClubs(leagueKey);
    if (clubs.length < 2) return [];
    const baseRounds = generateRoundRobin(clubs);
    const totalRounds = WEEKS_IN_SEASON * MATCHES_PER_WEEK;
    const schedule = [];
    let roundIdx = 0;
    let flip = false;
    for (let i = 0; i < totalRounds; i++) {
        const week = Math.floor(i / MATCHES_PER_WEEK) + 1;
        const baseRound = baseRounds[roundIdx % baseRounds.length];
        baseRound.forEach(({ home, away }) => {
            const h = flip ? away : home;
            const a = flip ? home : away;
            schedule.push({
                id: leagueKey + "_w" + week + "_" + h + "_" + a,
                week,
                home: h,
                away: a,
                result: null,
                viewed: false
            });
        });
        roundIdx++;
        if (roundIdx >= baseRounds.length) {
            roundIdx = 0;
            flip = !flip;
        }
    }
    return schedule;
}

function generateAllSchedules() {
    seasonSchedule = {};
    for (const lk of Object.keys(LEAGUE_DATA)) {
        seasonSchedule[lk] = generateLeagueSchedule(lk);
    }
    if (window.DEBUG) console.log("📅 Расписание создано для " + Object.keys(seasonSchedule).length + " лиг");
}

// ============ КУБОК ЧЕМПИОНОВ ============
const WC_DYNAMIC_LEAGUES = ['KHL', 'SHL', 'Liiga', 'NL_Switzerland', 'Czech_Extraliga', 'DEL', 'Belarus_Extraliga'];
const WC_STATIC_LEAGUES = { 'AHL': 2, 'ICE_HL': 2 };
const WC_START_DYNAMIC = 4;
const WC_DYNAMIC_MIN = 2;
const WC_DYNAMIC_MAX = 6;
const WC_REGULAR_WEEKS = 30;
const WC_PLAYOFF_WEEKS = 4;
const WC_CONF_SIZE = 16;
const WC_PLAYOFF_SPOTS = 8;

function getWorldCupSlots() {
    if (worldCupState && worldCupState.slots) return worldCupState.slots;
    const slots = {};
    WC_DYNAMIC_LEAGUES.forEach(lk => slots[lk] = WC_START_DYNAMIC);
    Object.keys(WC_STATIC_LEAGUES).forEach(lk => slots[lk] = WC_STATIC_LEAGUES[lk]);
    return slots;
}

function selectWorldCupTeams() {
    const slots = getWorldCupSlots();
    const teams = [];

    for (const [lk, count] of Object.entries(slots)) {
        let selected = [];

        if (lk === 'AHL' || lk === 'ICE_HL') {
            const hist = championsHistory[lk] || [];
            const lastSeason = hist.find(h => h.season === currentSeason - 1);
            if (lastSeason && lastSeason.champion) {
                selected.push(lastSeason.champion);
                if (lastSeason.finalist && selected.length < count) {
                    selected.push(lastSeason.finalist);
                }
            }
        } else {
            const allClubs = getAllClubs(lk);
            const rows = allClubs.map(club => {
                const key = lk + "_" + club;
                const posList = (clubSeasonPositions[key] || [])
                    .filter(p => p.season === currentSeason - 1);
                return { club, place: posList.length > 0 ? posList[0].place : null };
            });
            rows.sort((a, b) => {
                if (a.place === null && b.place === null) return 0;
                if (a.place === null) return 1;
                if (b.place === null) return -1;
                return a.place - b.place;
            });
            selected = rows.slice(0, count).map(p => p.club);
        }

        if (selected.length < count) {
            const byPrestige = getAllClubs(lk)
                .filter(c => !selected.includes(c))
                .sort((a, b) => {
                    const pa = clubData[lk + "_" + a]?.prestige || 50;
                    const pb = clubData[lk + "_" + b]?.prestige || 50;
                    return pb - pa;
                });
            while (selected.length < count && byPrestige.length > 0) {
                selected.push(byPrestige.shift());
            }
        }

        selected.forEach(club => teams.push({ club, league: lk }));
    }

    return teams;
}

function splitWorldCupConferences(teams) {
    // Разделяем на 3 группы: AHL (2), ICE_HL (2), динамические (28)
    const ahl = teams.filter(t => t.league === 'AHL');
    const ice = teams.filter(t => t.league === 'ICE_HL');
    const dynamic = teams.filter(t => t.league !== 'AHL' && t.league !== 'ICE_HL');

    // Динамические — по престижу
    dynamic.sort((a, b) => {
        const pa = clubData[a.league + "_" + a.club]?.prestige || 50;
        const pb = clubData[b.league + "_" + b.club]?.prestige || 50;
        return pb - pa;
    });

    const confA = [], confB = [];

    // AHL: по одному в каждую
    if (ahl[0]) confA.push(ahl[0]);
    if (ahl[1]) confB.push(ahl[1]);

    // ICE_HL: по одному в каждую
    if (ice[0]) confA.push(ice[0]);
    if (ice[1]) confB.push(ice[1]);

    // Динамические — змейкой
    dynamic.forEach((t, i) => {
        if (i % 2 === 0) confA.push(t); else confB.push(t);
    });

    return { A: confA, B: confB };
}

function generateWorldCupSchedule(confTeams, confId) {
    const clubs = confTeams.map(t => t.club);
    const baseRounds = generateRoundRobin(clubs);
    const schedule = [];
    for (let w = 1; w <= WC_REGULAR_WEEKS; w++) {
        const round = baseRounds[(w - 1) % baseRounds.length];
        const flip = Math.floor((w - 1) / baseRounds.length) % 2 === 1;
        round.forEach(m => {
            schedule.push({
                week: w,
                conference: confId,
                home: flip ? m.away : m.home,
                away: flip ? m.home : m.away,
                result: null
            });
        });
    }
    return schedule;
}

// ============ 8. ГЕНЕРАЦИЯ ВСЕХ ИГРОКОВ ============
// Гарантирует уникальность имён среди всех игроков мира.
// Критично: сейв и ростер ищут игроков по имени.
function ensureUniquePlayerNames() {
    const seen = new Set();
    players.forEach(p => {
        if (!p || !p.name) return;
        if (!seen.has(p.name)) { seen.add(p.name); return; }
        let newName = '';
        for (let attempt = 0; attempt < 12; attempt++) {
            const g = generatePlayerName(p.league || 'NHL');
            if (!seen.has(g.name)) { newName = g.name; break; }
        }
        if (!newName) newName = 'Player ' + (seen.size + 1);
        p.name = newName;
        seen.add(newName);
    });
}

function generateAllPlayers() {
    const allPlayers = [];
    GLOBAL_USED_NAMES.clear();
    for (const [leagueName, leagueData] of Object.entries(LEAGUE_DATA)) {
        const clubs = getAllClubs(leagueName);
        clubs.forEach(club => {
            // Проверяем: есть ли реальный состав для этого клуба
            const hasReal = datapackActive
                && typeof REAL_ROSTERS !== 'undefined'
                && REAL_ROSTERS[leagueName]
                && REAL_ROSTERS[leagueName][club]
                && REAL_ROSTERS[leagueName][club].players
                && REAL_ROSTERS[leagueName][club].players.length > 0;

            if (hasReal) {
                // ===== РЕАЛЬНЫЕ ИГРОКИ =====
                const clubStart = allPlayers.length;
                REAL_ROSTERS[leagueName][club].players.forEach(pd => {
                    // Защита от дублей в датапаке: если такой игрок уже добавлен
                    // в другой клуб, создаём замену с тем же уровнем и позицией
                    if (GLOBAL_USED_NAMES.has(pd.name)) {
                        let repName = '', repNat = null;
                        for (let attempt = 0; attempt < 10; attempt++) {
                            const g = generatePlayerName(leagueName);
                            if (!GLOBAL_USED_NAMES.has(g.name)) { repName = g.name; repNat = g.nationality; break; }
                        }
                        if (!repName) repName = 'Player ' + (allPlayers.length + 1);
                        GLOBAL_USED_NAMES.add(repName);
                        allPlayers.push(createPlayer(repName, club, leagueName, pd.pos, pd.age, pd.rating, null, repNat));
                        return;
                    }
                    GLOBAL_USED_NAMES.add(pd.name);
                    allPlayers.push(createRealPlayer(pd, club, leagueName));
                });
                padRealRoster(allPlayers, clubStart, club, leagueName, leagueData);
            } else {
                // ===== ГЕНЕРАЦИЯ (как раньше) =====
                const template = ["G","G","D","D","D","D","D","D","C","C","C","LW","LW","LW","RW","RW","RW"];
                template.forEach(position => {
                    const { name, nationality } = generatePlayerName(leagueName);
                    const baseRating = randomInt(leagueData.min, leagueData.max);
                    const rating = Math.max(1, Math.min(100, baseRating + randomInt(-5, 5)));
                    let age;
                    if (leagueName === "MHL" || leagueName === "Belarus_Vysshaya") age = randomInt(14, 20);
                    else if (leagueName === "NHL") age = randomInt(19, 35);
                    else age = randomInt(16, 34);
                    allPlayers.push(createPlayer(name, club, leagueName, position, age, rating, null, nationality));
                });
            }
        });
    }
    ensureUniquePlayerNames();
    return allPlayers;
}
// Добивает короткий реальный состав до 17 игроков процедурными,
// придерживаясь шаблона позиций (2G / 6D / 3C / 3LW / 3RW).
function padRealRoster(allPlayers, clubStart, club, leagueName, leagueData) {
    const template = ["G","G","D","D","D","D","D","D","C","C","C","LW","LW","LW","RW","RW","RW"];
    const needCounts = {};
    template.forEach(pos => { needCounts[pos] = (needCounts[pos] || 0) + 1; });
    const have = {};
    let total = 0;
    for (let i = clubStart; i < allPlayers.length; i++) {
        const p = allPlayers[i];
        if (p.league !== leagueName || p.club !== club) continue;
        have[p.position] = (have[p.position] || 0) + 1;
        total++;
    }
    if (total >= 17) return;
    for (const position of template) {
        if (total >= 17) break;
        if ((have[position] || 0) >= needCounts[position]) continue;
        let name = '', nationality = null;
        for (let attempt = 0; attempt < 10; attempt++) {
            const g = generatePlayerName(leagueName);
            if (!GLOBAL_USED_NAMES.has(g.name)) { name = g.name; nationality = g.nationality; break; }
        }
        if (!name) name = 'Player ' + (allPlayers.length + 1);
        GLOBAL_USED_NAMES.add(name);
        const baseRating = randomInt(leagueData.min, leagueData.max);
        const rating = Math.max(1, Math.min(100, baseRating + randomInt(-5, 5)));
        const age = (leagueName === "MHL" || leagueName === "Belarus_Vysshaya") ? randomInt(14, 20) : randomInt(18, 30);
        allPlayers.push(createPlayer(name, club, leagueName, position, age, rating, null, nationality));
        have[position] = (have[position] || 0) + 1;
        total++;
    }
}

// ============ 9. NPC-АГЕНТСТВА (50 компаний) ============
const NPC_AGENCY_TEMPLATES = [
    { name:"«Северный Лёд»", country:"🇷🇺 RU", rep:95, desc:"Агрессивные, идут напролом." },
    { name:"Maple Sports Group", country:"🇨🇦 CA", rep:93, desc:"Классическая канадская школа." },
    { name:"Elite Athletes Inc.", country:"🇺🇸 US", rep:92, desc:"Богатые, скупают всех." },
    { name:"Nordic Talent Group", country:"🇸🇪 SE", rep:90, desc:"Строят карьеры вдолгую." },
    { name:"Alpine Sports AG", country:"🇨🇭 CH", rep:88, desc:"Премиум-сегмент." },
    { name:"Ice Hunters Oy", country:"🇫🇮 FI", rep:87, desc:"Находят таланты везде." },
    { name:"Bohemia Hockey s.r.o.", country:"🇨🇿 CZ", rep:85, desc:"Опытные, 30 лет на рынке." },
    { name:"«Красная Линия»", country:"🇷🇺 RU", rep:84, desc:"Работают с топ-клубами." },
    { name:"Eis Bären Management", country:"🇩🇪 DE", rep:82, desc:"Немецкая педантичность." },
    { name:"Tatra Agency", country:"🇸🇰 SK", rep:80, desc:"Молодые и дерзкие." },
    { name:"«Зубр Спорт»", country:"🇧🇾 BY", rep:78, desc:"Специалисты по СНГ." },
    { name:"Helsinki Stars", country:"🇫🇮 FI", rep:76, desc:"Финская школа." },
    { name:"«Уральские Медведи»", country:"🇷🇺 RU", rep:75, desc:"Сильные связи на Урале." },
    { name:"Viking Hockey Group", country:"🇸🇪 SE", rep:73, desc:"Шведский подход." },
    { name:"Prague Elite", country:"🇨🇿 CZ", rep:72, desc:"Чешские мастера." },
    { name:"Northern Lights Sports", country:"🇨🇦 CA", rep:70, desc:"Канадская школа." },
    { name:"Great Lakes Hockey Mgmt", country:"🇺🇸 US", rep:68, desc:"Средний Запад США." },
    { name:"Berlin Ice Consulting", country:"🇩🇪 DE", rep:67, desc:"Германия-Австрия." },
    { name:"Geneva Hockey Group", country:"🇨🇭 CH", rep:66, desc:"Премиум." },
    { name:"Vienna Sports Agency", country:"🇦🇹 AT", rep:64, desc:"Австрийская школа." },
    { name:"Fjord Hockey AS", country:"🇳🇴 NO", rep:62, desc:"Норвежские таланты." },
    { name:"Copenhagen Ice Partners", country:"🇩🇰 DK", rep:60, desc:"Скандинавия." },
    { name:"Étoile du Nord Hockey", country:"🇫🇷 FR", rep:58, desc:"Франция и Бельгия." },
    { name:"Baltic Ice Riga", country:"🇱🇻 LV", rep:57, desc:"Балтийские таланты." },
    { name:"Vilnius Hockey Group", country:"🇱🇹 LT", rep:56, desc:"Литва." },
    { name:"Tallinn Sports Agency", country:"🇪🇪 EE", rep:55, desc:"Эстония." },
    { name:"Astana Stars", country:"🇰🇿 KZ", rep:53, desc:"Казахстан." },
    { name:"Bratislava Elite", country:"🇸🇰 SK", rep:52, desc:"Словацкая школа." },
    { name:"«Сибирь Спорт»", country:"🇷🇺 RU", rep:51, desc:"Сибирский регион." },
    { name:"«Полесье Спорт»", country:"🇧🇾 BY", rep:50, desc:"Беларусь." },
    { name:"«Таланты Сибири»", country:"🇷🇺 RU", rep:48, desc:"Молодые дарования." },
    { name:"Budapest Ice Mgmt", country:"🇭🇺 HU", rep:46, desc:"Венгрия." },
    { name:"Ljubljana Hockey", country:"🇸🇮 SI", rep:44, desc:"Словения." },
    { name:"London Ice Sports", country:"🇬🇧 GB", rep:42, desc:"Британия." },
    { name:"«Дальний Восток Спорт»", country:"🇷🇺 RU", rep:40, desc:"Дальний Восток." },
    { name:"Tokyo Ice Agency", country:"🇯🇵 JP", rep:38, desc:"Япония." },
    { name:"Beijing Hockey Group", country:"🇨🇳 CN", rep:36, desc:"Китай." },
    { name:"Seoul Ice Partners", country:"🇰🇷 KR", rep:34, desc:"Корея." },
    { name:"«Молодёжь Урала»", country:"🇷🇺 RU", rep:32, desc:"Уральская молодёжь." },
    { name:"«Сибирский Скаут»", country:"🇷🇺 RU", rep:30, desc:"Скаутинг в Сибири." },
    { name:"«Неман Спорт»", country:"🇧🇾 BY", rep:28, desc:"Западная Беларусь." },
    { name:"Steppe Hockey", country:"🇰🇿 KZ", rep:26, desc:"Степной регион." },
    { name:"Kyiv Hockey Agency", country:"🇺🇦 UA", rep:24, desc:"Украина." },
    { name:"«Хоккейные Таланты»", country:"🇷🇺 RU", rep:22, desc:"Молодые агенты." },
    { name:"Chisinau Ice Sport", country:"🇲🇩 MD", rep:20, desc:"Молдова." },
    { name:"Tbilisi Hockey Group", country:"🇬🇪 GE", rep:19, desc:"Грузия." },
    { name:"Yerevan Ice Stars", country:"🇦🇲 AM", rep:18, desc:"Армения." },
    { name:"Tashkent Sports", country:"🇺🇿 UZ", rep:17, desc:"Узбекистан." },
    { name:"«Мурманск Хоккей»", country:"🇷🇺 RU", rep:16, desc:"Север России." },
    { name:"«Камчатка Спорт»", country:"🇷🇺 RU", rep:15, desc:"Камчатка." }
];

function generateNpcAgencies() {
    const agencies = [];
    for (let i = 0; i < NPC_AGENCY_TEMPLATES.length; i++) {
        const t = NPC_AGENCY_TEMPLATES[i];
        const clientMin = t.rep >= 80 ? 80 : t.rep >= 50 ? 25 : 5;
        const clientMax = t.rep >= 80 ? 120 : t.rep >= 50 ? 50 : 15;
        agencies.push({
            id: i,
            name: t.name,
            country: t.country,
            rep: t.rep,
            description: t.desc,
            budget: Math.round(t.rep * t.rep * 100 + randomInt(0, 50000)),
            clients: randomInt(clientMin, clientMax),
            clientIds: []
        });
    }
    return agencies;
}

function assignPlayersToNpcAgencies() {
    const freePlayers = players.filter(p => !p.agentId);
    for (let i = freePlayers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [freePlayers[i], freePlayers[j]] = [freePlayers[j], freePlayers[i]];
    }
    let assigned = 0;
    const targetAssigned = Math.min(2000, Math.floor(freePlayers.length / 2));
    npcAgencies.forEach(agency => {
        const share = agency.rep / 2000;
        const count = Math.min(Math.floor(targetAssigned * share * 1.5), agency.clients);
        for (let i = 0; i < count && assigned < targetAssigned; i++) {
            const p = freePlayers[assigned];
            if (!p) break;
            p.agentId = agency.id;
            agency.clientIds.push(p.name);
            assigned++;
        }
    });
    if (window.DEBUG) console.log(`✅ Распределено по агентствам: ${assigned} игроков`);
}

// ============ 10. ЭКОНОМИКА КЛУБОВ ============
function getLeagueStockMultiplier(lk){
    const m = {"NHL":12,"NL_Switzerland":4,"SHL":3,"AHL":3,"KHL":1.5,"Liiga":2,"Czech_Extraliga":2,"DEL":2,"ICE_HL":1,"Belarus_Extraliga":0.5,"VHL":0.3,"MHL":0.1,"Belarus_Vysshaya":0.05};
    return m[lk] || 1;
}

// ============ ПРОВЕРКА ЦЕЛЕЙ ============
// Реальная репутация агента в мировом рейтинге
function getMyAgentReputation() {
    let rep = (upgrades.reputation || 1) * 3;
    myRoster.forEach(p => {
        if (p.rating >= 90) rep += 6;
        else if (p.rating >= 85) rep += 4;
        else if (p.rating >= 75) rep += 2;
        else if (p.rating >= 65) rep += 1;
        else rep += 0.5;
    });
    rep += (careerCounters.cupsWon || 0) * 3;
    rep += Object.keys(closedAgencies || {}).length * 4;
    rep += (careerCounters.poachSuccess || 0) * 1;
    return Math.round(rep);
}

function getNpcTopReputation() {
    if (!npcAgencies || npcAgencies.length === 0) return 100;
    return npcAgencies.reduce((m, a) => Math.max(m, a.rep), 0);
}

// Сколько молодых клиентов (до 25 лет) достигли указанного рейтинга.
// Используется целями ветки «Наставник».
function countYoungReached(threshold) {
    const seen = {};
    let count = 0;
    myRoster.forEach(p => {
        if (p.age > 25) return;
        if ((p.rating || 0) < threshold) return;
        const key = p.name;
        if (seen[key]) return;
        seen[key] = true;
        count++;
    });
    return count;
}

// Счётчик всех когда-либо подписанных клиентов (для статистики/будущих целей)
function incrementClientsSigned() {
    if (!careerCounters) return;
    careerCounters.clientsEverSigned = (careerCounters.clientsEverSigned || 0) + 1;
}

function getGoalProgress(checkType) {    if (checkType === 'roster') return myRoster.length;
    if (checkType === 'money') return agentMoney;
    if (checkType === 'transfers') return careerCounters.transfersDone || 0;
    if (checkType === 'clients_in_nhl') return myRoster.filter(p => p.league === 'NHL').length;
    if (checkType === 'portfolio_total') {
        let total = 0;
        for (const k of Object.keys(myPortfolio)) total += myPortfolio[k].shares;
        return Math.round(total);
    }
    if (checkType === 'portfolio_count') return Object.keys(myPortfolio).length;
    if (checkType === 'has_president') return presidentClubKey ? 1 : 0;
    if (checkType === 'client_goals') return myRoster.reduce((s, p) => s + (p.stats?.goals || 0) + (p.seasonHistory || []).reduce((ss, sh) => ss + (sh.goals || 0), 0), 0);
    if (checkType === 'trophies_total') {
        let total = 0;
        myRoster.forEach(p => total += (p.trophies || []).length);
        return total;
    }
    if (checkType === 'cups_won') return careerCounters.cupsWon || 0;
    if (checkType === 'client_90') return myRoster.filter(p => p.rating >= 90).length;
    if (checkType === 'client_top10') {
        for (const p of myRoster) {
            if (!p.club || !p.league) continue;
            const leagueMates = players.filter(x =>
                x.league === p.league && x.club && x.name !== p.name
            );
            const allInLeague = [...leagueMates, p];
            const ptsOf = (x) => {
                let s = (x.stats?.goals || 0) + (x.stats?.assists || 0);
                (x.seasonHistory || []).forEach(h => s += (h.goals || 0) + (h.assists || 0));
                return s;
            };
            const sorted = allInLeague.sort((a, b) => ptsOf(b) - ptsOf(a));
            const idx = sorted.findIndex(x => x.name === p.name);
            if (idx >= 0 && idx < 10) return 1;
        }
        return 0;
    }
    if (checkType === 'clients_1000games') {
        let count = 0;
        myRoster.forEach(p => {
            let totalGP = p.stats?.gp || 0;
            (p.seasonHistory || []).forEach(h => totalGP += h.gp || 0);
            if (totalGP >= 1000) count++;
        });
        return count;
    }
    if (checkType === 'poach_attempts') {
        let total = 0;
        for (const k of Object.keys(agencyPoachAttempts)) total += agencyPoachAttempts[k];
        return total;
    }
    if (checkType === 'poach_success') return careerCounters.poachSuccess || 0;
    if (checkType === 'closed_agencies') return Object.keys(closedAgencies).length;
    if (checkType === 'poach_top') return careerCounters.poachTopSuccess || 0;
    if (checkType === 'top_agent_rank') {
        const myRep = getMyAgentReputation();
        const topNpc = getNpcTopReputation();
        return myRep > topNpc ? 1 : 0;
    }
    if (checkType === 'roster_youth') return myRoster.filter(p => p.age <= 17).length;
    if (checkType === 'young_reached_50') return Math.max(careerCounters.youngReached50 || 0, countYoungReached(50));
    if (checkType === 'young_reached_70') return Math.max(careerCounters.youngReached70 || 0, countYoungReached(70));
    if (checkType === 'young_reached_90') return Math.max(careerCounters.youngReached90 || 0, countYoungReached(90));
    if (checkType === 'young_in_nhl') return myRoster.filter(p => p.league === 'NHL' && p.age <= 25).length;
    if (checkType === 'young_80_count') return myRoster.filter(p => p.rating >= 80 && p.age <= 23).length;
    if (checkType === 'countries_count') {
        const set = new Set();
        myRoster.forEach(p => set.add(getPlayerCountry(p)));
        return set.size;
    }
    if (checkType === 'leagues_count') {
        const set = new Set();
        myRoster.forEach(p => { if (p.league) set.add(p.league); });
        return set.size;
    }
    if (checkType === 'news_count') return newsFeed.length;
    if (checkType === 'news_negative') return newsFeed.filter(n => n.type === 'negative').length;
    if (checkType === 'seasons_as_president') return careerCounters.seasonsAsPresident || 0;
    if (checkType === 'infra_avg') {
        if (!presidentClubKey) return 0;
        const c = clubData[presidentClubKey];
        return c ? parseFloat(getClubUpgradesAvg(c)) : 0;
    }
    if (checkType === 'club_top4') {
        if (!presidentClubKey) return 0;
        const c = clubData[presidentClubKey];
        if (!c || !standings[c.league]) return 0;
        const sorted = standings[c.league].slice().sort(sortStandingsFn);
        const idx = sorted.findIndex(t => t.club === c.club);
        return (idx >= 0 && idx < 4) ? 1 : 0;
    }
    if (checkType === 'club_titles') {
        if (!presidentClubKey) return 0;
        const c = clubData[presidentClubKey];
        if (!c) return 0;
        const hist = championsHistory[c.league] || [];
        return hist.filter(h => h.champion === c.club).length;
    }
    return 0;
}

function checkAllGoals() {
    if (!careerGoals) careerGoals = {};
    let anyNew = false;
    let changed = true;
    // v1.0: while-цикл вместо рекурсии — проверяем ветки, пока хоть где-то есть прогресс
    while (changed) {
        changed = false;
        for (const branch of Object.keys(CAREER_GOALS)) {
            if (!careerGoals[branch]) careerGoals[branch] = 0;
            const goals = CAREER_GOALS[branch];
            // Проверяем цели ветки подряд, пока выполняется текущая
            let advanced = true;
            while (advanced && careerGoals[branch] < goals.length) {
                const nextGoal = goals[careerGoals[branch]];
                const progress = getGoalProgress(nextGoal.check);
                if (progress >= nextGoal.target) {
                    careerGoals[branch]++;
                    anyNew = true;
                    changed = true;
                    advanced = true;
                    // Награда
                    if (nextGoal.reward) {
                        if (nextGoal.reward.xp) addXP(nextGoal.reward.xp);
                        if (nextGoal.reward.money) {
                            const cut = Math.round(nextGoal.reward.money / 5);
                            agentMoney += cut;
                            addNews(`💰 Награда за цель: +$${cut.toLocaleString()}`, "info");
                        }
                        if (nextGoal.reward.slot) upgrades.office = Math.min(25, upgrades.office + nextGoal.reward.slot);
                        if (nextGoal.reward.rep) upgrades.reputation = Math.min(25, upgrades.reputation + nextGoal.reward.rep);
                        if (nextGoal.reward.title) addNews(`🏅 Получен титул: ${nextGoal.reward.title}`, "positive");
                    }
                    addNews(`🎯 Цель выполнена: ${nextGoal.title} (${GOAL_BRANCH_NAMES[branch].name})`, "positive");
                } else {
                    advanced = false;
                }
            }
        }
    }
    if (anyNew) saveGame();
    return anyNew;
}

function generateClubData() {
    clubData = {};
    const leagueBudgets = {"NHL":100000000,"AHL":15000000,"KHL":30000000,"VHL":3000000,"MHL":500000,"Belarus_Extraliga":5000000,"Belarus_Vysshaya":500000,"SHL":20000000,"Liiga":15000000,"Czech_Extraliga":12000000,"DEL":15000000,"NL_Switzerland":25000000,"ICE_HL":8000000};
    for (const [lk, ld] of Object.entries(LEAGUE_DATA)) {
        const clubs = getAllClubs(lk);
        const basePrestige = Math.round((ld.min + ld.max) / 2);
        clubs.forEach(club => {
            const key = lk + "_" + club;
            // Престиж из реальных данных — только если датапак активирован
            const realData = (datapackActive && typeof REAL_ROSTERS !== 'undefined' && REAL_ROSTERS[lk] && REAL_ROSTERS[lk][club]) || null;
            const prestige = (realData && realData.prestige)
                ? realData.prestige
                : Math.max(20, Math.min(99, basePrestige + randomInt(-10, 10)));
            const bb = leagueBudgets[lk] || 1000000;
            const budget = Math.round(bb * (0.6 + Math.random() * 0.8));
            const founded = randomInt(1940, 2005);
            const titles = randomInt(0, Math.max(1, Math.floor(prestige / 8)));
            const legends = [];
            for (let i = 0; i < randomInt(2, 4); i++) legends.push(randomChoice(NAME_POOLS.RU.first) + " " + randomChoice(NAME_POOLS.RU.last));
            const bestSeasons = [];
            for (let i = 0; i < 3; i++) bestSeasons.push({year:randomInt(founded+10,2024),points:randomInt(80,140),place:randomInt(1,3)});
            bestSeasons.sort((a, b) => b.points - a.points);
            const stockPrice = Math.round(prestige * 1000 * getLeagueStockMultiplier(lk));
            const stockHistory = [];
            let temp = stockPrice;
            for (let w = 0; w < 10; w++) { temp = Math.round(temp * (0.93 + Math.random() * 0.14)); stockHistory.push(temp); }
            stockHistory.push(stockPrice);
            const upgrades = generateClubUpgrades(prestige);
            clubData[key] = {
                club, league:lk, prestige, budget,
                upgrades,
                founded, titles, legends, bestSeasons, form:[],
                stockPrice, stockHistory, sharesTotal:100,
                weeklyIncome:0, weeklyExpenses:0, weeklyResult:0
            };
        });
    }
}

function simulateClubEconomy() {
    for (const key of Object.keys(clubData)) {
        const c = clubData[key];
        const u = c.upgrades;
        // Билеты — зависят от стадиона и престижа
        const capacity = getStadiumCapacity(u.stadium);
        const tickets = Math.round(c.prestige * 800 * (0.5 + u.stadium * 0.03) * (capacity / 30000));
        // Спонсоры — зависят от маркетинга
        const sponsorCount = getMarketingSponsors(u.marketing);
        const sponsorMult = getMarketingMultiplier(u.marketing);
        const sponsors = Math.round(sponsorCount * 200000 * sponsorMult);
        // ТВ — по лиге
        let tv = 100000;
        if (c.league === "NHL") tv = 3000000;
        else if (c.league === "KHL") tv = 800000;
        else if (c.league === "SHL" || c.league === "NL_Switzerland") tv = 500000;
        else if (c.league === "AHL" || c.league === "Liiga") tv = 300000;
        const income = tickets + sponsors + tv;

        // Расходы — только зарплаты игроков (без infrastructure)
        const cps = players.filter(p => p.club === c.club && p.league === c.league);
        const topSal = [...cps].sort((a,b) => b.salary - a.salary).slice(0,6);
        const salaries = Math.round(topSal.reduce((s,p) => s + p.salary, 0) * 1000 / 52);
        const staff = Math.round((u.training + u.medical + u.scouting) * 20000);
        const expenses = salaries + staff;

        c.budget += income - expenses;
        c.weeklyIncome = income;
        c.weeklyExpenses = expenses;
        c.weeklyResult = income - expenses;

        // Престиж: падает разово при входе в долг, растёт разово при выходе.
        // Без этого клуб мог «упасть» в престиже навсегда, даже когда
        // финансы давно выправились.
        if (c.budget < 0) {
            if (!c._wasInDebt) {
                c.prestige = Math.max(20, c.prestige - 2);
                c._wasInDebt = true;
            }
        } else if (c._wasInDebt && c.budget > 500000) {
            c.prestige = Math.min(99, c.prestige + 1);
            c._wasInDebt = false;
        }
    }
}

function calculateDividends() {
    let total = 0;
    for (const key of Object.keys(myPortfolio)) {
        const h = myPortfolio[key];
        if (h.shares < 51) continue;
        const data = clubData[key];
        if (!data) continue;
        const wr = data.weeklyResult || 0;
        if (wr > 0) {
            // Процент от недельной прибыли клуба, мягко растущий с уровнем агента:
            // Ур.1 = 1.5%, Ур.10 = 2.4%, Ур.20 = 3.3%
            const divPct = 0.015 + (agentLevel - 1) * 0.001;
            const d = Math.round(wr * (h.shares / 100) * divPct);
            if (d > 0) { total += d; addNews(`👑 Дивиденды от ${data.club}: +$${d.toLocaleString()}`, "positive"); }
        }
    }
    if (total > 0) agentMoney += total;
    return total;
}

function getIncomeMultiplier() {
    // Множитель для комиссий с трансферов
    // Ур.1 = ×0.5, Ур.5 = ×1.0, Ур.10 = ×1.7, Ур.15 = ×2.3, Ур.20 = ×3.0
    return 0.3 + agentLevel * 0.15;
}

function getEventMoneyMultiplier() {
    // Множитель для РАЗОВЫХ сумм: событий, цепочек, штрафов, наград за цели.
    // Ур.1 = ×0.08, Ур.5 = ×0.36, Ур.10 = ×0.71, Ур.15 = ×1.06, Ур.20 = ×1.41
    // Рост медленный, чтобы события оставались «приятным бонусом», а не основой дохода.
    return 0.08 + (agentLevel - 1) * 0.07;
}

function scaleEventMoney(amount) {
    return Math.round(amount * getEventMoneyMultiplier());
}

function calculatePassiveIncome() {
    let total = 0;
    myRoster.forEach(p => {
        if (p.injuryWeeks === 0) {
            const leagueMult = {
                'NHL': 1.6, 'KHL': 1.3, 'SHL': 1.2, 'NL_Switzerland': 1.1,
                'Liiga': 1.0, 'AHL': 0.9, 'Czech_Extraliga': 0.9, 'DEL': 0.8,
                'Belarus_Extraliga': 0.7, 'ICE_HL': 0.6, 'VHL': 0.5,
                'MHL': 0.3, 'Belarus_Vysshaya': 0.25
            }[p.league] || 0.6;
            total += p.rating * 10 * leagueMult;
        }
    });
    // Мягкий рост от уровня: Ур.1 = ×0.7, Ур.10 = ×1.15, Ур.20 = ×1.65
    const mult = 0.7 + (agentLevel - 1) * 0.05;
    return Math.round(total * mult);
}
function payTransferCommission(player, oldSalary, newSalary) {
    if (newSalary > oldSalary) {
        let comm = Math.round((newSalary - oldSalary) * 1000 * 0.05 * getIncomeMultiplier());
        // Потолок на разовый трансфер: на низком уровне агента не больше $100K
        const cap = 50000 + agentLevel * 25000;
        if (comm > cap) comm = cap;
        if (comm > 0) { agentMoney += comm; addNews(`💰 Комиссия за переход ${player.name}: +$${comm.toLocaleString()}`, "positive"); }
    }
}

// ============ ЗАДАЧИ СОВЕТА ДИРЕКТОРОВ ============
function generateCouncilTasks(club) {
    const lk = club.league;
    const info = LEAGUE_DATA[lk];
    const positions = clubSeasonPositions[presidentClubKey] || [];
    const lastPlace = positions.length > 0 ? positions[positions.length - 1].place : null;
    const totalTeams = getAllClubs(lk).length;

    const pool = { sport: [], finance: [], roster: [], infra: [], prestige: [] };

    // Спортивные
    pool.sport.push({ check: 'playoff', text: 'Выйти в плей-офф', target: 1 });
    if (lastPlace === null || lastPlace > 4) pool.sport.push({ check: 'top4', text: 'Занять топ-4 в регулярке', target: 4 });
    if (lastPlace === null || lastPlace > 2) pool.sport.push({ check: 'top2', text: 'Занять топ-2 в регулярке', target: 2 });
    if (club.prestige >= 70) pool.sport.push({ check: 'champion', text: 'Выиграть Кубок лиги', target: 1 });

    // Финансовые
    pool.finance.push({ check: 'budget_plus', text: 'Удержать бюджет в плюсе', target: 1 });
    pool.finance.push({ check: 'budget_grow20', text: 'Увеличить бюджет на 20%', target: 1.2 });
    if (club.budget > 3000000) pool.finance.push({ check: 'budget_grow50', text: 'Увеличить бюджет на 50%', target: 1.5 });
    pool.finance.push({ check: 'salary_low60', text: 'Снизить нагрузку ЗП до 60%', target: 60 });

    // Кадровые
    const strongCount = players.filter(p => p.club === club.club && p.league === club.league && p.rating >= 80).length;
    pool.roster.push({ check: 'one_80', text: 'Иметь игрока 80+ в составе', target: 1 });
    if (strongCount >= 1) pool.roster.push({ check: 'two_80', text: 'Иметь 2 игроков 80+', target: 2 });
    if (club.prestige >= 60) pool.roster.push({ check: 'avg_70', text: 'Средний рейтинг команды 70+', target: 70 });

    // Инфраструктура
    pool.infra.push({ check: 'infra_up2', text: 'Улучшить любую карточку на 2 уровня', target: 2 });
    pool.infra.push({ check: 'infra_avg12', text: 'Средний уровень инфраструктуры 12+', target: 12 });
    if (getClubUpgradesAvg(club) >= 10) pool.infra.push({ check: 'infra_avg15', text: 'Средний уровень инфраструктуры 15+', target: 15 });

    // Престиж
    pool.prestige.push({ check: 'prestige_up3', text: 'Поднять престиж на +3', target: 3 });
    pool.prestige.push({ check: 'prestige_no_drop', text: 'Не опустить престиж', target: 0 });
    if (club.prestige >= 75) pool.prestige.push({ check: 'prestige_up5', text: 'Поднять престиж на +5', target: 5 });

    // Выбираем 3 задачи из разных категорий
    const cats = ['sport', 'finance', 'roster', 'infra', 'prestige'];
    const shuffledCats = cats.sort(() => Math.random() - 0.5);
    const picked = [];
    for (const cat of shuffledCats) {
        if (picked.length >= 3) break;
        if (pool[cat].length === 0) continue;
        const pick = randomChoice(pool[cat]);
        picked.push({ ...pick, type: cat, id: cat + '_' + Date.now() + '_' + Math.random(), startValue: null, progress: 0, done: false });
    }

    // Фиксируем startValue
    picked.forEach(t => {
        if (t.check === 'budget_grow20' || t.check === 'budget_grow50') t.startValue = club.budget;
        else if (t.check === 'prestige_up3' || t.check === 'prestige_up5' || t.check === 'prestige_no_drop') t.startValue = club.prestige;
        else if (t.check === 'infra_up2') {
            t.startValue = {};
            Object.keys(CLUB_UPGRADE_CARDS).forEach(k => t.startValue[k] = club.upgrades[k]);
        }
    });

    return picked;
}

function ensureCouncil() {
    if (!presidentClubKey) { clubCouncil = null; return; }
    const club = clubData[presidentClubKey];
    if (!club) { clubCouncil = null; return; }

    // Если совет не создан или для другого сезона — создаём заново
    if (!clubCouncil || clubCouncil.season !== currentSeason || clubCouncil.clubKey !== presidentClubKey) {
        clubCouncil = {
            clubKey: presidentClubKey,
            season: currentSeason,
            tasks: generateCouncilTasks(club),
            loyalty: clubCouncil?.clubKey === presidentClubKey ? (clubCouncil.loyalty ?? 70) : 70,
            failsStreak: clubCouncil?.clubKey === presidentClubKey ? (clubCouncil.failsStreak ?? 0) : 0,
            history: clubCouncil?.clubKey === presidentClubKey ? (clubCouncil.history || []) : []
        };
    }
}

function checkTaskProgress(club, task) {
    if (task.check === 'playoff') {
        const arr = (standings[club.league] || []).slice().sort(sortStandingsFn);
        const idx = arr.findIndex(t => t.club === club.club);
        const spots = (LEAGUE_DATA[club.league].playoffSpots || 4) * (LEAGUE_DATA[club.league].divisions?.length || 1);
        return idx >= 0 && idx < spots ? 1 : 0;
    }
    if (task.check === 'top4' || task.check === 'top2' || task.check === 'champion') {
        const arr = (standings[club.league] || []).slice().sort(sortStandingsFn);
        const idx = arr.findIndex(t => t.club === club.club);
        if (idx < 0) return 0;
        if (task.check === 'champion') return idx === 0 ? 1 : 0;
        return idx < task.target ? 1 : 0;
    }
    if (task.check === 'budget_plus') return club.budget > 0 ? 1 : 0;
    if (task.check === 'budget_grow20' || task.check === 'budget_grow50') {
        if (!task.startValue || task.startValue <= 0) return 0;
        return club.budget / task.startValue >= task.target ? 1 : 0;
    }
    if (task.check === 'salary_low60') {
        return getClubSalaryLoad(club) < task.target ? 1 : 0;
    }
    if (task.check === 'one_80' || task.check === 'two_80') {
        const count = players.filter(p => p.club === club.club && p.league === club.league && p.rating >= 80).length;
        return count >= task.target ? 1 : 0;
    }
    if (task.check === 'avg_70') {
        const tp = players.filter(p => p.club === club.club && p.league === club.league);
        if (tp.length === 0) return 0;
        const avg = tp.reduce((s, p) => s + p.rating, 0) / tp.length;
        return avg >= task.target ? 1 : 0;
    }
    if (task.check === 'infra_up2') {
        if (!task.startValue) return 0;
        let maxDiff = 0;
        Object.keys(task.startValue).forEach(k => {
            const diff = (club.upgrades[k] || 1) - task.startValue[k];
            if (diff > maxDiff) maxDiff = diff;
        });
        return maxDiff >= task.target ? 1 : 0;
    }
    if (task.check === 'infra_avg12' || task.check === 'infra_avg15') {
        return parseFloat(getClubUpgradesAvg(club)) >= task.target ? 1 : 0;
    }
    if (task.check === 'prestige_up3' || task.check === 'prestige_up5') {
        if (task.startValue === null) return 0;
        return (club.prestige - task.startValue) >= task.target ? 1 : 0;
    }
    if (task.check === 'prestige_no_drop') {
        if (task.startValue === null) return 0;
        return club.prestige >= task.startValue ? 1 : 0;
    }
    return 0;
}

function simulateAIUpgrades() {
    let totalUpgrades = 0;
    for (const key of Object.keys(clubData)) {
        if (key === presidentClubKey) continue; // твой клуб не качается автоматически
        const club = clubData[key];
        if (!club.upgrades) continue;

        // Раз в 3 сезона (33% шанс) клуб получает +1 уровень
        if (Math.random() > 0.33) continue;

        // Выбираем случайную карточку, которая ещё не на максимуме
        const cardKeys = Object.keys(CLUB_UPGRADE_CARDS).filter(k => (club.upgrades[k] || 1) < 25);
        if (cardKeys.length === 0) continue;

        const pick = randomChoice(cardKeys);
        club.upgrades[pick] = (club.upgrades[pick] || 1) + 1;
        totalUpgrades++;
    }
    if (window.DEBUG) console.log(`🏗 AI-клубы улучшились: ${totalUpgrades} карточек`);
}

function simulateClubActions() {
    // Пока AI-прокачка упрощена — расширим в этапе 5
    for (const key of Object.keys(clubData)) {
        const c = clubData[key];
        if (Math.random() > 0.05) continue;
        if (c.budget < 0) {
            const cps = players.filter(p => p.club === c.club && p.league === c.league);
            if (cps.length > 0) {
                cps.sort((a,b) => b.salary - a.salary);
                const sold = cps[0];
                c.budget += Math.round(sold.salary * 1000 * 0.5);
                c.prestige = Math.max(20, c.prestige - 3);
                players = players.filter(p => p !== sold);
                addNews(`Финансовый кризис! ${c.club} продал ${sold.name}.`, "negative");
            }
        }
    }
}

function recalculateStockPrice(club) {
    const lm = getLeagueStockMultiplier(club.league);
    const basePrice = club.prestige * 1000 * lm;
    const cashBonus = Math.round(club.budget / 500000) * 2;
    const ti = getClubUpgradesTotal(club);
    const infraBonus = ti * 500;
    const wins = club.form.filter(f => f === 'W').length;
    const losses = club.form.filter(f => f === 'L').length;
    const formBonus = (wins - losses) * 3000;
    const titlesBonus = club.titles * 100;
    const noise = 0.95 + Math.random() * 0.1;
    let np = Math.max(Math.round(1000 * lm), Math.round((basePrice + cashBonus + infraBonus + formBonus + titlesBonus) * noise));

    const priceCap = Math.round((club.prestige * 1000 * lm) * 4 + 500000 * lm);
    if (np > priceCap) np = priceCap;
    const priceFloor = Math.round((club.prestige * 1000 * lm) * 0.3);
    if (np < priceFloor) np = priceFloor;

    club.stockPrice = np;
    club.stockHistory.push(np);
    if (club.stockHistory.length > 20) club.stockHistory.shift();
}

function updateAllStockPrices() {
    for (const key of Object.keys(clubData)) {
        const c = clubData[key];
        const r = Math.random();
        c.form.push(r < 0.45 ? 'W' : r < 0.75 ? 'L' : 'OT');
        if (c.form.length > 5) c.form.shift();
        recalculateStockPrice(c);
    }
}

function getPortfolioKey(club, lk) { return lk + "_" + club; }
function getTotalSharesCount() { let t = 0; for (const k of Object.keys(myPortfolio)) t += myPortfolio[k].shares; return t; }

// ============ 11. ТАБЛИЦЫ ============
function initializeStandings() {
    standings = {};
    teamStrengths = {};
    for (const [ln, ld] of Object.entries(LEAGUE_DATA)) {
        standings[ln] = [];
        const bs = (ld.min + ld.max) / 200;
        ld.divisions.forEach(div => {
            div.clubs.forEach(club => {
                standings[ln].push({club,division:div.name,gp:0,w:0,otW:0,sW:0,sL:0,otL:0,l:0,gf:0,ga:0,points:0});
                teamStrengths[ln + "_" + club] = Math.max(0.35, Math.min(1.0, bs + (Math.random() - 0.5) * 0.35));
            });
        });
    }
}

function sortStandingsFn(a,b) {
    if (b.points !== a.points) return b.points - a.points;
    const dA = (a.gf||0)-(a.ga||0), dB = (b.gf||0)-(b.ga||0);
    if (dB !== dA) return dB - dA;
    return (b.gf||0) - (a.gf||0);
}

function simulateStandingsWeek() {
    // Индекс «лига+клуб → игроки» строится один раз за неделю,
    // чтобы не фильтровать 4500+ игроков на каждый матч
    const index = buildClubPlayerIndex(true);
    for (const lk of Object.keys(standings)) {
        const weekMatches = (seasonSchedule[lk] || []).filter(m => m.week === currentWeek);
        if (weekMatches.length === 0) continue;
        weekMatches.forEach(m => {
            const result = simulateMatchWithDetails(m, lk, index);
            m.result = result;
        });
    }
    simulateClubEconomy();
}

// Строит Map "league|club" → массив игроков. excludeGoalies — без вратарей.
function buildClubPlayerIndex(excludeGoalies) {
    const map = new Map();
    for (let i = 0; i < players.length; i++) {
        const p = players[i];
        if (!p.club) continue;
        if (excludeGoalies && p.position === 'G') continue;
        const k = p.league + '|' + p.club;
        const arr = map.get(k);
        if (arr) arr.push(p);
        else map.set(k, [p]);
    }
    return map;
}

// ============ СИМУЛЯЦИЯ МАТЧА С ДЕТАЛЯМИ ============
function simulateMatchWithDetails(match, lk, clubIndex) {
    const homeClub = match.home;
    const awayClub = match.away;
    const dataH = clubData[lk + "_" + homeClub];
    const dataA = clubData[lk + "_" + awayClub];

    let sH = teamStrengths[lk + "_" + homeClub] || 0.5;
    let sA = teamStrengths[lk + "_" + awayClub] || 0.5;

    // Дом. бонус от стадиона
    if (dataH && dataH.upgrades) sH = Math.min(1.0, sH * (1 + getStadiumHomeBonus(dataH.upgrades.stadium || 1)));
    if (dataA && dataA.upgrades) sA = Math.min(1.0, sA * (1 + getStadiumHomeBonus(dataA.upgrades.stadium || 1)));

    // Счёт
    let goalsH = Math.max(0, Math.floor(Math.random() * 4 * sH + Math.random() * 3 - 0.5));
    let goalsA = Math.max(0, Math.floor(Math.random() * 4 * sA + Math.random() * 3 - 0.5));

    // Овертайм если ничья
    let isOT = false, isSO = false;
    if (goalsH === goalsA) {
        isOT = Math.random() < 0.65;
        isSO = !isOT;
        if (Math.random() < 0.5) goalsH++; else goalsA++;
    }

    // Игроки обеих команд (из индекса, если передан — иначе фильтруем)
    const playersHome = clubIndex
        ? (clubIndex.get(lk + '|' + homeClub) || [])
        : players.filter(p => p.club === homeClub && p.league === lk && p.position !== 'G');
    const playersAway = clubIndex
        ? (clubIndex.get(lk + '|' + awayClub) || [])
        : players.filter(p => p.club === awayClub && p.league === lk && p.position !== 'G');

    // Генерация голов
    const allGoals = [];
    const pickScorer = (arr) => {
        if (arr.length === 0) return null;
        const weights = arr.map(p => Math.pow(p.rating, 2) * (p.position === 'C' || p.position === 'LW' || p.position === 'RW' ? 1.5 : 1));
        const total = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        for (let i = 0; i < arr.length; i++) {
            r -= weights[i];
            if (r <= 0) return arr[i];
        }
        return arr[arr.length - 1];
    };

    for (let i = 0; i < goalsH; i++) {
        const scorer = pickScorer(playersHome);
        const minute = randomInt(1, 60);
        const period = minute <= 20 ? 1 : minute <= 40 ? 2 : 3;
        const assists = [];
        if (Math.random() < 0.7 && playersHome.length > 1) {
            const a1 = pickScorer(playersHome.filter(p => p !== scorer));
            if (a1) assists.push(a1.name);
            if (Math.random() < 0.4) {
                const a2 = pickScorer(playersHome.filter(p => p !== scorer && (!a1 || p !== a1)));
                if (a2) assists.push(a2.name);
            }
        }
        allGoals.push({ minute, period, team: 'home', scorer: scorer ? scorer.name : 'Unknown', assists });
        if (scorer) {
            scorer.stats.goals++;
            assists.forEach(aName => {
                const ap = playersHome.find(p => p.name === aName);
                if (ap) ap.stats.assists++;
            });
        }
    }

    for (let i = 0; i < goalsA; i++) {
        const scorer = pickScorer(playersAway);
        const minute = randomInt(1, 60);
        const period = minute <= 20 ? 1 : minute <= 40 ? 2 : 3;
        const assists = [];
        if (Math.random() < 0.7 && playersAway.length > 1) {
            const a1 = pickScorer(playersAway.filter(p => p !== scorer));
            if (a1) assists.push(a1.name);
            if (Math.random() < 0.4) {
                const a2 = pickScorer(playersAway.filter(p => p !== scorer && (!a1 || p !== a1)));
                if (a2) assists.push(a2.name);
            }
        }
        allGoals.push({ minute, period, team: 'away', scorer: scorer ? scorer.name : 'Unknown', assists });
        if (scorer) {
            scorer.stats.goals++;
            assists.forEach(aName => {
                const ap = playersAway.find(p => p.name === aName);
                if (ap) ap.stats.assists++;
            });
        }
    }

    allGoals.sort((a, b) => a.minute - b.minute);

    // 3 звезды матча (с агрегацией по имени)
    const scorerMap = {};
    allGoals.forEach(g => {
        const arr = g.team === 'home' ? playersHome : playersAway;
        const p = arr.find(x => x.name === g.scorer);
        if (!p) return;
        if (!scorerMap[p.name]) {
            scorerMap[p.name] = {
                p,
                points: 0,
                isWinner: (g.team === 'home' && goalsH > goalsA) || (g.team === 'away' && goalsA > goalsH)
            };
        }
        scorerMap[p.name].points += 1 + g.assists.length * 0.3;
    });
    const allScorers = Object.values(scorerMap);
    allScorers.sort((a, b) => (b.points + (b.isWinner ? 0.5 : 0)) - (a.points + (a.isWinner ? 0.5 : 0)));
    const threeStars = allScorers.slice(0, 3).map(x => x.p.name);

    // Голы и передачи по игрокам для оценок
    const goalsByPlayer = {};
    allGoals.forEach(g => {
        if (!goalsByPlayer[g.scorer]) goalsByPlayer[g.scorer] = { goals: 0, assists: 0 };
        goalsByPlayer[g.scorer].goals++;
        g.assists.forEach(a => {
            if (!goalsByPlayer[a]) goalsByPlayer[a] = { goals: 0, assists: 0 };
            goalsByPlayer[a].assists++;
        });
    });

    // Оценки игроков (топ-6 = 3 + 3)
    const teamWonHome = goalsH > goalsA;
    const teamWonAway = goalsA > goalsH;
    const allRatings = [];
    playersHome.forEach(p => {
        const g = goalsByPlayer[p.name] || { goals: 0, assists: 0 };
        let rt = 5.0 + (p.rating - 50) / 25;
        rt += g.goals * 0.8 + g.assists * 0.4;
        if (teamWonHome) rt += 0.5;
        else if (!isOT && !isSO && !teamWonHome) rt -= 0.3;
        rt += (Math.random() - 0.5) * 0.6;
        rt = Math.max(1.0, Math.min(10.0, rt));
        allRatings.push({ name: p.name, rating: Math.round(rt * 10) / 10, goals: g.goals, assists: g.assists, team: 'home' });
    });
    playersAway.forEach(p => {
        const g = goalsByPlayer[p.name] || { goals: 0, assists: 0 };
        let rt = 5.0 + (p.rating - 50) / 25;
        rt += g.goals * 0.8 + g.assists * 0.4;
        if (teamWonAway) rt += 0.5;
        else if (!isOT && !isSO && !teamWonAway) rt -= 0.3;
        rt += (Math.random() - 0.5) * 0.6;
        rt = Math.max(1.0, Math.min(10.0, rt));
        allRatings.push({ name: p.name, rating: Math.round(rt * 10) / 10, goals: g.goals, assists: g.assists, team: 'away' });
    });

    const homeRatings = allRatings.filter(r => r.team === 'home').sort((a, b) => b.rating - a.rating).slice(0, 3);
    const awayRatings = allRatings.filter(r => r.team === 'away').sort((a, b) => b.rating - a.rating).slice(0, 3);
    const playerRatings = [...homeRatings, ...awayRatings].sort((a, b) => b.rating - a.rating);

    // === ФИКС: корректная статистика для всех игроков матча ===
    allRatings.forEach(r => {
        const arr = r.team === 'home' ? playersHome : playersAway;
        const p = arr.find(x => x.name === r.name);
        if (!p) return;
        p.stats.gp++;
        p.stats.ratingSum += r.rating;
        p.stats.pim += randomInt(0, 3);
        let pm = 0;
        if (r.goals > 0 || r.assists > 0) pm += 1;
        const isHome = r.team === 'home';
        const won = isHome ? (goalsH > goalsA) : (goalsA > goalsH);
        const lost = isHome ? (goalsH < goalsA) : (goalsA < goalsH);
        if (won) pm += 1;
        else if (lost) pm -= 1;
        pm += randomInt(-1, 1);
        p.stats.plusMinus += Math.max(-3, Math.min(3, pm));
    });

    // Вратари — они не попали в playersHome/Away (там фильтр p.position !== 'G')
    const goalieHome = players.find(p => p.club === homeClub && p.league === lk && p.position === 'G');
    const goalieAway = players.find(p => p.club === awayClub && p.league === lk && p.position === 'G');

    if (goalieHome) {
        goalieHome.stats.gp++;
        goalieHome.stats.goalsAgainst += goalsA;
        let gr = 5.5 + (goalieHome.rating - 50) / 25 - goalsA * 0.3;
        if (goalsH > goalsA) gr += 0.5;
        else if (goalsH < goalsA) gr -= 0.3;
        gr += (Math.random() - 0.5) * 0.4;
        goalieHome.stats.ratingSum += Math.max(1, Math.min(10, gr));
        goalieHome.stats.pim += randomInt(0, 2);
    }
    if (goalieAway) {
        goalieAway.stats.gp++;
        goalieAway.stats.goalsAgainst += goalsH;
        let gr = 5.5 + (goalieAway.rating - 50) / 25 - goalsH * 0.3;
        if (goalsA > goalsH) gr += 0.5;
        else if (goalsA < goalsH) gr -= 0.3;
        gr += (Math.random() - 0.5) * 0.4;
        goalieAway.stats.ratingSum += Math.max(1, Math.min(10, gr));
        goalieAway.stats.pim += randomInt(0, 2);
    }
    // === КОНЕЦ ФИКСА ===

    // Обновление таблицы
    const tH = standings[lk].find(t => t.club === homeClub);
    const tA = standings[lk].find(t => t.club === awayClub);
    if (tH && tA) {
        tH.gp++; tA.gp++;
        tH.gf += goalsH; tH.ga += goalsA;
        tA.gf += goalsA; tA.ga += goalsH;
        if (goalsH > goalsA) {
            if (isOT) { tH.otW++; tA.otL++; } else if (isSO) { tH.sW++; tA.sL++; } else { tH.w++; tA.l++; }
            tH.points += 2; if (isOT || isSO) tA.points += 1;
        } else {
            if (isOT) { tA.otW++; tH.otL++; } else if (isSO) { tA.sW++; tH.sL++; } else { tA.w++; tH.l++; }
            tA.points += 2; if (isOT || isSO) tH.points += 1;
        }
    }

    return {
        homeScore: goalsH,
        awayScore: goalsA,
        isOT, isSO,
        goals: allGoals,
        threeStars,
        playerRatings
    };
}

// ============ ИСТОРИЯ ЧЕМПИОНОВ ============
function weightedPickClub(clubs, lk) {
    const weights = clubs.map(club => {
        const data = clubData[lk + "_" + club];
        const p = data ? data.prestige : 50;
        return Math.pow(p, 3);
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < clubs.length; i++) {
        r -= weights[i];
        if (r <= 0) return clubs[i];
    }
    return clubs[clubs.length - 1];
}

function generateVirtualChampionsHistory(seasonsBack) {
    const hist = {};
    for (const lk of Object.keys(LEAGUE_DATA)) {
        const clubs = getAllClubs(lk);
        if (clubs.length < 2) continue;
        hist[lk] = [];
        for (let i = seasonsBack; i >= 1; i--) {
            const season = currentSeason - i;
            const champ = weightedPickClub(clubs, lk);
            let fin = weightedPickClub(clubs, lk);
            let attempts = 0;
            while (fin === champ && attempts < 20) {
                fin = weightedPickClub(clubs, lk);
                attempts++;
            }
            hist[lk].push({ season, champion: champ, finalist: fin });
        }
    }
    return hist;
}

function recordChampion(lk, champion, finalist, season) {
    if (!championsHistory[lk]) championsHistory[lk] = [];
    if (championsHistory[lk].some(h => h.season === season)) return;
    championsHistory[lk].unshift({ season, champion, finalist });
    if (championsHistory[lk].length > 20) championsHistory[lk].pop();
}

function formatSeasonLabel(season) {
    const next = (season + 1).toString().slice(-2);
    return season + "/" + next;
}

function resetStandingsForNewSeason() {
    for (const lk of Object.keys(standings)) {
        standings[lk].forEach(t => {
            t.gp=0;t.w=0;t.otW=0;t.sW=0;t.sL=0;t.otL=0;t.l=0;t.gf=0;t.ga=0;t.points=0;
        });
    }
}

function resetWorldPlayerStats() {
    players.forEach(p => {
        p.stats = {gp:0,goals:0,assists:0,pim:0,plusMinus:0,ratingSum:0,goalsAgainst:0};
    });
}

// Обновление слотов после завершения КЧ
// winnerLeague — лига клуба-чемпиона
// worstLeague — лига, показавшая худший результат (если определена)
function updateWorldCupSlots(winnerLeague, worstLeague) {
    const slots = { ...getWorldCupSlots() };

    const canAdd = WC_DYNAMIC_LEAGUES.includes(winnerLeague) && (slots[winnerLeague] || 0) < WC_DYNAMIC_MAX;
    const canRemove = worstLeague && WC_DYNAMIC_LEAGUES.includes(worstLeague) && (slots[worstLeague] || 0) > WC_DYNAMIC_MIN;

    if (canAdd && canRemove) {
        slots[winnerLeague] += 1;
        slots[worstLeague] -= 1;
    }

    return slots;
}

function computeWorldCupTeamStrength(team) {
    const data = clubData[team.league + "_" + team.club];
    if (!data) return 0.5;
    const roster = players.filter(p => p.club === team.club && p.league === team.league);
    const avgR = roster.length > 0 ? roster.reduce((s, p) => s + p.rating, 0) / roster.length : 50;
    return Math.max(0.35, Math.min(1.0, (data.prestige * 0.5 + avgR * 0.5) / 100));
}

function startWorldCup() {
    const teams = selectWorldCupTeams();
    if (teams.length !== 32) {
        console.warn('КЧ: ожидалось 32 команды, получено ' + teams.length);
    }

    const confs = splitWorldCupConferences(teams);
    const scheduleA = generateWorldCupSchedule(confs.A, 'A');
    const scheduleB = generateWorldCupSchedule(confs.B, 'B');

    const teamLeague = {};
    const strengths = {};
    teams.forEach(t => {
        teamLeague[t.club] = t.league;
        strengths[t.club] = computeWorldCupTeamStrength(t);
    });

    const standings = { A: {}, B: {} };
    [...confs.A, ...confs.B].forEach(t => {
        const conf = confs.A.includes(t) ? 'A' : 'B';
        standings[conf][t.club] = { club: t.club, league: t.league, gp: 0, w: 0, l: 0, otl: 0, gf: 0, ga: 0, points: 0 };
    });

    worldCupState = {
        season: currentSeason,
        slots: getWorldCupSlots(),
        teams,
        conferences: confs,
        teamLeague,
        strengths,
        standings,
        schedule: { A: scheduleA, B: scheduleB },
        currentWeek: 1,
        phase: 'regular',
        playoff: null,
        champion: null,
        history: worldCupState?.history || []
    };
    addNews(`🏆 Кубок Чемпионов ${currentSeason} стартует! ${teams.length} клубов из 9 лиг`, "positive");
}

function resetWorldCupForNewSeason() {
    const prevSlots = worldCupState?.slots || null;
    const prevHistory = worldCupState?.history || [];
    worldCupState = null;
    startWorldCup();
    if (prevSlots) worldCupState.slots = prevSlots;
    worldCupState.history = prevHistory;
}

function simulateWorldCupMatch(match) {
    const lkH = worldCupState.teamLeague[match.home];
    const lkA = worldCupState.teamLeague[match.away];
    let sH = worldCupState.strengths[match.home] || 0.5;
    let sA = worldCupState.strengths[match.away] || 0.5;
    sH = Math.min(1.0, sH * 1.03);

    let gH = Math.max(0, Math.floor(Math.random() * 4 * sH + Math.random() * 3 - 0.5));
    let gA = Math.max(0, Math.floor(Math.random() * 4 * sA + Math.random() * 3 - 0.5));
    let isOT = false;
    if (gH === gA) {
        isOT = true;
        if (Math.random() < 0.5) gH++; else gA++;
    }

    const playersH = players.filter(p => p.club === match.home && p.league === lkH && p.position !== 'G');
    const playersA = players.filter(p => p.club === match.away && p.league === lkA && p.position !== 'G');

    const pickScorer = (arr) => {
        if (arr.length === 0) return null;
        const weights = arr.map(p => Math.pow(p.rating, 2) * (p.position === 'C' || p.position === 'LW' || p.position === 'RW' ? 1.5 : 1));
        const total = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        for (let i = 0; i < arr.length; i++) { r -= weights[i]; if (r <= 0) return arr[i]; }
        return arr[arr.length - 1];
    };

    const goals = [];
    const addGoal = (scorer, team) => {
        const arr = team === 'home' ? playersH : playersA;
        const minute = randomInt(1, 60);
        const assists = [];
        if (Math.random() < 0.7 && arr.length > 1) {
            const a1 = pickScorer(arr.filter(p => p !== scorer));
            if (a1) assists.push(a1.name);
        }
        if (scorer) {
            if (!scorer.wcStats) scorer.wcStats = { gp: 0, goals: 0, assists: 0 };
            scorer.wcStats.goals++;
            assists.forEach(n => {
                const ap = arr.find(p => p.name === n);
                if (ap) {
                    if (!ap.wcStats) ap.wcStats = { gp: 0, goals: 0, assists: 0 };
                    ap.wcStats.assists++;
                }
            });
        }
        goals.push({ minute, team, scorer: scorer ? scorer.name : 'Unknown', assists });
    };

    for (let i = 0; i < gH; i++) addGoal(pickScorer(playersH), 'home');
    for (let i = 0; i < gA; i++) addGoal(pickScorer(playersA), 'away');

    playersH.concat(playersA).forEach(p => {
        if (!p.wcStats) p.wcStats = { gp: 0, goals: 0, assists: 0 };
        p.wcStats.gp++;
    });

    match.result = { homeScore: gH, awayScore: gA, isOT, goals };
    return match.result;
}

function updateWorldCupStanding(conf, club, gf, ga, isWin) {
    const row = worldCupState.standings[conf][club];
    if (!row) return;
    row.gp++;
    row.gf += gf; row.ga += ga;
    if (isWin) { row.w++; row.points += 2; }
    else { row.l++; }
}

function simulateWorldCupRegularWeek() {
    if (!worldCupState || worldCupState.phase !== 'regular') return;
    const w = worldCupState.currentWeek;

    ['A', 'B'].forEach(conf => {
        const matches = worldCupState.schedule[conf].filter(m => m.week === w);
        matches.forEach(m => {
            simulateWorldCupMatch(m);
            const hWin = m.result.homeScore > m.result.awayScore;
            updateWorldCupStanding(conf, m.home, m.result.homeScore, m.result.awayScore, hWin);
            updateWorldCupStanding(conf, m.away, m.result.awayScore, m.result.homeScore, !hWin);
        });
    });

    worldCupState.currentWeek++;
    if (worldCupState.currentWeek > WC_REGULAR_WEEKS) {
        worldCupState.phase = 'playoff_ready';
        addNews(`🏆 КЧ: регулярка завершена. Плей-офф стартует!`, "positive");
    }
}

function buildWorldCupPlayoffBracket() {
    const top8 = conf => {
        const rows = Object.values(worldCupState.standings[conf])
            .sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                return (b.gf - b.ga) - (a.gf - a.ga);
            });
        return rows.slice(0, WC_PLAYOFF_SPOTS);
    };
    const a = top8('A');
    const b = top8('B');

    const mkSeries = (tA, tB, groupIdx, round) => ({
        teamA: { club: tA.club, league: tA.league },
        teamB: { club: tB.club, league: tB.league },
        winsA: 0, winsB: 0, winner: null, games: [], groupIdx, round
    });

    const series = [];
    // 1/8: сначала все серии конф A, потом все серии конф B
    // Классический посев внутри конференции: 1v8, 2v7, 3v6, 4v5
    for (let i = 0; i < 4; i++) {
        series.push(mkSeries(a[i], a[7 - i], 0, 1));
    }
    for (let i = 0; i < 4; i++) {
        series.push(mkSeries(b[i], b[7 - i], 1, 1));
    }
    return series;
}

function simulateWorldCupSeries(s) {
    const lkA = s.teamA.league, lkB = s.teamB.league;
    const pA = players.filter(p => p.club === s.teamA.club && p.league === lkA && p.position !== 'G');
    const pB = players.filter(p => p.club === s.teamB.club && p.league === lkB && p.position !== 'G');
    const strengthA = worldCupState.strengths[s.teamA.club] || 0.5;
    const strengthB = worldCupState.strengths[s.teamB.club] || 0.5;

    while (s.winsA < 4 && s.winsB < 4) {
        let gA = Math.max(0, Math.floor(Math.random() * 4 * strengthA + Math.random() * 3 - 0.5));
        let gB = Math.max(0, Math.floor(Math.random() * 4 * strengthB + Math.random() * 3 - 0.5));
        if (gA === gB) {
            if (Math.random() < 0.5) gA++; else gB++;
        }
        s.games.push({ a: gA, b: gB });
        if (gA > gB) s.winsA++; else s.winsB++;

        pA.concat(pB).forEach(p => {
            if (!p.wcStats) p.wcStats = { gp: 0, goals: 0, assists: 0 };
            p.wcStats.gp++;
        });
    }
    s.winner = s.winsA > s.winsB ? s.teamA : s.teamB;
}

function buildWorldCupNextRound(prevSeries) {
    const next = [];
    const r = (prevSeries[0]?.round || 1) + 1;

    // ===== ФИНАЛ: по 1 победителю из каждой конференции =====
    if (r === 4 && prevSeries.length === 2) {
        const wA = prevSeries.find(s => s.groupIdx === 0)?.winner;
        const wB = prevSeries.find(s => s.groupIdx === 1)?.winner;
        if (wA && wB) {
            next.push({
                teamA: wA, teamB: wB,
                winsA: 0, winsB: 0, winner: null, games: [],
                groupIdx: 0,
                round: 4
            });
        }
        return next;
    }

    // ===== Обычный раунд: играем внутри каждой конференции =====
    [0, 1].forEach(conf => {
        const winners = prevSeries
            .filter(s => s.groupIdx === conf)
            .map(s => s.winner);
        for (let i = 0; i < winners.length; i += 2) {
            if (!winners[i] || !winners[i + 1]) continue;
            next.push({
                teamA: winners[i], teamB: winners[i + 1],
                winsA: 0, winsB: 0, winner: null, games: [],
                groupIdx: conf,
                round: r
            });
        }
    });
    return next;
}

function simulateWorldCupPlayoffRound() {
    if (!worldCupState) return;
    if (worldCupState.phase === 'playoff_ready') {
        worldCupState.playoff = {
            round: 1,
            series: buildWorldCupPlayoffBracket(),
            history: []
        };
        worldCupState.phase = 'playoff';
    }

    const po = worldCupState.playoff;
    if (!po) return;

    po.series.forEach(s => { if (!s.winner) simulateWorldCupSeries(s); });
    po.history.push({
        round: po.round,
        series: po.series.map(s => ({ ...s, games: s.games.slice() }))
    });

    const winners = po.series.map(s => s.winner);

    // Проверяем — есть ли наш клиент в финалистах.
    // Дедуплицируем через Set — если оба клиента в одной серии, не дублируем новость.
    const seenSeriesKeys = new Set();
    myRoster.forEach(p => {
        po.series.forEach(s => {
            if (p.club === s.teamA.club || p.club === s.teamB.club) {
                const seriesKey = s.teamA.club + '_vs_' + s.teamB.club + '_r' + po.round;
                if (seenSeriesKeys.has(seriesKey)) return;
                seenSeriesKeys.add(seriesKey);
                const myIsA = p.club === s.teamA.club;
                const myWins = myIsA ? s.winsA : s.winsB;
                const oppWins = myIsA ? s.winsB : s.winsA;
                const opp = myIsA ? s.teamB.club : s.teamA.club;
                const rn = getRoundShortName(po.round, 4);
                const mark = myWins > oppWins ? '✅' : '❌';
                addNews(`${mark} КЧ ${rn}: ${p.club} ${myWins}–${oppWins} ${opp}`, myWins > oppWins ? 'positive' : 'negative');
            }
        });
    });

    if (winners.length === 1) {
        const champ = winners[0];
        worldCupState.champion = { club: champ.club, league: champ.league };
        worldCupState.phase = 'finished';

        const champKey = champ.league + "_" + champ.club;
        if (clubData[champKey]) {
            const prize = 20000000;
            clubData[champKey].budget += prize;
            addNews(`🏆 Кубок Чемпионов ${currentSeason}: ${champ.club}! Призовые ${formatMoney(prize)}`, "positive");
        }

        // Трофеи клиентам
        myRoster.forEach(p => {
            if (p.club === champ.club && p.league === champ.league) {
                if (!p.trophies) p.trophies = [];
                p.trophies.push({ name: `🏆 Кубок Чемпионов`, season: currentSeason, club: p.club });
                p.loyalty = Math.min(100, (p.loyalty || 50) + 10);
                addXP(1000);
                addNews(`🥇 ${p.name} — обладатель Кубка Чемпионов!`, "positive");
            }
        });

        // Определяем худшую динамическую лигу по среднему месту её команд
        const leagueStats = {};
        worldCupState.teams.forEach(t => {
            if (!leagueStats[t.league]) leagueStats[t.league] = { totalPlace: 0, count: 0, reachedQF: 0 };
        });
        // Итоговые позиции — просто по факту, кто дошёл дальше
        worldCupState.teams.forEach(t => {
            let reachedRound = 1;
            po.history.forEach(h => {
                if (h.series.some(s => s.teamA.club === t.club || s.teamB.club === t.club)) {
                    reachedRound = h.round;
                }
            });
            if (t.club === champ.club) reachedRound = 5;
            leagueStats[t.league].totalPlace += (5 - reachedRound);
            leagueStats[t.league].count++;
            if (reachedRound >= 2) leagueStats[t.league].reachedQF++;
        });

        let worst = null, worstAvg = Infinity;
        WC_DYNAMIC_LEAGUES.forEach(lk => {
            const st = leagueStats[lk];
            if (!st || st.count === 0) return;
            const avg = st.totalPlace / st.count;
            if (avg < worstAvg) { worstAvg = avg; worst = lk; }
        });

        const oldSlots = getWorldCupSlots();
        const newSlots = updateWorldCupSlots(champ.league, worst);
        worldCupState.slots = newSlots;

        // Запись в историю (с лигой финалиста)
        const finalSeries = po.series[0];
        const runnerUpTeam = finalSeries.winner.club === finalSeries.teamA.club ? finalSeries.teamB : finalSeries.teamA;
        worldCupState.history.push({
            season: currentSeason,
            champion: champ.club,
            championLeague: champ.league,
            runnerUp: runnerUpTeam.club,
            runnerUpLeague: runnerUpTeam.league
        });
        if (worldCupState.history.length > 20) worldCupState.history.shift();

        // Инфо в новости про смену слотов
        const slotsChanged = newSlots && (
            (newSlots[champ.league] || 0) !== (oldSlots[champ.league] || 0) ||
            (worst && (newSlots[worst] || 0) !== (oldSlots[worst] || 0))
        );
        if (slotsChanged) {
            if (WC_DYNAMIC_LEAGUES.includes(champ.league) && newSlots[champ.league] > (oldSlots[champ.league] || 0)) {
                addNews(`🎟 ${getLeagueName(champ.league)} ${LANG.t('получает +1 слот в КЧ')} ${currentSeason + 1}`, "info");
            }
            if (worst && newSlots[worst] < (oldSlots[worst] || 0)) {
                addNews(`🎟 ${getLeagueName(worst)} ${LANG.t('теряет 1 слот в КЧ')} ${currentSeason + 1}`, "info");
            }
        }

        saveGame();
        updateAllDisplays();
        return;
    }

    po.series = buildWorldCupNextRound(po.series);
    po.round++;
    saveGame();
    updateAllDisplays();
}

// ============ UI КУБКА ЧЕМПИОНОВ ============
let wcActiveTab = 'standings';

function showWorldCupScreen() {
    hidePagination();
    if (!worldCupState) {
        uiAlert(LANG.t('Кубок Чемпионов ещё не стартовал'));
        return;
    }
    document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
    const s = document.getElementById('world-cup-screen');
    if (s) s.style.display = 'flex';
    showBottomNav();
    wcActiveTab = 'standings';
    renderWorldCupScreen();
}

function renderWorldCupScreen() {
    const c = document.getElementById('world-cup-content');
    if (!c || !worldCupState) return;

    document.querySelectorAll('#world-cup-tabs .clients-tab').forEach(t => {
        if (t.getAttribute('data-wctab') === wcActiveTab) t.classList.add('active');
        else t.classList.remove('active');
    });

    if (wcActiveTab === 'standings') renderWcStandings(c);
    else if (wcActiveTab === 'playoffs') renderWcPlayoffs(c);
    else if (wcActiveTab === 'schedule') renderWcSchedule(c);
    else if (wcActiveTab === 'history') renderWcHistory(c);
}

function renderWcStandings(c) {
    c.innerHTML = '';

    const info = document.createElement('div');
    info.className = 'wc-banner';
    let subtitle = '';
    if (worldCupState.phase === 'regular') subtitle = `Регулярка • Неделя ${worldCupState.currentWeek - 1} / ${WC_REGULAR_WEEKS}`;
    else if (worldCupState.phase === 'playoff_ready' || worldCupState.phase === 'playoff') subtitle = `Плей-офф • Раунд ${worldCupState.playoff ? worldCupState.playoff.round : 1} / 4`;
    else if (worldCupState.phase === 'finished') subtitle = `🏆 Чемпион: ${worldCupState.champion.club}`;
    info.innerHTML = `<div class="wc-banner-title">🏆 Кубок Чемпионов ${worldCupState.season}</div><div class="wc-banner-sub">${subtitle}</div>`;
    c.appendChild(info);

    ['A', 'B'].forEach(conf => {
        const title = document.createElement('div');
        title.className = 'wc-conf-title';
        title.textContent = `Конференция ${conf}`;
        c.appendChild(title);

        const rows = Object.values(worldCupState.standings[conf]).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            return (b.gf - b.ga) - (a.gf - a.ga);
        });

        const header = document.createElement('div');
        header.className = 'wc-standings-row wc-header';
        header.innerHTML = `<div>#</div><div></div><div>Клуб</div><div>Лига</div><div>И</div><div>В</div><div>П</div><div>О</div>`;
        c.appendChild(header);

        rows.forEach((t, i) => {
            const row = document.createElement('div');
            row.className = 'wc-standings-row' + (i < WC_PLAYOFF_SPOTS ? ' playoff' : '');
            row.style.cursor = 'pointer';
            row.innerHTML = `
                <div class="wc-num">${i + 1}</div>
                <div class="wc-standings-logo">${getTeamLogoHTML(t.club, t.league)}</div>
                <div class="wc-team-name">${t.club}</div>
                <div class="wc-league-tag">${getLeagueName(t.league)}</div>
                <div class="wc-num">${t.gp}</div>
                <div class="wc-num">${t.w}</div>
                <div class="wc-num">${t.l}</div>
                <div class="wc-num wc-points">${t.points}</div>
            `;
            row.addEventListener('click', () => openPublicClubHub(t.club, t.league));
            c.appendChild(row);
        });
    });
}

function renderWcPlayoffs(c) {
    c.innerHTML = '';

    // Заглушка, если плей-офф ещё не начался
    if (!worldCupState.playoff) {
        c.innerHTML = '<div class="empty-state"><div class="empty-icon">🏆</div><div class="empty-title">Плей-офф ещё не начался</div><div class="empty-desc">Доиграйте регулярку КЧ</div></div>';
        return;
    }

    const po = worldCupState.playoff;
    const totalRounds = 4;

    // Шапка
    const header = document.createElement('div');
    if (worldCupState.phase === 'finished' && worldCupState.champion) {
        header.className = 'playoffs-champion';
        header.innerHTML = `<div class="pc-cup-icon">🏆</div><div class="pc-league">Чемпион Кубка Чемпионов ${worldCupState.season}</div><div class="pc-team">${worldCupState.champion.club}</div>`;
    } else {
        header.className = 'playoffs-info';
        header.innerHTML = `<div class="pi-round">🏒 ${getRoundName(po.round, totalRounds).toUpperCase()}</div><div class="pi-sub">Серии до 4 побед</div>`;
    }
    c.appendChild(header);

    const hint = document.createElement('div');
    hint.className = 'bracket-hint';
    hint.innerHTML = `↔ Пролистайте сетку вправо →`;
    c.appendChild(hint);

    const bracket = document.createElement('div');
    bracket.className = 'bracket-wrapper';

    // Функция получения серий раунда
    const getSeriesForRound = (r) => {
        if (po.history.length >= r) return po.history[r - 1].series;
        if (r === po.round && worldCupState.phase !== 'finished') return po.series;
        return null;
    };

    // Левая половина (конф A): 1/8 → 1/4 → 1/2
    const leftSide = document.createElement('div');
    leftSide.className = 'bracket-side left';
    for (let r = 1; r <= 3; r++) {
        const series = getSeriesForRound(r);
        const col = document.createElement('div');
        col.className = 'bracket-column';
        if (r === po.round && worldCupState.phase !== 'finished') col.classList.add('current');
        if (r < po.round || worldCupState.phase === 'finished') col.classList.add('done');

        const hd = document.createElement('div');
        hd.className = 'bracket-col-header';
        hd.textContent = getRoundShortName(r, totalRounds);
        col.appendChild(hd);

        const colSeries = series ? series.filter(s => s.groupIdx === 0) : [];
        const expectedCount = r === 1 ? 4 : r === 2 ? 2 : 1;
        if (colSeries.length === 0) {
            for (let i = 0; i < expectedCount; i++) {
                const em = document.createElement('div');
                em.className = 'bracket-match wc-placeholder';
                em.innerHTML = `
                    <div class="bm-team">
                        <div class="bm-logo"></div>
                        <div class="bm-name wc-tbd">—</div>
                        <div class="bm-score">0</div>
                    </div>
                    <div class="bm-team">
                        <div class="bm-logo"></div>
                        <div class="bm-name wc-tbd">—</div>
                        <div class="bm-score">0</div>
                    </div>
                `;
                col.appendChild(em);
            }
        } else {
            colSeries.forEach(s => col.appendChild(buildWcBracketMatch(s)));
        }
        leftSide.appendChild(col);
    }
    bracket.appendChild(leftSide);

    // Центр — финал
    const center = document.createElement('div');
    center.className = 'bracket-center';
    const finalCol = document.createElement('div');
    finalCol.className = 'bracket-column final-col';
    if (po.round === totalRounds && worldCupState.phase !== 'finished') finalCol.classList.add('current');
    if (worldCupState.phase === 'finished') finalCol.classList.add('done');

    const fh = document.createElement('div');
    fh.className = 'bracket-col-header';
    fh.textContent = 'ФИНАЛ';
    finalCol.appendChild(fh);

    const finalSeries = getSeriesForRound(totalRounds);
    if (finalSeries && finalSeries.length > 0) {
        finalCol.appendChild(buildWcBracketMatch(finalSeries[0]));
    } else {
                const em = document.createElement('div');
                em.className = 'bracket-match wc-placeholder';
                em.innerHTML = `
                    <div class="bm-team">
                        <div class="bm-logo"></div>
                        <div class="bm-name wc-tbd">—</div>
                        <div class="bm-score">0</div>
                    </div>
                    <div class="bm-team">
                        <div class="bm-logo"></div>
                        <div class="bm-name wc-tbd">—</div>
                        <div class="bm-score">0</div>
                    </div>
                `;
                finalCol.appendChild(em);
    }
    if (worldCupState.phase === 'finished' && worldCupState.champion) {
        const cup = document.createElement('div');
        cup.className = 'bracket-champ-mini';
        cup.innerHTML = `🏆 ${worldCupState.champion.club}`;
        finalCol.appendChild(cup);
    }
    center.appendChild(finalCol);
    bracket.appendChild(center);

    // Правая половина (конф B) — зеркало: 1/2 → 1/4 → 1/8
    const rightSide = document.createElement('div');
    rightSide.className = 'bracket-side right';
    for (let r = 3; r >= 1; r--) {
        const series = getSeriesForRound(r);
        const col = document.createElement('div');
        col.className = 'bracket-column';
        if (r === po.round && worldCupState.phase !== 'finished') col.classList.add('current');
        if (r < po.round || worldCupState.phase === 'finished') col.classList.add('done');

        const hd = document.createElement('div');
        hd.className = 'bracket-col-header';
        hd.textContent = getRoundShortName(r, totalRounds);
        col.appendChild(hd);

        const colSeries = series ? series.filter(s => s.groupIdx === 1) : [];
        const expectedCount = r === 1 ? 4 : r === 2 ? 2 : 1;
        if (colSeries.length === 0) {
            for (let i = 0; i < expectedCount; i++) {
                const em = document.createElement('div');
                em.className = 'bracket-match wc-placeholder';
                em.innerHTML = `
                    <div class="bm-team">
                        <div class="bm-logo"></div>
                        <div class="bm-name wc-tbd">—</div>
                        <div class="bm-score">0</div>
                    </div>
                    <div class="bm-team">
                        <div class="bm-logo"></div>
                        <div class="bm-name wc-tbd">—</div>
                        <div class="bm-score">0</div>
                    </div>
                `;
                col.appendChild(em);
            }
        } else {
            colSeries.forEach(s => col.appendChild(buildWcBracketMatch(s)));
        }
        rightSide.appendChild(col);
    }
    bracket.appendChild(rightSide);
    c.appendChild(bracket);

    // Подпись под сеткой
    if (worldCupState.phase === 'finished' && worldCupState.champion) {
        const done = document.createElement('div');
        done.className = 'playoffs-legend';
        done.innerHTML = `🎉 Турнир завершён. Поздравляем <b>${worldCupState.champion.club}</b>!`;
        c.appendChild(done);
    }

    // Автоскролл на центр
    const scrollToCenter = () => {
        const wrap = c.querySelector('.bracket-wrapper');
        const centerEl = wrap && wrap.querySelector('.bracket-center');
        if (wrap && centerEl) {
            const target = centerEl.offsetLeft - (wrap.clientWidth / 2) + (centerEl.offsetWidth / 2);
            wrap.scrollLeft = Math.max(0, target);
        }
    };
    setTimeout(scrollToCenter, 60);
    setTimeout(scrollToCenter, 300);
}

function buildWcBracketMatch(s) {
    const card = document.createElement('div');
    card.className = 'bracket-match';
    if (s.winner) card.classList.add('completed');

    const aWon = s.winner && s.winner.club === s.teamA.club;
    const bWon = s.winner && s.winner.club === s.teamB.club;

    const tl = (t, wins, isWinner, isLoser) =>
        `<div class="bm-team ${isWinner ? 'winner' : ''} ${isLoser ? 'loser' : ''}">
            <div class="bm-logo">${getTeamLogoHTML(t.club, t.league)}</div>
            <div class="bm-name">${t.club}</div>
            <div class="bm-score">${wins}</div>
        </div>`;

    card.innerHTML = tl(s.teamA, s.winsA, aWon, bWon) + tl(s.teamB, s.winsB, bWon, aWon);
    return card;
}

function renderWcSchedule(c) {
    c.innerHTML = '';
    if (!worldCupState) return;
    const maxWeek = worldCupState.phase === 'regular' ? worldCupState.currentWeek - 1 : WC_REGULAR_WEEKS;
    const startWeek = Math.max(1, maxWeek - 4);
    const endWeek = Math.min(WC_REGULAR_WEEKS, maxWeek + 1);

    const header = document.createElement('div');
    header.className = 'wc-banner';
    header.innerHTML = `<div class="wc-banner-title">📅 Расписание КЧ</div><div class="wc-banner-sub">Показаны недели ${startWeek}–${endWeek}</div>`;
    c.appendChild(header);

    for (let w = endWeek; w >= startWeek; w--) {
        const block = document.createElement('div');
        block.className = 'schedule-week' + (w <= maxWeek ? ' played' : '');
        block.innerHTML = `<div class="schedule-week-title">Неделя ${w} ${w <= maxWeek ? '✓' : ''}</div>`;
        ['A', 'B'].forEach(conf => {
            const matches = worldCupState.schedule[conf].filter(m => m.week === w);
            matches.forEach(m => {
                const row = document.createElement('div');
                row.className = 'schedule-row';
                const lkH = worldCupState.teamLeague[m.home];
                const lkA = worldCupState.teamLeague[m.away];
                if (m.result) {
                    const hWin = m.result.homeScore > m.result.awayScore;
                    row.classList.add(hWin ? 'win-home' : 'win-away');
                    row.innerHTML = `
                        <div class="sch-logo">${getTeamLogoHTML(m.home, lkH)}</div>
                        <div class="sch-team">${m.home}</div>
                        <div class="sch-score">
                            <span class="sch-score-home ${hWin ? 'w' : ''}">${m.result.homeScore}</span>
                            <span class="sch-score-sep">:</span>
                            <span class="sch-score-away ${!hWin ? 'w' : ''}">${m.result.awayScore}</span>
                        </div>
                        <div class="sch-team right">${m.away}</div>
                        <div class="sch-logo">${getTeamLogoHTML(m.away, lkA)}</div>
                    `;
                } else {
                    row.classList.add('future');
                    row.innerHTML = `
                        <div class="sch-logo">${getTeamLogoHTML(m.home, lkH)}</div>
                        <div class="sch-team">${m.home}</div>
                        <div class="sch-score future-score">— : —</div>
                        <div class="sch-team right">${m.away}</div>
                        <div class="sch-logo">${getTeamLogoHTML(m.away, lkA)}</div>
                    `;
                }
                block.appendChild(row);
            });
        });
        c.appendChild(block);
    }
}

function renderWcHistory(c) {
    c.innerHTML = '';

    const banner = document.createElement('div');
    banner.className = 'wc-banner';
    banner.innerHTML = `<div class="wc-banner-title">📜 История Кубка Чемпионов</div><div class="wc-banner-sub">Победители и финалисты по сезонам</div>`;
    c.appendChild(banner);

    const hist = (worldCupState.history || []).slice().reverse();
    if (hist.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = '<div class="empty-icon">📜</div><div class="empty-title">Пока пусто</div><div class="empty-desc">Первый турнир ещё не завершён</div>';
        c.appendChild(empty);
    } else {
        hist.forEach(h => {
            const block = document.createElement('div');
            block.className = 'schedule-playoff-round';
            const champLeagueName = h.championLeague ? getLeagueName(h.championLeague) : '';
            const finLeagueName = h.runnerUpLeague ? getLeagueName(h.runnerUpLeague) : '';
            block.innerHTML = `
                <div class="spr-title">${h.season}/${(h.season + 1).toString().slice(-2)}</div>
                <div class="sps-team winner">
                    <div class="sps-logo">${getTeamLogoHTML(h.champion, h.championLeague)}</div>
                    <span class="sps-name">🏆 ${h.champion}</span>
                    <span class="sps-wins" style="font-size: 10px;">${champLeagueName}</span>
                </div>
                ${h.runnerUp ? `
                <div class="sps-team">
                    <div class="sps-logo">${getTeamLogoHTML(h.runnerUp, h.runnerUpLeague || h.championLeague)}</div>
                    <span class="sps-name">🥈 ${h.runnerUp}</span>
                    <span class="sps-wins" style="font-size: 10px; color: var(--text-muted);">${finLeagueName}</span>
                </div>` : ''}
            `;
            c.appendChild(block);
        });
    }

    // ===== Текущие слоты (краткий блок внизу) =====
    const slots = worldCupState.slots;
    const total = Object.values(slots).reduce((s, v) => s + v, 0);

    const slotsTitle = document.createElement('div');
    slotsTitle.className = 'wc-slots-title';
    slotsTitle.style.marginTop = '20px';
    slotsTitle.textContent = `🎟 Слоты на сезон ${worldCupState.season}`;
    c.appendChild(slotsTitle);

    // Сортируем динамические лиги: сначала кто больше базовых 4, потом 4, потом меньше
    const sortedDynamic = [...WC_DYNAMIC_LEAGUES].sort((a, b) => {
        const diff = (slots[b] || 0) - (slots[a] || 0);
        if (diff !== 0) return diff;
        return getLeagueName(a).localeCompare(getLeagueName(b));
    });

    sortedDynamic.forEach(lk => {
        const count = slots[lk] || 0;
        const row = document.createElement('div');
        row.className = 'wc-slot-row dynamic';
        if (count > WC_START_DYNAMIC) row.classList.add('more');
        else if (count < WC_START_DYNAMIC) row.classList.add('less');

        const flag = (LEAGUE_DATA[lk]?.country || '').split(' ')[0] || '';
        let arrow = '';
        if (count > WC_START_DYNAMIC) arrow = ' <span class="wc-slot-arrow up">⬆</span>';
        else if (count < WC_START_DYNAMIC) arrow = ' <span class="wc-slot-arrow down">⬇</span>';

        row.innerHTML = `
            <div class="wc-slot-flag">${flag}</div>
            <div class="wc-slot-name">${getLeagueName(lk)}${arrow}</div>
            <div class="wc-slot-count">${count}</div>
        `;
        c.appendChild(row);
    });
    Object.keys(WC_STATIC_LEAGUES).forEach(lk => {
        const row = document.createElement('div');
        row.className = 'wc-slot-row static';
        const flag = (LEAGUE_DATA[lk]?.country || '').split(' ')[0] || '';
        row.innerHTML = `
            <div class="wc-slot-flag">${flag}</div>
            <div class="wc-slot-name">${getLeagueName(lk)}</div>
            <div class="wc-slot-count">${slots[lk] || 0}</div>
        `;
        c.appendChild(row);
    });

    const hint = document.createElement('div');
    hint.className = 'wc-slot-hint';
    hint.innerHTML = `Всего: <b style="color: var(--neon-green);">${total}</b> слотов (сумма фиксирована — 32)`;
    c.appendChild(hint);
}

// Обработчики табов
document.querySelectorAll('#world-cup-tabs .clients-tab').forEach(t => {
    t.addEventListener('click', function() {
        const tt = this.getAttribute('data-wctab');
        if (!tt) return;
        wcActiveTab = tt;
        renderWorldCupScreen();
    });
});

// Кнопка "назад"
document.getElementById('world-cup-back')?.addEventListener('click', () => {
    document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
    const os = document.getElementById('office-screen');
    if (os) os.style.display = 'flex';
    showBottomNav();
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navO = document.querySelector('.nav-item[data-nav="office"]');
    if (navO) navO.classList.add('active');
    renderOffice();
});

// ============ 12. СОХРАНЕНИЯ ============
let saveIndicatorTimeout;
function showSaveIndicator() {
    saveIndicator.classList.add('show');
    clearTimeout(saveIndicatorTimeout);
    saveIndicatorTimeout = setTimeout(() => saveIndicator.classList.remove('show'), 1500);
}

// packPlayer/unpackPlayer/packClub/unpackClub вынесены в src/core/pack.ts.

function saveGame() {
    const packedClubs = {};
    for (const k of Object.keys(clubData)) packedClubs[k] = packClub(clubData[k]);
    const data = {
        v: 23,
        t: Date.now(),
        agentName, agencyName, agencyCountry, agencyFlag,
        money: agentMoney, s: currentSeason, w: currentWeek,
        upgrades, rosterNames: myRoster.map(p => p.name), news: newsFeed.slice(0, 150),
        standings, teamStrengths, npcAgencies,
        clubs: packedClubs, portfolio: myPortfolio,
        agentXP, agentLevel,
        transferOffers, activeCommissions, pendingClubReturn,
        playerNegotiations,
        poachedPlayersThisSeason, agencyPoachAttempts, closedAgencies,
        phase: seasonPhase, phaseWeeks: transferPhaseWeeksLeft,
        playoffState, playoffRound,
        championsHistory, presidentClubKey, seasonSchedule,
        clubSeasonPositions, clubCouncil,
        careerGoals, careerCounters,
        activeTasks, eventCooldowns, eventHistory, weeklyEventCounter, lastEventWeek,
        activeChains,
        npcCooldownWeeks: npcCooldownWeeks || 0,
        lostPlayerThisSeason: !!lostPlayerThisSeason,
        worldCupState,
        nationalTournament,
        nationalTournamentHistory,
        favoriteNationalTeam,
        datapackActive,
        pendingEventId: pendingEvent && pendingEvent.ev ? pendingEvent.ev.id : null,
        pendingEventPlayer: pendingEvent && pendingEvent.player ? pendingEvent.player.name : null,
        draftData: draftData.picks.length > 0 ? {
            season: draftData.season,
            active: !!draftData.active,
            repGranted: !!draftData.repGranted,
            decided: Object.keys(draftData.decidedPicks || {}).filter(k => draftData.decidedPicks[k]).map(Number),
            picks: draftData.picks.map(pk => ({
                pick: pk.pick,
                round: pk.round,
                nhlClub: pk.nhlClub,
                playerName: pk.player ? pk.player.name : ''
            }))
        } : null,
        players: players.map(packPlayer)
    };
    // Экспорт/импорт используют этот же объект
    window._lastSaveData = data;
    // Асинхронно сохраняем в IndexedDB
    idbSet(SAVE_KEY, data).then(() => {
        try { localStorage.setItem(HAS_SAVE_FLAG, '1'); } catch (e) {}
        try {
            const sizeKb = Math.round(JSON.stringify(data).length / 1024);
            if (window.DEBUG) console.log('💾 Сохранено в IndexedDB: ~' + sizeKb + ' КБ');
        } catch(e) {}
        showSaveIndicator();
    }).catch(err => {
        console.warn('IndexedDB save failed, fallback to localStorage:', err);
        // Fallback: пробуем localStorage (может не влезть, но попытка)
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(data));
            try { localStorage.setItem(HAS_SAVE_FLAG, '1'); } catch (e) {}
            showSaveIndicator();
        } catch(e) {
            uiAlert(LANG.t('Не удалось сохранить игру.'));
        }
    });
}

function hasSave() {
    try {
        if (localStorage.getItem(HAS_SAVE_FLAG) === '1') return true;
    } catch (e) {}
    // Fallback для старых сейвов
    try {
        return localStorage.getItem(SAVE_KEY) !== null;
    } catch (e) { return false; }
}   

async function loadGame() {
    let d = null;
    try {
        d = await idbGet(SAVE_KEY);
    } catch (e) { console.warn('IndexedDB load error', e); }
    if (!d) {
        // Fallback — попытка загрузить из localStorage (старые сейвы)
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        try { d = JSON.parse(raw); } catch (e) { return false; }
    }

    // Миграция сейва: real → fake, если датапак не активен.
    // Если в сейве лежат реальные названия клубов (Boston Bruins), а датапак
    // не активирован — переименовываем в фейковые (Boston Bears).
    if (d && !d.datapackActive && typeof window.migrateSaveToFake === 'function') {
        try {
            d = window.migrateSaveToFake(d);
            if (window.DEBUG) console.log('📦 Сейв мигрирован: real → fake');
        } catch (e) {
            console.warn('Миграция сейва (fake) не удалась:', e);
        }
    }

    try {
        agentName = d.agentName || 'Агент';
        agencyName = d.agencyName || 'Моё агентство';
        agencyCountry = d.agencyCountry || 'RU';
        agencyFlag = d.agencyFlag || '🇷🇺';
        agentMoney = d.money ?? 3000;
        currentSeason = d.s ?? 2026;
        currentWeek = d.w ?? 1;
        agentXP = d.agentXP ?? 0;
        agentLevel = d.agentLevel ?? 1;
        newsFeed = d.news ?? [];
        standings = d.standings ?? {};
        teamStrengths = d.teamStrengths ?? {};
        npcAgencies = d.npcAgencies ?? generateNpcAgencies();
        myPortfolio = d.portfolio ?? {};
        upgrades = d.upgrades || {office:1,scouting:1,reveal:1,youth:1,negotiator:1,reputation:1,media:1};
        // Миграция старых сейвов: карточка тренера появилась позже
        if (upgrades.trainer === undefined) upgrades.trainer = 1;
        transferOffers = d.transferOffers ?? {};
        playerNegotiations = d.playerNegotiations ?? {};
        activeCommissions = d.activeCommissions ?? [];
        pendingClubReturn = d.pendingClubReturn ?? [];
        poachedPlayersThisSeason = d.poachedPlayersThisSeason ?? {};
        agencyPoachAttempts = d.agencyPoachAttempts ?? {};
        closedAgencies = d.closedAgencies ?? {};
        seasonPhase = d.phase ?? 'regular';
        transferPhaseWeeksLeft = d.phaseWeeks ?? 0;
        playoffState = d.playoffState ?? {};
        playoffRound = d.playoffRound ?? 0;
        if (playoffRound > 4) playoffRound = 1;
        if (d.players && d.players.length > 0) players = d.players.map(unpackPlayer);
        else { players = generateAllPlayers(); assignPlayersToNpcAgencies(); seedFreeAgents(250); }

        // Миграция: реальным игрокам без истории генерируем фейковую карьеру
        let migrated = 0;
        players.forEach(p => {
            if ((!p.seasonHistory || p.seasonHistory.length === 0) && p.age >= 22 && p.club && p.club.length > 0) {
                generateFakeCareerHistory(p);
                if (p.seasonHistory.length > 0) migrated++;
            }
        });
        if (migrated > 0 && window.DEBUG) console.log(`🔄 Миграция карьер: ${migrated} игроков получили историю`);
        // Восстанавливаем myRoster как ССЫЛКИ на объекты из players (а не отдельные копии)
        const rosterNames = d.rosterNames || (d.roster || []).map(r => r[0]).filter(Boolean);
        if (rosterNames.length > 0) {
            myRoster = rosterNames.map(name => {
                let found = players.find(p => p.name === name);
                if (found) return found;
                // Fallback для очень старых сейвов, где игрок был только в roster
                const oldRow = (d.roster || []).find(r => r[0] === name);
                if (!oldRow) return null;
                const restored = unpackPlayer(oldRow);
                restored.agentId = -1;
                players.push(restored);  // добавляем в общий список мира
                return restored;
            }).filter(Boolean);
        } else {
            myRoster = [];
        }
        clubData = {};
        for (const k of Object.keys(d.clubs || {})) clubData[k] = unpackClub(d.clubs[k]);
        if (Object.keys(clubData).length === 0) generateClubData();
        if (Object.keys(standings).length === 0) initializeStandings();
        if (d.championsHistory && Object.keys(d.championsHistory).length > 0) {
            championsHistory = d.championsHistory;
        } else {
            championsHistory = generateVirtualChampionsHistory(5);
        }
        clubSeasonPositions = d.clubSeasonPositions || {};
        clubCouncil = d.clubCouncil || null;
        careerGoals = d.careerGoals || {};
        careerCounters = d.careerCounters || { poachSuccess: 0, poachFails: 0, clientsEverSigned: 0, trophiesTotal: 0, cupsWon: 0, newsCount: 0 };
        activeTasks = d.activeTasks || [];
        eventCooldowns = d.eventCooldowns || {};
        eventHistory = d.eventHistory || [];
        weeklyEventCounter = d.weeklyEventCounter || 0;
        lastEventWeek = d.lastEventWeek || 0;
        activeChains = d.activeChains || [];
        npcCooldownWeeks = d.npcCooldownWeeks || 0;
        lostPlayerThisSeason = !!d.lostPlayerThisSeason;
        presidentClubKey = d.presidentClubKey || null;
        nationalTournament = d.nationalTournament || null;
        nationalTournamentHistory = d.nationalTournamentHistory || [];
        favoriteNationalTeam = d.favoriteNationalTeam || null;
        datapackActive = !!d.datapackActive;
        // Восстанавливаем необработанное событие из «почтового ящика»
        pendingEvent = null;
        if (d.pendingEventId && typeof EVENT_POOL !== 'undefined') {
            const ev = EVENT_POOL.find(e => e.id === d.pendingEventId);
            if (ev) {
                const pl = myRoster.find(p => p.name === d.pendingEventPlayer) || null;
                if (pl) pendingEvent = { ev, player: pl };
            }
        }
                // ===== Кубок Чемпионов =====
        if (d.worldCupState) {
            worldCupState = d.worldCupState;
        } else if (d.s > 2026 || (d.s === 2026 && d.w > 1)) {
            // Миграция старого сейва: сезон уже идёт, но КЧ не было
            // Запускаем только если ещё не плей-офф/драфт
            const ph = d.phase || 'regular';
            if (ph === 'regular' || ph === 'transfer_mid' || ph === 'transfer_off') {
                startWorldCup();
                addNews(`🏆 Кубок Чемпионов добавлен в текущем сезоне (миграция сейва)`, "info");
            }
        }
        if (d.seasonSchedule && Object.keys(d.seasonSchedule).length > 0) {
            seasonSchedule = d.seasonSchedule;
        } else {
            generateAllSchedules();
        }
        if (presidentClubKey) {
            const pos = myPortfolio[presidentClubKey];
            if (!pos || pos.shares < 51) {
                presidentClubKey = null;
                clubCouncil = null; // совет сбрасываем только при реальной потере поста
            }
        }
        // Восстанавливаем данные драфта — иначе экран «Драфт NHL» пустой после reload.
        // Сохраняем только имя игрока (для размера сейва), объект восстанавливаем из players[].
        if (d.draftData && d.draftData.picks && d.draftData.picks.length > 0) {
            draftData = {
                active: !!d.draftData.active,
                season: d.draftData.season || currentSeason,
                repGranted: !!d.draftData.repGranted,
                decidedPicks: (d.draftData.decided || []).reduce((m, k) => { m[k] = true; return m; }, {}),
                pool: [],
                picks: d.draftData.picks.map(pk => {
                    const pl = players.find(p => p.name === pk.playerName);
                    return {
                        pick: pk.pick,
                        round: pk.round,
                        nhlClub: pk.nhlClub,
                        player: pl || { name: pk.playerName || 'Unknown', position: 'C', rating: 50, age: 20, league: '' }
                    };
                })
            };
        } else if (d.lastDraft && d.lastDraft.length > 0) {
            // Legacy: очень старый формат (на всякий случай)
            draftData = {
                active: false,
                season: currentSeason,
                pool: [],
                picks: d.lastDraft.map(a => ({
                    pick: a[0], round: a[1], nhlClub: a[2],
                    player: { name: a[3], position: a[4], rating: a[5], age: a[6], league: a[7] }
                }))
            };
        }

        // Миграция карьер для реальных игроков
        try {
            const CAREER_VERSION_KEY = 'hockeyLegendCareerV';
            const CAREER_VERSION = '2';
            const needsRegen = localStorage.getItem(CAREER_VERSION_KEY) !== CAREER_VERSION;
            let migratedCareers = 0;

            players.forEach(p => {
                if (p.age < 22 || !p.club || p.club.length === 0) return;
                const hasHistory = p.seasonHistory && p.seasonHistory.length > 0;
                if (!hasHistory) {
                    generateFakeCareerHistory(p);
                    if (p.seasonHistory.length > 0) migratedCareers++;
                } else if (needsRegen) {
                    // Перегенерируем с новой версией (убирает «плоские» истории)
                    generateFakeCareerHistory(p);
                    migratedCareers++;
                }
            });

            if (needsRegen && migratedCareers > 0) {
                localStorage.setItem(CAREER_VERSION_KEY, CAREER_VERSION);
                if (window.DEBUG) console.log(`🔄 Карьеры перегенерированы (v${CAREER_VERSION}): ${migratedCareers} игроков`);
            } else if (migratedCareers > 0) {
                if (window.DEBUG) console.log(`🔄 Добавлено карьер: ${migratedCareers} игроков`);
            }
        } catch (e) {
            console.warn('Ошибка миграции карьер:', e);
        }

        // Все имена — в латиницу (как в FIFA). Работает и для старых сейвов.
        let _renamed = 0;
        players.forEach(p => {
            if (p.name && /[А-Яа-яЁёІіЇїЄєҐґЎўӘәҒғҚқҢңӨөҰұҮүҺһ]/.test(p.name)) {
                const oldName = p.name;
                p.name = toLatin(p.name);
                _renamed++;
                // Переименовываем ключи в мапах
                if (transferOffers[oldName]) {
                    transferOffers[p.name] = transferOffers[oldName];
                    delete transferOffers[oldName];
                }
                activeTasks.forEach(t => { if (t.playerName === oldName) t.playerName = p.name; });
                if (poachedPlayersThisSeason[oldName]) {
                    poachedPlayersThisSeason[p.name] = true;
                    delete poachedPlayersThisSeason[oldName];
                }
                pendingClubReturn.forEach(item => { if (item.playerName === oldName) item.playerName = p.name; });
                if (draftData && Array.isArray(draftData.picks)) {
                    draftData.picks.forEach(pk => {
                        if (pk.player && pk.player.name === oldName) pk.player.name = p.name;
                    });
                }
            }
        });
        if (_renamed > 0 && window.DEBUG) console.log('🔄 Имена транслитерированы в латиницу: ' + _renamed);

        // Пересобираем сборные, чтобы они ссылались на актуальные объекты из players[]
        resyncNationalTournamentPlayers();

        // Применяем правильный режим клубов к LEAGUE_DATA по флагу из сейва
        if (datapackActive) {
            if (typeof window.applyRealTeamNames === 'function') window.applyRealTeamNames();
        } else {
            if (typeof window.applyFakeTeamNames === 'function') window.applyFakeTeamNames();
        }

        return true;
    } catch(e) { console.error(e); return false; }
}

function deleteSave() {
    idbDelete(SAVE_KEY).catch(e => console.warn('IDB delete failed', e));
    try {
        localStorage.removeItem(SAVE_KEY);
        localStorage.removeItem(HAS_SAVE_FLAG);
    } catch (e) {}
}

function resetGame() {
    // Сначала определяем режим названий (real/fake) и применяем его к LEAGUE_DATA,
    // чтобы новые игроки и расписание генерировались уже с правильными клубами
    try {
        datapackActive = localStorage.getItem('hockeyLegendDatapackActive') === '1';
    } catch (e) {
        datapackActive = false;
    }
    if (datapackActive) {
        if (typeof window.applyRealTeamNames === 'function') window.applyRealTeamNames();
    } else {
        if (typeof window.applyFakeTeamNames === 'function') window.applyFakeTeamNames();
    }

    agentMoney = 3000;
    players = [];
    myRoster = [];
    currentSeason = 2026;
    currentWeek = 1;
    newsFeed = [];
    agentXP = 0;
    agentLevel = 1;
    upgrades = {office:1,scouting:1,reveal:1,youth:1,negotiator:1,reputation:1,media:1,trainer:1};
    myPortfolio = {};
    transferOffers = {};
    playerNegotiations = {};
    activeCommissions = [];
    pendingClubReturn = [];
    poachedPlayersThisSeason = {};
    agencyPoachAttempts = {};
    closedAgencies = {};
    lostPlayerThisSeason = false;
    npcCooldownWeeks = 0;
    seasonPhase = 'regular';
    transferPhaseWeeksLeft = 0;
    playoffState = {};
    playoffRound = 0;
    draftData = { active: false, season: 0, pool: [], picks: [] };
    draftChoiceQueue = [];
    players = generateAllPlayers();
    npcAgencies = generateNpcAgencies();
    assignPlayersToNpcAgencies();
    seedFreeAgents(250);
    ensureUniquePlayerNames();
    generateClubData();
    initializeStandings();
    championsHistory = generateVirtualChampionsHistory(5);
    generateAllSchedules();
    presidentClubKey = null;
    clubCouncil = null;
    careerGoals = {};
    careerCounters = { poachSuccess: 0, poachFails: 0, clientsEverSigned: 0, trophiesTotal: 0, cupsWon: 0, newsCount: 0 };
    activeTasks = [];
    eventCooldowns = {};
    eventHistory = [];
    weeklyEventCounter = 0;
    lastEventWeek = 0;
    activeChains = [];
    worldCupState = null;
    favoriteNationalTeam = null;
    nationalTournament = null;
    nationalTournamentHistory = [];
    clubSeasonPositions = {};
    matchQueue = null;
    matchQueueOnFinish = null;
    matchQueueIdx = 0;
    pendingEvent = null;
    matchViewState = null;

    // Транслитерируем все имена в латиницу (реальные игроки из REAL_ROSTERS)
    players.forEach(p => { if (p.name) p.name = toLatin(p.name); });

    startWorldCup();
}
function seedFreeAgents(count) {
    for (let i = 0; i < count; i++) {
        players.push(generateFreeAgentYouth());
    }
}

// ============ 13. НОВОСТИ ============
function inferNewsCategory(text) {
    if (myRoster.some(p => p && p.name && text.includes(p.name))) return 'clients';
    if (/\$|дивиденд|комисси|акци|баланс|бонус|доход|расход|зарплат|подписной/i.test(text)) return 'finance';
    if (/чемпион|плей-офф|Кубок|драфт|перешёл|переманил|Малое ТО|Большое ТО|Неделя ТО|ТО закрыто/i.test(text)) return 'leagues';
    return 'general';
}

function addNews(text, type="info") {
    const category = inferNewsCategory(text);
    newsFeed.unshift({text, type, category, week:currentWeek, season:currentSeason});
    if (newsFeed.length > 200) newsFeed.pop();
    if (careerCounters) careerCounters.newsCount = (careerCounters.newsCount || 0) + 1;
    // Живой отклик: toast + вибрация для важных событий
    if (type === 'positive') { playSound('event'); vibrate('event'); }
    else if (type === 'negative') { playSound('error'); vibrate('error'); }
    if (type === 'positive' || type === 'negative') showToast(text, type);
}

function generateRandomNews() {
    if (myRoster.length === 0) return;
    const p = randomChoice(myRoster);
    const events = [
        {text:`${p.name} дал интервью и похвалил вас`,type:"positive"},
        {text:`Скауты НХЛ следят за ${p.name}`,type:"positive"},
        {text:`${p.name} попал в скандал`,type:"negative"},
        {text:`${p.name} стал игроком недели`,type:"positive"}
    ];
    const e = randomChoice(events);
    addNews(e.text, e.type);
}

// ============ 14. XP ============
function addXP(a) {
    if (!a || a <= 0) return;
    agentXP += Math.round(a);
    const old = agentLevel;
    while (agentLevel < XP_THRESHOLDS.length && agentXP >= XP_THRESHOLDS[agentLevel]) agentLevel++;
    if (agentLevel > old) {
        // Используем шаблонный перевод, ключ "Уровень агента повышен до X!" добавляем в i18n.js
        addNews(`🎉 ${LANG.current === 'en' ? 'Agent level up to ' + agentLevel + '!' : 'Уровень агента повышен до ' + agentLevel + '!'}`, "positive");
        playSound('levelup');
        vibrate('levelup');
        showToast(LANG.current === 'en' ? `⬆️ Level ${agentLevel}!` : `⬆️ Уровень ${agentLevel}!`, 'positive');
    }
}

function getXPProgress() {
    if (agentLevel >= XP_THRESHOLDS.length) return {current:agentXP,next:agentXP,percent:100,isMax:true};
    const prev = XP_THRESHOLDS[agentLevel-1], next = XP_THRESHOLDS[agentLevel];
    const pct = Math.min(100, Math.max(0, Math.round(((agentXP-prev)/(next-prev))*100)));
    return {current:agentXP, next, percent:pct, isMax:false};
}

function getAgentRank(idx) {
    const ranks = ['Начинающий агент','Известный агент','Профессиональный агент','Топ-агент','Легенда хоккея'];
    return LANG.t(ranks[Math.max(0, Math.min(4, idx))]);
}

// ============ 15. UI ХЕЛПЕРЫ ============
function getPresidentClubs() {
    const r = [];
    for (const k of Object.keys(myPortfolio)) {
        if (myPortfolio[k].shares >= 51) {
            const d = clubData[k];
            if (d) r.push({club:d.club,league:d.league,key:k});
        }
    }
    return r;
}

function showBottomNav() { const n = document.getElementById('bottom-nav'); if (n) n.style.display = 'flex'; }
function hideBottomNav() { const n = document.getElementById('bottom-nav'); if (n) n.style.display = 'none'; }

function showPagination(totalItems, cb) {
    const pag = document.getElementById('pagination');
    if (!pag) return;
    const tp = Math.ceil(totalItems / ITEMS_PER_PAGE);
    if (tp <= 1) { pag.style.display = 'none'; document.body.classList.remove('has-pagination'); return; }
    pag.style.display = 'flex';
    document.body.classList.add('has-pagination');
    document.getElementById('page-info').textContent = `${LANG.t('Стр.')} ${currentPage} / ${tp}`;
    document.getElementById('page-prev').disabled = currentPage <= 1;
    document.getElementById('page-next').disabled = currentPage >= tp;
    paginationCallback = cb;
}

function hidePagination() {
    const p = document.getElementById('pagination');
    if (p) p.style.display = 'none';
    document.body.classList.remove('has-pagination');
    paginationCallback = null;
}

document.getElementById('page-prev')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; if (paginationCallback) paginationCallback(); } });
document.getElementById('page-next')?.addEventListener('click', () => { currentPage++; if (paginationCallback) paginationCallback(); });

function showMobileScreen(id) {
    document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
    const t = document.getElementById(id);
    if (t) t.style.display = 'flex';
    showBottomNav();
    if (id === 'office-screen') renderOffice();
}

// showStub удалён в v1.0 (мёртвый код — не вызывался)

function closeEventModal() { eventModal.style.display = 'none'; }

// ============ 16. ОФИС ============
function renderOffice() {
    // Проверяем статус президента
    checkPresidentStatus();

    const mEl = document.getElementById('office-money');
    const sEl = document.getElementById('office-season');
    const wEl = document.getElementById('office-week');
    const nEl = document.getElementById('office-agent-name');
    const rEl = document.getElementById('office-agent-rank');
    const htEl = document.getElementById('office-header-title');

    if (mEl) mEl.textContent = '$' + agentMoney.toLocaleString();
    if (sEl) sEl.textContent = currentSeason + '/' + (currentSeason + 1);
    if (wEl) wEl.textContent = (seasonPhase === 'transfer_mid' || seasonPhase === 'transfer_off') ? 'ТО' :
        seasonPhase === 'draft' ? '🎯' :
        seasonPhase === 'playoffs' ? '🏆' :
        seasonPhase === 'world_champ' ? '🌍' : currentWeek;
    if (nEl) nEl.textContent = agentName;
    if (rEl) rEl.textContent = getAgentRank(Math.floor(agentLevel / 2));
    if (htEl) htEl.textContent = agencyName;

    const banner = document.getElementById('office-window-banner');
    if (banner) {
        if (seasonPhase === 'transfer_mid') { banner.className = 'transfer-window-banner open'; banner.innerHTML = `🟢 <b>${LANG.t('Малое ТО')}</b> • ${transferPhaseWeeksLeft} ${LANG.t('нед.')}`; banner.style.display = 'block'; }
        else if (seasonPhase === 'transfer_off') { banner.className = 'transfer-window-banner open'; banner.innerHTML = `🟢 <b>${LANG.t('Большое ТО')}</b> • ${transferPhaseWeeksLeft} ${LANG.t('нед.')}`; banner.style.display = 'block'; }
        else if (seasonPhase === 'playoffs') { banner.className = 'transfer-window-banner open'; banner.innerHTML = `🏆 <b>${LANG.t('Плей-офф')} • ${LANG.t('Раунд')} ${playoffRound}/4</b>`; banner.style.display = 'block'; }
        else if (seasonPhase === 'draft') { banner.className = 'transfer-window-banner open'; banner.innerHTML = `🎯 <b>${LANG.t('Драфт NHL')}</b>`; banner.style.display = 'block'; }
        else if (seasonPhase === 'world_champ') {
            const t = nationalTournament;
            const label = t ? (t.type === 'olympics' ? '🥇 ' + LANG.t('Олимпиада') : '🌍 ' + LANG.t('Чемпионат мира')) : '🏆 ' + LANG.t('Турнир сборных');
            let phaseLbl = '';
            if (t) {
                if (t.phase === 'group') phaseLbl = `${LANG.t('Групповой этап')} • ${LANG.t('Неделя')} ${Math.min(t.currentWeek, 3)}/3`;
                else if (t.phase === 'playoff_ready' || t.phase === 'playoff') phaseLbl = `${LANG.t('Плей-офф')} • ${LANG.t('Раунд')} ${t.playoff ? t.playoff.round : 1}/3`;
                else if (t.phase === 'finished') phaseLbl = LANG.t('Завершён');
            }
            banner.className = 'transfer-window-banner open';
            banner.innerHTML = `🏆 <b>${label}${t ? ' ' + t.year : ''}</b> • ${phaseLbl}`;
            banner.style.display = 'block';
        }
        else if (agentMoney < 0) { banner.className = 'transfer-window-banner closed'; banner.innerHTML = `🔴 <b>${LANG.t('ДОЛГ!')}</b> ${LANG.t('Работает только офис')}`; banner.style.display = 'block'; }
        else { banner.className = 'transfer-window-banner closed'; banner.innerHTML = `🔴 <b>${LANG.t('Трансферное окно закрыто')}</b>`; banner.style.display = 'block'; }
    }

    const btn = document.querySelector('#btn-play-week .big-action-text');
    if (btn) {
        if (seasonPhase === 'regular') btn.textContent = LANG.t('Играть неделю');
        else if (seasonPhase === 'transfer_mid') btn.textContent = `${LANG.t('Неделя ТО')} (${MID_TRANSFER_WEEKS - transferPhaseWeeksLeft}/${MID_TRANSFER_WEEKS})`;
        else if (seasonPhase === 'transfer_off') btn.textContent = `${LANG.t('Неделя ТО')} (${OFF_TRANSFER_WEEKS - transferPhaseWeeksLeft}/${OFF_TRANSFER_WEEKS})`;
        else if (seasonPhase === 'playoffs') btn.textContent = `▶ ${LANG.t('Плей-офф')} (${LANG.t('Раунд')} ${playoffRound})`;
        else if (seasonPhase === 'draft') btn.textContent = LANG.t('Драфт...');
        else if (seasonPhase === 'world_champ') {
            const t = nationalTournament;
            if (t && (t.phase === 'playoff_ready' || t.phase === 'playoff')) {
                btn.textContent = `🏆 ${LANG.t('Раунд')} ${t.playoff ? t.playoff.round : 1}/3`;
            } else if (t && t.phase === 'group') {
                btn.textContent = `🏆 ${LANG.t('Неделя')} ${Math.min(t.currentWeek, 3)}/3`;
            } else {
                btn.textContent = `🏆 ${LANG.t('Матч турнира')}`;
            }
        }
    }

    const xp = getXPProgress();
    const xpL = document.getElementById('office-agent-level');
    const xpT = document.getElementById('office-xp-text');
    const xpF = document.getElementById('office-xp-fill');
    if (xpL) xpL.textContent = agentLevel;
    if (xpT) xpT.textContent = xp.isMax ? 'MAX' : xp.current.toLocaleString() + ' / ' + xp.next.toLocaleString() + ' XP';
    if (xpF) xpF.style.width = xp.percent + '%';

    const infraTile = document.getElementById('tile-infrastructure');
    if (infraTile) {
        infraTile.style.display = presidentClubKey ? 'block' : 'none';
    }

    const ntBtn = document.getElementById('btn-open-national-tournament');
    if (ntBtn) {
        const hasActiveTournament = !!nationalTournament;
        const hasHistory = nationalTournamentHistory && nationalTournamentHistory.length > 0;
        if (hasActiveTournament || hasHistory) {
            ntBtn.style.display = 'flex';
            const ntTitle = document.getElementById('btn-nt-title');
            const ntDesc = document.getElementById('btn-nt-desc');
            if (hasActiveTournament) {
                const t = nationalTournament;
                const label = t.type === 'olympics' ? '🥇 ' + LANG.t('Олимпиада') : '🌍 ' + LANG.t('Чемпионат мира');
                if (ntTitle) ntTitle.textContent = `${label} ${t.year}`;
                let sub = '';
                if (t.phase === 'group') sub = `${LANG.t('Групповой этап')} • ${LANG.t('Неделя')} ${Math.min(t.currentWeek, 3)}/3`;
                else if (t.phase === 'playoff_ready' || t.phase === 'playoff') sub = `${LANG.t('Плей-офф')} • ${LANG.t('Раунд')} ${t.playoff ? t.playoff.round : 1}/3`;
                else if (t.phase === 'finished') sub = `🏆 ${LANG.t('Чемпион')}: ${t.champion ? t.champion.name : '—'}`;
                if (ntDesc) ntDesc.textContent = sub;
            } else {
                if (ntTitle) ntTitle.textContent = `📜 ${LANG.t('История турниров')}`;
                if (ntDesc) ntDesc.textContent = `${LANG.t('Турниров в архиве')}: ${nationalTournamentHistory.length}`;
            }
        } else {
            ntBtn.style.display = 'none';
        }
    }

    const wcBtn = document.getElementById('btn-open-world-cup');
    if (wcBtn) {
        if (worldCupState) {
            wcBtn.style.display = 'flex';
            const wcTitle = document.getElementById('btn-wc-title');
            const wcDesc = document.getElementById('btn-wc-desc');
            if (worldCupState.phase === 'finished') {
                if (wcTitle) wcTitle.textContent = `🏆 ${LANG.t('Кубок Чемпионов')} ${worldCupState.season}`;
                if (wcDesc) wcDesc.textContent = `${LANG.t('Чемпион')}: ${worldCupState.champion?.club || '—'}`;
            } else if (worldCupState.phase === 'playoff' || worldCupState.phase === 'playoff_ready') {
                if (wcTitle) wcTitle.textContent = `🏆 ${LANG.t('Кубок Чемпионов')}`;
                const r = Math.min(4, Math.max(1, worldCupState.playoff?.round || 1));
                if (wcDesc) wcDesc.textContent = `${LANG.t('Плей-офф')} • ${LANG.t('Раунд')} ${r}/4`;
            } else {
                if (wcTitle) wcTitle.textContent = `🏆 ${LANG.t('Кубок Чемпионов')}`;
                if (wcDesc) wcDesc.textContent = `${LANG.t('Регулярка')} • ${LANG.t('Неделя')} ${worldCupState.currentWeek - 1}/${WC_REGULAR_WEEKS}`;
            }
        } else {
            wcBtn.style.display = 'none';
        }
    }

    const mini = document.getElementById('mini-news');
    if (mini) {
        const latest = newsFeed.slice(0, 3);
        mini.innerHTML = latest.length === 0 ? '<p style="color:#606070;">' + LANG.t('Новостей пока нет...') + '</p>' : latest.map(i => '<p>' + i.text + '</p>').join('');
    }

    // Иконка ✉️ "Новое событие" (стиль мессенджера: событие ждёт в офисе)
    renderPendingEventBadge();

    renderActiveTasks();
}

function renderEventHistory() {
    const c = document.getElementById('event-history-content');
    if (!c) return;
    c.innerHTML = '';
    if (eventHistory.length === 0) {
        c.innerHTML = `<div class="empty-state"><div class="empty-icon">📜</div><div class="empty-title">${LANG.t('Пока пусто')}</div><div class="empty-desc">${LANG.t('Здесь появятся все твои решения и их последствия')}</div></div>`;
        return;
    }
    eventHistory.forEach(h => {
        const item = document.createElement('div');
        item.className = 'history-item history-' + (h.type || 'info');
        if (h.type === 'event') {
            item.innerHTML = `
                <div class="hi-head"><span class="hi-icon">📰</span><span class="hi-meta">Сезон ${h.season} • Неделя ${h.week}</span></div>
                <div class="hi-title">${h.eventTitle}</div>
                <div class="hi-choice">→ ${h.choiceLabel}</div>
                <div class="hi-result ${h.resultType === 'positive' ? 'positive' : 'negative'}">${h.resultText}</div>
            `;
        } else if (h.type === 'task_done') {
            item.innerHTML = `<div class="hi-head"><span class="hi-icon">✅</span><span class="hi-meta">${LANG.t('Сезон')} ${h.season} • ${LANG.t('Неделя')} ${h.week}</span></div><div class="hi-title">${LANG.t('Обещание выполнено')}</div><div class="hi-result positive">${h.task}</div>`;
        } else if (h.type === 'task_failed') {
            item.innerHTML = `<div class="hi-head"><span class="hi-icon">❌</span><span class="hi-meta">${LANG.t('Сезон')} ${h.season} • ${LANG.t('Неделя')} ${h.week}</span></div><div class="hi-title">${LANG.t('Обещание провалено')}</div><div class="hi-result negative">${h.task}</div>`;
        }
        c.appendChild(item);
    });
}

document.getElementById('event-history-back')?.addEventListener('click', () => {
    document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
    const os = document.getElementById('office-screen');
    if (os) os.style.display = 'flex';
    showBottomNav();
    renderOffice();
});

// ============ 16.5. НОВОСТИ ============
let newsTab = 'all';

// ============ ЭКРАН ДРАФТА (ПОЛНЫЙ СПИСОК) ============
let draftListTab = 'all';

function showDraftListScreen() {
    hidePagination();
    document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
    const s = document.getElementById('draft-list-screen');
    if (s) s.style.display = 'flex';
    showBottomNav();
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    renderDraftListScreen();
}

function renderDraftListScreen() {
    const c = document.getElementById('draft-list-content');
    if (!c) return;
    c.innerHTML = '';

    document.querySelectorAll('#draft-list-screen .clients-tab').forEach(t => {
        if (t.getAttribute('data-dtab') === draftListTab) t.classList.add('active');
        else t.classList.remove('active');
    });

    const picks = (draftData.picks || []);
    const mineCount = picks.filter(pk => myRoster.some(r => r.name === pk.player.name)).length;
    const cntEl = document.getElementById('draft-mine-count');
    if (cntEl) cntEl.textContent = mineCount;

    if (picks.length === 0) {
        c.innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div><div class="empty-title">${LANG.t('Драфт ещё не проходил')}</div><div class="empty-desc">${LANG.t('Завершите сезон — и здесь появится список пиков')}</div></div>`;
        return;
    }

    const header = document.createElement('div');
    header.className = 'draft-list-header';
    header.innerHTML = `
        <div class="dlh-title">🏒 ${LANG.t('Драфт NHL')} ${draftData.season || currentSeason}</div>
        <div class="dlh-sub">${picks.length} ${LANG.t('пиков')} • 2 ${LANG.t('раунда')}</div>
    `;
    c.appendChild(header);

    let filtered = picks;
    if (draftListTab === 'mine') {
        filtered = picks.filter(pk => myRoster.some(r => r.name === pk.player.name));
    }

    if (filtered.length === 0) {
        c.innerHTML += `<div class="empty-state"><div class="empty-icon">😔</div><div class="empty-title">${LANG.t('Ваших клиентов нет в списке')}</div><div class="empty-desc">${LANG.t('Подрастите игроков — попадут в следующем сезоне')}</div></div>`;
        return;
    }

    const byRound = {};
    filtered.forEach(pk => {
        if (!byRound[pk.round]) byRound[pk.round] = [];
        byRound[pk.round].push(pk);
    });

    Object.keys(byRound).sort((a, b) => a - b).forEach(r => {
        const roundTitle = document.createElement('div');
        roundTitle.className = 'draft-round-title-list';
        roundTitle.innerHTML = `<span>${LANG.t('Раунд')} ${r}</span><span class="drl-count">${byRound[r].length}</span>`;
        c.appendChild(roundTitle);

        byRound[r].forEach(pk => {
            const isMine = myRoster.some(x => x.name === pk.player.name);
            const p = pk.player;
            const row = document.createElement('div');
            row.className = 'draft-list-row' + (isMine ? ' draft-list-mine' : '');
            row.innerHTML = `
                <div class="dlr-pick">#${pk.pick}</div>
                <div class="dlr-club">${getTeamLogoHTML(pk.nhlClub, 'NHL')}</div>
                <div class="dlr-info">
                    <div class="dlr-name">${p.name} ${getPlayerCountry(p)}</div>
                    <div class="dlr-meta">${p.position} • ${p.age} ${LANG.t('лет')}</div>
                </div>
                <div class="dlr-rating">${p.rating}</div>
            `;
            c.appendChild(row);
        });
    });
}

document.querySelectorAll('#draft-list-screen .clients-tab').forEach(t => t.addEventListener('click', function () {
    const tt = this.getAttribute('data-dtab');
    if (!tt) return;
    draftListTab = tt;
    renderDraftListScreen();
}));

// ============ ГРАФИК ПОЗИЦИЙ КЛУБА ============
function buildClubPositionGraph(clubKey) {
    const positions = clubSeasonPositions[clubKey] || [];
    if (positions.length < 2) return '';

    const data = [...positions].sort((a, b) => a.season - b.season);
    const W = 300, H = 80;
    const maxPlace = Math.max(...data.map(p => p.total || 20));

    const pts = data.map((p, i) => {
        const x = (i / (data.length - 1)) * W;
        const y = ((p.place - 1) / (maxPlace - 1)) * (H - 12) + 6;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const dots = data.map((p, i) => {
        const x = (i / (data.length - 1)) * W;
        const y = ((p.place - 1) / (maxPlace - 1)) * (H - 12) + 6;
        const isTop = p.place <= 3;
        const color = isTop ? '#00ff88' : p.place <= Math.ceil(maxPlace / 2) ? '#00d4ff' : '#ffaa00';
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${color}"/>`;
    }).join('');

    const first = data[0].place;
    const last = data[data.length - 1].place;
    const improving = last < first;
    const color = improving ? '#00ff88' : last > first ? '#ff2d55' : '#00d4ff';

    return `
        <div class="infra-position-graph">
            <div class="ipg-title">📈 ${LANG.t('Позиция в лиге')}</div>
            <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="ipg-svg">
                <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
                ${dots}
            </svg>
            <div class="ipg-axis">
                <span>${data[0].season}</span>
                <span>${data[data.length - 1].season}</span>
            </div>
            <div class="ipg-last">${LANG.t('Текущее место')}: <b>${last}</b> ${LANG.t('из')} ${data[data.length - 1].total}</div>
        </div>
    `;
}

function getClubTrophiesList(club) {
    const list = [];
    const hist = championsHistory[club.league] || [];
    let champCount = 0;
    let finalCount = 0;
    hist.forEach(h => {
        if (h.champion === club.club) champCount++;
        if (h.finalist === club.club) finalCount++;
    });
    if (champCount > 0) list.push({ icon: '🏆', name: LANG.t('Чемпион') + ' ' + getLeagueName(club.league), count: champCount });
    if (finalCount > 0) list.push({ icon: '🥈', name: LANG.t('Финалист'), count: finalCount });
    if (club.titles > 0) list.push({ icon: '⭐', name: LANG.t('Титулы истории'), count: club.titles });
    return list;
}

// ============ ЭКРАН ЦЕЛЕЙ КАРЬЕРЫ ============
function showCareerGoalsScreen() {
    hidePagination();
    currentBranchKey = null;
    const t = document.getElementById('goals-title');
    if (t) t.textContent = LANG.t('Древо прогресса');
    document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
    const s = document.getElementById('career-goals-screen');
    if (s) s.style.display = 'flex';
    showBottomNav();
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    renderCareerGoalsTree();
}

function getBranchProgress(branchKey) {
    const total = CAREER_GOALS[branchKey].length;
    const done = careerGoals[branchKey] || 0;
    return { done, total, percent: Math.round((done / total) * 100) };
}

function getTotalProgress() {
    let done = 0, total = 0;
    for (const key of Object.keys(CAREER_GOALS)) {
        done += careerGoals[key] || 0;
        total += CAREER_GOALS[key].length;
    }
    return { done, total, percent: Math.round((done / total) * 100) };
}

function renderCareerGoalsTree() {
    const c = document.getElementById('goals-content');
    const t = document.getElementById('goals-title');
    if (!c) return;
    if (t) t.textContent = LANG.t('Древо прогресса');
    c.innerHTML = '';

    // Общий прогресс
    const total = getTotalProgress();
    const totalBlock = document.createElement('div');
    totalBlock.className = 'goals-total';
    totalBlock.innerHTML = `
        <div class="gt-title">🎯 ОБЩИЙ ПРОГРЕСС</div>
        <div class="gt-value">${total.done} / ${total.total}</div>
        <div class="gt-bar"><div class="gt-fill" style="width:${total.percent}%"></div></div>
        <div class="gt-percent">${total.percent}%</div>
    `;
    c.appendChild(totalBlock);

    // Главные ветки
    const mainTitle = document.createElement('div');
    mainTitle.className = 'goals-section-title';
    mainTitle.textContent = 'ГЛАВНЫЕ ВЕТКИ';
    c.appendChild(mainTitle);

    const mainGrid = document.createElement('div');
    mainGrid.className = 'goals-grid-main';
    ['agent', 'business', 'legend', 'intrigue'].forEach(key => {
        mainGrid.appendChild(buildBranchCard(key, true));
    });
    c.appendChild(mainGrid);

    // Второстепенные
    const subTitle = document.createElement('div');
    subTitle.className = 'goals-section-title';
    subTitle.textContent = 'ВТОРОСТЕПЕННЫЕ ВЕТКИ';
    c.appendChild(subTitle);

    const subGrid = document.createElement('div');
    subGrid.className = 'goals-grid-sub';
    ['mentor', 'globalist', 'media', 'president'].forEach(key => {
        subGrid.appendChild(buildBranchCard(key, false));
    });
    c.appendChild(subGrid);
}

let currentBranchKey = null;

function openBranchDetail(branchKey) {
    currentBranchKey = branchKey;
    renderBranchDetail();
}

function renderBranchDetail() {
    const c = document.getElementById('goals-content');
    const t = document.getElementById('goals-title');
    if (!c || !currentBranchKey) return;
    const info = GOAL_BRANCH_NAMES[currentBranchKey];
    const goals = CAREER_GOALS[currentBranchKey];
    const currentLvl = careerGoals[currentBranchKey] || 0;

    if (t) t.textContent = info.name;

    c.innerHTML = '';

    // Кнопка «К списку веток»
    const backBtn = document.createElement('button');
    backBtn.className = 'branch-back-btn';
    backBtn.innerHTML = '← Все ветки';
    backBtn.addEventListener('click', () => {
        currentBranchKey = null;
        const ttl = document.getElementById('goals-title');
        if (ttl) ttl.textContent = 'Древо прогресса';
        renderCareerGoalsTree();
    });
    c.appendChild(backBtn);

    // Заголовок ветки
    const prog = getBranchProgress(currentBranchKey);
    const header = document.createElement('div');
    header.className = 'branch-header' + (currentLvl >= goals.length ? ' completed' : '');
    header.innerHTML = `
        <div class="bh-icon">${info.icon}</div>
        <div class="bh-info">
            <div class="bh-name">${info.name}</div>
            <div class="bh-desc">${info.desc}</div>
        </div>
        <div class="bh-progress">${prog.done} / ${prog.total}</div>
    `;
    c.appendChild(header);

    // Список 12 узлов
    goals.forEach((goal, idx) => {
        const done = idx < currentLvl;
        const isCurrent = idx === currentLvl;
        const isLocked = idx > currentLvl;

        const node = document.createElement('div');
        node.className = 'goal-node' + (done ? ' done' : '') + (isCurrent ? ' current' : '') + (isLocked ? ' locked' : '');
        const icon = done ? '✅' : isCurrent ? '🔵' : '⚪';
        const medal = (idx === 9 || idx === 10 || idx === 11) ? 'gold' : '';

        let progressHTML = '';
        if (isCurrent) {
            const progress = getGoalProgress(goal.check);
            const pct = Math.min(100, Math.round((progress / goal.target) * 100));
            progressHTML = `
                <div class="gn-progress">
                    <div class="gn-progress-text">${Math.min(progress, goal.target)} / ${goal.target}</div>
                    <div class="gn-progress-bar"><div class="gn-progress-fill" style="width:${pct}%"></div></div>
                </div>
            `;
        } else if (done) {
            let rewardStr = [];
            if (goal.reward?.xp) rewardStr.push(`+${goal.reward.xp} XP`);
            if (goal.reward?.money) rewardStr.push(`+${formatMoney(goal.reward.money)}`);
            if (goal.reward?.slot) rewardStr.push(`+${goal.reward.slot} слот`);
            if (goal.reward?.rep) rewardStr.push(`+${goal.reward.rep} реп`);
            if (goal.reward?.title) rewardStr.push(`🏅 ${goal.reward.title}`);
            progressHTML = `<div class="gn-reward">✓ ${LANG.t('Получено:')} ${rewardStr.join(', ') || '—'}</div>`;
        }

        node.innerHTML = `
            <div class="gn-icon">${icon}</div>
            <div class="gn-body">
                <div class="gn-title ${medal}">${goal.lvl}. ${LANG.t(goal.title)}</div>
                <div class="gn-desc">${LANG.t(goal.desc)}</div>
                ${progressHTML}
            </div>
        `;
        c.appendChild(node);
    });

    // Если ветка завершена — эпилог
    if (currentLvl >= goals.length) {
        const epilog = document.createElement('div');
        epilog.className = 'branch-epilog';
        epilog.innerHTML = `
            <div class="be-icon">🏆</div>
            <div class="be-title">ВЕТКА ЗАВЕРШЕНА!</div>
            <div class="be-text">Ты прошёл весь путь в ветке «${info.name}»!</div>
        `;
        c.appendChild(epilog);
    }
}


function buildBranchCard(branchKey, isMain) {
    const info = GOAL_BRANCH_NAMES[branchKey];
    const prog = getBranchProgress(branchKey);
    const div = document.createElement('div');
    div.className = 'goals-branch-card' + (isMain ? ' main' : ' sub') + (prog.done === prog.total ? ' completed' : '');
    div.innerHTML = `
        <div class="gbc-icon">${info.icon}</div>
        <div class="gbc-name">${info.name}</div>
        <div class="gbc-desc">${info.desc}</div>
        <div class="gbc-progress">${prog.done} / ${prog.total}</div>
        <div class="gbc-bar"><div class="gbc-fill" style="width:${prog.percent}%"></div></div>
    `;
    div.addEventListener('click', () => openBranchDetail(branchKey));
    return div;
}

// ============ 16.7. ИНФРАСТРУКТУРА КЛУБА ============
function showInfrastructureScreen() {
    if (!presidentClubKey) { uiAlert(LANG.t('Вы не президент ни одного клуба.')); return; }
    hidePagination();
    clubHubTab = 'overview';
    document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
    const s = document.getElementById('club-hub-screen');
    if (s) s.style.display = 'flex';
    showClubBottomNav();
    renderClubHub();
}

function showClubBottomNav() {
    document.getElementById('bottom-nav').style.display = 'none';
    const cn = document.getElementById('bottom-nav-club');
    if (cn) cn.style.display = 'flex';
}

function hideClubBottomNav() {
    const cn = document.getElementById('bottom-nav-club');
    if (cn) cn.style.display = 'none';
}

function renderClubHub() {
    const c = document.getElementById('club-hub-content');
    const t = document.getElementById('club-hub-title');
    const ic = document.getElementById('club-hub-icon');
    if (!c) return;
    if (!presidentClubKey) { c.innerHTML = '<div class="empty-state"><div class="empty-icon">🏛️</div><div class="empty-title">' + LANG.t('Нет клуба') + '</div></div>'; return; }

    const club = clubData[presidentClubKey];
    if (!club) { c.innerHTML = '<div class="empty-state"><div class="empty-icon">❓</div><div class="empty-title">' + LANG.t('Клуб не найден') + '</div></div>'; return; }
    if (t) t.textContent = club.club;
    if (ic) ic.textContent = '🏛️';

    // Подсветка активной вкладки
    document.querySelectorAll('#club-hub-screen .club-hub-tab').forEach(tb => {
        if (tb.getAttribute('data-chub') === clubHubTab) tb.classList.add('active');
        else tb.classList.remove('active');
    });
    document.querySelectorAll('#bottom-nav-club .nav-item').forEach(n => {
        if (n.getAttribute('data-cnav') === clubHubTab) n.classList.add('active');
        else n.classList.remove('active');
    });

    c.innerHTML = '';

    if (clubHubTab === 'overview') renderClubOverview(c, club);
    else if (clubHubTab === 'roster') renderClubRoster(c, club);
    else if (clubHubTab === 'upgrade') renderClubUpgrade(c, club);
    else if (clubHubTab === 'tasks') renderClubTasks(c, club);
    else if (clubHubTab === 'reports') renderClubReports(c, club);
}

function renderClubOverview(c, club) {
    c.innerHTML = '';

    // ===== 1. Шапка клуба =====
    const salaryLoad = getClubSalaryLoad(club);
    const loadClass = salaryLoad < 70 ? 'load-good' : salaryLoad < 90 ? 'load-mid' : 'load-bad';
    const avgLvl = getClubUpgradesAvg(club);
    const positions = clubSeasonPositions[presidentClubKey] || [];
    const lastPos = positions.length > 0 ? positions[positions.length - 1].place : null;
    const totalTeams = getAllClubs(club.league).length;

    const header = document.createElement('div');
    header.className = 'ov-header';
    header.innerHTML = `
        <div class="ov-club-line">
            <div class="ov-club-logo">${getTeamLogoHTML(club.club, club.league)}</div>
            <div class="ov-club-info">
                <div class="ov-club-name">${club.club}</div>
                <div class="ov-club-meta">${getLeagueName(club.league)} • ${LANG.t('Престиж')} ${club.prestige}</div>
            </div>
        </div>
        <div class="ov-stats-grid">
            <div class="ov-stat">
                <span class="ov-stat-lbl">💰 ${LANG.t('Баланс')}</span>
                <span class="ov-stat-val ${club.budget < 0 ? 'negative' : ''}">${formatMoney(club.budget)}</span>
            </div>
            <div class="ov-stat">
                <span class="ov-stat-lbl">📊 ${LANG.t('Инфра')}</span>
                <span class="ov-stat-val">${avgLvl}/25</span>
            </div>
            <div class="ov-stat">
                <span class="ov-stat-lbl">📉 ${LANG.t('Нагрузка ЗП')}</span>
                <span class="ov-stat-val ${loadClass}">${salaryLoad}%</span>
            </div>
        </div>
        ${club.budget < 0 ? '<div class="ov-debt-warn">🔴 Клуб в долгах! Улучшения недоступны</div>' : ''}
    `;
    c.appendChild(header);

    // ===== 2. Место в лиге =====
    if (lastPos !== null) {
        const placeBlock = document.createElement('div');
        placeBlock.className = 'ov-place-block';
        const placeClass = lastPos <= 4 ? 'good' : lastPos <= totalTeams / 2 ? 'mid' : 'bad';
        placeBlock.innerHTML = `
            <div class="ov-place-icon">🏒</div>
            <div class="ov-place-info">
                <div class="ov-place-label">${LANG.t('Прошлый сезон')}</div>
                <div class="ov-place-value ${placeClass}">${lastPos}${LANG.t('-е место из')} ${totalTeams}</div>
            </div>
        `;
        c.appendChild(placeBlock);
    }

    // ===== 3. Лояльность совета =====
    ensureCouncil();
    if (clubCouncil) {
        const loy = clubCouncil.loyalty;
        const loyClass = loy >= 70 ? 'high' : loy >= 40 ? 'mid' : 'low';
        const loyText = loy >= 70 ? 'Доволен' : loy >= 40 ? 'Наблюдает' : 'Недоволен';
        const councilBlock = document.createElement('div');
        councilBlock.className = 'ov-council-block';
        councilBlock.innerHTML = `
            <div class="ov-council-head">
                <span class="ov-council-title">🏛️ ${LANG.t('Совет директоров')}</span>
                <span class="ov-council-status ${loyClass}">${loy}% • ${LANG.t(loyText)}</span>
            </div>
            <div class="ov-council-bar">
                <div class="ov-council-fill ${loyClass}" style="width:${loy}%"></div>
            </div>
        `;
        c.appendChild(councilBlock);
    }

    // ===== 4. Трофеи =====
    const trophies = getClubTrophiesList(club);
    if (trophies.length > 0) {
        const trophyBlock = document.createElement('div');
        trophyBlock.className = 'ov-trophies';
        trophyBlock.innerHTML = `
            <div class="ov-section-title">🏆 ${LANG.t('Трофеи клуба')}</div>
            <div class="ov-trophies-grid">
                ${trophies.map(t => `<div class="ov-trophy"><span class="ov-trophy-icon">${t.icon}</span><span class="ov-trophy-name">${t.name}</span><span class="ov-trophy-count">×${t.count}</span></div>`).join('')}
            </div>
        `;
        c.appendChild(trophyBlock);
    }

    // ===== 5. График позиций =====
    const graphHTML = buildClubPositionGraph(presidentClubKey);
    if (graphHTML) {
        const graphWrap = document.createElement('div');
        graphWrap.innerHTML = graphHTML;
        c.appendChild(graphWrap.firstElementChild);
    } else {
        const hint = document.createElement('div');
        hint.className = 'ov-graph-hint';
        hint.innerHTML = '📈 ' + LANG.t('График позиций появится после 2-го сезона в качестве президента');
        c.appendChild(hint);
    }

    // ===== 6. Кнопка «Покинуть пост» =====
    const footer = document.createElement('div');
    footer.className = 'infra-footer';
    const leaveBtn = document.createElement('button');
    leaveBtn.className = 'infra-leave-btn';
    leaveBtn.textContent = '🚪 Покинуть пост президента';
    leaveBtn.addEventListener('click', async () => {
        if (!(await uiConfirm(LANG.t('Покинуть пост президента? Акции останутся у вас.')))) return;
        presidentClubKey = null;
        clubCouncil = null;
        saveGame();
        hideClubBottomNav();
        hidePagination();
        document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
        const os = document.getElementById('office-screen');
        if (os) os.style.display = 'flex';
        showBottomNav();
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const navO = document.querySelector('.nav-item[data-nav="office"]');
        if (navO) navO.classList.add('active');
        updateAllDisplays();
    });
    footer.appendChild(leaveBtn);
    c.appendChild(footer);
}

function renderClubRoster(c, club) {
    c.innerHTML = '';
    const teamPlayers = players.filter(p => p.club === club.club && p.league === club.league);

    if (teamPlayers.length === 0) {
        c.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">Состав пуст</div><div class="empty-desc">У этого клуба пока нет игроков</div></div>';
        return;
    }

    // Сводка
    const avgRating = Math.round(teamPlayers.reduce((s, p) => s + p.rating, 0) / teamPlayers.length);
    const avgAge = (teamPlayers.reduce((s, p) => s + p.age, 0) / teamPlayers.length).toFixed(1);

    const summary = document.createElement('div');
    summary.className = 'roster-summary';
    summary.innerHTML = `
        <div class="rs-title">👥 СОСТАВ ${club.club.toUpperCase()}</div>
        <div class="rs-stats">
            <div class="rs-stat"><span class="v">${teamPlayers.length}</span><span class="l">Игроков</span></div>
            <div class="rs-stat"><span class="v">${avgRating}</span><span class="l">Ср. рейтинг</span></div>
            <div class="rs-stat"><span class="v">${avgAge}</span><span class="l">Ср. возраст</span></div>
        </div>
    `;
    c.appendChild(summary);

    // Фильтры
    const expiringCount = teamPlayers.filter(p => p.contractYears === 1).length;
    const filterRow = document.createElement('div');
    filterRow.className = 'roster-filter-row';
    filterRow.innerHTML = `
        <button class="roster-filter-btn ${clubRosterFilter === 'all' ? 'active' : ''}" data-rfilter="all">${LANG.t('Все')}</button>
        <button class="roster-filter-btn ${clubRosterFilter === 'G' ? 'active' : ''}" data-rfilter="G">${LANG.t('Вратари')}</button>
        <button class="roster-filter-btn ${clubRosterFilter === 'D' ? 'active' : ''}" data-rfilter="D">${LANG.t('Защитники')}</button>
        <button class="roster-filter-btn ${clubRosterFilter === 'F' ? 'active' : ''}" data-rfilter="F">${LANG.t('Форварды')}</button>
        <button class="roster-filter-btn ${clubRosterFilter === 'exp' ? 'active' : ''}" data-rfilter="exp">${LANG.t('Уходят')} (${expiringCount})</button>
    `;
    filterRow.querySelectorAll('.roster-filter-btn').forEach(b => {
        b.addEventListener('click', () => {
            clubRosterFilter = b.getAttribute('data-rfilter');
            renderClubRoster(c, club);
        });
    });
    c.appendChild(filterRow);

    // Фильтрация
    let filtered = teamPlayers;
    if (clubRosterFilter === 'G') filtered = teamPlayers.filter(p => p.position === 'G');
    else if (clubRosterFilter === 'D') filtered = teamPlayers.filter(p => p.position === 'D');
    else if (clubRosterFilter === 'F') filtered = teamPlayers.filter(p => ['C','LW','RW'].includes(p.position));
    else if (clubRosterFilter === 'exp') filtered = teamPlayers.filter(p => p.contractYears === 1);

    if (filtered.length === 0) {
        c.innerHTML += '<div class="empty-state-small">Нет игроков в этой категории</div>';
        return;
    }

    // Группировка по амплуа (если фильтр "Все")
    if (clubRosterFilter === 'all') {
        const groups = [
            { key: 'G', name: '🥅 ' + LANG.t('ВРАТАРИ'), list: filtered.filter(p => p.position === 'G') },
            { key: 'D', name: '🛡 ' + LANG.t('ЗАЩИТНИКИ'), list: filtered.filter(p => p.position === 'D') },
            { key: 'F', name: '⚡ ' + LANG.t('НАПАДАЮЩИЕ'), list: filtered.filter(p => ['C','LW','RW'].includes(p.position)) }
        ];
        groups.forEach(g => {
            if (g.list.length === 0) return;
            c.appendChild(buildRosterGroup(g.name, g.list));
        });
    } else {
        c.appendChild(buildRosterGroup('', filtered));
    }
}

function buildRosterGroup(title, list) {
    const block = document.createElement('div');
    block.className = 'roster-group';
    if (title) {
        const h = document.createElement('div');
        h.className = 'roster-group-title';
        h.textContent = title;
        block.appendChild(h);
    }
    const sorted = [...list].sort((a, b) => b.rating - a.rating);
    sorted.forEach(p => {
        block.appendChild(buildRosterRow(p));
    });
    return block;
}

function buildRosterRow(p) {
    const row = document.createElement('div');
    const isMine = (p.agentId === -1);
    row.className = 'roster-row' + (isMine ? ' my-client' : '');
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => {
        playerReturnContext = null;
        openPlayerScreen(p, 'public');
    });
    const rc = p.rating >= 80 ? 'high' : p.rating >= 65 ? 'mid' : 'low';
    const formIcon = p.form > 0 ? '🔥' : p.form < 0 ? '❄' : '—';
    const s = p.stats || {gp:0,goals:0,assists:0};
    const pts = s.goals + s.assists;
    const contractEnd = p.contractYears === 1 ? '🔴' : '📝';
    const posIcon = p.position === 'G' ? '🥅' : p.position === 'D' ? '🛡' : '⚡';
    row.innerHTML = `
        <div class="rr-avatar">${getPlayerAvatarSVG(p)}</div>
        <div class="rr-info">
            <div class="rr-name-line">
                <span class="rr-pos-icon">${posIcon}</span>
                <span class="rr-name">${p.name}</span>
                <span class="rr-pos">${p.position}</span>
            </div>
            <div class="rr-meta">
                <span>${p.age} лет</span>
                <span>${contractEnd} ${p.contractYears} г. • ${formatSalary(p.salary)}</span>
            </div>
        </div>
        <div class="rr-right">
            <div class="rr-rating ${rc}">${p.rating}</div>
            <div class="rr-form">${formIcon}</div>
        </div>
        <div class="rr-stats">
            И:${s.gp} • Г:${s.goals} • П:${s.assists} • О:${pts}
        </div>
    `;
    return row;
}

function renderClubTasks(c, club) {
    c.innerHTML = '';
    ensureCouncil();
    if (!clubCouncil) { c.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">Нет задач</div></div>'; return; }

    // Шапка совета
    const loy = clubCouncil.loyalty;
    const loyClass = loy >= 70 ? 'high' : loy >= 40 ? 'mid' : 'low';
    const loyText = loy >= 70 ? 'Доволен' : loy >= 40 ? 'Наблюдает' : 'Недоволен';

    const header = document.createElement('div');
    header.className = 'council-header';
    header.innerHTML = `
        <div class="council-title">🏛️ ${LANG.t('СОВЕТ ДИРЕКТОРОВ')}</div>
        <div class="council-season">${LANG.t('Сезон')} ${currentSeason}/${currentSeason + 1}</div>
        <div class="council-loyalty">
            <div class="cl-lbl">${LANG.t('Лояльность совета')}</div>
            <div class="cl-bar"><div class="cl-fill ${loyClass}" style="width:${loy}%"></div></div>
            <div class="cl-val ${loyClass}">${loy}% • ${LANG.t(loyText)}</div>
        </div>
        ${clubCouncil.failsStreak >= 2 ? `<div class="council-warn">⚠️ ${LANG.t('Провалов подряд:')} ${clubCouncil.failsStreak}/3. ${LANG.t('При 3 — снятие с поста.')}</div>` : ''}
    `;
    c.appendChild(header);

    // Задачи
    const tasksTitle = document.createElement('div');
    tasksTitle.className = 'council-section-title';
    const doneCount = clubCouncil.tasks.filter(t => t.done || checkTaskProgress(club, t) === 1).length;
    tasksTitle.innerHTML = `📋 ${LANG.t('Задачи на сезон')} (${doneCount}/${clubCouncil.tasks.length} ${LANG.t('выполнено')})`;
    c.appendChild(tasksTitle);

    clubCouncil.tasks.forEach(task => {
        const done = task.done || checkTaskProgress(club, task) === 1;
        const t = document.createElement('div');
        t.className = 'council-task' + (done ? ' done' : '');
        const icon = task.type === 'sport' ? '🏒' : task.type === 'finance' ? '💰' : task.type === 'roster' ? '👥' : task.type === 'infra' ? '🏗' : '⭐';
        t.innerHTML = `
            <div class="ct-row">
                <span class="ct-icon">${done ? '✅' : icon}</span>
                <span class="ct-text">${task.text}</span>
            </div>
            <div class="ct-status">${done ? '✅ ' + LANG.t('Выполнено') : '⏳ ' + LANG.t('В процессе')}</div>
        `;
        c.appendChild(t);
    });

    // Дедлайн
    const hint = document.createElement('div');
    hint.className = 'council-hint';
    hint.innerHTML = `📅 Дедлайн: конец сезона (неделя 52)`;
    c.appendChild(hint);

    // История (если есть)
    if (clubCouncil.history && clubCouncil.history.length > 0) {
        const histTitle = document.createElement('div');
        histTitle.className = 'council-section-title';
        histTitle.innerHTML = '📜 История';
        c.appendChild(histTitle);

        const lastSeasons = clubCouncil.history.slice(-5).reverse();
        lastSeasons.forEach(h => {
            const row = document.createElement('div');
            row.className = 'council-hist-row';
            const cls = h.done === h.total ? 'good' : h.done >= h.total / 2 ? 'mid' : 'bad';
            row.innerHTML = `
                <span class="chr-season">${h.season}</span>
                <span class="chr-result ${cls}">${h.done} из ${h.total}</span>
            `;
            c.appendChild(row);
        });
    }
}

function renderClubReports(c, club) {
    c.innerHTML = '';
    const positions = (clubSeasonPositions[presidentClubKey] || []).slice().sort((a, b) => a.season - b.season);

    if (positions.length === 0) {
        c.innerHTML = `<div class="empty-state"><div class="empty-icon">📈</div><div class="empty-title">${LANG.t('Пока нет данных')}</div><div class="empty-desc">${LANG.t('Сыграйте сезон в качестве президента — появятся отчёты')}</div></div>`;
        return;
    }

    // ===== Сводка =====
    const bestPlace = Math.min(...positions.map(p => p.place));
    const avgPlace = (positions.reduce((s, p) => s + p.place, 0) / positions.length).toFixed(1);
    const bestSeason = positions.find(p => p.place === bestPlace);

    const summary = document.createElement('div');
    summary.className = 'reports-summary';
    summary.innerHTML = `
        <div class="rs-title">📈 ${LANG.t('СТАТИСТИКА КЛУБА')}</div>
        <div class="rs-stats">
            <div class="rs-stat"><span class="v">${positions.length}</span><span class="l">${LANG.t('Сезонов')}</span></div>
            <div class="rs-stat"><span class="v gold">${bestPlace}</span><span class="l">${LANG.t('Лучшее место')}</span></div>
            <div class="rs-stat"><span class="v">${avgPlace}</span><span class="l">${LANG.t('Среднее место')}</span></div>
        </div>
        ${bestSeason ? `<div class="rs-best">🌟 ${LANG.t('Лучший сезон')}: ${bestSeason.season} (${bestSeason.place}${LANG.t('-е место')})</div>` : ''}
    `;
    c.appendChild(summary);

    // ===== Большой график =====
    const graphHTML = buildClubPositionGraph(presidentClubKey);
    if (graphHTML) {
        const graphWrap = document.createElement('div');
        graphWrap.innerHTML = graphHTML;
        c.appendChild(graphWrap.firstElementChild);
    }

    // ===== Таблица сезонов =====
    const tableTitle = document.createElement('div');
    tableTitle.className = 'reports-section-title';
    tableTitle.innerHTML = '📅 ' + LANG.t('По сезонам');
    c.appendChild(tableTitle);

    const table = document.createElement('div');
    table.className = 'reports-table';
    table.innerHTML = `
        <div class="rt-head">
            <div class="rt-col-season">${LANG.t('Сезон')}</div>
            <div class="rt-col-num">${LANG.t('Место')}</div>
            <div class="rt-col-num">${LANG.t('Очки')}</div>
        </div>
    `;
    positions.slice().reverse().forEach((p, idx) => {
        const row = document.createElement('div');
        row.className = 'rt-row' + (idx === 0 ? ' rt-row-latest' : '');
        const placeClass = p.place <= 4 ? 'good' : p.place <= p.total / 2 ? 'mid' : 'bad';
        row.innerHTML = `
            <div class="rt-col-season">${p.season}/${(p.season + 1).toString().slice(-2)}</div>
            <div class="rt-col-num ${placeClass}">${p.place} ${LANG.t('из')} ${p.total}</div>
            <div class="rt-col-num">${p.points || '—'}</div>
        `;
        table.appendChild(row);
    });
    c.appendChild(table);

    // ===== История задач совета =====
    ensureCouncil();
    if (clubCouncil && clubCouncil.history && clubCouncil.history.length > 0) {
        const histTitle = document.createElement('div');
        histTitle.className = 'reports-section-title';
        histTitle.innerHTML = '📋 Задачи совета';
        c.appendChild(histTitle);

        const histTable = document.createElement('div');
        histTable.className = 'reports-table';
        histTable.innerHTML = `
            <div class="rt-head">
                <div class="rt-col-season">Сезон</div>
                <div class="rt-col-num" style="grid-column: span 2;">Выполнено задач</div>
            </div>
        `;
        clubCouncil.history.slice().reverse().forEach((h, idx) => {
            const row = document.createElement('div');
            row.className = 'rt-row' + (idx === 0 ? ' rt-row-latest' : '');
            const cls = h.done === h.total ? 'good' : h.done >= h.total / 2 ? 'mid' : 'bad';
            row.innerHTML = `
                <div class="rt-col-season">${h.season}/${(h.season + 1).toString().slice(-2)}</div>
                <div class="rt-col-num ${cls}" style="grid-column: span 2;">${h.done} из ${h.total}</div>
            `;
            histTable.appendChild(row);
        });
        c.appendChild(histTable);
    }

    // ===== Топ-5 игроков =====
    const clubHistoryPlayers = {};
    players.forEach(p => {
        if (!p.seasonHistory || p.seasonHistory.length === 0) return;
        let totalGP = 0, totalG = 0, totalA = 0, seasonsInClub = 0, bestRating = 0;
        p.seasonHistory.forEach(s => {
            if (s.club === club.club && s.league === club.league) {
                totalGP += s.gp || 0;
                totalG += s.goals || 0;
                totalA += s.assists || 0;
                if ((s.rating || 0) > bestRating) bestRating = s.rating;
                seasonsInClub++;
            }
        });
        if (seasonsInClub > 0) {
            clubHistoryPlayers[p.name] = {
                name: p.name, gp: totalGP, goals: totalG, assists: totalA,
                seasons: seasonsInClub, rating: bestRating
            };
        }
    });

    const topPlayers = Object.values(clubHistoryPlayers)
        .sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists))
        .slice(0, 5);

    if (topPlayers.length > 0) {
        const playersTitle = document.createElement('div');
        playersTitle.className = 'reports-section-title';
        playersTitle.innerHTML = '⭐ ' + LANG.t('Легенды клуба (топ-5)');
        c.appendChild(playersTitle);

        const playersList = document.createElement('div');
        playersList.className = 'reports-players-list';
        topPlayers.forEach((tp, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
            const pts = tp.goals + tp.assists;
            const row = document.createElement('div');
            row.className = 'reports-player-row';
            row.innerHTML = `
                <span class="rp-medal">${medal}</span>
                <span class="rp-name">${tp.name}</span>
                <span class="rp-stats">${tp.gp} И • ${tp.goals}+${tp.assists} = ${pts} О</span>
                <span class="rp-rating">${tp.rating}</span>
            `;
            playersList.appendChild(row);
        });
        c.appendChild(playersList);
    }
}

function renderClubUpgrade(c, club) {
    c.innerHTML = '';

    const salaryLoad = getClubSalaryLoad(club);
    const loadClass = salaryLoad < 70 ? 'load-good' : salaryLoad < 90 ? 'load-mid' : 'load-bad';
    const avgLvl = getClubUpgradesAvg(club);

    const header = document.createElement('div');
    header.className = 'infra-header';
    header.innerHTML = `
        <div class="infra-club-name"><span class="infra-club-logo">${getTeamLogoHTML(club.club, club.league)}</span>${club.club}</div>
        <div class="infra-club-league">${getLeagueName(club.league)} • ${LANG.t('Престиж')} ${club.prestige}</div>
        <div class="infra-stats-row">
            <div class="infra-stat">
                <span class="infra-stat-lbl">💰 Баланс</span>
                <span class="infra-stat-val ${club.budget < 0 ? 'negative' : ''}">${formatMoney(club.budget)}</span>
            </div>
            <div class="infra-stat">
                <span class="infra-stat-lbl">📊 Средний ур.</span>
                <span class="infra-stat-val">${avgLvl}/25</span>
            </div>
            <div class="infra-stat">
                <span class="infra-stat-lbl">📉 Нагрузка ЗП</span>
                <span class="infra-stat-val ${loadClass}">${salaryLoad}%</span>
            </div>
        </div>
        ${club.budget < 0 ? '<div class="infra-debt-warn">🔴 Клуб в долгах! Улучшения недоступны</div>' : ''}
    `;
    c.appendChild(header);

    // Трофеи клуба
    const trophies = getClubTrophiesList(club);
    if (trophies.length > 0) {
        const trophyBlock = document.createElement('div');
        trophyBlock.className = 'infra-trophies';
        trophyBlock.innerHTML = `
            <div class="infra-trophies-title">🏆 Трофеи клуба</div>
            <div class="infra-trophies-grid">
                ${trophies.map(t => `<div class="infra-trophy"><span class="infra-trophy-icon">${t.icon}</span><span class="infra-trophy-name">${t.name}</span><span class="infra-trophy-count">×${t.count}</span></div>`).join('')}
            </div>
        `;
        c.appendChild(trophyBlock);
    }

    for (const key of Object.keys(CLUB_UPGRADE_CARDS)) {
        c.appendChild(buildClubUpgradeCard(club, key));
    }

    const footer = document.createElement('div');
    footer.className = 'infra-footer';
    const leaveBtn = document.createElement('button');
    leaveBtn.className = 'infra-leave-btn';
    leaveBtn.textContent = '🚪 Покинуть пост президента';
    leaveBtn.addEventListener('click', async () => {
        if (!(await uiConfirm(LANG.t('Покинуть пост президента? Акции останутся у вас.')))) return;
        presidentClubKey = null;
        clubCouncil = null; // v1.0: сброс совета при потере поста
        saveGame();
        hideClubBottomNav();
        hidePagination();
        document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
        const os = document.getElementById('office-screen');
        if (os) os.style.display = 'flex';
        showBottomNav();
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const navO = document.querySelector('.nav-item[data-nav="office"]');
        if (navO) navO.classList.add('active');
        updateAllDisplays();
    });
    footer.appendChild(leaveBtn);
    c.appendChild(footer);

    // Вспышка последней купленной карточки
    if (window.lastPurchasedCard) {
        const card = c.querySelector(`.infra-card[data-card="${window.lastPurchasedCard}"]`);
        if (card) {
            setTimeout(() => card.classList.add('flash'), 30);
        }
        window.lastPurchasedCard = null;
    }
}

function buildClubUpgradeCard(club, cardKey) {
    const card = CLUB_UPGRADE_CARDS[cardKey];
    const lvl = club.upgrades[cardKey] || 1;
    const isMax = lvl >= 25;
    const cost = isMax ? 0 : clubUpgradeCost(cardKey, lvl, club.league);
    const canAfford = !isMax && club.budget >= cost && club.budget >= 0;
    const expanded = !!expandedInfraCards[cardKey];

    const div = document.createElement('div');
    div.className = 'infra-card' + (isMax ? ' maxed' : '') + (expanded ? ' expanded' : '');
    div.setAttribute('data-card', cardKey);

    const pips = Array.from({length: 25}, (_, i) => `<div class="infra-pip ${i < lvl ? 'filled' : ''}"></div>`).join('');
    const eff = getCardEffects(cardKey, lvl);

    let nextBlock = '';
    if (!isMax) {
        const effNext = getCardEffects(cardKey, lvl + 1);
        nextBlock = `
            <div class="infra-next-section">
                <div class="infra-next-title">СЛЕДУЮЩИЙ УРОВЕНЬ</div>
                ${effNext.labels.map((lbl, i) => `<div class="infra-effect-row next"><span class="infra-effect-lbl">${lbl}</span><span class="infra-effect-val-next">${formatEffectVal(cardKey, i, effNext.values[i])}</span></div>`).join('')}
            </div>
        `;
    }

    div.innerHTML = `
        <div class="infra-card-head">
            <div class="infra-card-icon">${card.icon}</div>
            <div class="infra-card-title-block">
                <div class="infra-card-title">${card.name.toUpperCase()}</div>
                <div class="infra-card-desc">${card.desc}</div>
            </div>
            <div class="infra-card-level">${lvl}<span class="infra-card-level-max">/25</span></div>
        </div>
        <div class="infra-pips">${pips}</div>
        <div class="infra-current-section">
            ${eff.labels.map((lbl, i) => `<div class="infra-effect-row"><span class="infra-effect-lbl">${lbl}</span><span class="infra-effect-val">${formatEffectVal(cardKey, i, eff.values[i])}</span></div>`).join('')}
        </div>
        ${expanded ? nextBlock : ''}
        <div class="infra-card-footer">
            ${isMax
                ? '<div class="infra-max-badge">⭐ МАКСИМУМ</div>'
                : `<div class="infra-cost">💰 ${formatMoney(cost)}</div>
                   <button class="infra-upgrade-btn ${canAfford ? '' : 'disabled'}" ${canAfford ? '' : 'disabled'} data-upgrade="${cardKey}">⬆</button>`}
        </div>
    `;

    div.addEventListener('click', (e) => {
        if (e.target.closest('[data-upgrade]')) return;
        expandedInfraCards[cardKey] = !expandedInfraCards[cardKey];
        renderClubUpgrade(document.getElementById('club-hub-content'), clubData[presidentClubKey]);
    });

    const btn = div.querySelector('[data-upgrade]');
    if (btn) {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            purchaseClubUpgrade(cardKey);
        });
    }

    return div;
}

function purchaseClubUpgrade(cardKey) {
    if (!presidentClubKey) return;
    const club = clubData[presidentClubKey];
    if (!club) return;

    const lvl = club.upgrades[cardKey] || 1;
    if (lvl >= 25) { uiAlert(LANG.t('Максимальный уровень достигнут!')); return; }

    const cost = clubUpgradeCost(cardKey, lvl, club.league);
    if (club.budget < cost) { uiAlert(LANG.t('Недостаточно денег в бюджете клуба!')); return; }

    club.budget -= cost;
    club.upgrades[cardKey] = lvl + 1;

    const card = CLUB_UPGRADE_CARDS[cardKey];
    addNews(`🏗 ${card.icon} ${card.name} улучшен до ${lvl + 1} (${club.club})`, "positive");

    window.lastPurchasedCard = cardKey;
    saveGame();
    renderClubUpgrade(document.getElementById('club-hub-content'), clubData[presidentClubKey]);
}

function getCardEffects(cardKey, lvl) {
    if (cardKey === 'stadium') return { labels: ['Вместимость', 'Дом. бонус'], values: [getStadiumCapacity(lvl), getStadiumHomeBonus(lvl)] };
    if (cardKey === 'marketing') return { labels: ['Спонсоров', 'Множитель дохода'], values: [getMarketingSponsors(lvl), getMarketingMultiplier(lvl)] };
    if (cardKey === 'medical') return { labels: ['Снижение травм', 'Восстановление'], values: [getMedicalInjuryReduction(lvl), getMedicalRecoveryWeeks(lvl)] };
    if (cardKey === 'training') return { labels: ['Бонус к росту'], values: [getTrainingGrowthBonus(lvl)] };
    if (cardKey === 'scouting') return { labels: ['Мин. рейтинг новичка', 'Шанс таланта'], values: [getScoutingMinRating(lvl), getScoutingTalentChance(lvl)] };
    if (cardKey === 'academy') return { labels: ['Бонус к потенциалу'], values: [getAcademyPotentialBonus(lvl)] };
    return { labels: [], values: [] };
}

function formatEffectVal(cardKey, idx, val) {
    if (cardKey === 'stadium') return idx === 0 ? Math.round(val).toLocaleString() + ' мест' : '+' + (val * 100).toFixed(2) + '%';
    if (cardKey === 'marketing') return idx === 0 ? val : '×' + val.toFixed(2);
    if (cardKey === 'medical') return idx === 0 ? '−' + Math.round(val * 100) + '%' : '−' + val + ' нед.';
    if (cardKey === 'training') return '+' + Math.round((val - 1) * 100) + '%';
    if (cardKey === 'scouting') return idx === 0 ? Math.round(val) : Math.round(val * 100) + '%';
    if (cardKey === 'academy') return '+' + val;
    return val;
}

document.getElementById('goals-back')?.addEventListener('click', () => {
    // Если мы внутри ветки — возвращаемся к древу
    if (currentBranchKey) {
        currentBranchKey = null;
        const t = document.getElementById('goals-title');
        if (t) t.textContent = LANG.t('Древо прогресса');
        renderCareerGoalsTree();
        return;
    }
    // Иначе — возвращаемся в офис
    hidePagination();
    document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
    const os = document.getElementById('office-screen');
    if (os) os.style.display = 'flex';
    showBottomNav();
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navO = document.querySelector('.nav-item[data-nav="office"]');
    if (navO) navO.classList.add('active');
    updateAllDisplays();
});

document.getElementById('club-hub-back')?.addEventListener('click', () => {
    hidePagination();
    hideClubBottomNav();
    document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
    const os = document.getElementById('office-screen');
    if (os) os.style.display = 'flex';
    showBottomNav();
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navO = document.querySelector('.nav-item[data-nav="office"]');
    if (navO) navO.classList.add('active');
    updateAllDisplays();
});

// Переключение под-вкладок хаба (клик по верхнему табу)
document.querySelectorAll('#club-hub-screen .club-hub-tab').forEach(tab => {
    tab.addEventListener('click', function () {
        const t = this.getAttribute('data-chub');
        if (!t) return;
        clubHubTab = t;
        renderClubHub();
    });
});

// Переключение под-вкладок хаба (клик по нижнему меню)
document.querySelectorAll('#bottom-nav-club .nav-item').forEach(item => {
    item.addEventListener('click', function () {
        const t = this.getAttribute('data-cnav');
        if (t === 'back') {
            document.getElementById('club-hub-back')?.click();
            return;
        }
        if (!t) return;
        clubHubTab = t;
        renderClubHub();
    });
});

function showNewsFeedScreen() {
    hidePagination();
    document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
    const ns = document.getElementById('news-feed-screen');
    if (ns) ns.style.display = 'flex';
    showBottomNav();
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    renderNewsFeedScreen();
}

function getNewsCategoryFor(n) {
    if (n.category) return n.category;
    return inferNewsCategory(n.text || '');
}

function renderNewsFeedScreen() {
    const c = document.getElementById('news-feed-content');
    if (!c) return;
    c.innerHTML = '';

    document.querySelectorAll('#news-feed-screen .clients-tab').forEach(t => {
        if (t.getAttribute('data-ntab') === newsTab) t.classList.add('active');
        else t.classList.remove('active');
    });

    let list = newsFeed;
    if (newsTab === 'clients') list = newsFeed.filter(n => getNewsCategoryFor(n) === 'clients');
    else if (newsTab === 'leagues') list = newsFeed.filter(n => getNewsCategoryFor(n) === 'leagues');
    else if (newsTab === 'finance') list = newsFeed.filter(n => getNewsCategoryFor(n) === 'finance');

    if (list.length === 0) {
        c.innerHTML = `<div class="empty-state"><div class="empty-icon">📰</div><div class="empty-title">${LANG.t('Новостей нет')}</div><div class="empty-desc">${LANG.t('Играйте недели — новости появятся')}</div></div>`;
        return;
    }

    const frag = document.createDocumentFragment();
    list.forEach(n => {
        const item = document.createElement('div');
        item.className = 'news-item news-' + (n.type || 'info');
        const icon = n.type === 'positive' ? '✅' : n.type === 'negative' ? '❌' : '📰';
        // Оборачиваем имена клиентов в кликабельные span-ы
        let htmlText = n.text;
        myRoster.forEach(p => {
            if (htmlText.includes(p.name)) {
                htmlText = htmlText.split(p.name).join(
                    `<span class="news-client-link" data-player="${p.name}">${p.name}</span>`
                );
            }
        });
        item.innerHTML = `
            <div class="news-item-head">
                <span class="news-item-icon">${icon}</span>
                <span class="news-item-meta">${LANG.t('Сезон')} ${n.season} • ${LANG.t('Неделя')} ${n.week}</span>
            </div>
            <div class="news-item-text">${htmlText}</div>
        `;
        frag.appendChild(item);
    });
    c.appendChild(frag);

    // Клик по имени клиента — открыть его карточку
    c.querySelectorAll('.news-client-link').forEach(span => {
        span.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const name = span.getAttribute('data-player');
            const client = myRoster.find(p => p.name === name);
            if (client) openPlayerScreen(client, 'my');
        });
    });
}

document.querySelectorAll('#news-feed-screen .clients-tab').forEach(t => t.addEventListener('click', function () {
    const tt = this.getAttribute('data-ntab');
    if (!tt) return;
    newsTab = tt;
    renderNewsFeedScreen();
}));

function updateAllDisplays() {
    renderOffice();
    checkAllGoals();
}

// ============ 17. КЛИЕНТЫ ============
function renderClientsScreen() {
    const c = document.getElementById('clients-content');
    if (!c) return;
    const cnt = document.getElementById('my-clients-count');
    if (cnt) cnt.textContent = myRoster.length;
    document.querySelectorAll('#clients-screen .clients-tab').forEach(t => {
        const tt = t.getAttribute('data-tab');
        if (tt === clientsTab) t.classList.add('active');
        else if (tt) t.classList.remove('active');
    });
    c.innerHTML = '';
    if (clientsTab === 'my') renderMyClients(c);
    else renderSearchClients(c);
}

function renderMyClients(c) {
    if (myRoster.length === 0) {
        c.innerHTML = `<div class="empty-state"><div class="empty-icon">⭐</div><div class="empty-title">${LANG.t('Нет клиентов')}</div><div class="empty-desc">${LANG.t('Переключитесь на «Таланты»')}</div></div>`;
        hidePagination();
        return;
    }
    const sorted = [...myRoster].sort((a, b) => b.rating - a.rating);
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const data = sorted.slice(start, start + ITEMS_PER_PAGE);
    data.forEach(p => {
        const row = document.createElement('div');
        row.className = 'player-row';
        row.innerHTML = buildPlayerRow(p);
        row.addEventListener('click', () => openPlayerScreen(p, 'my'));
        c.appendChild(row);
    });
    showPagination(myRoster.length, () => { c.innerHTML = ''; renderMyClients(c); });
}

// ============ БАЗА ТАЛАНТОВ ============
// Фильтры/сортировка базы талантов (не сейвятся — UI-состояние)
let talentFilter = 'all';   // all | G | D | F
let talentSort = 'rating';  // rating | potential | age

// Показываем ВСЕХ свободных агентов. У отсканенных — точный/узкий потенциал,
// у остальных — широкий диапазон через getRevealRange().
function renderSearchClients(c) {
    c.innerHTML = ''; // сброс перед перерисовкой (фильтры/сортировка вызывают ререндер)
    const frag = document.createDocumentFragment();

    // ===== Панель фильтров и сортировки =====
    const bar = document.createElement('div');
    bar.className = 'talent-toolbar';
    bar.innerHTML = `
        <div class="talent-filters">
            <button class="talent-filter-btn ${talentFilter==='all'?'active':''}" data-tf="all">${LANG.t('Все')}</button>
            <button class="talent-filter-btn ${talentFilter==='G'?'active':''}" data-tf="G">🧤 ${LANG.t('Вратари (G)')}</button>
            <button class="talent-filter-btn ${talentFilter==='D'?'active':''}" data-tf="D">🛡️ ${LANG.t('Защитники (D)')}</button>
            <button class="talent-filter-btn ${talentFilter==='F'?'active':''}" data-tf="F">🎯 ${LANG.t('Форварды (F)')}</button>
        </div>
        <div class="talent-sort-row">
            <select class="talent-sort-select" id="talent-sort-select">
                <option value="rating" ${talentSort==='rating'?'selected':''}>${LANG.t('По рейтингу (убывание)')}</option>
                <option value="potential" ${talentSort==='potential'?'selected':''}>${LANG.t('По потенциалу (убывание)')}</option>
                <option value="age" ${talentSort==='age'?'selected':''}>${LANG.t('По возрасту (возрастание)')}</option>
            </select>
            <button class="talent-clear-btn" id="talent-clear-btn">🧹 ${LANG.t('Очистить базу')}</button>
        </div>
    `;
    frag.appendChild(bar);

    let available = players.filter(p =>
        p.agentId === null &&
        !p.club &&
        (talentFilter === 'all' ||
         (talentFilter === 'F' ? ['C','LW','RW'].includes(p.position) : p.position === talentFilter))
    );

    if (available.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = `<div class="empty-icon">🔍</div><div class="empty-title">${LANG.t('База талантов пуста')}</div><div class="empty-desc">${LANG.t('Скауты найдут новых игроков в начале Трансферного Окна')}</div>`;
        frag.appendChild(empty);
        c.appendChild(frag);
        hidePagination();
        return;
    }

    // ===== Сортировка =====
    const potKnown = (p) => p.isScouted || getRevealRange() === 0;
    const sorted = [...available].sort((a, b) => {
        if (talentSort === 'age') return a.age - b.age || b.rating - a.rating;
        if (talentSort === 'potential') {
            // Неизвестный потенциал уходит вниз списка
            return (potKnown(b) ? b.potential : -1) - (potKnown(a) ? a.potential : -1) || b.rating - a.rating;
        }
        return b.rating - a.rating; // rating (по умолчанию)
    });

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const data = sorted.slice(start, start + ITEMS_PER_PAGE);
    data.forEach(p => {
        const row = document.createElement('div');
        row.className = 'player-row';
        row.innerHTML = buildPlayerRow(p);
        row.addEventListener('click', () => openPlayerScreen(p, 'search'));
        frag.appendChild(row);
    });
    c.appendChild(frag);
    showPagination(Math.min(sorted.length, 300), () => { c.innerHTML = ''; renderSearchClients(c); });

    // ===== Обработчики панели (после вставки в DOM) =====
    c.querySelectorAll('.talent-filter-btn').forEach(b => {
        b.addEventListener('click', () => {
            talentFilter = b.getAttribute('data-tf');
            currentPage = 1;
            renderSearchClients(c);
        });
    });
    const sortSel = c.querySelector('#talent-sort-select');
    if (sortSel) sortSel.addEventListener('change', () => {
        talentSort = sortSel.value;
        currentPage = 1;
        renderSearchClients(c);
    });
    const clearBtn = c.querySelector('#talent-clear-btn');
    if (clearBtn) clearBtn.addEventListener('click', () => {
        const before = players.length;
        // Удаляем из players свободных агентов с рейтингом ниже 40.
        // Не трогаем: клиентов агентства, игроков клубов и отсканенных талантов.
        players = players.filter(p =>
            p.club || p.agentId !== null || p.isScouted || p.rating >= 40
        );
        myRoster = myRoster.filter(p => players.includes(p)); // страховка ссылок
        const removed = before - players.length;
        addNews(`🧹 ${LANG.t('Очистка базы')}: ${removed} ${LANG.t('игроков удалено')}`, "info");
        currentPage = 1;
        saveGame();
        renderSearchClients(c);
    });
}

function buildPlayerRow(p) {
    const flag = getPlayerCountry(p);
    const rc = p.rating >= 80 ? 'high' : p.rating >= 65 ? 'mid' : 'low';
    const ls = p.league ? getLeagueName(p.league) : ''; 
    const isFA = !p.club;
    
    // Вычисляем диапазон потенциала: отсканенные скаутами — точное значение (или узкий диапазон ±2),
    // остальные — широкий диапазон по уровню reveal
    let potStr = '';
    let potNum = null; // известен ли потенциал точно (для подсветки)
    if (p.isScouted) {
        const scoutRange = upgrades.reveal >= 25 ? 0 : Math.min(2, getRevealRange());
        if (scoutRange === 0) { potStr = `${p.potential}`; potNum = p.potential; }
        else potStr = `${Math.max(0, p.potential - scoutRange)}–${Math.min(100, p.potential + scoutRange)}`;
    } else {
        const range = getRevealRange();
        if (range === 0) { potStr = `${p.potential}`; potNum = p.potential; }
        else {
            const minPot = Math.max(0, p.potential - range);
            const maxPot = Math.min(100, p.potential + range);
            potStr = `${minPot}–${maxPot}`;
        }
    }
    // Подсветка: известный потенциал >=80 зелёный, >=60 жёлтый, ниже — красный
    const potGlowClass = potNum === null ? '' : potNum >= 80 ? ' pot-glow-high' : potNum >= 60 ? ' pot-glow-mid' : ' pot-glow-low';

    return `<div class="p-avatar">${getPlayerAvatarSVG(p)}</div>
    <div class="p-info">
        <div class="p-name-line"><span class="p-name${potGlowClass}">${p.name}</span><span class="p-pos">${p.position}</span></div>
        <div class="p-club-line"><span class="p-flag">${flag}</span><span>${isFA ? LANG.t('Свободный агент') : p.club + ' (' + ls + ')'}</span></div>
        <div class="p-pot-line">📈 ${LANG.t('Потенциал')}: <b>${potStr}</b>${p.isScouted ? ' <span style="color:var(--neon-green);font-size:10px;">✓ ' + LANG.t('Отсканирован') + '</span>' : ''}</div>
    </div>
    <div class="p-right"><div class="p-age">${LANG.t('Возраст')} <b>${p.age}</b></div><div class="p-rating ${rc}">${p.rating}</div></div>`;
}

// ============ 18. ЭКРАН ИГРОКА ============
function openPlayerScreen(player, source) {
    currentPlayerScreen = player;
    currentPlayerSource = source || 'my';
    playerTab = 'info';
    hidePagination();
    document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
    const ps = document.getElementById('player-screen');
    if (ps) ps.style.display = 'flex';
    hideBottomNav();
    renderPlayerScreen();
}

function renderPlayerScreen() {
    const p = currentPlayerScreen;
    if (!p) return;
    const tEl = document.getElementById('player-header-title');
    const iEl = document.getElementById('player-header-icon');
    if (tEl) tEl.textContent = p.name;
    if (iEl) iEl.textContent = getPlayerCountry(p);
    document.querySelectorAll('.player-tab').forEach(t => {
        if (t.getAttribute('data-ptab') === playerTab) t.classList.add('active');
        else t.classList.remove('active');
    });
    const c = document.getElementById('player-content');
    if (!c) return;
    c.innerHTML = '';
    if (playerTab === 'info') renderPlayerInfo(c, p);
    else if (playerTab === 'development') renderPlayerDevelopment(c, p);
    else if (playerTab === 'transfer') renderPlayerTransfer(c, p);
    else if (playerTab === 'history') renderPlayerHistory(c, p);
}

function renderPlayerInfo(c, p) {
    const flag = getPlayerCountry(p);
    const a = p.attributes || {};
    const s = p.stats || {gp:0,goals:0,assists:0,pim:0,plusMinus:0,goalsAgainst:0,ratingSum:0};
    const pts = s.goals + s.assists;
    const ls = LEAGUE_NAMES[p.league] || p.league;
    const isFA = !p.club;
    const loyalty = p.loyalty ?? 100;
    const lc = loyalty >= 70 ? 'loyalty-high' : loyalty >= 40 ? 'loyalty-mid' : 'loyalty-low';
    const fi = p.form > 0 ? '🔥' : p.form < 0 ? '❄' : '—';
    const trophyArr = p.trophies || [];
    const awardArr = p.awards || [];
    const revealRange = getRevealRange();
    let potText = '';
    if (revealRange === 0) {
        potText = `${p.potential}`; // Идеальное знание
    } else {
        potText = `${Math.max(0, p.potential - revealRange)}–${Math.min(100, p.potential + revealRange)}`;
    }
    const charMap = {ambitious:'🚀 ' + LANG.t('Амбициозный'), calm:'😌 ' + LANG.t('Спокойный'), pragmatic:'💼 ' + LANG.t('Прагматик'), capricious:'🎭 ' + LANG.t('Капризный'), loyal:'🐺 ' + LANG.t('Лояльный')};
    const charName = charMap[p.character] || '';

    // Лояльность клубу
    const clubLoyalty = p.clubLoyalty ?? 0;
    const clClass = clubLoyalty >= 70 ? 'loyalty-high' : clubLoyalty >= 40 ? 'loyalty-mid' : 'loyalty-low';

    // Стрелка роста рейтинга (сравнение с прошлым сезоном)
    const hist = (p.seasonHistory || []).slice().sort((a, b) => b.season - a.season);
    let ratingArrow = '';
    if (hist.length > 0) {
        const prevRating = hist[0].rating || 0;
        if (p.rating > prevRating + 1) ratingArrow = '<span class="pp-rating-arrow up">⬆</span>';
        else if (p.rating < prevRating - 1) ratingArrow = '<span class="pp-rating-arrow down">⬇</span>';
    }

    // Трофеи
    const trophyCount = (p.trophies || []).length;

    // Год окончания контракта
    const contractEnd = (p.contractYears && p.contractYears > 0) ? (currentSeason + p.contractYears) : null;
    const contractText = contractEnd ? `до ${contractEnd}` : '—';

    // Пик драфта
    const draftText = p.draftInfo ? `🎯 ${p.draftYear} • ${p.draftInfo}` : `🎯 ${LANG.t('Без драфта')}`;

    c.innerHTML = `
        <div class="pp-hero">
            <div class="pp-avatar">${getPlayerAvatarSVG(p)}</div>
            <div class="pp-hero-right">
                <div class="pp-pos">${p.position}</div>
                <div class="pp-loyalty ${lc}">${LANG.t('Отношение')} ${loyalty}%</div>
                <div class="pp-form">${LANG.t('Форма')}: ${fi}</div>
                <div class="pp-char">${charName}</div>
            </div>
        </div>
        <div class="pp-status-grid">
            <div class="pp-status-card">
                <div class="pp-status-lbl">❤️ ${LANG.t('Любит клуб')}</div>
                <div class="pp-status-val ${clClass}">${clubLoyalty}%</div>
                ${p.club ? `<div class="pp-status-sub">${p.club}</div>` : '<div class="pp-status-sub">—</div>'}
            </div>
            <div class="pp-status-card">
                <div class="pp-status-lbl">📝 ${LANG.t('Контракт')}</div>
                <div class="pp-status-val">${contractText}</div>
                <div class="pp-status-sub">${p.contractYears ? formatContractYears(p.contractYears) : '—'}</div>
            </div>
            <div class="pp-status-card">
                <div class="pp-status-lbl">🏆 ${LANG.t('Трофеи')}</div>
                <div class="pp-status-val ${trophyCount > 0 ? 'gold' : ''}">${trophyCount > 0 ? '× ' + trophyCount : '—'}</div>
                <div class="pp-status-sub">${trophyCount > 0 ? LANG.t('в карьере') : LANG.t('пока нет')}</div>
            </div>
        </div>

        <div class="pp-draft-line">${draftText}</div>
        <div class="pp-row-2">
            <div class="pp-cell"><span class="lbl">${LANG.t('Страна')}</span><span class="val">${flag}</span></div>
            <div class="pp-cell"><span class="lbl">${LANG.t('Возраст')}</span><span class="val">${p.age} ${LANG.t('лет')}</span></div>
            <div class="pp-cell"><span class="lbl">${LANG.t('Клуб')}</span><span class="val pp-club-val">${isFA ? LANG.t('Свободный агент') : `${p.club ? getTeamLogoHTML(p.club, p.league) : ''}<span>${p.club}</span>`}</span></div>
            <div class="pp-cell"><span class="lbl">${LANG.t('Лига')}</span><span class="val">${isFA ? '—' : ls}</span></div>
        </div>
        <div class="pp-section-title">⭐ ${LANG.t('Рейтинг и потенциал')}</div>
        <div class="pp-rating-row">
            <div class="pp-rating-block"><div class="pp-rating-big">${p.rating}${ratingArrow}</div><div class="pp-rating-lbl">${LANG.t('Сейчас')}</div></div>
            <div class="pp-rating-block"><div class="pp-potential">${potText}</div><div class="pp-rating-lbl">${LANG.t('Потенциал')}</div></div>
        </div>
        <div class="pp-attrs">
            ${ppAttrBar(LANG.t('Атака'), a.attack)}
            ${ppAttrBar(LANG.t('Защита'), a.defense)}
            ${ppAttrBar(LANG.t('Техника'), a.technique)}
            ${ppAttrBar(LANG.t('Психика'), a.psyche)}
            ${ppAttrBar(LANG.t('Физика'), a.physics)}
            ${ppAttrBar(LANG.t('Скорость'), a.speed)}
        </div>
        <div class="pp-section-title">📝 ${LANG.t('Контракт')}</div>
        <div class="pp-row-2">
            <div class="pp-cell"><span class="lbl">${LANG.t('Зарплата')}</span><span class="val">${formatSalary(p.salary)}</span></div>
            <div class="pp-cell"><span class="lbl">${LANG.t('Срок')}</span><span class="val">${isFA ? '—' : formatContractYears(p.contractYears)}</span></div>
        </div>
        <div class="pp-section-title">📊 ${LANG.t('Статистика')}</div>
        ${p.position === 'G' ? buildGoalieStatsHTML(s) : buildSkaterStatsHTML(s, pts)}
        <div class="pp-section-title">🏆 ${LANG.t('Награды')}</div>
        <div class="pp-awards">
            ${trophyArr.length === 0 && awardArr.length === 0 ? `<div class="pp-award-empty">${LANG.t('Нет наград')}</div>` :
              trophyArr.slice().reverse().map(t => `<div class="pp-award-trophy">🏆 ${t.name}</div>`).join('') +
              awardArr.slice().reverse().map(a => `<div class="pp-award-personal">🥇 ${a.name}</div>`).join('')}
        </div>
        ${buildPlayerActions(p)}
    `;
    const signBtn = document.getElementById('btn-pp-sign');
    if (signBtn) signBtn.addEventListener('click', () => signPlayerFromScreen(p));
}

function ppAttrBar(label, val) {
    const v = val || 0;
    const cls = v >= 80 ? 'attr-high' : v >= 65 ? 'attr-mid' : 'attr-low';
    return `<div class="pp-attr"><div class="pp-attr-head"><span class="pp-attr-label">${label}</span><span class="pp-attr-val ${cls}">${v}</span></div><div class="pp-attr-bar"><div class="pp-attr-fill ${cls}" style="width:${Math.min(100,v)}%"></div></div></div>`;
}

function buildSkaterStatsHTML(s, pts) {
    const avg = s.gp > 0 ? (s.ratingSum / s.gp).toFixed(1) : "—";
    const pm = s.plusMinus > 0 ? '+' + s.plusMinus : s.plusMinus;
    return `<div class="pp-stats-grid">
        <div class="pp-stat"><span class="v">${s.gp}</span><span class="l">${LANG.t('Игры')}</span></div>
        <div class="pp-stat"><span class="v">${s.goals}</span><span class="l">${LANG.t('Голы')}</span></div>
        <div class="pp-stat"><span class="v">${s.assists}</span><span class="l">${LANG.t('Передачи')}</span></div>
        <div class="pp-stat"><span class="v">${pts}</span><span class="l">${LANG.t('Очки')}</span></div>
        <div class="pp-stat"><span class="v">${pm}</span><span class="l">+/−</span></div>
        <div class="pp-stat"><span class="v">${avg}</span><span class="l">${LANG.t('Оценка')}</span></div>
    </div>`;
}

function buildGoalieStatsHTML(s) {
    const gaa = s.gp > 0 ? (s.goalsAgainst / s.gp).toFixed(2) : "—";
    const avg = s.gp > 0 ? (s.ratingSum / s.gp).toFixed(1) : "—";
    return `<div class="pp-stats-grid">
        <div class="pp-stat"><span class="v">${s.gp}</span><span class="l">${LANG.t('Игры')}</span></div>
        <div class="pp-stat"><span class="v">${s.goalsAgainst}</span><span class="l">${LANG.t('Пропущено')}</span></div>
        <div class="pp-stat"><span class="v gaa-color">${gaa}</span><span class="l">GAA</span></div>
        <div class="pp-stat"><span class="v">${avg}</span><span class="l">${LANG.t('Оценка')}</span></div>
    </div>`;
}

function buildPlayerActions(p) {
    if (currentPlayerSource === 'search') {
        if (myRoster.length >= getSlots()) return `<div class="pp-warning">⚠️ ${LANG.t('Вы должны улучшить свой Офис для большего количества игроков или отпустить некоторых (Максимум {n})').replace('{n}', getSlots())}</div>`;
        return `<button class="btn-success pp-sign-btn" id="btn-pp-sign">✓ ${LANG.t('Подписать')}</button>`;
    }
    return '';
}

// ============ ПЕРЕГОВОРЫ (модалка-смартфон) ============
// Активные переговоры (живут только в рамках текущей сессии UI, не сейвятся)
let activeNegotiation = null;

// ============ ХРАНИЛИЩЕ ПРЕДЛОЖЕНИЙ (сейвится вместе с игрой) ============
// playerNegotiations[playerName] = { offers: [...], walkedClubs: {clubKey: true} }
// Предложения не "перекатываются" при перезаходе: живут, пока агент их не отклонит.
// (объявление перенесено в начало файла, v1.0)

function getNegotiationEntry(playerName) {
    if (!playerNegotiations[playerName]) playerNegotiations[playerName] = { offers: [], walkedClubs: {} };
    return playerNegotiations[playerName];
}

// Взвешенный случайный выбор клуба: более престижные клубы чаще интересуются,
// но каждый раз набор разный даже для одинаковых игроков
function pickRandomClubs(clubs, maxCount) {
    const pool = [...clubs];
    const picked = [];
    const n = Math.min(maxCount, pool.length);
    for (let i = 0; i < n; i++) {
        // Вес = prestige + 20, чтобы слабые клубы тоже выпадали
        const weights = pool.map(c => (c.prestige || 40) + 20);
        const total = weights.reduce((s, w) => s + w, 0);
        let roll = Math.random() * total;
        let idx = 0;
        for (let j = 0; j < pool.length; j++) {
            roll -= weights[j];
            if (roll <= 0) { idx = j; break; }
        }
        picked.push(pool.splice(idx, 1)[0]);
    }
    return picked;
}

function openClubPickModal(player) {
    // Подбираем клубы, которые реально могут быть заинтересованы
    const clubs = getClubsForPlayer(player);
    if (clubs.length === 0) { uiAlert(LANG.t('Нет подходящих клубов для переговоров')); return; }

    const entry = getNegotiationEntry(player.name);

    // Если предложения уже есть — показываем сохранённый список (никакого "перекатывания")
    if (entry.offers.length > 0) {
        renderSavedOffersInPhone(player, entry);
        return;
    }
    // Все предложения были отклонены — новых не будет до следующего ТО
    if (entry.exhausted) {
        renderSavedOffersInPhone(player, entry);
        return;
    }

    // Новая генерация: случайный спрос 1-5 клубов + взвешенный рандом выбора
    const interested = pickRandomClubs(clubs, randomInt(1, 5));
    if (interested.length === 0) { uiAlert(LANG.t('Нет подходящих клубов для переговоров')); return; }

    // Сразу создаём офферы с "шумом" в суммах — они сохраняются в entry.offers
    entry.offers = interested.map(c => generateTransferOffer(player, c)).filter(Boolean);
    entry.offers.forEach(o => { o.signingBonus = o.signingBonus || 0; });
    if (entry.offers.length === 0) { uiAlert(LANG.t('Нет подходящих клубов для переговоров')); return; }
    saveGame();
    renderSavedOffersInPhone(player, entry);
}

// Список уже сохранённых предложений клуба в "телефоне"
function renderSavedOffersInPhone(player, entry) {
    // Шапка телефона
    phoneChatAvatar.innerHTML = `<span style="font-size:26px;">📥</span>`;
    phoneChatName.textContent = player.name;
    phoneChatStatus.textContent = entry.offers.length > 0 ? LANG.t('ведет переговоры') : LANG.t('Все предложения отклонены');
    phoneChatStatus.classList.remove('busy');

    if (entry.offers.length === 0) {
        phoneChatBody.innerHTML = `
            <div class="neg-msg neg-msg-system"><div class="neg-bubble neutral">${LANG.t('Все предложения отклонены. Ожидайте следующего ТО')}</div></div>`;
        phoneInputBar.innerHTML = '';
        const backBtn = document.createElement('button');
        backBtn.className = 'phone-btn-close';
        backBtn.textContent = LANG.t('Назад');
        backBtn.addEventListener('click', () => { closeNegotiationModal(); renderPlayerScreen(); });
        phoneInputBar.appendChild(backBtn);
    } else {
        phoneChatBody.innerHTML = `<div class="neg-club-list">${entry.offers.map(o => {
            const fl = LEAGUE_DATA[o.league]?.country.split(' ')[0] || '';
            return `<div class="neg-club-item" data-key="${o.league}_${o.club}">
                ${getTeamLogoHTML(o.club, o.league)}
                <div class="neg-club-info">
                    <span class="neg-club-name">${o.club}</span>
                    <span class="neg-club-meta">${fl} ${getLeagueName(o.league)} • ⭐ ${o.prestige} • 💰 ${formatSalary(o.newSalary)} • 📅 ${o.years}</span>
                </div>
                <span class="neg-club-arrow">→</span>
            </div>`;
        }).join('')}</div>`;
        phoneInputBar.innerHTML = '';
        const closeBtn = document.createElement('button');
        closeBtn.className = 'phone-btn-close';
        closeBtn.textContent = LANG.t('Закрыть');
        closeBtn.addEventListener('click', () => { closeNegotiationModal(); renderPlayerScreen(); saveGame(); });
        phoneInputBar.appendChild(closeBtn);
    }

    phoneChatBody.querySelectorAll('.neg-club-item').forEach(el => {
        el.addEventListener('click', () => {
            const parsed = splitClubKey(el.getAttribute('data-key'));
            if (!parsed) return;
            const { lk, club: clubName } = parsed;
            const offer = entry.offers.find(x => x.league === lk && x.club === clubName);
            if (offer) startNegotiationFromSaved(player, offer);
        });
    });

    eventModal.style.display = 'none';
    negotiationModal.style.display = 'flex';
}

function closeNegotiationModal() {
    negotiationModal.style.display = 'none';
}

// v1.0: тап вне phone-mockup закрывает переговоры (и сбрасывает активную сессию торга)
document.getElementById('negotiation-modal')?.addEventListener('click', (e) => {
    if (e.target.id !== 'negotiation-modal') return; // клик по фону
    closeNegotiationModal();
    if (activeNegotiation && !activeNegotiation.finished) {
        // незавершённые переговоры можно продолжить позже из списка офферов
        activeNegotiation = null;
        saveGame();
    }
    renderPlayerScreen();
});

// Переговоры по конкретному сохранённому офферу (создаются один раз при генерации)
function startNegotiationFromSaved(player, savedOffer) {
    activeNegotiation = {
        playerName: player.name,
        clubKey: savedOffer.league + '_' + savedOffer.club,
        club: savedOffer.club,
        league: savedOffer.league,
        prestige: savedOffer.prestige,
        offer: savedOffer,           // оффер мутируется при успешном торге и остаётся в entry.offers
        roundsLeft: 3,
        patience: 3,                 // шкала терпения: каждое "сердечко" — 1 попытка торга
        messages: [],
        finished: false,
        walkedAway: false
    };
    addClubMsg(LANG.t('Готов предложить контракт'), savedOffer);
    renderNegotiationModal(player);
}

function addClubMsg(text, offerSnapshot) {
    activeNegotiation.messages.push({ from: 'club', text, offer: offerSnapshot ? JSON.parse(JSON.stringify(offerSnapshot)) : null });
}

function addAgentMsg(text) {
    activeNegotiation.messages.push({ from: 'agent', text });
}

function addSystemMsg(text, isError) {
    activeNegotiation.messages.push({ from: 'system', text, isError: !!isError });
}

function buildPhoneChatHTML() {
    const neg = activeNegotiation;
    return neg.messages.map(m => {
        if (m.from === 'system') {
            return `<div class="neg-msg neg-msg-system"><div class="neg-bubble ${m.isError ? '' : 'neutral'}">${m.text}</div></div>`;
        }
        const side = m.from === 'club' ? 'neg-msg-club' : 'neg-msg-agent';
        return `
        <div class="neg-msg ${side}">
            <div class="neg-bubble">${m.text}</div>
            ${m.offer ? `
            <div class="neg-offer-card">
                <div class="neg-offer-row"><span>💰 ${LANG.t('Зарплата')}</span><b>${formatSalary(m.offer.newSalary)}</b></div>
                <div class="neg-offer-row"><span>📅 ${LANG.t('Срок')}</span><b>${formatContractYears(m.offer.years)}</b></div>
                ${m.offer.signingBonus ? `<div class="neg-offer-row neg-bonus"><span>🎁 ${LANG.t('Подписной бонус')}</span><b>${formatMoney(m.offer.signingBonus)}</b></div>` : ''}
                <div class="neg-offer-row"><span>💼 ${LANG.t('Комиссия агента')}</span><b>${formatMoney(Math.round(m.offer.newSalary * 1000 * COMMISSION_RATE))}</b></div>
            </div>` : ''}
        </div>`;
    }).join('');
}

// Плавный автоскролл чата вниз при появлении нового сообщения
function scrollChatToBottom() {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (phoneChatBody) phoneChatBody.scrollTop = phoneChatBody.scrollHeight;
        });
    });
}

function renderPhoneActions(player) {
    const neg = activeNegotiation;
    if (!neg) return;
    phoneInputBar.innerHTML = '';

    if (neg.finished) {
        // Переговоры завершены — только "Закрыть"
        const closeBtn = document.createElement('button');
        closeBtn.className = 'phone-btn-close';
        closeBtn.textContent = LANG.t('Закрыть');
        closeBtn.addEventListener('click', () => {
            closeNegotiationModal();
            activeNegotiation = null;
            renderPlayerScreen();
            saveGame();
        });
        phoneInputBar.appendChild(closeBtn);
        return;
    }

    // ===== Принять =====
    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'phone-btn-accept';
    acceptBtn.textContent = `✅ ${LANG.t('Принять')}`;
    acceptBtn.addEventListener('click', () => acceptNegotiation(player));
    phoneInputBar.appendChild(acceptBtn);

    // ===== Отправить в Мой Клуб (только для президента клуба) =====
    const presidentAvailable = presidentClubKey && (() => {
        const parts = splitClubKey(presidentClubKey);
        return parts && parts.lk === neg.league && parts.club === neg.club;
    })();
    if (presidentAvailable) {
        const club = clubData[presidentClubKey];
        // v1.0: бюджет клуба должен покрыть ЗП минус подписной бонус (бонус платит агентству клуб)
        const bonusOffset = neg.offer.signingBonus ? Math.round(neg.offer.signingBonus / 1000) : 0;
        const canAfford = club && club.budget > Math.max(0, (neg.offer.newSalary - bonusOffset)) * 1000;
        const myClubBtn = document.createElement('button');
        myClubBtn.className = 'phone-btn-myclub';
        myClubBtn.textContent = `🏛️ ${LANG.t('Отправить в Мой Клуб')}`;
        myClubBtn.disabled = !canAfford;
        myClubBtn.title = canAfford ? LANG.t('Отправить в мой клуб (за бюджет клуба, −2 репутации)') : LANG.t('У клуба нет бюджета');
        myClubBtn.addEventListener('click', () => signPlayerToMyClub(player, neg.offer));
        phoneInputBar.appendChild(myClubBtn);
    }

    // ===== Торговаться =====
    const tradeBtn = document.createElement('button');
    tradeBtn.className = 'phone-btn-trade';
    tradeBtn.textContent = `🤝 ${LANG.t('Торговаться')}`;
    tradeBtn.addEventListener('click', () => renderTradeOptionsMenu(player));
    phoneInputBar.appendChild(tradeBtn);

    // ===== Отклонить (удаляет ТОЛЬКО этот оффер из списка) =====
    const declineBtn = document.createElement('button');
    declineBtn.className = 'phone-btn-decline';
    declineBtn.textContent = `❌ ${LANG.t('Отклонить')}`;
    declineBtn.addEventListener('click', () => {
        const entry = getNegotiationEntry(player.name);
        entry.offers = entry.offers.filter(o => o !== neg.offer && o.id !== neg.offer.id);
        entry.walkedClubs[neg.clubKey] = true; // этот клуб больше не вернётся в текущей генерации
        if (entry.offers.length === 0) entry.exhausted = true; // все предложения отклонены
        addSystemMsg(LANG.t('Предложение отклонено'), false);
        neg.finished = true;
        appendNewMessages();
        renderPhoneActions(player);
        saveGame();
    });
    phoneInputBar.appendChild(declineBtn);

    // ===== Закрыть (вернуться к списку, переговоры можно продолжить) =====
    const closeBtn = document.createElement('button');
    closeBtn.className = 'phone-btn-close';
    closeBtn.textContent = LANG.t('Закрыть');
    closeBtn.addEventListener('click', () => { closeNegotiationModal(); renderPlayerScreen(); });
    phoneInputBar.appendChild(closeBtn);
}

function renderNegotiationModal(player) {
    const neg = activeNegotiation;
    if (!neg) return;

    // Шапка телефона: логотип, название клуба, статус + шкала терпения (сердечки)
    phoneChatAvatar.innerHTML = getTeamLogoHTML(neg.club, neg.league);
    phoneChatName.textContent = neg.club;
    const hearts = '❤️'.repeat(Math.max(0, neg.patience ?? 3)) + '🖤'.repeat(3 - Math.max(0, neg.patience ?? 3));
    const heartsHTML = `<span class="neg-patience" title="${LANG.t('Терпение клуба')}">${hearts}</span>`;
    if (neg.finished) {
        phoneChatStatus.innerHTML = (neg.walkedAway ? LANG.t('Переговоры провалены') : LANG.t('Переговоры завершены')) + ' ' + heartsHTML;
        phoneChatStatus.classList.toggle('busy', !!neg.walkedAway);
    } else {
        phoneChatStatus.innerHTML = LANG.t('ведет переговоры') + ' ' + heartsHTML;
        phoneChatStatus.classList.remove('busy');
    }

    phoneChatBody.innerHTML = buildPhoneChatHTML();
    renderPhoneActions(player);
    eventModal.style.display = 'none';
    negotiationModal.style.display = 'flex';
    scrollChatToBottom();
}

// Добавление новых сообщений без пересборки шапки: чат догружается и плавно скроллится вниз
function appendNewMessages() {
    if (!activeNegotiation) return;
    phoneChatBody.innerHTML = buildPhoneChatHTML();
    scrollChatToBottom();
}

function renderTradeOptionsMenu(player) {
    const neg = activeNegotiation;
    if (!neg || neg.finished) return;
    const o = neg.offer;
    phoneInputBar.innerHTML = '';

    const moneyBtn = document.createElement('button');
    moneyBtn.className = 'phone-btn-trade';
    moneyBtn.textContent = `💰 ${LANG.t('Просить больше денег')}`;
    moneyBtn.addEventListener('click', () => resolveNegotiationRound(player, 'money'));
    phoneInputBar.appendChild(moneyBtn);

    const yearsBtn = document.createElement('button');
    yearsBtn.className = 'phone-btn-trade';
    yearsBtn.textContent = `📅 ${LANG.t('Просить больше лет')}`;
    yearsBtn.disabled = o.years >= 6;
    yearsBtn.addEventListener('click', () => resolveNegotiationRound(player, 'years'));
    phoneInputBar.appendChild(yearsBtn);

    const bonusBtn = document.createElement('button');
    bonusBtn.className = 'phone-btn-trade';
    bonusBtn.textContent = `🎁 ${LANG.t('Просить бонус')}`;
    bonusBtn.disabled = !!o.signingBonus;
    bonusBtn.addEventListener('click', () => resolveNegotiationRound(player, 'bonus'));
    phoneInputBar.appendChild(bonusBtn);

    const backBtn = document.createElement('button');
    backBtn.className = 'phone-btn-close';
    backBtn.textContent = LANG.t('Назад');
    backBtn.addEventListener('click', () => renderPhoneActions(player));
    phoneInputBar.appendChild(backBtn);
}

// Шанс успеха торга: переговорщик + репутация + лояльность игрока
function getNegotiationSuccessChance(player, kind) {
    let chance = 0.30; // базовый шанс
    chance += getTradeBonus();                       // upgrades.negotiator (до +0.72)
    chance += Math.min(0.15, (getMyAgentReputation() - 10) * 0.005); // репутация
    chance += ((player.loyalty ?? 100) - 50) * 0.002; // лояльность игрока
    if (kind === 'bonus') chance += 0.10;             // клубам проще дать разовый бонус
    return Math.max(0.05, Math.min(0.90, chance));
}

function resolveNegotiationRound(player, kind) {
    const neg = activeNegotiation;
    if (!neg || neg.finished) return;
    const o = neg.offer;
    addAgentMsg(
        kind === 'money' ? LANG.t('Просить больше денег') :
        kind === 'years' ? LANG.t('Просить больше лет') :
        LANG.t('Просить бонус')
    );

    neg.roundsLeft--;
    neg.patience = Math.max(0, (neg.patience ?? 3) - 1); // каждое требование тратит 1 сердечко
    const chance = getNegotiationSuccessChance(player, kind);

    if (Math.random() < chance) {
        // ===== Успех: клуб улучшает оффер (мутирует сохранённый оффер) =====
        // Характер клуба: топ-клубы (80+) жадные, бедные (<60) сговорчивые
        const greedy = neg.prestige >= 80;
        const generous = neg.prestige < 60;
        let msg;
        if (kind === 'money') {
            const cap = calculateSalaryCap(player.rating, neg.league);
            // Топ-клубы: максимум +10-15%. Обычные: +10-25%. Бедные: +15-30% (если есть деньги)
            let minRaise = generous ? 1.15 : 1.10;
            let maxRaise = greedy ? 1.15 : generous ? 1.30 : 1.25;
            const raised = Math.min(cap, Math.round(o.newSalary * (minRaise + Math.random() * (maxRaise - minRaise))));
            o.newSalary = Math.max(o.newSalary + 1, raised); // торг никогда не понижает зарплату
            o.salaryBoost = o.newSalary / Math.max(1, player.salary);
            msg = `${LANG.t('Торг удался!')} ${LANG.t('Клуб улучшил зарплату до')} ${formatSalary(o.newSalary)}`;
            if (greedy && o.newSalary >= Math.round(o.newSalary / (1 + (maxRaise - 1)) * maxRaise * 0.999)) {
                addClubMsg(LANG.t('Это почти наш предел'), o);
            }
        } else if (kind === 'years') {
            o.years = Math.min(6, o.years + 1);
            msg = `${LANG.t('Торг удался!')} ${LANG.t('Клуб продлил срок до')} ${formatContractYears(o.years)}`;
        } else {
            const bonusMult = greedy ? (0.03 + Math.random() * 0.06) : generous ? (0.08 + Math.random() * 0.14) : (0.05 + Math.random() * 0.10);
            o.signingBonus = Math.round(o.newSalary * 1000 * bonusMult);
            msg = `${LANG.t('Торг удался!')} ${LANG.t('Клуб добавил подписной бонус')} ${formatMoney(o.signingBonus)}`;
        }
        addClubMsg(msg, o);
        addNews(`🤝 ${LANG.t('Торг удался!')} ${neg.club}: ${player.name}`, "positive");
    } else {
        // ===== Провал: клуб отзывает ТОЛЬКО своё предложение =====
        const entry = getNegotiationEntry(player.name);
        entry.offers = entry.offers.filter(x => x !== o && x.id !== o.id);
        entry.walkedClubs[neg.clubKey] = true;
        if (entry.offers.length === 0) entry.exhausted = true; // все отклонены
        addClubMsg(LANG.t('Требования слишком высоки'), null);
        addSystemMsg(LANG.t('Переговоры провалены. Клуб отозвал предложение.'), true);
        endNegotiation(player, false, true, true); // keepOpen=true — модалка НЕ закрывается
        return;
    }

    // ===== Терпение кончилось: клуб ставит ультиматум и закрывает переговоры =====
    if ((neg.patience ?? 0) <= 0) {
        addClubMsg(LANG.t('Наши условия окончательны'), o);
        addSystemMsg(LANG.t('Клуб больше не намерен торговаться'), true);
        neg.finished = true; // оффер ОСТАЁТСЯ в списке — можно вернуться и принять позже
        appendNewMessages();
        renderPhoneActions(player);
        phoneChatStatus.innerHTML = LANG.t('Переговоры завершены') + ' 🖤🖤🖤';
        phoneChatStatus.classList.add('busy');
        saveGame();
        renderPlayerScreen();
        return;
    }
    saveGame();
    appendNewMessages();
    renderPhoneActions(player);
}

/**
 * Завершает переговоры.
 * @param accepted — игрок подписал контракт
 * @param clubWalkedAway — клуб отозвал предложение
 * @param keepOpen — НЕ закрывать модалку: показать отказ и оставить только "Закрыть"
 */
function endNegotiation(player, accepted, clubWalkedAway, keepOpen) {
    const neg = activeNegotiation;
    if (!neg) return;
    neg.finished = true;

    if (keepOpen) {
        // Модалка остаётся открытой: видно отказ, в статусе "провалены",
        // кнопки Принять/Торговаться скрыты — остаётся только "Закрыть"
        appendNewMessages();
        renderPhoneActions(player);
        phoneChatStatus.textContent = LANG.t('Переговоры провалены');
        phoneChatStatus.classList.add('busy');
        saveGame();
        renderPlayerScreen();
        return;
    }

    activeNegotiation = null;
    if (!accepted) saveGame();
    renderPlayerScreen();
}

// Комиссия агента: 10% от ГОДОВОЙ зарплаты
const COMMISSION_RATE = 0.10;

function acceptNegotiation(player) {
    const neg = activeNegotiation;
    if (!neg) return;
    const o = neg.offer;

    player.club = neg.club;
    player.league = neg.league;
    player.salary = o.newSalary;
    player.clubLoyalty = 50;
    player.contractYears = o.years;
    player.lastTransferSeason = currentSeason;
    player.loyalty = Math.max(0, Math.min(100, (player.loyalty ?? 100) + 10));

    // Подписной бонус — мгновенно агенту
    if (o.signingBonus) {
        agentMoney += o.signingBonus;
        addNews(`🎁 ${LANG.t('Подписной бонус')}: +${formatMoney(o.signingBonus)}`, "positive");
    }

    // Комиссия агента: 10% от годовой зарплаты, выплачивается 26 недель
    const annualCommission = Math.round(o.newSalary * 1000 * COMMISSION_RATE);
    const weeklyAmount = Math.round(annualCommission / 26);
    activeCommissions.push({
        playerName: player.name, club: neg.club, league: neg.league,
        weeklyAmount, weeksLeft: 26, totalWeeks: 26, newSalary: o.newSalary
    });

    // ВАЖНО: игрок ОСТАЁТСЯ в myRoster — агент продолжает вести дела клиента.
    // Удаляем только заключённое предложение и все прочие офферы этого игрока.
    player.agentId = -1;
    delete playerNegotiations[player.name];
    delete transferOffers[player.name];

    careerCounters.transfersDone = (careerCounters.transfersDone || 0) + 1;
    addNews(`🏒 ${player.name} ${LANG.t('переходит в')} ${neg.club}! ${LANG.t('Комиссия: {c} (10% от годовой зарплаты)').replace('{c}', formatMoney(annualCommission))}`, "positive");

    neg.finished = true;
    addSystemMsg(LANG.t('Контракт подписан!'), false);

    // Финальное сообщение остаётся на экране, внизу — только "Закрыть"
    appendNewMessages();
    renderPhoneActions(player);
    phoneChatStatus.textContent = LANG.t('Контракт подписан!');
    phoneChatStatus.classList.remove('busy');
    activeNegotiation = null;

    updateAllDisplays();
    saveGame();
    renderClientsScreen();
}

// Подписание за бюджет клуба (только для президента клуба)
function signPlayerToMyClub(player, offer) {
    const neg = activeNegotiation;
    const clubKey = presidentClubKey;
    if (!clubKey) return;
    const club = clubData[clubKey];
    if (!club) return;
    if (club.budget < offer.newSalary * 1000) {
        openSimpleInfoModal('⚠️ ' + LANG.t('У клуба нет бюджета'), LANG.t('У клуба нет бюджета'));
        return;
    }
    club.budget -= offer.newSalary * 1000;
    upgrades.reputation = Math.max(1, upgrades.reputation - 2);

    player.club = club.club;
    player.league = club.league;
    player.salary = offer.newSalary;
    player.clubLoyalty = 70;
    player.contractYears = offer.years;
    player.lastTransferSeason = currentSeason;
    player.loyalty = Math.max(0, Math.min(100, (player.loyalty ?? 100) + 15));

    // Игрок ОСТАЁТСЯ клиентом агентства
    player.agentId = -1;
    delete playerNegotiations[player.name];
    delete transferOffers[player.name];

    if (neg) { neg.finished = true; activeNegotiation = null; }
    addNews(`🏛️ ${player.name} — ${LANG.t('Подписан за бюджет клуба')} (${club.club}). ${LANG.t('Игрок подписан в ваш клуб! Репутация −2')}`, "info");

    closeNegotiationModal();
    updateAllDisplays();
    saveGame();
    renderClientsScreen();
}



// ============ ИНДИВИДУАЛЬНЫЕ ТРЕНИРОВКИ (вкладка "Развитие") ============
// Доступные тренировки по атрибутам, с иконками и зависимостью от позиции
const TRAINING_OPTIONS = [
    { attr: 'attack',    icon: '🎯', name: 'Тренировать бросок' },
    { attr: 'speed',     icon: '💨', name: 'Тренировать скорость' },
    { attr: 'defense',   icon: '🛡️', name: 'Тренировать защиту' },
    { attr: 'technique', icon: '🎩', name: 'Тренировать технику' },
    { attr: 'psyche',    icon: '🧠', name: 'Тренировать психику' },
    { attr: 'physics',   icon: '💪', name: 'Тренировать физику' }
];

function getTrainingByAttr(attr) {
    return TRAINING_OPTIONS.find(t => t.attr === attr);
}

function renderPlayerDevelopment(c, p) {
    const isMyClient = currentPlayerSource === 'my' || myRoster.some(x => x.name === p.name);
    const html = [];

    // Заголовок блока
    html.push(`<div class="dev-section-title">🏋️ ${LANG.t('Личные тренировки')}</div>`);
    html.push(`<div class="dev-hint">${LANG.t('Стоимость тренировки: {c}. Длительность: {w}. Успех зависит от уровня Личного тренера ({ch}%).').replace('{c}', formatMoney(TRAINING_COST)).replace('{w}', LANG.t('{n} нед.').replace('{n}', TRAINING_WEEKS)).replace('{ch}', Math.round(getTrainerSuccessChance() * 100))}</div>`);

    if (!isMyClient) {
        html.push(`<div class="pp-empty-block"><div class="pp-empty-icon">🔒</div><div class="pp-empty-title">${LANG.t('Недоступно')}</div><div class="pp-empty-desc">${LANG.t('Тренировать можно только своих клиентов')}</div></div>`);
        c.innerHTML = html.join('');
        return;
    }

    // Активная тренировка
    if (p.trainingWeeks > 0 && p.trainingAttr) {
        const t = getTrainingByAttr(p.trainingAttr);
        html.push(`
            <div class="dev-active-training">
                <div class="dev-active-icon">${t ? t.icon : '🏋️'}</div>
                <div class="dev-active-info">
                    <div class="dev-active-name">${t ? LANG.t(t.name) : p.trainingAttr}</div>
                    <div class="dev-active-sub">${LANG.t('Осталось')} ${p.trainingWeeks} ${LANG.t('нед.')}</div>
                </div>
                <div class="dev-active-spinner">⏳</div>
            </div>
        `);
    }

    // Текущие атрибуты
    const a = p.attributes || {};
    html.push(`<div class="dev-attrs">${TRAINING_OPTIONS.map(t => {
        const val = a[t.attr] || 0;
        const cls = val >= 80 ? 'attr-high' : val >= 65 ? 'attr-mid' : 'attr-low';
        return `<div class="dev-attr-chip">
            <span class="dev-attr-icon">${t.icon}</span>
            <span class="dev-attr-label">${LANG.t({attack:'Атака',speed:'Скорость',defense:'Защита',technique:'Техника',psyche:'Психика',physics:'Физика'}[t.attr])}</span>
            <span class="dev-attr-val ${cls}">${val}</span>
        </div>`;
    }).join('')}</div>`);

    // Кнопки тренировок
    if (p.trainingWeeks > 0) {
        html.push(`<div class="dev-warning">⏳ ${LANG.t('Игрок уже тренируется. Дождитесь завершения.')}</div>`);
    } else {
        html.push(`<div class="dev-btn-grid">`);
        TRAINING_OPTIONS.forEach(t => {
            const attrVal = a[t.attr] || 0;
            const atMax = attrVal >= 99;
            const canAfford = agentMoney >= TRAINING_COST;
            const disabled = atMax || !canAfford;
            html.push(`<button class="dev-train-btn ${disabled ? 'disabled' : ''}" data-attr="${t.attr}" ${disabled ? 'disabled' : ''}>
                <span class="dtb-icon">${t.icon}</span>
                <span class="dtb-name">${LANG.t(t.name)}</span>
                <span class="dtb-cost">${atMax ? 'MAX' : formatMoney(TRAINING_COST)}</span>
            </button>`);
        });
        html.push(`</div>`);
        if (agentMoney < TRAINING_COST) {
            html.push(`<div class="dev-warning">⚠️ ${LANG.t('Недостаточно средств')}</div>`);
        }
    }

    // Инфо о тренере
    html.push(`<div class="dev-trainer-info">
        <span>🏋️ ${LANG.t('Личный тренер')}: ${LANG.t('уровень')} ${upgrades.trainer}</span>
        <span>🎲 ${LANG.t('Шанс успеха')}: ${Math.round(getTrainerSuccessChance() * 100)}%</span>
    </div>`);

    c.innerHTML = html.join('');

    // Обработчики кнопок
    c.querySelectorAll('.dev-train-btn:not(.disabled)').forEach(btn => {
        btn.addEventListener('click', () => startPlayerTraining(p, btn.getAttribute('data-attr')));
    });
}

function startPlayerTraining(p, attr) {
    if (!myRoster.some(x => x.name === p.name)) return;
    if (p.trainingWeeks > 0) return;
    if (agentMoney < TRAINING_COST) { uiAlert(LANG.t('Недостаточно средств')); return; }
    if (!getTrainingByAttr(attr)) return;

    agentMoney -= TRAINING_COST;
    p.trainingWeeks = TRAINING_WEEKS;
    p.trainingAttr = attr;

    const t = getTrainingByAttr(attr);
    addNews(`🏋️ ${LANG.t('Начата тренировка')}: ${p.name} — ${LANG.t(t.name)} (${formatMoney(TRAINING_COST)})`, "info");
    saveGame();
    updateAllDisplays();
    renderPlayerScreen();
}

// Тик тренировок — вызывается каждую неделю (и в регулярке, и в ТО)
function processWeeklyTrainings() {
    myRoster.forEach(p => {
        if (!p.trainingWeeks || p.trainingWeeks <= 0 || !p.trainingAttr) return;
        p.trainingWeeks--;
        if (p.trainingWeeks > 0) return;

        // Тренировка завершена: бросок на успех
        const attr = p.trainingAttr;
        p.trainingAttr = null;
        if (!p.attributes) p.attributes = generateAttributes(p.position, p.rating, p.name);
        const chance = getTrainerSuccessChance();
        if (Math.random() < chance) {
            p.attributes[attr] = Math.min(99, (p.attributes[attr] || 0) + 1);
            // Рейтинг +1 и пересчет зарплаты (логика calculateSalary не тронута)
            p.rating = Math.min(99, (p.rating || 1) + 1);
            p.salary = p.club ? calculateSalary(p.rating, p.league) : 25;
            const t = getTrainingByAttr(attr);
            addNews(`✅ ${p.name}: ${LANG.t('тренировка удалась!')} ${t ? LANG.t(t.name) : attr} +1`, "positive");
        } else {
            const t = getTrainingByAttr(attr);
            addNews(`❌ ${p.name}: ${LANG.t('тренировка не дала результата')} (${t ? LANG.t(t.name) : attr})`, "negative");
        }
    });
}

function renderPlayerTransfer(c, p) {
    if (currentPlayerSource !== 'my') {
        c.innerHTML = '<div class="pp-empty-block"><div class="pp-empty-icon">🔒</div><div class="pp-empty-title">Недоступно</div><div class="pp-empty-desc">Трансферы только для своих клиентов</div></div>';
        return;
    }
    const isFree = !p.club;
    const inTransferWindow = seasonPhase === 'transfer_mid' || seasonPhase === 'transfer_off';
    const html = [];

    html.push(`
        <div class="pt-info">
            <div class="pt-info-line"><span class="lbl">${LANG.t('Клуб')}</span><span class="val">${isFree ? '🕊️ ' + LANG.t('Свободный агент') : p.club}</span></div>
            <div class="pt-info-line"><span class="lbl">${LANG.t('Зарплата')}</span><span class="val">${formatSalary(p.salary)}</span></div>
            <div class="pt-info-line"><span class="lbl">${LANG.t('Отношение')}</span><span class="val">${p.loyalty ?? 100}%</span></div>
            <div class="pt-info-line"><span class="lbl">${LANG.t('Репутация')}</span><span class="val">⭐ ${getMyAgentReputation()}</span></div>
        </div>
    `);

    // Проверяем: есть ли активная задача на поиск клуба — тогда не блокируем
    const hasClubTask = activeTasks.some(t =>
        t.playerName === p.name &&
        (t.type === 'find_club_top' || t.type === 'find_club_home' || t.type === 'find_club_same')
    );
    const alreadyTransferred = p.lastTransferSeason === currentSeason && !isFree && !hasClubTask;

    if (alreadyTransferred) {
        html.push(`<div class="pt-hint">🔒 ${LANG.t('Игрок уже менял клуб в этом сезоне. Следующий трансфер — после окончания сезона.')}</div>`);
        c.innerHTML = html.join('');
        return;
    }
    if (p.lastTransferSeason === currentSeason && !isFree && hasClubTask) {
        html.push(`<div class="pt-hint">⚠️ ${LANG.t('Игрок уже менял клуб в этом сезоне, но у тебя есть обещание — поиск разрешён.')}</div>`);
    }

    // Свободный агент: переговоры доступны всегда. Клиент с клубом: только в ТО.
    const canNegotiate = isFree || inTransferWindow || hasClubTask;
    const hint = isFree
        ? LANG.t('Игрок без клуба. Ищите клуб — можно и в ТО, и в регулярке.')
        : (canNegotiate
            ? LANG.t('Клубы интересуются вашими клиентами. Активный поиск даст больше вариантов.')
            : LANG.t('Трансферное окно закрыто. Активный поиск только в ТО.'));

    html.push(`
        <div class="pt-hint">${hint}</div>
        <button class="pt-search-btn" id="pt-negotiate-btn" ${canNegotiate ? '' : 'disabled style="opacity:0.4;"'}>
            <span class="pt-search-icon">🤝</span>
            <span class="pt-search-text">${LANG.t('Начать переговоры')}</span>
        </button>
    `);

    // Пассивные предложения клубов (пришли сами) — тоже показываем
    const entry = transferOffers[p.name];
    const negEntry = playerNegotiations[p.name];
    const hasOffers = (entry && entry.offers.length > 0) || (negEntry && negEntry.offers.length > 0);

    // Все предложения отклонены — сообщаем и ждём следующего ТО
    if (negEntry && negEntry.offers.length === 0 && !hasOffers) {
        html.push(`<div class="pt-hint">📭 ${LANG.t('Все предложения отклонены. Ожидайте следующего ТО')}</div>`);
    }

    if (negEntry && negEntry.offers.length > 0) {
        html.push(`<div class="pp-section-title">🤝 ${LANG.t('Предложения клубов')}</div>`);
        negEntry.offers.forEach(o => {
            const fl = LEAGUE_DATA[o.league]?.country.split(' ')[0] || '';
            const ls = getLeagueName(o.league);
            html.push(`
                <div class="pt-offer neg-saved-offer" data-neg-key="${o.league}_${o.club}">
                    <div class="pt-offer-head">
                        <div class="pt-offer-club">${getTeamLogoHTML(o.club, o.league)}<div class="pt-offer-club-info"><span class="pt-offer-name">${o.club}</span><span class="pt-offer-meta">${fl} ${ls} • ⭐ ${o.prestige}</span></div></div>
                        <div class="pt-offer-salary">${formatSalary(o.newSalary)}</div>
                    </div>
                    <div class="pt-offer-stats">
                        <span>📅 ${o.years} ${LANG.t('лет')}</span>
                        ${o.signingBonus ? `<span>🎁 ${formatMoney(o.signingBonus)}</span>` : ''}
                        <span>💼 ${formatMoney(Math.round(o.newSalary * 1000 * COMMISSION_RATE))}</span>
                    </div>
                </div>
            `);
        });
    }

    if (entry && entry.offers.length > 0) {
        html.push(`<div class="pp-section-title">📥 ${LANG.t('Предложения')}</div>`);
        entry.offers.forEach(o => {
            const fl = LEAGUE_DATA[o.league]?.country.split(' ')[0] || '';
            const ls = getLeagueName(o.league);
            const tier = o.tierBoost ? '<span class="pt-tier-up">▲ лига выше</span>' : '';
            const sD = Math.round((o.salaryBoost - 1) * 100);
            html.push(`
                <div class="pt-offer" data-offer-id="${o.id}">
                    <div class="pt-offer-head">
                        <div class="pt-offer-club">${getTeamLogoHTML(o.club, o.league)}<div class="pt-offer-club-info"><span class="pt-offer-name">${o.club}</span><span class="pt-offer-meta">${fl} ${ls} • ⭐ ${o.prestige}</span></div></div>
                        <div class="pt-offer-salary">${formatSalary(o.newSalary)}<span class="pt-salary-diff">+${sD}%</span></div>
                    </div>
                    <div class="pt-offer-stats">
                        <span>📅 ${o.years} ${LANG.t('лет')}</span>
                        <span>💰 ${formatMoney(o.weeklyCommission)}/нед.</span>
                        ${tier}
                    </div>
                </div>
            `);
        });
        html.push(`<button class="pt-cancel-btn" id="pt-cancel-btn">❌ ${LANG.t('Снять с трансфера')}</button>`);
    }

    c.innerHTML = html.join('');

    document.getElementById('pt-negotiate-btn')?.addEventListener('click', () => {
        if (!canNegotiate) {
            uiAlert(LANG.t('Трансферное окно закрыто. Активный поиск только в ТО.'));
            return;
        }
        openClubPickModal(p);
    });
    document.getElementById('pt-cancel-btn')?.addEventListener('click', async () => {
        if (await uiConfirm(LANG.t('Снять игрока с трансфера?'))) cancelActiveTransfer(p);
    });
    c.querySelectorAll('.pt-offer').forEach(el => {
        // Сохранённые предложения переговоров — открываем в "телефоне"
        const negKey = el.getAttribute('data-neg-key');
        if (negKey) {
            el.addEventListener('click', () => {
                const ne = playerNegotiations[p.name];
                if (!ne) return;
                const parsed = splitClubKey(negKey);
                if (!parsed) return;
                const { lk, club: clubName } = parsed;
                const offer = ne.offers.find(x => x.league === lk && x.club === clubName);
                if (offer) startNegotiationFromSaved(p, offer);
            });
            return;
        }
        el.addEventListener('click', () => {
            const oId = el.getAttribute('data-offer-id');
            const o = transferOffers[p.name]?.offers.find(x => x.id === oId);
            if (o) openTransferOfferModal(p, o);
        });
    });
}

function getLeagueRegion(lk) {
    if (!lk) return 'eu';
    if (['KHL','VHL','MHL'].includes(lk)) return 'ru';
    if (['Belarus_Extraliga','Belarus_Vysshaya'].includes(lk)) return 'by';
    if (['NHL','AHL'].includes(lk)) return 'na';
    return 'eu';
}

function renderPlayerHistory(c, p) {
    let hist = (p.seasonHistory || []).slice().sort((a, b) => b.season - a.season);

    // ===== ЖИВАЯ ИСТОРИЯ: виртуальная строка текущего сезона =====
    // Если за текущий сезон ещё нет архивной записи, но игрок уже где-то играет —
    // показываем "живой" сезон из текущей статистики (не меняя archiveSeason).
    const hasCurrentSeasonRecord = hist.some(s => s.season === currentSeason);
    const liveStats = p.stats || { gp: 0, goals: 0, assists: 0, pim: 0, plusMinus: 0, ratingSum: 0, goalsAgainst: 0 };
    const liveHasActivity = (liveStats.gp || 0) > 0 || !hasCurrentSeasonRecord;
    let liveSeason = null;
    if (!hasCurrentSeasonRecord && p.club && liveHasActivity) {
        liveSeason = {
            season: currentSeason,
            club: p.club,
            league: p.league,
            rating: p.rating,
            age: p.age,
            position: p.position,
            salary: p.salary,
            gp: liveStats.gp || 0,
            goals: liveStats.goals || 0,
            assists: liveStats.assists || 0,
            pim: liveStats.pim || 0,
            plusMinus: liveStats.plusMinus || 0,
            avgRating: (liveStats.gp || 0) > 0 ? (liveStats.ratingSum / liveStats.gp).toFixed(1) : '—',
            goalsAgainst: liveStats.goalsAgainst || 0,
            gaa: (liveStats.gp || 0) > 0 ? (liveStats.goalsAgainst / liveStats.gp).toFixed(2) : '—',
            _live: true // маркер "в процессе"
        };
        // Живая строка — сверху списка
        hist = [liveSeason, ...hist];
    }

    if (hist.length === 0) {
        const hint = p.club
            ? LANG.t('Сезон только начался — статистика появится после его окончания')
            : LANG.t('Игрок ещё не выступал в клубах');
        c.innerHTML = `
            <div class="pp-empty-block">
                <div class="pp-empty-icon">📜</div>
                <div class="pp-empty-title">${LANG.t('Карьера ещё не начата')}</div>
                <div class="pp-empty-desc" style="color: var(--text-muted); font-size: 12px; margin-top: 6px; text-align: center;">${hint}</div>
            </div>`;
        return;
    }

    // Итоги
    const totalGP = hist.reduce((s, x) => s + (x.gp || 0), 0);
    const totalG = hist.reduce((s, x) => s + (x.goals || 0), 0);
    const totalA = hist.reduce((s, x) => s + (x.assists || 0), 0);
    const totalPIM = hist.reduce((s, x) => s + (x.pim || 0), 0);
    const totalPM = hist.reduce((s, x) => s + (x.plusMinus || 0), 0);
    const totalPts = totalG + totalA;

    let bestSeason = hist[0], bestScore = -1;
    hist.forEach(s => {
        const score = (s.goals || 0) + (s.assists || 0);
        if (score > bestScore) { bestScore = score; bestSeason = s; }
    });
    let peakRating = 0;
    hist.forEach(s => { if ((s.rating || 0) > peakRating) peakRating = s.rating; });

    const graphHTML = buildCareerGraph(hist);

    // Проходим по сезонам и находим переходы
    const sortedAsc = [...hist].sort((a, b) => a.season - b.season);
    let rowsHTML = '';
    hist.forEach((s, i) => {
        const pts = (s.goals || 0) + (s.assists || 0);
        const logo = s.club ? getTeamLogoHTML(s.club, s.league) : '';
        const avgR = s.avgRating || '—';
        const isTop = (s.season === bestSeason.season);
        const pim = s.pim || 0;
        const pm = s.plusMinus || 0;
        const pmStr = pm > 0 ? '+' + pm : pm;

        // Изменение клуба с прошлого сезона
        const prevIdx = sortedAsc.findIndex(x => x.season === s.season) - 1;
        let transferMark = '';
        if (prevIdx >= 0) {
            const prev = sortedAsc[prevIdx];
            if (prev.club && s.club && prev.club !== s.club) {
                const oldP = clubData[prev.league + "_" + prev.club]?.prestige || 50;
                const newP = clubData[s.league + "_" + s.club]?.prestige || 50;
                if (newP > oldP + 3) transferMark = '<span class="cr-transfer up">⬆</span>';
                else if (newP < oldP - 3) transferMark = '<span class="cr-transfer down">⬇</span>';
                else transferMark = '<span class="cr-transfer flat">➜</span>';
            }
        }

        const region = getLeagueRegion(s.league);
        rowsHTML += `
            <div class="career-row ${isTop ? 'top-season' : ''} career-region-${region}" data-idx="${i}">
                <div class="career-cell cr-season">${s.season}<br><span class="cr-age">${s.age || '—'} ${LANG.t('л.')}</span></div>
                <div class="career-cell cr-club">${transferMark}<div class="cr-logo">${logo}</div><span>${s.club || '—'}</span></div>
                <div class="career-cell cr-num cr-rating">${s.rating || '—'}</div>
                <div class="career-cell cr-num cr-salary">${s.salary ? formatSalary(s.salary) : '—'}</div>
                <div class="career-cell cr-num">${s.gp || 0}</div>
                <div class="career-cell cr-num cr-goals">${s.goals || 0}</div>
                <div class="career-cell cr-num">${s.assists || 0}</div>
                <div class="career-cell cr-num">${pim}</div>
                <div class="career-cell cr-num cr-pm ${pm > 0 ? 'pm-up' : pm < 0 ? 'pm-down' : ''}">${pmStr}</div>
                <div class="career-cell cr-num cr-rating">${avgR}</div>
            </div>
            <div class="career-expand career-region-${region}" data-expand="${i}" style="display:none;">
            <div class="ce-grid">
                <div class="ce-item"><span class="ce-lbl">${LANG.t('Клуб')}</span><span class="ce-val">${s.club || '—'}</span></div>
<div class="ce-item"><span class="ce-lbl">${LANG.t('Лига')}</span><span class="ce-val">${s.league ? getLeagueName(s.league) : '—'}</span></div>
                    <div class="ce-item"><span class="ce-lbl">${LANG.t('Позиция')}</span><span class="ce-val">${s.position || p.position}</span></div>
                    <div class="ce-item"><span class="ce-lbl">${LANG.t('Возраст')}</span><span class="ce-val">${s.age || '—'} ${LANG.t('лет')}</span></div>
                    <div class="ce-item"><span class="ce-lbl">${LANG.t('Зарплата')}</span><span class="ce-val">${s.salary ? formatSalary(s.salary) : '—'}</span></div>
                    <div class="ce-item"><span class="ce-lbl">${LANG.t('Очки')}</span><span class="ce-val">${pts}</span></div>
                </div>
            </div>
        `;
    });

    const legendHTML = `
        <div class="career-region-legend">
            <span class="crl-item"><span class="crl-dot crl-ru"></span>${LANG.t('Россия')}</span>
            <span class="crl-item"><span class="crl-dot crl-by"></span>${LANG.t('Беларусь')}</span>
            <span class="crl-item"><span class="crl-dot crl-na"></span>${LANG.t('Северная Америка')}</span>
            <span class="crl-item"><span class="crl-dot crl-eu"></span>${LANG.t('Европа')}</span>
        </div>
    `;

    // ===== Трофейная комната =====
    const trophyArr = p.trophies || [];
    const awardArr = p.awards || [];
    let trophyHTML = '';
    if (trophyArr.length > 0 || awardArr.length > 0) {
        const trophyByYear = {};
        trophyArr.forEach(t => { const key = t.name || LANG.t('Трофей'); trophyByYear[key] = (trophyByYear[key] || 0) + 1; });
        const trophyChips = Object.keys(trophyByYear).map(name =>
            `<div class="hr-trophy-chip">🏆 ${name}${trophyByYear[name] > 1 ? ` <b>×${trophyByYear[name]}</b>` : ''}</div>`).join('');
        const awardChips = awardArr.map(a => `<div class="hr-award-chip">🥇 ${a.name || LANG.t('Награда')}</div>`).join('');
        trophyHTML = `
            <div class="hall-of-fame">
                <div class="hof-title">🏅 ${LANG.t('Зал славы игрока')}</div>
                <div class="hof-grid">${trophyChips}${awardChips}</div>
            </div>
        `;
    }

    // ===== Таймлайн карьеры (вертикальная линия) =====
    const timelineHTML = (() => {
        const asc = [...hist].sort((a, b) => b.season - a.season); // свежие сверху
        const items = asc.map((s, i) => {
            const pts = (s.goals || 0) + (s.assists || 0);
            const logo = s.club ? getTeamLogoHTML(s.club, s.league) : '<div class="tl-logo-empty">🕊️</div>';
            const avgR = s.avgRating || '—';
            const pm = s.plusMinus || 0;
            const pmStr = pm > 0 ? '+' + pm : pm;
            const isTop = s.season === bestSeason.season;
            // Переход
            const idxAsc = [...hist].sort((a, b) => a.season - b.season).findIndex(x => x.season === s.season);
            const prev = idxAsc > 0 ? [...hist].sort((a, b) => a.season - b.season)[idxAsc - 1] : null;
            let transferMark = '';
            if (prev && prev.club && s.club && prev.club !== s.club) {
                const oldP = clubData[prev.league + "_" + prev.club]?.prestige || 50;
                const newP = clubData[s.league + "_" + s.club]?.prestige || 50;
                if (newP > oldP + 3) transferMark = '<span class="tl-transfer up">⬆</span>';
                else if (newP < oldP - 3) transferMark = '<span class="tl-transfer down">⬇</span>';
                else transferMark = '<span class="tl-transfer flat">➜</span>';
            }
            return `
            <div class="tl-item ${isTop ? 'tl-best' : ''} ${s._live ? 'tl-live' : ''}">
                <div class="tl-marker"><div class="tl-logo">${logo}</div></div>
                <div class="tl-card">
                    <div class="tl-head">
                        <span class="tl-club">${transferMark}${s.club || LANG.t('Без клуба')}</span>
                        <span class="tl-season">${s.season} • ${s.age || '—'} ${LANG.t('л.')}</span>
                    </div>
                    <div class="tl-league">${s.league ? getLeagueName(s.league) : '—'} • ${formatSalary(s.salary || 0)}</div>
                    <div class="tl-stats">
                        <span class="tl-stat"><b>${s.gp || 0}</b> ${LANG.t('И')}</span>
                        <span class="tl-stat"><b>${s.goals || 0}</b> ${LANG.t('Г')}</span>
                        <span class="tl-stat"><b>${s.assists || 0}</b> ${LANG.t('П')}</span>
                        <span class="tl-stat"><b>${pts}</b> ${LANG.t('Очк.')}</span>
                        <span class="tl-stat"><b class="${pm > 0 ? 'pm-up' : pm < 0 ? 'pm-down' : ''}">${pmStr}</b> +/−</span>
                        <span class="tl-stat tl-rating"><b>${s.rating || '—'}</b> ${LANG.t('Рейт')}</span>
                        <span class="tl-stat"><b>${avgR}</b> ${LANG.t('Оц')}</span>
                    </div>
                    ${s._live ? `<div class="tl-live-badge"><span class="tl-live-dot"></span> ${LANG.t('В процессе...')}</div>` : ''}
                    ${isTop ? `<div class="tl-best-badge">🌟 ${LANG.t('Лучший сезон')}</div>` : ''}
                </div>
            </div>`;
        }).join('');
        return `<div class="career-timeline"><div class="tl-line"></div>${items}</div>`;
    })();

    c.innerHTML = `
        ${legendHTML}
        <div class="career-summary">
            <div class="cs-title">📜 ${LANG.t('Карьера игрока')}</div>
            <div class="cs-stats">
                <div class="cs-stat"><span class="v">${hist.length}</span><span class="l">${LANG.t('Сезонов')}</span></div>
                <div class="cs-stat"><span class="v">${totalGP}</span><span class="l">${LANG.t('Игр')}</span></div>
                <div class="cs-stat"><span class="v">${totalPts}</span><span class="l">${LANG.t('Очков')}</span></div>
            </div>
        </div>

        ${trophyHTML}

        ${graphHTML}

        <div class="career-peak">
            <div class="cp-block">
                <div class="cp-lbl">🌟 ${LANG.t('Лучший сезон')}</div>
                <div class="cp-val">${bestSeason.season} • ${bestScore} ${LANG.t('очк.')}</div>
            </div>
            <div class="cp-block">
                <div class="cp-lbl">📈 ${LANG.t('Пик рейтинга')}</div>
                <div class="cp-val">${peakRating}</div>
            </div>
        </div>

        <div class="career-section-title">🗓️ ${LANG.t('Таймлайн карьеры')}</div>
        ${timelineHTML}
    `;
}


function buildCareerGraph(hist) {
    if (hist.length < 2) return '';
    const data = [...hist].sort((a, b) => a.season - b.season);
    const W = 300, H = 80;
    const ratings = data.map(s => s.rating || 0);
    const min = Math.min(...ratings), max = Math.max(...ratings);
    const range = max - min || 1;
    const pts = data.map((s, i) => {
        const x = (i / (data.length - 1)) * W;
        const y = H - (((s.rating || 0) - min) / range) * (H - 12) - 6;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    // Точки с тултипами (год + рейтинг) — большой прозрачный хит-бокс над каждой точкой
    const dots = data.map((s, i) => {
        const x = (i / (data.length - 1)) * W;
        const y = H - (((s.rating || 0) - min) / range) * (H - 12) - 6;
        const label = `${s.season} • ${LANG.t('Рейтинг')} ${s.rating || '—'}`;
        const cls = (s.rating || 0) >= 80 ? 'cg-dot high' : (s.rating || 0) >= 65 ? 'cg-dot mid' : 'cg-dot low';
        return `<g class="cg-dot-group">
            <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.8" class="${cls}"/>
            <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11" fill="transparent" class="cg-dot-hit">
                <title>${label}</title>
            </circle>
        </g>`;
    }).join('');
    const up = data[data.length - 1].rating >= data[0].rating;
    const color = up ? '#00ff88' : '#ffcc00';

    return `
        <div class="career-graph">
            <div class="cg-title">📈 ${LANG.t('Рейтинг по сезонам')}</div>
            <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="cg-svg">
                <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
                ${dots}
            </svg>
            <div class="cg-axis">
                <span>${data[0].season}</span>
                <span>${data[data.length - 1].season}</span>
            </div>
        </div>
    `;
}

function signPlayerFromScreen(p) {
    const slots = getSlots();
    if (myRoster.length >= slots) {
        openSimpleInfoModal(
            '⚠️ ' + LANG.t('Нет слотов!'),
            LANG.t('Вы должны улучшить свой Офис для большего количества игроков или отпустить некоторых (Максимум {n})').replace('{n}', slots)
        );
        return;
    }
    // Свободный агент — всегда согласен
    p.agentId = -1;
    myRoster.push(p);
    incrementClientsSigned();
    // НЕ удаляем из players — игрок остаётся в составе своего клуба и в мире игры
    addNews(`✍️ Вы подписали ${p.name}!`, "positive");
    addXP(p.rating * 2);
    closePlayerScreen();
    updateAllDisplays();
    saveGame();
    renderClientsScreen();
}

// Простая информационная модалка в стиле игры (использует event-modal)
function openSimpleInfoModal(title, text) {
    eventTitle.textContent = title;
    eventText.textContent = text;
    eventDetails.innerHTML = '';
    eventActions.innerHTML = '';
    const okBtn = document.createElement('button');
    okBtn.className = 'btn-primary';
    okBtn.textContent = 'OK';
    okBtn.addEventListener('click', closeEventModal);
    eventActions.appendChild(okBtn);
    eventModal.style.display = 'flex';
}

function closePlayerScreen() {
    currentPlayerScreen = null;
    document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');

    try {
        // 1. Возврат в карточку клуба (теперь — публичный хаб)
        if (playerReturnContext && playerReturnContext.type === 'club') {
            const ctx = playerReturnContext;
            playerReturnContext = null;
            openPublicClubHub(ctx.clubName, ctx.league, ctx.parentScreen);
            return;
        }

        // 2. Возврат на экран сборных
        if (playerReturnContext && playerReturnContext.type === 'national') {
            playerReturnContext = null;
            showNationalTournamentScreen();
            return;
        }

        // 3. Клиенты/поиск
        playerReturnContext = null;
        if (currentPlayerSource === 'search' || currentPlayerSource === 'my') {
            const cs = document.getElementById('clients-screen');
            if (cs) cs.style.display = 'flex';
            showBottomNav();
            renderClientsScreen();
        } else {
            const os = document.getElementById('office-screen');
            if (os) os.style.display = 'flex';
            showBottomNav();
        }
    } catch (err) {
        console.error('closePlayerScreen error:', err);
        // Аварийный выход — возвращаемся в офис
        document.querySelectorAll('.mobile-screen, .modal-overlay').forEach(s => s.style.display = 'none');
        const os = document.getElementById('office-screen');
        if (os) os.style.display = 'flex';
        showBottomNav();
    }
}

document.querySelectorAll('.player-tab').forEach(t => t.addEventListener('click', function () {
    playerTab = this.getAttribute('data-ptab');
    renderPlayerScreen();
}));
document.getElementById('player-back')?.addEventListener('click', closePlayerScreen);

// ============ 19. ЛИГИ И ТАБЛИЦЫ ============
// ============ ЛИДЕРБОРД: ЛУЧШИЕ ИГРОКИ МИРА ============
let leaderboardTab = 'world'; // world | лига (ключ лиги)

function getLeaderboardData(lk) {
    // Все игроки мира (или лиги), сортировка: рейтинг ↓, затем очки сезона ↓
    let pool = players.filter(p => p.rating > 0);
    if (lk && lk !== 'world') pool = pool.filter(p => p.league === lk);
    const pts = p => (p.stats ? (p.stats.goals || 0) + (p.stats.assists || 0) : 0);
    return pool.sort((a, b) => b.rating - a.rating || pts(b) - pts(a));
}

function openLeaderboard() {
    document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
    const s = document.getElementById('leaderboard-screen');
    if (s) s.style.display = 'flex';
    hideBottomNav();
    renderLeaderboard();
}

function renderLeaderboard() {
    const c = document.getElementById('leaderboard-content');
    if (!c) return;
    c.innerHTML = '';

    // Вкладки: Топ-50 в мире + по лигам
    const tabs = document.getElementById('leaderboard-tabs');
    tabs.innerHTML = `<button class="clients-tab ${leaderboardTab === 'world' ? 'active' : ''}" data-lb="world"><span class="tab-icon">🌍</span><span>${LANG.t('Топ-50 в мире')}</span></button>` +
        Object.keys(LEAGUE_DATA).map(lk => `<button class="clients-tab ${leaderboardTab === lk ? 'active' : ''}" data-lb="${lk}"><span class="tab-icon">${LEAGUE_DATA[lk].country.split(' ')[0]}</span><span>${getLeagueName(lk)}</span></button>`).join('');
    tabs.querySelectorAll('[data-lb]').forEach(b => {
        b.addEventListener('click', () => { leaderboardTab = b.getAttribute('data-lb'); renderLeaderboard(); });
    });

    const data = getLeaderboardData(leaderboardTab).slice(0, 50);
    if (data.length === 0) {
        c.innerHTML = `<div class="empty-state"><div class="empty-icon">🏅</div><div class="empty-title">${LANG.t('Нет данных')}</div></div>`;
        return;
    }

    const frag = document.createDocumentFragment();
    const medalFor = (i) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
    const pts = p => (p.stats ? (p.stats.goals || 0) + (p.stats.assists || 0) : 0);

    data.forEach((p, i) => {
        const row = document.createElement('div');
        row.className = 'lb-row' + (i < 3 ? ` lb-top lb-${i + 1}` : '') + (myRoster.some(x => x.name === p.name) ? ' lb-mine' : '');
        const ptsStr = pts(p) > 0 ? `${pts(p)} ${LANG.t('очк.')}` : `${(p.stats ? p.stats.gp || 0 : 0)} ${LANG.t('И')}`;
        row.innerHTML = `
            <div class="lb-place">${medalFor(i)}</div>
            <div class="lb-avatar">${getPlayerAvatarSVG(p)}</div>
            <div class="lb-info">
                <div class="lb-name">${p.name} <span class="lb-pos">${p.position}</span>${myRoster.some(x => x.name === p.name) ? ` <span class="lb-mine-badge">⭐</span>` : ''}</div>
                <div class="lb-club">${p.club ? `${getTeamLogoHTML(p.club, p.league)} ${p.club}` : '🕊️ ' + LANG.t('Свободный агент')}</div>
            </div>
            <div class="lb-right">
                <div class="lb-rating">${p.rating}</div>
                <div class="lb-pts">${ptsStr}</div>
            </div>
        `;
        row.addEventListener('click', () => openPlayerScreen(p, 'search'));
        frag.appendChild(row);
    });
    c.appendChild(frag);
}

function renderLeaguesScreen() {
    const c = document.getElementById('leagues-content');
    if (!c) return;
    c.innerHTML = '';
    hidePagination();

    // Кнопка-баннер "Лучшие игроки мира"
    const lbBtn = document.createElement('div');
    lbBtn.className = 'league-card lb-banner';
    lbBtn.innerHTML = `<span class="league-flag">🏅</span><div class="league-info"><span class="league-name">${LANG.t('Лучшие игроки мира')}</span><span class="lb-sub">${LANG.t('Топ-50 и рейтинги по лигам')}</span></div><span class="league-arrow">→</span>`;
    lbBtn.addEventListener('click', openLeaderboard);
    c.appendChild(lbBtn);

    const groups = {};
    for (const [k, d] of Object.entries(LEAGUE_DATA)) {
        if (!groups[d.group]) groups[d.group] = [];
        groups[d.group].push({key: k, ...d});
    }
    ['Северная Америка', 'Россия', 'Беларусь', 'Европа'].forEach(gn => {
        if (!groups[gn]) return;
        const gd = document.createElement('div');
        gd.className = 'league-group';
        gd.innerHTML = `<div class="league-group-title">${LANG.t(gn)}</div>`;
        groups[gn].forEach(lg => {
            const card = document.createElement('div');
            card.className = 'league-card';
card.innerHTML = `<span class="league-flag">${lg.country.split(' ')[0]}</span><div class="league-info"><span class="league-name">${getLeagueName(lg.key)}</span></div><span class="league-count">${getAllClubs(lg.key).length}</span><span class="league-arrow">→</span>`;
            card.addEventListener('click', () => openLeagueStandings(lg.key));
            gd.appendChild(card);
        });
        c.appendChild(gd);
    });
}

function openLeagueStandings(lk) {
    currentStandingsLeague = lk;
    standingsTab = 'table';
    hidePagination();
    document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
    const s = document.getElementById('standings-screen');
    if (s) s.style.display = 'flex';
    showBottomNav();
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const l = document.querySelector('.nav-item[data-nav="leagues"]');
    if (l) l.classList.add('active');
    renderStandingsScreen(lk);
}

document.querySelectorAll('.league-tab').forEach(t => t.addEventListener('click', function () {
    standingsTab = this.getAttribute('data-ltab');
    if (currentStandingsLeague) renderStandingsScreen(currentStandingsLeague);
}));

// ============ ИНФО О КЛУБЕ (публичный просмотр) ============
function openClubInfoModal(clubName, lk, parentScreenId) {
    const key = lk + "_" + clubName;
    const data = clubData[key];
    if (!data) {
        uiAlert(LANG.t('Клуб не найден'));
        document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
        const os = document.getElementById('office-screen');
        if (os) os.style.display = 'flex';
        showBottomNav();
        return;
    }

    // Запоминаем, поверх какого экрана открыт клуб
    if (parentScreenId) {
        window._clubModalParent = parentScreenId;
    } else {
        const visibleScreen = Array.from(document.querySelectorAll('.mobile-screen')).find(s => s.style.display !== 'none');
        window._clubModalParent = visibleScreen ? visibleScreen.id : (window._clubModalParent || 'office-screen');
    }

    const modal = document.getElementById('club-info-modal');
    const title = document.getElementById('club-info-title');
    const body = document.getElementById('club-info-body');
    if (!modal || !body) return;

    title.textContent = clubName;

    const teamPlayers = players.filter(p => p.club === clubName && p.league === lk);
    const avgRating = teamPlayers.length > 0
        ? Math.round(teamPlayers.reduce((s, p) => s + p.rating, 0) / teamPlayers.length)
        : 0;
    const avgAge = teamPlayers.length > 0
        ? (teamPlayers.reduce((s, p) => s + p.age, 0) / teamPlayers.length).toFixed(1)
        : '—';

    const standingsArr = standings[lk] || [];
    const sorted = [...standingsArr].sort(sortStandingsFn);
    const placeIdx = sorted.findIndex(t => t.club === clubName);
    const placeText = placeIdx >= 0 ? `${placeIdx + 1}-е из ${sorted.length}` : '—';
    const placeClass = placeIdx >= 0 && placeIdx < (LEAGUE_DATA[lk].playoffSpots || 4) ? 'good'
                     : placeIdx >= 0 && placeIdx < sorted.length / 2 ? 'mid' : 'bad';

    const trophies = getClubTrophiesList(data);

    const goalies  = teamPlayers.filter(p => p.position === 'G').sort((a,b) => b.rating - a.rating);
    const defenders = teamPlayers.filter(p => p.position === 'D').sort((a,b) => b.rating - a.rating);
    const forwards  = teamPlayers.filter(p => ['C','LW','RW'].includes(p.position)).sort((a,b) => b.rating - a.rating);

    const rosterRowHTML = (p) => {
        const rc = p.rating >= 80 ? 'high' : p.rating >= 65 ? 'mid' : 'low';
        const posIcon = p.position === 'G' ? '🥅' : p.position === 'D' ? '🛡' : '⚡';
        const isMine = (p.agentId === -1);
        return `
            <div class="roster-row${isMine ? ' my-client' : ''}" data-club-player="${p.name}" style="cursor:pointer;">
                <div class="rr-avatar">${getPlayerAvatarSVG(p)}</div>
                <div class="rr-info">
                    <div class="rr-name-line">
                        <span class="rr-pos-icon">${posIcon}</span>
                        <span class="rr-name">${p.name}</span>
                        <span class="rr-pos">${p.position}</span>
                    </div>
                    <div class="rr-meta">
                        <span>${p.age} лет</span>
                        <span>${formatSalary(p.salary)}</span>
                    </div>
                </div>
                <div class="rr-right">
                    <div class="rr-rating ${rc}">${p.rating}</div>
                </div>
            </div>
        `;
    };

    body.innerHTML = `
        <div class="ov-header">
            <div class="ov-club-line">
                <div class="ov-club-logo">${getTeamLogoHTML(clubName, lk)}</div>
                <div class="ov-club-info">
                    <div class="ov-club-name">${clubName}</div>
                    <div class="ov-club-meta">${getLeagueName(lk)} • ${LANG.t('Престиж')} ${data.prestige}</div>
                </div>
            </div>
            <div class="ov-stats-grid">
                <div class="ov-stat">
                    <span class="ov-stat-lbl">💰 ${LANG.t('Баланс')}</span>
                    <span class="ov-stat-val ${data.budget < 0 ? 'negative' : ''}">${formatMoney(data.budget)}</span>
                </div>
                <div class="ov-stat">
                    <span class="ov-stat-lbl">⭐ ${LANG.t('Ср. рейтинг')}</span>
                    <span class="ov-stat-val">${avgRating}</span>
                </div>
                <div class="ov-stat">
                    <span class="ov-stat-lbl">📊 ${LANG.t('Ср. возраст')}</span>
                    <span class="ov-stat-val">${avgAge}</span>
                </div>
            </div>
        </div>

        <div class="ov-place-block">
            <div class="ov-place-icon">🏒</div>
            <div class="ov-place-info">
                <div class="ov-place-label">Текущее место в лиге</div>
                <div class="ov-place-value ${placeClass}">${placeText}</div>
            </div>
        </div>

        ${trophies.length > 0 ? `
        <div class="ov-trophies">
            <div class="ov-section-title">🏆 Трофеи</div>
            <div class="ov-trophies-grid">
                ${trophies.map(t => `<div class="ov-trophy"><span class="ov-trophy-icon">${t.icon}</span><span class="ov-trophy-name">${t.name}</span><span class="ov-trophy-count">×${t.count}</span></div>`).join('')}
            </div>
        </div>` : ''}

        <div class="ov-section-title" style="margin-top:16px;">👥 Состав (${teamPlayers.length})</div>

        ${goalies.length > 0 ? `
            <div class="roster-group">
                <div class="roster-group-title">🥅 ВРАТАРИ</div>
                ${goalies.map(rosterRowHTML).join('')}
            </div>
        ` : ''}

        ${defenders.length > 0 ? `
            <div class="roster-group">
                <div class="roster-group-title">🛡 ЗАЩИТНИКИ</div>
                ${defenders.map(rosterRowHTML).join('')}
            </div>
        ` : ''}

        ${forwards.length > 0 ? `
            <div class="roster-group">
                <div class="roster-group-title">⚡ НАПАДАЮЩИЕ</div>
                ${forwards.map(rosterRowHTML).join('')}
            </div>
        ` : ''}
    `;

    // Клик по игроку — открываем его карточку
    body.querySelectorAll('.roster-row[data-club-player]').forEach(row => {
        row.addEventListener('click', () => {
            const pname = row.getAttribute('data-club-player');
            const player = players.find(x => x.name === pname);
            if (!player) return;
            playerReturnContext = {
                type: 'club',
                clubName: clubName,
                league: lk,
                parentScreen: window._clubModalParent || 'office-screen'
            };
            document.getElementById('club-info-modal').style.display = 'none';
            openPlayerScreen(player, 'public');
        });
    });

    modal.style.display = 'flex';
}
function closeClubInfoModal() {
    document.getElementById('club-info-modal').style.display = 'none';
    const parent = window._clubModalParent;
    window._clubModalParent = null;
    if (parent) {
        document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
        const ps = document.getElementById(parent);
        if (ps) {
            ps.style.display = 'flex';
            showBottomNav();
            return;
        }
    }
    // Fallback: если ничего не нашли — офис
    const anyVisible = Array.from(document.querySelectorAll('.mobile-screen')).some(s => s.style.display !== 'none');
    if (!anyVisible) {
        const os = document.getElementById('office-screen');
        if (os) os.style.display = 'flex';
        showBottomNav();
    }
}

document.getElementById('club-info-close')?.addEventListener('click', closeClubInfoModal);
document.getElementById('club-info-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'club-info-modal') closeClubInfoModal();
});

// ============ ПУБЛИЧНЫЙ ХАБ КЛУБА (полноэкранный, с вкладками) ============
let pchTab = 'overview';
let pchClub = null;      // { club, league }
let pchReturnScreen = 'standings-screen'; // экран, с которого пришли

// Генератор названий стадионов (детерминирован по клубу, чтобы название не «прыгало»)
function getStadiumName(clubName) {
    const patterns = [
        `Арена ${clubName}`,
        `Ледовый Дворец ${clubName}`,
        `Стадион ${clubName}`,
        `${clubName} Arena`,
        `Sport Park ${clubName}`
    ];
    const seed = hashString(clubName);
    return patterns[seed % patterns.length];
}

function openPublicClubHub(clubName, lk, fromScreenId) {
    const key = lk + "_" + clubName;
    const data = clubData[key];
    if (!data) { uiAlert(LANG.t('Клуб не найден')); return; }
    pchClub = { club: clubName, league: lk };
    pchTab = 'overview';
    // Запоминаем экран возврата
    if (fromScreenId) {
        pchReturnScreen = fromScreenId;
    } else {
        const visible = Array.from(document.querySelectorAll('.mobile-screen')).find(s => s.style.display !== 'none');
        pchReturnScreen = visible ? visible.id : 'office-screen';
    }
    hidePagination();
    renderPublicClubHub();
}

function renderPublicClubHub() {
    if (!pchClub) return;
    const { club: clubName, league: lk } = pchClub;
    const key = lk + "_" + clubName;
    const data = clubData[key];
    if (!data) { uiAlert(LANG.t('Клуб не найден')); return; }

    document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
    const s = document.getElementById('public-club-hub-screen');
    if (s) s.style.display = 'flex';
    showBottomNav();

    // Шапка
    const title = document.getElementById('pch-title');
    const icon = document.getElementById('pch-icon');
    if (title) title.textContent = clubName;
    if (icon) icon.textContent = '🏒';
    // Кнопка «Управлять» для президента
    const manageBtn = document.getElementById('pch-manage-btn');
    if (manageBtn) {
        const isMyClub = presidentClubKey === key;
        manageBtn.style.display = isMyClub ? 'flex' : 'none';
    }

    // Вкладки
    document.querySelectorAll('#pch-tabs .clients-tab').forEach(tb => {
        if (tb.getAttribute('data-ptab2') === pchTab) tb.classList.add('active');
        else tb.classList.remove('active');
    });

    const c = document.getElementById('pch-content');
    if (!c) return;
    c.innerHTML = '';

    if (pchTab === 'overview') renderPCHOverview(c, data, lk);
    else if (pchTab === 'roster') renderPCHRoster(c, clubName, lk);
    else if (pchTab === 'schedule') renderPCHSchedule(c, clubName, lk);
    else if (pchTab === 'history') renderPCHHistory(c, data, clubName, lk);
    else if (pchTab === 'stocks') renderPCHStocks(c, data, clubName, lk);
}

function renderPCHOverview(c, data, lk) {
    const clubName = data.club;
    const teamPlayers = players.filter(p => p.club === clubName && p.league === lk);
    const avgRating = teamPlayers.length > 0 ? Math.round(teamPlayers.reduce((s, p) => s + p.rating, 0) / teamPlayers.length) : 0;

    // Место в лиге
    const standingsArr = standings[lk] || [];
    const sorted = [...standingsArr].sort(sortStandingsFn);
    const placeIdx = sorted.findIndex(t => t.club === clubName);
    const placeText = placeIdx >= 0 ? `${placeIdx + 1} / ${sorted.length}` : '—';

    // Стадион
    const stadiumName = getStadiumName(clubName);
    const capacity = getStadiumCapacity(data.upgrades?.stadium || 1);

    c.innerHTML = `
        <div class="pch-hero">
            <div class="pch-hero-logo">${getTeamLogoHTML(clubName, lk)}</div>
            <div class="pch-hero-info">
                <div class="pch-hero-name">${clubName}</div>
                <div class="pch-hero-meta">${LEAGUE_DATA[lk]?.country.split(' ')[0] || ''} ${getLeagueName(lk)} • ${LANG.t('осн.')} ${data.founded || '—'}</div>
                <div class="pch-hero-form">${LANG.t('Форма')}: ${getClubFormHTML(clubName, lk)}</div>
            </div>
        </div>

        <div class="pch-stats-grid">
            <div class="pch-stat"><span class="pch-lbl">⭐ ${LANG.t('Престиж')}</span><span class="pch-val">${data.prestige}</span></div>
            <div class="pch-stat"><span class="pch-lbl">📊 ${LANG.t('Ср. рейтинг')}</span><span class="pch-val">${avgRating}</span></div>
            <div class="pch-stat"><span class="pch-lbl">🏆 ${LANG.t('Место')}</span><span class="pch-val">${placeText}</span></div>
        </div>

        <div class="pch-stadium">
            <div class="pch-stadium-icon">🏟️</div>
            <div class="pch-stadium-info">
                <div class="pch-stadium-name">${stadiumName}</div>
                <div class="pch-stadium-cap">👥 ${capacity.toLocaleString()} ${LANG.t('мест')}</div>
            </div>
        </div>
    `;
}

function renderPCHRoster(c, clubName, lk) {
    const teamPlayers = players.filter(p => p.club === clubName && p.league === lk);
    const goalies = teamPlayers.filter(p => p.position === 'G').sort((a, b) => b.rating - a.rating);
    const defenders = teamPlayers.filter(p => p.position === 'D').sort((a, b) => b.rating - a.rating);
    const forwards = teamPlayers.filter(p => ['C', 'LW', 'RW'].includes(p.position)).sort((a, b) => b.rating - a.rating);

    const rowHTML = (p) => {
        const rc = p.rating >= 80 ? 'high' : p.rating >= 65 ? 'mid' : 'low';
        const posIcon = p.position === 'G' ? '🥅' : p.position === 'D' ? '🛡' : '⚡';
        const isMine = p.agentId === -1;
        return `
            <div class="roster-row${isMine ? ' my-client' : ''}" data-pch-player="${p.name}" style="cursor:pointer;">
                <div class="rr-avatar">${getPlayerAvatarSVG(p)}</div>
                <div class="rr-info">
                    <div class="rr-name-line">
                        <span class="rr-pos-icon">${posIcon}</span>
                        <span class="rr-name">${p.name}</span>
                        <span class="rr-pos">${p.position}</span>
                    </div>
                    <div class="rr-meta"><span>${p.age} ${LANG.t('лет')}</span><span>${formatSalary(p.salary)}</span></div>
                </div>
                <div class="rr-right"><div class="rr-rating ${rc}">${p.rating}</div></div>
            </div>`;
    };

    c.innerHTML = `
        <div class="pch-section-title">👥 ${LANG.t('Состав')} (${teamPlayers.length})</div>
        ${goalies.length ? `<div class="roster-group"><div class="roster-group-title">🥅 ${LANG.t('ВРАТАРИ').toUpperCase()}</div>${goalies.map(rowHTML).join('')}</div>` : ''}
        ${defenders.length ? `<div class="roster-group"><div class="roster-group-title">🛡 ${LANG.t('ЗАЩИТНИКИ').toUpperCase()}</div>${defenders.map(rowHTML).join('')}</div>` : ''}
        ${forwards.length ? `<div class="roster-group"><div class="roster-group-title">⚡ ${LANG.t('НАПАДАЮЩИЕ').toUpperCase()}</div>${forwards.map(rowHTML).join('')}</div>` : ''}
        ${teamPlayers.length === 0 ? `<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">${LANG.t('Состав пуст')}</div></div>` : ''}
    `;

    c.querySelectorAll('[data-pch-player]').forEach(row => {
        row.addEventListener('click', () => {
            const player = players.find(x => x.name === row.getAttribute('data-pch-player'));
            if (!player) return;
            playerReturnContext = { type: 'pch', clubName, league: lk };
            openPlayerScreen(player, 'public');
        });
    });
}

function renderPCHSchedule(c, clubName, lk) {
    const schedule = (seasonSchedule[lk] || []).filter(m => m.home === clubName || m.away === clubName);
    const played = schedule.filter(m => m.result).slice(-5).reverse(); // последние 5
    const upcoming = schedule.filter(m => !m.result).slice(0, 5);      // ближайшие 5

    const rowHTML = (m, isResult) => {
        const isHome = m.home === clubName;
        const opp = isHome ? m.away : m.home;
        let scoreHTML = '', cls = '';
        if (isResult && m.result) {
            const my = isHome ? m.result.homeScore : m.result.awayScore;
            const oppG = isHome ? m.result.awayScore : m.result.homeScore;
            const win = my > oppG;
            const ot = m.result.isOT ? ' ОТ' : m.result.isSO ? ' Б' : '';
            cls = win ? 'pch-mr-win' : 'pch-mr-loss';
            scoreHTML = `<span class="pch-mr-score">${m.result.homeScore}:${m.result.awayScore}${ot}</span>`;
        } else {
            scoreHTML = `<span class="pch-mr-week">${LANG.t('Неделя')} ${m.week}</span>`;
        }
        return `
            <div class="pch-match-row ${cls}">
                <div class="pch-mr-logo">${getTeamLogoHTML(opp, lk)}</div>
                <div class="pch-mr-info">
                    <span class="pch-mr-opp">${isHome ? '' : '@ '}${opp}</span>
                    <span class="pch-mr-meta">${isHome ? LANG.t('дома') : LANG.t('в гостях')} • ${LANG.t('Неделя')} ${m.week}</span>
                </div>
                ${scoreHTML}
            </div>`;
    };

    c.innerHTML = `
        <div class="pch-section-title">📋 ${LANG.t('Результаты')}</div>
        ${played.length ? played.map(m => rowHTML(m, true)).join('') : `<div class="pch-empty-line">${LANG.t('Матчей еще не было')}</div>`}
        <div class="pch-section-title" style="margin-top:14px;">📅 ${LANG.t('Предстоящие')}</div>
        ${upcoming.length ? upcoming.map(m => rowHTML(m, false)).join('') : `<div class="pch-empty-line">${LANG.t('Нет предстоящих матчей')}</div>`}
    `;
}

function renderPCHHistory(c, data, clubName, lk) {
    // Трофеи из championsHistory
    const trophies = getClubTrophiesList(data);
    // Легенды: из данных клуба + лучшие бомбардиры в истории клуба
    const legends = data.legends || [];
    const allTime = players
        .filter(p => (p.seasonHistory || []).some(h => h.club === clubName) || (p.club === clubName && p.league === lk))
        .map(p => {
            let g = 0, a = 0, seasons = 0;
            (p.seasonHistory || []).forEach(h => {
                if (h.club === clubName) { g += h.goals || 0; a += h.assists || 0; seasons++; }
            });
            if (p.club === clubName && p.league === lk) { g += p.stats?.goals || 0; a += p.stats?.assists || 0; }
            return { p, g: g + (p.stats && p.club === clubName ? 0 : 0), a, total: g + a, seasons };
        })
        .filter(x => x.total > 0)
        .sort((x, y) => y.total - x.total)
        .slice(0, 3);

    c.innerHTML = `
        ${trophies.length ? `
        <div class="pch-section-title">🏆 ${LANG.t('Трофеи')}</div>
        <div class="pch-trophies">${trophies.map(t => `<div class="pch-trophy"><span class="pch-trophy-icon">${t.icon}</span><span class="pch-trophy-name">${t.name}</span><span class="pch-trophy-count">×${t.count}</span></div>`).join('')}</div>` : ''}

        <div class="pch-section-title" style="margin-top:14px;">👑 ${LANG.t('Легенды клуба')}</div>
        ${legends.length ? `<div class="pch-legends-list">${legends.map(l => `<div class="pch-legend-row">⭐ ${l}</div>`).join('')}</div>` : ''}
        ${allTime.length ? `
            <div class="pch-legend-sub">${LANG.t('Топ-3 бомбардиры в истории клуба')}</div>
            ${allTime.map((x, i) => `
                <div class="pch-legend-row pch-legend-stat">
                    <span class="pch-leg-medal">${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                    <span class="pch-leg-name">${x.p.name}</span>
                    <span class="pch-leg-stats">${x.total} ${LANG.t('очк.')} (${x.g || 0}+${x.a})</span>
                </div>`).join('')}
        ` : ''}
        ${!legends.length && !allTime.length ? `<div class="pch-empty-line">${LANG.t('Легенды пока не записаны')}</div>` : ''}
    `;
}

function renderPCHStocks(c, data, clubName, lk) {
    const spark = makeSparkline((data.stockHistory || []).slice(-12));
    const key = getPortfolioKey(clubName, lk);
    const owned = myPortfolio[key]?.shares || 0;

    c.innerHTML = `
        <div class="pch-section-title">📈 ${LANG.t('Акции клуба')}</div>
        <div class="pch-stock-price">${formatMoney(data.stockPrice)} <span class="pch-stock-unit">/ 1%</span></div>
        ${spark || `<div class="pch-empty-line">${LANG.t('История котировок пока пуста — график появится через пару недель')}</div>`}
        <div class="pch-stock-owned">${LANG.t('В портфеле')}: <b>${owned.toFixed(1)}%</b></div>
        <button class="btn-primary pch-stock-btn" id="pch-trade-stocks">💱 ${LANG.t('Купить/Продать акции')}</button>
    `;
    c.querySelector('#pch-trade-stocks')?.addEventListener('click', () => {
        openStockTradeModal(clubName, lk);
    });
}

// ===== Навигация хаба =====
document.querySelectorAll('#pch-tabs .clients-tab').forEach(tb => {
    tb.addEventListener('click', function () {
        pchTab = this.getAttribute('data-ptab2');
        renderPublicClubHub();
    });
});
document.getElementById('pch-back')?.addEventListener('click', () => {
    document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
    // Не возвращаемся в сам хаб (например, после визита в карточку игрока)
    let target = pchReturnScreen;
    if (!target || target === 'public-club-hub-screen') {
        target = currentStandingsLeague ? 'standings-screen' : 'leagues-screen';
    }
    const back = document.getElementById(target);
    if (back) {
        back.style.display = 'flex';
        showBottomNav();
        // Перерисовываем экран, с которого пришли (данные могли измениться)
        if (target === 'standings-screen' && currentStandingsLeague) renderStandingsScreen(currentStandingsLeague);
        else if (target === 'leagues-screen') renderLeaguesScreen();
    } else {
        const os = document.getElementById('office-screen');
        if (os) os.style.display = 'flex';
        showBottomNav();
    }
});
document.getElementById('pch-manage-btn')?.addEventListener('click', () => {
    showInfrastructureScreen();
});

// Возврат из карточки игрока в хаб клуба
const _origClosePlayerScreen = closePlayerScreen;
closePlayerScreen = function() {
    if (playerReturnContext && playerReturnContext.type === 'pch') {
        const ctx = playerReturnContext;
        playerReturnContext = null;
        currentPlayerScreen = null;
        document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
        openPublicClubHub(ctx.clubName, ctx.league, 'public-club-hub-screen');
        return;
    }
    _origClosePlayerScreen();
};

// ============ ФОРМА КЛУБА (последние 5 матчей) ============
// Возвращает массив последних результатов клуба: 'W' | 'Wot' | 'L' | 'Lot'
function getClubForm(clubName, lk, limit) {
    const n = limit || 5;
    const res = [];
    const schedule = seasonSchedule[lk] || [];
    // Идём с конца недели к началу
    for (let w = 60; w >= 1 && res.length < n; w--) {
        const matches = schedule.filter(m => m.week === w && m.result && (m.home === clubName || m.away === clubName));
        if (matches.length === 0) continue;
        // Матчи внутри недели — в обратном порядке (последний сыгранный — первым)
        for (let i = matches.length - 1; i >= 0 && res.length < n; i--) {
            const m = matches[i];
            const r = m.result;
            const isHome = m.home === clubName;
            const myGoals = isHome ? r.homeScore : r.awayScore;
            const oppGoals = isHome ? r.awayScore : r.homeScore;
            if (myGoals > oppGoals) res.push(r.isOT || r.isSO ? 'Wot' : 'W');
            else res.push(r.isOT || r.isSO ? 'Lot' : 'L');
        }
    }
    return res;
}

function getClubFormHTML(clubName, lk) {
    const form = getClubForm(clubName, lk, 5);
    if (form.length === 0) return '<span class="form-empty">—</span>';
    return form.map(f => {
        if (f === 'W') return '<span class="form-dot form-win" title="Победа"></span>';
        if (f === 'Wot') return '<span class="form-dot form-win-ot" title="Победа ОТ/Б"></span>';
        if (f === 'Lot') return '<span class="form-dot form-loss-ot" title="Поражение ОТ/Б"></span>';
        return '<span class="form-dot form-loss" title="Поражение"></span>';
    }).join('');
}

function renderStandingsScreen(lk) {
    const c = document.getElementById('standings-content');
    const ti = document.getElementById('standings-title');
    const ic = document.getElementById('standings-icon');
    if (!c) return;
    const info = LEAGUE_DATA[lk];
    if (ti) ti.textContent = getLeagueName(lk);
    if (ic) ic.textContent = info?.country.split(' ')[0] || '📊';
    document.querySelectorAll('.league-tab').forEach(t => {
        if (t.getAttribute('data-ltab') === standingsTab) t.classList.add('active');
        else t.classList.remove('active');
    });
    c.innerHTML = '';
    const back = document.createElement('button');
    back.className = 'back-to-leagues';
    back.innerHTML = '← ' + LANG.t('К списку лиг');
    back.addEventListener('click', () => {
        hidePagination();
        document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
        const l = document.getElementById('leagues-screen');
        if (l) l.style.display = 'flex';
        showBottomNav();
        renderLeaguesScreen();
    });
    c.appendChild(back);

    if (standingsTab === 'playoffs') {
        renderLeaguePlayoffs(c, lk);
        return;
    }

    if (standingsTab === 'history') {
        renderLeagueHistory(c, lk);
        return;
    }
    
    if (standingsTab === 'schedule') {
        renderLeagueSchedule(c, lk);
        return;
    }

    const infoCard = document.createElement('div');
    infoCard.className = 'standings-info-card';
    infoCard.innerHTML = `<div class="si-country">${info.country}</div><div class="standings-legend" style="margin-top:8px;background:transparent;border:none;padding:0;"><div>${getAllClubs(lk).length} клубов • рейтинг ${info.min}-${info.max}</div></div>`;
    c.appendChild(infoCard);

    const all = standings[lk] || [];
    if (all.length === 0) { c.innerHTML += '<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-title">Таблица пуста</div></div>'; return; }

    info.divisions.forEach(div => {
        const teams = div.clubs.map(club => all.find(t => t.club === club)).filter(Boolean).sort(sortStandingsFn);
        if (teams.length === 0) return;
        const gd = document.createElement('div');
        gd.className = 'standings-group';
        gd.innerHTML = `<div class="standings-group-title">${LANG.t(div.name)}</div><div class="standings-row standings-header"><div class="st-place">#</div><div class="st-team">${LANG.t('Команда')}</div><div class="st-num">${LANG.t('И')}</div><div class="st-num">${LANG.t('В')}</div><div class="st-num">${LANG.t('ОТ')}</div><div class="st-num">${LANG.t('П')}</div><div class="st-num">${LANG.t('Форма')}</div><div class="st-num st-points">${LANG.t('О')}</div></div>`;
        const spots = info.playoffSpots || 4;
        teams.forEach((t, i) => {
            const row = document.createElement('div');
            row.className = 'standings-row' + (i < spots ? ' playoff' : '');
            row.style.cursor = 'pointer';
            const otT = (t.otW||0)+(t.sW||0)+(t.otL||0)+(t.sL||0);
            const formHTML = getClubFormHTML(t.club, lk);
            row.innerHTML = `<div class="st-place">${i+1}</div><div class="st-team"><div class="st-logo">${getTeamLogoHTML(t.club,lk)}</div><span class="st-name">${t.club}</span></div><div class="st-num">${t.gp}</div><div class="st-num">${t.w}</div><div class="st-num">${otT}</div><div class="st-num">${t.l}</div><div class="st-num st-form">${formHTML}</div><div class="st-num st-points">${t.points}</div>`;
            row.addEventListener('click', () => openPublicClubHub(t.club, lk));
            gd.appendChild(row);
        });
        c.appendChild(gd);
    });

    const spots = info.playoffSpots || 4;
    const legend = document.createElement('div');
    legend.className = 'standings-legend';
    legend.innerHTML = `<div class="legend-item"><span class="legend-dot playoff-dot"></span> ${LANG.t('Зона плей-офф — топ')}-${spots}</div>`;
    c.appendChild(legend);
}

// ============ 20. ПЛЕЙ-ОФФ ============
function getRoundName(round, totalRounds) {
    const remaining = totalRounds - round + 1;
    if (remaining === 1) return LANG.t('Финал');
    if (remaining === 2) return LANG.t('1/2 финала');
    if (remaining === 3) return LANG.t('1/4 финала');
    if (remaining === 4) return LANG.t('1/8 финала');
    return LANG.t('Раунд') + ' ' + round;
}
function getRoundShortName(round, totalRounds) {
    const remaining = totalRounds - round + 1;
    if (remaining === 1) return LANG.t('ФИНАЛ');
    if (remaining === 2) return '1/2';
    if (remaining === 3) return '1/4';
    if (remaining === 4) return '1/8';
    return 'Р' + round;
}
function getCupName(lk) {
    if (lk === 'NHL') return LANG.t('Кубок Стэнли');
    if (lk === 'KHL') return LANG.t('Кубок Гагарина');
    return `${LANG.t('Кубок')} ${getLeagueName(lk)}`;
}

function startPlayoffs() {
    playoffState = {};
    playoffRound = 1;
    for (const lk of Object.keys(standings)) {
        const info = LEAGUE_DATA[lk];
        if (!info) continue;
        const spots = info.playoffSpots || 4;
        const groups = info.divisions.map((div, divIdx) => {
            const teams = standings[lk].filter(t => div.clubs.includes(t.club)).sort(sortStandingsFn);
            return {name: div.name, groupIdx: divIdx, teams: teams.slice(0, spots).map((t, i) => ({name: t.club, seedInGroup: i + 1, groupIdx: divIdx, groupName: div.name}))};
        });
        const series = [];
        groups.forEach(group => {
            const t = group.teams;
            const n = t.length;
            if (n < 2) return;
            for (let i = 0; i < n / 2; i++) {
                series.push({teamA: t[i], teamB: t[n - 1 - i], leagueKey: lk, groupIdx: group.groupIdx, winsA: 0, winsB: 0, games: [], winner: null});
            }
        });
        if (series.length === 0) continue;
        playoffState[lk] = {structure: info.divisions.length >= 2 ? 'multi' : 'single', totalRounds: Math.round(Math.log2(series.length * 2)), groupCount: groups.length, groups, series, round: 1, history: [], champion: null};
    }
    seasonPhase = 'playoffs';
    addNews('🏆 ' + LANG.t('Плей-офф стартовал!'), "positive");
    saveGame();
    updateAllDisplays();
}

function simulateOneSeries(s) {
    const lk = s.leagueKey;
    const sA = teamStrengths[lk + "_" + s.teamA.name] || 0.5;
    const sB = teamStrengths[lk + "_" + s.teamB.name] || 0.5;
    while (s.winsA < 4 && s.winsB < 4) {
        const gA = Math.max(0, Math.floor(Math.random() * 4 * sA + Math.random() * 3 - 0.5));
        const gB = Math.max(0, Math.floor(Math.random() * 4 * sB + Math.random() * 3 - 0.5));
        let fA = gA, fB = gB;
        if (gA === gB) { if (Math.random() < 0.5) fA++; else fB++; }
        s.games.push({a: fA, b: fB});
        if (fA > fB) s.winsA++; else s.winsB++;
    }
    s.winner = s.winsA > s.winsB ? s.teamA : s.teamB;
    return s;
}

function buildNextRoundSeries(state, winners) {
    const nextRound = state.round + 1;
    const series = [];

    if (state.structure === 'multi' && state.groupCount === 4) {
        // ===== NHL/AHL: 4 дивизиона по 4 команды =====
        if (nextRound === 2) {
            // Финал дивизиона: в каждой группе 2 победителя → 1 серия
            for (let g = 0; g < 4; g++) {
                const gw = winners.filter(w => w.groupIdx === g);
                if (gw.length === 2) {
                    series.push({teamA: gw[0], teamB: gw[1], leagueKey: state.leagueKey, groupIdx: g, winsA: 0, winsB: 0, games: [], winner: null});
                }
            }
        } else if (nextRound === 3) {
            // Финал конференции: дивизион 0 vs 1 (левая), дивизион 2 vs 3 (правая)
            const g0 = winners.find(w => w.groupIdx === 0);
            const g1 = winners.find(w => w.groupIdx === 1);
            const g2 = winners.find(w => w.groupIdx === 2);
            const g3 = winners.find(w => w.groupIdx === 3);
            if (g0 && g1) series.push({teamA: g0, teamB: g1, leagueKey: state.leagueKey, groupIdx: 0, winsA: 0, winsB: 0, games: [], winner: null});
            if (g2 && g3) series.push({teamA: g2, teamB: g3, leagueKey: state.leagueKey, groupIdx: 2, winsA: 0, winsB: 0, games: [], winner: null});
        } else if (nextRound === 4) {
            // Финал
            if (winners.length === 2) {
                series.push({teamA: winners[0], teamB: winners[1], leagueKey: state.leagueKey, groupIdx: 0, winsA: 0, winsB: 0, games: [], winner: null});
            }
        }
    } else if (state.structure === 'multi' && state.groupCount === 2) {
        // ===== КХЛ/МХЛ: 2 конференции по 8 команд =====
        if (nextRound === 2) {
            // 1/4: перепосев внутри конференции (4 победителя → 2 серии)
            for (let g = 0; g < 2; g++) {
                const gw = winners.filter(w => w.groupIdx === g).sort((a, b) => a.seedInGroup - b.seedInGroup);
                const n = gw.length;
                for (let i = 0; i < n / 2; i++) {
                    series.push({teamA: gw[i], teamB: gw[n - 1 - i], leagueKey: state.leagueKey, groupIdx: g, winsA: 0, winsB: 0, games: [], winner: null});
                }
            }
        } else if (nextRound === 3) {
            // Финал конференции: по 1 серии в каждой конференции
            for (let g = 0; g < 2; g++) {
                const gw = winners.filter(w => w.groupIdx === g);
                if (gw.length === 2) {
                    series.push({teamA: gw[0], teamB: gw[1], leagueKey: state.leagueKey, groupIdx: g, winsA: 0, winsB: 0, games: [], winner: null});
                }
            }
        } else if (nextRound === 4) {
            // Финал Кубка Гагарина
            if (winners.length === 2) {
                series.push({teamA: winners[0], teamB: winners[1], leagueKey: state.leagueKey, groupIdx: 0, winsA: 0, winsB: 0, games: [], winner: null});
            }
        }
    } else {
        // ===== Одиночные лиги: перепосев по силе =====
        const sorted = [...winners].sort((a, b) => a.seedInGroup - b.seedInGroup);
        const n = sorted.length;
        for (let i = 0; i < n / 2; i++) {
            series.push({teamA: sorted[i], teamB: sorted[n - 1 - i], leagueKey: state.leagueKey, groupIdx: 0, winsA: 0, winsB: 0, games: [], winner: null});
        }
    }
    return series;
}

function generatePlayoffMatchDetails(homeClub, awayClub, homeScore, awayScore, lk, seriesInfo) {
    const playersHome = players.filter(p => p.club === homeClub && p.league === lk && p.position !== 'G');
    const playersAway = players.filter(p => p.club === awayClub && p.league === lk && p.position !== 'G');
    const allGoals = [];
    const pickScorer = (arr) => {
        if (arr.length === 0) return null;
        const weights = arr.map(p => Math.pow(p.rating, 2) * (p.position === 'C' || p.position === 'LW' || p.position === 'RW' ? 1.5 : 1));
        const total = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        for (let i = 0; i < arr.length; i++) { r -= weights[i]; if (r <= 0) return arr[i]; }
        return arr[arr.length - 1];
    };
    for (let i = 0; i < homeScore; i++) {
        const scorer = pickScorer(playersHome);
        const minute = randomInt(1, 60);
        const period = minute <= 20 ? 1 : minute <= 40 ? 2 : 3;
        const assists = [];
        if (Math.random() < 0.7 && playersHome.length > 1) {
            const a1 = pickScorer(playersHome.filter(p => p !== scorer));
            if (a1) assists.push(a1.name);
        }
        allGoals.push({ minute, period, team: 'home', scorer: scorer ? scorer.name : 'Unknown', assists });
    }
    for (let i = 0; i < awayScore; i++) {
        const scorer = pickScorer(playersAway);
        const minute = randomInt(1, 60);
        const period = minute <= 20 ? 1 : minute <= 40 ? 2 : 3;
        const assists = [];
        if (Math.random() < 0.7 && playersAway.length > 1) {
            const a1 = pickScorer(playersAway.filter(p => p !== scorer));
            if (a1) assists.push(a1.name);
        }
        allGoals.push({ minute, period, team: 'away', scorer: scorer ? scorer.name : 'Unknown', assists });
    }
    allGoals.sort((a, b) => a.minute - b.minute);
    const teamWonHome = homeScore > awayScore;
    const allRatings = [];
    playersHome.forEach(p => {
        let rt = 5.0 + (p.rating - 50) / 25 + (Math.random() - 0.5) * 0.6;
        if (teamWonHome) rt += 0.5; else rt -= 0.3;
        rt = Math.max(1.0, Math.min(10.0, rt));
        allRatings.push({ name: p.name, rating: Math.round(rt * 10) / 10, goals: 0, assists: 0, team: 'home' });
    });
    playersAway.forEach(p => {
        let rt = 5.0 + (p.rating - 50) / 25 + (Math.random() - 0.5) * 0.6;
        if (!teamWonHome) rt += 0.5; else rt -= 0.3;
        rt = Math.max(1.0, Math.min(10.0, rt));
        allRatings.push({ name: p.name, rating: Math.round(rt * 10) / 10, goals: 0, assists: 0, team: 'away' });
    });
    const top3 = allRatings.sort((a, b) => b.rating - a.rating).slice(0, 6);
    return {
        homeScore, awayScore,
        isOT: false, isSO: false,
        goals: allGoals,
        threeStars: top3.slice(0, 3).map(x => x.name),
        playerRatings: top3,
        seriesInfo: seriesInfo || null
    };
}

function simulatePlayoffRound() {
    if (seasonPhase !== 'playoffs') return;

    // Проверка: если у ВСЕХ лиг уже есть champion — плей-офф завершён, идём в драфт
    const keys = Object.keys(playoffState);
    if (keys.length > 0 && keys.every(lk => playoffState[lk]?.champion)) {
        playoffRound = 0;
        finishPlayoffs();
        return;
    }
    const presidentClubs = getPresidentClubs();
    const presSet = new Set(presidentClubs.map(pc => pc.league + "_" + pc.club));
    let allDone = true;

    for (const lk of Object.keys(playoffState)) {
        const st = playoffState[lk];
        if (st.champion) continue;
        st.series.forEach(s => {
            if (!s.winner) simulateOneSeries(s);
            const isMy = presSet.has(lk + "_" + s.teamA.name) || presSet.has(lk + "_" + s.teamB.name);
            if (isMy) {
                const rn = getRoundShortName(st.round, st.totalRounds);
                const isA = presSet.has(lk + "_" + s.teamA.name);
                const myW = isA ? s.winsA : s.winsB;
                const oppW = isA ? s.winsB : s.winsA;
                const mt = isA ? s.teamA.name : s.teamB.name;
                const ot = isA ? s.teamB.name : s.teamA.name;
                const r = myW > oppW ? '✅' : '❌';
                addNews(`${r} ${rn}: ${mt} ${myW}–${oppW} ${ot}`, myW > oppW ? "positive" : "negative");
            }
        });
        const winners = st.series.map(s => s.winner);
        if (!st.history) st.history = [];
        st.history.push({round: st.round, series: st.series.map(s => ({...s}))});

        if (winners.length === 1) {
            st.champion = winners[0].name;
            let finalistName = null;
            const finalSeries = st.series[0];
            if (finalSeries) {
                finalistName = finalSeries.teamA.name === st.champion ? finalSeries.teamB.name : finalSeries.teamA.name;
                recordChampion(lk, st.champion, finalistName, currentSeason);
            }
            addNews(`🏆 ${LANG.t('Чемпион')} ${getLeagueName(lk)}: ${winners[0].name}`, "positive");

            // Призовые чемпиону
            const champKey = lk + "_" + st.champion;
            const champPrize = getLeaguePrize(lk, 0.20);
            if (clubData[champKey]) {
                clubData[champKey].budget += champPrize;
                addNews(`💰 ${st.champion} получает ${formatMoney(champPrize)} за победу в ${getCupName(lk)}!`, "positive");
            }

            // Призовые финалисту
            if (finalistName) {
                const finalistKey = lk + "_" + finalistName;
                const finalPrize = getLeaguePrize(lk, 0.10);
                if (clubData[finalistKey]) {
                    clubData[finalistKey].budget += finalPrize;
                    addNews(`💰 ${finalistName} получает ${formatMoney(finalPrize)} за выход в финал`, "info");
                }
            }
            const cupName = getCupName(lk);
            myRoster.forEach(p => {
                if (p.club === winners[0].name && p.league === lk) {
                    if (!p.trophies) p.trophies = [];
                    p.trophies.push({name: `🏆 ${cupName}`, season: currentSeason, club: p.club});
                    addNews(`🥇 ${p.name} — обладатель ${cupName}!`, "positive");
                    addXP(1000);
                    careerCounters.cupsWon = (careerCounters.cupsWon || 0) + 1;
                }
            });
            continue;
        }
        const next = buildNextRoundSeries(st, winners);

        // Защита: если новый раунд пустой — значит что-то пошло не так,
        // завершаем эту лигу чемпионом по силе
        if (!next || next.length === 0) {
            const topSeed = [...winners].sort((a, b) => a.seedInGroup - b.seedInGroup)[0];
            st.champion = topSeed ? topSeed.name : 'Неизвестно';
            addNews(`🏆 ${LANG.t('Чемпион')} ${getLeagueName(st.leagueKey)}: ${st.champion}`, "positive");
            continue;
        }

        st.round++;
        st.series = next;
        allDone = false;
    }

    const isFinal = allDone;
    if (!isFinal) playoffRound++;
    saveGame();
    updateAllDisplays();

    // Если игрок президент — показать матчи плей-офф его клуба (ТОЛЬКО текущий раунд, один раз)
    if (presidentClubKey) {
        const myClub = clubData[presidentClubKey];
        if (myClub) {
            const playoffMatches = [];
            for (const lk of Object.keys(playoffState)) {
                const st = playoffState[lk];
                if (!st.history || st.history.length === 0) continue;

                const lastRound = st.history[st.history.length - 1];
                const roundNum = lastRound.round;

                if (!st.viewedRounds) st.viewedRounds = [];
                if (st.viewedRounds.includes(roundNum)) continue;

                const mySeries = lastRound.series.filter(sr =>
                    sr.teamA.name === myClub.club || sr.teamB.name === myClub.club
                );
                if (mySeries.length === 0) {
                    st.viewedRounds.push(roundNum);
                    continue;
                }

                mySeries.forEach(sr => {
                    if (!sr.games || sr.games.length === 0) return;
                    let progA = 0, progB = 0;
                    sr.games.forEach((g, idx) => {
                        const homeIsA = (idx % 2 === 0);
                        const homeClub = homeIsA ? sr.teamA.name : sr.teamB.name;
                        const awayClub = homeIsA ? sr.teamB.name : sr.teamA.name;
                        const homeScore = homeIsA ? g.a : g.b;
                        const awayScore = homeIsA ? g.b : g.a;
                        const seriesInfo = {
                            teamA: sr.teamA.name,
                            teamB: sr.teamB.name,
                            winsA: progA,
                            winsB: progB,
                            maxWins: 4,
                            roundNum: roundNum,
                            totalRounds: st.totalRounds
                        };
                        const detail = generatePlayoffMatchDetails(homeClub, awayClub, homeScore, awayScore, lk, seriesInfo);
                        playoffMatches.push({
                            match: {
                                home: homeClub,
                                away: awayClub,
                                league: lk,
                                week: currentWeek,
                                isPlayoff: true,
                                playoffRound: roundNum,
                                playoffTotalRounds: st.totalRounds,
                                result: detail
                            },
                            lk
                        });

                        // Обновляем счёт серии ПОСЛЕ генерации матча
                        // g.a = teamA, g.b = teamB (НЕ зависит от дома/гостей)
                        if (g.a > g.b) progA++; else progB++;
                    });
                });
                st.viewedRounds.push(roundNum);
            }
            if (playoffMatches.length > 0) {
                if (isFinal) {
                    setTimeout(() => {
                        openMatchQueueFromData(playoffMatches, () => { finishPlayoffs(); });
                    }, 400);
                } else {
                    setTimeout(() => openMatchQueueFromData(playoffMatches), 400);
                }
                return;
            }
        }
    }

    if (isFinal) { finishPlayoffs(); return; }
}

function openMatchQueueFromData(list, onFinish) {
    if (!list || list.length === 0) {
        if (onFinish) onFinish();
        return;
    }
    matchQueue = list;
    matchQueueIdx = 0;
    matchQueueOnFinish = onFinish || null;
    openNextMatchInQueue();
}

function finishPlayoffs() {
    addNews('🎉 ' + LANG.t('Плей-офф завершён! Начинается драфт.'), "positive");
    seasonPhase = 'draft';
    playoffRound = 0;
    runDraft();
}

// ============ ОЧЕРЕДЬ МАТЧЕЙ ПОСЛЕ "ИГРАТЬ НЕДЕЛЮ" ============
function openMatchQueue(matches, lk) {
    if (!matches || matches.length === 0) return;
    matchQueue = matches.map(m => ({ match: m, lk }));
    matchQueueIdx = 0;
    matchQueueOnFinish = null;
    openNextMatchInQueue();
}

function openNextMatchInQueue() {
    if (!matchQueue || matchQueueIdx >= matchQueue.length) {
        matchQueue = null;
        matchQueueIdx = 0;
        if (matchQueueOnFinish) {
            const cb = matchQueueOnFinish;
            matchQueueOnFinish = null;
            cb();
            return;
        }
        // Возврат в офис
        document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
        const os = document.getElementById('office-screen');
        if (os) os.style.display = 'flex';
        showBottomNav();
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const navO = document.querySelector('.nav-item[data-nav="office"]');
        if (navO) navO.classList.add('active');
        updateAllDisplays();
        saveGame();
        return;
    }
    const item = matchQueue[matchQueueIdx];
    matchQueueIdx++;
    openMatchView(item.match, item.lk);
}

// ============ ЭКРАН ПРОСМОТРА МАТЧА ============
function openMatchView(match, lk) {
    const r = match.result;
    if (!r) return;

    hidePagination();

    const modal = document.getElementById('match-modal');
    if (modal) modal.style.display = 'none';

    // Генерируем сценарий матча
    matchViewState = buildMatchScript(match, lk);
    matchViewState.visibleCount = 0;
    matchViewState.isPlaying = false;
    matchViewState.timer = null;
    matchViewState.lastAnimatedIdx = 0;

    document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
    const screen = document.getElementById('match-view-screen');
    if (screen) screen.style.display = 'flex';
    hideBottomNav();

    const title = document.getElementById('mv-header-title');
    if (title) {
        const hEmoji = match.isNational ? (match.homeFlag || '') + ' ' : '';
        const aEmoji = match.isNational ? ' ' + (match.awayFlag || '') : '';
        title.textContent = hEmoji + match.home + ' vs ' + match.away + aEmoji;
    }

    renderMatchView();
}

function buildMatchScript(match, lk) {
    const r = match.result;
    const dataH = clubData[lk + "_" + match.home];
    const dataA = clubData[lk + "_" + match.away];
    const homeCap = dataH ? getStadiumCapacity(dataH.upgrades.stadium || 1) : 5000;
    const attendance = Math.round(homeCap * (0.75 + Math.random() * 0.22));

    const events = [];
    events.push({ minute: 0, period: 1, type: 'start', text: '🏒 ' + LANG.t('Матч начался!') });

    // Голы из результата
    (r.goals || []).forEach(g => {
        events.push({
            minute: g.minute,
            period: g.period,
            type: 'goal',
            scorer: g.scorer,
            assists: g.assists,
            team: g.team,
            scoreHome: null, // посчитаем ниже
            scoreAway: null,
            text: null
        });
    });

    // Сортируем по минуте
    events.sort((a, b) => a.minute - b.minute);

    // Считаем счёт нарастающим итогом
    let h = 0, a = 0;
    events.forEach(e => {
        if (e.type === 'goal') {
            if (e.team === 'home') h++; else a++;
            e.scoreHome = h;
            e.scoreAway = a;
            const teamName = e.team === 'home' ? match.home : match.away;
            const assistStr = e.assists.length > 0 ? ` (${LANG.t('пас:')} ` + e.assists.join(', ') + ')' : '';
            e.text = `<b>${LANG.t('ГОЛ!')}</b> ${e.scorer} (${teamName})${assistStr} — <b>${h}:${a}</b>`;
        }
    });

    // Добавляем концы периодов
    const p1End = { minute: 20, period: 1, type: 'period', text: '🔔 ' + LANG.t('Конец 1-го периода') };
    const p2End = { minute: 40, period: 2, type: 'period', text: '🔔 ' + LANG.t('Конец 2-го периода') };
    const p3End = { minute: 60, period: 3, type: 'period', text: '🏁 ' + LANG.t('Матч завершён!') };

    // Расставляем периоды по своим местам
    const allEvents = [];
    events.forEach(e => {
        if (e.minute <= 20) allEvents.push(e);
    });
    allEvents.push(p1End);
    events.forEach(e => {
        if (e.minute > 20 && e.minute <= 40) allEvents.push(e);
    });
    allEvents.push(p2End);
    events.forEach(e => {
        if (e.minute > 40) allEvents.push(e);
    });
    allEvents.push(p3End);

    return {
        match, lk,
        events: allEvents,
        homeScore: r.homeScore,
        awayScore: r.awayScore,
        isOT: r.isOT,
        isSO: r.isSO,
        attendance,
        rink: true
    };
}

function renderMatchView() {
    const c = document.getElementById('mv-content');
    if (!c || !matchViewState) return;
    const st = matchViewState;
    const m = st.match;
    const r = m.result;

    // Текущее состояние (по видимым событиям)
    let curH = 0, curA = 0, curPeriod = 1, curTime = 0;
    const visible = st.events.slice(0, st.visibleCount);
    visible.forEach(e => {
        if (e.type === 'goal') {
            if (e.team === 'home') curH++; else curA++;
        }
        if (e.type === 'period') {
            curPeriod = Math.min(3, e.period + 1);
            curTime = e.period * 20;
        } else {
            curTime = e.minute;
        }
    });
    if (st.visibleCount >= st.events.length) {
        curH = st.homeScore;
        curA = st.awayScore;
        curPeriod = 3;
        curTime = 60;
    }
    const isFinished = st.visibleCount >= st.events.length;

    // Формат времени
    const minuteStr = String(Math.min(20, Math.floor(curTime) - (curPeriod - 1) * 20)).padStart(2, '0');
    const timeStr = minuteStr + ':00';

    // Прогресс статистики (броски и владение растут)
    const progress = Math.min(1, st.visibleCount / Math.max(1, st.events.length));
    const totalShotsH = 20 + Math.floor(Math.random() * 15) + st.homeScore * 2;
    const totalShotsA = 20 + Math.floor(Math.random() * 15) + st.awayScore * 2;
    const curShotsH = Math.round(totalShotsH * progress);
    const curShotsA = Math.round(totalShotsA * progress);
    const totalShots = curShotsH + curShotsA;
    const possH = totalShots > 0 ? Math.round((curShotsH / totalShots) * 100) : 50;
    const possA = 100 - possH;
    const pimH = Math.round(Math.min(12, progress * 10) + (Math.random() * 2));
    const pimA = Math.round(Math.min(12, progress * 10) + (Math.random() * 2));

    // События — показываем только видимые, от последнего к первому
    const eventRows = visible.slice().reverse().map(e => {
        const cls = e.type === 'goal' ? 'mv-event-goal' : e.type === 'period' ? 'mv-event-period' : 'mv-event-start';
        const icon = e.type === 'goal' ? '⚽' : e.type === 'period' ? '🔔' : '🏒';
        // Ярлык "Мой клиент", если автор события — наш клиент
        const author = myRoster.find(p => e.text && e.text.includes(p.name));
        const badge = author ? ` <span class="mv-my-client-badge">⭐ ${LANG.t('Мой клиент')}</span>` : '';
        return `<div class="mv-event ${cls}">
            <span class="mv-ev-time">${e.minute}'</span>
            <span class="mv-ev-icon">${icon}</span>
            <span class="mv-ev-text">${e.text}${badge}</span>
        </div>`;
    }).join('');

    // Кнопки
    let controlsHTML = '';
    if (!isFinished) {
        if (st.isPlaying) {
            controlsHTML = `
                <button class="mv-btn mv-btn-pause" id="mv-pause">⏸ ${LANG.t('Пауза')}</button>
                <button class="mv-btn mv-btn-skip" id="mv-skip">⏩ ${LANG.t('Пропустить')}</button>
            `;
        } else if (st.visibleCount === 0) {
            controlsHTML = `
                <button class="mv-btn mv-btn-play" id="mv-play">▶ ${LANG.t('Начать матч')}</button>
                <button class="mv-btn mv-btn-skip" id="mv-skip">⏩ ${LANG.t('Пропустить')}</button>
            `;
        } else {
            controlsHTML = `
                <button class="mv-btn mv-btn-play" id="mv-play">▶ ${LANG.t('Продолжить')}</button>
                <button class="mv-btn mv-btn-skip" id="mv-skip">⏩ ${LANG.t('Пропустить')}</button>
            `;
        }
    } else {
        controlsHTML = `
            <button class="mv-btn mv-btn-skip" id="mv-close">✕ ${LANG.t('Закрыть')}</button>
        `;
    }

    // Финальные блоки
    let finalHTML = '';
    if (isFinished) {
        const isMyClient = (name) => myRoster.some(p => p.name === name);
        // Оценки
        const ratings = (r.playerRatings || []).map((p, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
            const mine = isMyClient(p.name);
            const pts = p.goals + p.assists;
            const ptsStr = pts > 0 ? ` • ${p.goals}+${p.assists}` : '';
            const rtClass = p.rating >= 8 ? 'rt-high' : p.rating >= 6.5 ? 'rt-mid' : 'rt-low';
            return `<div class="match-rating-row ${mine ? 'my-client' : ''}">
                <span class="mr-medal">${medal}</span>
                <span class="mr-name">${p.name}</span>
                <span class="mr-pts">${ptsStr}</span>
                <span class="mr-rating ${rtClass}">${p.rating.toFixed(1)}</span>
            </div>`;
        }).join('');

        finalHTML = `
            <div class="mv-final-section">
                <div class="mv-final-title">📊 ${LANG.t('Оценки игроков')}</div>
                <div class="match-ratings">${ratings || '<div class="match-empty">—</div>'}</div>
            </div>
        `;
    }

    const finalScoreH = isFinished ? st.homeScore : curH;
    const finalScoreA = isFinished ? st.awayScore : curA;

    c.innerHTML = `
        <div class="mv-scoreboard">
            <div class="mv-period-line">
                <span class="mv-period-label">${isFinished ? '🏁 ' + LANG.t('Финал') : curPeriod + '-' + LANG.t('й период')}</span>
                <span class="mv-time">${isFinished ? 'FIN' : timeStr}</span>
            </div>
            <div class="mv-score-line">
                <span class="mv-score-num ${finalScoreH > finalScoreA ? 'active' : ''}">${finalScoreH}</span>
                <span class="mv-score-sep">:</span>
                <span class="mv-score-num ${finalScoreA > finalScoreH ? 'active' : ''}">${finalScoreA}</span>
            </div>
            <div class="mv-team-line">
                <div class="mv-team">${m.isNational ? `<span class="mv-flag">${m.homeFlag || '🏒'}</span>` : getTeamLogoHTML(m.home, st.lk)}<span>${m.home}</span></div>
                <div class="mv-arena-badge">👥 ${st.attendance.toLocaleString()}</div>
                <div class="mv-team right"><span>${m.away}</span>${m.isNational ? `<span class="mv-flag">${m.awayFlag || '🏒'}</span>` : getTeamLogoHTML(m.away, st.lk)}</div>
            </div>
            <div class="mv-meta">${getLeagueName(st.lk)} • ${LANG.t('Неделя')} ${m.week}${m.isPlayoff ? ' • 🏆 ' + LANG.t('ПЛЕЙ-ОФФ') : ''}</div>
        </div>

        ${r.seriesInfo ? `<div class="mv-series-block">
            <div class="mvs-title">🎯 Счёт в серии • ${getRoundShortName(r.seriesInfo.roundNum, r.seriesInfo.totalRounds)}</div>
            <div class="mvs-row">
                <div class="mvs-team">
                    <div class="mvs-logo">${getTeamLogoHTML(r.seriesInfo.teamA, st.lk)}</div>
                    <span class="mvs-name">${r.seriesInfo.teamA}</span>
                </div>
                <div class="mvs-score-big">
                    <span class="${r.seriesInfo.winsA > r.seriesInfo.winsB ? 'w' : ''}">${r.seriesInfo.winsA}</span>
                    <span class="mvs-sep">:</span>
                    <span class="${r.seriesInfo.winsB > r.seriesInfo.winsA ? 'w' : ''}">${r.seriesInfo.winsB}</span>
                </div>
                <div class="mvs-team mvs-team-right">
                    <span class="mvs-name">${r.seriesInfo.teamB}</span>
                    <div class="mvs-logo">${getTeamLogoHTML(r.seriesInfo.teamB, st.lk)}</div>
                </div>
            </div>
            <div class="mvs-progress">${LANG.t('До')} ${r.seriesInfo.maxWins} ${LANG.t('побед в серии')}</div>
        </div>` : ''}

        <div class="mv-rink-wrap">
            <svg class="mv-rink" viewBox="0 0 300 160" preserveAspectRatio="xMidYMid meet">
                <defs>
                    <linearGradient id="rinkBg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#e8f4f8" stop-opacity="0.9"/>
                        <stop offset="100%" stop-color="#c8e0ea" stop-opacity="0.7"/>
                    </linearGradient>
                </defs>
                <rect x="10" y="10" width="280" height="140" rx="50" fill="url(#rinkBg)" stroke="#8ab0c0" stroke-width="1.5"/>
                <line x1="150" y1="10" x2="150" y2="150" stroke="#ff4444" stroke-width="1.5" opacity="0.6"/>
                <circle cx="150" cy="80" r="22" fill="none" stroke="#4488cc" stroke-width="1.5" opacity="0.6"/>
                <circle cx="150" cy="80" r="3" fill="#4488cc" opacity="0.8"/>
                <line x1="60" y1="10" x2="60" y2="150" stroke="#4488cc" stroke-width="1.2" opacity="0.5"/>
                <line x1="240" y1="10" x2="240" y2="150" stroke="#4488cc" stroke-width="1.2" opacity="0.5"/>
                <circle cx="60" cy="45" r="14" fill="none" stroke="#ff4444" stroke-width="1.2" opacity="0.5"/>
                <circle cx="60" cy="115" r="14" fill="none" stroke="#ff4444" stroke-width="1.2" opacity="0.5"/>
                <circle cx="240" cy="45" r="14" fill="none" stroke="#ff4444" stroke-width="1.2" opacity="0.5"/>
                <circle cx="240" cy="115" r="14" fill="none" stroke="#ff4444" stroke-width="1.2" opacity="0.5"/>
                <rect x="10" y="60" width="6" height="40" fill="none" stroke="#4488cc" stroke-width="1.2" opacity="0.7"/>
                <rect x="284" y="60" width="6" height="40" fill="none" stroke="#4488cc" stroke-width="1.2" opacity="0.7"/>
            </svg>
            <div class="mv-puck ${st.isPlaying && !isFinished ? 'active' : ''}"></div>
        </div>

        <div class="mv-stats">
            <div class="mv-stats-title">📊 ${LANG.t('СТАТИСТИКА МАТЧА')}</div>
            <div class="mv-stat-row">
                <span class="mv-stat-val">${curShotsH}</span>
                <span class="mv-stat-lbl">${LANG.t('Броски')}</span>
                <span class="mv-stat-val">${curShotsA}</span>
            </div>
            <div class="mv-stat-row">
                <span class="mv-stat-val">${possH}%</span>
                <span class="mv-stat-lbl">${LANG.t('Владение')}</span>
                <span class="mv-stat-val">${possA}%</span>
            </div>
            <div class="mv-stat-row">
                <span class="mv-stat-val">${pimH}</span>
                <span class="mv-stat-lbl">${LANG.t('Штраф (мин)')}</span>
                <span class="mv-stat-val">${pimA}</span>
            </div>
        </div>

        <div class="mv-feed">
            <div class="mv-feed-title">🎬 ${LANG.t('ЛЕНТА СОБЫТИЙ')}</div>
            ${eventRows || `<div class="match-empty">${LANG.t('Матч ещё не начался')}</div>`}
        </div>

        ${finalHTML}

        <div class="mv-controls">${controlsHTML}</div>
    `;

    // Обработчики кнопок
    const playBtn = document.getElementById('mv-play');
    const pauseBtn = document.getElementById('mv-pause');
    const skipBtn = document.getElementById('mv-skip');
    const closeBtn = document.getElementById('mv-close');

        // Проверка гол-события для анимации шайбы
    if (st.visibleCount > 0 && st.visibleCount !== st.lastAnimatedIdx) {
        const lastEv = st.events[st.visibleCount - 1];
        if (lastEv && lastEv.type === 'goal') {
            st.lastAnimatedIdx = st.visibleCount;
            // Вибрация при голе (если включена в настройках)
            // Гол: звук + вибрация + toast (если включены в настройках)
            playSound('goal');
            vibrate('goal');
            showToast('🥅 ' + (lastEv.text || ''), 'info');
            const puck = c.querySelector('.mv-puck');
            if (puck) {
                puck.classList.add('puck-shooting');
                const goalSide = lastEv.team === 'home' ? 'right' : 'left';
                puck.style.setProperty('--goal-x', goalSide === 'right' ? '95%' : '5%');
                puck.style.setProperty('--goal-y', '50%');
                setTimeout(() => {
                    puck.classList.remove('puck-shooting');
                }, 1200);
            }
        }
    }

    if (playBtn) playBtn.addEventListener('click', startMatchPlayback);
    if (pauseBtn) pauseBtn.addEventListener('click', pauseMatchPlayback);
    if (skipBtn) skipBtn.addEventListener('click', skipMatchPlayback);
    if (closeBtn) closeBtn.addEventListener('click', () => {
        if (window._matchCloseLock) return;
        window._matchCloseLock = true;
        closeMatchView();
        setTimeout(() => { window._matchCloseLock = false; }, 350);
    });
}

function startMatchPlayback() {
    if (!matchViewState) return;
    if (matchViewState.isPlaying) return;
    matchViewState.isPlaying = true;
    renderMatchView();
    const tick = () => {
        if (!matchViewState || !matchViewState.isPlaying) return;
        if (matchViewState.visibleCount >= matchViewState.events.length) {
            matchViewState.isPlaying = false;
            clearTimeout(matchViewState.timer);
            if (matchViewState.match) matchViewState.match.viewed = true;
            renderMatchView();
            return;
        }
        matchViewState.visibleCount++;
        renderMatchView();
        matchViewState.timer = setTimeout(tick, 2500);
    };

    // Первое событие сразу
    if (matchViewState.visibleCount === 0) {
        matchViewState.visibleCount = 1;
        renderMatchView();
    }
    matchViewState.timer = setTimeout(tick, 2500);
}

function pauseMatchPlayback() {
    if (!matchViewState) return;
    matchViewState.isPlaying = false;
    clearTimeout(matchViewState.timer);
    renderMatchView();
}

function skipMatchPlayback() {
    if (!matchViewState) return;
    matchViewState.isPlaying = false;
    clearTimeout(matchViewState.timer);
    matchViewState.visibleCount = matchViewState.events.length;
    if (matchViewState.match) matchViewState.match.viewed = true;
    renderMatchView();
}

function closeMatchView() {
    if (matchViewState) {
        clearTimeout(matchViewState.timer);
        matchViewState = null;
    }
    
    // Если есть очередь — открыть следующий матч
    if (matchQueue && matchQueueIdx < matchQueue.length) {
        openNextMatchInQueue();
        return;
    }
    
    // Очередь закончилась
    matchQueue = null;
    matchQueueIdx = 0;

    // Всегда закрываем экран матча перед дальнейшими действиями
    document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');

    // Если был callback — вызываем (например, для перехода к драфту после финала)
    if (matchQueueOnFinish) {
        const cb = matchQueueOnFinish;
        matchQueueOnFinish = null;
        try { cb(); } catch (e) { console.error('matchQueueOnFinish error:', e); }

        // Если callback сам открыл экран (модалка драфта, экран турнира и т.п.) —
        // НЕ переключаем обратно в офис, иначе он окажется под модалкой/поверх.
        const anyVisible = Array.from(document.querySelectorAll('.mobile-screen'))
            .some(s => s.style.display === 'flex');
        if (!anyVisible) {
            const os = document.getElementById('office-screen');
            if (os) os.style.display = 'flex';
            showBottomNav();
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            const navO = document.querySelector('.nav-item[data-nav="office"]');
            if (navO) navO.classList.add('active');
        }
        updateAllDisplays();
        return;
    }

    hidePagination();
    const os = document.getElementById('office-screen');
    if (os) os.style.display = 'flex';
    showBottomNav();
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navO = document.querySelector('.nav-item[data-nav="office"]');
    if (navO) navO.classList.add('active');
    updateAllDisplays();
}

document.getElementById('mv-back')?.addEventListener('click', closeMatchView);

// ============ ЭКРАН ОТДЕЛЬНОГО МАТЧА ============
function openMatchModal(match, lk) {
    if (!match.result) return;
    const modal = document.getElementById('match-modal');
    const title = document.getElementById('match-modal-title');
    const body = document.getElementById('match-modal-body');
    if (!modal || !body) return;

    const r = match.result;
    const data = clubData[lk + "_" + match.home];
    const leagueName = LEAGUE_NAMES[lk] || lk;
    const weekLabel = LANG.t('Неделя') + ' ' + match.week;

    title.textContent = match.home + ' vs ' + match.away;

    // Счёт по периодам
    const periodH = [0, 0, 0];
    const periodA = [0, 0, 0];
    r.goals.forEach(g => {
        const pIdx = Math.min(2, (g.period || 1) - 1);
        if (g.team === 'home') periodH[pIdx]++;
        else periodA[pIdx]++;
    });

    // Статистика (генерируем на основе счёта)
    const shotsH = 20 + Math.floor(Math.random() * 20) + r.homeScore * 2;
    const shotsA = 20 + Math.floor(Math.random() * 20) + r.awayScore * 2;
    const pimH = randomInt(2, 12);
    const pimA = randomInt(2, 12);
    const totalShots = shotsH + shotsA;
    const possH = Math.round((shotsH / totalShots) * 100);
    const possA = 100 - possH;

    // Хелпер: проверяем — мой клиент?
    const isMyClient = (name) => myRoster.some(p => p.name === name);

    // Блок гола
    const goalHTML = (g) => {
        const isMine = isMyClient(g.scorer);
        const icon = g.team === 'home' ? '🏠' : '✈️';
        const assists = g.assists.length > 0 ? ` (${LANG.t('асс:')} ` + g.assists.join(', ') + ')' : '';
        return `<div class="match-goal ${isMine ? 'my-client' : ''}">
            <span class="mg-period">${g.period}-й</span>
            <span class="mg-min">${g.minute}'</span>
            <span class="mg-icon">${icon}</span>
            <span class="mg-scorer">${g.scorer}</span>
            <span class="mg-assists">${assists}</span>
        </div>`;
    };

    // Звёзды
    const starsHTML = (r.threeStars || []).map((name, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
        const isMine = isMyClient(name);
        return `<div class="match-star ${isMine ? 'my-client' : ''}">
            <span class="ms-medal">${medal}</span>
            <span class="ms-name">${name}</span>
        </div>`;
    }).join('');

    // ОТ / Б
    const otText = r.isOT ? ' (' + LANG.t('ОТ') + ')' : r.isSO ? ' (' + LANG.t('по буллитам') + ')' : '';

    body.innerHTML = `
        <div class="match-header">
            <div class="match-club-line">
                <div class="match-club">${getTeamLogoHTML(match.home, lk)}<span>${match.home}</span></div>
                <div class="match-score-big">
                    <span class="${r.homeScore > r.awayScore ? 'w' : ''}">${r.homeScore}</span>
                    <span class="msc-sep">:</span>
                    <span class="${r.awayScore > r.homeScore ? 'w' : ''}">${r.awayScore}</span>
                </div>
                <div class="match-club right"><span>${match.away}</span>${getTeamLogoHTML(match.away, lk)}</div>
            </div>
            <div class="match-meta">${leagueName} • ${weekLabel}${otText}</div>
        </div>

        <div class="match-periods">
            <div class="mp-row mp-header">
                <div class="mp-team"></div>
                <div class="mp-p">1-й</div>
                <div class="mp-p">2-й</div>
                <div class="mp-p">3-й</div>
                <div class="mp-total">Итог</div>
            </div>
            <div class="mp-row">
                <div class="mp-team">${match.home}</div>
                <div class="mp-p">${periodH[0]}</div>
                <div class="mp-p">${periodH[1]}</div>
                <div class="mp-p">${periodH[2]}</div>
                <div class="mp-total ${r.homeScore > r.awayScore ? 'w' : ''}">${r.homeScore}</div>
            </div>
            <div class="mp-row">
                <div class="mp-team">${match.away}</div>
                <div class="mp-p">${periodA[0]}</div>
                <div class="mp-p">${periodA[1]}</div>
                <div class="mp-p">${periodA[2]}</div>
                <div class="mp-total ${r.awayScore > r.homeScore ? 'w' : ''}">${r.awayScore}</div>
            </div>
        </div>

        <div class="match-section-title">🎯 ${LANG.t('Голы')}</div>
        <div class="match-goals-list">
            ${r.goals.length === 0 ? `<div class="match-empty">${LANG.t('Голов не было')}</div>` : r.goals.map(goalHTML).join('')}
        </div>

        <div class="match-section-title">⭐ ${LANG.t('3 звезды матча')}</div>
        <div class="match-stars">
            ${starsHTML || '<div class="match-empty">—</div>'}
        </div>

                <div class="match-section-title">📊 ${LANG.t('Оценки игроков')}</div>
        <div class="match-ratings">
            ${(r.playerRatings || []).map((p, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
                const isMine = isMyClient(p.name);
                const pts = p.goals + p.assists;
                const ptsStr = pts > 0 ? ` • ${p.goals}+${p.assists}` : '';
                const rtClass = p.rating >= 8 ? 'rt-high' : p.rating >= 6.5 ? 'rt-mid' : 'rt-low';
                return `<div class="match-rating-row ${isMine ? 'my-client' : ''}">
                    <span class="mr-medal">${medal}</span>
                    <span class="mr-name">${p.name}</span>
                    <span class="mr-pts">${ptsStr}</span>
                    <span class="mr-rating ${rtClass}">${p.rating.toFixed(1)}</span>
                </div>`;
            }).join('')}
        </div>

        <div class="match-section-title">📊 ${LANG.t('Статистика команд')}</div>
        <div class="match-stats">
            <div class="ms-row">
                <div class="ms-val">${shotsH}</div>
                <div class="ms-lbl">${LANG.t('Броски')}</div>
                <div class="ms-val">${shotsA}</div>
            </div>
            <div class="ms-row">
                <div class="ms-val">${pimH}</div>
                <div class="ms-lbl">${LANG.t('Штраф (мин)')}</div>
                <div class="ms-val">${pimA}</div>
            </div>
            <div class="ms-row">
                <div class="ms-val">${possH}%</div>
                <div class="ms-lbl">${LANG.t('Владение')}</div>
                <div class="ms-val">${possA}%</div>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
}

document.getElementById('match-modal-close')?.addEventListener('click', () => {
    document.getElementById('match-modal').style.display = 'none';
});
document.getElementById('match-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'match-modal') e.currentTarget.style.display = 'none';
});

// ============ РАСПИСАНИЕ В ЭКРАНЕ ЛИГИ ============
// Выбранный клуб в расписании (UI-состояние, не сейвится)
let scheduleClubFilter = '';

function renderLeagueSchedule(c, lk) {
    const schedule = seasonSchedule[lk] || [];
    if (schedule.length === 0) {
        c.innerHTML += '<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-title">Расписание пустое</div></div>';
        return;
    }

    // ===== Панель фильтра по клубу =====
    const clubNames = getAllClubs(lk).slice().sort((a, b) => a.localeCompare(b));
    const filterBar = document.createElement('div');
    filterBar.className = 'schedule-filter-bar';
    const logoHTML = scheduleClubFilter ? getTeamLogoHTML(scheduleClubFilter, lk) : '<span style="font-size:16px;">📅</span>';
    filterBar.innerHTML = `
        <div class="sf-current">${logoHTML}<span>${scheduleClubFilter || LANG.t('Все клубы')}</span></div>
        <select class="schedule-club-select" id="schedule-club-select">
            <option value="">${LANG.t('Все клубы')}</option>
            ${clubNames.map(cl => `<option value="${cl}" ${cl === scheduleClubFilter ? 'selected' : ''}>${cl}</option>`).join('')}
        </select>
    `;
    c.appendChild(filterBar);
    c.querySelector('#schedule-club-select')?.addEventListener('change', (e) => {
        scheduleClubFilter = e.target.value;
        // Перерисовываем только список расписания
        c.innerHTML = '';
        const back2 = document.createElement('button');
        back2.className = 'back-to-leagues';
        back2.innerHTML = '← ' + LANG.t('К списку лиг');
        back2.addEventListener('click', () => {
            hidePagination();
            document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
            const l = document.getElementById('leagues-screen');
            if (l) l.style.display = 'flex';
            showBottomNav();
            renderLeaguesScreen();
        });
        c.appendChild(back2);
        renderLeagueSchedule(c, lk);
    });

    const filtered = scheduleClubFilter
        ? schedule.filter(m => m.home === scheduleClubFilter || m.away === scheduleClubFilter)
        : schedule;

    // Группируем по неделям
    const byWeek = {};
    filtered.forEach(m => {
        if (!byWeek[m.week]) byWeek[m.week] = [];
        byWeek[m.week].push(m);
    });

    const header = document.createElement('div');
    header.className = 'schedule-header';
    header.innerHTML = `
        <div class="schedule-title">📅 ${LANG.t('Календарь сезона')}</div>
        <div class="schedule-sub">${filtered.length} ${LANG.t('матчей')} • ${Object.keys(byWeek).length} ${LANG.t('недель')}</div>
        <div class="schedule-legend">
            <span class="leg-item"><span class="leg-dot leg-win"></span>${LANG.t('Победа хозяев')}</span>
            <span class="leg-item"><span class="leg-dot leg-loss"></span>${LANG.t('Победа гостей')}</span>
            <span class="leg-item"><span class="leg-dot leg-future"></span>${LANG.t('Предстоящий')}</span>
        </div>
    `;
    c.appendChild(header);

    if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = `<div class="empty-icon">🔍</div><div class="empty-title">${LANG.t('Матчей не найдено')}</div>`;
        c.appendChild(empty);
        return;
    }

    const frag = document.createDocumentFragment();
    const weeks = Object.keys(byWeek).map(Number).sort((a, b) => a - b);
    weeks.forEach(weekNum => {
        const matches = byWeek[weekNum];
        const allPlayed = matches.every(m => m.result);
        const somePlayed = matches.some(m => m.result);

        const weekBlock = document.createElement('div');
        weekBlock.className = 'schedule-week' + (allPlayed ? ' played' : somePlayed ? ' partial' : '');
        weekBlock.innerHTML = `<div class="schedule-week-title">${LANG.t('Неделя')} ${weekNum} ${allPlayed ? '✓' : somePlayed ? '⋯' : ''}</div>`;

        matches.forEach(m => {
            const row = document.createElement('div');
            row.className = 'schedule-row';
            const homeLogo = getTeamLogoHTML(m.home, lk);
            const awayLogo = getTeamLogoHTML(m.away, lk);

            if (m.result) {
                const isMyClubMatch = presidentClubKey && (() => {
                    const myClub = clubData[presidentClubKey];
                    return myClub && (m.home === myClub.club || m.away === myClub.club);
                })();
                const hideScore = false;
                
                const hWin = m.result.homeScore > m.result.awayScore;
                const otMark = m.result.isOT ? ' ОТ' : m.result.isSO ? ' Б' : '';
                row.classList.add(hWin ? 'win-home' : 'win-away');
                row.style.cursor = 'pointer';
                
                if (hideScore) {
                    row.innerHTML = `
                        <div class="sch-logo">${homeLogo}</div>
                        <div class="sch-team">${m.home}</div>
                        <div class="sch-score">
                            <span class="sch-score-home">?</span>
                            <span class="sch-score-sep">:</span>
                            <span class="sch-score-away">?</span>
                        </div>
                        <div class="sch-team right">${m.away}</div>
                        <div class="sch-logo">${awayLogo}</div>
                    `;
                } else {
                    row.innerHTML = `
                        <div class="sch-logo">${homeLogo}</div>
                        <div class="sch-team">${m.home}</div>
                        <div class="sch-score">
                            <span class="sch-score-home ${hWin ? 'w' : ''}">${m.result.homeScore}</span>
                            <span class="sch-score-sep">:</span>
                            <span class="sch-score-away ${!hWin ? 'w' : ''}">${m.result.awayScore}</span>
                            ${otMark ? `<span class="sch-ot">${otMark}</span>` : ''}
                        </div>
                        <div class="sch-team right">${m.away}</div>
                        <div class="sch-logo">${awayLogo}</div>
                    `;
                }
                
                row.addEventListener('click', () => {
                    if (isMyClubMatch) {
                        openMatchView(m, lk);
                        return;
                    }
                    openMatchModal(m, lk);
                });
            } else {
                row.classList.add('future');
                row.innerHTML = `
                    <div class="sch-logo">${homeLogo}</div>
                    <div class="sch-team">${m.home}</div>
                    <div class="sch-score future-score">— : —</div>
                    <div class="sch-team right">${m.away}</div>
                    <div class="sch-logo">${awayLogo}</div>
                `;
            }
            weekBlock.appendChild(row);
        });

        frag.appendChild(weekBlock);
    });
    c.appendChild(frag);

    // Блок плей-офф
    const pState = playoffState[lk];
    if (pState && pState.history && pState.history.length > 0) {
        const poHeader = document.createElement('div');
        poHeader.className = 'schedule-playoff-header';
        poHeader.innerHTML = `<span class="sph-icon">🏆</span> ${LANG.t('ПЛЕЙ-ОФФ')} ${currentSeason}`;
        c.appendChild(poHeader);

        const poHistory = pState.history || [];
        poHistory.forEach(roundData => {
            const roundBlock = document.createElement('div');
            roundBlock.className = 'schedule-playoff-round';
            roundBlock.innerHTML = `<div class="spr-title">${getRoundShortName(roundData.round, pState.totalRounds)}</div>`;

            roundData.series.forEach(sr => {
                const seriesRow = document.createElement('div');
                const isCompleted = sr.winner !== null;
                seriesRow.className = 'schedule-playoff-series' + (isCompleted ? ' completed' : '');
                const wA = sr.winsA, wB = sr.winsB;
                const aWon = sr.winner === sr.teamA;
                const bWon = sr.winner === sr.teamB;
                seriesRow.innerHTML = `
                    <div class="sps-team ${aWon ? 'winner' : ''}">
                        <div class="sps-logo">${getTeamLogoHTML(sr.teamA.name, lk)}</div>
                        <span class="sps-name">${sr.teamA.name}</span>
                        <span class="sps-wins">${wA}</span>
                    </div>
                    <div class="sps-team ${bWon ? 'winner' : ''}">
                        <div class="sps-logo">${getTeamLogoHTML(sr.teamB.name, lk)}</div>
                        <span class="sps-name">${sr.teamB.name}</span>
                        <span class="sps-wins">${wB}</span>
                    </div>
                `;
                roundBlock.appendChild(seriesRow);
            });

            c.appendChild(roundBlock);
        });
    }
}

function renderLeagueHistory(c, lk) {
    const hist = championsHistory[lk] || [];
    if (hist.length === 0) {
        c.innerHTML += '<div class="empty-state"><div class="empty-icon">📜</div><div class="empty-title">История пуста</div><div class="empty-desc">Сыграйте сезон, чтобы появились чемпионы</div></div>';
        return;
    }

    const header = document.createElement('div');
    header.className = 'history-header';
    header.innerHTML = `<div class="hh-title">🏆 ${LANG.t('Зал славы')} ${getLeagueName(lk)}</div><div class="hh-sub">${hist.length} ${LANG.t('сезонов в архиве')}</div>`;
    c.appendChild(header);

    // ===== Таблица =====
    const sorted = [...hist].sort((a, b) => b.season - a.season);
    const table = document.createElement('div');
    table.className = 'history-table';

    // Шапка
    const thead = document.createElement('div');
    thead.className = 'ht-head';
    thead.innerHTML = `
        <div class="ht-col-season">${LANG.t('Сез.')}</div>
        <div class="ht-col-team">${LANG.t('Чемпион')}</div>
        <div class="ht-col-team">${LANG.t('Второй')}</div>
    `;
    table.appendChild(thead);

    // Строки
    sorted.forEach((h, idx) => {
        const row = document.createElement('div');
        row.className = 'ht-row' + (idx === 0 ? ' ht-row-latest' : '') + (idx % 2 === 0 ? ' ht-row-even' : ' ht-row-odd');
        const champLogo = getTeamLogoHTML(h.champion, lk);
        const finLogo = h.finalist ? getTeamLogoHTML(h.finalist, lk) : '';
        row.innerHTML = `
            <div class="ht-col-season">${h.season}</div>
            <div class="ht-col-team ht-champion">
                <div class="ht-logo">${champLogo}</div>
                <span class="ht-name">${h.champion}</span>
            </div>
            <div class="ht-col-team ht-finalist">
                ${h.finalist ? `<div class="ht-logo ht-logo-fin">${finLogo}</div><span class="ht-name">${h.finalist}</span>` : '<span class="ht-empty">—</span>'}
            </div>
        `;
        table.appendChild(row);
    });

    c.appendChild(table);

    // ===== Сводка чемпионов и финалистов =====
    const champCounts = {};
    const finCounts = {};
    hist.forEach(h => {
        if (h.champion) champCounts[h.champion] = (champCounts[h.champion] || 0) + 1;
        if (h.finalist) finCounts[h.finalist] = (finCounts[h.finalist] || 0) + 1;
    });

    const champsSorted = Object.entries(champCounts).sort((a, b) => b[1] - a[1]);
    const finsSorted = Object.entries(finCounts).sort((a, b) => b[1] - a[1]);

    const summary = document.createElement('div');
    summary.className = 'history-summary';
    summary.innerHTML = `
        <div class="hs-title">📊 ${LANG.t('Статистика')}</div>
        <div class="hs-block">
            <div class="hs-block-label">🏆 ${LANG.t('Чемпионы:')}</div>
            <div class="hs-line">${champsSorted.map(([club, n]) => `<span class="hs-item"><span class="hs-club">${club}</span><span class="hs-count">(${n})</span></span>`).join('')}</div>
        </div>
        <div class="hs-block">
            <div class="hs-block-label">🥈 ${LANG.t('Финалисты:')}</div>
            <div class="hs-line">${finsSorted.map(([club, n]) => `<span class="hs-item"><span class="hs-club">${club}</span><span class="hs-count">(${n})</span></span>`).join('')}</div>
        </div>
    `;
    c.appendChild(summary);
}

function renderLeaguePlayoffs(c, lk) {
    const st = playoffState[lk];
    if (!st) {
        c.innerHTML += '<div class="empty-state"><div class="empty-icon">🏆</div><div class="empty-title">Плей-офф ещё не начался</div></div>';
        return;
    }
    const header = document.createElement('div');
    if (st.champion) {
        header.className = 'playoffs-champion';
        header.innerHTML = `<div class="pc-cup-icon">🏆</div><div class="pc-league">${LANG.t('Чемпион')} ${getLeagueName(lk)}</div><div class="pc-team">${st.champion}</div>`;
    } else {
        header.className = 'playoffs-info';
        header.innerHTML = `<div class="pi-round">🏒 ${getRoundName(st.round, st.totalRounds).toUpperCase()}</div><div class="pi-sub">Серии до 4 побед</div>`;
    }
    c.appendChild(header);

    const hint = document.createElement('div');
    hint.className = 'bracket-hint';
    hint.innerHTML = `↔ Пролистайте сетку вправо →`;
    c.appendChild(hint);

    const bracket = document.createElement('div');
    bracket.className = 'bracket-wrapper';
    const totalRounds = st.totalRounds;
    const history = st.history || [];

    function getSeriesForRound(r) {
        if (history.length >= r) return history[r - 1].series;
        if (r === st.round && !st.champion) return st.series;
        return null;
    }

    // Левая половина
    const leftH = document.createElement('div');
    leftH.className = 'bracket-side left';
    for (let r = 1; r < totalRounds; r++) {
        const series = getSeriesForRound(r);
        const col = document.createElement('div');
        col.className = 'bracket-column';
        if (r === st.round && !st.champion) col.classList.add('current');
        if (r < st.round || st.champion) col.classList.add('done');
        const hd = document.createElement('div');
        hd.className = 'bracket-col-header';
        hd.textContent = getRoundShortName(r, totalRounds);
        col.appendChild(hd);
        const allS = series || [];
        const leftS = allS.filter((s, i) => i < allS.length / 2);
        if (leftS.length === 0) {
            for (let i = 0; i < Math.pow(2, totalRounds - r - 1); i++) {
                const em = document.createElement('div');
                em.className = 'bracket-match wc-placeholder';
                em.innerHTML = `
                    <div class="bm-team">
                        <div class="bm-logo"></div>
                        <div class="bm-name wc-tbd">—</div>
                        <div class="bm-score">0</div>
                    </div>
                    <div class="bm-team">
                        <div class="bm-logo"></div>
                        <div class="bm-name wc-tbd">—</div>
                        <div class="bm-score">0</div>
                    </div>
                `;
                col.appendChild(em);
            }
        } else leftS.forEach(s => col.appendChild(buildBracketMatch(s, lk)));
        leftH.appendChild(col);
    }
    bracket.appendChild(leftH);

    // Центр
    const center = document.createElement('div');
    center.className = 'bracket-center';
    const finalS = getSeriesForRound(totalRounds);
    const fc = document.createElement('div');
    fc.className = 'bracket-column final-col';
    if (st.round === totalRounds && !st.champion) fc.classList.add('current');
    if (st.champion) fc.classList.add('done');
    const fh = document.createElement('div');
    fh.className = 'bracket-col-header';
    fh.textContent = LANG.t('ФИНАЛ');
    fc.appendChild(fh);
    // Финальный матч (без дублирующего кубка)
    if (finalS && finalS[0]) {
        fc.appendChild(buildBracketMatch(finalS[0], lk));
    } else {
        const em = document.createElement('div');
        em.className = 'bracket-match empty';
        em.innerHTML = '<div class="bm-empty">?</div>';
        fc.appendChild(em);
    }
    // Маленький значок чемпиона под финалом
    if (st.champion) {
        const cup = document.createElement('div');
        cup.className = 'bracket-champ-mini';
        cup.innerHTML = `🏆 ${st.champion}`;
        fc.appendChild(cup);
    }
    center.appendChild(fc);
    bracket.appendChild(center);

    // Правая половина
    const rightH = document.createElement('div');
    rightH.className = 'bracket-side right';
    // Порядок колонок: сначала 1/2 (близко к финалу), потом 1/4, потом 1/8
    for (let r = totalRounds - 1; r >= 1; r--) {
        const series = getSeriesForRound(r);
        const col = document.createElement('div');
        col.className = 'bracket-column';
        if (r === st.round && !st.champion) col.classList.add('current');
        if (r < st.round || st.champion) col.classList.add('done');
        const hd = document.createElement('div');
        hd.className = 'bracket-col-header';
        hd.textContent = getRoundShortName(r, totalRounds);
        col.appendChild(hd);
        const allS = series || [];
        const rightS = allS.filter((s, i) => i >= allS.length / 2);
        if (rightS.length === 0) {
            for (let i = 0; i < Math.pow(2, totalRounds - r - 1); i++) {
                const em = document.createElement('div');
                em.className = 'bracket-match empty';
                em.innerHTML = '<div class="bm-empty">?</div>';
                col.appendChild(em);
            }
        } else rightS.forEach(s => col.appendChild(buildBracketMatch(s, lk)));
        rightH.appendChild(col);
    }
    bracket.appendChild(rightH);
    c.appendChild(bracket);

    if (st.champion) {
        const done = document.createElement('div');
        done.className = 'playoffs-legend';
        done.innerHTML = `🎉 Турнир завершён. Поздравляем <b>${st.champion}</b>!`;
        c.appendChild(done);
    }

    // Мини-история последних чемпионов
    const hist = championsHistory[lk] || [];
    if (hist.length > 0) {
        const recent = [...hist].sort((a, b) => b.season - a.season).slice(0, 8);
        const miniHist = document.createElement('div');
        miniHist.className = 'playoffs-past-champs';
        miniHist.innerHTML = `
            <div class="ppc-title">📜 Последние чемпионы</div>
            <div class="ppc-list">
                ${recent.map(h => `<div class="ppc-row"><span class="ppc-season">${formatSeasonLabel(h.season)}</span><div class="ppc-logo">${getTeamLogoHTML(h.champion, lk)}</div><span class="ppc-club">${h.champion}</span></div>`).join('')}
            </div>
        `;
        c.appendChild(miniHist);
    }

    // Автоскролл: центрируем ФИНАЛ на экране
    const scrollToCenter = () => {
        const wrap = c.querySelector('.bracket-wrapper');
        const centerEl = wrap && wrap.querySelector('.bracket-center');
        if (wrap && centerEl) {
            const target = centerEl.offsetLeft - (wrap.clientWidth / 2) + (centerEl.offsetWidth / 2);
            wrap.scrollLeft = Math.max(0, target);
        }
    };
    setTimeout(scrollToCenter, 60);
    setTimeout(scrollToCenter, 300);
}

function buildBracketMatch(s, lk) {
    const card = document.createElement('div');
    card.className = 'bracket-match';
    const wA = s.winner === s.teamA, wB = s.winner === s.teamB;
    if (s.winner) card.classList.add('completed');
    const tl = (t, wins, iw, il) => `<div class="bm-team ${iw?'winner':''} ${il?'loser':''}"><div class="bm-logo">${getTeamLogoHTML(t.name, lk)}</div><div class="bm-name">${t.name}</div><div class="bm-score">${wins}</div></div>`;
    card.innerHTML = tl(s.teamA, s.winsA, wA, wB) + tl(s.teamB, s.winsB, wB, wA);
    return card;
}

// ============ 21. БИРЖА ============
function showMarketScreen() {
    hidePagination();
    document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
    const ms = document.getElementById('market-screen');
    if (ms) ms.style.display = 'flex';
    showBottomNav();
    renderMarketScreen();
}

function getMarketList() {
    const list = [];
    for (const key of Object.keys(clubData)) {
        const c = clubData[key];
        const owned = myPortfolio[key]?.shares || 0;
        const hist = c.stockHistory || [];
        const prev = hist.length >= 2 ? hist[hist.length - 2] : c.stockPrice;
        const change = prev > 0 ? ((c.stockPrice - prev) / prev) * 100 : 0;
        list.push({key, club: c.club, league: c.league, price: c.stockPrice, change, prestige: c.prestige, owned});
    }
    return list;
}

function sortMarketList(list) {
    if (marketSort === 'price_asc') return list.sort((a, b) => a.price - b.price);
    if (marketSort === 'price_desc') return list.sort((a, b) => b.price - a.price);
    if (marketSort === 'prestige') return list.sort((a, b) => b.prestige - a.prestige);
    return list;
}

function renderMarketScreen() {
    const c = document.getElementById('market-content');
    if (!c) return;
    const cnt = document.getElementById('portfolio-count');
    if (cnt) cnt.textContent = Object.keys(myPortfolio).length;
    document.querySelectorAll('#market-screen .clients-tab').forEach(t => {
        if (t.getAttribute('data-mtab') === marketTab) t.classList.add('active');
        else t.classList.remove('active');
    });
    c.innerHTML = '';
    if (marketTab === 'portfolio') renderPortfolio(c);
    else renderMarketList(c);
}

// ============ БИРЖА: ТОРГОВЫЙ ТЕРМИНАЛ ============
// Фильтр рынка: all | portfolio | risers | fallers
let marketFilter = 'all';

// Мини-спарклайн для карточки акции (компактный)
function makeMiniSparkline(hist, up) {
    if (!hist || hist.length < 2) return '';
    const W = 64, H = 26;
    const min = Math.min(...hist), max = Math.max(...hist);
    const range = max - min || 1;
    const pts = hist.map((v, i) => `${((i / (hist.length - 1)) * W).toFixed(1)},${(H - ((v - min) / range) * (H - 4) - 2).toFixed(1)}`).join(' ');
    const color = up ? 'var(--neon-green)' : 'var(--neon-red)';
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="stock-mini-spark"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8" /></svg>`;
}

function renderMarketList(c) {
    const frag = document.createDocumentFragment();

    // ===== Тикер: топ-5 роста и топ-5 падения за неделю =====
    const allStocks = getMarketList();
    const byChange = [...allStocks].sort((a, b) => b.change - a.change);
    const risers = byChange.slice(0, 5).filter(s => s.change > 0.01);
    const fallers = byChange.slice(-5).reverse().filter(s => s.change < -0.01);

    const tickerRow = document.createElement('div');
    tickerRow.className = 'market-ticker-wrap';
    const tickerItems = [
        ...risers.map(s => `<span class="ticker-item up">${s.club} <b>+${s.change.toFixed(1)}%</b></span>`),
        ...fallers.map(s => `<span class="ticker-item down">${s.club} <b>${s.change.toFixed(1)}%</b></span>`)
    ];
    if (tickerItems.length > 0) {
        // Дублируем контент для бесшовной бегущей строки
        const seq = tickerItems.join('<span class="ticker-sep">•</span>');
        tickerRow.innerHTML = `<div class="market-ticker"><div class="ticker-track"><span>${seq}<span class="ticker-sep">•</span></span><span>${seq}<span class="ticker-sep">•</span></span></div></div>`;
    } else {
        tickerRow.innerHTML = `<div class="market-ticker"><div class="ticker-track ticker-static">${LANG.t('Рынок спокоен')}</div></div>`;
    }
    frag.appendChild(tickerRow);

    // ===== Фильтры рынка =====
    const filterRow = document.createElement('div');
    filterRow.className = 'market-filter-row';
    filterRow.innerHTML = `
        <button class="market-filter-btn ${marketFilter==='all'?'active':''}" data-mf="all">${LANG.t('Все акции')}</button>
        <button class="market-filter-btn ${marketFilter==='portfolio'?'active':''}" data-mf="portfolio">💼 ${LANG.t('Мой портфель')}</button>
        <button class="market-filter-btn ${marketFilter==='risers'?'active':''}" data-mf="risers">📈 ${LANG.t('Растущие')}</button>
        <button class="market-filter-btn ${marketFilter==='fallers'?'active':''}" data-mf="fallers">📉 ${LANG.t('Падающие')}</button>`;
    frag.appendChild(filterRow);

    // ===== Сортировка =====
    const sortRow = document.createElement('div');
    sortRow.className = 'market-sort-row';
    sortRow.innerHTML = `
        <label class="market-sort-label" for="market-sort-select">${LANG.t('Сортировка')}</label>
        <select id="market-sort-select" class="market-sort-select">
            <option value="price_asc" ${marketSort === 'price_asc' ? 'selected' : ''}>${LANG.t('Цена ↑')}</option>
            <option value="price_desc" ${marketSort === 'price_desc' ? 'selected' : ''}>${LANG.t('Цена ↓')}</option>
            <option value="prestige" ${marketSort === 'prestige' ? 'selected' : ''}>${LANG.t('Престиж')}</option>
        </select>`;
    frag.appendChild(sortRow);

    // ===== Данные с учётом фильтра =====
    let all = allStocks;
    if (marketFilter === 'portfolio') all = all.filter(s => s.owned > 0);
    else if (marketFilter === 'risers') all = all.filter(s => s.change > 0.01);
    else if (marketFilter === 'fallers') all = all.filter(s => s.change < -0.01);

    const total = all.length;
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageData = sortMarketList(all).slice(start, start + ITEMS_PER_PAGE);

    if (pageData.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = `<div class="empty-icon">📊</div><div class="empty-title">${LANG.t('Нет подходящих акций')}</div>`;
        frag.appendChild(empty);
    }

    pageData.forEach(item => {
        const row = document.createElement('div');
        row.className = 'stock-row terminal-row';
        const cc = item.change > 0.01 ? 'up' : item.change < -0.01 ? 'down' : 'flat';
        const ct = (item.change >= 0 ? '+' : '') + item.change.toFixed(1) + '%';
        const ls = getLeagueName(item.league);
        const fl = LEAGUE_DATA[item.league]?.country.split(' ')[0] || '';
        // История для спарклайна (последние 12 недель)
        const data = clubData[item.key];
        const hist = (data?.stockHistory || []).slice(-12);
        if (hist.length < 12 && data) hist.push(data.stockPrice);
        row.innerHTML = `
            <div class="stock-logo">${getTeamLogoHTML(item.club, item.league)}</div>
            <div class="stock-info">
                <div class="stock-name">${item.club}${item.owned > 0 ? ' <span class="stock-owned-dot">●</span>' : ''}</div>
                <div class="stock-meta">${fl} ${ls} • ⭐ ${item.prestige}</div>
                ${makeMiniSparkline(hist, item.change >= 0)}
            </div>
            <div class="stock-price-col">
                <div class="stock-price">${formatMoney(item.price)}</div>
                <div class="stock-change ${cc}">${ct}</div>
            </div>
        `;
        row.addEventListener('click', () => openStockTradeModal(item.club, item.league));
        frag.appendChild(row);
    });

    c.appendChild(frag);

    // Обработчики фильтров
    c.querySelectorAll('[data-mf]').forEach(b => {
        b.addEventListener('click', () => {
            marketFilter = b.getAttribute('data-mf');
            currentPage = 1;
            renderMarketScreen();
        });
    });

    // Обработчик сортировки
    const sortSelect = c.querySelector('#market-sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            marketSort = sortSelect.value;
            currentPage = 1;
            renderMarketScreen();
        });
    }

    showPagination(total, () => { c.innerHTML = ''; renderMarketList(c); });
}

function renderPortfolio(c) {
    const keys = Object.keys(myPortfolio).filter(k => myPortfolio[k].shares > 0);
    if (keys.length === 0) {
        c.innerHTML = `<div class="empty-state"><div class="empty-icon">💼</div><div class="empty-title">Портфель пуст</div></div>`;
        hidePagination();
        return;
    }
    let tv = 0, ti = 0;
    const items = keys.map(k => {
        const pos = myPortfolio[k];
        const data = clubData[k];
        if (!data) return null;
        const value = Math.round(data.stockPrice * pos.shares);
        const invested = Math.round((pos.avgPrice || data.stockPrice) * pos.shares);
        tv += value; ti += invested;
        const pnl = value - invested;
        const pp = invested > 0 ? (pnl / invested) * 100 : 0;
        return {key: k, club: data.club, league: data.league, shares: pos.shares, value, invested, pnl, pnlPct: pp, president: pos.shares >= 51};
    }).filter(Boolean);

    const sum = document.createElement('div');
    sum.className = 'portfolio-summary';
    const tp = tv - ti;
    const tpp = ti > 0 ? (tp / ti) * 100 : 0;
    const pc = tp >= 0 ? 'up' : 'down';
    sum.innerHTML = `
        <div class="port-sum-title">💼 Стоимость портфеля</div>
        <div class="port-sum-value">${formatMoney(tv)}</div>
        <div class="port-sum-pnl ${pc}">${tp >= 0 ? '+' : ''}${formatMoney(tp)} (${tpp.toFixed(1)}%)</div>
    `;
    c.appendChild(sum);

    items.sort((a, b) => b.value - a.value);
    items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'stock-row';
        const pc2 = item.pnl >= 0 ? 'up' : 'down';
        const fl = LEAGUE_DATA[item.league]?.country.split(' ')[0] || '';
        const ls = LEAGUE_NAMES[item.league] || item.league;
        row.innerHTML = `
            <div class="stock-logo">${getTeamLogoHTML(item.club, item.league)}</div>
            <div class="stock-info">
                <div class="stock-name">${item.president ? '👑 ' : ''}${item.club}</div>
                <div class="stock-meta">${fl} ${ls} • ${item.shares.toFixed(1)}%</div>
            </div>
            <div class="stock-price-col">
                <div class="stock-price">${formatMoney(item.value)}</div>
                <div class="stock-change ${pc2}">${item.pnl >= 0 ? '+' : ''}${item.pnlPct.toFixed(1)}%</div>
            </div>
        `;
        row.addEventListener('click', () => openStockTradeModal(item.club, item.league));
        c.appendChild(row);
    });

    hidePagination();
}

function checkPresidentStatus() {
    if (!presidentClubKey) return false;
    const pos = myPortfolio[presidentClubKey];
    if (!pos || pos.shares < 51) {
        const oldKey = presidentClubKey;
        const oldClub = clubData[oldKey]?.club || 'клуба';
        presidentClubKey = null;
        clubCouncil = null; // v1.0: сброс совета при потере поста
        addNews(`🚪 Вы потеряли пост президента ${oldClub} — акций меньше 51%`, "negative");
        return true;
    }
    return false;
}

function getPresidentBlockHTML(key, owned) {
    if (owned < 51) return '';
    if (presidentClubKey === key) {
        return `<div class="president-badge">👑 ВЫ ПРЕЗИДЕНТ ЭТОГО КЛУБА</div>
                <button class="president-leave-btn" id="btn-leave-president">🚪 Покинуть пост президента</button>`;
    }
    if (presidentClubKey) {
        const otherData = clubData[presidentClubKey];
        const otherName = otherData ? otherData.club : 'другого клуба';
        return `<div class="president-badge-warn">⚠️ Вы уже президент ${otherName}. Сначала покиньте пост.</div>`;
    }
    return '<button class="president-action-btn" id="btn-become-president">🏛️ Стать президентом клуба</button>';
}
function openStockTradeModal(club, lk) {
    const key = getPortfolioKey(club, lk);
    const data = clubData[key];
    if (!data) return;

    // Проверяем статус президента (вдруг акции продали или файл испорчен)
    checkPresidentStatus();
    const modal = document.getElementById('stock-trade-modal');
    const title = document.getElementById('stock-trade-title');
    const body = document.getElementById('stock-trade-body');
    const actions = document.getElementById('stock-trade-actions');
    title.textContent = club;
    const owned = myPortfolio[key]?.shares || 0;
    const price = data.stockPrice;
    const ls = getLeagueName(lk);
    const fl = LEAGUE_DATA[lk]?.country.split(' ')[0] || '';
    const maxBuy = Math.floor(agentMoney / price);
    const maxBuyByLimit = Math.floor((100 - owned) * 10) / 10;
    const sparkline = makeSparkline((data.stockHistory || []).slice(-12));
    const avgPrice = myPortfolio[key]?.avgPrice || 0;

    body.innerHTML = `
        <div class="stock-trade-header">
            <div class="stock-trade-logo">${getTeamLogoHTML(club, lk)}</div>
            <div class="stock-trade-club">${fl} ${club}</div>
            <div class="stock-trade-league">${ls} • ${LANG.t('Престиж')} ${data.prestige}</div>
            <div class="stock-trade-price">${formatMoney(price)} <span class="lbl">/ 1%</span></div>
        </div>
        ${sparkline}
        <div class="stock-trade-chart-lbl">📈 ${LANG.t('Динамика за 12 недель')}: <b>${histRangeStr(data)}</b></div>
        <div class="stock-trade-stats">
            <div class="st-stat"><span class="lbl">В портфеле</span><span class="val">${owned.toFixed(1)}%</span></div>
            <div class="st-stat"><span class="lbl">Ср. цена покупки</span><span class="val">${avgPrice ? formatMoney(avgPrice) : '—'}</span></div>
            <div class="st-stat"><span class="lbl">Ваш баланс</span><span class="val">${formatMoney(agentMoney)}</span></div>
        </div>
                ${getPresidentBlockHTML(key, owned)}
        <div class="stock-trade-input">
            <label class="input-label">Количество %</label>
            <input type="number" id="trade-count" min="0.1" step="0.1" value="1" />
            <div class="quick-buttons">
                <button class="quick-btn" data-q="-10">−10%</button>
                <button class="quick-btn" data-q="+10">+10%</button>
                <button class="quick-btn" data-q="max">MAX</button>
            </div>
            <div class="trade-pl-preview" id="trade-pl-preview"></div>
        </div>
    `;

    const input = body.querySelector('#trade-count');
    const plPreview = body.querySelector('#trade-pl-preview');
    body.querySelectorAll('.quick-btn').forEach(b => {
        b.addEventListener('click', () => {
            const q = b.getAttribute('data-q');
            const cur = parseFloat(input.value) || 0;
            if (q === 'max') input.value = Math.min(maxBuy, maxBuyByLimit).toFixed(1);
            else if (q === '-10') input.value = Math.max(0.1, Math.round((cur * 0.9) * 10) / 10).toFixed(1);
            else if (q === '+10') input.value = Math.min(maxBuyByLimit, Math.round((cur * 1.1) * 10) / 10).toFixed(1);
            updateButtons();
        });
    });

    // Живой пересчёт прибыли/убытка при вводе количества
    function updatePLPreview() {
        if (!plPreview) return;
        const count = parseFloat(input.value) || 0;
        if (count <= 0 || !avgPrice) { plPreview.innerHTML = ''; return; }
        const basis = Math.round(avgPrice * count);
        const now = Math.round(price * count);
        const pnl = now - basis;
        const pct = basis > 0 ? (pnl / basis) * 100 : 0;
        const cls = pnl >= 0 ? 'up' : 'down';
        plPreview.innerHTML = `
            <span class="${cls}">${pnl >= 0 ? '📈 +' : '📉 '}${formatMoney(Math.abs(pnl))} (${pnl >= 0 ? '+' : ''}${pct.toFixed(1)}%)</span>
            <span class="pl-hint">${LANG.t('если продать сейчас')}</span>
        `;
    }

    function updateButtons() {
        const count = parseFloat(input.value) || 0;
        const cost = Math.round(price * count);
        const buyBtn = document.getElementById('btn-stock-buy');
        const sellBtn = document.getElementById('btn-stock-sell');
        if (buyBtn) { buyBtn.textContent = `🛒 ${LANG.t('Купить')} ${count}% ${LANG.t('за')} ${formatMoney(cost)}`; buyBtn.disabled = count <= 0 || cost > agentMoney || count > maxBuyByLimit; }
        if (sellBtn) { sellBtn.textContent = `💸 ${LANG.t('Продать')} ${count}% ${LANG.t('за')} ${formatMoney(Math.round(price * count))}`; sellBtn.disabled = count <= 0 || count > owned; }
        updatePLPreview();
    }
    input.addEventListener('input', updateButtons);

    actions.innerHTML = '';
    const buyBtn = document.createElement('button');
    buyBtn.id = 'btn-stock-buy';
    buyBtn.className = 'btn-success';
    buyBtn.addEventListener('click', () => {
        const count = parseFloat(input.value) || 0;
        if (count <= 0) return;
        const cost = Math.round(price * count);
    if (cost > agentMoney) { uiAlert(LANG.t('Мало денег')); return; }
        const pos = myPortfolio[key] || {shares: 0, avgPrice: 0};
        const ns = pos.shares + count;
        const na = Math.round((pos.avgPrice * pos.shares + price * count) / ns);
        myPortfolio[key] = {shares: ns, avgPrice: na};
        agentMoney -= cost;
        addNews(`🛒 Куплено ${count}% акций ${club}`, "info");
        modal.style.display = 'none';
        updateAllDisplays();
        saveGame();
        renderMarketScreen();
    });

    const sellBtn = document.createElement('button');
    sellBtn.id = 'btn-stock-sell';
    sellBtn.className = 'btn-warning';
    sellBtn.addEventListener('click', () => {
        const count = parseFloat(input.value) || 0;
        if (count <= 0 || count > owned) return;
        const income = Math.round(price * count);
        const pos = myPortfolio[key];
        const ns = pos.shares - count;
        if (ns <= 0.001) delete myPortfolio[key];
        else myPortfolio[key] = {shares: ns, avgPrice: pos.avgPrice};
        agentMoney += income;
        addNews(`💸 Продано ${count}% акций ${club}`, "info");
        modal.style.display = 'none';

        // Проверяем: если продали акции клуба, где были президентом — снимаем статус
        checkPresidentStatus();

        updateAllDisplays();
        saveGame();
        renderMarketScreen();
    });
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn-neutral';
    closeBtn.textContent = LANG.t('Отмена');
    closeBtn.addEventListener('click', () => modal.style.display = 'none');

    actions.appendChild(buyBtn);
    actions.appendChild(sellBtn);
    actions.appendChild(closeBtn);

    const presBtn = body.querySelector('#btn-become-president');
    if (presBtn) {
        presBtn.addEventListener('click', () => {
            presidentClubKey = key;
            const cdata = clubData[key];
            addNews(`🏛️ Вы стали президентом ${cdata.club}!`, "positive");
            saveGame();
            modal.style.display = 'none';
            updateAllDisplays();
            renderMarketScreen();
        });
    }

    const leaveBtn = body.querySelector('#btn-leave-president');
    if (leaveBtn) {
        leaveBtn.addEventListener('click', async () => {
            if (!(await uiConfirm(LANG.t('Покинуть пост президента? Акции останутся у вас.')))) return;
            const cdata = clubData[key];
            presidentClubKey = null;
            clubCouncil = null; // v1.0: сброс совета при потере поста
            addNews(`🚪 Вы покинули пост президента ${cdata.club}`, "info");
            saveGame();
            modal.style.display = 'none';
            updateAllDisplays();
            renderMarketScreen();
        });
    }

    updateButtons();
    modal.style.display = 'flex';
}
function makeSparkline(hist) {
    if (!hist || hist.length < 2) return '';
    const W = 300, H = 60;
    const min = Math.min(...hist), max = Math.max(...hist);
    const range = max - min || 1;
    const pts = hist.map((v, i) => `${((i / (hist.length - 1)) * W).toFixed(1)},${(H - ((v - min) / range) * H).toFixed(1)}`).join(' ');
    const trend = hist[hist.length - 1] >= hist[0];
    const color = trend ? '#00ff88' : '#ff2d55';
    return `<div class="sparkline-wrap"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="sparkline"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" /></svg></div>`;
}

// Строка изменения цены за период графика ("+$12K (+15%)")
function histRangeStr(data) {
    if (!data || !data.stockHistory || data.stockHistory.length < 2) return '—';
    const first = data.stockHistory[0];
    const last = data.stockPrice;
    const diff = last - first;
    const pct = first > 0 ? (diff / first) * 100 : 0;
    return `<span class="${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '+' : ''}${formatMoney(diff)} (${diff >= 0 ? '+' : ''}${pct.toFixed(1)}%)</span>`;
}

// ============ 22. ДРАФТ ============
function runDraft() {
    seasonPhase = 'draft';
    const pool = players.filter(p => p.age >= 19 && p.age <= 21 && p.rating >= 45 && p.rating <= 78 && !['NHL','AHL'].includes(p.league)).slice(0, 64);
    while (pool.length < 64) {
        const y = generateYouthPlayer();
        players.push(y);
        pool.push(y);
    }
    draftData = {active: true, season: currentSeason, pool, picks: []};
    const nhlTeams = standings['NHL'] || [];
    const sortedNHL = [...nhlTeams].sort((a, b) => a.points - b.points);
    for (let r = 1; r <= 2; r++) {
        sortedNHL.forEach((team, i) => {
            const idx = (r - 1) * 32 + i;
            if (idx < pool.length) draftData.picks.push({pick: idx + 1, round: r, nhlClub: team.club, player: pool[idx]});
        });
    }
    draftData.picks.forEach(pk => {
        // Фиксируем реальный пик в карточке игрока
        pk.player.draftInfo = `R${pk.round} Pick ${pk.pick}`;
        pk.player.draftYear = currentSeason;

        const isMine = myRoster.some(c => c.name === pk.player.name);
        if (isMine) {
            const mult = pk.pick <= 5 ? 20 : pk.pick <= 15 ? 15 : pk.pick <= 32 ? 10 : 7;
            addXP(pk.player.rating * mult);
            addNews(`🎯 ${pk.player.name} выбран #${pk.pick} (${pk.nhlClub})!`, "positive");
        }
    });
    setTimeout(() => { startDraftChoices(); }, 100);
}

function generateYouthPlayer(forcedLeague) {
    const lgs = ['MHL','MHL','MHL','VHL','Belarus_Vysshaya','SHL','Liiga','Czech_Extraliga','DEL'];
    // Молодёжь для конкретной лиги (нужно для пополнения NHL/AHL/KHL)
    const ln = (forcedLeague && LEAGUE_DATA[forcedLeague]) ? forcedLeague : randomChoice(lgs);
    const club = forcedLeague ? pickClubForYouth(ln) : randomChoice(getAllClubs(ln));
    const pos = randomChoice(["C","C","LW","LW","RW","RW","D","D","D","G"]);
    let rating, age;
    if (ln === 'NHL') { rating = randomInt(66, 78); age = randomInt(19, 21); }
    else if (ln === 'AHL' || ln === 'KHL') { rating = randomInt(58, 72); age = randomInt(18, 21); }
    else if (['SHL','Liiga','Czech_Extraliga','DEL','NL_Switzerland'].includes(ln)) { rating = randomInt(50, 65); age = randomInt(18, 20); }
    else { rating = randomInt(38, 58); age = randomInt(18, 20); }
    const { name, nationality } = generatePlayerName(ln);
    const player = createPlayer(name, club, ln, pos, age, rating, null, nationality);

    // Скаутинг + Академия клуба (с потолками)
    if (club && clubData[ln + "_" + club]) {
        const cl = clubData[ln + "_" + club];
        if (cl.upgrades) {
            const scoutingBonus = Math.min(12, Math.max(0, getScoutingMinRating(cl.upgrades.scouting || 1) - 40));
            const ratingCap = ln === 'NHL' ? 84 : 72;
            player.rating = Math.min(ratingCap, player.rating + Math.round(scoutingBonus));
            const academyBonus = Math.min(8, getAcademyPotentialBonus(cl.upgrades.academy || 1));
            player.potential = Math.min(92, (player.potential || player.rating + 20) + academyBonus);
            player.attributes = generateAttributes(player.position, player.rating, player.name);
            player.salary = calculateSalary(player.rating, ln);
        }
    }
    return player;
}

function generateFreeAgentYouth() {
    const lgs = ['MHL','MHL','VHL','SHL','Liiga','Czech_Extraliga','DEL','NL_Switzerland','Belarus_Vysshaya'];
    const ln = randomChoice(lgs);
    const pos = randomChoice(["C","C","LW","LW","RW","RW","D","D","D","G"]);
    const rating = randomInt(18, 38);
    const age = randomInt(14, 19);
    const { name, nationality } = generatePlayerName(ln);
    // Создаём как свободного агента: клуб пустой, но лига остаётся для определения страны
    const p = createPlayer(name, '', ln, pos, age, rating, null, nationality);
    p.club = '';
    return p;
}

function startDraftChoices() {
    draftChoiceQueue = [];
    draftData.decidedPicks = draftData.decidedPicks || {};
    draftData.picks.forEach(pk => {
        if (draftData.decidedPicks[pk.pick]) return; // решение уже принято
        const mp = myRoster.find(c => c.name === pk.player.name);
        if (mp) draftChoiceQueue.push({player: mp, pick: pk.pick, nhlClub: pk.nhlClub, farmClub: getFarmClub(pk.nhlClub)});
    });
    // Сначала показываем окно итогов драфта, потом уже разбор клиентов
    showDraftSummary();
}

function showDraftSummary() {
    const modal = document.getElementById('draft-choice-modal');
    const body = document.getElementById('draft-choice-body');
    const actions = document.getElementById('draft-choice-actions');

    // Топ-10 пиков NHL (1-й раунд)
    const topPicks = draftData.picks.filter(pk => pk.round === 1).slice(0, 10);
    const myPicks = draftData.picks.filter(pk => myRoster.some(c => c.name === pk.player.name));

    let html = `
        <div class="draft-summary-header">
            <div class="dsh-icon">🎯</div>
            <div class="dsh-title">${LANG.t('Драфт NHL')} ${draftData.season}</div>
            <div class="dsh-sub">${LANG.t('Всего выбрано')}: ${draftData.picks.length} ${LANG.t('игроков')}</div>
        </div>
    `;

    // Блок с твоими клиентами
    if (myPicks.length > 0) {
        html += `<div class="draft-my-title">⭐ ${LANG.t('Ваши клиенты на драфте')} (${myPicks.length})</div>`; 
        myPicks.forEach(pk => {
            const p = pk.player;
            html += `
                <div class="draft-summary-row draft-summary-my">
                    <div class="dsr-pick">#${pk.pick}</div>
                    <div class="dsr-club">${getTeamLogoHTML(pk.nhlClub, 'NHL')}</div>
                    <div class="dsr-info">
                        <div class="dsr-name">${p.name} ${getPlayerCountry(p)}</div>
                    <div class="dsr-meta">${p.position} • ${p.age} ${LANG.t('лет')} • ${LANG.t('Рейтинг')} ${p.rating}</div>
                    </div>
                </div>
            `;
        });
    } else {
        html += `<div class="draft-empty-msg">😔 ${LANG.t('Ни один из ваших клиентов не попал на этот драфт.')}<br><span class="draft-empty-hint">${LANG.t('Подрастите игроков — и они попадут в следующем сезоне.')}</span></div>`;
    }

    // Топ пиков NHL
    html += `<div class="draft-top-title">🏒 ${LANG.t('Топ-10 пиков NHL')}</div>`;
    html += `<div id="draft-picks-animated">`; // пики добавляются по одному (анимация вскрытия)
    topPicks.forEach(pk => {
        const p = pk.player;
        html += `
            <div class="draft-summary-row draft-pick-hidden" data-pick-row="${pk.pick}">
                <div class="dsr-pick">#${pk.pick}</div>
                <div class="dsr-club">${getTeamLogoHTML(pk.nhlClub, 'NHL')}</div>
                <div class="dsr-info">
                    <div class="dsr-name">${p.name}</div>
                    <div class="dsr-meta">${p.position} • ${LANG.t('Рейтинг')} ${p.rating}</div>
                </div>
            </div>
        `;
    });
    html += `</div>`;

    body.innerHTML = html;

    // ===== Анимация вскрытия: пики появляются по одному каждые 300 мс =====
    const pickRows = body.querySelectorAll('[data-pick-row]');
    pickRows.forEach((row, i) => {
        setTimeout(() => {
            row.classList.remove('draft-pick-hidden');
            row.classList.add('draft-pick-reveal');
        }, 250 + i * 300);
    });

    // ===== БАННЕР №1: клиент выбран под первым пиком =====
    const firstPickMine = draftData.picks.find(pk => pk.pick === 1 && myRoster.some(c => c.name === pk.player.name));
    if (firstPickMine && !draftData.repGranted) {
        // +5 к репутации агента — один раз за драфт
        draftData.repGranted = true;
        upgrades.reputation = Math.min(25, upgrades.reputation + 5);
        addNews(`🏆 ${firstPickMine.player.name} — ${LANG.t('первый пик драфта')}! +5 ${LANG.t('репутации')}`, "positive");
        saveGame();
        setTimeout(() => showFirstPickBanner(firstPickMine), 400);
    }

    actions.innerHTML = '';
    const okBtn = document.createElement('button');
    okBtn.className = 'btn-primary';
    okBtn.textContent = LANG.t('Продолжить');
    okBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        if (draftChoiceQueue.length > 0) {
            showNextDraftChoice();
        } else {
            closeDraftAndStartSeason();
        }
    });
    actions.appendChild(okBtn);
    modal.style.display = 'flex';
}

// Полноэкранный баннер "Первый пик драфта" с анимацией
function showFirstPickBanner(pick) {
    const overlay = document.createElement('div');
    overlay.className = 'first-pick-overlay';
    overlay.innerHTML = `
        <div class="first-pick-banner">
            <div class="fpb-trophy">🏆</div>
            <div class="fpb-title">${LANG.t('ПЕРВЫЙ ПИК ДРАФТА!')}</div>
            <div class="fpb-player">${pick.player.name}</div>
            <div class="fpb-club">${getTeamLogoHTML(pick.nhlClub, 'NHL')} ${pick.nhlClub}</div>
            <div class="fpb-rep">⭐ +5 ${LANG.t('репутации')}</div>
        </div>
    `;
    overlay.addEventListener('click', () => {
        clearTimeout(overlay._timer);
        overlay.remove();
    });
    document.body.appendChild(overlay);
    // Автозакрытие через 4 секунды (таймер привязан к overlay — не течёт)
    overlay._timer = setTimeout(() => overlay.remove(), 4000);
}

function getFarmClub(nhlClub) {
    // Датапак добавляет пары для фейковых названий (NHL → AHL).
    if (typeof window.getFarmClubOverride === 'function') {
        const overridden = window.getFarmClubOverride(nhlClub);
        if (overridden !== undefined) return overridden;
    }
    const pairs = {"Boston Bruins":"Providence Bruins","Buffalo Sabres":"Rochester Americans","Detroit Red Wings":"Grand Rapids Griffins","Florida Panthers":"Charlotte Checkers","Montreal Canadiens":"Laval Rocket","Ottawa Senators":"Belleville Senators","Tampa Bay Lightning":"Syracuse Crunch","Toronto Maple Leafs":"Toronto Marlies","Carolina Hurricanes":"Chicago Wolves","Columbus Blue Jackets":"Cleveland Monsters","New Jersey Devils":"Utica Comets","New York Islanders":"Hamilton Hammers","New York Rangers":"Hartford Wolf Pack","Philadelphia Flyers":"Lehigh Valley Phantoms","Pittsburgh Penguins":"Wilkes-Barre Scranton Penguins","Washington Capitals":"Hershey Bears","Chicago Blackhawks":"Rockford IceHogs","Colorado Avalanche":"Colorado Eagles","Dallas Stars":"Texas Stars","Minnesota Wild":"Iowa Wild","Nashville Predators":"Milwaukee Admirals","St. Louis Blues":"Springfield Thunderbirds","Utah Mammoth":"Tucson Roadrunners","Winnipeg Jets":"Manitoba Moose","Anaheim Ducks":"San Diego Gulls","Calgary Flames":"Calgary Wranglers","Edmonton Oilers":"Bakersfield Condors","Los Angeles Kings":"Ontario Reign","San Jose Sharks":"San Jose Barracuda","Seattle Kraken":"Coachella Valley Firebirds","Vancouver Canucks":"Abbotsford Canucks","Vegas Golden Knights":"Henderson Silver Knights"};
    return pairs[nhlClub] || null;
}

function showNextDraftChoice() {
    if (draftChoiceQueue.length === 0) { document.getElementById('draft-choice-modal').style.display = 'none'; closeDraftAndStartSeason(); return; }
    currentDraftChoice = draftChoiceQueue.shift();
    const p = currentDraftChoice.player;
    const avatar = getPlayerAvatarSVG(p);
    const flag = getPlayerCountry(p);
    document.getElementById('draft-choice-body').innerHTML = `
        <div class="draft-choice-header">
            <div class="draft-choice-avatar">${avatar}</div>
            <div class="draft-choice-name">${p.name} ${flag}</div>
            <div class="draft-choice-pick">#${currentDraftChoice.pick} ${LANG.t('пик')} • ${currentDraftChoice.nhlClub}</div>
        </div>
        <div class="draft-choice-info"><span class="lbl">${LANG.t('Рейтинг')}</span><span class="val">${p.rating}</span></div>
        <div class="draft-choice-info"><span class="lbl">${LANG.t('Позиция')} / ${LANG.t('Возраст')}</span><span class="val">${p.position} • ${p.age} ${LANG.t('лет')}</span></div>
        <div class="draft-choice-info"><span class="lbl">${LANG.t('Текущий клуб')}</span><span class="val">${p.club}</span></div>
        <div class="draft-choice-question">${LANG.t('Куда отправим игрока?')}</div>
    `;
    const actions = document.getElementById('draft-choice-actions');
    actions.innerHTML = '';
    const optStay = document.createElement('button');
    optStay.className = 'draft-choice-option';
    optStay.innerHTML = `<span class="opt-icon">🏠</span><span class="opt-title">${LANG.t('Остаться в')} ${p.club}</span>`;
    optStay.addEventListener('click', () => applyDraftChoice('stay'));
    actions.appendChild(optStay);
    const optNHL = document.createElement('button');
    optNHL.className = 'draft-choice-option';
    optNHL.innerHTML = `<span class="opt-icon">🏒</span><span class="opt-title">${LANG.t('В NHL:')} ${currentDraftChoice.nhlClub}</span>`;
    optNHL.addEventListener('click', () => applyDraftChoice('nhl'));
    actions.appendChild(optNHL);
    if (currentDraftChoice.farmClub) {
        const optAHL = document.createElement('button');
        optAHL.className = 'draft-choice-option';
        optAHL.innerHTML = `<span class="opt-icon">📥</span><span class="opt-title">${LANG.t('В AHL:')} ${currentDraftChoice.farmClub}</span>`;
        optAHL.addEventListener('click', () => applyDraftChoice('ahl'));
        actions.appendChild(optAHL);
    }
    document.getElementById('draft-choice-modal').style.display = 'flex';
}

function applyDraftChoice(choice) {
    if (!currentDraftChoice) return;
    draftData.decidedPicks = draftData.decidedPicks || {};
    if (draftData.decidedPicks[currentDraftChoice.pick]) { showNextDraftChoice(); return; }
    draftData.decidedPicks[currentDraftChoice.pick] = true;
    const p = currentDraftChoice.player;
    if (choice === 'stay') { addNews(`🏠 ${p.name} остался в ${p.club}`, "info"); }
    else if (choice === 'nhl') {
        const oldS = p.salary;
        p.club = currentDraftChoice.nhlClub;
        p.league = 'NHL';
        p.contractYears = randomInt(2, 3);
        p.rating = Math.min(100, p.rating + 5);
        const newS = calculateSalary(p.rating, 'NHL');
        p.salary = newS;
        payTransferCommission(p, oldS, newS);
        addNews(`🏒 ${p.name} перешёл в ${p.club}!`, "positive");
    } else if (choice === 'ahl' && currentDraftChoice.farmClub) {
        const oldS = p.salary;
        p.club = currentDraftChoice.farmClub;
        p.league = 'AHL';
        p.contractYears = randomInt(1, 2);
        const newS = calculateSalary(p.rating, 'AHL');
        p.salary = newS;
        payTransferCommission(p, oldS, newS);
        addNews(`📥 ${p.name} отправлен в ${p.club}`, "info");
    }
    saveGame();
    showNextDraftChoice();
}

function closeDraftAndStartSeason() {
    draftData.active = false;
    // Старт национального турнира (ЧМ каждый год, Олимпиада раз в 4 года)
    if (startNationalTournament()) {
        seasonPhase = 'world_champ';
        transferPhaseWeeksLeft = 0;
        // Не сбрасываем счётчики событий — они пригодятся после турнира
        saveGame();
        updateAllDisplays();
        // Показываем модалку выбора сборной (если ещё не выбрана)
        if (!favoriteNationalTeam) {
            setTimeout(() => showNationalPickModal(), 400);
        }
        return;
    }

    // Если турнир не стартовал (не хватило сборных) — сразу в ТО
    seasonPhase = 'transfer_off';
    transferPhaseWeeksLeft = OFF_TRANSFER_WEEKS;
    generateScoutedPlayers(); // Скауты привозят таланты к началу ТО
    // Сброс счётчиков событий — новый сезон не за горами
    weeklyEventCounter = 0;
    lastEventWeek = 0;
    addNews(`🟢 Большое ТО (${OFF_TRANSFER_WEEKS} нед.)`, "positive");
    processEndOfSeasonContracts();
    awardEndOfSeason();
    myRoster.forEach(p => archiveSeason(p));
    advanceSeasonAges();
    simulateAIUpgrades();
    if (presidentClubKey) careerCounters.seasonsAsPresident = (careerCounters.seasonsAsPresident || 0) + 1;
    // Генерация новых задач совета если президент
    if (presidentClubKey) {
        const club = clubData[presidentClubKey];
        if (club) ensureCouncil();
    }
    resetWorldPlayerStats();
    resetStandingsForNewSeason();
    processRetirements();
    replenishYouth();
    saveGame();
    updateAllDisplays();
}

// Оценивает задачи совета директоров за завершившийся сезон.
// Вызывается один раз — при старте нового сезона (currentSeason уже увеличен).
function evaluateCouncilSeason() {
    if (!presidentClubKey || !clubCouncil) return;
    const club = clubData[presidentClubKey];
    if (!club) return;
    const prev = clubCouncil;
    // Совет должен быть от только что завершившегося сезона
    if (prev.season !== currentSeason - 1) return;

    let doneCount = 0;
    prev.tasks.forEach(t => { if (t.done) doneCount++; });

    if (doneCount === prev.tasks.length) prev.loyalty = Math.min(100, prev.loyalty + 10);
    else if (doneCount >= prev.tasks.length / 2) prev.loyalty = Math.min(100, prev.loyalty + 3);
    else {
        prev.loyalty = Math.max(0, prev.loyalty - 12);
        prev.failsStreak = (prev.failsStreak || 0) + 1;
    }
    if (doneCount === prev.tasks.length) prev.failsStreak = 0;

    if (!prev.history) prev.history = [];
    prev.history.push({ season: prev.season, done: doneCount, total: prev.tasks.length });
    if (prev.history.length > 20) prev.history.shift();

    addNews(`🏛️ Совет директоров: ${doneCount} из ${prev.tasks.length} задач выполнено. Лояльность: ${prev.loyalty}%`,
        doneCount >= prev.tasks.length / 2 ? "positive" : "negative");

    if (prev.failsStreak >= 3) {
        addNews(`🚨 Совет директоров снял вас с поста президента ${club.club}!`, "negative");
        presidentClubKey = null;
        clubCouncil = null;
        return;
    }
    // Сразу формируем задачи на новый сезон (лояльность/история сохраняются)
    if (presidentClubKey) ensureCouncil();
}

function processEndOfSeasonContracts() {
    const becameFreeAgent = new Set();
    myRoster.forEach(p => {
        if (p.club && p.contractYears === 1) {
            p.contractYears = 0;
            p.club = '';
            p.league = '';
            p.salary = 25;
            becameFreeAgent.add(p);
            addNews(`🕊️ ${p.name} стал свободным агентом`, "info");
        } else if (p.contractYears > 0) p.contractYears--;
    });
    // Миру продлеваем контракты, но НЕ тем, кто уже без клуба
    // и не тем, кто только что стал свободным агентом
    players.forEach(p => {
        if (!p.club) return;
        if (becameFreeAgent.has(p)) return;
        if (p.contractYears > 0) p.contractYears--;
        if (p.contractYears <= 0) p.contractYears = randomInt(1, 4);
    });
}

// Старение мира на один сезон.
// ВАЖНО: myRoster хранит ССЫЛКИ на объекты из players, поэтому проход
// должен быть один — иначе клиенты старятся и прокачиваются дважды.
function advanceSeasonAges() {
    const rosterSet = new Set(myRoster);
    players.forEach(p => {
        p.age++;
        if (rosterSet.has(p)) evolvePlayer(p);
        else if (Math.random() < 0.85) evolvePlayer(p);
    });
}

function archiveSeason(p) {
    p.seasonHistory.push({
        season: currentSeason, club: p.club, league: p.league, rating: p.rating, age: p.age,
        position: p.position, salary: p.salary,
        gp: p.stats.gp, goals: p.stats.goals, assists: p.stats.assists,
        pim: p.stats.pim || 0,
        plusMinus: p.stats.plusMinus || 0,
        avgRating: p.stats.gp > 0 ? (p.stats.ratingSum / p.stats.gp).toFixed(1) : "—",
        goalsAgainst: p.stats.goalsAgainst,
        gaa: p.stats.gp > 0 ? (p.stats.goalsAgainst / p.stats.gp).toFixed(2) : "—"
    });
    p.stats = {gp:0,goals:0,assists:0,pim:0,plusMinus:0,ratingSum:0,goalsAgainst:0};
}

// ============ УМНЫЙ EVOLVE: рост зависит от возраста, игровой практики и статистики ============
// Определяет, попал ли игрок в топ-10 лиги по очкам (для "прорывных" сезонов)
function isTop10Scorer(p) {
    if (p.position === 'G' || !p.club || !standings[p.league]) return false;
    const pts = (p.stats ? p.stats.goals + p.stats.assists : 0) +
        (p.seasonHistory && p.seasonHistory.length > 0 ? (p.seasonHistory[p.seasonHistory.length-1].goals || 0) + (p.seasonHistory[p.seasonHistory.length-1].assists || 0) : 0);
    if (pts <= 0) return false;
    const scorers = players
        .filter(x => x.league === p.league && x.position !== 'G' && x.club)
        .map(x => (x.stats ? x.stats.goals + x.stats.assists : 0) +
            (x.seasonHistory && x.seasonHistory.length > 0 ? (x.seasonHistory[x.seasonHistory.length-1].goals || 0) + (x.seasonHistory[x.seasonHistory.length-1].assists || 0) : 0))
        .sort((a, b) => b - a);
    const top10 = scorers[Math.min(9, scorers.length - 1)] || 0;
    return pts >= top10 && top10 > 0;
}

function evolvePlayer(p) {
    // Базовая возрастная дельта (как раньше)
    let delta;
    if (p.age < 22) delta = randomInt(1, 4);
    else if (p.age < 25) delta = randomInt(0, 3);
    else if (p.age < 28) delta = randomInt(0, 2);
    else if (p.age < 30) delta = randomInt(-1, 1);
    else if (p.age < 34) delta = randomInt(-2, 0);
    else delta = randomInt(-3, -1);
    const lm = {NHL:1.5, AHL:1.4, KHL:1.3, SHL:1.2, NL_Switzerland:1.2, Liiga:1.2, Czech_Extraliga:1.1, DEL:1.1, Belarus_Extraliga:1.0, ICE_HL:1.1, VHL:1.0, MHL:0.8, Belarus_Vysshaya:0.8}[p.league] || 1.0;

    // ===== Коэффициент игры (performanceBonus) =====
    // Берем статистику сезона: текущую (до архивации) или из последней записи истории
    const s = p.stats && p.stats.gp > 0 ? p.stats :
        (p.seasonHistory && p.seasonHistory.length > 0 ? {
            gp: p.seasonHistory[p.seasonHistory.length-1].gp || 0,
            goals: p.seasonHistory[p.seasonHistory.length-1].goals || 0,
            assists: p.seasonHistory[p.seasonHistory.length-1].assists || 0
        } : { gp: 0, goals: 0, assists: 0 });
    const pts = s.goals + s.assists;

    let perfBonus = 0;
    if (p.position === 'G') {
        // Вратари: много матчей и низкий GAA — бонус
        const gaa = s.gp > 0 ? s.goalsAgainst / s.gp : 99;
        if (s.gp > 40 && gaa < 2.2) perfBonus = 2;
        else if (s.gp > 30 && gaa < 2.6) perfBonus = 1;
        else if (s.gp < 15) perfBonus = -1;
    } else {
        if (s.gp > 40 && pts > 30) perfBonus = 2;        // выдающийся сезон
        else if (s.gp > 40 && pts > 15) perfBonus = 1;   // хороший сезон
        else if (p.injuryWeeks > 0 || s.gp < 15) perfBonus = -1; // травмы или сидел в запасе
    }

    // Тренировки клуба дают бонус к положительному росту
    let trainingMult = 1.0;
    if (p.club && clubData[p.league + "_" + p.club] && delta + perfBonus > 0) {
        const cl = clubData[p.league + "_" + p.club];
        if (cl.upgrades && cl.upgrades.training) {
            trainingMult = getTrainingGrowthBonus(cl.upgrades.training);
        }
    }

    const totalDelta = Math.round((delta + perfBonus) * lm * trainingMult);

    // ===== Мягкий потолок потенциала =====
    // Обычный рост ограничен potential, но выдающийся сезон (топ-10 лиги по очкам)
    // разрешает "прорыв" на 1-2 очка выше потолка
    const breakout = perfBonus >= 2 && isTop10Scorer(p);
    const ceiling = (p.potential || 100) + (breakout ? 2 : 0);

    p.rating = Math.max(1, Math.min(ceiling, (p.rating || 1) + totalDelta));
    p.attributes = generateAttributes(p.position, p.rating, p.name);
    p.salary = p.club ? calculateSalary(p.rating, p.league) : 25;
    trackYoungMilestones(p);
}

// Отслеживает, до какого рейтинга доросли молодые клиенты (цели ветки «Наставник»).
// Вызывается при каждом изменении рейтинга игрока.
function trackYoungMilestones(p) {
    if (!p || !careerCounters) return;
    if (p.age > 25) return;              // «юниор» — клиент, который ещё молод
    if (!myRoster || myRoster.indexOf(p) < 0) return; // только свои клиенты
    if (!p.youngMilestones || typeof p.youngMilestones !== 'object') p.youngMilestones = {};
    const rating = p.rating || 0;
    [[50, 'youngReached50'], [70, 'youngReached70'], [90, 'youngReached90']].forEach(([th, counter]) => {
        if (rating >= th && !p.youngMilestones[th]) {
            p.youngMilestones[th] = true;
            careerCounters[counter] = (careerCounters[counter] || 0) + 1;
        }
    });
}

function processRetirements() {
    const rosterSet = new Set(myRoster);
    const retirees = [];
    // Один бросок на игрока — иначе клиент мог «умереть» в одном списке и остаться в другом
    players.forEach(p => { if (p.age >= 34 && Math.random() < 0.5) retirees.push(p); });
    const retireSet = new Set(retirees);
    players = players.filter(p => !retireSet.has(p));
    retirees.forEach(p => {
        if (rosterSet.has(p)) {
            addNews(`🏒 ${p.name} завершил карьеру`, "info");
            addXP(p.rating * 3);
        }
    });
    myRoster = myRoster.filter(p => !retireSet.has(p));

    // Чистим ссылки на завершивших карьеру у NPC-агентств,
    // иначе у них копятся «мёртвые» клиенты, и переманивать некого
    const retiredNames = new Set(retirees.map(p => p.name));
    if (retiredNames.size > 0 && typeof npcAgencies !== 'undefined') {
        npcAgencies.forEach(a => {
            if (Array.isArray(a.clientIds)) a.clientIds = a.clientIds.filter(n => !retiredNames.has(n));
        });
    }
    Object.keys(poachedPlayersThisSeason || {}).forEach(n => { if (retiredNames.has(n)) delete poachedPlayersThisSeason[n]; });
}

function replenishYouth() {
    const YPS = {"NHL":8,"AHL":10,"KHL":15,"VHL":20,"MHL":40,"Belarus_Extraliga":10,"Belarus_Vysshaya":15,"SHL":8,"Liiga":8,"Czech_Extraliga":8,"DEL":8,"NL_Switzerland":8,"ICE_HL":5};
    const usedNames = new Set(players.map(p => p && p.name).filter(Boolean));
    let total = 0;
    const TOP_TIER = new Set(['NHL', 'AHL', 'KHL']);
    for (const [lk, cnt] of Object.entries(YPS)) {
        for (let i = 0; i < cnt; i++) {
            // Топ-лиги пополняются напрямую клубами, иначе они деградируют:
            // вся молодёжь уходила в MHL/VHL и не доезжала до NHL/KHL
            if (TOP_TIER.has(lk)) {
                const y = generateYouthPlayer(lk);
                y.name = makeUniqueName(y.name, lk, usedNames);
                players.push(y);
                total++;
                continue;
            }
            const r = Math.random();
            if (r < 0.5 && npcAgencies.length > 0) {
                // Половина идёт к NPC (в клубах)
                const y = generateYouthPlayer(lk);
                y.name = makeUniqueName(y.name, y.league, usedNames);
                const ag = randomChoice(npcAgencies);
                y.agentId = ag.id;
                ag.clientIds.push(y.name);
                players.push(y);
            } else {
                // Половина — свободные агенты без клуба
                const y = generateFreeAgentYouth();
                y.name = makeUniqueName(y.name, y.league, usedNames);
                players.push(y);
            }
            total++;
        }
    }
    rebalanceClubRosters();
    return total;
}

// Клуб с самым коротким составом в лиге — туда идёт молодёжь
function pickClubForYouth(lk) {
    const clubs = getAllClubs(lk);
    if (!clubs || clubs.length === 0) return '';
    const counts = {};
    for (const p of players) {
        if (p.league === lk && p.club) counts[p.club] = (counts[p.club] || 0) + 1;
    }
    let best = clubs[0], bestCount = counts[best] || 0;
    for (const c of clubs) {
        const n = counts[c] || 0;
        if (n < bestCount) { best = c; bestCount = n; }
    }
    return best;
}

// Возвращает уникальное имя: если baseName уже занят — генерирует запасные.
function makeUniqueName(baseName, league, usedSet) {
    let name = baseName;
    for (let attempt = 0; attempt < 12 && usedSet.has(name); attempt++) {
        name = generatePlayerName(league || 'NHL').name;
    }
    if (usedSet.has(name)) name = 'Player ' + (usedSet.size + 1);
    usedSet.add(name);
    return name;
}

// Не даёт клубам «вымирать» после отставок: добивает составы до минимума.
function rebalanceClubRosters(minSize) {
    const MIN = minSize || 16;
    const counts = new Map();
    for (const p of players) {
        if (!p.club || !p.league) continue;
        const k = p.league + '|' + p.club;
        counts.set(k, (counts.get(k) || 0) + 1);
    }
    const usedNames = new Set(players.map(p => p && p.name).filter(Boolean));
    for (const lk of Object.keys(LEAGUE_DATA)) {
        const ld = LEAGUE_DATA[lk];
        if (!ld) continue;
        getAllClubs(lk).forEach(club => {
            const k = lk + '|' + club;
            let have = counts.get(k) || 0;
            while (have < MIN) {
                const pos = randomChoice(["G","D","D","C","C","LW","LW","RW"]);
                const age = (lk === 'MHL' || lk === 'Belarus_Vysshaya') ? randomInt(14, 20) : randomInt(18, 24);
                const base = randomInt(ld.min, ld.max);
                const rating = Math.max(1, Math.min(100, base + randomInt(-8, 2)));
                const g = generatePlayerName(lk);
                const name = makeUniqueName(g.name, lk, usedNames);
                players.push(createPlayer(name, club, lk, pos, age, rating, null, g.nationality));
                have++;
            }
            counts.set(k, have);
        });
    }
}

function awardEndOfSeason() {
    // Записываем финальную позицию каждого клуба за сезон
        // Отмечаем выполненные задачи совета
    if (presidentClubKey && clubCouncil && clubCouncil.clubKey === presidentClubKey) {
        const club = clubData[presidentClubKey];
        if (club) {
            clubCouncil.tasks.forEach(t => {
                if (checkTaskProgress(club, t) === 1) t.done = true;
            });
        }
    }
    for (const lk of Object.keys(standings)) {
        const teams = standings[lk] || [];
        if (teams.length === 0) continue;
        const sorted = [...teams].sort(sortStandingsFn);
        sorted.forEach((t, idx) => {
            const key = lk + "_" + t.club;
            if (!clubSeasonPositions[key]) clubSeasonPositions[key] = [];
            if (!clubSeasonPositions[key].some(s => s.season === currentSeason)) {
                clubSeasonPositions[key].push({ season: currentSeason, place: idx + 1, total: sorted.length, points: t.points || 0 });
            }
            if (clubSeasonPositions[key].length > 20) clubSeasonPositions[key].shift();
        });
    }

    const champs = {};
    for (const lk of Object.keys(standings)) {
        const teams = standings[lk] || [];
        if (teams.length === 0) continue;
        const sorted = [...teams].sort(sortStandingsFn);
        champs[lk] = sorted[0].club;

        // Призовые за регулярку — всем клубам, вне зависимости от твоих клиентов
        if (sorted[0]) {
            const topKey = lk + "_" + sorted[0].club;
            if (clubData[topKey]) {
                const prize = getLeaguePrize(lk, 0.03);
                clubData[topKey].budget += prize;
            }
        }
        for (let i = 1; i < 4 && i < sorted.length; i++) {
            const key = lk + "_" + sorted[i].club;
            if (clubData[key]) {
                const prize = getLeaguePrize(lk, 0.015);
                clubData[key].budget += prize;
            }
        }
    }
    myRoster.forEach(p => {
        if (p.club && champs[p.league] === p.club) {
            if (!p.trophies) p.trophies = [];
            p.trophies.push({name: `${LANG.t('Чемпион')} ${getLeagueName(p.league)}`, season: currentSeason, club: p.club});
            addNews(`🏆 ${p.name} — ${LANG.t('Чемпион').toLowerCase()} ${getLeagueName(p.league)}!`, "positive");
            addXP(500);
        }
    });
    for (const lk of Object.keys(standings)) {
        const lp = players.filter(p => p.league === lk && p.stats && p.stats.gp > 0);
        if (lp.length === 0) continue;
        const scorers = [...lp].sort((a, b) => (b.stats.goals + b.stats.assists) - (a.stats.goals + a.stats.assists));
        if (scorers[0] && (scorers[0].stats.goals + scorers[0].stats.assists) > 0) checkAward(scorers[0], "Лучший бомбардир", lk);
        const snipers = [...lp].sort((a, b) => b.stats.goals - a.stats.goals);
        if (snipers[0] && snipers[0].stats.goals > 0) checkAward(snipers[0], "Лучший снайпер", lk);
    }
}

function checkAward(top, name, lk) {
    const mp = myRoster.find(p => p.name === top.name);
    if (!mp) return;
    if (!mp.awards) mp.awards = [];
    mp.awards.push({name, season: currentSeason, league: lk});
    addNews(`🥇 ${mp.name} — ${name} ${getLeagueName(lk)}!`, "positive");
    addXP(300);
}

// ============ 23. АГЕНТСТВО ============
function showAgencyScreen() {
    hidePagination();
    document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
    const a = document.getElementById('agency-screen');
    if (a) a.style.display = 'flex';
    showBottomNav();
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const nav = document.querySelector('.nav-item[data-nav="agency"]');
    if (nav) nav.classList.add('active');
    renderAgencyScreen();
}

function renderAgencyScreen() {
    const c = document.getElementById('agency-content');
    const ht = document.getElementById('agency-header-title');
    if (ht) ht.textContent = agencyName;
    if (!c) return;
    c.innerHTML = '';
    document.querySelectorAll('#agency-screen .clients-tab').forEach(t => {
        if (t.getAttribute('data-atab') === agencyTab) t.classList.add('active');
        else t.classList.remove('active');
    });
    if (agencyTab === 'upgrade') renderUpgradeTab(c);
    else renderRatingTab(c);
}

document.querySelectorAll('#agency-screen .clients-tab').forEach(tab => {
    tab.addEventListener('click', function () {
        agencyTab = this.getAttribute('data-atab');
        renderAgencyScreen();
    });
});

function renderUpgradeTab(c) {
    const isDebt = agentMoney < 0;
    const profile = document.createElement('div');
    profile.className = 'agency-profile';
    const xp = getXPProgress();
    profile.innerHTML = `
        <div class="ap-avatar">🧑‍💼</div>
        <div class="ap-name">${agentName}</div>
        <div class="ap-agency">${agencyFlag} ${agencyName}</div>
        <div class="ap-xp-text">⚡ ${LANG.t('Уровень')} ${agentLevel} • ${xp.current.toLocaleString()} XP</div>
        <div class="ap-xp-bar"><div class="ap-xp-fill" style="width:${xp.percent}%"></div></div>
        <div class="ap-weekly">📅 ${LANG.t('Расходы')}: <b>${formatMoney(totalWeeklyCost())}${LANG.t('/нед')}</b></div>
        ${isDebt ? '<div class="ap-debt">⚠️ В ДОЛГАХ! Работает только офис</div>' : ''}
    `;
    c.appendChild(profile);
    for (const key of Object.keys(UPGRADE_CARDS)) c.appendChild(buildUpgradeCard(key, isDebt));
}

function buildUpgradeCard(key, isDebt) {
    const card = UPGRADE_CARDS[key];
    const lvl = upgrades[key];
    const isMax = lvl >= 25;
    const cost = isMax ? 0 : upgradeCost(key, lvl);
    const canAfford = !isMax && agentMoney >= cost;
    const disabled = isMax || !canAfford || isDebt;
    const div = document.createElement('div');
    div.className = 'agency-card' + (isMax ? ' maxed' : '');

    let cur = '', nxt = '';
    if (key === 'office') { cur = `${getSlots()} ${LANG.t('слотов')}`; nxt = `${5 + lvl + 1} ${LANG.t('слотов')}`; }
    else if (key === 'scouting') { cur = `${LANG.t('до')} ${getMaxRatingVisible()}`; nxt = `${LANG.t('до')} ${30 + Math.round(lvl * 2.9)}`; }
    else if (key === 'reveal') { 
        const r = getRevealRange(); 
        cur = r === 0 ? 'Точно' : `±${Math.round(r)}`; 
        const nextR = lvl >= 25 ? 0 : Math.round(25 - lvl * 0.85);
        nxt = nextR === 0 ? 'Точно' : `±${Math.round(nextR)}`; 
    }
    else if (key === 'youth') { cur = `${LANG.t('С')} ${getMinAge()} ${LANG.t('лет')}`; nxt = `${LANG.t('С')} ${18 - Math.floor(lvl / 5)} ${LANG.t('лет')}`; }
    else if (key === 'negotiator') { cur = `+${Math.round(getTradeBonus()*100)}%`; nxt = `+${Math.round((lvl*0.03)*100)}%`; }
    else if (key === 'reputation') { cur = `${LANG.t('Отказ')} ${Math.round(getSignRefusalChance()*100)}%`; nxt = `${LANG.t('Отказ')} ${Math.round(Math.max(0, 0.60 - lvl*0.025)*100)}%`; }
    else if (key === 'media') { cur = `×${getMediaMultiplier().toFixed(2)}`; nxt = `×${(1.0 + lvl*0.08).toFixed(2)}`; }
    else if (key === 'trainer') { cur = `${LANG.t('Шанс')} ${Math.round(getTrainerSuccessChance()*100)}%`; nxt = `${LANG.t('Шанс')} ${Math.round(Math.min(95, (50 + lvl*5))*100/100)}%`; }

    const pips = Array.from({length: 25}, (_, i) => `<div class="ac-pip ${i < lvl ? 'filled' : ''}"></div>`).join('');
    div.innerHTML = `
        <div class="ac-header">
            <div class="ac-icon">${card.icon}</div>
            <div class="ac-title-block">
                <div class="ac-title">${LANG.t(card.name)}</div>
                <div class="ac-desc">${LANG.t(card.desc)}</div>
            </div>
            <div class="ac-level">${lvl}<span class="ac-level-max">/25</span></div>
        </div>
        <div class="ac-progress">${pips}</div>
        <div class="ac-effect">
            <div class="ac-effect-row"><span class="ac-effect-lbl">${LANG.t('Сейчас')}</span><span class="ac-effect-val">${cur}</span></div>
            ${!isMax ? `<div class="ac-effect-row next"><span class="ac-effect-lbl">→ ${LANG.t('Будет')}</span><span class="ac-effect-val next-val">${nxt}</span></div>` : ''}
            <div class="ac-effect-row"><span class="ac-effect-lbl">${LANG.t('Расход')}</span><span class="ac-effect-val">${formatMoney(weeklyCostForCard(key))}${LANG.t('/нед')}</span></div>
        </div>
        ${isMax ? `<div class="ac-max-badge">⭐ ${LANG.t('МАКСИМУМ')}</div>` : `<button class="ac-upgrade-btn ${disabled?'disabled':''}" ${disabled?'disabled':''}>⬆ ${LANG.t('Улучшить за')} ${formatMoney(cost)}</button>`}
    `;
    if (!disabled) {
        div.querySelector('.ac-upgrade-btn').addEventListener('click', () => {
            agentMoney -= cost;
            upgrades[key]++;
            addNews(`${card.icon} ${card.name} улучшен до ${upgrades[key]}!`, "positive");
            renderAgencyScreen();
            updateAllDisplays();
            saveGame();
        });
    }
    return div;
}

function renderRatingTab(c) {
    const myCard = document.createElement('div');
    myCard.className = 'rating-my-card';
    myCard.innerHTML = `
        <div class="rmc-label">🏢 МОЁ АГЕНТСТВО</div>
        <div class="rmc-name">${agencyFlag} ${agencyName}</div>
        <div class="rmc-stats">
            <div class="rmc-stat"><span>⭐</span><span>${getMyAgentReputation()}</span></div>
            <div class="rmc-stat"><span>👥</span><span>${myRoster.length}</span></div>
            <div class="rmc-stat"><span>💰</span><span>${formatMoney(agentMoney)}</span></div>
        </div>
    `;
    c.appendChild(myCard);

    if (!window.agencyFilter) window.agencyFilter = 'rep';
    const filterRow = document.createElement('div');
    filterRow.className = 'market-filter-row';
    filterRow.innerHTML = `
        <button class="market-filter-btn ${window.agencyFilter==='rep'?'active':''}" data-af="rep">⭐ Репутация</button>
        <button class="market-filter-btn ${window.agencyFilter==='clients'?'active':''}" data-af="clients">👥 Клиенты</button>
        <button class="market-filter-btn ${window.agencyFilter==='budget'?'active':''}" data-af="budget">💰 Бюджет</button>
    `;
    filterRow.querySelectorAll('.market-filter-btn').forEach(b => {
        b.addEventListener('click', () => { window.agencyFilter = b.getAttribute('data-af'); renderAgencyScreen(); });
    });
    c.appendChild(filterRow);

    const sorted = [...npcAgencies];
    if (window.agencyFilter === 'rep') sorted.sort((a, b) => b.rep - a.rep);
    else if (window.agencyFilter === 'clients') sorted.sort((a, b) => b.clientIds.length - a.clientIds.length);
    else sorted.sort((a, b) => b.budget - a.budget);

    sorted.forEach((ag, idx) => {
        const row = document.createElement('div');
        row.className = 'agency-row';
        const fl = ag.country.split(' ')[0];
        const code = ag.country.split(' ')[1] || '';
        row.innerHTML = `
    <div class="ar-place">#${idx + 1}</div>
    <div class="ar-info">
        <div class="ar-name"><span style="opacity:0.7;">${fl || code}</span> ${ag.name}</div>
                <div class="ar-meta">${ag.description}</div>
            </div>
            <div class="ar-stats">
                <span class="ar-stat">⭐ ${ag.rep}</span>
                <span class="ar-stat">👥 ${ag.clientIds.length}</span>
            </div>
        `;
        row.addEventListener('click', () => openNpcAgency(ag));
        c.appendChild(row);
    });
}

function openNpcAgency(ag) {
    const modal = document.getElementById('npc-agency-modal');
    const title = document.getElementById('npc-agency-title');
    const body = document.getElementById('npc-agency-body');
    const actions = document.getElementById('npc-agency-actions');
    const fl = ag.country.split(' ')[0];
    title.textContent = ag.name;

    const clientPlayers = players.filter(p => p.agentId === ag.id);
    const isClosed = !!closedAgencies[ag.id];
    const attempts = agencyPoachAttempts[ag.id] || 0;
    let html = `
        <div class="npc-agency-header">
            <div class="nah-flag">${fl}</div>
            <div class="nah-name">${ag.name}</div>
            <div class="nah-desc">${ag.description}</div>
            <div class="nah-stats">
                <div class="nah-stat"><span>⭐</span><span>${ag.rep}</span></div>
                <div class="nah-stat"><span>👥</span><span>${clientPlayers.length}</span></div>
                <div class="nah-stat"><span>💰</span><span>${formatMoney(ag.budget)}</span></div>
            </div>
        </div>
        ${isClosed
            ? '<div class="npc-agency-warning danger">🚨 Агентство закрыло доступ к своим клиентам до конца сезона</div>'
            : (attempts > 0 ? `<div class="npc-agency-warning yellow">⚠️ Попыток переманить: ${attempts}/3</div>` : '')}
        <div class="npc-clients-title">👥 Клиенты (${clientPlayers.length})</div>
    `;
    if (clientPlayers.length === 0) html += '<div class="empty-state-small">Нет клиентов</div>';
    else {
        const top = [...clientPlayers].sort((a, b) => b.rating - a.rating).slice(0, 30);
        top.forEach(p => {
            const can = !poachedPlayersThisSeason[p.name] && !isClosed;
            html += `
                <div class="npc-client-row ${!can ? 'locked' : ''}" data-pname="${p.name}">
                    <div class="ncr-avatar">${getPlayerAvatarSVG(p)}</div>
                    <div class="ncr-info">
                        <div class="ncr-name">${p.name} ${getPlayerCountry(p)}</div>
                        <div class="ncr-meta">${p.age} лет • ${p.club}</div>
                    </div>
                    <div class="ncr-rating">${p.rating}</div>
                    ${can ? '<div class="ncr-action">→</div>' : '<div class="ncr-lock">🔒</div>'}
                </div>
            `;
        });
    }
    body.innerHTML = html;
    actions.innerHTML = '';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn-neutral';
    closeBtn.textContent = LANG.t('Закрыть');
    closeBtn.addEventListener('click', () => modal.style.display = 'none');
    actions.appendChild(closeBtn);

    body.querySelectorAll('.npc-client-row').forEach(row => {
        const pName = row.getAttribute('data-pname');
        const p = clientPlayers.find(x => x.name === pName);
        if (!p || poachedPlayersThisSeason[p.name] || isClosed) return;
        row.addEventListener('click', () => { modal.style.display = 'none'; openPoachDialog(p, ag); });
    });
    modal.style.display = 'flex';
}

// ============ 24. ДИАЛОГ ПЕРЕМАНИВАНИЯ ============
const CHARACTERS = {
    ambitious: { name: '🚀 Амбициозный', correct: ['nhl', 'star', 'media'], wrong: ['friend', 'loyal'] },
    calm: { name: '😌 Спокойный', correct: ['stability', 'never_leave'], wrong: ['star', 'whim'] },
    pragmatic: { name: '💼 Прагматик', correct: ['numbers', 'money', 'percent'], wrong: ['friend', 'ambition'] },
    capricious: { name: '🎭 Капризный', correct: ['only_you', 'personal'], wrong: ['loyal', 'nhl'] },
    loyal: { name: '🐺 Лояльный', correct: ['friend', 'truth'], wrong: ['money', 'ambition'] }
};

const POACH_REPLIES = {
    nhl: '«Пойдём ко мне — выведу в NHL»',
    star: '«Ты будешь звездой, братан!»',
    media: '«Дам медийную поддержку»',
    stability: '«Гарантирую стабильность и покой»',
    never_leave: '«Никогда не брошу — слово агента»',
    numbers: '«Покажу цифры и проценты»',
    money: '«Предлагаю $50K подъёмных»',
    percent: '«У меня лучшие проценты в отрасли»',
    only_you: '«Ты будешь моим единственным клиентом»',
    personal: '«Личное внимание 24/7»',
    friend: '«Я не агент — я друг»',
    truth: '«Покажу, как тебя тормозит твой агент»',
    whim: '«Даю слово — будешь доволен»'
};

const SUCCESS_PHRASES = {
    ambitious: ['Да! Я хочу в NHL. Погнали!', 'Круто. Только не подведи.', 'Наконец-то кто-то серьёзный.'],
    calm: ['Хм... окей. Может, ты прав.', 'Я подумаю. Но ты мне нравишься.', 'Ладно, попробуем.'],
    pragmatic: ['Сколько? Покажи цифры.', 'Если условия лучше — я согласен.', 'Давай обсудим проценты.'],
    capricious: ['Ооо, ты мне нравишься! Погнали!', 'Скучно с ними, давай с тобой!', 'Ок, но я могу передумать.'],
    loyal: ['...ладно. Но знай: я предаю друга.', 'Он меня вырастил. Но ты прав.', 'Прости меня, старый друг.']
};

const FAIL_PHRASES = {
    ambitious: ['Ты? Не смеши.', 'Мне нужен агент уровня, а не новичок.', 'Я жду предложения от топов.'],
    calm: ['Мне и так хорошо. Не хочу менять.', 'Спасибо, но нет.', 'Я ценю стабильность.'],
    pragmatic: ['Мало денег предлагаешь.', 'Твой бюджет видно за версту.', 'Ставка должна быть выше.'],
    capricious: ['Не-не-не. Не сегодня.', 'Фу, нет.', 'Не хочу. Отстань.'],
    loyal: ['Он мой друг. Я не уйду.', 'Мы вместе с самого начала.', 'Никогда. Даже за миллион.']
};

function openPoachDialog(player, npcAgency) {
    const modal = document.getElementById('poach-dialog-modal');
    const body = document.getElementById('poach-dialog-body');
    const actions = document.getElementById('poach-dialog-actions');
    const country = getPlayerCountry(player);
    const agencyFlag = npcAgency.country.split(' ')[0];

    const isTruth = Math.random() < 0.8;
    const rumorKeys = ['ambitious', 'calm', 'pragmatic', 'capricious', 'loyal'];
    const rumorChar = isTruth ? player.character : randomChoice(rumorKeys.filter(r => r !== player.character));
    const rumorMap = {ambitious:'очень амбициозный парень', calm:'спокойный и ценит стабильность', pragmatic:'прагматик до мозга костей', capricious:'характер у него — не сахар', loyal:'очень верный своему агенту'};
    const rumorText = LANG.t(rumorMap[rumorChar] || 'ничего не слышно');

    const revealRange = getRevealRange();
    let potHTML = '???';
    // Точный потенциал виден только при максимальном скаутинге (range === 0),
    // иначе конкурент не раскрывает данные игрока
    if (revealRange === 0) potHTML = `${player.potential}`;

    body.innerHTML = `
        <div class="pd-player-card">
            <div class="pd-avatar">${getPlayerAvatarSVG(player)}</div>
            <div class="pd-name">${player.name} ${country}</div>
            <div class="pd-meta">${player.age} ${LANG.t('лет')} • ${player.position}</div>
            <div class="pd-stats">
                <div class="pd-stat"><span>⭐ ${LANG.t('Рейтинг')}</span><b>${player.rating}</b></div>
                <div class="pd-stat"><span>🎯 ${LANG.t('Потенциал')}</span><b>${potHTML}</b></div>
            </div>
            <div class="pd-current-agent">${agencyFlag} ${npcAgency.name} (⭐ ${npcAgency.rep})</div>
        </div>
        <div class="pd-rumor">💬 ${LANG.t('Слухи')}: ${rumorText}</div>
        <div class="pd-dialog-title">🗣 ${LANG.t('Ты обращаешься к игроку')}:</div>
        <div class="pd-replies" id="pd-replies"></div>
    `;
    actions.innerHTML = '';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn-neutral';
    closeBtn.textContent = LANG.t('Отмена');
    closeBtn.addEventListener('click', () => modal.style.display = 'none');
    actions.appendChild(closeBtn);

    const pool = [];
    const charData = CHARACTERS[player.character];
    Object.keys(POACH_REPLIES).forEach(k => {
        let type = 'neutral';
        if (charData.correct.includes(k)) type = 'correct';
        else if (charData.wrong.includes(k)) type = 'wrong';
        pool.push({key: k, text: LANG.t(POACH_REPLIES[k]), type});
    });
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const cont = document.getElementById('pd-replies');
    pool.slice(0, 6).forEach(r => {
        const btn = document.createElement('button');
        btn.className = 'pd-reply-btn';
        btn.textContent = r.text;
        btn.addEventListener('click', () => resolvePoach(player, npcAgency, r));
        cont.appendChild(btn);
    });
    modal.style.display = 'flex';
}

function resolvePoach(player, npcAgency, reply) {
    const modal = document.getElementById('poach-dialog-modal');
    const body = document.getElementById('poach-dialog-body');

    // ОДНА ПОПЫТКА ЗА СЕЗОН — помечаем сразу, чтобы нельзя было долбить одного и того же
    poachedPlayersThisSeason[player.name] = true;
    
    // СЧЁТЧИК ПОПЫТОК ПО АГЕНТСТВУ
    if (!agencyPoachAttempts[npcAgency.id]) agencyPoachAttempts[npcAgency.id] = 0;
    agencyPoachAttempts[npcAgency.id]++;
    const attemptsNow = agencyPoachAttempts[npcAgency.id];
    if (attemptsNow >= 3 && !closedAgencies[npcAgency.id]) {
        closedAgencies[npcAgency.id] = true;
        addNews(`🚨 ${npcAgency.name} закрыло доступ к своим игрокам до конца сезона!`, "negative");
    }

    const myRep = upgrades.reputation * 3;
    const diff = myRep - npcAgency.rep;
    let chance = 5 + diff * 0.7;
    chance *= (1 - (player.loyalty || 50) / 200);
    if (player.age <= 18) chance *= 1.2;
    else if (player.age <= 24) chance *= 1.0;
    else if (player.age <= 27) chance *= 0.9;
    else chance *= 0.8;
    chance *= (1 - npcAgency.rep / 200);

    if (reply.type === 'correct') chance += 30;
    else if (reply.type === 'wrong') chance -= 20;
    if (player.character === 'capricious' && Math.random() < 0.3) chance += randomInt(-15, 15);

    // ЖЁСТКИЙ ПОТОЛОК: против сильного агентства шансов почти нет
    const rawDiff = myRep - npcAgency.rep;
    let minChance = 0;
    let maxChance = 15;

    if (rawDiff <= -70) { minChance = 0; maxChance = 3; }    // топ-агентство почти недосягаемо
    else if (rawDiff <= -50) { minChance = 0; maxChance = 8; }
    else if (rawDiff <= -30) { minChance = 0; maxChance = 18; }
    else if (rawDiff <= -15) { minChance = 1; maxChance = 30; }
    else if (rawDiff <= 0) { minChance = 3; maxChance = 45; }
    else if (rawDiff <= 15) { minChance = 6; maxChance = 60; }
    else { minChance = 10; maxChance = 75; }

    chance = Math.max(minChance, Math.min(maxChance, chance));
    let success = Math.random() * 100 < chance;

    // СТРАХОВКА: если у топ-агентства репутация на 40+ выше твоей — никогда не переманить
    if (npcAgency.rep - myRep >= 40) success = false;

    // СТРАХОВКА 2: игроки рейтингом 80+ к нулевой репутации не идут
    if (player.rating >= 80 && myRep < 30) success = false;

    if (success) {
        player.agentId = -1;
        myRoster.push(player);
        incrementClientsSigned();
        careerCounters.poachSuccess = (careerCounters.poachSuccess || 0) + 1;
        if (npcAgency.rep >= 85) careerCounters.poachTopSuccess = (careerCounters.poachTopSuccess || 0) + 1;
        const phrases = SUCCESS_PHRASES[player.character] || SUCCESS_PHRASES.calm;
        body.innerHTML = `<div class="pd-result success"><div class="pd-result-icon">✅</div><div class="pd-player-line">${player.name}</div><div class="pd-phrase">${LANG.t(randomChoice(phrases))}</div><div class="pd-result-text">${LANG.t('Игрок стал твоим клиентом!')}</div></div>`;
        addNews(`🎉 Вы переманили ${player.name}!`, "positive");
        addXP(player.rating * 5);
        updateAllDisplays();
        saveGame();
    } else {
        careerCounters.poachFails = (careerCounters.poachFails || 0) + 1;
        const phrases = FAIL_PHRASES[player.character] || FAIL_PHRASES.calm;
        body.innerHTML = `<div class="pd-result fail"><div class="pd-result-icon">❌</div><div class="pd-player-line">${player.name}</div><div class="pd-phrase">${LANG.t(randomChoice(phrases))}</div><div class="pd-result-text">${LANG.t('До конца сезона к нему не подойти')}</div></div>`;
        addNews(`❌ Не удалось переманить ${player.name}`, "negative");
        saveGame();
    }

    const actions = document.getElementById('poach-dialog-actions');
    actions.innerHTML = '';
    const okBtn = document.createElement('button');
    okBtn.className = 'btn-neutral';
    okBtn.textContent = 'OK';
    okBtn.addEventListener('click', () => { modal.style.display = 'none'; renderAgencyScreen(); });
    actions.appendChild(okBtn);
}

// ============ 25. ИГРА НЕДЕЛИ ============
btnPlayWeek.addEventListener('click', function () {
    // Защита от double-click: неделя/раунд не должны прокручиваться дважды
    if (window._playWeekLock) return;
    window._playWeekLock = true;
    setTimeout(() => { window._playWeekLock = false; }, 600);

if (myRoster.length === 0 && seasonPhase === 'regular') { uiAlert(LANG.t('Нет клиентов!')); return; }
    if (seasonPhase === 'regular') { tickTransferOffers(); playRegularWeek(); }
    else if (seasonPhase === 'transfer_mid' || seasonPhase === 'transfer_off') { tickTransferOffers(); playTransferWeek(); }
    else if (seasonPhase === 'playoffs') simulatePlayoffRound();
    else if (seasonPhase === 'world_champ') playTournamentWeek();
    else if (seasonPhase === 'draft') {
        // v1.0: если фаза драфта "залипла" (модалка итогов была закрыта мимо кнопки) —
        // повторное нажатие "Играть неделю" продолжает разбор пиков или стартует новый сезон
        if (draftData && draftData.picks && draftData.picks.length > 0) {
            startDraftChoices();
        } else {
            runDraft();
        }
    }
    updateAllDisplays();
    saveGame();
});

function playTournamentWeek() {
    if (!nationalTournament) {
        finishTournament();
        return;
    }
    simulateTournamentWeek();
    const t = nationalTournament;
    if (!t) return;

    // Собираем матчи выбранной сборной за прошедшую неделю
    const pending = (t._pendingMatches || []).slice();
    t._pendingMatches = [];

    const proceedAfterMatches = () => {
        if (!nationalTournament) return;
        if (nationalTournament.phase === 'playoff_ready') {
            startNationalPlayoff();
        } else if (nationalTournament.phase === 'finished') {
            finishTournament();
        }
    };

    if (pending.length > 0) {
        const queue = pending.map(m => ({
            match: buildNationalMatchForView(m.homeTeam, m.awayTeam, m.res),
            lk: t.name + ' ' + t.year
        }));
        setTimeout(() => openMatchQueueFromData(queue, proceedAfterMatches), 350);
        return;
    }

    proceedAfterMatches();
}

function finishTournament() {
    if (nationalTournament) {
        const _t = nationalTournament;
        addNews(`🏆 ${_t.name} ${_t.year} завершён.`, "info");
        nationalTournamentHistory.unshift({
            type: _t.type,
            year: _t.year,
            champion: _t.champion ? { name: _t.champion.name, code: _t.champion.code, flag: _t.champion.flag } : null,
            runnerUp: _t.runnerUp ? { name: _t.runnerUp.name, code: _t.runnerUp.code, flag: _t.runnerUp.flag } : null,
            bronze: _t.bronze ? { name: _t.bronze.name, code: _t.bronze.code, flag: _t.bronze.flag } : null
        });
        if (nationalTournamentHistory.length > 20) nationalTournamentHistory.pop();
    }

    nationalTournament = null;
    // Переход в большое ТО
    seasonPhase = 'transfer_off';
    transferPhaseWeeksLeft = OFF_TRANSFER_WEEKS;
    generateScoutedPlayers(); // Скауты привозят таланты к началу ТО
    // Выполняем оставшиеся действия конца сезона
    processEndOfSeasonContracts();
    awardEndOfSeason();
    myRoster.forEach(p => archiveSeason(p));
    advanceSeasonAges();
    simulateAIUpgrades();
    if (presidentClubKey) careerCounters.seasonsAsPresident = (careerCounters.seasonsAsPresident || 0) + 1;
    resetWorldPlayerStats();
    resetStandingsForNewSeason();
    processRetirements();
    replenishYouth();
    addNews(`🟢 Большое ТО (${OFF_TRANSFER_WEEKS} нед.)`, "positive");
    saveGame();
    updateAllDisplays();
}

function getWealthTax() {
    // Налог на богатство: 0.4%/нед от суммы свыше $250K
    // На высоких уровнях порог поднимается — можно копить больше
    const threshold = 250000 + (agentLevel - 1) * 100000;
    if (agentMoney <= threshold) return 0;
    const over = agentMoney - threshold;
    return Math.round(over * 0.004);
}

function playRegularWeek() {
    const playedWeek = currentWeek;
    
    // Расходы агентства
    const weekly = totalWeeklyCost();
    if (agentMoney >= 0) agentMoney -= weekly;
    else agentMoney -= weeklyCostForCard('office');

    // Налог на богатство (в офис-тратах)
    const tax = getWealthTax();
    if (tax > 0) {
        agentMoney -= tax;
        // Логируем не каждую неделю, чтобы не спамить
        if (currentWeek % 4 === 0) addNews(`🏦 Налог на активы: −$${tax.toLocaleString()}`, "info");
    }

    // Доходы
    agentMoney += calculatePassiveIncome();

    // Симуляция
    myRoster.forEach(p => simulateWeekForPlayer(p));
    processWeeklyTrainings(); // тик индивидуальных тренировок
    // Живой мир: AI-трансферы раз в месяц в регулярке
    if (currentWeek % 4 === 0) simulateAITransfers();
    simulateStandingsWeek();
    if (worldCupState) {
        if (worldCupState.phase === 'regular' && worldCupState.currentWeek <= WC_REGULAR_WEEKS) {
            simulateWorldCupRegularWeek();
        } else if (worldCupState.phase === 'playoff_ready' || worldCupState.phase === 'playoff') {
            simulateWorldCupPlayoffRound();
        }
    }
    simulateClubActions();
    updateAllStockPrices();
    calculateDividends();

    // Комиссии
    activeCommissions.forEach(c => {
        if (c.weeksLeft > 0) { agentMoney += c.weeklyAmount; c.weeksLeft--; }
    });
    activeCommissions = activeCommissions.filter(c => c.weeksLeft > 0);

    generateRandomNews();

    if (currentWeek === 18) {
        seasonPhase = 'transfer_mid';
        transferPhaseWeeksLeft = MID_TRANSFER_WEEKS;
        generateScoutedPlayers(); // Скауты привозят таланты к началу ТО
        addNews(`🟢 Малое ТО (${MID_TRANSFER_WEEKS} нед.)`, "positive");
    } else if (currentWeek === 52) {
        startPlayoffs();
    } else {
        currentWeek++;
    }

    // NPC-кулдаун тикает КАЖДУЮ неделю (а не только при удачном 8%-броске)
    if (npcCooldownWeeks > 0) npcCooldownWeeks--;
    // Событие NPC
    if (Math.random() < 0.08) tryNpcPoaching();

    // Проверка активных задач
    checkActiveTasks();

    // Проверка активных цепочек (вне очереди)
    if (!checkChains()) {
        // Недельное событие (только если цепочка не сработала)
        tryWeeklyEvent();
    }

    // Случайный старт новой цепочки (8% шанс в неделю, если нет активных)
    if (activeChains.length === 0 && Math.random() < 0.08) {
        const chainPool = [
            'bad_press_chain', 'rival_war',
            'doping_chain', 'home_return_chain', 'coach_conflict_chain',
            'crypto_scheme_chain', 'youth_growth_chain', 'philanthropy_chain',
            'personal_crisis_chain', 'career_turn_chain', 'business_empire_chain',
            'national_team_chain', 'media_mogul_chain'
        ];
        const pick = chainPool[Math.floor(Math.random() * chainPool.length)];
        if (!activeChains.some(c => c.chainId === pick)) {
            triggerChainStart(pick);
        }
    }

    // Продление в конце сезона
    if (currentWeek >= RENEWAL_WEEKS_START && currentWeek <= RENEWAL_WEEKS_END) {
        if (Math.random() < 0.25) tryContractRenewal();
    }

    // Если президент — показать матчи его клуба после симуляции
    if (presidentClubKey) {
        const club = clubData[presidentClubKey];
        if (club) {
            const myMatches = (seasonSchedule[club.league] || []).filter(m => 
                m.week === playedWeek && 
                m.result &&
                (m.home === club.club || m.away === club.club) && 
                !m.viewed
            );
            if (myMatches.length > 0) {
                setTimeout(() => openMatchQueue(myMatches, club.league), 400);
            }
        }
    }
}

function playTransferWeek() {
    transferPhaseWeeksLeft--;
    addNews(`🔄 ${LANG.t('Неделя ТО')}: ${LANG.t('осталось')} ${transferPhaseWeeksLeft}`, "info");

    // ===== ФИНАНСЫ: работают и в ТО, а не только в regular =====
    const weekly = totalWeeklyCost();
    if (agentMoney >= 0) agentMoney -= weekly;
    else agentMoney -= weeklyCostForCard('office');

    const tax = getWealthTax();
    if (tax > 0) agentMoney -= tax;

    agentMoney += calculatePassiveIncome();
    calculateDividends();

    // Комиссии с прошлых трансферов
    activeCommissions.forEach(c => {
        if (c.weeksLeft > 0) { agentMoney += c.weeklyAmount; c.weeksLeft--; }
    });
    activeCommissions = activeCommissions.filter(c => c.weeksLeft > 0);

    processWeeklyTrainings(); // тик индивидуальных тренировок (работает и в ТО)

    // Пассивный канал — клубы приходят (каждые 2-ю неделю ТО, 0–5 клубов за раз)
    if (transferPhaseWeeksLeft % 2 === 0 && Math.random() < 0.15) tryPassiveTransferOffer();
    simulateAITransfers(); // Живой мир: AI-клубы обмениваются игроками
    processPendingClubReturns();
    // NPC-кулдаун тикает и в ТО тоже
    if (npcCooldownWeeks > 0) npcCooldownWeeks--;
    // NPC-события
    if (Math.random() < 0.08) tryNpcPoaching();

    // Проверка задач и событие
    checkActiveTasks();
    if (!checkChains()) {
        tryWeeklyEvent();
    }

    if (transferPhaseWeeksLeft <= 0) {
        if (seasonPhase === 'transfer_mid') {
            seasonPhase = 'regular';
            currentWeek = 19;
            addNews('🔴 ' + LANG.t('Малое ТО закрыто. Сезон продолжается'), "info");
        } else if (seasonPhase === 'transfer_off') {
            currentSeason++;
            currentWeek = 1;
            seasonPhase = 'regular';
            resetStandingsForNewSeason();
            resetWorldPlayerStats();
            poachedPlayersThisSeason = {};
            agencyPoachAttempts = {};
            closedAgencies = {};
            lostPlayerThisSeason = false; // новый сезон — NPC снова могут переманивать
            npcCooldownWeeks = 0;
            // Оцениваем задачи совета за завершившийся сезон
            evaluateCouncilSeason();
            // Запускаем Кубок Чемпионов нового сезона с обновлёнными слотами
            resetWorldCupForNewSeason();

            // ===== СБРОС СЧЁТЧИКОВ СОБЫТИЙ НА НОВЫЙ СЕЗОН =====
            weeklyEventCounter = 0;
            lastEventWeek = 0;
            // Чистим старые кулдауны (старше 2 сезонов), чтобы не раздувать сейв
            const nowKeyClean = currentSeason * 100 + currentWeek;
            Object.keys(eventCooldowns).forEach(k => {
                if (eventCooldowns[k] < nowKeyClean - 200) delete eventCooldowns[k];
            });
            // ===== КОНЕЦ СБРОСА =====

            // Новое ТО — старые предложения клубов недействительны
            playerNegotiations = {};

            generateAllSchedules();
            addNews(`🏆 ${LANG.t('Начинается сезон')} ${currentSeason}/${currentSeason + 1}!`, "positive");
        }
    }
}

function getTeamBonusForPM(player) {
    if (!player.club || !standings[player.league]) return 0;
    const arr = standings[player.league];
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort(sortStandingsFn);
    const idx = sorted.findIndex(t => t.club === player.club);
    if (idx === -1) return 0;
    const pct = idx / sorted.length;
    if (pct < 0.2) return 2;
    if (pct < 0.4) return 1;
    if (pct < 0.6) return 0;
    if (pct < 0.8) return -1;
    return -2;
}

function simulateWeekForPlayer(p) {
    if (!p.club) {
        p.form = Math.max(-3, (p.form || 0) - 1);
        return;
    }
    const teamBonusPM = getTeamBonusForPM(p);
    if (p.injuryWeeks > 0) { p.injuryWeeks--; if (p.injuryWeeks === 0) addNews(`${p.name} восстановился!`, "positive"); return; }
    // Медцентр влияет на шанс травмы и срок восстановления
    let injuryChance = 0.05;
    let maxInjuryWeeks = 8;
    if (p.club && clubData[p.league + "_" + p.club]) {
        const cl = clubData[p.league + "_" + p.club];
        if (cl.upgrades && cl.upgrades.medical) {
            const reduction = getMedicalInjuryReduction(cl.upgrades.medical);
            injuryChance *= (1 - reduction);
            const recBonus = getMedicalRecoveryWeeks(cl.upgrades.medical);
            maxInjuryWeeks = Math.max(2, maxInjuryWeeks - recBonus * 2);
        }
    }
    if (Math.random() < injuryChance) {
        p.injuryWeeks = randomInt(1, maxInjuryWeeks);
        addNews(`${p.name} травма (${p.injuryWeeks} нед.)`, "negative");
        return;
    }
    const power = Math.max(0.4, Math.min(1.0, (p.rating + p.form * 3) / 100));
    const games = randomInt(1, 2);
    p.stats.gp += games;
    for (let i = 0; i < games; i++) {
        let gr = 5 + power * 4 + (Math.random() - 0.5);
        gr = Math.max(4, Math.min(10, gr));
        p.stats.ratingSum += gr;
        if (p.position === 'G') {
            const gaReduction = Math.max(0, teamBonusPM);
            const ga = Math.max(0, Math.round(randomInt(0, 5) - power * 2.5 - gaReduction * 0.5));
            p.stats.goalsAgainst += ga;
            p.stats.pim += randomInt(0, 2);
            // В реальном хоккее вратарям +/- не считают. Оставляем plusMinus = 0.
        } else if (p.position === 'D') {
            const atkBoost = teamBonusPM * 0.03;
            if (Math.random() < power * (0.15 + atkBoost)) p.stats.goals++;
            if (Math.random() < power * (0.35 + atkBoost)) p.stats.assists++;
            p.stats.pim += randomInt(0, 4);
            p.stats.plusMinus += Math.max(-3, Math.min(3, randomInt(-2, 2) + teamBonusPM));
        } else {
            const atkBoost = teamBonusPM * 0.05;
            if (Math.random() < power * (0.5 + atkBoost)) p.stats.goals++;
            if (Math.random() < power * (0.6 + atkBoost)) p.stats.assists++;
            p.stats.pim += randomInt(0, 2);
            p.stats.plusMinus += Math.max(-3, Math.min(3, randomInt(-1, 2) + teamBonusPM));
        }
    }
    p.form = randomInt(-1, 1);
    // Лояльность медленно падает от рутины, но восстанавливается у успешных клиентов
    // (иначе NPC-переманивание становится неизбежным на длинной дистанции)
    const loyaltyDrift = randomInt(-2, 1);
    let loyaltyDelta = loyaltyDrift;
    if (loyaltyDrift >= 0 || p.loyalty < 50) {
        // хорошая форма/результативность даёт небольшой плюс
        const points = (p.stats && p.stats.goals ? p.stats.goals : 0) + (p.stats && p.stats.assists ? p.stats.assists : 0);
        if (points > 40) loyaltyDelta += 1;
    }
    p.loyalty = Math.max(0, Math.min(100, p.loyalty + loyaltyDelta));

    // Лояльность клубу: медленно растёт если игрок стабильно играет
    if (p.club && p.clubLoyalty !== undefined) {
        const club = clubData[p.league + "_" + p.club];
        if (club) {
            const standingsArr = standings[p.league] || [];
            const myTeam = standingsArr.find(t => t.club === p.club);
            const totalTeams = standingsArr.length;
            const myPlace = standingsArr.slice().sort(sortStandingsFn).findIndex(t => t.club === p.club);
            if (myTeam && totalTeams > 0) {
                const positionPct = myPlace / totalTeams;
                if (positionPct < 0.5) {
                    p.clubLoyalty = Math.min(100, (p.clubLoyalty || 0) + randomInt(0, 2));
                } else if (positionPct > 0.75) {
                    p.clubLoyalty = Math.max(0, (p.clubLoyalty || 0) - randomInt(0, 2));
                } else {
                    p.clubLoyalty = Math.min(100, (p.clubLoyalty || 0) + (Math.random() < 0.5 ? 1 : 0));
                }
            }
        }
    }
}

// ============ БАЗА СОБЫТИЙ ============
const EVENT_POOL = [
    {
        id: 'scandal_press',
        icon: '📰',
        title: 'СКАНДАЛ В ПРЕССЕ',
        condition: () => myRoster.some(p => (p.loyalty ?? 100) > 40),
        getPlayer: () => myRoster.find(p => (p.loyalty ?? 100) > 40),
        text: (p) => `Таблоиды опубликовали фото твоего клиента <b>${p.name}</b> в ночном клубе за день до важного матча. Пресса требует комментарий.`,
        choices: [
            { icon: '✅', label: 'Опровергнуть', desc: 'Сказать, что это фейк',
              apply: (p) => {
                  if (Math.random() < 0.6) {
                      p.loyalty = Math.min(100, p.loyalty + 10);
                      upgrades.reputation = Math.min(25, upgrades.reputation + 1);
                      return { text: 'Пресса поверила. Лояльность +10, репутация +1.', type: 'positive' };
                  }
                  p.loyalty = Math.max(0, p.loyalty - 5);
                  upgrades.reputation = Math.max(1, upgrades.reputation - 2);
                  return { text: 'Правда всплыла. Лояльность −5, репутация −2.', type: 'negative' };
              } },
            { icon: '🤐', label: 'Промолчать', desc: 'Ничего не говорить',
              apply: (p) => { p.loyalty = Math.max(0, p.loyalty - 10); return { text: 'Клиент обиделся, что ты не защитил. Лояльность −10.', type: 'negative' }; } },
            { icon: '🤝', label: 'Поддержать публично', desc: '«Каждый имеет право на отдых»',
              apply: (p) => {
                  p.loyalty = Math.min(100, p.loyalty + 15);
                  upgrades.reputation = Math.max(1, upgrades.reputation - 1);
                  return { text: 'Клиент благодарен. Лояльность +15, но пресса недовольна (−1 реп).', type: 'positive' };
              } },
            { icon: '💰', label: 'Заплатить журналистам ($10K)', desc: 'Тихо решить вопрос',
              apply: (p) => {
                  if (agentMoney < 10000) return { text: 'Недостаточно денег.', type: 'negative', skip: true };
                  agentMoney -= 10000;
                  p.loyalty = Math.min(100, p.loyalty + 5);
                  return { text: 'История исчезла. −$10K, лояльность +5.', type: 'positive' };
              } }
        ]
    },

    // ============ КАТЕГОРИЯ 1. Скандалы и пресса ============
    {
        id: 'bad_interview', icon: '🎤', title: 'НЕУДАЧНОЕ ИНТЕРВЬЮ',
        condition: () => myRoster.some(p => p.rating >= 65 && p.club),
        getPlayer: () => myRoster.find(p => p.rating >= 65 && p.club),
        text: (p) => `<b>${p.name}</b> наговорил лишнего журналистам после матча — раскритиковал тренера и партнёров. Клуб в ярости.`,
        choices: [
            { icon: '🙏', label: 'Публично извиниться', desc: 'Сгладить конфликт', apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 5); return { text: 'Клуб доволен, клиент ворчит. Лояльность +5.', type: 'positive' }; } },
            { icon: '🎯', label: 'Перевести стрелки', desc: 'Обвинить журналистов', apply: (p) => { if (Math.random() < 0.5) { p.loyalty = Math.min(100, p.loyalty + 10); return { text: 'Сработало! Лояльность +10.', type: 'positive' }; } upgrades.reputation = Math.max(1, upgrades.reputation - 3); return { text: 'Пресса возмущена. Репутация −3.', type: 'negative' }; } },
            { icon: '🛡', label: 'Поддержать клиента', desc: '«Он сказал правду»', apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 15); upgrades.reputation = Math.max(1, upgrades.reputation - 2); return { text: 'Клиент благодарен. Лояльность +15, репутация −2.', type: 'positive' }; } },
            { icon: '📣', label: 'Пиар-кампания ($20K)', desc: 'Задавить историю позитивом', apply: (p) => { if (agentMoney < 20000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 20000; p.loyalty = Math.min(100, p.loyalty + 10); return { text: 'История забыта. −$20K, лояльность +10.', type: 'positive' }; } }
        ]
    },
    {
        id: 'doping_suspicion', icon: '💊', title: 'ПОДОЗРЕНИЯ В ДОПИНГЕ',
        condition: () => myRoster.some(p => p.rating >= 80),
        getPlayer: () => myRoster.find(p => p.rating >= 80),
        text: (p) => `Допинг-проба клиента <b>${p.name}</b> дала сомнительный результат. Дело грозит дисквалификацией.`,
        choices: [
            { icon: '⚖️', label: 'Нанять адвоката ($50K)', desc: 'Лучшая защита', apply: (p) => { if (agentMoney < 50000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 50000; if (Math.random() < 0.9) { p.loyalty = Math.min(100, p.loyalty + 20); return { text: 'Клиент оправдан! Лояльность +20.', type: 'positive' }; } return { text: 'Адвокат проиграл дело.', type: 'negative' }; } },
            { icon: '🤫', label: 'Тихо решить', desc: 'Не привлекать внимания', apply: (p) => { if (Math.random() < 0.6) return { text: 'Историю замяли.', type: 'positive' }; p.loyalty = Math.max(0, p.loyalty - 30); upgrades.reputation = Math.max(1, upgrades.reputation - 5); return { text: 'Всплыло. Лояльность −30, репутация −5.', type: 'negative' }; } },
            { icon: '📢', label: 'Опровергнуть публично', desc: 'Заявить о провокации', apply: (p) => { upgrades.reputation = Math.max(1, upgrades.reputation - 2); return { text: 'Пресса поверила на 70%. Репутация −2.', type: 'positive' }; } },
            { icon: '⏳', label: 'Ждать итогов', desc: 'Не мешать разбирательству', apply: (p) => { if (Math.random() < 0.5) { p.loyalty = Math.min(100, p.loyalty + 5); return { text: 'Всё обошлось.', type: 'positive' }; } p.loyalty = Math.max(0, p.loyalty - 20); return { text: 'Плохие новости. Лояльность −20.', type: 'negative' }; } }
        ]
    },
    {
        id: 'scandal_tweet', icon: '🐦', title: 'СКАНДАЛЬНЫЙ ТВИТ',
        condition: () => myRoster.length > 0,
        getPlayer: () => randomChoice(myRoster),
        text: (p) => `<b>${p.name}</b> опубликовал политический пост в соцсетях. Фанаты в ярости, клуб требует объяснений.`,
        choices: [
            { icon: '🗑', label: 'Удалить и извиниться', desc: 'Сохранить репутацию', apply: (p) => { p.loyalty = Math.max(0, p.loyalty - 10); return { text: 'Клиент недоволен, но репутация цела. Лояльность −10.', type: 'negative' }; } },
            { icon: '📌', label: 'Оставить как есть', desc: 'Свобода слова', apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 15); upgrades.reputation = Math.max(1, upgrades.reputation - 3); return { text: 'Клиент в восторге. Лояльность +15, репутация −3.', type: 'positive' }; } },
            { icon: '🛡', label: 'Поддержать публично', desc: '«Он имеет право»', apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 25); upgrades.reputation = Math.max(1, upgrades.reputation - 5); return { text: 'Клиент предан. Лояльность +25, репутация −5.', type: 'positive' }; } },
            { icon: '🚶', label: 'Отстраниться', desc: '«Это его личное»', apply: (p) => { p.loyalty = Math.max(0, p.loyalty - 25); return { text: 'Клиент обижен. Лояльность −25.', type: 'negative' }; } }
        ]
    },

    // ============ КАТЕГОРИЯ 2. Просьбы клиента ============
    {
        id: 'want_top_club', icon: '🏒', title: '«ХОЧУ В ТОП-КЛУБ»',
        condition: () => myRoster.some(p => p.rating >= 75 && p.club && !['NHL','KHL','SHL','NL_Switzerland'].includes(p.league)),
        getPlayer: () => myRoster.find(p => p.rating >= 75 && p.club && !['NHL','KHL','SHL','NL_Switzerland'].includes(p.league)),
        text: (p) => `<b>${p.name}</b> требует перехода в сильную лигу: «Найди мне клуб в NHL или КХЛ. Иначе буду искать другого агента».`,
        choices: [
            { icon: '✅', label: 'Обещать («Найду в этом сезоне»)', desc: 'Взять на себя обязательство', apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 15); createTask({ type: 'find_club_top', playerName: p.name, description: `Найти клуб в NHL/КХЛ для ${p.name}`, icon: '🏒', deadlineWeeks: 30, reward: { loyalty: 15, rep: 3, xp: 500 }, penalty: { loyalty: -30, rep: -2 } }); return { text: 'Обещание принято. Найди клиенту клуб до конца сезона.', type: 'positive' }; } },
            { icon: '🤝', label: 'Честно объяснить', desc: '«Сейчас не готов, поработаем»', apply: (p) => { if (Math.random() < 0.7) { p.loyalty = Math.min(100, p.loyalty + 5); return { text: 'Клиент понял. Лояльность +5.', type: 'positive' }; } p.loyalty = Math.max(0, p.loyalty - 20); return { text: 'Клиент ищет другого агента. Лояльность −20.', type: 'negative' }; } },
            { icon: '💰', label: 'Подкупить бонусом ($25K)', desc: 'Дать денег сейчас', apply: (p) => { if (agentMoney < 25000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 25000; p.loyalty = Math.min(100, p.loyalty + 20); return { text: 'Клиент доволен. −$25K, лояльность +20.', type: 'positive' }; } },
            { icon: '🚪', label: 'Отпустить', desc: 'Клиент уходит', apply: (p) => { agentMoney += 10000; removeClientFromRoster(p); return { text: 'Клиент ушёл. +$10K компенсации.', type: 'negative' }; } }
        ]
    },
    {
        id: 'want_more_money', icon: '💵', title: '«ХОЧУ БОЛЬШЕ ДЕНЕГ»',
        condition: () => myRoster.some(p => p.rating >= 70 && p.club && p.salary < calculateSalaryCap(p.rating) * 0.85),
        getPlayer: () => myRoster.find(p => p.rating >= 70 && p.club && p.salary < calculateSalaryCap(p.rating) * 0.85),
        text: (p) => `<b>${p.name}</b> недоволен зарплатой. Требует пересмотра контракта или уйдёт.`,
        choices: [
            { icon: '🤝', label: 'Торговаться с клубом', desc: 'Попробовать выбить повышение', apply: (p) => { if (Math.random() < 0.6) { p.salary = Math.round(p.salary * 1.15); p.loyalty = Math.min(100, p.loyalty + 10); return { text: 'Клуб повысил ЗП на 15%. Лояльность +10.', type: 'positive' }; } p.loyalty = Math.max(0, p.loyalty - 5); return { text: 'Клуб отказался. Лояльность −5.', type: 'negative' }; } },
            { icon: '🔍', label: 'Найти спонсора', desc: 'Найти деньги извне (4 недели)', apply: (p) => { createTask({ type: 'find_sponsor', playerName: p.name, description: `Найти спонсора для ${p.name}`, icon: '💰', deadlineWeeks: 4, reward: { loyalty: 15 }, penalty: { loyalty: -10 } }); return { text: 'Ищем спонсора. 4 недели.', type: 'positive' }; } },
            { icon: '😤', label: 'Уговорить потерпеть', desc: '«Сейчас не время»', apply: (p) => { p.loyalty = Math.max(0, p.loyalty - 10); return { text: 'Клиент недоволен. Лояльность −10.', type: 'negative' }; } },
            { icon: '💰', label: 'Бонус из своего кармана ($30K)', desc: 'Заплатить самому', apply: (p) => { if (agentMoney < 30000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 30000; p.loyalty = Math.min(100, p.loyalty + 20); return { text: 'Клиент благодарен. −$30K, лояльность +20.', type: 'positive' }; } }
        ]
    },
    {
        id: 'want_study', icon: '🎓', title: '«ХОЧУ НА УЧЁБУ»',
        condition: () => myRoster.some(p => p.age <= 24),
        getPlayer: () => myRoster.find(p => p.age <= 24),
        text: (p) => `<b>${p.name}</b> хочет параллельно учиться в университете. Боится, что нагрузка помешает тренировкам.`,
        choices: [
            { icon: '✅', label: 'Поддержать', desc: 'Учёба — это важно', apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 15); p.rating = Math.max(1, p.rating - 1); return { text: 'Клиент счастлив. Лояльность +15, но рейтинг −1.', type: 'positive' }; } },
            { icon: '❌', label: 'Отговорить', desc: '«Сейчас хоккей важнее»', apply: (p) => { p.loyalty = Math.max(0, p.loyalty - 10); return { text: 'Клиент расстроен. Лояльность −10.', type: 'negative' }; } },
            { icon: '💻', label: 'Онлайн-курсы ($5K)', desc: 'Компромисс', apply: (p) => { if (agentMoney < 5000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 5000; p.loyalty = Math.min(100, p.loyalty + 10); return { text: 'Компромисс найден. −$5K, лояльность +10.', type: 'positive' }; } },
            { icon: '😐', label: 'Игнорировать', desc: 'Пусть сам решает', apply: (p) => { p.loyalty = Math.max(0, p.loyalty - 5); return { text: 'Клиент сам решит. Лояльность −5.', type: 'negative' }; } }
        ]
    },
    {
        id: 'hobby_outside', icon: '🎮', title: 'ХОББИ ВНЕ ХОККЕЯ',
        condition: () => myRoster.some(p => p.rating >= 70 && (p.loyalty ?? 100) >= 40),
        getPlayer: () => myRoster.find(p => p.rating >= 70 && (p.loyalty ?? 100) >= 40),
        text: (p) => `<b>${p.name}</b> хочет открыть ресторан. Говорит, что это его мечта, но тренировки уже страдают.`,
        choices: [
            { icon: '✅', label: 'Разрешить', desc: 'Личная жизнь важна', apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 10); p.rating = Math.max(1, p.rating - 1); return { text: 'Клиент счастлив. Лояльность +10, рейтинг −1.', type: 'positive' }; } },
            { icon: '❌', label: 'Запретить', desc: 'Только хоккей', apply: (p) => { p.loyalty = Math.max(0, p.loyalty - 15); return { text: 'Клиент обижен. Лояльность −15.', type: 'negative' }; } },
            { icon: '🤝', label: 'Помочь с идеей ($10K)', desc: 'Вложить в развитие', apply: (p) => { if (agentMoney < 10000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 10000; p.loyalty = Math.min(100, p.loyalty + 15); return { text: 'Помог с бизнесом. −$10K, лояльность +15.', type: 'positive' }; } },
            { icon: '💼', label: 'Взять долю', desc: 'Стать партнёром', apply: (p) => { if (agentMoney < 5000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 5000; if (Math.random() < 0.5) { agentMoney += 20000; return { text: 'Бизнес окупился! +$20K.', type: 'positive' }; } agentMoney -= 15000; return { text: 'Бизнес провалился. −$15K.', type: 'negative' }; } }
        ]
    },

    // ============ КАТЕГОРИЯ 3. Деньги и спонсоры ============
    {
        id: 'sponsor_offer', icon: '🏦', title: 'СПОНСОРСКОЕ ПРЕДЛОЖЕНИЕ',
        condition: () => myRoster.some(p => p.rating >= 70 && (p.loyalty ?? 100) >= 50),
        getPlayer: () => myRoster.find(p => p.rating >= 70 && (p.loyalty ?? 100) >= 50),
        text: (p) => `Банк «Прогресс» хочет снять <b>${p.name}</b> в рекламном ролике за $40K. Клиент недоволен — считает, что отвлечёт от хоккея.`,
        choices: [
            { icon: '✅', label: 'Взять $40K', desc: 'Деньги не пахнут', apply: (p) => { agentMoney += 40000; p.loyalty = Math.max(0, p.loyalty - 15); return { text: '+$40K, но клиент обижен. Лояльность −15.', type: 'positive' }; } },
            { icon: '🤝', label: 'Поторговаться', desc: 'Просить больше', apply: (p) => { if (Math.random() < 0.6) { agentMoney += 60000; p.loyalty = Math.max(0, p.loyalty - 10); return { text: 'Банк дал $60K! Лояльность −10.', type: 'positive' }; } p.loyalty = Math.min(100, p.loyalty + 5); return { text: 'Банк отказался. Клиент ценит. Лояльность +5.', type: 'positive' }; } },
            { icon: '❌', label: 'Отказать', desc: 'Клиент важнее', apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 10); return { text: 'Клиент благодарен. Лояльность +10.', type: 'positive' }; } },
            { icon: '🎁', label: 'Взять и поделиться', desc: 'Отдать часть клиенту', apply: (p) => { agentMoney += 25000; p.loyalty = Math.min(100, p.loyalty + 5); return { text: '+$25K, клиент доволен. Лояльность +5.', type: 'positive' }; } }
        ]
    },
    {
        id: 'equipment_ad', icon: '👟', title: 'РЕКЛАМА ЭКИПИРОВКИ',
        condition: () => myRoster.some(p => p.rating >= 70),
        getPlayer: () => myRoster.find(p => p.rating >= 70),
        text: (p) => `Бренд клюшек предлагает <b>${p.name}</b> контракт на $30K. Клиент не любит их продукцию.`,
        choices: [
            { icon: '🗣', label: 'Уговорить', desc: 'Деньги решают', apply: (p) => { if (Math.random() < 0.7) { agentMoney += 30000; return { text: 'Согласился! +$30K.', type: 'positive' }; } p.loyalty = Math.max(0, p.loyalty - 10); return { text: 'Отказался. Лояльность −10.', type: 'negative' }; } },
            { icon: '❌', label: 'Отказать', desc: 'Уважать выбор клиента', apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 5); return { text: 'Клиент ценит. Лояльность +5.', type: 'positive' }; } },
            { icon: '🤝', label: 'Компромисс', desc: 'Снять один ролик', apply: (p) => { agentMoney += 15000; p.loyalty = Math.min(100, p.loyalty + 10); return { text: '+$15K и клиент доволен. Лояльность +10.', type: 'positive' }; } },
            { icon: '🔄', label: 'Сменить бренд ($20K)', desc: 'Найти другого производителя', apply: (p) => { if (agentMoney < 20000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 20000; p.loyalty = Math.min(100, p.loyalty + 20); return { text: 'Нашли другого. −$20K, лояльность +20.', type: 'positive' }; } }
        ]
    },
    {
        id: 'tax_audit', icon: '💸', title: 'НАЛОГОВАЯ ПРОВЕРКА',
        condition: () => myRoster.some(p => p.rating >= 75),
        getPlayer: () => myRoster.find(p => p.rating >= 75),
        text: (p) => `У <b>${p.name}</b> проблемы с налоговой. Грозит штраф или разбирательство.`,
        choices: [
            { icon: '💰', label: 'Заплатить штраф ($30K)', desc: 'Закрыть вопрос', apply: (p) => { if (agentMoney < 30000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 30000; return { text: 'Штраф оплачен.', type: 'positive' }; } },
            { icon: '⚖️', label: 'Нанять юриста ($15K)', desc: 'Попробовать оспорить', apply: (p) => { if (agentMoney < 15000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 15000; if (Math.random() < 0.7) return { text: 'Юрист решил. −$15K.', type: 'positive' }; agentMoney -= 50000; return { text: 'Проиграл. −$15K юрист + $50K штраф.', type: 'negative' }; } },
            { icon: '🏛', label: 'Судиться', desc: '3 недели, риск', apply: (p) => { if (Math.random() < 0.5) return { text: 'Выиграли суд!', type: 'positive' }; agentMoney -= 60000; return { text: 'Проиграли. −$60K.', type: 'negative' }; } },
            { icon: '📤', label: 'Переложить на клуб', desc: 'Пусть разбираются', apply: (p) => { if (Math.random() < 0.4) return { text: 'Клуб взялся.', type: 'positive' }; upgrades.reputation = Math.max(1, upgrades.reputation - 2); return { text: 'Клуб обиделся. Репутация −2.', type: 'negative' }; } }
        ]
    },
    {
        id: 'shady_investor', icon: '🎰', title: 'СОМНИТЕЛЬНЫЙ ИНВЕСТОР',
        condition: () => myRoster.some(p => p.rating >= 75),
        getPlayer: () => myRoster.find(p => p.rating >= 75),
        text: (p) => `Незнакомец предлагает $100K за долю в будущих доходах <b>${p.name}</b>. Слишком выгодно, чтобы быть честным.`,
        choices: [
            { icon: '💰', label: 'Взять $100K', desc: 'Рискнуть', apply: (p) => { agentMoney += 100000; return { text: '+$100K. Через 8 недель станет ясно.', type: 'positive' }; } },
            { icon: '❌', label: 'Отказаться', desc: 'Не связываться', apply: (p) => { return { text: 'Отказался. Всё чисто.', type: 'positive' }; } },
            { icon: '🔍', label: 'Проверить репутацию ($5K)', desc: 'Узнать правду', apply: (p) => { if (agentMoney < 5000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 5000; if (Math.random() < 0.6) return { text: 'Инвестор нормальный. Можно брать.', type: 'positive' }; return { text: 'Это мошенник! Хорошо, что проверили.', type: 'positive' }; } },
            { icon: '🤝', label: 'Торговаться', desc: 'Просить больше', apply: (p) => { agentMoney += 150000; return { text: '+$150K, но риск выше.', type: 'positive' }; } }
        ]
    },

    // ============ КАТЕГОРИЯ 4. Клуб и тренер ============
    {
        id: 'coach_conflict', icon: '🥊', title: 'КОНФЛИКТ С ТРЕНЕРОМ',
        condition: () => myRoster.some(p => p.rating >= 60 && p.rating <= 80 && p.club),
        getPlayer: () => myRoster.find(p => p.rating >= 60 && p.rating <= 80 && p.club),
        text: (p) => `Тренер не ставит <b>${p.name}</b> в состав 4 матча подряд. Клиент в ярости.`,
        choices: [
            { icon: '📢', label: 'Возмутиться публично', desc: 'Давить на клуб', apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 15); upgrades.reputation = Math.max(1, upgrades.reputation - 3); return { text: 'Лояльность +15, репутация −3.', type: 'positive' }; } },
            { icon: '🤝', label: 'Поговорить с тренером', desc: 'Тихо решить', apply: (p) => { if (Math.random() < 0.7) { p.loyalty = Math.min(100, p.loyalty + 10); return { text: 'Клиент снова в составе. Лояльность +10.', type: 'positive' }; } p.loyalty = Math.max(0, p.loyalty - 5); return { text: 'Тренер упёрся. Лояльность −5.', type: 'negative' }; } },
            { icon: '🔍', label: 'Искать другой клуб', desc: 'Найти новый (6 недель)', apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 5); createTask({ type: 'find_club_same', playerName: p.name, description: `Найти ${p.name} клуб того же уровня`, icon: '🔍', deadlineWeeks: 6, reward: { loyalty: 10, rep: 1 }, penalty: { loyalty: -15 }, params: { originalClub: p.club, originalLeague: p.league } }); return { text: 'Ищем новый клуб.', type: 'positive' }; } },
            { icon: '😐', label: '«Терпи»', desc: 'Пусть докажет', apply: (p) => { p.loyalty = Math.max(0, p.loyalty - 15); return { text: 'Клиент в бешенстве. Лояльность −15.', type: 'negative' }; } }
        ]
    },
    {
        id: 'medical_error', icon: '🏥', title: 'МЕДИЦИНСКАЯ ОШИБКА',
        condition: () => myRoster.some(p => (p.injuryWeeks || 0) > 0 || (p.seasonHistory || []).some(s => s.gp < 30)),
        getPlayer: () => myRoster.find(p => (p.injuryWeeks || 0) > 0) || myRoster[0],
        text: (p) => `Врачи клуба неверно лечили травму <b>${p.name}</b>. Восстановление затянулось.`,
        choices: [
            { icon: '📢', label: 'Скандал', desc: 'Публично возмутиться', apply: (p) => { upgrades.reputation = Math.max(1, upgrades.reputation - 2); return { text: 'Скандал. Репутация −2, но клуб оплатит лечение.', type: 'negative' }; } },
            { icon: '👨‍⚕️', label: 'Нанять других врачей ($30K)', desc: 'Частная клиника', apply: (p) => { if (agentMoney < 30000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 30000; p.loyalty = Math.min(100, p.loyalty + 20); p.injuryWeeks = Math.max(0, (p.injuryWeeks || 0) - 2); return { text: 'Клиент здоров. −$30K, лояльность +20.', type: 'positive' }; } },
            { icon: '⚖️', label: 'Судиться с клубом', desc: '6 недель, риск', apply: (p) => { if (Math.random() < 0.6) { agentMoney += 100000; return { text: 'Выиграл $100K!', type: 'positive' }; } return { text: 'Проиграл дело.', type: 'negative' }; } },
            { icon: '🤫', label: 'Тихо решить', desc: 'Не выносить сор', apply: (p) => { return { text: 'Ничего не изменилось.', type: 'negative' }; } }
        ]
    },
    {
        id: 'locker_room', icon: '💢', title: 'КОНФЛИКТ В РАЗДЕВАЛКЕ',
        condition: () => myRoster.some(p => p.rating >= 65 && p.club && (p.clubLoyalty || 50) > 40),
        getPlayer: () => myRoster.find(p => p.rating >= 65 && p.club && (p.clubLoyalty || 50) > 40),
        text: (p) => `<b>${p.name}</b> поссорился с одноклубником. Атмосфера в команде накалена.`,
        choices: [
            { icon: '🤝', label: 'Помирить', desc: 'Поговорить с обоими', apply: (p) => { if (Math.random() < 0.6) { p.loyalty = Math.min(100, p.loyalty + 10); return { text: 'Помирил! Лояльность +10.', type: 'positive' }; } return { text: 'Не получилось помирить.', type: 'negative' }; } },
            { icon: '🛡', label: 'Поддержать клиента', desc: 'Встать на его сторону', apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 15); p.clubLoyalty = Math.max(0, (p.clubLoyalty || 50) - 5); return { text: 'Клиент ценит. Лояльность +15, клуб недоволен.', type: 'positive' }; } },
            { icon: '📞', label: 'Обратиться к тренеру', desc: 'Пусть разберётся', apply: (p) => { if (Math.random() < 0.5) { p.loyalty = Math.min(100, p.loyalty + 8); return { text: 'Тренер решил. Лояльность +8.', type: 'positive' }; } p.loyalty = Math.max(0, p.loyalty - 5); return { text: 'Тренер не вмешался. Лояльность −5.', type: 'negative' }; } },
            { icon: '😐', label: 'Игнорировать', desc: 'Само рассосётся', apply: (p) => { p.loyalty = Math.max(0, p.loyalty - 5); return { text: 'Не вмешался. Лояльность −5.', type: 'negative' }; } }
        ]
    },
    {
        id: 'captain_armband', icon: '🏆', title: 'КАПИТАНСКАЯ ПОВЯЗКА',
        condition: () => myRoster.some(p => p.rating >= 78 && p.club && (p.clubLoyalty || 50) > 55),
        getPlayer: () => myRoster.find(p => p.rating >= 78 && p.club && (p.clubLoyalty || 50) > 55),
        text: (p) => `Клуб предлагает <b>${p.name}</b> стать капитаном команды. Большая честь, но и большая ответственность.`,
        choices: [
            { icon: '✅', label: 'Согласиться', desc: 'Взять повязку', apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 20); p.clubLoyalty = Math.min(100, (p.clubLoyalty || 50) + 10); return { text: 'Новый капитан! Лояльность +20.', type: 'positive' }; } },
            { icon: '❌', label: 'Отказать', desc: 'Не готов', apply: (p) => { upgrades.reputation = Math.max(1, upgrades.reputation - 1); return { text: 'Клуб недоволен. Репутация −1.', type: 'negative' }; } },
            { icon: '⏳', label: 'Попросить время', desc: '2 недели на раздумья', apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 5); return { text: 'Клиент взял паузу. Лояльность +5.', type: 'positive' }; } },
            { icon: '👥', label: 'Предложить другого', desc: 'Кандидат из команды', apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 5); upgrades.reputation = Math.min(25, upgrades.reputation + 1); return { text: 'Клуб выбрал другого. Лояльность +5, репутация +1.', type: 'positive' }; } }
        ]
    },

    // ============ КАТЕГОРИЯ 5. Личная жизнь ============
    {
        id: 'family_home', icon: '🏠', title: 'СЕМЕЙНЫЕ ОБСТОЯТЕЛЬСТВА',
        condition: () => myRoster.some(p => p.club && getPlayerCountry(p) !== '🇷🇺' ? !isInHomeCountry(p) : false),
        getPlayer: () => myRoster.find(p => p.club && !isInHomeCountry(p)),
        text: (p) => `У <b>${p.name}</b> жена беременна. Хочет вернуться в родную страну. Просит найти клуб ближе к дому.`,
        choices: [
{ icon: '✅', label: 'Пообещать помочь', desc: 'Найти клуб дома (12 недель)', apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 15); createTask({ type: 'find_club_home', playerName: p.name, description: `Вернуть ${p.name} домой`, icon: '🏠', deadlineWeeks: 12, reward: { loyalty: 15, rep: 3, xp: 500 }, penalty: { loyalty: -25 }, params: { originalClub: p.club, originalLeague: p.league } }); return { text: 'Обещание принято. Найди клуб в родной стране.', type: 'positive' }; } },
            { icon: '🤝', label: 'Уговорить остаться', desc: 'Попробовать переубедить', apply: (p) => { if (Math.random() < 0.5) { p.loyalty = Math.min(100, p.loyalty + 5); return { text: 'Остался. Лояльность +5.', type: 'positive' }; } p.loyalty = Math.max(0, p.loyalty - 20); return { text: 'Обиделся. Лояльность −20.', type: 'negative' }; } },
            { icon: '💰', label: 'Оплатить перелёты семьи ($15K)', desc: 'Пусть семья приедет', apply: (p) => { if (agentMoney < 15000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 15000; p.loyalty = Math.min(100, p.loyalty + 25); return { text: 'Семья рядом! −$15K, лояльность +25.', type: 'positive' }; } },
            { icon: '❌', label: 'Игнорировать', desc: 'Не наше дело', apply: (p) => { p.loyalty = Math.max(0, p.loyalty - 25); return { text: 'Клиент в ярости. Лояльность −25.', type: 'negative' }; } }
        ]
    },
    {
        id: 'divorce', icon: '💔', title: 'РАЗВОД',
        condition: () => myRoster.some(p => p.age >= 25),
        getPlayer: () => myRoster.find(p => p.age >= 25),
        text: (p) => `<b>${p.name}</b> разводится. Личные проблемы мешают тренировкам.`,
        choices: [
            { icon: '⚖️', label: 'Найти юриста ($10K)', desc: 'Помочь с разводом', apply: (p) => { if (agentMoney < 10000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 10000; p.loyalty = Math.min(100, p.loyalty + 15); return { text: 'Помог. −$10K, лояльность +15.', type: 'positive' }; } },
            { icon: '🧠', label: 'Оплатить психолога ($5K)', desc: 'Эмоциональная помощь', apply: (p) => { if (agentMoney < 5000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 5000; p.loyalty = Math.min(100, p.loyalty + 10); return { text: 'Психолог помог. −$5K, лояльность +10.', type: 'positive' }; } },
            { icon: '⏸', label: 'Взять паузу (2 недели)', desc: 'Дать отдохнуть', apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 5); p.injuryWeeks = Math.max(p.injuryWeeks || 0, 2); return { text: 'Отдыхает 2 недели. Лояльность +5.', type: 'positive' }; } },
            { icon: '🚶', label: 'Отстраниться', desc: 'Это его личное', apply: (p) => { p.loyalty = Math.max(0, p.loyalty - 20); return { text: 'Клиент один. Лояльность −20.', type: 'negative' }; } }
        ]
    },
    {
        id: 'newborn_child', icon: '👶', title: 'РОЖДЕНИЕ РЕБЁНКА',
        condition: () => myRoster.some(p => p.age >= 22),
        getPlayer: () => myRoster.find(p => p.age >= 22),
        text: (p) => `У <b>${p.name}</b> родился ребёнок! Хочет пропустить неделю матчей.`,
        choices: [
            { icon: '✅', label: 'Разрешить паузу', desc: 'Семья важнее', apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 25); return { text: 'Счастливый отец. Лояльность +25.', type: 'positive' }; } },
            { icon: '🏒', label: 'Уговорить играть', desc: '«Матч важнее»', apply: (p) => { p.loyalty = Math.max(0, p.loyalty - 15); return { text: 'Клиент в шоке. Лояльность −15.', type: 'negative' }; } },
            { icon: '🎁', label: 'Сюрприз с подарками ($5K)', desc: 'Поздравить по-царски', apply: (p) => { if (agentMoney < 5000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 5000; p.loyalty = Math.min(100, p.loyalty + 30); return { text: 'Счастлив! −$5K, лояльность +30.', type: 'positive' }; } },
            { icon: '😐', label: 'Игнорировать', desc: 'Не обратить внимания', apply: (p) => { p.loyalty = Math.max(0, p.loyalty - 10); return { text: 'Обиделся. Лояльность −10.', type: 'negative' }; } }
        ]
    },
    {
        id: 'home_injury', icon: '🩹', title: 'ТРАВМА ВНЕ ИГРЫ',
        condition: () => myRoster.some(p => p.club && p.injuryWeeks === 0),
        getPlayer: () => myRoster.find(p => p.club && p.injuryWeeks === 0),
        text: (p) => `<b>${p.name}</b> сломал палец на бытовухе. На матч через 3 дня. Что скажешь клубу?`,
        choices: [
            { icon: '🤫', label: 'Скрыть от клуба', desc: 'Сыграет через боль', apply: (p) => { if (Math.random() < 0.5) return { text: 'Прокатило. Сыграл.', type: 'positive' }; upgrades.reputation = Math.max(1, upgrades.reputation - 3); p.injuryWeeks = 2; return { text: 'Всплыло. Дисквалификация + репутация −3.', type: 'negative' }; } },
            { icon: '✅', label: 'Сказать правду', desc: 'Честность важнее', apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 5); p.injuryWeeks = 3; return { text: 'Клиент пропустит 3 недели. Лояльность +5.', type: 'positive' }; } },
            { icon: '👨‍⚕️', label: 'Частный врач ($20K)', desc: 'Быстрое лечение', apply: (p) => { if (agentMoney < 20000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 20000; p.injuryWeeks = 1; return { text: 'Восстановление за 1 неделю. −$20K.', type: 'positive' }; } },
            { icon: '📝', label: 'Изменить историю', desc: 'Сказать, что на тренировке', apply: (p) => { if (Math.random() < 0.6) return { text: 'Поверили.', type: 'positive' }; upgrades.reputation = Math.max(1, upgrades.reputation - 5); return { text: 'Всплыло. Репутация −5.', type: 'negative' }; } }
        ]
    },
    {
        id: 'birthday', icon: '🎂', title: 'ДЕНЬ РОЖДЕНИЯ',
        condition: () => myRoster.some(p => p.age >= 21),
        getPlayer: () => myRoster.find(p => p.age >= 21),
        text: (p) => `У <b>${p.name}</b> день рождения через 3 дня. Хочет большую вечеринку.`,
        choices: [
            { icon: '🎉', label: 'Разрешить вечеринку', desc: 'Пусть отдохнёт', apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 15); p.form = -1; return { text: 'Лояльность +15, но форма упадёт на 2 недели.', type: 'positive' }; } },
            { icon: '❌', label: 'Отговорить', desc: 'Скоро важный матч', apply: (p) => { p.loyalty = Math.max(0, p.loyalty - 10); return { text: 'Обиделся. Лояльность −10.', type: 'negative' }; } },
            { icon: '🎁', label: 'Устроить сюрприз ($10K)', desc: 'Сам организуй', apply: (p) => { if (agentMoney < 10000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 10000; p.loyalty = Math.min(100, p.loyalty + 25); return { text: 'Счастлив! −$10K, лояльность +25.', type: 'positive' }; } },
            { icon: '😐', label: 'Игнорировать', desc: 'Не вмешиваться', apply: (p) => { p.loyalty = Math.max(0, p.loyalty - 5); return { text: 'Лояльность −5.', type: 'negative' }; } }
        ]
    },

    // ============ КАТЕГОРИЯ 6. Благотворительность ============
    {
        id: 'charity_kids', icon: '🎗', title: 'МАСТЕР-КЛАСС ДЛЯ ДЕТЕЙ',
        condition: () => myRoster.some(p => p.rating >= 70),
        getPlayer: () => myRoster.find(p => p.rating >= 70),
        text: (p) => `Детский хоккейный фонд приглашает <b>${p.name}</b> провести мастер-класс. Бесплатно, но это хороший пиар.`,
        choices: [
            { icon: '✅', label: 'Согласиться', desc: 'Хорошее дело', apply: (p) => { upgrades.reputation = Math.min(25, upgrades.reputation + 2); p.loyalty = Math.min(100, p.loyalty + 10); if (p.age > 30) p.rating = Math.max(1, p.rating - 1); return { text: 'Пиар успешен. Репутация +2, лояльность +10.', type: 'positive' }; } },
            { icon: '💰', label: 'За деньги для фонда ($5K)', desc: 'Сам оплатить', apply: (p) => { if (agentMoney < 5000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 5000; upgrades.reputation = Math.min(25, upgrades.reputation + 3); p.loyalty = Math.min(100, p.loyalty + 15); return { text: '−$5K, репутация +3, лояльность +15.', type: 'positive' }; } },
            { icon: '❌', label: 'Отказать', desc: 'Нет времени', apply: (p) => { if (Math.random() < 0.2) { upgrades.reputation = Math.max(1, upgrades.reputation - 1); return { text: 'Пресса недовольна. Репутация −1.', type: 'negative' }; } return { text: 'Ничего не произошло.', type: 'negative' }; } },
            { icon: '🤝', label: 'С условием оплаты клиенту', desc: 'Хитрая сделка', apply: (p) => { if (Math.random() < 0.4) { agentMoney += 3000; upgrades.reputation = Math.min(25, upgrades.reputation + 1); return { text: 'Фонд согласился. +$3K, репутация +1.', type: 'positive' }; } upgrades.reputation = Math.max(1, upgrades.reputation - 1); return { text: 'Фонд обиделся. Репутация −1.', type: 'negative' }; } }
        ]
    },
    {
        id: 'documentary', icon: '🎥', title: 'ДОКУМЕНТАЛЬНЫЙ ФИЛЬМ',
        condition: () => myRoster.some(p => p.rating >= 75),
        getPlayer: () => myRoster.find(p => p.rating >= 75),
        text: (p) => `Канал хочет снять документальный фильм о <b>${p.name}</b>.`,
        choices: [
            { icon: '✅', label: 'Согласиться', desc: 'Это шанс', apply: (p) => { upgrades.reputation = Math.min(25, upgrades.reputation + 2); return { text: 'Съёмки начались. Репутация +2.', type: 'positive' }; } },
            { icon: '❌', label: 'Отказаться', desc: 'Не время', apply: (p) => { return { text: 'Отказались.', type: 'negative' }; } },
            { icon: '💰', label: 'Запросить $50K', desc: 'Дорого', apply: (p) => { if (Math.random() < 0.5) { agentMoney += 50000; return { text: 'Канал согласился! +$50K.', type: 'positive' }; } return { text: 'Канал отказался.', type: 'negative' }; } },
            { icon: '📺', label: 'Найти другой канал', desc: 'Более престижный', apply: (p) => { upgrades.reputation = Math.min(25, upgrades.reputation + 1); return { text: 'Нашли. Репутация +1.', type: 'positive' }; } }
        ]
    },
    {
        id: 'hospital_help', icon: '🏥', title: 'ПОМОЩЬ БОЛЬНИЦЕ',
        condition: () => myRoster.length > 0,
        getPlayer: () => randomChoice(myRoster),
        text: (p) => `Детская больница приглашает <b>${p.name}</b> навестить больных детей.`,
        choices: [
            { icon: '🙋', label: 'Навестить', desc: 'Просто прийти', apply: (p) => { upgrades.reputation = Math.min(25, upgrades.reputation + 1); p.loyalty = Math.min(100, p.loyalty + 5); return { text: 'Репутация +1, лояльность +5.', type: 'positive' }; } },
            { icon: '🎁', label: 'Купить подарки ($10K)', desc: 'С подарками', apply: (p) => { if (agentMoney < 10000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 10000; upgrades.reputation = Math.min(25, upgrades.reputation + 2); return { text: '−$10K, репутация +2.', type: 'positive' }; } },
            { icon: '🎪', label: 'Организовать шоу ($30K)', desc: 'Большое мероприятие', apply: (p) => { if (agentMoney < 30000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 30000; upgrades.reputation = Math.min(25, upgrades.reputation + 5); p.loyalty = Math.min(100, p.loyalty + 15); return { text: 'Отличный пиар! −$30K, репутация +5, лояльность +15.', type: 'positive' }; } },
            { icon: '❌', label: 'Отказать', desc: 'Нет времени', apply: (p) => { if (Math.random() < 0.2) { upgrades.reputation = Math.max(1, upgrades.reputation - 1); return { text: 'Пресса накатила. Репутация −1.', type: 'negative' }; } return { text: 'Ничего.', type: 'negative' }; } }
        ]
    },
    {
        id: 'podcast', icon: '🎙', title: 'ПОДКАСТ',
        condition: () => myRoster.some(p => p.rating >= 70),
        getPlayer: () => myRoster.find(p => p.rating >= 70),
        text: (p) => `Известный ведущий зовёт <b>${p.name}</b> на подкаст о хоккее.`,
        choices: [
            { icon: '✅', label: 'Согласиться', desc: 'Пусть расскажет', apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 5); upgrades.reputation = Math.min(25, upgrades.reputation + 1); return { text: 'Лояльность +5, репутация +1.', type: 'positive' }; } },
            { icon: '❌', label: 'Отказаться', desc: 'Не время', apply: (p) => { return { text: 'Отказались.', type: 'negative' }; } },
            { icon: '📚', label: 'С репетицией ($5K)', desc: 'Подготовить клиента', apply: (p) => { if (agentMoney < 5000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 5000; p.loyalty = Math.min(100, p.loyalty + 10); upgrades.reputation = Math.min(25, upgrades.reputation + 2); return { text: 'Прокачали навык. −$5K, репутация +2, лояльность +10.', type: 'positive' }; } },
            { icon: '💰', label: 'За деньги ($20K)', desc: 'Платный подкаст', apply: (p) => { if (Math.random() < 0.4) { agentMoney += 20000; return { text: 'Заплатили! +$20K.', type: 'positive' }; } upgrades.reputation = Math.max(1, upgrades.reputation - 2); return { text: 'Обиделись. Репутация −2.', type: 'negative' }; } }
        ]
    },

    // ============ КАТЕГОРИЯ 7. Интриги ============
    {
        id: 'rival_poach', icon: '🕵', title: 'КОНКУРЕНТ ПЕРЕМАНИВАЕТ',
        condition: () => myRoster.some(p => (p.loyalty ?? 100) < 70),
        getPlayer: () => myRoster.find(p => (p.loyalty ?? 100) < 70),
        text: (p) => `Другое агентство предлагает <b>${p.name}</b> контракт с лучшими условиями.`,
        choices: [
            { icon: '💰', label: 'Удержать деньгами ($50K)', desc: 'Дать бонус', apply: (p) => { if (agentMoney < 50000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 50000; p.loyalty = Math.min(100, p.loyalty + 25); return { text: 'Удержали! −$50K, лояльность +25.', type: 'positive' }; } },
            { icon: '🗣', label: 'Поговорить по душам', desc: 'Убедить остаться', apply: (p) => { if (Math.random() < 0.5) { p.loyalty = Math.min(100, p.loyalty + 15); return { text: 'Остался! Лояльность +15.', type: 'positive' }; } removeClientFromRoster(p); return { text: 'Ушёл к конкурентам.', type: 'negative' }; } },
            { icon: '😠', label: 'Угрожать конкуренту', desc: 'Показать, кто здесь главный', apply: (p) => { if (Math.random() < 0.3) return { text: 'Испугались.', type: 'positive' }; upgrades.reputation = Math.max(1, upgrades.reputation - 5); return { text: 'Они нажаловались. Репутация −5.', type: 'negative' }; } },
            { icon: '🚪', label: 'Отпустить', desc: 'Забрать компенсацию', apply: (p) => { agentMoney += 30000; removeClientFromRoster(p); return { text: 'Отпустил. +$30K.', type: 'negative' }; } }
        ]
    },
    {
        id: 'dirty_article', icon: '📰', title: 'ГРЯЗНАЯ СТАТЬЯ',
        condition: () => myRoster.length >= 5,
        getPlayer: () => myRoster[0],
        text: () => `Журналист опубликовал разгромную статью о твоём агентстве. Клиенты нервничают.`,
        choices: [
            { icon: '📢', label: 'Опровергнуть', desc: 'Публичный ответ', apply: () => { if (Math.random() < 0.6) return { text: 'Пресса поверила.', type: 'positive' }; upgrades.reputation = Math.max(1, upgrades.reputation - 2); return { text: 'Не поверили. Репутация −2.', type: 'negative' }; } },
            { icon: '😐', label: 'Игнорировать', desc: 'Пусть забудут', apply: () => { upgrades.reputation = Math.max(1, upgrades.reputation - 1); return { text: 'Репутация −1.', type: 'negative' }; } },
            { icon: '💰', label: 'Купить газету ($100K)', desc: 'Дорого, но надёжно', apply: () => { if (agentMoney < 100000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 100000; return { text: 'Статья исчезла. −$100K.', type: 'positive' }; } },
            { icon: '✍️', label: 'Ответная статья ($10K)', desc: 'Написать свою', apply: () => { if (agentMoney < 10000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 10000; upgrades.reputation = Math.min(25, upgrades.reputation + 1); return { text: 'Репутация +1.', type: 'positive' }; } }
        ]
    },
    {
        id: 'insider_leak', icon: '🕳', title: 'ИНСАЙД ИЗ ОФИСА',
        condition: () => myRoster.length >= 3,
        getPlayer: () => myRoster[0],
        text: () => `Бывший сотрудник украл список твоих клиентов. Грозит массовое переманивание.`,
        choices: [
            { icon: '⚖️', label: 'Судиться ($20K)', desc: 'Наказать вора', apply: () => { if (agentMoney < 20000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 20000; if (Math.random() < 0.6) { agentMoney += 50000; return { text: 'Выиграл суд! +$50K компенсации.', type: 'positive' }; } return { text: 'Проиграл дело.', type: 'negative' }; } },
            { icon: '🤐', label: 'Купить молчание ($30K)', desc: 'Тихо решить', apply: () => { if (agentMoney < 30000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 30000; return { text: 'Молчит. −$30K.', type: 'positive' }; } },
            { icon: '🚪', label: 'Уволить', desc: 'Уже уволен', apply: () => { return { text: 'Ничего.', type: 'negative' }; } },
            { icon: '👤', label: 'Нанять нового ($5K)', desc: 'Восстановить штат', apply: () => { if (agentMoney < 5000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 5000; return { text: 'Штат восстановлен. −$5K.', type: 'positive' }; } }
        ]
    },

    // ============ КАТЕГОРИЯ 8. Молодёжь (≤ 22 лет) ============
    {
        id: 'youth_school', icon: '🏫', title: 'СОБЛАЗН ШКОЛЫ',
        condition: () => myRoster.some(p => p.age <= 20),
        getPlayer: () => myRoster.find(p => p.age <= 20),
        text: (p) => `Престижная академия зовёт молодого <b>${p.name}</b>. Но там он потеряет игровую практику.`,
        choices: [
            { icon: '✅', label: 'Отпустить', desc: 'Топ-обучение', apply: (p) => { p.rating = Math.min(100, p.rating + 3); return { text: 'Развитие +3, но 8 недель без практики.', type: 'positive' }; } },
            { icon: '❌', label: 'Удержать', desc: 'Практика важнее', apply: (p) => { p.loyalty = Math.max(0, p.loyalty - 10); return { text: 'Обиделся. Лояльность −10.', type: 'negative' }; } },
            { icon: '🤝', label: 'Компромисс', desc: 'Совмещать', apply: (p) => { if (Math.random() < 0.6) { p.rating = Math.min(100, p.rating + 2); p.loyalty = Math.min(100, p.loyalty + 5); return { text: 'Совмещает! Рейтинг +2, лояльность +5.', type: 'positive' }; } return { text: 'Не получилось.', type: 'negative' }; } }
        ]
    },
    {
        id: 'youth_gaming', icon: '🎮', title: 'ИГРОВАЯ ЗАВИСИМОСТЬ',
        condition: () => myRoster.some(p => p.age <= 21),
        getPlayer: () => myRoster.find(p => p.age <= 21),
        text: (p) => `<b>${p.name}</b> зависает в играх и мало тренируется.`,
        choices: [
            { icon: '🗣', label: 'Поговорить', desc: 'Попробовать убедить', apply: (p) => { if (Math.random() < 0.5) { p.loyalty = Math.min(100, p.loyalty + 10); return { text: 'Понял. Лояльность +10.', type: 'positive' }; } return { text: 'Не понял.', type: 'negative' }; } },
            { icon: '💻', label: 'Купить новый ПК ($5K)', desc: 'Разрешить хобби', apply: (p) => { if (agentMoney < 5000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 5000; p.loyalty = Math.min(100, p.loyalty + 5); p.rating = Math.max(1, p.rating - 2); return { text: '−$5K, но рейтинг −2.', type: 'negative' }; } },
            { icon: '👨‍🏫', label: 'Наставник ($15K)', desc: 'Приставить тренера', apply: (p) => { if (agentMoney < 15000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 15000; p.rating = Math.min(100, p.rating + 2); p.loyalty = Math.min(100, p.loyalty + 10); return { text: 'Профессионал подтянул. Рейтинг +2, лояльность +10.', type: 'positive' }; } },
            { icon: '😐', label: 'Игнорировать', desc: 'Само пройдёт', apply: (p) => { p.rating = Math.max(1, p.rating - 2); return { text: 'Рейтинг −2.', type: 'negative' }; } }
        ]
    },
    {
        id: 'youth_breakup', icon: '💔', title: 'РАССТАВАНИЕ С ДЕВУШКОЙ',
        condition: () => myRoster.some(p => p.age <= 22),
        getPlayer: () => myRoster.find(p => p.age <= 22),
        text: (p) => `Молодой <b>${p.name}</b> убит горем после расставания. Играть не может.`,
        choices: [
            { icon: '🫂', label: 'Поддержать', desc: 'Просто быть рядом', apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 15); return { text: 'Лояльность +15.', type: 'positive' }; } },
            { icon: '🧠', label: 'Психолог ($10K)', desc: 'Профессиональная помощь', apply: (p) => { if (agentMoney < 10000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 10000; p.loyalty = Math.min(100, p.loyalty + 20); p.rating = Math.min(100, p.rating + 1); return { text: 'Помогло! −$10K, лояльность +20, рейтинг +1.', type: 'positive' }; } },
            { icon: '💘', label: 'Устроить знакомство', desc: 'Найти новую девушку', apply: (p) => { if (Math.random() < 0.3) { p.loyalty = Math.min(100, p.loyalty + 15); return { text: 'Получилось! Лояльность +15.', type: 'positive' }; } return { text: 'Не сработало.', type: 'negative' }; } },
            { icon: '🏒', label: 'Отвлечь работой', desc: 'Залить хоккеем', apply: (p) => { p.loyalty = Math.max(0, p.loyalty - 5); p.rating = Math.min(100, p.rating + 1); return { text: 'Работа помогла. Рейтинг +1, лояльность −5.', type: 'negative' }; } }
        ]
    },
    {
        id: 'youth_tiktok', icon: '📱', title: 'ТИКТОК-СЛАВА',
        condition: () => myRoster.some(p => p.age <= 23),
        getPlayer: () => myRoster.find(p => p.age <= 23),
        text: (p) => `<b>${p.name}</b> стал вирусным в соцсетях. Миллион лайков, но тренировки заброшены.`,
        choices: [
            { icon: '📈', label: 'Воспользоваться', desc: 'Развить популярность', apply: (p) => { upgrades.reputation = Math.min(25, upgrades.reputation + 3); p.rating = Math.max(1, p.rating - 1); return { text: 'Репутация +3, но рейтинг −1.', type: 'positive' }; } },
            { icon: '❌', label: 'Запретить', desc: 'Только хоккей', apply: (p) => { p.loyalty = Math.max(0, p.loyalty - 15); return { text: 'Обиделся. Лояльность −15.', type: 'negative' }; } },
            { icon: '⚖️', label: 'Ограничить', desc: '1 час в день', apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 3); return { text: 'Согласился. Лояльность +3.', type: 'positive' }; } },
            { icon: '🕊', label: 'Свобода', desc: 'Пусть развлекается', apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 10); p.rating = Math.max(1, p.rating - 2); return { text: 'Лояльность +10, рейтинг −2.', type: 'negative' }; } }
        ]
    },

    // ============ КАТЕГОРИЯ 9. Международные ============
    {
        id: 'national_team', icon: '🌍', title: 'ВЫЗОВ В СБОРНУЮ',
        condition: () => myRoster.some(p => p.rating >= 75 && ['NHL','KHL','SHL','Liiga','NL_Switzerland','Czech_Extraliga'].includes(p.league)),
        getPlayer: () => myRoster.find(p => p.rating >= 75 && ['NHL','KHL','SHL','Liiga','NL_Switzerland','Czech_Extraliga'].includes(p.league)),
        text: (p) => `<b>${p.name}</b> вызван в сборную на товарищеские матчи.`,
        choices: [
            { icon: '✅', label: 'Отпустить', desc: 'Честь страны', apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 10); upgrades.reputation = Math.min(25, upgrades.reputation + 2); if (Math.random() < 0.1) { p.injuryWeeks = 2; return { text: 'Травма в сборной! Лояльность +10, репутация +2, 2 недели отдыха.', type: 'negative' }; } return { text: 'Лояльность +10, репутация +2.', type: 'positive' }; } },
            { icon: '❌', label: 'Отказать', desc: 'Клуб важнее', apply: (p) => { upgrades.reputation = Math.max(1, upgrades.reputation - 2); p.loyalty = Math.max(0, p.loyalty - 10); return { text: 'Репутация −2, лояльность −10.', type: 'negative' }; } },
            { icon: '💬', label: 'Попросить выходной', desc: 'Один матч', apply: (p) => { if (Math.random() < 0.5) { p.loyalty = Math.min(100, p.loyalty + 5); return { text: 'Согласились. Лояльность +5.', type: 'positive' }; } return { text: 'Отказали.', type: 'negative' }; } },
            { icon: '📝', label: 'С условием страховки', desc: 'Только без травм', apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 5); upgrades.reputation = Math.min(25, upgrades.reputation + 1); return { text: 'Договорились. Лояльность +5, репутация +1.', type: 'positive' }; } }
        ]
    },
    {
        id: 'citizenship_change', icon: '🏳️', title: 'СМЕНА ГРАЖДАНСТВА',
        condition: () => myRoster.some(p => p.age >= 25 && !isInHomeCountry(p)),
        getPlayer: () => myRoster.find(p => p.age >= 25 && !isInHomeCountry(p)),
        text: (p) => `Другая страна предлагает <b>${p.name}</b> сменить спортивное гражданство. Шанс на Олимпиаду.`,
        choices: [
            { icon: '✅', label: 'Разрешить', desc: 'Больше возможностей', apply: (p) => { if (Math.random() < 0.6) { p.rating = Math.min(100, p.rating + 2); return { text: 'Новые возможности! Рейтинг +2.', type: 'positive' }; } upgrades.reputation = Math.max(1, upgrades.reputation - 3); return { text: 'Фанаты обижены. Репутация −3.', type: 'negative' }; } },
            { icon: '❌', label: 'Отговорить', desc: 'Родина одна', apply: (p) => { p.loyalty = Math.max(0, p.loyalty - 15); return { text: 'Обиделся. Лояльность −15.', type: 'negative' }; } },
            { icon: '💰', label: 'Торговаться ($30K)', desc: 'Взять за согласие', apply: (p) => { agentMoney += 30000; return { text: '+$30K.', type: 'positive' }; } },
            { icon: '😐', label: 'Игнорировать', desc: 'Пусть решает сам', apply: (p) => { if (Math.random() < 0.5) { p.loyalty = Math.min(100, p.loyalty + 5); } return { text: 'Клиент сам решил.', type: 'negative' }; } }
        ]
    },
    {
        id: 'visa_issue', icon: '🛂', title: 'ПРОБЛЕМА С ВИЗОЙ',
        condition: () => myRoster.some(p => p.club && !isInHomeCountry(p)),
        getPlayer: () => myRoster.find(p => p.club && !isInHomeCountry(p)),
        text: (p) => `У <b>${p.name}</b> проблемы с визой. Может потерять право на работу.`,
        choices: [
            { icon: '⚖️', label: 'Адвокат ($20K)', desc: 'Профессиональная помощь', apply: (p) => { if (agentMoney < 20000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 20000; if (Math.random() < 0.8) return { text: 'Виза получена! −$20K.', type: 'positive' }; return { text: 'Не помогло.', type: 'negative' }; } },
            { icon: '🏠', label: 'Вернуться домой', desc: 'Решить кардинально', apply: (p) => { p.rating = Math.max(1, p.rating - 5); createTask({ type: 'find_club_home', playerName: p.name, description: `Найти ${p.name} клуб дома`, icon: '🏠', deadlineWeeks: 12, reward: { loyalty: 10 }, penalty: { loyalty: -15 } }); return { text: 'Ищем клуб дома. Рейтинг −5.', type: 'negative' }; } },
            { icon: '💰', label: 'Заплатить ($50K)', desc: 'Дорого, но быстро', apply: (p) => { if (agentMoney < 50000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 50000; return { text: 'Виза ускорена. −$50K.', type: 'positive' }; } },
            { icon: '🔄', label: 'Сменить клуб', desc: 'Найти в другой стране', apply: (p) => { createTask({ type: 'find_club_same', playerName: p.name, description: `Перевести ${p.name} в другой клуб`, icon: '🔄', deadlineWeeks: 4, reward: { loyalty: 5 }, penalty: { loyalty: -10 } }); return { text: 'Ищем новый клуб.', type: 'positive' }; } }
        ]
    },
    {
        id: 'world_cup', icon: '🏆', title: 'КУБОК МИРА',
        condition: () => myRoster.some(p => p.rating >= 78 && ['NHL','KHL','SHL','Liiga','NL_Switzerland','Czech_Extraliga'].includes(p.league)),
        getPlayer: () => myRoster.find(p => p.rating >= 78 && ['NHL','KHL','SHL','Liiga','NL_Switzerland','Czech_Extraliga'].includes(p.league)),
        text: (p) => `<b>${p.name}</b> вызван на Кубок мира! Огромный турнир.`,
        choices: [
            { icon: '✅', label: 'Отпустить', desc: 'Честь страны', apply: (p) => { upgrades.reputation = Math.min(25, upgrades.reputation + 5); p.loyalty = Math.min(100, p.loyalty + 20); if (Math.random() < 0.15) { p.injuryWeeks = 3; return { text: 'Травма! Но репутация +5, лояльность +20.', type: 'negative' }; } if (Math.random() < 0.3) { agentMoney += 100000; upgrades.reputation = Math.min(25, upgrades.reputation + 5); return { text: 'MVP турнира! +$100K, репутация +10, лояльность +20.', type: 'positive' }; } return { text: 'Успех! Репутация +5, лояльность +20.', type: 'positive' }; } },
            { icon: '❌', label: 'Отказать', desc: 'Клуб важнее', apply: (p) => { upgrades.reputation = Math.max(1, upgrades.reputation - 3); p.loyalty = Math.max(0, p.loyalty - 30); return { text: 'Репутация −3, лояльность −30.', type: 'negative' }; } },
            { icon: '📝', label: 'С условием страховки', desc: 'Только без травм', apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 10); upgrades.reputation = Math.min(25, upgrades.reputation + 2); if (Math.random() < 0.2) { agentMoney += 100000; return { text: 'MVP! +$100K, репутация +2, лояльность +10.', type: 'positive' }; } return { text: 'Успех. Репутация +2, лояльность +10.', type: 'positive' }; } },
            { icon: '🎯', label: 'Лично сопровождать ($30K)', desc: 'Помогать на турнире', apply: (p) => { if (agentMoney < 30000) return { text: 'Недостаточно денег.', type: 'negative', skip: true }; agentMoney -= 30000; upgrades.reputation = Math.min(25, upgrades.reputation + 5); p.loyalty = Math.min(100, p.loyalty + 25); if (Math.random() < 0.5) { agentMoney += 200000; return { text: 'MVP! −$30K, +$200K, репутация +5, лояльность +25.', type: 'positive' }; } return { text: 'Помог! −$30K, репутация +5, лояльность +25.', type: 'positive' }; } }
        ]
    }
];

// ============ ЦЕПОЧКИ ============
EVENT_CHAINS.bad_press_chain = {
    id: 'bad_press_chain',
    title: 'Скандальное интервью',
    stages: [
        {
            icon: '🎤', title: 'НЕУДАЧНОЕ ИНТЕРВЬЮ', triggerWeek: 0,
            getPlayer: () => myRoster.find(p => p.club && p.rating >= 65),
            text: (p) => `<b>${p.name}</b> наговорил лишнего журналистам после матча — раскритиковал тренера. Клуб в ярости.`,
            choices: [
                { icon: '🙏', label: 'Извиниться', desc: 'Сгладить конфликт',
                  apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 5); return { text: 'Клуб принял извинения. Лояльность +5.', type: 'positive' }; } },
                { icon: '🛡', label: 'Поддержать клиента', desc: '«Он прав»',
                  apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 15); upgrades.reputation = Math.max(1, upgrades.reputation - 2); return { text: 'Лояльность +15, репутация −2.', type: 'positive' }; } }
            ]
        },
        {
            icon: '📞', title: 'ТРЕНЕР ВЫЗЫВАЕТ «НА КОВЁР»', triggerWeek: 2,
            getPlayer: () => null,
            requiresPlayer: false,
            text: () => `Тренер клуба недоволен. Требует, чтобы ты лично приехал и «уладил вопрос».`,
            choices: [
                { icon: '🤝', label: 'Приехать поговорить', desc: 'Личный визит',
                  apply: () => { return { text: 'Тренер смягчился. Конфликт исчерпан.', type: 'positive' }; } },
                { icon: '📞', label: 'Позвонить', desc: 'По телефону',
                  apply: () => { if (Math.random() < 0.5) return { text: 'Разговор удался.', type: 'positive' }; return { text: 'Тренер в бешенстве.', type: 'negative' }; } },
                { icon: '🚫', label: 'Игнорировать', desc: 'Не приеду',
                  apply: () => { return { text: 'Тренер запомнил. Проблемы будут.', type: 'negative' }; } }
            ]
        },
        {
            icon: '📰', title: 'ВТОРАЯ ВОЛНА', triggerWeek: 4,
            getPlayer: () => myRoster.find(p => p.club && p.rating >= 65),
            text: (p) => `Журналист публикует <b>вторую статью</b>, теперь уже с цитатами других игроков. Скандал разрастается.`,
            choices: [
                { icon: '💰', label: 'Купить газету ($50K)', desc: 'Дорого, но тихо',
                  apply: (p) => { if (agentMoney < 50000) return { text: 'Недостаточно денег.', skip: true }; agentMoney -= 50000; p.loyalty = Math.min(100, p.loyalty + 10); return { text: 'Историю заглушили. −$50K, лояльность +10.', type: 'positive' }; } },
                { icon: '📢', label: 'Ответная статья ($10K)', desc: 'Своя версия',
                  apply: (p) => { if (agentMoney < 10000) return { text: 'Недостаточно денег.', skip: true }; agentMoney -= 10000; upgrades.reputation = Math.min(25, upgrades.reputation + 1); p.loyalty = Math.min(100, p.loyalty + 5); return { text: 'Общественность на твоей стороне. Репутация +1, лояльность +5.', type: 'positive' }; } },
                { icon: '😐', label: 'Промолчать', desc: 'Само утихнет',
                  apply: (p) => { p.loyalty = Math.max(0, p.loyalty - 10); upgrades.reputation = Math.max(1, upgrades.reputation - 1); return { text: 'Репутация −1, лояльность −10.', type: 'negative' }; } }
            ]
        },
        {
            icon: '🏆', title: 'ФИНАЛ ИСТОРИИ', triggerWeek: 6,
            getPlayer: () => myRoster.find(p => p.club && p.rating >= 65),
            text: (p) => `Скандал утих. Клуб решает судьбу <b>${p.name}</b>.`,
            choices: [
                { icon: '✅', label: 'Принять любое решение', desc: 'Смириться',
                  apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 10); upgrades.reputation = Math.min(25, upgrades.reputation + 2); addXP(300); return { text: 'История закончилась достойно. Лояльность +10, репутация +2, XP +300.', type: 'positive' }; } }
            ]
        }
    ]
};

EVENT_CHAINS.rival_war = {
    id: 'rival_war',
    title: 'Война с конкурентом',
    stages: [
        {
            icon: '📰', title: 'КОНКУРЕНТ ПИШЕТ О ТЕБЕ', triggerWeek: 0,
            getPlayer: () => null,
            requiresPlayer: false,
            text: () => `Крупное агентство опубликовало статью, где высмеивает твои методы работы.`,
            choices: [
                { icon: '📢', label: 'Ответить публично', desc: 'Показать зубы',
                  apply: () => { upgrades.reputation = Math.min(25, upgrades.reputation + 2); return { text: 'Публика поддержала. Репутация +2.', type: 'positive' }; } },
                { icon: '😐', label: 'Проигнорировать', desc: 'Не опускаться',
                  apply: () => { return { text: 'Молчание — золото.', type: 'positive' }; } },
                { icon: '💰', label: 'Купить их статью ($30K)', desc: 'Тихо решить',
                  apply: () => { if (agentMoney < 30000) return { text: 'Недостаточно денег.', skip: true }; agentMoney -= 30000; return { text: 'Статья исчезла. −$30K.', type: 'positive' }; } }
            ]
        },
        {
            icon: '🕵', title: 'ОНИ БЬЮТ ПО КЛИЕНТАМ', triggerWeek: 3,
            getPlayer: () => myRoster.find(p => (p.loyalty ?? 100) < 70),
            text: (p) => `Агентство предлагает <b>${p.name}</b> переход к ним с большим бонусом.`,
            choices: [
                { icon: '💰', label: 'Удержать деньгами ($40K)', desc: 'Заплатить',
                  apply: (p) => { if (agentMoney < 40000) return { text: 'Недостаточно денег.', skip: true }; agentMoney -= 40000; p.loyalty = Math.min(100, p.loyalty + 20); return { text: 'Удержали! −$40K, лояльность +20.', type: 'positive' }; } },
                { icon: '🗣', label: 'Поговорить', desc: 'По-человечески',
                  apply: (p) => { if (Math.random() < 0.5) { p.loyalty = Math.min(100, p.loyalty + 15); return { text: 'Остался! Лояльность +15.', type: 'positive' }; } removeClientFromRoster(p); return { text: 'Ушёл.', type: 'negative' }; } },
                { icon: '🚪', label: 'Отпустить', desc: 'Забрать компенсацию',
                  apply: (p) => { agentMoney += 30000; removeClientFromRoster(p); return { text: '+$30K компенсации.', type: 'negative' }; } }
            ]
        },
        {
            icon: '📞', title: 'ЗВОНОК ОТ ИХ БОССА', triggerWeek: 6,
            getPlayer: () => null,
            requiresPlayer: false,
            text: () => `Глава их агентства лично звонит. Предлагает «мирное соглашение»: не трогать друг друга.`,
            choices: [
                { icon: '🤝', label: 'Согласиться', desc: 'Мир выгоден',
                  apply: () => { upgrades.reputation = Math.min(25, upgrades.reputation + 3); return { text: 'Мир заключён. Репутация +3.', type: 'positive' }; } },
                { icon: '⚔️', label: 'Объявить войну', desc: 'Битва до конца',
                  apply: () => { if (Math.random() < 0.5) { upgrades.reputation = Math.min(25, upgrades.reputation + 5); agentMoney += 50000; return { text: 'Ты победил! +$50K, репутация +5.', type: 'positive' }; } agentMoney -= 30000; return { text: 'Проиграл. −$30K.', type: 'negative' }; } },
                { icon: '🎯', label: 'Торговаться', desc: 'Забрать часть их клиентов',
                  apply: () => { if (Math.random() < 0.4) { agentMoney += 20000; return { text: 'Получил 2 клиентов! +$20K.', type: 'positive' }; } return { text: 'Они не согласились.', type: 'negative' }; } }
            ]
        }
    ]
};

// ============ ОСТАЛЬНЫЕ 12 ЦЕПОЧЕК ============

// Ц3. Допинг-скандал (4 этапа)
EVENT_CHAINS.doping_chain = {
    id: 'doping_chain', title: 'Допинг-скандал',
    stages: [
        { icon: '💊', title: 'ПОДОЗРЕНИЯ В ДОПИНГЕ', triggerWeek: 0,
          getPlayer: () => myRoster.find(p => p.rating >= 78),
          text: (p) => `Проба клиента <b>${p.name}</b> дала сомнительный результат. Возможна дисквалификация.`,
          choices: [
            { icon: '⚖️', label: 'Нанять адвоката ($50K)', desc: 'Лучшая защита',
              apply: (p) => { if (agentMoney < 50000) return { text: 'Недостаточно денег.', skip: true }; agentMoney -= 50000; p.loyalty = Math.min(100, p.loyalty + 15); return { text: 'Адвокат взялся за дело. −$50K.', type: 'positive' }; } },
            { icon: '🤫', label: 'Тихо решить', desc: 'Без огласки',
              apply: (p) => { return { text: 'Пробуем замять.', type: 'negative' }; } },
            { icon: '📢', label: 'Опровергнуть', desc: 'Публично',
              apply: (p) => { upgrades.reputation = Math.max(1, upgrades.reputation - 2); return { text: 'Репутация −2.', type: 'negative' }; } }
          ] },
        { icon: '🔬', title: 'ВТОРАЯ ПРОБА', triggerWeek: 2,
          getPlayer: () => null, requiresPlayer: false,
          text: () => `Взята вторая проба. Результат станет известен через 2 недели.`,
          choices: [
            { icon: '💰', label: 'Нанять эксперта ($30K)', desc: 'Своего специалиста',
              apply: () => { if (agentMoney < 30000) return { text: 'Недостаточно денег.', skip: true }; agentMoney -= 30000; return { text: 'Эксперт на нашей стороне. −$30K.', type: 'positive' }; } },
            { icon: '🙏', label: 'Публично поддержать', desc: '«Он чист»',
              apply: () => { upgrades.reputation = Math.min(25, upgrades.reputation + 2); return { text: 'Репутация +2.', type: 'positive' }; } },
            { icon: '⏳', label: 'Ждать', desc: 'Молча',
              apply: () => { return { text: 'Ждём результат.', type: 'negative' }; } }
          ] },
        { icon: '🏛', title: 'СЛУШАНИЕ', triggerWeek: 4,
          getPlayer: () => myRoster.find(p => p.rating >= 78),
          text: (p) => `Слушание по делу <b>${p.name}</b>. Судьба игрока в твоих руках.`,
          choices: [
            { icon: '✅', label: 'Признать вину', desc: 'Пойти на сделку',
              apply: (p) => { p.loyalty = Math.max(0, p.loyalty - 20); p.injuryWeeks = 4; return { text: 'Сделка: 4 недели дисквалификации. Лояльность −20.', type: 'negative' }; } },
            { icon: '⚔️', label: 'Оспорить', desc: 'До конца',
              apply: (p) => { if (Math.random() < 0.6) { p.loyalty = Math.min(100, p.loyalty + 20); return { text: 'Оправдан! Лояльность +20.', type: 'positive' }; } p.injuryWeeks = 8; p.loyalty = Math.max(0, p.loyalty - 30); return { text: 'Дисквалификация 8 недель. Лояльность −30.', type: 'negative' }; } }
          ] },
        { icon: '📋', title: 'ИТОГ', triggerWeek: 6,
          getPlayer: () => myRoster.find(p => p.rating >= 78),
          text: (p) => `Дело закрыто. Как сложилась судьба <b>${p.name}</b>.`,
          choices: [
            { icon: '✅', label: 'Принять', desc: 'Что есть',
              apply: (p) => { addXP(400); return { text: 'История закончилась. +400 XP.', type: 'positive' }; } }
          ] }
    ]
};

// Ц4. Возвращение домой (4 этапа)
EVENT_CHAINS.home_return_chain = {
    id: 'home_return_chain', title: 'Возвращение домой',
    stages: [
        { icon: '🏠', title: 'СЕМЕЙНЫЕ ОБСТОЯТЕЛЬСТВА', triggerWeek: 0,
          getPlayer: () => myRoster.find(p => p.club && !isInHomeCountry(p)),
          text: (p) => `У <b>${p.name}</b> жена беременна. Хочет вернуться в родную страну.`,
          choices: [
{ icon: '✅', label: 'Пообещать помочь', desc: 'Найти клуб дома',
  apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 15); createTask({ type: 'find_club_home', playerName: p.name, description: `Вернуть ${p.name} домой`, icon: '🏠', deadlineWeeks: 16, reward: { loyalty: 20, xp: 400 }, penalty: { loyalty: -25 }, params: { originalClub: p.club, originalLeague: p.league } }); return { text: 'Обещание дано. Задача в активных.', type: 'positive' }; } },
            { icon: '💰', label: 'Оплатить перелёты ($15K)', desc: 'Пусть семья приедет',
              apply: (p) => { if (agentMoney < 15000) return { text: 'Недостаточно денег.', skip: true }; agentMoney -= 15000; p.loyalty = Math.min(100, p.loyalty + 25); return { text: 'Семья рядом. −$15K, лояльность +25.', type: 'positive' }; } }
          ] },
        { icon: '📞', title: 'ПЕРВЫЙ ЗВОНОК', triggerWeek: 3,
          getPlayer: () => myRoster.find(p => p.club && !isInHomeCountry(p)),
          text: (p) => `<b>${p.name}</b> звонит: «Ты нашёл клуб? Семья ждёт».`,
          choices: [
            { icon: '🤝', label: 'Сказать «работаю»', desc: 'Успокоить',
              apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 5); return { text: 'Лояльность +5.', type: 'positive' }; } },
            { icon: '💬', label: 'Честно объяснить', desc: 'Что сложно',
              apply: (p) => { if (Math.random() < 0.5) { p.loyalty = Math.min(100, p.loyalty + 3); return { text: 'Понял. Лояльность +3.', type: 'positive' }; } p.loyalty = Math.max(0, p.loyalty - 15); return { text: 'Обиделся. Лояльность −15.', type: 'negative' }; } }
          ] },
        { icon: '🏒', title: 'ПРЕДЛОЖЕНИЕ ОТ СТАРОГО КЛУБА', triggerWeek: 7,
          getPlayer: () => myRoster.find(p => p.club && !isInHomeCountry(p)),
          text: (p) => `Старый клуб <b>${p.name}</b> из родной страны предлагает контракт.`,
          choices: [
            { icon: '✅', label: 'Принять', desc: 'Домой',
              apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 15); return { text: 'Готовы к переходу. Лояльность +15.', type: 'positive' }; } },
            { icon: '🤔', label: 'Подумать', desc: 'Не торопиться',
              apply: (p) => { p.loyalty = Math.max(0, p.loyalty - 5); return { text: 'Клиент нервничает. Лояльность −5.', type: 'negative' }; } }
          ] },
        { icon: '🏡', title: 'ФИНАЛ', triggerWeek: 12,
          getPlayer: () => myRoster.find(p => p.club && !isInHomeCountry(p)),
          text: (p) => `Что решил <b>${p.name}</b>.`,
          choices: [
            { icon: '✅', label: 'Принять', desc: 'Как есть',
              apply: (p) => { addXP(300); return { text: 'История завершена. +300 XP.', type: 'positive' }; } }
          ] }
    ]
};

// Ц5. Конфликт с тренером (3 этапа)
EVENT_CHAINS.coach_conflict_chain = {
    id: 'coach_conflict_chain', title: 'Конфликт с тренером',
    stages: [
        { icon: '🥊', title: 'КОНФЛИКТ С ТРЕНЕРОМ', triggerWeek: 0,
          getPlayer: () => myRoster.find(p => p.club && p.rating >= 60 && p.rating <= 80),
          text: (p) => `Тренер не ставит <b>${p.name}</b> в состав 4 матча подряд.`,
          choices: [
            { icon: '📢', label: 'Публично возмутиться', desc: 'Давить',
              apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 15); upgrades.reputation = Math.max(1, upgrades.reputation - 3); return { text: 'Лояльность +15, репутация −3.', type: 'positive' }; } },
            { icon: '🤝', label: 'Поговорить с тренером', desc: 'Тихо',
              apply: (p) => { if (Math.random() < 0.7) { p.loyalty = Math.min(100, p.loyalty + 10); return { text: 'Сработало! Лояльность +10.', type: 'positive' }; } p.loyalty = Math.max(0, p.loyalty - 5); return { text: 'Тренер упёрся. Лояльность −5.', type: 'negative' }; } },
            { icon: '😐', label: '«Терпи»', desc: 'Пусть докажет',
              apply: (p) => { p.loyalty = Math.max(0, p.loyalty - 15); return { text: 'Обиделся. Лояльность −15.', type: 'negative' }; } }
          ] },
        { icon: '📺', title: 'ТРЕНЕР ДАЁТ ИНТЕРВЬЮ', triggerWeek: 2,
          getPlayer: () => null, requiresPlayer: false,
          text: () => `Тренер публично критикует игрока в интервью. Скандал разгорается.`,
          choices: [
            { icon: '📢', label: 'Ответить публично', desc: 'Защитить',
              apply: (p) => { upgrades.reputation = Math.max(1, upgrades.reputation - 2); return { text: 'Ответил. Репутация −2.', type: 'negative' }; } },
            { icon: '🤐', label: 'Промолчать', desc: 'Не подливать масла',
              apply: (p) => { return { text: 'Скандал утихнет.', type: 'positive' }; } },
            { icon: '📞', label: 'Пожаловаться в клуб', desc: 'Пусть разберутся',
              apply: (p) => { if (Math.random() < 0.4) return { text: 'Клуб вмешался.', type: 'positive' }; upgrades.reputation = Math.max(1, upgrades.reputation - 1); return { text: 'Клуб не помог. Репутация −1.', type: 'negative' }; } }
          ] },
        { icon: '🎯', title: 'ИТОГ', triggerWeek: 5,
          getPlayer: () => myRoster.find(p => p.club),
          text: (p) => `Клуб решает судьбу <b>${p.name}</b>.`,
          choices: [
            { icon: '✅', label: 'Принять', desc: 'Как есть',
              apply: (p) => { addXP(200); return { text: 'История завершена. +200 XP.', type: 'positive' }; } }
          ] }
    ]
};

// Ц6. Финансовая пирамида (3 этапа)
EVENT_CHAINS.crypto_scheme_chain = {
    id: 'crypto_scheme_chain', title: 'Финансовая пирамида',
    stages: [
        { icon: '💎', title: 'ИНВЕСТОР ПРЕДЛАГАЕТ ПРОЕКТ', triggerWeek: 0,
          getPlayer: () => myRoster.find(p => p.rating >= 75),
          text: (p) => `Сомнительный инвестор предлагает вложиться в «крипто-проект» для клиента ${p.name}.`,
          choices: [
            { icon: '💰', label: 'Вложить $30K', desc: 'Рискнуть',
              apply: (p) => { if (agentMoney < 30000) return { text: 'Недостаточно денег.', skip: true }; agentMoney -= 30000; return { text: '−$30K вложено.', type: 'positive' }; } },
            { icon: '🔍', label: 'Проверить $5K', desc: 'Осторожно',
              apply: (p) => { if (agentMoney < 5000) return { text: 'Недостаточно денег.', skip: true }; agentMoney -= 5000; return { text: 'Проверка запущена. −$5K.', type: 'positive' }; } },
            { icon: '❌', label: 'Отказаться', desc: 'Не связываться',
              apply: (p) => { return { text: 'Отказ. Безопасно.', type: 'positive' }; } }
          ] },
        { icon: '📈', title: 'ПЕРВАЯ ПРИБЫЛЬ', triggerWeek: 3,
          getPlayer: () => null, requiresPlayer: false,
          text: () => `Проект показывает прибыль! $50K на счету. Вывести или оставить?`,
          choices: [
            { icon: '💸', label: 'Вывести $50K', desc: 'Забрать',
              apply: () => { agentMoney += 50000; return { text: '+$50K выведено.', type: 'positive' }; } },
            { icon: '📊', label: 'Оставить', desc: 'Может вырасти',
              apply: () => { return { text: 'Оставляем.', type: 'positive' }; } }
          ] },
        { icon: '📉', title: 'ПРОЕКТ РУШИТСЯ', triggerWeek: 6,
          getPlayer: () => null, requiresPlayer: false,
          text: () => `Проект рухнул! Потеря $80K или вложить ещё?`,
          choices: [
            { icon: '🚪', label: 'Принять убыток', desc: 'Выйти',
              apply: () => { agentMoney -= 80000; return { text: '−$80K. Урок получен.', type: 'negative' }; } },
            { icon: '💰', label: 'Вложить ещё $40K', desc: 'Отбить',
              apply: () => { agentMoney -= 40000; if (Math.random() < 0.2) { agentMoney += 200000; return { text: 'Невероятно — удача! +$200K!', type: 'positive' }; } return { text: 'Провал. −$40K ещё.', type: 'negative' }; } }
          ] }
    ]
};

// Ц7. Воспитание юниора (3 этапа)
EVENT_CHAINS.youth_growth_chain = {
    id: 'youth_growth_chain', title: 'Воспитание юниора',
    stages: [
        { icon: '👶', title: 'ПЕРВЫЙ ДЕБЮТ', triggerWeek: 0,
          getPlayer: () => myRoster.find(p => p.age <= 18),
          text: (p) => `Молодой <b>${p.name}</b> дебютирует. Нервничает перед матчем.`,
          choices: [
            { icon: '🗣', label: 'Поговорить', desc: 'Поддержать',
              apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 15); return { text: 'Лояльность +15.', type: 'positive' }; } },
            { icon: '🧠', label: 'Психолог ($10K)', desc: 'Профессионал',
              apply: (p) => { if (agentMoney < 10000) return { text: 'Недостаточно денег.', skip: true }; agentMoney -= 10000; p.loyalty = Math.min(100, p.loyalty + 25); return { text: '−$10K, лояльность +25.', type: 'positive' }; } },
            { icon: '🎬', label: 'Привезти семью ($5K)', desc: 'На матч',
              apply: (p) => { if (agentMoney < 5000) return { text: 'Недостаточно денег.', skip: true }; agentMoney -= 5000; p.loyalty = Math.min(100, p.loyalty + 20); return { text: '−$5K, лояльность +20.', type: 'positive' }; } }
          ] },
        { icon: '🏒', title: 'ПЕРВЫЙ ГОЛ', triggerWeek: 4,
          getPlayer: () => myRoster.find(p => p.age <= 19),
          text: (p) => `У <b>${p.name}</b> первый гол в карьере!`,
          choices: [
            { icon: '🎉', label: 'Поздравить', desc: 'Похвалить',
              apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 10); return { text: 'Лояльность +10.', type: 'positive' }; } },
            { icon: '🎁', label: 'Подарок ($10K)', desc: 'Дорогой',
              apply: (p) => { if (agentMoney < 10000) return { text: 'Недостаточно денег.', skip: true }; agentMoney -= 10000; p.loyalty = Math.min(100, p.loyalty + 20); return { text: '−$10K, лояльность +20.', type: 'positive' }; } }
          ] },
        { icon: '🌟', title: 'ИТОГ', triggerWeek: 10,
          getPlayer: () => myRoster.find(p => p.age <= 20),
          text: (p) => `Итог первого сезона <b>${p.name}</b>.`,
          choices: [
            { icon: '✅', label: 'Принять', desc: 'Как есть',
              apply: (p) => { p.rating = Math.min(100, p.rating + 2); addXP(300); return { text: 'Рейтинг +2, XP +300.', type: 'positive' }; } }
          ] }
    ]
};

// Ц8. Агент-филантроп (3 этапа)
EVENT_CHAINS.philanthropy_chain = {
    id: 'philanthropy_chain', title: 'Агент-филантроп',
    stages: [
        { icon: '🎗', title: 'МАСТЕР-КЛАСС', triggerWeek: 0,
          getPlayer: () => myRoster.find(p => p.rating >= 70),
          text: (p) => `Детский фонд приглашает <b>${p.name}</b> на мастер-класс.`,
          choices: [
            { icon: '✅', label: 'Согласиться', desc: 'Помочь',
              apply: (p) => { upgrades.reputation = Math.min(25, upgrades.reputation + 2); p.loyalty = Math.min(100, p.loyalty + 10); return { text: 'Репутация +2, лояльность +10.', type: 'positive' }; } },
            { icon: '💰', label: 'Оплатить ($5K)', desc: 'Свои деньги',
              apply: (p) => { if (agentMoney < 5000) return { text: 'Недостаточно денег.', skip: true }; agentMoney -= 5000; upgrades.reputation = Math.min(25, upgrades.reputation + 3); return { text: 'Репутация +3. −$5K.', type: 'positive' }; } }
          ] },
        { icon: '📞', title: 'ФОНД ЗОВЁТ ДАЛЬШЕ', triggerWeek: 4,
          getPlayer: () => null, requiresPlayer: false,
          text: () => `Фонд предлагает стать послом программы. Большая честь, но много времени.`,
          choices: [
            { icon: '✅', label: 'Согласиться', desc: 'Помочь',
              apply: () => { upgrades.reputation = Math.min(25, upgrades.reputation + 3); return { text: 'Репутация +3.', type: 'positive' }; } },
            { icon: '❌', label: 'Отказать', desc: 'Нет времени',
              apply: () => { return { text: 'Отказ.', type: 'negative' }; } }
          ] },
        { icon: '🏆', title: 'НАГРАЖДЕНИЕ', triggerWeek: 8,
          getPlayer: () => null, requiresPlayer: false,
          text: () => `Церемония награждения в прямом эфире. Придёшь?`,
          choices: [
            { icon: '📺', label: 'Пойти', desc: 'Важно',
              apply: () => { upgrades.reputation = Math.min(25, upgrades.reputation + 3); agentMoney += 20000; return { text: 'Репутация +3, +$20K донатов.', type: 'positive' }; } },
            { icon: '🎥', label: 'Отправить клиента', desc: 'Пусть он',
              apply: () => { upgrades.reputation = Math.min(25, upgrades.reputation + 1); return { text: 'Репутация +1.', type: 'positive' }; } }
          ] }
    ]
};

// Ц9. Личный кризис (3 этапа)
EVENT_CHAINS.personal_crisis_chain = {
    id: 'personal_crisis_chain', title: 'Личный кризис',
    stages: [
        { icon: '💔', title: 'РАЗВОД', triggerWeek: 0,
          getPlayer: () => myRoster.find(p => p.age >= 25),
          text: (p) => `<b>${p.name}</b> переживает развод. Форма падает.`,
          choices: [
            { icon: '⚖️', label: 'Юрист ($10K)', desc: 'Помочь',
              apply: (p) => { if (agentMoney < 10000) return { text: 'Недостаточно денег.', skip: true }; agentMoney -= 10000; p.loyalty = Math.min(100, p.loyalty + 15); return { text: '−$10K, лояльность +15.', type: 'positive' }; } },
            { icon: '🧠', label: 'Психолог ($5K)', desc: 'Эмоции',
              apply: (p) => { if (agentMoney < 5000) return { text: 'Недостаточно денег.', skip: true }; agentMoney -= 5000; p.loyalty = Math.min(100, p.loyalty + 10); return { text: '−$5K, лояльность +10.', type: 'positive' }; } },
            { icon: '🚶', label: 'Отстраниться', desc: 'Личное дело',
              apply: (p) => { p.loyalty = Math.max(0, p.loyalty - 20); return { text: 'Лояльность −20.', type: 'negative' }; } }
          ] },
        { icon: '📉', title: 'ПОТЕРЯ ФОРМЫ', triggerWeek: 3,
          getPlayer: () => myRoster.find(p => p.age >= 25),
          text: (p) => `<b>${p.name}</b> потерял форму. Клуб недоволен.`,
          choices: [
            { icon: '🏋️', label: 'Личный тренер ($15K)', desc: 'Восстановить',
              apply: (p) => { if (agentMoney < 15000) return { text: 'Недостаточно денег.', skip: true }; agentMoney -= 15000; p.rating = Math.min(100, p.rating + 1); return { text: 'Рейтинг +1. −$15K.', type: 'positive' }; } },
            { icon: '⏸', label: 'Дать паузу', desc: 'Отпуск 2 недели',
              apply: (p) => { p.injuryWeeks = Math.max(p.injuryWeeks || 0, 2); p.loyalty = Math.min(100, p.loyalty + 5); return { text: '2 недели отдыха. Лояльность +5.', type: 'positive' }; } }
          ] },
        { icon: '🏒', title: 'ВОЗВРАЩЕНИЕ', triggerWeek: 7,
          getPlayer: () => myRoster.find(p => p.age >= 25),
          text: (p) => `<b>${p.name}</b> вернулся в форму. Что дальше?`,
          choices: [
            { icon: '✅', label: 'Поддержать', desc: 'Похвалить',
              apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 15); addXP(400); return { text: 'Лояльность +15, XP +400.', type: 'positive' }; } }
          ] }
    ]
};

// Ц10. Карьерный перелом (3 этапа)
EVENT_CHAINS.career_turn_chain = {
    id: 'career_turn_chain', title: 'Карьерный перелом',
    stages: [
        { icon: '📉', title: 'ЗАДУМАЛСЯ О ЗАВЕРШЕНИИ', triggerWeek: 0,
          getPlayer: () => myRoster.find(p => p.age >= 30 && p.rating >= 70 && p.rating <= 85),
          text: (p) => `<b>${p.name}</b> думает о завершении карьеры. Ему ${p.age}.`,
          choices: [
            { icon: '💪', label: 'Уговорить продолжить', desc: 'Ещё есть порох',
              apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 10); return { text: 'Согласился. Лояльность +10.', type: 'positive' }; } },
            { icon: '🤝', label: 'Найти клуб пониже', desc: 'Спокойнее',
              apply: (p) => { createTask({ type: 'find_club_same', playerName: p.name, description: `Найти ${p.name} клуб проще`, icon: '🏒', deadlineWeeks: 8, reward: { loyalty: 10 }, penalty: { loyalty: -10 }, params: { originalClub: p.club, originalLeague: p.league } }); return { text: 'Ищем клуб пониже.', type: 'positive' }; } },
            { icon: '👋', label: 'Поддержать завершение', desc: 'Уважать выбор',
              apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 15); return { text: 'Лояльность +15.', type: 'positive' }; } }
          ] },
        { icon: '🏋️', title: 'ТРЕНИРОВКИ ДАЮТ РЕЗУЛЬТАТ', triggerWeek: 3,
          getPlayer: () => myRoster.find(p => p.age >= 30),
          text: (p) => `<b>${p.name}</b> упорно тренируется. Форма растёт!`,
          choices: [
            { icon: '🏒', label: 'Поддержать', desc: 'Похвалить',
              apply: (p) => { p.rating = Math.min(100, p.rating + 1); return { text: 'Рейтинг +1.', type: 'positive' }; } }
          ] },
        { icon: '🎯', title: 'ПРОДЛЕНИЕ КОНТРАКТА?', triggerWeek: 7,
          getPlayer: () => myRoster.find(p => p.age >= 30),
          text: (p) => `Клуб <b>${p.name}</b> решает: продлевать или нет.`,
          choices: [
            { icon: '💼', label: 'Торговаться', desc: 'Хороший контракт',
              apply: (p) => { if (Math.random() < 0.6) { p.contractYears = 2; p.loyalty = Math.min(100, p.loyalty + 15); return { text: 'Продлён на 2 года! Лояльность +15.', type: 'positive' }; } p.loyalty = Math.max(0, p.loyalty - 10); return { text: 'Отказали. Лояльность −10.', type: 'negative' }; } },
            { icon: '✅', label: 'Принять что дают', desc: 'Скромно',
              apply: (p) => { p.contractYears = 1; return { text: 'Продлён на 1 год.', type: 'positive' }; } }
          ] }
    ]
};

// Ц11. Бизнес-империя (3 этапа)
EVENT_CHAINS.business_empire_chain = {
    id: 'business_empire_chain', title: 'Бизнес-империя',
    stages: [
        { icon: '💼', title: 'СПОРТ-БАР', triggerWeek: 0,
          getPlayer: () => null, requiresPlayer: false,
          text: () => `Партнёр предлагает открыть спорт-бар. Вложить $50K?`,
          choices: [
            { icon: '💰', label: 'Вложить $50K', desc: 'Рискнуть',
              apply: () => { if (agentMoney < 50000) return { text: 'Недостаточно денег.', skip: true }; agentMoney -= 50000; return { text: '−$50K вложено.', type: 'positive' }; } },
            { icon: '💎', label: 'Вложить $100K', desc: 'По-крупному',
              apply: () => { if (agentMoney < 100000) return { text: 'Недостаточно денег.', skip: true }; agentMoney -= 100000; return { text: '−$100K вложено.', type: 'positive' }; } },
            { icon: '❌', label: 'Отказаться', desc: 'Не интересно',
              apply: () => { return { text: 'Отказ.', type: 'negative' }; } }
          ] },
        { icon: '📈', title: 'ДЕЛА ИДУТ', triggerWeek: 4,
          getPlayer: () => null, requiresPlayer: false,
          text: () => `Бар работает! Первая прибыль $30K. Что делать?`,
          choices: [
            { icon: '💸', label: 'Забрать $30K', desc: 'Вывести',
              apply: () => { agentMoney += 30000; return { text: '+$30K.', type: 'positive' }; } },
            { icon: '📊', label: 'Вложить в развитие', desc: 'Расти',
              apply: () => { return { text: 'Растём дальше.', type: 'positive' }; } }
          ] },
        { icon: '🏪', title: 'ВТОРОЙ БАР?', triggerWeek: 8,
          getPlayer: () => null, requiresPlayer: false,
          text: () => `Открыть второй бар за $80K? Это будет сеть.`,
          choices: [
            { icon: '✅', label: 'Да', desc: 'Строить сеть',
              apply: () => { if (agentMoney < 80000) return { text: 'Недостаточно денег.', skip: true }; agentMoney -= 80000; return { text: '−$80K. Сеть растёт.', type: 'positive' }; } },
            { icon: '❌', label: 'Нет', desc: 'Хватит',
              apply: () => { agentMoney += 20000; return { text: '+$20K. Остановились.', type: 'positive' }; } }
          ] }
    ]
};

// Ц12. Сборная и родина (3 этапа)
EVENT_CHAINS.national_team_chain = {
    id: 'national_team_chain', title: 'Сборная и родина',
    stages: [
        { icon: '🌍', title: 'ВЫЗОВ В СБОРНУЮ', triggerWeek: 0,
          getPlayer: () => myRoster.find(p => p.rating >= 75 && ['NHL','KHL','SHL','Liiga','NL_Switzerland','Czech_Extraliga'].includes(p.league)),
          text: (p) => `<b>${p.name}</b> вызван в сборную на турнир.`,
          choices: [
            { icon: '✅', label: 'Отпустить', desc: 'Честь страны',
              apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 10); upgrades.reputation = Math.min(25, upgrades.reputation + 2); return { text: 'Лояльность +10, репутация +2.', type: 'positive' }; } },
            { icon: '📝', label: 'С условиями', desc: 'Страховка',
              apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 5); upgrades.reputation = Math.min(25, upgrades.reputation + 1); return { text: 'Лояльность +5, репутация +1.', type: 'positive' }; } }
          ] },
        { icon: '🏒', title: 'КОНФЛИКТ В СБОРНОЙ', triggerWeek: 3,
          getPlayer: () => myRoster.find(p => p.rating >= 75),
          text: (p) => `<b>${p.name}</b> конфликтует с соотечественником в сборной.`,
          choices: [
            { icon: '🤝', label: 'Помирить', desc: 'Поговорить',
              apply: (p) => { if (Math.random() < 0.7) { p.loyalty = Math.min(100, p.loyalty + 8); return { text: 'Помирились. Лояльность +8.', type: 'positive' }; } return { text: 'Не получилось.', type: 'negative' }; } },
            { icon: '🛡', label: 'Поддержать клиента', desc: 'На его стороне',
              apply: (p) => { p.loyalty = Math.min(100, p.loyalty + 12); return { text: 'Лояльность +12.', type: 'positive' }; } }
          ] },
        { icon: '🏆', title: 'ФИНАЛ ТУРНИРА', triggerWeek: 6,
          getPlayer: () => myRoster.find(p => p.rating >= 75),
          text: (p) => `Сборная <b>${p.name}</b> в финале!`,
          choices: [
            { icon: '🥇', label: 'Болеть лично ($10K)', desc: 'Полетел',
              apply: (p) => { if (agentMoney < 10000) return { text: 'Недостаточно денег.', skip: true }; agentMoney -= 10000; upgrades.reputation = Math.min(25, upgrades.reputation + 3); return { text: 'Репутация +3. −$10K.', type: 'positive' }; } },
            { icon: '📺', label: 'Смотреть по ТВ', desc: 'Дома',
              apply: (p) => { return { text: 'Смотрел дома.', type: 'positive' }; } }
          ] }
    ]
};

// Ц13. Медиа-магнат (3 этапа)
EVENT_CHAINS.media_mogul_chain = {
    id: 'media_mogul_chain', title: 'Медиа-магнат',
    stages: [
        { icon: '🎥', title: 'ДОКУМЕНТАЛЬНЫЙ ФИЛЬМ', triggerWeek: 0,
          getPlayer: () => myRoster.find(p => p.rating >= 75),
          text: (p) => `Канал хочет снять фильм о <b>${p.name}</b>.`,
          choices: [
            { icon: '✅', label: 'Согласиться', desc: 'Пиар',
              apply: (p) => { upgrades.reputation = Math.min(25, upgrades.reputation + 2); return { text: 'Репутация +2.', type: 'positive' }; } },
            { icon: '💰', label: 'За деньги ($50K)', desc: 'Гонорар',
              apply: (p) => { if (Math.random() < 0.5) { agentMoney += 50000; return { text: '+$50K.', type: 'positive' }; } return { text: 'Отказали.', type: 'negative' }; } }
          ] },
        { icon: '🎬', title: 'СЪЁМКИ', triggerWeek: 4,
          getPlayer: () => null, requiresPlayer: false,
          text: () => `Съёмки идут. Съёмочная команда предлагает сделать акцент на личной жизни игрока.`,
          choices: [
            { icon: '👍', label: 'Разрешить', desc: 'Больше драмы',
              apply: () => { upgrades.reputation = Math.min(25, upgrades.reputation + 3); return { text: 'Репутация +3.', type: 'positive' }; } },
            { icon: '🚫', label: 'Запретить', desc: 'Только хоккей',
              apply: () => { upgrades.reputation = Math.min(25, upgrades.reputation + 1); return { text: 'Только хоккей. Репутация +1.', type: 'positive' }; } }
          ] },
        { icon: '🌟', title: 'ПРЕМЬЕРА', triggerWeek: 8,
          getPlayer: () => null, requiresPlayer: false,
          text: () => `Премьера фильма. Что делаешь?`,
          choices: [
            { icon: '🎉', label: 'Устроить приём ($20K)', desc: 'По-крупному',
              apply: () => { if (agentMoney < 20000) return { text: 'Недостаточно денег.', skip: true }; agentMoney -= 20000; upgrades.reputation = Math.min(25, upgrades.reputation + 5); agentMoney += 100000; return { text: 'Репутация +5, +$100K донатов. −$20K.', type: 'positive' }; } },
            { icon: '😐', label: 'Тихо', desc: 'Без шума',
              apply: () => { return { text: 'Тихо отпраздновали.', type: 'positive' }; } }
          ] }
    ]
};

// ============ ХЕЛПЕР: проверка "играет ли клиент в родной стране" ============
function isInHomeCountry(player) {
    const flag = getPlayerCountry(player);
    const homeLeagues = {
        '🇷🇺': ['KHL', 'VHL', 'MHL'],
        '🇧🇾': ['Belarus_Extraliga', 'Belarus_Vysshaya'],
        '🇸🇪': ['SHL'],
        '🇫🇮': ['Liiga'],
        '🇨🇿': ['Czech_Extraliga'],
        '🇨🇦': ['NHL', 'AHL'],
        '🇺🇸': ['NHL', 'AHL'],
        '🇩🇪': ['DEL'],
        '🇨🇭': ['NL_Switzerland'],
        '🇰🇿': ['KHL'],
        '🇸🇰': ['Czech_Extraliga'],
        '🇦🇹': ['ICE_HL']
    };
    const allowed = homeLeagues[flag] || [];
    return allowed.includes(player.league);
}

// ============ СИСТЕМА ЗАДАЧ ============
function createTask(config) {
    const task = {
        id: 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        type: config.type || 'generic',
        playerName: config.playerName || null,
        createdWeek: currentWeek,
        createdSeason: currentSeason,
        deadlineWeek: config.deadlineWeeks ? (currentWeek + config.deadlineWeeks) : (currentWeek + 8),
        deadlineSeason: currentSeason,
        description: config.description || 'Выполнить обещание',
        icon: config.icon || '📌',
        reward: config.reward || {},
        penalty: config.penalty || {},
        params: config.params || {},
        chainNext: config.chainNext || null,
        completed: false,
        failed: false
    };
    while (task.deadlineWeek > 52) { task.deadlineWeek -= 52; task.deadlineSeason += 1; }
    activeTasks.push(task);
    addNews(`📌 Новое обещание: ${task.description}`, "info");
    return task;
}

function getTaskWeeksLeft(task) {
    const now = currentSeason * 52 + currentWeek;
    const deadline = task.deadlineSeason * 52 + task.deadlineWeek;
    return Math.max(0, deadline - now);
}

function findTaskPlayer(task) {
    if (!task.playerName) return null;
    return myRoster.find(p => p.name === task.playerName) || null;
}

function removeClientFromRoster(p) {
    myRoster = myRoster.filter(x => x.name !== p.name);
    addNews(`🚪 ${p.name} покинул ваше агентство`, "negative");
}

function completeTask(task, customMessage) {
    task.completed = true;
    activeTasks = activeTasks.filter(t => t.id !== task.id);
    const p = findTaskPlayer(task);
    if (task.reward.loyalty && p) p.loyalty = Math.max(0, Math.min(100, (p.loyalty ?? 100) + task.reward.loyalty));
    if (task.reward.rep) upgrades.reputation = Math.min(25, upgrades.reputation + task.reward.rep);
    if (task.reward.money) agentMoney += task.reward.money;
    if (task.reward.xp) addXP(task.reward.xp);
    addNews(customMessage || `✅ Обещание выполнено: ${task.description}`, "positive");
    addEventHistory({ type: 'task_done', task: task.description });
    if (task.chainNext) {
        eventCooldowns[task.chainNext] = (currentSeason * 100) + currentWeek + 2;
    }
}

function failTask(task) {
    task.failed = true;
    activeTasks = activeTasks.filter(t => t.id !== task.id);
    const p = findTaskPlayer(task);
    if (task.penalty.loyalty && p) p.loyalty = Math.max(0, Math.min(100, (p.loyalty ?? 100) + task.penalty.loyalty));
    if (task.penalty.rep) upgrades.reputation = Math.max(1, upgrades.reputation + task.penalty.rep);
    if (task.penalty.money) agentMoney = Math.max(-100000, agentMoney + task.penalty.money);
    addNews(`❌ Обещание провалено: ${task.description}`, "negative");
    addEventHistory({ type: 'task_failed', task: task.description });
    if (p && (p.loyalty || 0) <= 0) removeClientFromRoster(p);
}

function checkActiveTasks() {
    const snapshot = [...activeTasks];
    snapshot.forEach(task => {
        if (task.completed || task.failed) return;
        const weeksLeft = getTaskWeeksLeft(task);
        if (task.type === 'find_club_top') {
            const p = findTaskPlayer(task);
            if (!p) { failTask(task); return; }
            const origClub = task.params && task.params.originalClub;
            // Успех: игрок в топ-лиге И это не его исходный клуб (он действительно перешёл)
            if (p.club && ['NHL', 'KHL', 'SHL', 'NL_Switzerland'].includes(p.league)) {
                if (!origClub || p.club !== origClub) {
                    completeTask(task, `✅ ${p.name} перешёл в ${p.club}!`);
                }
            } else if (weeksLeft <= 0) failTask(task);
        }else if (task.type === 'find_club_home') {
            const p = findTaskPlayer(task);
            if (!p) { failTask(task); return; }
            const homeFlag = getPlayerCountry(p);
            const homeLeagues = { '🇷🇺':['KHL','VHL'], '🇧🇾':['Belarus_Extraliga','Belarus_Vysshaya'], '🇸🇪':['SHL'], '🇫🇮':['Liiga'], '🇨🇿':['Czech_Extraliga'], '🇨🇦':['NHL','AHL'], '🇺🇸':['NHL','AHL'], '🇩🇪':['DEL'], '🇨🇭':['NL_Switzerland'], '🇰🇿':['KHL'], '🇸🇰':['Czech_Extraliga'] };
            const targets = homeLeagues[homeFlag] || [];
            const origClub = task.params && task.params.originalClub;
            if (p.club && targets.includes(p.league) && (!origClub || p.club !== origClub)) {
                completeTask(task, `✅ ${p.name} вернулся домой — ${p.club}!`);
            } else if (p.club && targets.includes(p.league) && origClub && p.club === origClub) {
                completeTask(task, `✅ ${p.name} уже играет дома — ${p.club}`);
            } else if (weeksLeft <= 0) {
                // Если родная лига не существует или клиент слишком слаб — авторешение
                const allLeagueData = targets.map(lk => LEAGUE_DATA[lk]).filter(Boolean);
                const tooWeak = allLeagueData.length > 0 && allLeagueData.every(ld => p.rating < ld.min - 15);
                const noLeague = targets.length === 0;
                if (tooWeak || noLeague) {
                    // Клиент уезжает домой как свободный агент
                    p.club = '';
                    p.league = '';
                    p.loyalty = Math.min(100, (p.loyalty || 50) + 10);
                    completeTask(task, `🏠 ${p.name} уехал домой — стал свободным агентом в своей стране`);
                } else {
                    failTask(task);
                }
            }
        } else if (task.type === 'find_club_same') {
            const p = findTaskPlayer(task);
            if (!p) { failTask(task); return; }
            const origClub = task.params && task.params.originalClub;
            // Успех: игрок стал свободным агентом ИЛИ перешёл в другой клуб
            if (!p.club) {
                completeTask(task, `✅ ${p.name} нашёл новый клуб`);
            } else if (origClub && p.club !== origClub) {
                completeTask(task, `✅ ${p.name} перешёл в ${p.club}!`);
            } else if (weeksLeft <= 0) failTask(task);
        } else if (task.type === 'find_sponsor') {
            if (weeksLeft <= 0) {
                if (Math.random() < 0.6) {
                    const bonus = randomInt(20000, 50000);
                    agentMoney += bonus;
                    completeTask(task, `✅ Спонсор найден! +$${bonus.toLocaleString()}`);
                } else failTask(task);
            }
        } else if (weeksLeft <= 0) failTask(task);
    });
}

function renderActiveTasks() {
    const container = document.getElementById('active-tasks-block');
    if (!container) return;
    if (activeTasks.length === 0) { container.style.display = 'none'; return; }
    container.style.display = 'block';
    container.innerHTML = `
        <div class="active-tasks-title">📌 ${LANG.t('АКТИВНЫЕ ОБЕЩАНИЯ')} (${activeTasks.length})</div>
        <div class="active-tasks-list">
            ${activeTasks.map(t => {
                const wl = getTaskWeeksLeft(t);
                const urgent = wl <= 2 ? ' task-urgent' : (wl <= 5 ? ' task-soon' : '');
                const clickable = t.playerName ? ' clickable' : '';
                return `<div class="active-task-row${urgent}${clickable}" data-task-id="${t.id}">
                    <span class="at-icon">${t.icon}</span>
                    <span class="at-text">${t.description}</span>
                    <span class="at-weeks">${wl} ${LANG.t('нед.')}</span>
                </div>`;
            }).join('')}
        </div>
        <div class="active-tasks-hint">💡 ${LANG.t('Нажми на задачу — откроется карточка игрока')}</div>
    `;
    // Клик по задаче — открываем карточку игрока
    container.querySelectorAll('.active-task-row.clickable').forEach(row => {
        row.addEventListener('click', () => {
            const taskId = row.getAttribute('data-task-id');
            const task = activeTasks.find(t => t.id === taskId);
            if (!task || !task.playerName) return;
            const player = myRoster.find(p => p.name === task.playerName);
            if (!player) { uiAlert(LANG.t('Игрок больше не в агентстве')); return; }
            openPlayerScreen(player, 'my');
            playerTab = 'transfer';
            setTimeout(() => renderPlayerScreen(), 50);
        });
    });
}

function addEventHistory(entry) {
    eventHistory.unshift({ ...entry, week: currentWeek, season: currentSeason });
    if (eventHistory.length > 100) eventHistory.pop();
}

// ============ ДВИЖОК ЦЕПОЧЕК ============
function startChain(chainId) {
    const chain = EVENT_CHAINS[chainId];
    if (!chain) return;
    activeChains.push({
        chainId,
        stage: 0,
        playerName: null,
        startedWeek: currentWeek,
        startedSeason: currentSeason
    });
    addNews(`📖 Началась история: ${chain.title}`, "info");
}

function advanceChain(chainId) {
    const idx = activeChains.findIndex(c => c.chainId === chainId);
    if (idx === -1) return;
    const c = activeChains[idx];
    c.stage++;
    const chain = EVENT_CHAINS[chainId];
    if (c.stage >= chain.stages.length) {
        activeChains.splice(idx, 1);
        addNews(`📖 История завершена: ${chain.title}`, "info");
    }
}

function tryChainEvent() {
    for (let i = 0; i < activeChains.length; i++) {
        const ac = activeChains[i];
        const chain = EVENT_CHAINS[ac.chainId];
        if (!chain) continue;
        const stage = chain.stages[ac.stage];
        if (!stage) continue;
        const weeksSince = (currentWeek - ac.startedWeek) + (currentSeason - ac.startedSeason) * 52;
        if (weeksSince < (stage.triggerWeek || 0)) continue;
        let player = null;
        if (stage.getPlayer) player = stage.getPlayer();
        else if (ac.playerName) player = myRoster.find(p => p.name === ac.playerName);
        if (!player && stage.requiresPlayer !== false) {
            activeChains.splice(i, 1);
            continue;
        }
        showChainStage(chain, stage, player);
        return true;
    }
    return false;
}

function showChainStage(chain, stage, player) {
    eventTitle.textContent = `${stage.icon} ${stage.title}`;
    eventText.innerHTML = stage.text(player);
    eventDetails.innerHTML = `<div class="chain-progress">📖 ${chain.title} • Этап ${activeChains.find(c => c.chainId === chain.id).stage + 1}/${chain.stages.length}</div>`;
    eventActions.innerHTML = '';
    stage.choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'event-choice-btn';
        btn.innerHTML = `<span class="ec-icon">${choice.icon}</span><div class="ec-body"><span class="ec-label">${choice.label}</span><span class="ec-desc">${choice.desc}</span></div>`;
        btn.addEventListener('click', () => {
            const moneyBefore = agentMoney;
            const result = choice.apply(player);
            if (result && result.skip) return;
            // МАСШТАБИРОВАНИЕ: дельта баланса пересчитывается по уровню агента
            const delta = agentMoney - moneyBefore;
            if (delta !== 0) {
                agentMoney = moneyBefore + scaleEventMoney(delta);
            }
            // ФИЛЬТР: доход от этапа цепочки режем в 3 раза
            if (agentMoney > moneyBefore) {
                const delta = agentMoney - moneyBefore;
                const cut = Math.round(delta / 3);
                agentMoney = moneyBefore + cut;
            }
            eventTitle.textContent = result.type === 'positive' ? '✅ РЕШЕНИЕ ПРИНЯТО' : '❌ РЕШЕНИЕ ПРИНЯТО';
            eventText.innerHTML = `<div class="event-result-text">${result.text}</div>`;
            eventDetails.innerHTML = '';
            eventActions.innerHTML = '';
            const okBtn = document.createElement('button');
            okBtn.className = 'btn-neutral';
            okBtn.textContent = 'OK';
            okBtn.addEventListener('click', () => {
                eventModal.style.display = 'none';
                const ac = activeChains.find(c => c.chainId === chain.id);
                if (ac) {
                    ac.startedWeek = currentWeek;
                    ac.startedSeason = currentSeason;
                    if (player && !ac.playerName) ac.playerName = player.name;
                }
                advanceChain(chain.id);
                updateAllDisplays();
                saveGame();
            });
            eventActions.appendChild(okBtn);
            addNews(`${stage.icon} ${stage.title}: ${choice.label} — ${result.text}`, result.type === 'positive' ? 'positive' : 'negative');
        });
        eventActions.appendChild(btn);
    });
    eventModal.style.display = 'flex';
}

function checkChains() {
    if (activeChains.length === 0) return false;
    return tryChainEvent();
}

function triggerChainStart(chainId) {
    if (activeChains.some(c => c.chainId === chainId)) return;
    startChain(chainId);
    const ac = activeChains.find(c => c.chainId === chainId);
    if (ac) ac.startedWeek = currentWeek - 100;
}

// ============ ДВИЖОК СОБЫТИЙ ============
// ============ СОБЫТИЯ В СТИЛЕ МЕССЕНДЖЕРА ============
// Ожидающее событие. Сохраняется в сейв по id события и имени клиента,
// чтобы «письмо» не пропадало при перезагрузке страницы.
let pendingEvent = null;

function showWeeklyEvent(ev) {
    let player = null;
    try { player = ev.getPlayer(); } catch (e) {}
    if (!player) return;
    // НЕ открываем модалку сразу — кладём событие в "почтовый ящик" офиса.
    // Иконка ✉️ появится в renderOffice; открытие — в формате телефона.
    pendingEvent = { ev, player };
    renderOffice();
}

function openPendingEvent() {
    if (!pendingEvent) return;
    const { ev, player } = pendingEvent;
    renderEventInPhone(ev, player);
}

function renderEventInPhone(ev, player) {
    // Шапка телефона
    phoneChatAvatar.innerHTML = `<span style="font-size:26px;">${ev.icon}</span>`;
    phoneChatName.textContent = LANG.t(ev.title);
    phoneChatStatus.textContent = LANG.t('Новое событие');
    phoneChatStatus.classList.remove('busy');

    // Текст события — как сообщение клуба
    let text = '';
    try { text = ev.text(player); } catch (e) { text = ''; }
    phoneChatBody.innerHTML = `
        <div class="neg-msg neg-msg-club">
            <div class="neg-bubble">${text}</div>
        </div>
    `;

    // Варианты ответа — внизу экрана как в мессенджере
    phoneInputBar.innerHTML = '';
    ev.choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'phone-btn-menu event-phone-choice';
        btn.innerHTML = `<span>${choice.icon || '➡️'}</span> <span class="epc-label">${LANG.t(choice.label)}</span>`;
        btn.title = choice.desc ? LANG.t(choice.desc) : '';
        btn.addEventListener('click', () => {
            const processed = applyEventChoice(ev, choice, player);
            if (!processed) {
                // Выбор невозможен (нет денег и т.п.) — показываем причину,
                // событие остаётся в «почте», варианты не сгорают
                const resText = eventText.innerHTML;
                eventModal.style.display = 'none';
                phoneChatBody.innerHTML += `
                    <div class="neg-msg neg-msg-agent">
                        <div class="neg-bubble">${LANG.t(choice.label)}</div>
                    </div>
                    <div class="neg-msg neg-msg-club">
                        <div class="neg-bubble">${resText}</div>
                    </div>
                `;
                scrollChatToBottom();
                playSound('error');
                return;
            }
            pendingEvent = null;
            // Результат показываем в той же "телефонной" модалке
            const resTitle = eventTitle.textContent;
            const resText = eventText.innerHTML;
            eventModal.style.display = 'none';
            phoneChatName.textContent = resTitle.replace(/^.\s*/, '');
            phoneChatBody.innerHTML += `
                <div class="neg-msg neg-msg-agent">
                    <div class="neg-bubble">${LANG.t(choice.label)}</div>
                </div>
                <div class="neg-msg neg-msg-club">
                    <div class="neg-bubble">${resText}</div>
                </div>
            `;
            scrollChatToBottom();
            // Кнопка OK внизу
            phoneInputBar.innerHTML = '';
            const okBtn = document.createElement('button');
            okBtn.className = 'phone-btn-close';
            okBtn.textContent = 'OK';
            okBtn.addEventListener('click', () => {
                closeNegotiationModal();
                updateAllDisplays();
                saveGame();
                renderOffice();
            });
            phoneInputBar.appendChild(okBtn);
        });
        phoneInputBar.appendChild(btn);
    });

    eventModal.style.display = 'none';
    negotiationModal.style.display = 'flex';
    scrollChatToBottom();
}

// Иконка ✉️ «Новое событие» в офисе
function renderPendingEventBadge() {
    const tile = document.getElementById('event-mail-tile');
    if (!tile) return;
    if (pendingEvent) {
        tile.style.display = 'flex';
        const icon = tile.querySelector('.em-icon');
        const title = tile.querySelector('.em-title');
        const sub = tile.querySelector('.em-sub');
        if (icon) icon.textContent = pendingEvent.ev.icon || '✉️';
        if (title) title.textContent = LANG.t(pendingEvent.ev.title);
        if (sub) sub.textContent = LANG.t('Требуется ваше решение');
    } else {
        tile.style.display = 'none';
    }
}

// ============ ЖИВОЙ МИР: AI-ТРАНСФЕРЫ ============
// Игроки вне агентства меняют клубы: богатые клубы покупают таланты из слабых клубов.
// Вызывается каждую неделю ТО и раз в месяц (4 недели) в регулярке.
function simulateAITransfers() {
    const done = []; // кандидаты на новости
    // Кандидаты: игроки клубов, НЕ ваши клиенты
    const candidates = players.filter(p =>
        p.club &&
        !myRoster.some(c => c.name === p.name) &&
        p.rating >= 60 && // трансферы имеют смысл для приличных игроков
        p.lastTransferSeason !== currentSeason
    );
    if (candidates.length === 0) return 0;

    let transfers = 0;
    const maxTransfers = randomInt(1, 3); // не превращаем мир в биржу хаоса

    for (let i = 0; i < maxTransfers && candidates.length > 0; i++) {
        const idx = Math.floor(Math.random() * candidates.length);
        const p = candidates.splice(idx, 1)[0];
        const oldKey = p.league + "_" + p.club;
        const oldData = clubData[oldKey];
        if (!oldData) continue;

        // Богатый клуб: бюджет выше средней ЗП игрока за сезон с запасом
        const salaryBudget = p.salary * 1000;
        const richClubs = Object.keys(clubData).map(k => clubData[k]).filter(c =>
            (c.league + "_" + c.club) !== oldKey &&
            c.league && c.club &&
            c.budget > salaryBudget * 2 &&
            Math.abs(c.prestige - p.rating) <= 15
        );
        // Предпочитаем клубы престижнее текущего (игроки идут вверх по карьерной лестнице)
        const better = richClubs.filter(c => c.prestige > oldData.prestige);
        const pool = better.length > 0 ? better : richClubs;
        if (pool.length === 0) continue;

        const newClub = randomChoice(pool);
        // Имитация перехода: клуб платит, бюджет уменьшается (деньги сжигаются — уже учтены в экономике)
        newClub.budget = Math.max(0, newClub.budget - salaryBudget);

        const oldClubName = p.club;
        p.club = newClub.club;
        p.league = newClub.league;
        p.lastTransferSeason = currentSeason;
        p.contractYears = randomInt(2, 4);
        p.salary = calculateSalary(p.rating, p.league); // ЗП по рынку нового клуба
        p.clubLoyalty = randomInt(40, 60);
        transfers++;

        done.push({ player: p, oldClubName, newClub });
    }

    // ===== Новости: только 1-2 самых громких =====
    if (done.length > 0) {
        done.sort((a, b) => b.player.rating - a.player.rating);
        const loud = done.filter(d =>
            d.player.rating >= 80 || d.newClub.prestige >= 80 || d.oldClubName && (clubData[d.player.league + "_" + d.oldClubName]?.prestige >= 80)
        );
        const toAnnounce = (loud.length > 0 ? loud : done).slice(0, done.length > 1 ? 2 : 1);
        toAnnounce.forEach(d => {
            addNews(
                `🔥 ${LANG.t('Громкий трансфер')}: ${d.player.name} ${LANG.t('перешел из')} ${d.oldClubName} ${LANG.t('в')} ${d.newClub.club}!`,
                d.player.rating >= 80 ? "positive" : "info"
            );
        });
    }
    // AI-клубы не должны «оголяться» после серии трансферов
    if (transfers > 0) rebalanceClubRosters();
    return transfers;
}

function tryWeeklyEvent() {
    if (weeklyEventCounter >= MAX_EVENTS_PER_SEASON) return false;
    const weeksSinceLast = lastEventWeek > 0 ? (currentWeek - lastEventWeek) : 999;
    if (lastEventWeek > 0 && weeksSinceLast < EVENT_MIN_COOLDOWN) return false;
    let chance = 0.20;
    if (weeksSinceLast >= EVENT_MAX_COOLDOWN) chance = 0.9;
    if (Math.random() > chance) return false;
    const nowKey = currentSeason * 100 + currentWeek;
    const available = EVENT_POOL.filter(e => {
        if ((eventCooldowns[e.id] || 0) > nowKey) return false;
        try { return e.condition(); } catch (err) { return false; }
    });
    if (available.length === 0) return false;
    // Перебираем доступные события, пока не найдём то, у которого есть живой игрок.
    // Если getPlayer() вернул null (игрок уже ушёл из агентства) — кулдауним событие и пробуем следующее.
    while (available.length > 0) {
        const idx = Math.floor(Math.random() * available.length);
        const ev = available.splice(idx, 1)[0];
        let testPlayer = null;
        try { testPlayer = ev.getPlayer ? ev.getPlayer() : null; } catch (e) {}
        if (!testPlayer) {
            eventCooldowns[ev.id] = nowKey + 15;
            continue;
        }
        eventCooldowns[ev.id] = nowKey + 15;
        lastEventWeek = currentWeek;
        weeklyEventCounter++;
        showWeeklyEvent(ev);
        return true;
    }
    return false;
}

function applyEventChoice(ev, choice, player) {
    const moneyBefore = agentMoney;
    const result = choice.apply(player) || { text: '', type: 'positive' };
    if (result.skip) {
        // Выбор невозможен: показываем причину, но событие не «сгорает»
        eventTitle.textContent = '⚠️ ' + LANG.t('Недоступно');
        eventText.innerHTML = `<div class="event-result-text">${result.text}</div>`;
        eventDetails.innerHTML = '';
        eventActions.innerHTML = '';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-neutral';
        cancelBtn.textContent = 'OK';
        cancelBtn.addEventListener('click', () => { eventModal.style.display = 'none'; });
        eventActions.appendChild(cancelBtn);
        return false;
    }
    // МАСШТАБИРОВАНИЕ: дельта баланса пересчитывается по уровню агента,
    // положительный доход от событий дополнительно режется (один проход)
    const rawDelta = agentMoney - moneyBefore;
    if (rawDelta !== 0) {
        let delta = scaleEventMoney(rawDelta);
        if (delta > 0) delta = Math.round(delta / 3);
        agentMoney = moneyBefore + delta;
    }
    eventTitle.textContent = result.type === 'positive' ? '✅ РЕШЕНИЕ ПРИНЯТО' : '❌ РЕШЕНИЕ ПРИНЯТО';
    eventText.innerHTML = `<div class="event-result-text">${result.text}</div>`;
    eventDetails.innerHTML = '';
    eventActions.innerHTML = '';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn-neutral';
    closeBtn.textContent = 'OK';
    closeBtn.addEventListener('click', () => {
        eventModal.style.display = 'none';
        updateAllDisplays();
        saveGame();
    });
    eventActions.appendChild(closeBtn);
    addEventHistory({ type: 'event', eventId: ev.id, eventTitle: ev.title, choiceLabel: choice.label, resultText: result.text, resultType: result.type });
    addNews(`${ev.icon} ${ev.title}: ${choice.label} — ${result.text}`, result.type === 'positive' ? 'positive' : 'negative');
    return true;
}

// ============ 26. NPC ПЕРЕМАНИВАНИЕ (конкуренты) ============
function tryNpcPoaching() {
    if (myRoster.length === 0) return false;
    if (npcCooldownWeeks > 0) return false;
    if (lostPlayerThisSeason) return false;

    const target = randomChoice(myRoster);
    if (target.loyalty > 70) {
        addNews(`${target.name} отказал конкуренту (высокая лояльность)`, "positive");
        npcCooldownWeeks = 6;
        return false;
    }

    const agent = randomChoice(npcAgencies);
    const newSalary = Math.round(target.salary * (1.3 + Math.random() * 0.7));
    const comp = Math.round(target.salary * 0.1);
    showPoachingEvent(target, agent, newSalary, comp);
    npcCooldownWeeks = 6;
    return true;
}

function showPoachingEvent(player, agent, newSalary, compensation) {
    eventTitle.textContent = "Агент-конкурент!";
    eventText.textContent = `${agent.country.split(' ')[0]} ${agent.name} предлагает вашему клиенту новый контракт!`;
    eventDetails.innerHTML = `<div class="event-detail-box"><b>Игрок:</b> ${player.name}<br><b>Клуб:</b> ${player.club}<br><b>Рейтинг:</b> ${player.rating}<br><br><b>Зарплата:</b> ${formatSalary(player.salary)}<br><b>Предложение:</b> ${formatSalary(newSalary)}</div>`;
    eventActions.innerHTML = '';

    // cost/compensation хранятся в ТЫСЯЧАХ (как player.salary), agentMoney — в долларах
    const cost = Math.round((newSalary - player.salary) * 0.25);
    const b1 = document.createElement('button');
    b1.className = 'btn-success';
    b1.textContent = `Удержать (${formatSalary(cost)})`;
    b1.addEventListener('click', () => {
        if (agentMoney < cost * 1000) { uiAlert(LANG.t('Недостаточно денег!')); return; }
        agentMoney -= cost * 1000;
        player.salary = newSalary;
        player.loyalty = Math.min(100, player.loyalty + 20);
        addNews(`Вы удержали ${player.name}`, "positive");
        closeEventModal(); updateAllDisplays(); saveGame();
    });

    const b2 = document.createElement('button');
    b2.className = 'btn-warning';
    b2.textContent = `Отпустить (${formatSalary(compensation)})`;
    b2.addEventListener('click', () => {
        agentMoney += compensation * 1000;
        myRoster = myRoster.filter(p => p !== player);
        player.agentId = agent.id; // клиент перешёл к конкуренту, а не «в никуда»
        if (!Array.isArray(agent.clientIds)) agent.clientIds = [];
        if (!agent.clientIds.includes(player.name)) agent.clientIds.push(player.name);
        lostPlayerThisSeason = true;
        addNews(`${player.name} ушёл к ${agent.name}`, "negative");
        closeEventModal(); updateAllDisplays(); saveGame();
    });

    const b3 = document.createElement('button');
    b3.className = 'btn-danger';
    b3.textContent = 'Пригрозить';
    b3.addEventListener('click', () => {
        const mp = upgrades.reputation * 10, hp = agent.rep;
        const chance = Math.max(0.15, Math.min(0.85, mp / (mp + hp)));
        if (Math.random() < chance) {
            agent.rep = Math.max(5, agent.rep - 5);
            player.loyalty = Math.min(100, player.loyalty + 10);
            addNews(`Угроза удалась!`, "positive");
        } else {
            myRoster = myRoster.filter(p => p !== player);
            player.agentId = agent.id;
            if (!Array.isArray(agent.clientIds)) agent.clientIds = [];
            if (!agent.clientIds.includes(player.name)) agent.clientIds.push(player.name);
            lostPlayerThisSeason = true;
            addNews(`Угроза провалилась!`, "negative");
        }
        closeEventModal(); updateAllDisplays(); saveGame();
    });

    eventActions.appendChild(b1);
    eventActions.appendChild(b2);
    eventActions.appendChild(b3);
    eventModal.style.display = 'flex';
}

// ============ 27. ТРАНСФЕРЫ ============
function getLeagueTier(lk) {
    const t = {"NHL":1,"KHL":2,"SHL":2,"NL_Switzerland":2,"AHL":3,"Liiga":3,"Czech_Extraliga":3,"DEL":3,"VHL":4,"Belarus_Extraliga":4,"ICE_HL":4,"MHL":5,"Belarus_Vysshaya":5};
    return t[lk] || 5;
}

function getPlayingTimeInfo(player, clubInfo) {
    const teammates = players.filter(p =>
        p.club === clubInfo.club &&
        p.league === clubInfo.league &&
        p.position === player.position &&
        p !== player
    );
    const stronger = teammates.filter(p => p.rating > player.rating).length;

    if (player.position === 'G') {
        if (stronger === 0) return { role: 'starter', score: 3, text: '🧤 Будет первым вратарём' };
        if (stronger === 1) return { role: 'backup', score: 0, text: '🧤 Будет вторым вратарём' };
        return { role: 'bench', score: -3, text: '🧤 Сядет на лавку' };
    }

    if (stronger === 0) return { role: 'star', score: 3, text: '⭐ Будет лидером команды' };
    if (stronger <= 2) return { role: 'top6', score: 2, text: '🔥 Игра в топ-6' };
    if (stronger <= 5) return { role: 'top9', score: 0, text: '✅ Второе-третье звено' };
    if (stronger <= 9) return { role: 'bottom6', score: -2, text: '⚠️ Игра в 4-м звене' };
    return { role: 'bench', score: -3, text: '🪑 Сядет на лавку' };
}

function getClubsForPlayer(player, options) {
    options = options || {};
    const result = [];
    const pTier = getLeagueTier(player.league);

    // Определяем родные лиги игрока (для «домашнего» перехода)
    const homeFlag = getPlayerCountry(player);
    const homeLeagues = {
        '🇷🇺': ['KHL','VHL','MHL'], '🇧🇾': ['Belarus_Extraliga','Belarus_Vysshaya'],
        '🇸🇪': ['SHL'], '🇫🇮': ['Liiga'], '🇨🇿': ['Czech_Extraliga'],
        '🇨🇦': ['NHL','AHL'], '🇺🇸': ['NHL','AHL'], '🇩🇪': ['DEL'],
        '🇨🇭': ['NL_Switzerland'], '🇰🇿': ['KHL'], '🇸🇰': ['Czech_Extraliga'],
        '🇦🇹': ['ICE_HL']
    };
    const allowedHomeLeagues = homeLeagues[homeFlag] || [];
    const isHomeSearch = !!options.forHomeReturn;

    for (const [lk, ld] of Object.entries(LEAGUE_DATA)) {
        const lTier = getLeagueTier(lk);
        const isHomeLeague = isHomeSearch && allowedHomeLeagues.includes(lk);

        // 1) Слабый игрок не нужен лиге — но для домашней лиги ослабляем на 15
        const minGap = isHomeLeague ? 15 : 5;
        if (player.rating < ld.min - minGap) continue;

        // 2) Звёзды не идут в слабые лиги
        if (player.rating > ld.max + 10 && player.age < 32) continue;

        // 3) Прыжок через 2+ уровня лиг
        if (lTier - pTier > 2) continue;

        // 4) Нельзя сильно вниз, если игрок молодой
        if (pTier - lTier > 1 && player.age < 30 && !isHomeLeague) continue;

        getAllClubs(lk).forEach(club => {
            const data = clubData[lk + "_" + club];
            if (!data) return;

            // 5) Для домашней лиги сильно ослабляем требования по рейтингу
            const gapMin = isHomeLeague ? 40 : 20;   // клуб может быть на 40 престижа выше
            const gapMax = isHomeLeague ? 40 : 25;   // клуб может быть на 40 ниже (принять слабого)

            if (player.rating < data.prestige - gapMin) return;
            if (player.rating > data.prestige + gapMax) return;

            result.push({club, league: lk, prestige: data.prestige});
        });
    }
    return result;
}
function generateTransferOffer(player, clubInfo) {
    const data = clubData[clubInfo.league + "_" + clubInfo.club];
    if (!data) return null;
    const pd = data.prestige - player.rating;
    const minM = 1.05;
    const maxM = pd > 0 ? 1.6 : 1.25;
    const cap = calculateSalaryCap(player.rating, clubInfo.league);
    // Если переход в новую лигу — считаем от базовой зарплаты новой лиги,
    // если внутри лиги — от текущей зарплаты игрока
    const base = (clubInfo.league === player.league)
        ? player.salary
        : calculateSalary(player.rating, clubInfo.league);
    // "Шум" ±15%: два одинаковых клиента получают разные суммы от одного клуба
    let newSalary = Math.round(base * (minM + Math.random() * (maxM - minM)) * (0.85 + Math.random() * 0.30));
    if (newSalary > cap) newSalary = Math.round(cap * (1.0 + Math.random() * 0.05));
    newSalary = Math.max(1, newSalary);
    const years = player.age < 25 ? randomInt(2, 4) : player.age < 30 ? randomInt(1, 3) : randomInt(1, 2);
    const totalComm = Math.round(newSalary * 1000 * COMMISSION_RATE);
    const weeklyComm = Math.round(totalComm / 26);
    const salaryBoost = newSalary / Math.max(1, player.salary);
    const isFreeAgent = !player.club;
    const tierBoost = !isFreeAgent && getLeagueTier(clubInfo.league) < getLeagueTier(player.league);
    const tierDown = !isFreeAgent && getLeagueTier(clubInfo.league) > getLeagueTier(player.league);
    const oldData = player.club ? clubData[player.league + "_" + player.club] : null;
    const prestigeBoost = oldData ? data.prestige > oldData.prestige : false;

    const playingTime = getPlayingTimeInfo(player, clubInfo);

    const pros = [];
    const cons = [];
    let interest = 0;

    // Зарплата
    if (salaryBoost >= 2.0) { interest += 5; pros.push('💰 Зарплата в ' + salaryBoost.toFixed(1) + ' раза больше'); }
    else if (salaryBoost >= 1.5) { interest += 3; pros.push('💰 Зарплата +' + Math.round((salaryBoost-1)*100) + '%'); }
    else if (salaryBoost >= 1.2) { interest += 2; pros.push('💰 Прибавка +' + Math.round((salaryBoost-1)*100) + '%'); }
    else if (salaryBoost >= 1.05) { interest += 1; }
    else if (salaryBoost < 1.0) { interest -= 3; cons.push('💰 Понижение зарплаты'); }

    // Уровень лиги
    if (tierBoost) { interest += 2; pros.push('📈 Лига выше уровнем'); }
    if (tierDown) { interest -= 3; cons.push('📉 Лига ниже уровнем'); }

    // Престиж клуба
    if (prestigeBoost) { interest += 1; pros.push('⭐ Клуб престижнее'); }

    // Трофеи клуба
    if (data.titles >= 5) { interest += 2; pros.push('🏆 Клуб с ' + data.titles + ' титулами'); }
    else if (data.titles >= 2) { interest += 1; pros.push('🏆 Клуб с трофеями'); }
    else if (data.titles === 0 && data.prestige >= 70) { interest -= 1; cons.push('🏆 Клуб без титулов'); }

    // Игровое время
    interest += playingTime.score;
    if (playingTime.score >= 2) pros.push(playingTime.text);
    else if (playingTime.score <= -2) cons.push(playingTime.text);

    // Лояльность (только если есть старому клубу что терять)
    if (!isFreeAgent) {
        const loyalty = player.loyalty ?? 100;
        if (loyalty >= 80) { interest -= 3; cons.push('❤️ Очень предан старому клубу'); }
        else if (loyalty >= 60) { interest -= 1; }
    }

    // Характер
    if (player.character === 'loyal') { interest -= 2; cons.push('🐺 По характеру — верный'); }
    else if (player.character === 'ambitious') { interest += 1; pros.push('🚀 Амбициозен'); }

    // Возраст
    if (player.age <= 22) interest += 1;
    else if (player.age >= 32) interest -= 1;

    // Свободный агент — хочет играть
    if (!player.club) { interest += 5; pros.push('🕊️ Свободный агент — хочет играть'); }

    let acceptChance = 50 + interest * 10;
    acceptChance = Math.max(10, Math.min(95, acceptChance));

    return {
        club: clubInfo.club, league: clubInfo.league, prestige: data.prestige,
        newSalary, years, totalCommission: totalComm, weeklyCommission: weeklyComm,
        salaryBoost, tierBoost, prestigeBoost, interest,
        pros, cons, acceptChance, playingTime: playingTime.role,
        id: clubInfo.league + "_" + clubInfo.club + "_" + Date.now() + "_" + Math.random()
    };
}

function generateOffersForPlayer(player, count, options) {
    const clubs = getClubsForPlayer(player, options);
    if (clubs.length === 0) return [];
    const shuffled = [...clubs].sort(() => Math.random() - 0.5);
    const offers = [];
    shuffled.slice(0, count).forEach(c => {
        const o = generateTransferOffer(player, c);
        if (o) offers.push(o);
    });
    offers.sort((a, b) => {
        const sA = a.salaryBoost + (a.tierBoost ? 0.5 : 0) + (a.prestigeBoost ? 0.3 : 0);
        const sB = b.salaryBoost + (b.tierBoost ? 0.5 : 0) + (b.prestigeBoost ? 0.3 : 0);
        return sB - sA;
    });
    return offers;
}

function startActiveTransferSearch(player) {
    const isFree = !player.club;
    // Разрешаем поиск вне ТО, если у игрока активная задача «найти клуб»
    const hasClubTask = activeTasks.some(t =>
        t.playerName === player.name &&
        (t.type === 'find_club_top' || t.type === 'find_club_home' || t.type === 'find_club_same')
    );
    if (!isFree && seasonPhase === 'regular' && !hasClubTask) {
        uiAlert(LANG.t('Трансферное окно закрыто. Активный поиск только в ТО.'));
        return;
    }
    if (player.lastTransferSeason === currentSeason && !isFree && !hasClubTask) {
        uiAlert(LANG.t('Этот игрок уже менял клуб в этом сезоне. Следующий трансфер — в следующем сезоне.'));
        return;
    }
    const count = upgrades.reputation >= 15 ? randomInt(4, 6) : upgrades.reputation >= 8 ? randomInt(3, 5) : randomInt(2, 3);
    // Если у игрока задача «вернуться домой» — ищем с ослабленными условиями
    const homeTask = activeTasks.find(t => t.playerName === player.name && t.type === 'find_club_home');
    const offers = generateOffersForPlayer(player, count, { forHomeReturn: !!homeTask });
    if (offers.length === 0) { uiAlert(LANG.t('Подходящих клубов не найдено.')); return; }
    transferOffers[player.name] = {offers, weeksLeft: 3, returnCount: 0, active: true, declinedClubs: []};
    addNews(`📤 ${player.name} ищет клуб. Предложений: ${offers.length}`, "info");
    renderPlayerScreen();
    saveGame();
}

// Срок жизни предложений о трансфере (3 недели). По истечении клубы отзывают офферы.
function tickTransferOffers() {
    Object.keys(transferOffers || {}).forEach(name => {
        const e = transferOffers[name];
        if (!e || typeof e.weeksLeft !== 'number') return;
        e.weeksLeft--;
        if (e.weeksLeft <= 0) {
            const hadOffers = Array.isArray(e.offers) && e.offers.length > 0;
            delete transferOffers[name];
            if (hadOffers) addNews(`📉 Предложения по ${name} истекли`, "info");
        }
    });
}

function acceptTransferOffer(player, offer) {    // Игрок может отказаться, если интерес низкий
    const acceptChance = offer.acceptChance ?? 100;
    const roll = Math.random() * 100;
    if (roll > acceptChance) {
        const reason = (offer.cons && offer.cons.length > 0) ? offer.cons[0] : 'Игрок отказался переходить';
        addNews(`❌ ${player.name} отказался переходить в ${offer.club}: ${reason}`, "negative");
        const e = transferOffers[player.name];
        if (e) {
            e.offers = e.offers.filter(o => o.id !== offer.id);
            if (e.offers.length === 0) delete transferOffers[player.name];
        }
        saveGame();
        renderPlayerScreen();
        return;
    }

    const oldClub = player.club;
    player.club = offer.club;
    player.league = offer.league;
    player.salary = offer.newSalary;
    player.clubLoyalty = 50;
    player.contractYears = offer.years;
    player.lastTransferSeason = currentSeason;

    // Комиссия агента: 10% от годовой зарплаты, выплачивается 26 недель
    const annualCommission = Math.round(offer.newSalary * 1000 * COMMISSION_RATE);
    const weeklyComm = Math.round(annualCommission / 26);
    activeCommissions.push({
        playerName: player.name, club: offer.club, league: offer.league,
        weeklyAmount: weeklyComm, weeksLeft: 26, totalWeeks: 26, newSalary: offer.newSalary
    });
    if (offer.signingBonus) {
        agentMoney += offer.signingBonus;
        addNews(`🎁 ${LANG.t('Подписной бонус')}: +${formatMoney(offer.signingBonus)}`, "positive");
    }

    // ВАЖНО: игрок ОСТАЁТСЯ в myRoster — агент продолжает вести дела клиента после трансфера
    player.agentId = -1;
    delete playerNegotiations[player.name];

    let lD = 0;
    if (offer.tierBoost && offer.salaryBoost >= 1.2) lD = 15;
    else if (offer.tierBoost || offer.salaryBoost >= 1.3) lD = 10;
    else if (offer.salaryBoost >= 1.1) lD = 5;
    else if (offer.salaryBoost < 1.05) lD = -20;
    player.loyalty = Math.max(0, Math.min(100, (player.loyalty ?? 100) + lD));

    delete transferOffers[player.name];
    delete playerNegotiations[player.name];
    careerCounters.transfersDone = (careerCounters.transfersDone || 0) + 1;
    addNews(`🏒 ${player.name} перешёл из ${oldClub || 'свободных агентов'} в ${offer.club}! ${LANG.t('Комиссия: {c} (10% от годовой зарплаты)').replace('{c}', formatMoney(annualCommission))}`, "positive");
    if (lD > 0) addNews(`😊 ${player.name} доволен (+${lD} лояльности)`, "positive");
    else if (lD < 0) addNews(`😐 ${player.name} недоволен (${lD} лояльности)`, "negative");

    closeEventModal();
    updateAllDisplays();
    saveGame();
    renderClientsScreen();
}

function declineTransferOffer(player, offer, permanent) {
    const e = transferOffers[player.name];
    if (!e) return;
    e.offers = e.offers.filter(o => o.id !== offer.id);
    if (!permanent && e.returnCount < 2 && Math.random() < 0.5) {
        pendingClubReturn.push({
            playerName: player.name, club: offer.club, league: offer.league,
            weeksUntil: randomInt(1, 2), boost: 1.2, baseOffer: offer
        });
        addNews(`⏳ ${offer.club} может вернуться с лучшим предложением`, "info");
    }
    if (e.offers.length === 0) {
        delete transferOffers[player.name];
        addNews(`📥 ${player.name} снят с трансфера`, "info");
    }
    saveGame();
    renderPlayerScreen();
}

function cancelActiveTransfer(player) {
    if (transferOffers[player.name]) {
        delete transferOffers[player.name];
        addNews(`❌ ${player.name} снят с трансфера`, "info");
        saveGame();
        renderPlayerScreen();
    }
}

function getAdvisorReport(player, offer) {
    const chance = offer.acceptChance ?? 100;
    const pros = offer.pros || [];
    const cons = offer.cons || [];
    const sD = Math.round((offer.salaryBoost - 1) * 100);

    let verdict, verdictClass, reason;

    if (chance >= 80) {
        verdict = '✅ РЕКОМЕНДУЮ ПРИНЯТЬ';
        verdictClass = 'advisor-good';
        if (offer.tierBoost) reason = 'Переход в лигу выше — большой шаг вперёд для игрока.';
        else if (sD >= 50) reason = 'Зарплата выросла больше чем в полтора раза — отличные условия.';
        else reason = 'Хорошая прибавка и сильный клуб. Игрок будет доволен.';
    } else if (chance >= 50) {
        verdict = '🤔 МОЖНО ПОПРОБОВАТЬ';
        verdictClass = 'advisor-mid';
        if (pros.length > cons.length) reason = 'Плюсов больше, чем минусов. Шансы неплохие.';
        else if (pros.length === cons.length) reason = 'Плюсы и минусы уравновешены. Решай сам.';
        else reason = 'Минусов больше. Игрок может отказаться.';
    } else {
        verdict = '⚠️ НЕ РЕКОМЕНДУЮ';
        verdictClass = 'advisor-bad';
        if (cons.length > 0) reason = 'Основной минус: ' + cons[0].replace(/^[^\s]+\s/, '');
        else reason = 'Игрок вряд ли согласится на такие условия.';
    }

    if (offer.tierBoost && sD >= 40) reason = 'Переход в лигу выше и зарплата +' + sD + '% — почти не откажется.';
    if (offer.tierDown && sD < 20) reason = 'Понижение лиги без серьёзной прибавки — игрок вряд ли согласится.';

    return { verdict, verdictClass, reason };
}

function openTransferOfferModal(player, offer) {
    currentOffer = {player, offer};
    const fl = LEAGUE_DATA[offer.league]?.country.split(' ')[0] || '';
    const ls = getLeagueName(offer.league);
    const sD = Math.round((offer.salaryBoost - 1) * 100);

    eventTitle.textContent = '📥 Предложение клуба';
    eventText.textContent = '';
    const chanceText = (offer.acceptChance ?? 100) >= 80 ? '✅ Игрок хочет перейти' :
                       (offer.acceptChance ?? 100) >= 50 ? '🤔 Игрок в раздумьях' :
                       '⚠️ Игрок скорее откажется';
    const chanceClass = (offer.acceptChance ?? 100) >= 80 ? 'chance-good' :
                        (offer.acceptChance ?? 100) >= 50 ? 'chance-mid' : 'chance-bad';
    const advisor = getAdvisorReport(player, offer);

    eventDetails.innerHTML = `
        <div class="advisor-block ${advisor.verdictClass}">
            <div class="advisor-head">
                <span class="advisor-icon">💼</span>
                <span class="advisor-title">ДОКЛАД СОВЕТНИКА</span>
            </div>
            <div class="advisor-verdict">${advisor.verdict}</div>
            <div class="advisor-reason">${advisor.reason}</div>
        </div>
        <div class="team-modal-logo">${getTeamLogoHTML(offer.club, offer.league)}</div>
        <div class="team-modal-sub">${fl} ${ls} • Престиж ${offer.prestige}</div>
        <div class="team-modal-grid">
            <div class="tm-stat"><span class="lbl">Игрок</span><span class="val">${player.name}</span></div>
            <div class="tm-stat"><span class="lbl">Позиция</span><span class="val">${player.position}</span></div>
            <div class="tm-stat"><span class="lbl">Текущая ЗП</span><span class="val">${formatSalary(player.salary)}</span></div>
            <div class="tm-stat"><span class="lbl">Новая ЗП</span><span class="val">${formatSalary(offer.newSalary)}</span></div>
            <div class="tm-stat"><span class="lbl">Прибавка</span><span class="val">+${sD}%</span></div>
            <div class="tm-stat"><span class="lbl">Лет</span><span class="val">${offer.years}</span></div>
        </div>
        <div class="team-modal-money">
            <div class="tm-money-line"><span>💰 Комиссия/нед</span><span>${formatMoney(offer.weeklyCommission)}</span></div>
            <div class="tm-money-line"><span>💵 Всего</span><span>${formatMoney(offer.totalCommission)}</span></div>
        </div>
        ${offer.pros && offer.pros.length > 0 ? '<div class="offer-reasons-title">👍 Плюсы перехода:</div><div class="offer-reasons">' + offer.pros.map(p => '<div class="offer-pro">' + p + '</div>').join('') + '</div>' : ''}
        ${offer.cons && offer.cons.length > 0 ? '<div class="offer-reasons-title">👎 Минусы перехода:</div><div class="offer-reasons">' + offer.cons.map(c => '<div class="offer-con">' + c + '</div>').join('') + '</div>' : ''}
        <div class="offer-chance ${chanceClass}">${chanceText}</div>
    `;
    eventActions.innerHTML = '';

    const b1 = document.createElement('button');
    b1.className = 'btn-success';
    b1.textContent = '✅ ' + LANG.t('Принять');
    b1.addEventListener('click', () => { closeEventModal(); acceptTransferOffer(player, offer); });
    eventActions.appendChild(b1);

    const b2 = document.createElement('button');
    b2.className = 'btn-warning';
    b2.textContent = '❌ ' + LANG.t('Отклонить');
    b2.addEventListener('click', () => { closeEventModal(); declineTransferOffer(player, offer, false); });
    eventActions.appendChild(b2);

    const b3 = document.createElement('button');
    b3.className = 'btn-primary';
    b3.textContent = '🤝 ' + LANG.t('Торговаться');
    b3.addEventListener('click', () => tryTradeOffer(player, offer));
    eventActions.appendChild(b3);

    const b4 = document.createElement('button');
    b4.className = 'btn-neutral';
    b4.textContent = LANG.t('Закрыть');
    b4.addEventListener('click', () => closeEventModal());
    eventActions.appendChild(b4);

    eventModal.style.display = 'flex';
}

function tryTradeOffer(player, offer) {
    const chance = Math.min(0.85, 0.25 + getTradeBonus());
    closeEventModal();
    if (Math.random() < chance) {
        const boost = 1.15 + Math.random() * 0.10;
        const newSalary = Math.round(offer.newSalary * boost);
        const newComm = Math.round(newSalary * 1000 * COMMISSION_RATE / 52);
        const improved = {
            ...offer, newSalary, weeklyCommission: newComm,
            totalCommission: Math.round(newSalary * 1000 * COMMISSION_RATE),
            salaryBoost: newSalary / Math.max(1, player.salary),
            id: offer.id + "_traded"
        };
        const e = transferOffers[player.name];
        if (e) {
            const idx = e.offers.findIndex(o => o.id === offer.id);
            if (idx !== -1) e.offers[idx] = improved;
        }
        addNews(`🤝 Торг удался! ${offer.club} улучшил до ${formatSalary(newSalary)}`, "positive");
        saveGame();
        setTimeout(() => openTransferOfferModal(player, improved), 150);
    } else {
        const e = transferOffers[player.name];
        if (e) {
            e.offers = e.offers.filter(o => o.id !== offer.id);
            if (e.offers.length === 0) delete transferOffers[player.name];
        }
        addNews(`💢 Торг провалился. ${offer.club} отозвал предложение`, "negative");
        saveGame();
        renderPlayerScreen();
    }
}

// Пассивный канал — клубы сами приходят
function tryPassiveTransferOffer() {
    if (seasonPhase !== 'transfer_mid' && seasonPhase !== 'transfer_off') return false;
    if (upgrades.reputation < 8) return false;
    if (myRoster.length === 0) return false;
    let baseChance = 0.05;
    if (upgrades.reputation >= 20) baseChance = 0.20;
    else if (upgrades.reputation >= 15) baseChance = 0.13;
    else if (upgrades.reputation >= 10) baseChance = 0.08;
    baseChance *= getMediaMultiplier();
    if (Math.random() > baseChance) return false;

    const candidates = [...myRoster].map(p => ({
        player: p,
        weight: p.rating * (1 + p.form * 0.2) * (1 - (p.loyalty ?? 100) / 300)
    })).filter(c => c.weight > 0 && c.player.club);
    if (candidates.length === 0) return false;
    candidates.sort((a, b) => b.weight - a.weight);
    const player = candidates[Math.floor(Math.random() * Math.min(3, candidates.length))].player;
    if (transferOffers[player.name]) return false;
    if (player.lastTransferSeason === currentSeason) return false;

    const clubs = getClubsForPlayer(player);
    if (clubs.length === 0) return false;
    const shuffled = [...clubs].sort(() => Math.random() - 0.5);
    const offers = [];
    // Случайный спрос: 0-5 клубов за раз. 0 — на этой неделе спроса нет (это нормально)
    const cnt = randomInt(0, 5);
    if (cnt === 0) return false;
    for (let i = 0; i < cnt && i < shuffled.length; i++) {
        const o = generateTransferOffer(player, shuffled[i]);
        if (o) offers.push(o);
    }
    if (offers.length === 0) return false;
    offers.sort((a, b) => b.salaryBoost - a.salaryBoost);
    showPassiveOffer(player, offers[0], offers);
    return true;
}

function showPassiveOffer(player, bestOffer, allOffers) {
    const fl = LEAGUE_DATA[bestOffer.league]?.country.split(' ')[0] || '';
    const ls = getLeagueName(bestOffer.league);
    const sD = Math.round((bestOffer.salaryBoost - 1) * 100);

    eventTitle.textContent = '📥 Клуб предлагает контракт';
    eventText.textContent = `${bestOffer.club} заинтересован в ${player.name}.`;
    eventDetails.innerHTML = `
        <div class="team-modal-logo">${getTeamLogoHTML(bestOffer.club, bestOffer.league)}</div>
        <div class="team-modal-sub">${fl} ${ls} • Престиж ${bestOffer.prestige}</div>
        <div class="team-modal-grid">
            <div class="tm-stat"><span class="lbl">Игрок</span><span class="val">${player.name}</span></div>
            <div class="tm-stat"><span class="lbl">Текущая ЗП</span><span class="val">${formatSalary(player.salary)}</span></div>
            <div class="tm-stat"><span class="lbl">Предложение</span><span class="val">${formatSalary(bestOffer.newSalary)}</span></div>
            <div class="tm-stat"><span class="lbl">Прибавка</span><span class="val">+${sD}%</span></div>
            <div class="tm-stat"><span class="lbl">Лет</span><span class="val">${bestOffer.years}</span></div>
        </div>
        <div class="team-modal-money">
            <div class="tm-money-line"><span>💰 Комиссия/нед</span><span>${formatMoney(bestOffer.weeklyCommission)}</span></div>
            <div class="tm-money-line"><span>💵 Всего</span><span>${formatMoney(bestOffer.totalCommission)}</span></div>
        </div>
        ${allOffers.length > 1 ? '<div class="tm-warning" style="background-color:rgba(0,212,255,0.08);border-color:rgba(0,212,255,0.25);color:var(--neon-blue);">💡 Ещё ' + (allOffers.length - 1) + ' клуб(ов) прислали предложения</div>' : ''}
    `;
    eventActions.innerHTML = '';

    if (allOffers.length > 1) {
        const allBtn = document.createElement('button');
        allBtn.className = 'btn-primary';
        allBtn.textContent = `📋 Все предложения (${allOffers.length})`;
        allBtn.addEventListener('click', () => {
            closeEventModal();
            transferOffers[player.name] = {offers: allOffers, weeksLeft: 3, returnCount: 0, active: false, declinedClubs: []};
            saveGame();
            openPlayerScreen(player, 'my');
            playerTab = 'transfer';
            renderPlayerScreen();
        });
        eventActions.appendChild(allBtn);
    }

    const b1 = document.createElement('button');
    b1.className = 'btn-success';
    b1.textContent = '✅ ' + LANG.t('Принять');
    b1.addEventListener('click', () => { closeEventModal(); acceptTransferOffer(player, bestOffer); });
    eventActions.appendChild(b1);

    const b2 = document.createElement('button');
    b2.className = 'btn-warning';
    b2.textContent = '❌ ' + LANG.t('Отклонить');
    b2.addEventListener('click', () => {
        closeEventModal();
        if (Math.random() < 0.5) {
            pendingClubReturn.push({
                playerName: player.name, club: bestOffer.club, league: bestOffer.league,
                weeksUntil: randomInt(1, 2), boost: 1.2, baseOffer: bestOffer
            });
        }
        updateAllDisplays();
        saveGame();
    });
    eventActions.appendChild(b2);

    eventModal.style.display = 'flex';
}

function processPendingClubReturns() {
    const still = [], ready = [];
    pendingClubReturn.forEach(item => {
        item.weeksUntil--;
        if (item.weeksUntil <= 0) ready.push(item);
        else still.push(item);
    });
    pendingClubReturn = still;
    ready.forEach(item => {
        const player = myRoster.find(p => p.name === item.playerName);
        if (!player) return;
        if (player.club === item.club) return;
        const base = item.baseOffer;
        const newSalary = Math.round(base.newSalary * item.boost);
        const newComm = Math.round(newSalary * 1000 * COMMISSION_RATE / 52);
        const improved = {
            ...base, newSalary, weeklyCommission: newComm,
            totalCommission: Math.round(newSalary * 1000 * COMMISSION_RATE),
            id: base.league + "_" + base.club + "_" + Date.now() + "_r"
        };
        addNews(`🔔 ${item.club} вернулся с улучшенным предложением`, "positive");
        showPassiveOffer(player, improved, [improved]);
    });
}

// ============ 27.5. ПРОДЛЕНИЕ КОНТРАКТОВ ============
function isRenewalWindow() {
    return seasonPhase === 'regular' && currentWeek >= RENEWAL_WEEKS_START && currentWeek <= RENEWAL_WEEKS_END;
}

function generateRenewalOffer(player) {
    const data = clubData[player.league + "_" + player.club];
    if (!data) return null;
    const cap = calculateSalaryCap(player.rating, player.league);
    let newSalary = Math.round(player.salary * (1.0 + Math.random() * 0.25));
    if (newSalary > cap) newSalary = Math.round(cap);
    const years = player.age < 25 ? randomInt(2, 4) : player.age < 30 ? randomInt(2, 3) : randomInt(1, 2);
    const bonus = Math.round(newSalary * 1000 * 0.02);
    return {
        club: player.club, league: player.league, prestige: data.prestige,
        currentSalary: player.salary, newSalary, years, signingBonus: bonus,
        salaryBoost: newSalary / Math.max(1, player.salary), isRenewal: true
    };
}

function rollPlayerWantsToLeave(player) {
    let chance = 0.30;
    const loyalty = player.loyalty ?? 100;
    chance -= (loyalty - 50) * 0.006;
    const data = clubData[player.league + "_" + player.club];
    if (data && player.rating > data.prestige + 10) chance += 0.15;
    if (player.age < 25 && player.rating >= 85) chance += 0.10;
    if (player.age > 32) chance -= 0.15;
    return Math.random() < Math.max(0.05, Math.min(0.85, chance));
}

function tryContractRenewal() {
    if (!isRenewalWindow()) return false;
    if (myRoster.length === 0) return false;
    const expiring = myRoster.filter(p =>
        p.club && p.contractYears === 1 && !p.declinedRenewal &&
        !transferOffers[p.name] && p.lastTransferSeason !== currentSeason
    );
    if (expiring.length === 0) return false;
    const player = randomChoice(expiring);
    const offer = generateRenewalOffer(player);
    if (!offer) return false;
    showContractRenewalModal(player, offer, rollPlayerWantsToLeave(player));
    return true;
}

function showContractRenewalModal(player, offer, wantsLeave) {
    const fl = LEAGUE_DATA[offer.league]?.country.split(' ')[0] || '';
    const ls = getLeagueName(offer.league);
    const sD = Math.round((offer.salaryBoost - 1) * 100);

    eventTitle.textContent = '📝 Продление контракта';
    eventText.textContent = wantsLeave ? `${offer.club} предлагает продлить, но ${player.name}, кажется, хочет уйти.` : `${offer.club} предлагает продлить контракт.`;
    eventDetails.innerHTML = `
        <div class="team-modal-logo">${getTeamLogoHTML(offer.club, offer.league)}</div>
        <div class="team-modal-sub">${fl} ${ls} • Престиж ${offer.prestige}</div>
        <div class="team-modal-grid">
            <div class="tm-stat"><span class="lbl">Игрок</span><span class="val">${player.name}</span></div>
            <div class="tm-stat"><span class="lbl">Возраст</span><span class="val">${player.age}</span></div>
            <div class="tm-stat"><span class="lbl">Текущая ЗП</span><span class="val">${formatSalary(offer.currentSalary)}</span></div>
            <div class="tm-stat"><span class="lbl">Новая ЗП</span><span class="val">${formatSalary(offer.newSalary)}</span></div>
            <div class="tm-stat"><span class="lbl">Прибавка</span><span class="val">+${sD}%</span></div>
            <div class="tm-stat"><span class="lbl">Срок</span><span class="val">${formatContractYears(offer.years)}</span></div>
        </div>
        <div class="team-modal-money">
            <div class="tm-money-line"><span>💰 Подписной бонус</span><span>${formatMoney(offer.signingBonus)}</span></div>
        </div>
        ${wantsLeave ? '<div class="tm-warning">⚠️ Игрок хочет уйти</div>' : ''}
    `;
    eventActions.innerHTML = '';

    if (wantsLeave) {
        const b1 = document.createElement('button');
        b1.className = 'btn-primary';
        b1.textContent = '🗣 Уговорить';
        b1.addEventListener('click', () => {
            const chance = Math.min(0.85, 0.30 + getTradeBonus());
            closeEventModal();
            if (Math.random() < chance) {
                addNews(`🗣 Уговорили ${player.name} остаться`, "positive");
                player.loyalty = Math.min(100, (player.loyalty || 0) + 10);
                setTimeout(() => showContractRenewalModal(player, offer, false), 150);
            } else {
                addNews(`❌ ${player.name} отказался`, "negative");
                player.declinedRenewal = true;
                saveGame();
            }
        });
        eventActions.appendChild(b1);

        const b2 = document.createElement('button');
        b2.className = 'btn-warning';
        b2.textContent = '🚪 Отпустить';
        b2.addEventListener('click', () => {
            closeEventModal();
            player.declinedRenewal = true;
            addNews(`😐 ${player.name} отказался продлевать`, "negative");
            saveGame();
        });
        eventActions.appendChild(b2);

        const b3 = document.createElement('button');
        b3.className = 'btn-neutral';
        b3.textContent = 'Решить позже';
        b3.addEventListener('click', () => closeEventModal());
        eventActions.appendChild(b3);
    } else {
        const b1 = document.createElement('button');
        b1.className = 'btn-success';
        b1.textContent = '✅ Продлить';
        b1.addEventListener('click', () => { closeEventModal(); applyContractRenewal(player, offer); });
        eventActions.appendChild(b1);

        const b2 = document.createElement('button');
        b2.className = 'btn-primary';
        b2.textContent = '🤝 Торговаться';
        b2.addEventListener('click', () => tryTradeContract(player, offer));
        eventActions.appendChild(b2);

        const b3 = document.createElement('button');
        b3.className = 'btn-warning';
        b3.textContent = '❌ Отклонить';
        b3.addEventListener('click', () => {
            closeEventModal();
            player.declinedRenewal = true;
            addNews(`❌ Отклонили продление ${player.name}`, "info");
            saveGame();
        });
        eventActions.appendChild(b3);
    }

    eventModal.style.display = 'flex';
}

function applyContractRenewal(player, offer) {
    player.salary = offer.newSalary;
    player.contractYears = offer.years;
    player.declinedRenewal = false;
    if (offer.signingBonus > 0) {
        agentMoney += offer.signingBonus;
        addNews(`💰 Бонус от ${offer.club}: +${formatMoney(offer.signingBonus)}`, "positive");
    }
    addNews(`📝 ${player.name} продлил контракт на ${formatContractYears(offer.years)}`, "positive");
    updateAllDisplays();
    saveGame();
    if (currentPlayerScreen && currentPlayerScreen.name === player.name) renderPlayerScreen();
}

function tryTradeContract(player, offer) {
    const chance = Math.min(0.85, 0.25 + getTradeBonus());
    closeEventModal();
    if (Math.random() < chance) {
        const boost = 1.10 + Math.random() * 0.10;
        const newSalary = Math.round(offer.newSalary * boost);
        const improved = {
            ...offer, newSalary,
            salaryBoost: newSalary / Math.max(1, player.salary),
            signingBonus: Math.round(newSalary * 1000 * 0.05)
        };
        addNews(`🤝 Торг удался! До ${formatSalary(newSalary)}`, "positive");
        saveGame();
        setTimeout(() => showContractRenewalModal(player, improved, false), 150);
    } else {
        addNews(`💢 Торг провалился`, "negative");
        saveGame();
    }
}

function requestContractRenewalFromCard(player) {
    if (!isRenewalWindow()) { uiAlert(LANG.t('Продление только в недели 48–52.')); return; }
    if (!player.club) { uiAlert(LANG.t('Свободный агент — продлевать нечего.')); return; }
    if (player.contractYears > 1) { uiAlert(LANG.t('Контракт ещё') + ' ' + formatContractYears(player.contractYears) + '.'); return; }
    if (player.declinedRenewal) { uiAlert(LANG.t('Игрок уже отказался.')); return; }
    const offer = generateRenewalOffer(player);
    if (!offer) { uiAlert(LANG.t('Ошибка предложения.')); return; }
    showContractRenewalModal(player, offer, rollPlayerWantsToLeave(player));
}

// ============ 28. НАВИГАЦИЯ ============
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', async function () {
        const nav = this.getAttribute('data-nav');
        if (nav === 'exit') {
                if (await uiConfirm(LANG.t('Выйти в меню?'))) {
                saveGame();
                hideBottomNav();
                hidePagination();
                document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
                mainMenu.style.display = 'flex';
                updateContinueCard();
            }
            return;
        }
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        this.classList.add('active');
        currentPage = 1;
        if (nav === 'office') { hidePagination(); showMobileScreen('office-screen'); }
        else if (nav === 'clients') {
            document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
            const cs = document.getElementById('clients-screen');
            if (cs) cs.style.display = 'flex';
            showBottomNav();
            renderClientsScreen();
        }
        else if (nav === 'leagues') {
            hidePagination();
            document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
            const ls = document.getElementById('leagues-screen');
            if (ls) ls.style.display = 'flex';
            showBottomNav();
            renderLeaguesScreen();
        }
        else if (nav === 'market') { showMarketScreen(); }
        else if (nav === 'agency') { showAgencyScreen(); }
    });
});

// Табы клиентов
document.querySelectorAll('#clients-screen .clients-tab').forEach(t => t.addEventListener('click', function () {
    const tt = this.getAttribute('data-tab');
    if (!tt) return;
    clientsTab = tt;
    currentPage = 1;
    renderClientsScreen();
}));

// Лидерборд: открытие и назад
document.getElementById('btn-open-leaderboard')?.addEventListener('click', openLeaderboard);
document.getElementById('lb-back')?.addEventListener('click', () => {
    hidePagination();
    document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
    const l = document.getElementById('leagues-screen');
    if (l) l.style.display = 'flex';
    showBottomNav();
    renderLeaguesScreen();
});

// Табы биржи
document.querySelectorAll('#market-screen .clients-tab').forEach(t => t.addEventListener('click', function () {
    marketTab = this.getAttribute('data-mtab');
    currentPage = 1;
    renderMarketScreen();
}));

// Плитки офиса
document.querySelectorAll('.tile').forEach(tile => {
    tile.addEventListener('click', function () {
        const a = this.getAttribute('data-action');
        if (a === 'event-mail') {
            openPendingEvent();
            return;
        }
        if (a === 'search') {
            clientsTab = 'search';
            currentPage = 1;
            document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
            const cs = document.getElementById('clients-screen');
            if (cs) cs.style.display = 'flex';
            showBottomNav();
            renderClientsScreen();
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            const navC = document.querySelector('.nav-item[data-nav="clients"]');
            if (navC) navC.classList.add('active');
        } else if (a === 'news') showNewsFeedScreen();
        else if (a === 'settings') { settingsModal.style.display = 'flex'; loadSettings(); }
        else if (a === 'about') aboutModal.style.display = 'flex';
        else if (a === 'infrastructure') showInfrastructureScreen();
        else if (a === 'goals') showCareerGoalsScreen();
        else if (a === 'history') {
            document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
            const hs = document.getElementById('event-history-screen');
            if (hs) hs.style.display = 'flex';
            showBottomNav();
            renderEventHistory();
        }
    });
});

// ============ 29. СОЗДАНИЕ АГЕНТСТВА ============
function showCreateAgencyScreen() {
    // Скрываем ВСЁ — главное меню, мобильные экраны, навигацию
    document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
    mainMenu.style.display = 'none';
    hideBottomNav();
    hidePagination();
    const s = document.getElementById('create-agency-screen');
    if (s) s.style.display = 'flex';
    renderCreateAgency();
}

function renderCreateAgency() {
    const c = document.getElementById('create-agency-content');
    if (!c) return;
    c.innerHTML = `
        <div class="create-hero">
            <div class="create-icon">🏢</div>
            <div class="create-title">${LANG.t('Создай свою империю')}</div>
        </div>
        <div class="create-field">
            <label>${LANG.t('Имя агента')}</label>
            <input type="text" id="ca-name" maxlength="30" placeholder="${LANG.t('Иван Петров')}" />
        </div>
        <div class="create-field">
            <label>${LANG.t('Название агентства')}</label>
            <input type="text" id="ca-agency" maxlength="30" placeholder="Elite Hockey Management" />
        </div>
        <div class="create-field">
            <label>${LANG.t('Страна')}</label>
            <div class="country-grid" id="ca-countries"></div>
        </div>
        <button class="big-action-btn" id="ca-start">
            <span class="big-action-icon">▶</span>
            <span class="big-action-text">${LANG.t('Начать карьеру')}</span>
        </button>
    `;
    const countries = [
        {code: 'RU', flag: '🇷🇺', name: LANG.t('Россия')},
        {code: 'US', flag: '🇺🇸', name: LANG.t('США')},
        {code: 'CA', flag: '🇨🇦', name: LANG.t('Канада')},
        {code: 'SE', flag: '🇸🇪', name: LANG.t('Швеция')},
        {code: 'FI', flag: '🇫🇮', name: LANG.t('Финляндия')},
        {code: 'CZ', flag: '🇨🇿', name: LANG.t('Чехия')},
        {code: 'SK', flag: '🇸🇰', name: LANG.t('Словакия')},
        {code: 'DE', flag: '🇩🇪', name: LANG.t('Германия')},
        {code: 'CH', flag: '🇨🇭', name: LANG.t('Швейцария')},
        {code: 'BY', flag: '🇧🇾', name: LANG.t('Беларусь')},
        {code: 'KZ', flag: '🇰🇿', name: LANG.t('Казахстан')},
        {code: 'LV', flag: '🇱🇻', name: LANG.t('Латвия')}
    ];
    const grid = document.getElementById('ca-countries');
    let selected = 'RU';
    countries.forEach(co => {
        const btn = document.createElement('button');
        btn.className = 'country-btn' + (co.code === 'RU' ? ' active' : '');
        btn.innerHTML = `<span>${co.flag}</span><span>${co.name}</span>`;
        btn.addEventListener('click', () => {
            selected = co.code;
            grid.querySelectorAll('.country-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
        grid.appendChild(btn);
    });

    document.getElementById('ca-start').addEventListener('click', () => {
        const name = document.getElementById('ca-name').value.trim() || LANG.t('Агент');
        const agency = document.getElementById('ca-agency').value.trim() || LANG.t('Моё агентство');
        const co = countries.find(x => x.code === selected);
        agentName = name;
        agencyName = agency;
        agencyCountry = co.code;
        agencyFlag = co.flag;
        startNewGame();
    });
}

function startNewGame() {
    resetGame();
    document.getElementById('create-agency-screen').style.display = 'none';
    showMobileScreen('office-screen');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const nav = document.querySelector('.nav-item[data-nav="office"]');
    if (nav) nav.classList.add('active');
    updateAllDisplays();
    saveGame();
}

// ============ 30. МЕНЮ ============
btnNewGame.addEventListener('click', async function () {
    if (hasSave()) { if (!(await uiConfirm(LANG.t('Начать новую игру?')))) return; deleteSave(); }
    showCreateAgencyScreen();
});

btnLoadGame.addEventListener('click', async function () {
    if (!hasSave()) { uiAlert(LANG.t('Сохранений нет')); return; }
    if (await loadGame()) {
        mainMenu.style.display = 'none';
        showMobileScreen('office-screen');
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const nav = document.querySelector('.nav-item[data-nav="office"]');
        if (nav) nav.classList.add('active');
        updateAllDisplays();
    } else uiAlert(LANG.t('Ошибка загрузки'));
});

// ============ 31. НАСТРОЙКИ ============
if (btnSettings) btnSettings.addEventListener('click', () => { settingsModal.style.display = 'flex'; loadSettings(); });

// ============ МОДАЛКА ДАТАПАКА ============
document.getElementById('btn-datapack')?.addEventListener('click', openDatapackModal);

// ============ ВЫБОР ЯЗЫКА ============
function updateLangButton() {
    const flagEl = document.getElementById('menu-lang-flag');
    const codeEl = document.getElementById('menu-lang-code');
    if (flagEl && codeEl && typeof LANG !== 'undefined') {
        flagEl.textContent = LANG.current === 'en' ? '🇬🇧' : '🇷🇺';
        codeEl.textContent = LANG.current === 'en' ? 'EN' : 'RU';
    }
    // Обновляем активную кнопку в настройках
    document.querySelectorAll('#settings-lang-switch .lang-switch-btn').forEach(b => {
        if (typeof LANG !== 'undefined' && b.getAttribute('data-lang') === LANG.current) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });
}

function switchLang(lang) {
    if (typeof LANG === 'undefined') return;
    if (LANG.current === lang) return;
    LANG.set(lang);
    // Перерисовываем экраны с динамическим контентом
    if (typeof updateAllDisplays === 'function') updateAllDisplays();
}

// Кнопка в главном меню — по клику переключаем RU ↔ EN
document.getElementById('menu-lang-btn')?.addEventListener('click', () => {
    if (typeof LANG === 'undefined') return;
    switchLang(LANG.current === 'ru' ? 'en' : 'ru');
});

// Кнопки в настройках
document.querySelectorAll('#settings-lang-switch .lang-switch-btn').forEach(b => {
    b.addEventListener('click', () => {
        const lang = b.getAttribute('data-lang');
        if (lang) switchLang(lang);
    });
});

// При старте обновим внешний вид кнопки
if (typeof LANG !== 'undefined') {
    updateLangButton();
}

// Обновление кнопки датапака в главном меню в зависимости от состояния
function updateDatapackButton() {
    const titleEl = document.getElementById('btn-datapack-title');
    const descEl = document.getElementById('btn-datapack-desc');
    if (!titleEl || !descEl) return;

    if (datapackActive) {
        titleEl.textContent = '📦 Оригинальные данные';
        descEl.textContent = '✓ Активны · нажми, чтобы настроить';
    } else {
        titleEl.textContent = 'Оригинальные данные';
        descEl.textContent = 'Реальные названия и имена';
    }
}

function openDatapackModal() {
    const modal = document.getElementById('datapack-modal');
    const body = document.getElementById('datapack-modal-body');
    const actions = document.getElementById('datapack-modal-actions');
    const titleEl = document.getElementById('datapack-modal-title');
    if (!modal || !body || !actions) return;

    const isActive = !!datapackActive;

    if (titleEl) {
        titleEl.textContent = isActive ? '📦 Оригинальные данные (вкл.)' : '📦 Оригинальные данные';
    }

    let html = `
        <div class="dp-intro">
            <div class="dp-intro-icon">📦</div>
            <div class="dp-intro-title">Реальные названия и игроки</div>
            <div class="dp-intro-sub">Включи оригинальные данные — игра станет узнаваемее</div>
        </div>
    `;

    if (isActive) {
        html += `
            <div class="dp-status-on">✓ ДАТАПАК АКТИВЕН</div>
            <div class="dp-list">
                <div class="dp-list-title">${LANG.t('Сейчас в игре')}</div>
                <ul>
                    <li>${LANG.t('Реальные названия клубов NHL и KHL')}</li>
                    <li>${LANG.t('Реальные имена игроков стартовых составов')}</li>
                    <li>${LANG.t('Реальные флаги национальных сборных')}</li>
                </ul>
            </div>
            <div class="dp-note">ℹ️ ${LANG.t('Реальные составы: KHL, NHL. Остальные лиги — процедурная генерация')}</div>
            <div class="dp-warning">
                <b>${LANG.t('Внимание')}.</b> ${LANG.t('Отключение датапака перезапишет все названия клубов и имена игроков в твоём сейве на вымышленные. Действие необратимо.')}
            </div>
        `;
    } else {
        html += `
            <div class="dp-list">
                <div class="dp-list-title">${LANG.t('Что будет включено')}</div>
                <ul>
                    <li>${LANG.t('Реальные названия клубов NHL и KHL')}</li>
                    <li>${LANG.t('Реальные имена игроков стартовых составов')}</li>
                    <li>${LANG.t('Реальные флаги национальных сборных')}</li>
                </ul>
            </div>
            <div class="dp-note">ℹ️ ${LANG.t('Реальные составы: KHL, NHL. Остальные лиги — процедурная генерация')}</div>
            <div class="dp-warning">
                <b>${LANG.t('Что не изменится')}.</b> ${LANG.t('Экономика, цели, турниры, симуляция матчей — всё работает одинаково.')}
            </div>
            <div class="dp-legal">
                ${LANG.t('Все права на названия, логотипы и имена принадлежат их владельцам. Данные предоставляются исключительно в личных, некоммерческих целях.')}
            </div>
        `;
    }

    body.innerHTML = html;
    actions.innerHTML = '';

    if (isActive) {
        // Кнопка отключения
        const offBtn = document.createElement('button');
        offBtn.className = 'btn-warning';
        offBtn.textContent = '🚫 Отключить датапак';
        offBtn.addEventListener('click', async () => {
            if (!(await uiConfirm(LANG.t('Отключить датапак? Все названия клубов и игроков в текущем сейве вернутся к вымышленным. Действие необратимо.')))) return;
            modal.style.display = 'none';
            if (typeof window.deactivateDatapack === 'function') {
                window.deactivateDatapack();
            } else {
                uiAlert(LANG.t('Функция отключения не загружена.'));
            }
        });
        actions.appendChild(offBtn);
    } else {
        // Кнопка активации
        const onBtn = document.createElement('button');
        onBtn.className = 'btn-success';
        onBtn.textContent = '✅ Я подтверждаю и принимаю условия';
        onBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            if (typeof window.activateDatapack === 'function') {
                window.activateDatapack();
            } else {
                uiAlert(LANG.t('Функция активации не загружена.'));   
            }
        });
        actions.appendChild(onBtn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn-neutral';
    closeBtn.textContent = LANG.t('Отмена');
    closeBtn.addEventListener('click', () => modal.style.display = 'none');
    actions.appendChild(closeBtn);

    modal.style.display = 'flex';
}

// Вызов при старте
updateDatapackButton();
if (btnSettingsClose) btnSettingsClose.addEventListener('click', () => settingsModal.style.display = 'none');
if (settingsModal) settingsModal.addEventListener('click', e => { if (e.target === settingsModal) settingsModal.style.display = 'none'; });
if (btnAbout) btnAbout.addEventListener('click', () => aboutModal.style.display = 'flex');
if (btnAboutClose) btnAboutClose.addEventListener('click', () => aboutModal.style.display = 'none');
if (aboutModal) aboutModal.addEventListener('click', e => { if (e.target === aboutModal) aboutModal.style.display = 'none'; });

const SETTINGS_KEY = 'hockeyLegendSettings';
let gameSettings = {sound: true, vibration: true, notifications: true};

// ============ ЗВУК (Web Audio API, без файлов) ============
let _audioCtx = null;
function getAudioCtx() {
    if (_audioCtx) return _audioCtx;
    try {
        _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        if (window.DEBUG) console.log('AudioContext unavailable:', e.message);
        _audioCtx = null;
    }
    return _audioCtx;
}
// Разблокировка аудио по первому пользовательскому жесту (требование браузеров)
document.addEventListener('pointerdown', () => {
    const ctx = getAudioCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}, { once: false, passive: true });

/**
 * Проигрывает короткий тон.
 * @param {string} kind — click | levelup | goal | event | error
 */
function playSound(kind) {
    if (!gameSettings.sound) return;
    const ctx = getAudioCtx();
    if (!ctx || ctx.state !== 'running') return;
    try {
        const presets = {
            click:   { freq: 520,  dur: 0.05, type: 'square',   vol: 0.06 },
            levelup: { freq: 660,  dur: 0.35, type: 'triangle', vol: 0.12, arp: [523, 659, 784, 1047] },
            goal:    { freq: 440,  dur: 0.3,  type: 'sawtooth', vol: 0.12, arp: [440, 554, 659] },
            event:   { freq: 740,  dur: 0.18, type: 'sine',     vol: 0.10, arp: [740, 988] },
            error:   { freq: 220,  dur: 0.2,  type: 'square',   vol: 0.10 }
        };
        const p = presets[kind] || presets.click;
        const now = ctx.currentTime;
        const notes = p.arp || [p.freq];
        notes.forEach((f, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = p.type;
            osc.frequency.value = f;
            const start = now + i * (p.dur / notes.length);
            const end = now + p.dur;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(p.vol, start + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, end);
            osc.connect(gain).connect(ctx.destination);
            osc.start(start);
            osc.stop(end + 0.02);
        });
    } catch (e) {
        if (window.DEBUG) console.log('playSound error:', e.message);
    }
}

// ============ ВИБРАЦИЯ (паттерны по типу события) ============
function vibrate(kind) {
    if (!gameSettings.vibration || !navigator.vibrate) return;
    try {
        const patterns = {
            click: 10,
            goal: [60, 40, 120],
            levelup: [40, 60, 40, 60, 160],
            event: [30, 30, 30],
            error: 80
        };
        navigator.vibrate(patterns[kind] || 15);
    } catch (e) {}
}

// ============ TOAST-УВЕДОМЛЕНИЯ ============
// Неблокирующая замена alert(): тост показывается даже при выключенных уведомлениях
function uiAlert(text, type) {
    const prev = gameSettings.notifications;
    gameSettings.notifications = true;
    try { showToast(String(text), type || 'info'); }
    finally { gameSettings.notifications = prev; }
    if (typeof playSound === 'function') playSound(type === 'negative' ? 'error' : 'click');
}

// Неблокирующая замена confirm(). Возвращает Promise<boolean>.
// Использование: if (!(await uiConfirm('...'))) return;
let _confirmResolver = null;
function uiConfirm(message, options) {
    const opts = options || {};
    const modal = document.getElementById('confirm-modal');
    const textEl = document.getElementById('confirm-text');
    const titleEl = document.getElementById('confirm-title');
    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');
    if (!modal || !textEl || !okBtn || !cancelBtn) {
        return Promise.resolve(window.confirm(message)); // fallback
    }
    if (_confirmResolver) { const prev = _confirmResolver; _confirmResolver = null; prev(false); }
    textEl.textContent = message;
    if (titleEl) titleEl.textContent = opts.title || LANG.t('Подтверждение');
    okBtn.textContent = opts.okText || LANG.t('Подтвердить');
    cancelBtn.textContent = opts.cancelText || LANG.t('Отмена');
    modal.style.display = 'flex';
    return new Promise(resolve => {
        const cleanup = () => {
            modal.style.display = 'none';
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            _confirmResolver = null;
        };
        const onOk = () => { cleanup(); playSound('event'); resolve(true); };
        const onCancel = () => { cleanup(); playSound('click'); resolve(false); };
        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        _confirmResolver = resolve;
    });
}

function showToast(text, type) {    if (!gameSettings.notifications) return;
    try {
        let wrap = document.getElementById('toast-wrap');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.id = 'toast-wrap';
            wrap.setAttribute('role', 'status');
            wrap.setAttribute('aria-live', 'polite');
            document.body.appendChild(wrap);
        }
        const toast = document.createElement('div');
        toast.className = 'game-toast ' + (type === 'positive' ? 'toast-positive' : type === 'negative' ? 'toast-negative' : 'toast-info');
        toast.textContent = text;
        wrap.appendChild(toast);
        // Анимация появления (в следующем кадре) и удаления через 3.2с
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 350);
        }, 3200);
        // Не более 4 тостов одновременно
        while (wrap.children.length > 4) wrap.firstChild.remove();
    } catch (e) {
        if (window.DEBUG) console.log('showToast error:', e.message);
    }
}

function loadSettings() {
    try { const r = localStorage.getItem(SETTINGS_KEY); if (r) gameSettings = {...gameSettings, ...JSON.parse(r)}; } catch (e) {}
    const sS = document.getElementById('setting-sound'), sV = document.getElementById('setting-vibration'), sN = document.getElementById('setting-notifications');
    if (sS) sS.checked = gameSettings.sound;
    if (sV) sV.checked = gameSettings.vibration;
    if (sN) sN.checked = gameSettings.notifications;
}
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(gameSettings)); } catch (e) {} }

// ============ ЭКСПОРТ / ИМПОРТ СЕЙВА (v1.0) ============
function exportSave() {
    try {
        // Берём свежий слепок (saveGame кладёт последний в _lastSaveData)
        const data = window._lastSaveData;
        if (!data) { showToast(LANG.t('Нет данных для экспорта — сыграйте хотя бы одну неделю'), 'negative'); playSound('error'); return; }
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const d = new Date();
        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        a.href = url;
        a.download = `hockey-legend-save_${dateStr}_S${data.s}W${data.w}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        showToast(LANG.t('Сейв экспортирован в файл'), 'positive');
        playSound('event');
    } catch (e) {
        showToast(LANG.t('Ошибка экспорта') + ': ' + e.message, 'negative');
        playSound('error');
    }
}

function importSaveFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
        try {
            const data = JSON.parse(reader.result);
            if (!data || typeof data !== 'object' || !data.v || !Array.isArray(data.players)) {
                showToast(LANG.t('Файл не похож на сохранение Hockey Legend'), 'negative');
                playSound('error');
                return;
            }
            if (!(await uiConfirm(LANG.t('Загрузить сейв из файла? Текущая карьера будет заменена.')))) return;
            idbSet(SAVE_KEY, data).then(() => {
                try { localStorage.setItem(HAS_SAVE_FLAG, '1'); } catch (e) {}
                showToast(LANG.t('Сейв импортирован. Перезагрузка...'), 'positive');
                setTimeout(() => location.reload(), 900);
            }).catch(() => {
                try {
                    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
                    localStorage.setItem(HAS_SAVE_FLAG, '1');
                    showToast(LANG.t('Сейв импортирован. Перезагрузка...'), 'positive');
                    setTimeout(() => location.reload(), 900);
                } catch (e2) {
                    showToast(LANG.t('Ошибка импорта') + ': ' + e2.message, 'negative');
                    playSound('error');
                }
            });
        } catch (e) {
            showToast(LANG.t('Ошибка чтения файла') + ': ' + e.message, 'negative');
            playSound('error');
        }
    };
    reader.onerror = () => {
        showToast(LANG.t('Ошибка чтения файла'), 'negative');
        playSound('error');
    };
    reader.readAsText(file);
}

document.getElementById('btn-export-save')?.addEventListener('click', exportSave);
document.getElementById('btn-import-save')?.addEventListener('click', () => {
    document.getElementById('import-save-input')?.click();
});
document.getElementById('import-save-input')?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) importSaveFile(e.target.files[0]);
    e.target.value = ''; // повторный выбор того же файла тоже срабатывает
});
document.getElementById('setting-sound')?.addEventListener('change', e => { gameSettings.sound = e.target.checked; saveSettings(); });
document.getElementById('setting-vibration')?.addEventListener('change', e => { gameSettings.vibration = e.target.checked; saveSettings(); });
document.getElementById('setting-notifications')?.addEventListener('change', e => { gameSettings.notifications = e.target.checked; saveSettings(); });
document.getElementById('btn-reset-save')?.addEventListener('click', async () => {
    if (await uiConfirm(LANG.t('Удалить ВСЕ сохранения?'))) {
        await idbDelete(SAVE_KEY).catch(() => {});
        // Удаляем только ключи сохранения, не трогая настройки, язык и флаг датапака
        try {
            localStorage.removeItem(SAVE_KEY);
            localStorage.removeItem(HAS_SAVE_FLAG);
        } catch(e) {}
        location.reload();
    }
});

// ============ 32. ГЛАВНОЕ МЕНЮ ============
function updateGreeting() {
    const el = document.getElementById('menu-greeting');
    if (!el) return;
    const h = new Date().getHours();
    const key = h >= 5 && h < 12 ? 'Доброе утро, агент' : h >= 12 && h < 18 ? 'Добрый день, агент' : h >= 18 && h < 23 ? 'Добрый вечер, агент' : 'Не спится, агент?';
    el.textContent = LANG.t(key);
}

const WORLD_NEWS = [
    {text: 'СКА выиграл Кубок Гагарина!', emoji: '🏆'},
    {text: 'Овечкин приближается к рекорду', emoji: '⚡'},
    {text: 'Новый контракт Капризова — $12M', emoji: '💰'},
    {text: 'Кучеров — лучший бомбардир NHL', emoji: '🥇'},
    {text: 'Шанхайские Драконы в плей-офф', emoji: '🐉'},
    {text: 'Молодой талант из МХЛ побил рекорд', emoji: '⭐'},
    {text: 'Акции NHL выросли на 15%', emoji: '📈'},
    {text: 'Тренер ЦСКА уволен', emoji: '🔴'}
];
let currentNewsIdx = 0;
function updateWorldNews() {
    const t = document.getElementById('menu-news-text');
    const i = document.querySelector('.menu-news .news-icon');
    if (!t) return;
    const n = WORLD_NEWS[currentNewsIdx];
    t.textContent = LANG.t(n.text);
    if (i) i.textContent = n.emoji;
    currentNewsIdx = (currentNewsIdx + 1) % WORLD_NEWS.length;
}

function generateSnowflakes() {
    const c = document.getElementById('menu-snow');
    if (!c) return;
    c.innerHTML = '';
    for (let i = 0; i < 25; i++) {
        const f = document.createElement('div');
        f.className = 'snowflake';
        f.style.left = Math.random() * 100 + '%';
        f.style.animationDuration = (6 + Math.random() * 8) + 's';
        f.style.animationDelay = (Math.random() * 8) + 's';
        f.style.opacity = 0.2 + Math.random() * 0.4;
        const s = 2 + Math.random() * 3;
        f.style.width = s + 'px';
        f.style.height = s + 'px';
        c.appendChild(f);
    }
}

async function updateContinueCard() {
    const card = document.getElementById('continue-card');
    if (!card) return;
    if (!hasSave()) { card.style.display = 'none'; return; }
    try {
        const d = await idbGet(SAVE_KEY);
        if (!d) { card.style.display = 'none'; return; }
        document.getElementById('continue-season').textContent = (d.s || 2026) + '/' + ((d.s || 2026) + 1);
        document.getElementById('continue-week').textContent = d.w || 1;
        document.getElementById('continue-money').textContent = '$' + ((d.money || 3000) >= 1000 ? Math.floor((d.money || 3000) / 1000) + 'K' : d.money);
        document.getElementById('continue-clients').textContent = (d.roster || []).length;
        card.style.display = 'block';
    } catch (e) { card.style.display = 'none'; }
}
document.getElementById('continue-card')?.addEventListener('click', () => document.getElementById('btn-load-game')?.click());

// ============ ПЕРЕИМЕНОВАНИЕ КЛУБОВ В СЕЙВЕ (real <-> fake) ============
// Единая логика для активации и деактивации датапака.
// R — словарь «старое имя → новое имя».
function applyClubRenameMap(R) {
    const rename = (name) => (name && R[name]) ? R[name] : name;

    // 1. Игроки — поле club + seasonHistory
    players.forEach(p => {
        if (p.club) p.club = rename(p.club);
        if (Array.isArray(p.seasonHistory)) {
            p.seasonHistory.forEach(s => { if (s.club) s.club = rename(s.club); });
        }
    });

    // 2. standings
    Object.keys(standings).forEach(lk => {
        (standings[lk] || []).forEach(t => { if (t.club) t.club = rename(t.club); });
    });

    // 3. clubData ключи
    const newClubData = {};
    Object.keys(clubData).forEach(k => {
        const parts = splitClubKey(k);
        if (!parts) { newClubData[k] = clubData[k]; return; }
        const newClub = rename(parts.club);
        const c = clubData[k];
        if (c) c.club = newClub;
        newClubData[parts.lk + '_' + newClub] = c;
    });
    clubData = newClubData;

    // 4. seasonSchedule
    Object.keys(seasonSchedule).forEach(lk => {
        (seasonSchedule[lk] || []).forEach(m => {
            if (m.home) m.home = rename(m.home);
            if (m.away) m.away = rename(m.away);
        });
    });

    // 5. championsHistory
    Object.keys(championsHistory).forEach(lk => {
        (championsHistory[lk] || []).forEach(h => {
            if (h.champion) h.champion = rename(h.champion);
            if (h.finalist) h.finalist = rename(h.finalist);
        });
    });

    // 6. clubSeasonPositions ключи
    const newPos = {};
    Object.keys(clubSeasonPositions).forEach(k => {
        const parts = splitClubKey(k);
        if (!parts) { newPos[k] = clubSeasonPositions[k]; return; }
        newPos[parts.lk + '_' + rename(parts.club)] = clubSeasonPositions[k];
    });
    clubSeasonPositions = newPos;

    // 7. worldCupState
    if (worldCupState) {
        if (Array.isArray(worldCupState.teams)) {
            worldCupState.teams.forEach(t => { if (t.club) t.club = rename(t.club); });
        }
        if (worldCupState.teamLeague) {
            const tl = {};
            Object.keys(worldCupState.teamLeague).forEach(k => { tl[rename(k)] = worldCupState.teamLeague[k]; });
            worldCupState.teamLeague = tl;
        }
        if (worldCupState.strengths) {
            const st = {};
            Object.keys(worldCupState.strengths).forEach(k => { st[rename(k)] = worldCupState.strengths[k]; });
            worldCupState.strengths = st;
        }
        if (worldCupState.standings) {
            ['A', 'B'].forEach(conf => {
                if (!worldCupState.standings[conf]) return;
                const ns = {};
                Object.keys(worldCupState.standings[conf]).forEach(k => {
                    const row = worldCupState.standings[conf][k];
                    if (row) row.club = rename(row.club || k);
                    ns[rename(k)] = row;
                });
                worldCupState.standings[conf] = ns;
            });
        }
        if (worldCupState.conferences) {
            ['A', 'B'].forEach(conf => {
                if (Array.isArray(worldCupState.conferences[conf])) {
                    worldCupState.conferences[conf].forEach(t => { if (t.club) t.club = rename(t.club); });
                }
            });
        }
        if (worldCupState.playoff) {
            const fix = (s) => {
                if (!s) return;
                if (s.teamA && s.teamA.club) s.teamA.club = rename(s.teamA.club);
                if (s.teamB && s.teamB.club) s.teamB.club = rename(s.teamB.club);
                if (s.winner && s.winner.club) s.winner.club = rename(s.winner.club);
            };
            if (Array.isArray(worldCupState.playoff.series)) worldCupState.playoff.series.forEach(fix);
            if (Array.isArray(worldCupState.playoff.history)) {
                worldCupState.playoff.history.forEach(h => {
                    if (Array.isArray(h.series)) h.series.forEach(fix);
                });
            }
        }
        if (worldCupState.champion && worldCupState.champion.club) worldCupState.champion.club = rename(worldCupState.champion.club);
        if (Array.isArray(worldCupState.history)) {
            worldCupState.history.forEach(h => {
                if (h.champion) h.champion = rename(h.champion);
                if (h.runnerUp) h.runnerUp = rename(h.runnerUp);
            });
        }
        // Расписание группового этапа и отложенные матчи — иначе КЧ «зависает»
        if (worldCupState.schedule) {
            ['A', 'B'].forEach(conf => {
                if (!Array.isArray(worldCupState.schedule[conf])) return;
                worldCupState.schedule[conf].forEach(m => {
                    if (!m) return;
                    if (m.home) m.home = rename(m.home);
                    if (m.away) m.away = rename(m.away);
                });
            });
        }
        if (Array.isArray(worldCupState._pendingMatches)) {
            worldCupState._pendingMatches.forEach(m => {
                if (!m) return;
                if (m.home) m.home = rename(m.home);
                if (m.away) m.away = rename(m.away);
            });
        }
    }

    // 8. portfolio ключи
    const newPortfolio = {};
    Object.keys(myPortfolio).forEach(k => {
        const parts = splitClubKey(k);
        if (!parts || !parts.club) { newPortfolio[k] = myPortfolio[k]; return; }
        newPortfolio[parts.lk + '_' + rename(parts.club)] = myPortfolio[k];
    });
    myPortfolio = newPortfolio;

    // 9. presidentClubKey
    if (presidentClubKey) {
        const parts = splitClubKey(presidentClubKey);
        if (parts && parts.club) presidentClubKey = parts.lk + '_' + rename(parts.club);
    }

    // 10. draftData
    if (draftData && Array.isArray(draftData.picks)) {
        draftData.picks.forEach(pk => {
            if (pk.nhlClub) pk.nhlClub = rename(pk.nhlClub);
            if (pk.player && pk.player.club) pk.player.club = rename(pk.player.club);
        });
    }

    // 11. activeTasks.params.originalClub
    activeTasks.forEach(t => {
        if (t.params && t.params.originalClub) t.params.originalClub = rename(t.params.originalClub);
    });

    // 12. pendingClubReturn
    pendingClubReturn.forEach(item => {
        if (item.club) item.club = rename(item.club);
    });

    // 13. transferOffers
    Object.keys(transferOffers || {}).forEach(playerName => {
        const entry = transferOffers[playerName];
        if (entry && Array.isArray(entry.offers)) {
            entry.offers.forEach(o => { if (o.club) o.club = rename(o.club); });
        }
    });

    // 14. playoffState
    Object.keys(playoffState || {}).forEach(lk => {
        const st = playoffState[lk];
        if (!st) return;
        if (Array.isArray(st.series)) {
            st.series.forEach(s => {
                if (s.teamA && s.teamA.name) s.teamA.name = rename(s.teamA.name);
                if (s.teamB && s.teamB.name) s.teamB.name = rename(s.teamB.name);
                if (s.winner && s.winner.name) s.winner.name = rename(s.winner.name);
            });
        }
        if (Array.isArray(st.groups)) {
            st.groups.forEach(g => {
                if (Array.isArray(g.teams)) {
                    g.teams.forEach(t => { if (t.name) t.name = rename(t.name); });
                }
            });
        }
    });
}

function activateDatapack() {
    if (datapackActive) {
        uiAlert(LANG.t('Датапак уже активен.'));
        return;
    }
    datapackActive = true;
    try { localStorage.setItem('hockeyLegendDatapackActive', '1'); } catch (e) {}
    if (typeof window.applyRealTeamNames === 'function') window.applyRealTeamNames();
    applyClubRenameMap(window.TEAM_RENAMES_REVERSE || {});
    saveGame();
    updateAllDisplays();
    if (typeof updateDatapackButton === 'function') updateDatapackButton();
    uiAlert(LANG.t('📦 Датапак активирован! Реальные названия клубов включены.'));
}
window.activateDatapack = activateDatapack;

function deactivateDatapack() {
    if (!datapackActive) {
        uiAlert(LANG.t('Датапак уже отключён.'));
        return;
    }
    datapackActive = false;
    try { localStorage.removeItem('hockeyLegendDatapackActive'); } catch (e) {}
    if (typeof window.applyFakeTeamNames === 'function') window.applyFakeTeamNames();
    applyClubRenameMap(window.TEAM_RENAMES || {});
    saveGame();
    updateAllDisplays();
    if (typeof updateDatapackButton === 'function') updateDatapackButton();
    uiAlert(LANG.t('📦 Датапак отключён. Вернулись вымышленные названия.'));
}
window.deactivateDatapack = deactivateDatapack;

// ============ 33. ИНИЦИАЛИЗАЦИЯ ============
// Применяем правильное состояние клубов: fake или real
if (typeof window.applyFakeTeamNames === 'function' && typeof datapackActive !== 'undefined' && !datapackActive) {
    window.applyFakeTeamNames();
}

// === Глобальный звук клика (делегирование, только по интерактивным элементам) ===
document.addEventListener('pointerdown', (e) => {
    const t = e.target.closest('button, .tile, .player-row, .stock-row, .league-card, .neg-club-item');
    if (t) playSound('click');
}, { passive: true });

// ============ КНОПКА "НАЗАД" ANDROID (v1.0) ============
// Модалки, которые можно закрыть системной кнопкой Назад.
// При открытии модалки делаем pushState; popstate закрывает верхнюю открытую модалку.
const BACK_HANDLERS = [
    { id: 'negotiation-modal', close: () => { closeNegotiationModal(); activeNegotiation = null; } },
    { id: 'event-modal',       close: () => { eventModal.style.display = 'none'; } },
    { id: 'stock-trade-modal', close: () => { document.getElementById('stock-trade-modal').style.display = 'none'; } },
    { id: 'settings-modal',    close: () => { settingsModal.style.display = 'none'; } },
    { id: 'datapack-modal',    close: () => { document.getElementById('datapack-modal').style.display = 'none'; } },
    { id: 'about-modal',       close: () => { if (aboutModal) aboutModal.style.display = 'none'; } },
    { id: 'club-info-modal',   close: () => { if (typeof closeClubInfoModal === 'function') closeClubInfoModal(); } },
    { id: 'draft-choice-modal',close: () => { document.getElementById('draft-choice-modal').style.display = 'none'; } }
];
function pushModalHistory() {
    try { history.pushState({ hlModal: true }, ''); } catch (e) {}
}
window.addEventListener('popstate', () => {
    for (const h of BACK_HANDLERS) {
        const el = document.getElementById(h.id);
        if (el && el.style.display !== 'none' && el.style.display !== '') {
            try { h.close(); } catch (e) { if (window.DEBUG) console.log('back close error', e); }
            // Снова кладём состояние — кнопка Назад работает как «закрыть модалку», а не «выйти»
            setTimeout(pushModalHistory, 0);
            return;
        }
    }
});
// следим за открытием модалок (мутация display) — кладём history-состояние
(function () {
    const ids = BACK_HANDLERS.map(h => h.id);
    const observer = new MutationObserver(() => {
        for (const id of ids) {
            const el = document.getElementById(id);
            if (el && el.style.display === 'flex') { pushModalHistory(); break; }
        }
    });
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) observer.observe(el, { attributes: true, attributeFilter: ['style'] });
    });
})();

updateGreeting();
updateWorldNews();
// Тикер мировых новостей работает только на экране меню (экономия ресурсов + нет утечки)
window._worldNewsTimer = setInterval(() => {
    const menu = document.getElementById('main-menu');
    if (menu && menu.style.display !== 'none' && typeof updateWorldNews === 'function') updateWorldNews();
}, 5000);
loadSettings();
generateSnowflakes();
updateContinueCard();
hideBottomNav();

// ============ ДОСТУПНОСТЬ (клавиатура) ============
// Навигационные плитки и .tile — это div, делаем их фокусируемыми и «кнопками»
(function initA11y() {
    const mark = () => {
        document.querySelectorAll('.nav-item, .tile').forEach(el => {
            if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
            if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
            if (!el.hasAttribute('aria-label')) {
                const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
                if (txt) el.setAttribute('aria-label', txt);
            }
        });
    };
    mark();
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const el = e.target && e.target.closest ? e.target.closest('.nav-item, .tile') : null;
        if (el) { e.preventDefault(); el.click(); }
    });
    // Плитки перерисовываются динамически — обновляем атрибуты (с троттлингом)
    let markScheduled = false;
    const mo = new MutationObserver(() => {
        if (markScheduled) return;
        markScheduled = true;
        requestAnimationFrame(() => { markScheduled = false; mark(); });
    });
    mo.observe(document.body, { childList: true, subtree: true });
})();

// Подключаем кнопку драфта в офисе
document.getElementById('btn-open-draft')?.addEventListener('click', showDraftListScreen);
// Подключаем кнопку Кубка Чемпионов
document.getElementById('btn-open-world-cup')?.addEventListener('click', showWorldCupScreen);
document.getElementById('draft-list-back')?.addEventListener('click', () => {
    document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
    const os = document.getElementById('office-screen');
    if (os) os.style.display = 'flex';
    showBottomNav();
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const nav = document.querySelector('.nav-item[data-nav="office"]');
    if (nav) nav.classList.add('active');
    renderOffice();
});

// ============ НАЦИОНАЛЬНЫЕ ТУРНИРЫ ============

function getTournamentType(year) {
    if ((year - 2030) % 4 === 0) return 'olympics';
    return 'world_champ';
}

function getTournamentName(type) {
    return type === 'olympics' ? 'Олимпиада' : 'Чемпионат мира';
}

function collectNationalTeams() {
    const byCountry = {};
    NATIONAL_TEAMS.forEach(t => byCountry[t.flag] = []);
    players.forEach(p => {
        const flag = p.nationality || getPlayerCountry(p);
        if (byCountry[flag]) byCountry[flag].push(p);
    });
    const teams = [];
    NATIONAL_TEAMS.forEach(t => {
        const teamPlayers = byCountry[t.flag]
            .filter(p => p.rating >= 50)
            .sort((a, b) => b.rating - a.rating)
            .slice(0, WC_ROSTER_SIZE);
        if (teamPlayers.length >= WC_MIN_PLAYERS) {
            const avg = teamPlayers.reduce((s, p) => s + p.rating, 0) / teamPlayers.length;
            teams.push({
                flag: t.flag, name: t.name, code: t.code,
                players: teamPlayers, avgRating: avg
            });
        }
    });
    return teams.sort((a, b) => b.avgRating - a.avgRating).slice(0, 12);
}

function generateTournamentGroups(teams) {
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    // 8 команд — 2 группы по 4
    if (teams.length === 8) {
        return { A: shuffled.slice(0, 4), B: shuffled.slice(4, 8) };
    }
    // 12 команд — 3 группы по 4
    const groups = { A: [], B: [], C: [] };
    shuffled.forEach((t, i) => {
        groups[['A', 'B', 'C'][i % 3]].push(t);
    });
    return groups;
}

function generateTournamentSchedule(groups) {
    const schedule = {};
    Object.keys(groups).forEach(g => {
        const teams = [...groups[g]];
        const n = teams.length;
        const rounds = [];
        for (let r = 0; r < n - 1; r++) {
            const round = [];
            for (let i = 0; i < n / 2; i++) {
                round.push({ home: teams[i].code, away: teams[n - 1 - i].code });
            }
            rounds.push(round);
            teams.splice(1, 0, teams.pop());
        }
        schedule[g] = rounds;
    });
    return schedule;
}

function calcNationalStrength(team) {
    const skaters = team.players.filter(p => p.position !== 'G').slice(0, 6);
    const goalies = team.players.filter(p => p.position === 'G');
    const sa = skaters.length > 0 ? skaters.reduce((s, p) => s + p.rating, 0) / skaters.length : 50;
    const ga = goalies.length > 0 ? goalies.reduce((s, p) => s + p.rating, 0) / goalies.length : 50;
    return sa * 0.7 + ga * 0.3;
}

function simulateNationalMatch(teamA, teamB) {
    const sA = calcNationalStrength(teamA);
    const sB = calcNationalStrength(teamB);
    const total = sA + sB;
    let goalsA = Math.max(0, Math.floor(Math.random() * 6 * (sA / total)));
    let goalsB = Math.max(0, Math.floor(Math.random() * 6 * (sB / total)));
    let isOT = false;
    if (goalsA === goalsB) {
        isOT = true;
        if (Math.random() < 0.5) goalsA++; else goalsB++;
    }
    const pickScorer = (team, excludeName) => {
        const sk = team.players.filter(p => p.position !== 'G' && (!excludeName || p.name !== excludeName));
        if (sk.length === 0) return null;
        const w = sk.map(p => Math.pow(p.rating, 2));
        const tw = w.reduce((a, b) => a + b, 0);
        let r = Math.random() * tw;
        for (let i = 0; i < sk.length; i++) { r -= w[i]; if (r <= 0) return sk[i]; }
        return sk[sk.length - 1];
    };
    const goals = [];
    const addGoal = (team, side) => {
        const s = pickScorer(team);
        if (!s) return;
        if (!s.nationalStats) s.nationalStats = { gp: 0, goals: 0, assists: 0 };
        s.nationalStats.goals++;
        const minute = randomInt(1, 60);
        const assists = [];
        if (Math.random() < 0.7) {
            const a1 = pickScorer(team, s.name);
            if (a1) {
                assists.push(a1.name);
                if (!a1.nationalStats) a1.nationalStats = { gp: 0, goals: 0, assists: 0 };
                a1.nationalStats.assists++;
                if (Math.random() < 0.4) {
                    const a2 = pickScorer(team, null);
                    if (a2 && a2.name !== s.name && a2.name !== a1.name) {
                        assists.push(a2.name);
                        if (!a2.nationalStats) a2.nationalStats = { gp: 0, goals: 0, assists: 0 };
                        a2.nationalStats.assists++;
                    }
                }
            }
        }
        goals.push({
            minute,
            period: minute <= 20 ? 1 : minute <= 40 ? 2 : 3,
            team: side,   // 'home' | 'away'
            scorer: s.name,
            assists
        });
    };
    for (let i = 0; i < goalsA; i++) addGoal(teamA, 'home');
    for (let i = 0; i < goalsB; i++) addGoal(teamB, 'away');
    goals.sort((a, b) => a.minute - b.minute);
    teamA.players.forEach(p => {
        if (!p.nationalStats) p.nationalStats = { gp: 0, goals: 0, assists: 0 };
        p.nationalStats.gp++;
    });
    teamB.players.forEach(p => {
        if (!p.nationalStats) p.nationalStats = { gp: 0, goals: 0, assists: 0 };
        p.nationalStats.gp++;
    });
    const result = { scoreA: goalsA, scoreB: goalsB, isOT, goals };

    // Если играет сборная, за которую болееет игрок — запоминаем для показа
    if (nationalTournament && favoriteNationalTeam &&
        (teamA.code === favoriteNationalTeam || teamB.code === favoriteNationalTeam)) {
        if (!nationalTournament._pendingMatches) nationalTournament._pendingMatches = [];
        nationalTournament._pendingMatches.push({ homeTeam: teamA, awayTeam: teamB, res: result });
    }

    return result;
}

// Конвертирует сырой результат simulateNationalMatch в объект для openMatchView
function buildNationalMatchForView(homeTeam, awayTeam, res) {
    const goals = res.goals || [];

    // Собираем очки по игрокам для оценок
    const pointsMap = {};
    const addPoints = (name, side, g, a) => {
        if (!name) return;
        const key = side + ':' + name;
        if (!pointsMap[key]) pointsMap[key] = { name, side, goals: 0, assists: 0 };
        pointsMap[key].goals += g;
        pointsMap[key].assists += a;
    };
    goals.forEach(g => {
        addPoints(g.scorer, g.team, 1, 0);
        (g.assists || []).forEach(a => addPoints(a, g.team, 0, 1));
    });
    const allPts = Object.values(pointsMap).sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists));
    const playerRatings = allPts.slice(0, 6).map(p => ({
        name: p.name,
        rating: Math.min(10, 6.0 + (p.goals + p.assists) * 1.2),
        goals: p.goals,
        assists: p.assists
    }));
    const threeStars = playerRatings.slice(0, 3).map(p => p.name);

    const t = nationalTournament;
    const isPlayoff = t && (t.phase === 'playoff' || t.phase === 'finished');

    return {
        home: homeTeam.name,
        away: awayTeam.name,
        homeFlag: homeTeam.flag,
        awayFlag: awayTeam.flag,
        isNational: true,
        week: (t ? t.currentWeek - 1 : 1),
        isPlayoff: isPlayoff,
        result: {
            homeScore: res.scoreA,
            awayScore: res.scoreB,
            isOT: !!res.isOT,
            isSO: false,
            goals: goals,
            threeStars: threeStars,
            playerRatings: playerRatings
        }
    };
}

function updateTournamentStanding(group, codeHome, codeAway, result) {
    const t = nationalTournament.standings[group];
    const h = t[codeHome], a = t[codeAway];
    if (!h || !a) return;
    h.gp++; a.gp++;
    h.gf += result.scoreA; h.ga += result.scoreB;
    a.gf += result.scoreB; a.ga += result.scoreA;
    if (result.scoreA > result.scoreB) {
        h.w++; h.points += 2;
        if (result.isOT) { a.otl++; a.points += 1; } else a.l++;
    } else {
        a.w++; a.points += 2;
        if (result.isOT) { h.otl++; h.points += 1; } else h.l++;
    }
}

// Пересобирает составы сборных, заменяя копии игроков на актуальные ссылки из players[].
// Нужно после загрузки сейва, т.к. nationalTournament сохраняется целиком с копиями.
function resyncNationalTournamentPlayers() {
    if (!nationalTournament || !nationalTournament.teams) return;
    let replaced = 0;
    nationalTournament.teams.forEach(team => {
        if (!team.players) return;
        team.players = team.players.map(p => {
            const found = players.find(x => x.name === p.name);
            if (found) {
                replaced++;
                return found;
            }
            // Если игрок исчез из players[] (ретайрился) — оставляем как был
            return p;
        });
    });
    if (replaced > 0 && window.DEBUG) console.log(`🔄 Сборные: подтянуто ${replaced} актуальных игроков`);
}

function startNationalTournament() {
    const type = getTournamentType(currentSeason);
    const name = getTournamentName(type);
    // Гарантируем, что у всех реальных игроков есть карьера
    players.forEach(p => {
        if ((!p.seasonHistory || p.seasonHistory.length === 0) && p.age >= 22 && p.club && p.club.length > 0) {
            generateFakeCareerHistory(p);
        }
    });
    let teams = collectNationalTeams();
    if (teams.length < 8) {
        addNews(`⚠️ ${name}: недостаточно сборных (${teams.length}/8). Турнир отменён.`, "negative");
        return false;
    }
    // 12 сборных → 3 группы по 4. 8-11 → берём топ-8 и играем 2 группы по 4.
    if (teams.length < 12) teams = teams.slice(0, 8);
    else teams = teams.slice(0, 12);

    const groups = generateTournamentGroups(teams);
    const schedule = generateTournamentSchedule(groups);
    const standings = {};
    Object.keys(groups).forEach(g => {
        standings[g] = {};
        groups[g].forEach(t => {
            standings[g][t.code] = { code: t.code, name: t.name, flag: t.flag, gp: 0, w: 0, otl: 0, l: 0, gf: 0, ga: 0, points: 0 };
        });
    });
    players.forEach(p => {
        if (!p.nationalStats) p.nationalStats = { gp: 0, goals: 0, assists: 0 };
        else p.nationalStats = { gp: 0, goals: 0, assists: 0 };
    });
    nationalTournament = {
        type, name, year: currentSeason,
        teams, groups, schedule, standings,
        results: {},
        currentWeek: 1,
        phase: 'group',
        playoff: null,
        champion: null,
        topScorers: {}
    };
    addNews(`🏆 ${name} ${currentSeason} стартует! ${teams.length} сборных`, "positive");
    // Показать клиентов, вызванных в сборную
    myRoster.forEach(p => {
        const team = teams.find(t => t.players.some(x => x.name === p.name));
        if (team) {
            addNews(`⭐ ${p.name} вызван в сборную ${team.name}!`, "positive");
        }
    });
    return true;
}

function simulateTournamentWeek() {
    if (!nationalTournament) return;
    const t = nationalTournament;
    if (t.phase === 'group') {
        const roundIdx = t.currentWeek - 1;
        if (roundIdx >= 0 && roundIdx < 3) {
            Object.keys(t.standings).forEach(g => {
                const round = t.schedule[g][roundIdx];
                if (!round) return;
                round.forEach(m => {
                    const tA = t.teams.find(x => x.code === m.home);
                    const tB = t.teams.find(x => x.code === m.away);
                    if (!tA || !tB) return;
                    const res = simulateNationalMatch(tA, tB);
                    updateTournamentStanding(g, m.home, m.away, res);
                    t.results[`w${t.currentWeek}_${m.home}_${m.away}`] = res;
                });
            });
        }
        t.currentWeek++;
        if (t.currentWeek > 3) {
            t.phase = 'playoff_ready';
            addNews(`🏆 ${t.name}: групповой этап завершён, начинается плей-офф!`, "positive");
        }
    } else if (t.phase === 'playoff') {
        simulateNationalPlayoffRound();
    }
}

// ============ ПЛЕЙ-ОФФ НАЦИОНАЛЬНОГО ТУРНИРА ============
function buildNationalPlayoffBracket() {
    const t = nationalTournament;
    const allRows = [];
    Object.keys(t.standings).forEach(g => {
        Object.values(t.standings[g]).forEach(row => {
            const team = t.teams.find(x => x.code === row.code);
            if (team) allRows.push({ row, team });
        });
    });
    allRows.sort((a, b) => {
        const ra = a.row, rb = b.row;
        if (rb.points !== ra.points) return rb.points - ra.points;
        const dA = (ra.gf || 0) - (ra.ga || 0);
        const dB = (rb.gf || 0) - (rb.ga || 0);
        if (dB !== dA) return dB - dA;
        return (rb.gf || 0) - (ra.gf || 0);
    });
    const top8 = allRows.slice(0, 8).map(x => x.team);
    const series = [];
    for (let i = 0; i < 4; i++) {
        series.push({
            teamA: top8[i],
            teamB: top8[7 - i],
            winner: null,
            loser: null,
            result: null,
            round: 1,
            groupIdx: i < 2 ? 0 : 1
        });
    }
    return series;
}

function startNationalPlayoff() {
    const t = nationalTournament;
    const bracket = buildNationalPlayoffBracket();
    t.playoff = {
        round: 1,
        series: bracket,
        history: []
    };
    t.phase = 'playoff';
    t.currentWeek = 4;
    addNews(`🏆 ${t.name}: плей-офф стартует! 8 сборных в борьбе за золото`, "positive");
    // Симуляция 1/4 произойдёт на следующей неделе — чтобы показать матч
}

function simulateNationalPlayoffSeries(s) {
    const res = simulateNationalMatch(s.teamA, s.teamB);
    s.result = res;
    if (res.scoreA > res.scoreB) {
        s.winner = s.teamA;
        s.loser = s.teamB;
    } else {
        s.winner = s.teamB;
        s.loser = s.teamA;
    }
}

function buildNationalNextRound(prevSeries, round) {
    const next = [];
    const half = prevSeries.length / 2;
    for (let i = 0; i < prevSeries.length; i += 2) {
        if (!prevSeries[i].winner || !prevSeries[i + 1].winner) continue;
        next.push({
            teamA: prevSeries[i].winner,
            teamB: prevSeries[i + 1].winner,
            winner: null,
            loser: null,
            result: null,
            round,
            groupIdx: i < half ? 0 : 1
        });
    }
    return next;
}

function simulateNationalPlayoffRound() {
    const t = nationalTournament;
    const po = t.playoff;
    if (!po) return;

    po.series.forEach(s => {
        if (!s.winner) simulateNationalPlayoffSeries(s);
    });

    po.history.push({
        round: po.round,
        series: po.series.map(s => ({
            teamA: s.teamA, teamB: s.teamB,
            winner: s.winner, loser: s.loser,
            result: s.result, round: s.round, groupIdx: s.groupIdx
        }))
    });

    // Новости по моим клиентам
    const roundName = po.round === 1 ? '1/4 финала' : po.round === 2 ? '1/2 финала' : 'Финал';
    myRoster.forEach(p => {
        po.series.forEach(s => {
            const inA = s.teamA.players.some(x => x.name === p.name);
            const inB = s.teamB.players.some(x => x.name === p.name);
            if (!inA && !inB) return;
            const myTeam = inA ? s.teamA : s.teamB;
            const oppTeam = inA ? s.teamB : s.teamA;
            const won = s.winner === myTeam;
            const mark = won ? '✅' : '❌';
            addNews(`${mark} ${t.name} ${roundName}: ${myTeam.name} — ${oppTeam.name} (${s.result.scoreA}:${s.result.scoreB})`, won ? 'positive' : 'negative');
        });
    });

    if (po.series.length === 1) {
        const finalSeries = po.series[0];
        const champ = finalSeries.winner;
        const runnerUp = finalSeries.loser;

        // Матч за 3-е место — между проигравшими в 1/2
        let bronze = null;
        const semiRound = po.history.find(h => h.round === 2);
        if (semiRound && semiRound.series.length === 2) {
            const l1 = semiRound.series[0].loser;
            const l2 = semiRound.series[1].loser;
            if (l1 && l2) {
                const bronzeRes = simulateNationalMatch(l1, l2);
                bronze = bronzeRes.scoreA > bronzeRes.scoreB ? l1 : l2;
            }
        }

        // Награды клиентам (полные объекты команд)
        awardNationalTournamentMedals(champ, runnerUp, bronze);

        // В сейв — только лёгкие версии
        t.champion = { name: champ.name, code: champ.code, flag: champ.flag };
        t.runnerUp = { name: runnerUp.name, code: runnerUp.code, flag: runnerUp.flag };
        t.bronze = bronze ? { name: bronze.name, code: bronze.code, flag: bronze.flag } : null;
        t.phase = 'finished';

        const bronzeStr = bronze ? ` 🥉 ${bronze.name}` : '';
        addNews(`🏆 ${t.name} ${t.year}: 🥇 ${champ.name}, 🥈 ${runnerUp.name}${bronzeStr}`, "positive");
        return;
    }

    po.round++;
    po.series = buildNationalNextRound(po.series, po.round);
    t.currentWeek++;
}

function awardNationalTournamentMedals(gold, silver, bronze) {
    const t = nationalTournament;
    myRoster.forEach(p => {
        const inGold = gold && gold.players.some(x => x.name === p.name);
        const inSilver = silver && silver.players.some(x => x.name === p.name);
        const inBronze = bronze && bronze.players.some(x => x.name === p.name);
        if (!p.trophies) p.trophies = [];
        if (inGold) {
            p.trophies.push({ name: `🥇 ${t.name} ${t.year}`, season: t.year, club: gold.name });
            addXP(1500);
            const bonus = scaleEventMoney(12000);
            agentMoney += bonus;
            addNews(`🥇 ${p.name} — чемпион ${t.name}! +$${bonus.toLocaleString()}`, "positive");
        } else if (inSilver) {
            p.trophies.push({ name: `🥈 ${t.name} ${t.year}`, season: t.year, club: silver.name });
            addXP(800);
            const bonus = scaleEventMoney(6000);
            agentMoney += bonus;
            addNews(`🥈 ${p.name} — серебро ${t.name}! +$${bonus.toLocaleString()}`, "positive");
        } else if (inBronze) {
            p.trophies.push({ name: `🥉 ${t.name} ${t.year}`, season: t.year, club: bronze.name });
            addXP(400);
            const bonus = scaleEventMoney(2500);
            agentMoney += bonus;
            addNews(`🥉 ${p.name} — бронза ${t.name}! +$${bonus.toLocaleString()}`, "positive");
        }
    });
}

// ============ UI НАЦИОНАЛЬНОГО ТУРНИРА ============
let ntActiveTab = 'groups';

// ============ МОДАЛКА ВЫБОРА СБОРНОЙ ============
function showNationalPickModal() {
    if (!nationalTournament) return;
    const modal = document.getElementById('nt-pick-modal');
    const body = document.getElementById('nt-pick-body');
    const actions = document.getElementById('nt-pick-actions');
    const title = document.getElementById('nt-pick-title');
    if (!modal || !body || !actions) return;

    const t = nationalTournament;
    const tName = t.type === 'olympics' ? LANG.t('Олимпиада') : LANG.t('Чемпионат мира');
    if (title) title.textContent = `${t.type === 'olympics' ? '🥇' : '🌍'} ${tName} ${t.year}`;

    // Список сборных — берём из t.teams (там 8 или 12)
    const teams = [...t.teams].sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    const myPlayersInTeam = (teamCode) => {
        const team = t.teams.find(x => x.code === teamCode);
        if (!team) return 0;
        return myRoster.filter(p => team.players.some(x => x.name === p.name)).length;
    };

    let html = `<div class="nt-pick-intro">
        ${LANG.t('Выбери сборную, за которую будешь болеть на этом турнире.')}<br>
        ${LANG.t('Её матчи будут показываться в режиме просмотра.')}<br>
        <b>${LANG.t('Можно поменять в любой момент.')}</b>
    </div>`;   
    html += `<div class="nt-pick-grid">`;

    teams.forEach(team => {
        const myCount = myPlayersInTeam(team.code);
        const mineClass = myCount > 0 ? ' nt-pick-mine' : '';
        html += `
            <button class="nt-pick-card${mineClass}" data-nt-code="${team.code}">
                <span class="nt-pick-flag">${team.flag}</span>
                <span class="nt-pick-name">${team.name}</span>
            </button>
        `;
    });
    html += `</div>`;

    body.innerHTML = html;
    actions.innerHTML = '';

    const skipBtn = document.createElement('button');
    skipBtn.className = 'nt-pick-skip';
    skipBtn.textContent = LANG.t('Не болеть ни за кого');
    skipBtn.addEventListener('click', () => {
        favoriteNationalTeam = null;
        modal.style.display = 'none';
        saveGame();
        updateAllDisplays();
        const ntScreen = document.getElementById('national-tournament-screen');
        if (ntScreen && ntScreen.style.display !== 'none') {
            renderNationalTournamentScreen();
        }
    });
    actions.appendChild(skipBtn);

    // Клики по карточкам
    body.querySelectorAll('.nt-pick-card').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window._ntPickLock) return;
            window._ntPickLock = true;

            const code = btn.getAttribute('data-nt-code');
            const team = t.teams.find(x => x.code === code);
            if (!team) { window._ntPickLock = false; return; }

            favoriteNationalTeam = code;
            modal.style.display = 'none';
            addNews(`⭐ Ты болеешь за ${team.flag} ${team.name} на ${t.name} ${t.year}`, "info");
            saveGame();
            updateAllDisplays();

            // Перерисовываем экран турнира, если он открыт — чтобы плашка и подсветка обновились сразу
            const ntScreen = document.getElementById('national-tournament-screen');
            if (ntScreen && ntScreen.style.display !== 'none') {
                renderNationalTournamentScreen();
            }

            setTimeout(() => { window._ntPickLock = false; }, 400);
        });
    });

    modal.style.display = 'flex';
}

function showNationalTournamentScreen() {
    if (!nationalTournament && nationalTournamentHistory.length === 0) { uiAlert(LANG.t('Турнир ещё не проходил')); return; }
    hidePagination();
    document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
    const s = document.getElementById('national-tournament-screen');
    if (s) s.style.display = 'flex';
    showBottomNav();
    ntActiveTab = 'groups';
    renderNationalTournamentScreen();
}

function renderNationalTournamentScreen() {
    const c = document.getElementById('nt-content');
    const titleEl = document.getElementById('nt-header-title');
    const iconEl = document.getElementById('nt-header-icon');
    if (!c) return;

    document.querySelectorAll('#nt-tabs .clients-tab').forEach(t => {
        if (t.getAttribute('data-nttab') === ntActiveTab) t.classList.add('active');
        else t.classList.remove('active');
    });

    renderNtFavBar();

    if (nationalTournament) {
        const t = nationalTournament;
        if (titleEl) titleEl.textContent = `${t.name} ${t.year}`;
        if (iconEl) iconEl.textContent = t.type === 'olympics' ? '🥇' : '🌍';
    } else {
        if (titleEl) titleEl.textContent = LANG.t('История турниров сборных');
        if (iconEl) iconEl.textContent = '📜';
    }   

    if (ntActiveTab === 'groups') renderNtGroups(c);
    else if (ntActiveTab === 'playoff') renderNtPlayoff(c);
    else if (ntActiveTab === 'history') renderNtHistory(c);
}

function renderNtFavBar() {
    const bar = document.getElementById('nt-fav-bar');
    if (!bar) return;

    // Если турнир не идёт — плашки нет
    if (!nationalTournament) {
        bar.style.display = 'none';
        return;
    }

    // Если сборная не выбрана — плашки нет (но можно открыть через кнопку смены, её добавим позже)
    if (!favoriteNationalTeam) {
        bar.style.display = 'flex';
        bar.innerHTML = `
            <span class="nt-fav-flag">🏒</span>
            <div class="nt-fav-info">
                <span class="nt-fav-lbl">${LANG.t('Ты не болеешь ни за кого')}</span>
                <span class="nt-fav-name" style="color:var(--text-muted);font-size:13px;">${LANG.t('Выбрать сборную — будет интереснее')}</span>
            </div>
            <button class="nt-fav-change" id="nt-fav-change">${LANG.t('ВЫБРАТЬ')}</button>
        `;
        const btn = bar.querySelector('#nt-fav-change');
        if (btn) btn.addEventListener('click', showNationalPickModal);
        return;
    }

    // Есть выбранная сборная — но проверим, что она ещё в текущем турнире
    const team = nationalTournament.teams.find(x => x.code === favoriteNationalTeam);
    if (!team) {
        // Сборная не участвует в этом турнире — показываем как «не выбрано»
        bar.style.display = 'flex';
        bar.innerHTML = `
            <span class="nt-fav-flag">🏒</span>
            <div class="nt-fav-info">
                <span class="nt-fav-lbl">${LANG.t('Сборная не участвует')}</span>
                <span class="nt-fav-name" style="color:var(--text-muted);font-size:13px;">${LANG.t('Выбери другую')}</span>
            </div>
            <button class="nt-fav-change" id="nt-fav-change">${LANG.t('СМЕНИТЬ')}</button>
        `;
        const btn = bar.querySelector('#nt-fav-change');
        if (btn) btn.addEventListener('click', showNationalPickModal);
        return;
    }

    // Мои клиенты в этой сборной
    const myCount = myRoster.filter(p => team.players.some(x => x.name === p.name)).length;
    const subLabel = myCount > 0
        ? `⭐ ${LANG.t('Твоих клиентов:')} ${myCount}`
        : LANG.t('Твоих клиентов нет — но пусть будет');

    bar.style.display = 'flex';
    bar.innerHTML = `
        <span class="nt-fav-flag">${team.flag}</span>
        <div class="nt-fav-info">
            <span class="nt-fav-lbl">${LANG.t('Ты болеешь за')}</span>
            <span class="nt-fav-name">${team.name}</span>
            <span style="color:var(--text-muted);font-size:10px;margin-top:2px;">${subLabel}</span>
        </div>
        <button class="nt-fav-change" id="nt-fav-change">${LANG.t('СМЕНИТЬ')}</button>
    `;
    const btn = bar.querySelector('#nt-fav-change');
    if (btn) btn.addEventListener('click', showNationalPickModal);
}

function renderNtGroups(c) {
    c.innerHTML = '';
    if (!nationalTournament) {
        c.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-title">${LANG.t('Турнир ещё не начался')}</div><div class="empty-desc">${LANG.t('Доиграйте сезон — и стартует ЧМ/Олимпиада')}</div></div>`;
        return;
    }
    const t = nationalTournament;

    const banner = document.createElement('div');
    banner.className = 'wc-banner';
    let sub = '';
    if (t.phase === 'group') sub = `${LANG.t('Групповой этап')} • ${LANG.t('Неделя')} ${Math.min(t.currentWeek, 3)} / 3`;
    else if (t.phase === 'playoff_ready' || t.phase === 'playoff') sub = `${LANG.t('Плей-офф')} • ${LANG.t('Раунд')} ${t.playoff ? t.playoff.round : 1} / 3`;
    else if (t.phase === 'finished') sub = `🏆 ${LANG.t('Чемпион')}: ${t.champion ? t.champion.name : '—'}`;
    banner.innerHTML = `<div class="wc-banner-title">${t.type === 'olympics' ? '🥇 ' + LANG.t('Олимпиада') : '🌍 ' + LANG.t('Чемпионат мира')} ${t.year}</div><div class="wc-banner-sub">${sub}</div>`;
    c.appendChild(banner);

    Object.keys(t.standings).forEach(g => {
        const title = document.createElement('div');
        title.className = 'wc-conf-title';
        title.textContent = `${LANG.t('Группа')} ${g}`;
        c.appendChild(title);

        const rows = Object.values(t.standings[g]).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            const dA = (a.gf || 0) - (a.ga || 0);
            const dB = (b.gf || 0) - (b.ga || 0);
            if (dB !== dA) return dB - dA;
            return (b.gf || 0) - (a.gf || 0);
        });

        const header = document.createElement('div');
        header.className = 'nt-group-header';
        header.innerHTML = `<div>#</div><div>${LANG.t('Сборная')}</div><div>${LANG.t('И')}</div><div>${LANG.t('В')}</div><div>${LANG.t('ОТ')}</div><div>${LANG.t('П')}</div><div>${LANG.t('Ш')}</div><div>${LANG.t('О')}</div>`;
        c.appendChild(header);

        rows.forEach((r, i) => {
            const row = document.createElement('div');
            const isFav = (favoriteNationalTeam === r.code);
            row.className = 'nt-group-row' + (i < 2 ? ' top2' : '') + (isFav ? ' nt-fav-row' : '');
            if (isFav) {
                row.style.borderLeftColor = 'var(--neon-gold)';
                row.style.background = 'linear-gradient(90deg, rgba(255,204,0,0.10), var(--bg-card))';
            }
            row.innerHTML = `
                <div class="nt-num">${i + 1}</div>
                <div class="nt-team"><span class="nt-flag">${r.flag}</span><span class="nt-name">${r.name}</span></div>
                <div class="nt-num">${r.gp}</div>
                <div class="nt-num">${r.w}</div>
                <div class="nt-num">${r.otl || 0}</div>
                <div class="nt-num">${r.l}</div>
                <div class="nt-num nt-shots">${r.gf}:${r.ga}</div>
                <div class="nt-num nt-points">${r.points}</div>
            `;
            row.style.cursor = 'pointer';
            row.addEventListener('click', () => openNationalTeamModal(r.code));
            c.appendChild(row);
        });
    });

    const legend = document.createElement('div');
    legend.className = 'standings-legend';
    legend.innerHTML = `<div class="legend-item"><span class="legend-dot playoff-dot"></span> ${LANG.t('Топ-2 из группы — прямой выход. Ещё 2 лучших третьих места — в плей-офф.')}</div>`;
    c.appendChild(legend);
}

function renderNtPlayoff(c) {
    c.innerHTML = '';
    if (!nationalTournament) {
        c.innerHTML = `<div class="empty-state"><div class="empty-icon">🏆</div><div class="empty-title">${LANG.t('Турнир не идёт')}</div><div class="empty-desc">${LANG.t('Плей-офф появится, когда стартует ЧМ')}</div></div>`;
        return;
    }
    const t = nationalTournament;
    if (!t.playoff) {
        c.innerHTML = `<div class="empty-state"><div class="empty-icon">🏆</div><div class="empty-title">${LANG.t('Плей-офф ещё не начался')}</div><div class="empty-desc">${LANG.t('Сначала завершите групповой этап (3 недели)')}</div></div>`;
        return;
    }

    const po = t.playoff;
    const totalRounds = 3;

    if (t.phase === 'finished' && t.champion) {
        const champBanner = document.createElement('div');
        champBanner.className = 'playoffs-champion';
        champBanner.innerHTML = `
            <div class="pc-cup-icon">🏆</div>
            <div class="pc-league">${t.name} ${t.year}</div>
            <div class="pc-team">${t.champion.flag} ${t.champion.name}</div>
            ${t.runnerUp ? `<div class="pc-league" style="margin-top:8px;">🥈 ${t.runnerUp.flag} ${t.runnerUp.name}</div>` : ''}
            ${t.bronze ? `<div class="pc-league" style="margin-top:4px;">🥉 ${t.bronze.flag} ${t.bronze.name}</div>` : ''}
        `;
        c.appendChild(champBanner);
    } else {
        const info = document.createElement('div');
        info.className = 'playoffs-info';
        const rn = getRoundName(po.round, totalRounds);
        info.innerHTML = `<div class="pi-round">🏒 ${rn.toUpperCase()}</div><div class="pi-sub">${LANG.t('Матчи на вылет • 8 сборных')}</div>`;
        c.appendChild(info);
    }

    const hint = document.createElement('div');
    hint.className = 'bracket-hint';
    hint.innerHTML = '↔ Пролистайте сетку вправо →';
    c.appendChild(hint);

    const bracket = document.createElement('div');
    bracket.className = 'nt-bracket';

    // Собираем все раунды: 1/4 (4 серии), 1/2 (2), Финал (1)
    const getSeriesForRound = (r) => {
        if (po.history && po.history.length >= r) return po.history[r - 1].series;
        if (r === po.round && t.phase !== 'finished') return po.series;
        return null;
    };

    for (let r = 1; r <= 3; r++) {
        const round = document.createElement('div');
        round.className = 'nt-round' + (r === 3 ? ' final' : '');
        const title = document.createElement('div');
        title.className = 'nt-round-title';
        title.textContent = r === 1 ? LANG.t('1/4 ФИНАЛА') : r === 2 ? LANG.t('1/2 ФИНАЛА') : LANG.t('ФИНАЛ');
        round.appendChild(title);

        const series = getSeriesForRound(r);
        const expected = r === 1 ? 4 : r === 2 ? 2 : 1;

        if (!series) {
            for (let i = 0; i < expected; i++) {
                const ph = document.createElement('div');
                ph.className = 'nt-series nt-empty-slot';
                ph.innerHTML = `
                    <div class="nt-series-team"><div class="nt-series-flag">—</div><div class="nt-series-name" style="color:var(--text-muted);">—</div><div class="nt-series-score">0</div></div>
                    <div class="nt-series-team"><div class="nt-series-flag">—</div><div class="nt-series-name" style="color:var(--text-muted);">—</div><div class="nt-series-score">0</div></div>
                `;
                round.appendChild(ph);
            }
        } else {
            series.forEach(s => {
                const teamA = s.teamA;
                const teamB = s.teamB;
                const aWon = s.winner && s.winner.code === teamA.code;
                const bWon = s.winner && s.winner.code === teamB.code;
                const scoreA = s.result ? s.result.scoreA : 0;
                const scoreB = s.result ? s.result.scoreB : 0;
                const isFavA = favoriteNationalTeam === teamA.code;
                const isFavB = favoriteNationalTeam === teamB.code;
                const div = document.createElement('div');
                div.className = 'nt-series';
                if (isFavA || isFavB) {
                    div.style.borderColor = 'var(--neon-gold)';
                    div.style.background = 'linear-gradient(135deg, rgba(255,204,0,0.12), var(--bg-card))';
                    div.style.boxShadow = '0 0 15px rgba(255,204,0,0.2)';
                }
                div.innerHTML = `
                    <div class="nt-series-team ${aWon ? 'winner' : ''} ${bWon ? 'loser' : ''}">
                        <div class="nt-series-flag">${isFavA ? '⭐' : ''}${teamA.flag}</div>
                        <div class="nt-series-name">${teamA.name}</div>
                        <div class="nt-series-score">${scoreA}</div>
                    </div>
                    <div class="nt-series-team ${bWon ? 'winner' : ''} ${aWon ? 'loser' : ''}">
                        <div class="nt-series-flag">${isFavB ? '⭐' : ''}${teamB.flag}</div>
                        <div class="nt-series-name">${teamB.name}</div>
                        <div class="nt-series-score">${scoreB}</div>
                    </div>
                `;
                round.appendChild(div);
            });
        }
        bracket.appendChild(round);
    }
    c.appendChild(bracket);

    if (t.phase === 'finished' && t.champion) {
        const done = document.createElement('div');
        done.className = 'playoffs-legend';
        done.innerHTML = `🎉 Турнир завершён. Поздравляем <b>${t.champion.name}</b>!`;
        c.appendChild(done);
    }
}

function renderNtHistory(c) {
    c.innerHTML = '';
    if (nationalTournamentHistory.length === 0) {
        c.innerHTML = `<div class="empty-state"><div class="empty-icon">📜</div><div class="empty-title">${LANG.t('История пуста')}</div><div class="empty-desc">${LANG.t('Первый турнир ещё не завершён')}</div></div>`;
        return;
    }

    const banner = document.createElement('div');
    banner.className = 'wc-banner';
    banner.innerHTML = `<div class="wc-banner-title">📜 ${LANG.t('История турниров сборных')}</div><div class="wc-banner-sub">${LANG.t('Турниров в архиве')}: ${nationalTournamentHistory.length}</div>`;
    c.appendChild(banner);

    const hist = [...nationalTournamentHistory].reverse();

    // Вспомогалка: вытащить имя/флаг из строки или объекта
    const norm = (v) => {
        if (!v) return null;
        if (typeof v === 'string') {
            const found = NATIONAL_TEAMS.find(t => t.name === v);
            return { name: v, flag: found ? found.flag : '🏳️' };
        }
        return { name: v.name, flag: v.flag || '🏳️' };
    };

    hist.forEach(h => {
        const block = document.createElement('div');
        block.className = 'nt-history-block';

        const yearLabel = h.type === 'olympics'
            ? `🥇 ${LANG.t('Олимпиада')} ${h.year}`
            : `🌍 ${LANG.t('Чемпионат мира')} ${h.year}`;

        const champ = norm(h.champion);
        const silver = norm(h.runnerUp);
        const bronze = norm(h.bronze);

        let html = `<div class="nt-history-year">${yearLabel}</div>`;
        if (champ) html += `<div class="nt-medal-row gold"><div class="nt-medal-icon">🥇</div><div class="nt-medal-flag">${champ.flag}</div><div class="nt-medal-name">${champ.name}</div></div>`;
        if (silver) html += `<div class="nt-medal-row silver"><div class="nt-medal-icon">🥈</div><div class="nt-medal-flag">${silver.flag}</div><div class="nt-medal-name">${silver.name}</div></div>`;
        if (bronze) html += `<div class="nt-medal-row bronze"><div class="nt-medal-icon">🥉</div><div class="nt-medal-flag">${bronze.flag}</div><div class="nt-medal-name">${bronze.name}</div></div>`;
        if (!champ) html += '<div style="color:var(--text-muted);font-size:12px;">Данных нет</div>';

        block.innerHTML = html;
        c.appendChild(block);
    });
}

// Переключение табов экрана
document.querySelectorAll('#nt-tabs .clients-tab').forEach(t => {
    t.addEventListener('click', function () {
        const tab = this.getAttribute('data-nttab');
        if (!tab) return;
        ntActiveTab = tab;
        renderNationalTournamentScreen();
    });
});

// Кнопка "назад"
document.getElementById('nt-back')?.addEventListener('click', () => {
    hidePagination();
    document.querySelectorAll('.mobile-screen').forEach(s => s.style.display = 'none');
    const os = document.getElementById('office-screen');
    if (os) os.style.display = 'flex';
    showBottomNav();
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navO = document.querySelector('.nav-item[data-nav="office"]');
    if (navO) navO.classList.add('active');
    renderOffice();
});

// Кнопка открытия НТ
document.getElementById('btn-open-national-tournament')?.addEventListener('click', showNationalTournamentScreen);

// ============ ПРОСМОТР СОСТАВА СБОРНОЙ ============
function openNationalTeamModal(code) {
    if (!nationalTournament) return;
    const team = nationalTournament.teams.find(t => t.code === code);
    if (!team) return;

    const modal = document.getElementById('nt-team-modal');
    const title = document.getElementById('nt-team-title');
    const body = document.getElementById('nt-team-body');
    if (!modal || !body) return;

    title.textContent = `${team.flag} ${team.name}`;

    const avgRating = Math.round(team.players.reduce((s, p) => s + p.rating, 0) / team.players.length);

    const goalies   = team.players.filter(p => p.position === 'G').sort((a, b) => b.rating - a.rating);
    const defenders = team.players.filter(p => p.position === 'D').sort((a, b) => b.rating - a.rating);
    const forwards  = team.players.filter(p => ['C', 'LW', 'RW'].includes(p.position)).sort((a, b) => b.rating - a.rating);

    const rowHTML = (p) => {
        const rc = p.rating >= 80 ? 'high' : p.rating >= 65 ? 'mid' : 'low';
        const posIcon = p.position === 'G' ? '🥅' : p.position === 'D' ? '🛡' : '⚡';
        const isMine = myRoster.some(x => x.name === p.name);
        return `
            <div class="roster-row${isMine ? ' my-client' : ''}" data-nt-player="${p.name}" style="cursor:pointer;">
                <div class="rr-avatar">${getPlayerAvatarSVG(p)}</div>
                <div class="rr-info">
                    <div class="rr-name-line">
                        <span class="rr-pos-icon">${posIcon}</span>
                        <span class="rr-name">${p.name}</span>
                        <span class="rr-pos">${p.position}</span>
                    </div>
                    <div class="rr-meta">
                        <span>${p.age} лет</span>
                        <span>${p.club || 'Свободный агент'}</span>
                    </div>
                </div>
                <div class="rr-right">
                    <div class="rr-rating ${rc}">${p.rating}</div>
                </div>
            </div>
        `;
    };

    body.innerHTML = `
        <div class="standings-info-card" style="text-align:center;">
            <div style="font-size:48px;margin-bottom:8px;">${team.flag}</div>
            <div style="font-size:18px;font-weight:900;color:var(--text-primary);">${team.name}</div>
            <div style="color:var(--text-muted);font-size:12px;margin-top:4px;">Ср. рейтинг: ${avgRating} • Игроков: ${team.players.length}</div>
        </div>
        ${goalies.length > 0 ? `<div class="roster-group"><div class="roster-group-title">🥅 ${LANG.t('ВРАТАРИ')}</div>${goalies.map(rowHTML).join('')}</div>` : ''}
        ${defenders.length > 0 ? `<div class="roster-group"><div class="roster-group-title">🛡 ${LANG.t('ЗАЩИТНИКИ')}</div>${defenders.map(rowHTML).join('')}</div>` : ''}
        ${forwards.length > 0 ? `<div class="roster-group"><div class="roster-group-title">⚡ ${LANG.t('НАПАДАЮЩИЕ')}</div>${forwards.map(rowHTML).join('')}</div>` : ''}
    `;

    // Клик по игроку — открываем его карточку
    body.querySelectorAll('.roster-row[data-nt-player]').forEach(row => {
        row.addEventListener('click', () => {
            const pname = row.getAttribute('data-nt-player');
            const player = team.players.find(x => x.name === pname);
            if (!player) return;
            playerReturnContext = { type: 'national' };
            document.getElementById('nt-team-modal').style.display = 'none';
            openPlayerScreen(player, 'public');
        });
    });

    modal.style.display = 'flex';
}

document.getElementById('nt-team-close')?.addEventListener('click', () => {
    document.getElementById('nt-team-modal').style.display = 'none';
});
document.getElementById('nt-team-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'nt-team-modal') e.currentTarget.style.display = 'none';
});

if (window.DEBUG) console.log('✅ script.js полностью загружен');

// ============ МОСТЫ ДЛЯ i18n И ДАТАПАКА ============
// i18n.js и datapack.js не импортируют script.js (иначе циклические зависимости),
// поэтому общаются с приложением через узкий набор window-хуков.
export function isDatapackActive() { return datapackActive; }

function onLanguageChanged() {
    updateLangButton();
    const visible = (id) => {
        const el = document.getElementById(id);
        return el && el.style.display !== 'none';
    };
    updateAllDisplays();
    if (visible('clients-screen')) renderClientsScreen();
    if (visible('market-screen')) renderMarketScreen();
    if (visible('agency-screen')) renderAgencyScreen();
    if (visible('leagues-screen')) renderLeaguesScreen();
    if (visible('standings-screen') && currentStandingsLeague) renderStandingsScreen(currentStandingsLeague);
    if (visible('club-hub-screen')) renderClubHub();
    if (visible('player-screen')) renderPlayerScreen();
    if (visible('world-cup-screen')) renderWorldCupScreen();
    if (visible('national-tournament-screen')) renderNationalTournamentScreen();
    if (visible('draft-list-screen')) renderDraftListScreen();
    if (visible('career-goals-screen')) {
        if (currentBranchKey) renderBranchDetail();
        else renderCareerGoalsTree();
    }
    if (visible('news-feed-screen')) renderNewsFeedScreen();
    if (visible('event-history-screen')) renderEventHistory();
}
window.onLanguageChanged = onLanguageChanged;

// ============ SERVICE WORKER (оффлайн-оболочка) ============
// Регистрируем только на http(s): file:// не поддерживает SW.
// В dev-режиме SW выключен: иначе он кэширует исходники и мешает HMR.
if (import.meta.env.PROD && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => {
            if (window.DEBUG) console.log('SW registration failed:', err && err.message);
        });
    });
}
