// ============================================================
// President phase — data-driven weekly briefs and events.
// Pure data: no DOM, no game state. Loaded before script.js and
// exposed on window for the legacy monolith. Tests import named arrays.
// ============================================================

export const PRESIDENT_STANCES = [
    {
        id: 'economy', icon: '💰', label: 'Экономия',
        desc: 'Урезать недельные расходы. Команда почувствует режим экономии.',
        cost: 'OPEX −2% • Раздевалка −2 • Фанаты −1',
        effects: { cash: 20000, dressing: -2, fans: -1 },
        strengthMult: 0.995
    },
    {
        id: 'result', icon: '🏒', label: 'Результат',
        desc: 'Фокус на ближайшем матче. Больше нагрузки, больше риска.',
        cost: 'Сила +2% • Раздевалка +1 • −$10K',
        effects: { cash: -10000, dressing: 1 },
        strengthMult: 1.02
    },
    {
        id: 'fans', icon: '📣', label: 'Болельщики',
        desc: 'Публичная неделя клуба: открытые тренировки, встречи, медиа.',
        cost: 'Фанаты +2 • −$50K • Раздевалка +1',
        effects: { cash: -50000, fans: 2, dressing: 1 },
        strengthMult: 1.0
    },
    {
        id: 'development', icon: '🌱', label: 'Развитие',
        desc: 'Молодёжь и академия получают больше времени и внимания.',
        cost: 'Фанаты +1 • −$30K • Сила −1%',
        effects: { cash: -30000, fans: 1 },
        strengthMult: 0.99
    }
];

export const PRESIDENT_BRIEFS = [
    {
        id: 'ticket_price', icon: '🎟', title: 'Цены на билеты', category: 'finance',
        text: 'Коммерческий отдел просит пересмотреть цену билета. Каждое решение бьёт по кассе или по трибунам.',
        options: [
            { id: 'raise', label: 'Поднять до $45', desc: 'Больше денег с каждого места, но фанаты заметят.', cost: '+$180K/сезон • Фанаты −3', effects: { cash: 180000, fans: -3 } },
            { id: 'keep', label: 'Оставить $35', desc: 'Безопасный выбор. Ничего не меняется.', cost: '0 • статус-кво', effects: {} },
            { id: 'lower', label: 'Снизить до $28', desc: 'Полные трибуны и доверие, но меньше выручки.', cost: '−$120K/сезон • Фанаты +4', effects: { cash: -120000, fans: 4 }, delayed: { weeks: 2, title: 'Аншлаг', text: 'Нижние трибуны заполнены, атмосфера помогает команде.', effects: { fans: 2 } } }
        ]
    },
    {
        id: 'youth_play', icon: '🌱', title: 'Молодёжь просит шанс', category: 'sport',
        text: 'Тренер академии говорит, что двух юниоров пора выпускать в основе. Это риск для результата и вклад в наследие.',
        options: [
            { id: 'promote', label: 'Выпустить двоих', desc: 'Живая молодёжь в составе.', cost: '−$150K • Сила −1% на 3 нед. • Фанаты +4', effects: { cash: -150000, fans: 4, dressing: 2 }, delayed: { weeks: 3, title: 'Дебютанты', text: 'Молодёжь освоилась: раздевалка и трибуны довольны.', effects: { dressing: 3, prestige: 1 } } },
            { id: 'loan', label: 'Отдать в аренду', desc: 'Спокойный путь без риска для основы.', cost: '+$100K • Фанаты −1', effects: { cash: 100000, fans: -1 } },
            { id: 'wait', label: 'Подождать', desc: 'Результат важнее. Юниоры остаются в запасе.', cost: '+$150K • Доверие +2 • Фанаты −2', effects: { cash: 150000, trust: 2, fans: -2, dressing: -1 } }
        ]
    },
    {
        id: 'marketing_push', icon: '📣', title: 'Маркетинг или резерв', category: 'finance',
        text: 'Маркетолог предлагает кампанию к дерби. Финансист напоминает про резерв на случай травм.',
        options: [
            { id: 'campaign', label: 'Запустить кампанию', desc: 'Город узнает о клубе.', cost: '−$250K • Фанаты +5', effects: { cash: -250000, fans: 5 }, delayed: { weeks: 2, title: 'Кампания сработала', text: 'Приток зрителей на дерби.', effects: { cash: 120000, fans: 2 } } },
            { id: 'save', label: 'Сохранить резерв', desc: 'Деньги останутся на чёрный день.', cost: '+$0 • Фанаты −1', effects: { fans: -1 } }
        ]
    },
    {
        id: 'veteran_choice', icon: '🎖', title: 'Ветеран или молодой', category: 'sport',
        text: 'Ветеран хочет ещё один сезон. Молодой защитник готов занять его место.',
        options: [
            { id: 'veteran', label: 'Продлить ветерана', desc: 'Опыт и раздевалка.', cost: '−$400K • Раздевалка +3', effects: { cash: -400000, dressing: 3, fans: 2 } },
            { id: 'young', label: 'Дать дорогу молодому', desc: 'Экономия и будущее.', cost: '+$200K • Сила −1%', effects: { cash: 200000, dressing: -1, fans: 1 }, delayed: { weeks: 4, title: 'Молодой вырос', text: 'Новый защитник прибавил и стал любимцем трибун.', effects: { prestige: 1, fans: 2 } } }
        ]
    },
    {
        id: 'staff_request', icon: '🧑‍🏫', title: 'Тренер просит помощника', category: 'staff',
        text: 'Главный тренер просит нанять ассистента по развитию. Это деньги и ещё один голос в штабе.',
        options: [
            { id: 'hire', label: 'Нанять ассистента', desc: 'Поможет молодёжи и разгрузит тренера.', cost: '−$300K • Раздевалка +2', effects: { cash: -300000, dressing: 2 }, delayed: { weeks: 3, title: 'Штаб сработался', text: 'Тренировки стали продуктивнее.', effects: { prestige: 1 } } },
            { id: 'refuse', label: 'Отказать', desc: 'Деньги важнее.', cost: '0 • Тренер −3 (раздевалка)', effects: { dressing: -3 } }
        ]
    },
    {
        id: 'fan_meeting', icon: '🤝', title: 'Встреча с фан-клубом', category: 'fans',
        text: 'Лидеры трибун просят встречу. Они хотят услышать план на сезон, а не обещания.',
        options: [
            { id: 'meet', label: 'Встретиться лично', desc: 'Прямой разговор и немного денег на фан-зону.', cost: '−$80K • Фанаты +4', effects: { cash: -80000, fans: 4 } },
            { id: 'send', label: 'Отправить пресс-службу', desc: 'Формально, без тепла.', cost: '0 • Фанаты −1', effects: { fans: -1 } }
        ]
    },
    {
        id: 'wage_cleanup', icon: '✂️', title: 'Ведомость просит чистки', category: 'finance',
        text: 'Загрузка зарплат выше комфортной. Можно продать одного игрока или реструктурировать бонусы.',
        options: [
            { id: 'sell', label: 'Продать дорогого игрока', desc: 'Деньги и свобода, но минус сила.', cost: '+$1,2M • Сила −2% • Фанаты −4', effects: { cash: 1200000, fans: -4, dressing: -2 } },
            { id: 'restructure', label: 'Реструктурировать бонусы', desc: 'Сохранить состав, но потерять доверие раздевалки.', cost: '0 • Раздевалка −3 • Фанаты −1', effects: { dressing: -3, fans: -1 } },
            { id: 'ignore', label: 'Ничего не делать', desc: 'Риск аудита и давления совета.', cost: '0 • Доверие −3', effects: { trust: -3 } }
        ]
    },
    {
        id: 'captain_choice', icon: '🅲', title: 'Выбор капитана', category: 'sport',
        text: 'Капитан уходит. Раздевалка делится: ветеран или молодой лидер.',
        options: [
            { id: 'vet', label: 'Назначить ветерана', desc: 'Опыт и спокойствие.', cost: '0 • Раздевалка +3 • Фанаты +1', effects: { dressing: 3, fans: 1 } },
            { id: 'young', label: 'Назначить молодого', desc: 'Новая энергия, но риск конфликта.', cost: '0 • Раздевалка −1 • Фанаты +3', effects: { dressing: -1, fans: 3 }, delayed: { weeks: 3, title: 'Новый капитан', text: 'Молодой капитан сплотил команду.', effects: { dressing: 3 } } }
        ]
    },
    {
        id: 'sponsor_offer', icon: '🤝', title: 'Спонсор предлагает контракт', category: 'finance',
        text: 'Местный банк готов платить больше, но хочет название арены.',
        options: [
            { id: 'accept', label: 'Продать название арены', desc: 'Большие деньги, недовольные фанаты.', cost: '+$900K • Фанаты −6', effects: { cash: 900000, fans: -6 } },
            { id: 'shirt', label: 'Только джерси', desc: 'Компромисс.', cost: '+$350K • Фанаты −1', effects: { cash: 350000, fans: -1 } },
            { id: 'decline', label: 'Отказаться', desc: 'Имя арены остаётся народным.', cost: '0 • Фанаты +2 • Доверие −1', effects: { fans: 2, trust: -1 } }
        ]
    },
    {
        id: 'training_camp', icon: '🏋️', title: 'Сборы перед матчем', category: 'sport',
        text: 'Тренер предлагает жёсткие сборы. Это плюс к форме и риск травм.',
        options: [
            { id: 'hard', label: 'Жёсткие сборы', desc: 'Форма сейчас, риск потом.', cost: 'Сила +2% • −$60K • Травмы +10%', effects: { cash: -60000, dressing: -1 }, delayed: { weeks: 2, title: 'Сборы дали результат', text: 'Команда выглядит свежее.', effects: { prestige: 1 } } },
            { id: 'light', label: 'Лёгкий режим', desc: 'Бережём состав.', cost: '0 • Раздевалка +2', effects: { dressing: 2 } }
        ]
    },
    {
        id: 'former_client', icon: '📞', title: 'Бывший клиент на рынке', category: 'agency',
        text: 'Ваш бывший клиент ищет клуб. Он помнит вас — но журналисты тоже.',
        options: [
            { id: 'sign', label: 'Подписать', desc: 'Лояльность и скидка, но конфликт интересов.', cost: '−$1,2M • Фанаты +3 • Риск аудита +20', effects: { cash: -1200000, fans: 3, dressing: 2, conflict: 20 }, delayed: { weeks: 4, title: 'Сделка с бывшим клиентом', text: 'Пресса спрашивает, не купили ли вы своего.', effects: { trust: -4, conflict: 10 } } },
            { id: 'gm', label: 'Поручить GM', desc: 'Чисто, но без скидки.', cost: '−$1,5M • Риск +5', effects: { cash: -1500000, conflict: 5 } },
            { id: 'decline', label: 'Отказать', desc: 'Никакого конфликта.', cost: '0 • Фанаты −1', effects: { fans: -1 } }
        ]
    }
];

export const PRESIDENT_EVENTS = [
    {
        id: 'E00', icon: '🏛', title: 'Первый день в клубе', trigger: 'tutorial', chance: 1,
        text: 'Вы получили клуб в управление. Совет, раздевалка и трибуны ждут первого сигнала.',
        options: [
            { id: 'speech', label: 'Выступить перед штабом', desc: 'Показать, что вы включены.', cost: 'Раздевалка +2 • Доверие +1', effects: { dressing: 2, trust: 1 }, delayed: { weeks: 2, title: 'Первое впечатление', text: 'Штаб запомнил первый разговор.', effects: { trust: 1 } } },
            { id: 'listen', label: 'Сначала выслушать', desc: 'Узнать, где болит.', cost: 'Доверие +2', effects: { trust: 2 }, delayed: { weeks: 2, title: 'Штаб оценил', text: 'К вам пришли с идеями, а не с жалобами.', effects: { trust: 2, dressing: 1 } } },
            { id: 'austerity', label: 'Сразу сказать про деньги', desc: 'Честно, но холодно.', cost: '+$100K • Доверие +3 • Фанаты −1', effects: { cash: 100000, trust: 3, fans: -1 } }
        ]
    },
    {
        id: 'E01', icon: '🥊', title: 'Драка на тренировке', trigger: 'low_dressing', chance: 0.5,
        text: 'Два игрока подрались на льду. Один — звезда, второй — молодой. Раздевалка ждёт реакции.',
        options: [
            { id: 'fine', label: 'Оштрафовать звезду', desc: 'Показать, что правила для всех.', cost: '−$50K • Раздевалка +6 • Фанаты −2', effects: { cash: -50000, dressing: 6, fans: -2 }, delayed: { weeks: 2, title: 'Звезда обижена', text: 'Лидер недоволен публичным штрафом.', effects: { dressing: -3, trust: -2 } } },
            { id: 'star', label: 'Встать на сторону звезды', desc: 'Сохранить лидера.', cost: 'Раздевалка −4 • Тренер −3 • Фанаты +1', effects: { dressing: -4, fans: 1 }, delayed: { weeks: 2, title: 'Звезда просит ещё', text: 'Лидер понял, что ему можно больше.', effects: { trust: -4 } } },
            { id: 'ignore', label: 'Не вмешиваться', desc: 'Пусть разберутся сами.', cost: 'Раздевалка −3', effects: { dressing: -3 }, delayed: { weeks: 2, title: 'Конфликт тлеет', text: 'Драка повторилась на следующей тренировке.', effects: { dressing: -4, trust: -2 } } }
        ]
    },
    {
        id: 'E02', icon: '⭐', title: 'Звезда просит обмен', trigger: 'star_unhappy', chance: 0.45,
        text: 'Ваш лучший игрок недоволен ролью и результатами. Он просит обмен.',
        options: [
            { id: 'promise', label: 'Обещать плей-офф', desc: 'Дать цель и время.', cost: 'Доверие −2 • Раздевалка +6', effects: { trust: -2, dressing: 6 }, delayed: { weeks: 4, title: 'Обещание проверяет результат', text: 'Звезда ждёт выполнения обещания.', effects: { trust: -5 } } },
            { id: 'sell', label: 'Продать сейчас', desc: 'Деньги и чистая раздевалка.', cost: '+$4M • Фанаты −10 • Престиж −2', effects: { cash: 4000000, fans: -10, prestige: -2, dressing: -4 } },
            { id: 'extend', label: 'Продлить с прибавкой', desc: 'Оставить лидера.', cost: '−$1,5M • Раздевалка +8 • Доверие −2', effects: { cash: -1500000, dressing: 8, trust: -2 } },
            { id: 'fine', label: 'Оштрафовать', desc: 'Показать силу.', cost: 'Раздевалка −10 • Фанаты +2', effects: { dressing: -10, fans: 2 }, delayed: { weeks: 3, title: 'Звезда требует ухода', text: 'Конфликт стал публичным.', effects: { trust: -6, fans: -3 } } }
        ]
    },
    {
        id: 'E03', icon: '🧢', title: 'Капитан против тренера', trigger: 'captain_coach', chance: 0.4,
        text: 'Капитан считает, что тренер теряет раздевалку. Тренер считает, что капитан играет на публику.',
        options: [
            { id: 'captain', label: 'Поддержать капитана', desc: 'Раздевалка важнее.', cost: 'Тренер −4 • Раздевалка +5', effects: { dressing: 5, trust: -2 } },
            { id: 'coach', label: 'Поддержать тренера', desc: 'Дисциплина важнее.', cost: 'Раздевалка −8', effects: { dressing: -8 }, delayed: { weeks: 3, title: 'Капитан просит обмен', text: 'Конфликт не был решён.', effects: { fans: -2, dressing: -2 } } },
            { id: 'mediate', label: 'Медиация', desc: 'Поговорить со всеми.', cost: '−$100K • 50% успех', effects: { cash: -100000, dressing: 3 } },
            { id: 'strip', label: 'Снять капитанство', desc: 'Жёсткий сигнал.', cost: 'Раздевалка −12 • Фанаты −3', effects: { dressing: -12, fans: -3 }, delayed: { weeks: 2, chance: 0.25, title: 'Команда сплотилась', text: 'Новый капитан собрал раздевалку.', effects: { dressing: 8, trust: 2 } } }
        ]
    },
    {
        id: 'E04', icon: '🌱', title: 'Талант требует времени', trigger: 'youth_ice', chance: 0.4,
        text: 'Молодой игрок с высоким потенциалом не получает игровых минут и просит шанс.',
        options: [
            { id: 'play', label: 'Поставить в топ-6', desc: 'Дать время.', cost: '−$150K • Сила −1% • Раздевалка +4', effects: { cash: -150000, dressing: 4 }, delayed: { weeks: 3, title: 'Талант растёт', text: 'Молодой игрок начал набирать очки.', effects: { prestige: 1, fans: 2 } } },
            { id: 'loan', label: 'Отдать в аренду', desc: 'Спокойно.', cost: '+$50K • Фанаты −1', effects: { cash: 50000, fans: -1 } },
            { id: 'bench', label: 'Оставить в запасе', desc: 'Результат сейчас.', cost: '+$100K • Раздевалка −4', effects: { cash: 100000, dressing: -4 }, delayed: { weeks: 2, title: 'Талант просит обмен', text: 'Терпение игрока закончилось.', effects: { trust: 2, fans: -2 } } }
        ]
    },
    {
        id: 'E05', icon: '🎖', title: 'Ветеран просит последний контракт', trigger: 'veteran_contract', chance: 0.4,
        text: 'Ветеран, любимец трибун, просит ещё один сезон. Клубный врач сомневается.',
        options: [
            { id: 'extend', label: 'Продлить на год', desc: 'Уважение и опыт.', cost: '−$500K • Фанаты +5 • Раздевалка +4', effects: { cash: -500000, fans: 5, dressing: 4 } },
            { id: 'cheap', label: 'Продлить со скидкой', desc: 'Половина зарплаты.', cost: '−$50K • Фанаты −2 • Раздевалка −2', effects: { cash: -50000, fans: -2, dressing: -2 } },
            { id: 'farewell', label: 'Прощальный матч', desc: 'Красиво проводить.', cost: '−$400K • Фанаты +8', effects: { cash: -400000, fans: 8 }, delayed: { weeks: 2, title: 'Прощальный матч', text: 'Аншлаг и море эмоций.', effects: { cash: 200000 } } },
            { id: 'release', label: 'Отпустить', desc: 'Жёстко, но честно.', cost: 'Фанаты −6 • Раздевалка −3', effects: { fans: -6, dressing: -3 } }
        ]
    },
    {
        id: 'E06', icon: '🏦', title: 'Совет требует экономии', trigger: 'finance_crisis', chance: 0.55,
        text: 'Совет обеспокоен кассой. Нужно решение до конца недели.',
        options: [
            { id: 'cut', label: 'Урезать маркетинг и академию', desc: 'Сэкономить.', cost: '+$1M • Фанаты −5 • Престиж −1', effects: { cash: 1000000, fans: -5, prestige: -1 } },
            { id: 'sell', label: 'Продать топ-зарплату', desc: 'Быстрые деньги.', cost: '+$2M • Фанаты −8 • Сила −2%', effects: { cash: 2000000, fans: -8, dressing: -3 } },
            { id: 'loan', label: 'Взять кредит', desc: 'Отложить проблему.', cost: '+$5M • Доверие −5 • Долг', effects: { cash: 5000000, trust: -5 }, delayed: { weeks: 4, title: 'Платёж по кредиту', text: 'Банк напомнил о процентах.', effects: { cash: -400000, trust: -2 } } },
            { id: 'refuse', label: 'Отказаться', desc: 'Не паниковать.', cost: 'Доверие −10, затем +8 за твёрдость', effects: { trust: -10 }, delayed: { weeks: 2, title: 'Совет уважил позицию', text: 'Вы отстояли курс, но напряжение осталось.', effects: { trust: 8, fans: -2 } } }
        ]
    },
    {
        id: 'E07', icon: '🏷', title: 'Спонсор с условиями', trigger: 'sponsor_terms', chance: 0.45,
        text: 'Крупный спонсор готов платить, но хочет название арены и место в совете.',
        options: [
            { id: 'naming', label: 'Продать название', desc: 'Максимум денег.', cost: '+$3M • Фанаты −10 • Престиж −2', effects: { cash: 3000000, fans: -10, prestige: -2 } },
            { id: 'shirt', label: 'Только джерси', desc: 'Компромисс.', cost: '+$1,5M • Фанаты −3', effects: { cash: 1500000, fans: -3 } },
            { id: 'decline', label: 'Отказаться', desc: 'Имя клуба дороже.', cost: '0 • Фанаты +2 • Доверие −2', effects: { fans: 2, trust: -2 } },
            { id: 'bargain', label: 'Торговаться', desc: 'Попробовать больше без названия.', cost: '50%: +$2,2M • иначе Доверие −3', effects: { trust: -1 }, delayed: { weeks: 2, chance: 0.5, title: 'Спонсор ответил', text: 'Переговоры дали компромисс.', effects: { cash: 2200000 } } }
        ]
    },
    {
        id: 'E08', icon: '🏚', title: 'Банк требует платёж', trigger: 'bank_call', chance: 0.7,
        text: 'Касса ушла в минус. Банк требует досрочного погашения части долга.',
        options: [
            { id: 'pay', label: 'Заплатить', desc: 'Сохранить репутацию.', cost: '−$1M • Доверие +2', effects: { cash: -1000000, trust: 2 } },
            { id: 'restructure', label: 'Реструктурировать', desc: 'Растянуть долг.', cost: 'Доверие −3 • Ставка 10%', effects: { trust: -3 }, delayed: { weeks: 4, title: 'Новый график', text: 'Платёж стал меньше, но срок больше.', effects: { cash: -300000 } } },
            { id: 'asset', label: 'Продать тренировочную базу', desc: 'Крайний вариант.', cost: '+$3M • Престиж −3 • Фанаты −5', effects: { cash: 3000000, prestige: -3, fans: -5 } },
            { id: 'default', label: 'Технический дефолт', desc: 'Не платить.', cost: '+$1M сейчас • Доверие −20 • Фанаты −10 • −3 очка', effects: { cash: 1000000, trust: -20, fans: -10 }, delayed: { weeks: 3, title: 'Лига вмешалась', text: 'Лицензионная комиссия начала проверку.', effects: { trust: -5, prestige: -2 } } }
        ]
    },
    {
        id: 'E09', icon: '💼', title: 'Совет предлагает вливание', trigger: 'board_injection', chance: 0.35,
        text: 'Совет готов вложить деньги, но хочет долю или контроль.',
        options: [
            { id: 'loan', label: 'Кредит совета $6M', desc: 'Без размытия.', cost: '+$6M • Доверие +2 • Долг', effects: { cash: 6000000, trust: 2 }, delayed: { weeks: 4, title: 'Проценты', text: 'Обслуживание кредита давит на бюджет.', effects: { cash: -500000 } } },
            { id: 'investor', label: 'Инвестор $10M за 15%', desc: 'Деньги, но риск потерять контроль.', cost: '+$10M • Доверие −2 • Доля −15%', effects: { cash: 10000000, trust: -2 }, delayed: { weeks: 3, title: 'Инвестор требует голос', text: 'Новый акционер хочет влиять на решения.', effects: { trust: -5 } } },
            { id: 'preferred', label: 'Привилегированные акции $8M', desc: 'Без голоса, но дороже.', cost: '+$8M • Доверие −2', effects: { cash: 8000000, trust: -2 } },
            { id: 'decline', label: 'Отказаться', desc: 'Сохранить независимость.', cost: 'Доверие +1 • Фанаты +2', effects: { trust: 1, fans: 2 } }
        ]
    },
    {
        id: 'E10', icon: '🧾', title: 'Аудит зарплат', trigger: 'wage_audit', chance: 0.5,
        text: 'Лига проверяет ведомость. Перерасход выглядит подозрительно.',
        options: [
            { id: 'cooperate', label: 'Сотрудничать', desc: 'Честно и с штрафом.', cost: '−$500K • Доверие −3', effects: { cash: -500000, trust: -3 } },
            { id: 'hide', label: 'Спрятать бонусы', desc: 'Рискованный путь.', cost: '+$300K • 30%: Доверие −15', effects: { cash: 300000, trust: -1 }, delayed: { weeks: 3, chance: 0.3, title: 'Аудит продолжился', text: 'Найдены нарушения в бонусах.', effects: { trust: -12, cash: -700000 } } },
            { id: 'restructure', label: 'Реструктуризация', desc: 'Снизить ведомость.', cost: 'Раздевалка −4 • Доверие +2', effects: { dressing: -4, trust: 2 } },
            { id: 'sell', label: 'Продать игрока', desc: 'Быстро закрыть вопрос.', cost: '+$1,2M • Сила −1%', effects: { cash: 1200000, dressing: -2 } }
        ]
    },
    {
        id: 'E11', icon: '🎫', title: 'Фанаты против цен', trigger: 'fan_prices', chance: 0.5,
        text: 'Трибуны недовольны ценой билета. В соцсетях готовят акцию протеста.',
        options: [
            { id: 'freeze', label: 'Заморозить цены', desc: 'Успокоить трибуны.', cost: 'Доверие −1 • Фанаты +5', effects: { trust: -1, fans: 5 } },
            { id: 'lower', label: 'Снизить цены', desc: 'Потерять выручку.', cost: '−$120K • Фанаты +8', effects: { cash: -120000, fans: 8 } },
            { id: 'meet', label: 'Встретиться с ультрас', desc: 'Разговор и фан-зона.', cost: '−$50K • Фанаты +4 • Доверие −2', effects: { cash: -50000, fans: 4, trust: -2 }, delayed: { weeks: 2, title: 'Диалог дал результат', text: 'Ультрас сняли баннеры протеста.', effects: { fans: 3, trust: 1 } } },
            { id: 'ignore', label: 'Игнорировать', desc: 'Бизнес важнее.', cost: '+$100K • Фанаты −6', effects: { cash: 100000, fans: -6 }, delayed: { weeks: 2, title: 'Протест на трибуне', text: 'Посещаемость упала, баннеры против совета.', effects: { fans: -4, trust: -3 } } }
        ]
    },
    {
        id: 'E12', icon: '📢', title: 'Ультрас просят трибуну', trigger: 'ultras', chance: 0.4,
        text: 'Активные болельщики просят стоячую трибуну. Это атмосфера и расходы.',
        options: [
            { id: 'build', label: 'Построить трибуну', desc: 'Долгосрочный вклад.', cost: '−$1,5M • Фанаты +10', effects: { cash: -1500000, fans: 10 }, delayed: { weeks: 4, title: 'Новая трибуна', text: 'Атмосфера на домашних матчах стала сильнее.', effects: { fans: 3, prestige: 1 } } },
            { id: 'temp', label: 'Временная зона', desc: 'Дешево.', cost: '−$200K • Фанаты +3', effects: { cash: -200000, fans: 3 } },
            { id: 'no', label: 'Отказать', desc: 'Безопасность важнее.', cost: 'Фанаты −5', effects: { fans: -5 } }
        ]
    },
    {
        id: 'E13', icon: '📱', title: 'Скандал в соцсетях', trigger: 'social_scandal', chance: 0.12,
        text: 'Игрок опубликовал спорный пост. Пресса раздувает скандал.',
        options: [
            { id: 'fine', label: 'Оштрафовать', desc: 'Показать позицию.', cost: '−$30K • Фанаты +3 • Раздевалка −3', effects: { cash: -30000, fans: 3, dressing: -3 } },
            { id: 'protect', label: 'Защитить игрока', desc: 'Сохранить раздевалку.', cost: 'Фанаты −4 • Раздевалка +4', effects: { fans: -4, dressing: 4 } },
            { id: 'charity', label: 'Благотворительная акция', desc: 'Перевести разговор.', cost: '−$100K • Фанаты +5', effects: { cash: -100000, fans: 5 }, delayed: { weeks: 2, title: 'Акция получила отклик', text: 'Город увидел клуб с человеческим лицом.', effects: { fans: 2, trust: 1 } } }
        ]
    },
    {
        id: 'E14', icon: '🕵️', title: 'Журналист копает про агентство', trigger: 'agency_heat', chance: 0.65,
        text: 'Журналист нашёл связь между вашим клубом и замороженным агентством.',
        options: [
            { id: 'disclose', label: 'Раскрыть сделку', desc: 'Честность снижает риск.', cost: '−$100K • Доверие −5 • Риск −30', effects: { cash: -100000, trust: -5, fans: 2, conflict: -30 } },
            { id: 'deny', label: 'Отрицать', desc: 'Рискованный путь.', cost: '40%: Доверие −15 • Фанаты −8', effects: { conflict: -5 }, delayed: { weeks: 3, chance: 0.4, title: 'Расследование', text: 'Совет требует объяснений.', effects: { trust: -10, fans: -4 } } },
            { id: 'attack', label: 'Контратаковать', desc: 'Медиа-война.', cost: 'Доверие −10 • Фанаты +3', effects: { trust: -10, fans: 3 }, delayed: { weeks: 2, title: 'Медиа-война', text: 'Команда отвлеклась от хоккея.', effects: { dressing: -3 } } },
            { id: 'legal', label: 'Юристы', desc: 'Дорого и не гарантированно.', cost: '−$200K • 50% риск −20', effects: { cash: -200000, conflict: -10 }, delayed: { weeks: 3, title: 'Юристы выиграли', text: 'Часть обвинений снята.', effects: { trust: 3, fans: 2 } } }
        ]
    },
    {
        id: 'E15', icon: '📞', title: 'Бывший клиент звонит', trigger: 'ex_client', chance: 0.45,
        text: 'Бывший клиент готов перейти в ваш клуб. Лояльность даёт скидку, но пресса уже рядом.',
        options: [
            { id: 'sign', label: 'Подписать', desc: 'Скидка и риск.', cost: '−$900K • Риск +20 • Фанаты +3', effects: { cash: -900000, fans: 3, dressing: 2, conflict: 20 }, delayed: { weeks: 4, title: 'Сделка под лупой', text: 'Журналисты требуют объяснений.', effects: { trust: -4, conflict: 10 } } },
            { id: 'gm', label: 'Поручить GM', desc: 'Чисто, но дороже.', cost: '−$1,2M • Риск +5', effects: { cash: -1200000, conflict: 5 } },
            { id: 'no', label: 'Отказать', desc: 'Без риска.', cost: '0 • Фанаты −1', effects: { fans: -1 } }
        ]
    },
    {
        id: 'E16', icon: '🏢', title: 'Агентство в топе', trigger: 'agency_top', chance: 0.3,
        text: 'Ваше замороженное агентство попало в топ. Журналисты спрашивают, не конфликт ли это.',
        options: [
            { id: 'interview', label: 'Дать интервью о наследии', desc: 'Показать гордость.', cost: 'Фанаты +2 • Доверие +1 • Риск +5', effects: { fans: 2, trust: 1, conflict: 5 }, delayed: { weeks: 3, title: 'Интервью обсуждают', text: 'Часть совета считает, что вы слишком много говорите об агентстве.', effects: { trust: -2 } } },
            { id: 'distance', label: 'Дистанцироваться', desc: 'Снизить риск.', cost: '−$50K • Риск −10 • Репутация агентства −2', effects: { cash: -50000, conflict: -10 } },
            { id: 'silence', label: 'Промолчать', desc: 'Ничего не говорить.', cost: '0', effects: {} }
        ]
    },
    {
        id: 'E17', icon: '🧑‍🏫', title: 'Тренер просит игрока', trigger: 'coach_transfer', chance: 0.4,
        text: 'Тренер хочет конкретного игрока под свою схему. GM против.',
        options: [
            { id: 'approve', label: 'Одобрить трансфер', desc: 'Дать тренеру инструмент.', cost: '−$2M • Раздевалка +3 • Доверие −2', effects: { cash: -2000000, dressing: 3, trust: -2 }, delayed: { weeks: 3, title: 'Новичок освоился', text: 'Тренер получил нужный профиль.', effects: { prestige: 1 } } },
            { id: 'refuse', label: 'Отказать', desc: 'Сохранить бюджет.', cost: 'Раздевалка −2 • Доверие +2', effects: { dressing: -2, trust: 2 } },
            { id: 'gm', label: 'Отдать решение GM', desc: 'Делегировать.', cost: '0 • GM +2 • Тренер −1', effects: { trust: 1 } }
        ]
    },
    {
        id: 'E18', icon: '🔍', title: 'Скаут нашёл жемчужину', trigger: 'scout_gem', chance: 0.3,
        text: 'Скаут привёз отчёт о молодом игроке. Потенциал высокий, риск тоже.',
        options: [
            { id: 'sign', label: 'Подписать за $500K', desc: 'Быстрый шанс.', cost: '−$500K • 40% провал', effects: { cash: -500000 }, delayed: { weeks: 4, chance: 0.6, title: 'Новичок на тренировке', text: 'Тренеры оценили потенциал.', effects: { prestige: 1, fans: 2 } } },
            { id: 'academy', label: 'В академию', desc: 'Медленно и надёжно.', cost: '−$200K • Фанаты +1', effects: { cash: -200000, fans: 1 } },
            { id: 'pass', label: 'Пропустить', desc: 'Без риска.', cost: '0', effects: {} }
        ]
    },
    {
        id: 'E19', icon: '🏥', title: 'Медик против звезды', trigger: 'medical_star', chance: 0.45,
        text: 'Звезда хочет играть через боль. Врач настаивает на отдыхе.',
        options: [
            { id: 'rest', label: 'Дать отдохнуть', desc: 'Потерять матч, сохранить игрока.', cost: 'Сила −1% • Раздевалка +2', effects: { dressing: 2 } },
            { id: 'play', label: 'Выпустить', desc: 'Рискнуть.', cost: 'Сила +1% • Фанаты +2 • 50% травма', effects: { fans: 2, trust: 1 }, delayed: { weeks: 2, chance: 0.5, title: 'Рецидив', text: 'Звезда усугубила травму.', effects: { dressing: -3, trust: -2 } } },
            { id: 'ask', label: 'Спросить игрока', desc: 'Дать выбор.', cost: 'Раздевалка +2 • 50% играет', effects: { dressing: 2 } }
        ]
    },
    {
        id: 'E20', icon: '📋', title: 'GM просит полномочия', trigger: 'gm_power', chance: 0.35,
        text: 'GM хочет самостоятельно закрывать сделки до определённой суммы.',
        options: [
            { id: 'grant', label: 'Дать полномочия', desc: 'Разгрузить себя.', cost: 'Доверие +2 • GM +4 • Контроль −', effects: { trust: 2 }, delayed: { weeks: 4, title: 'GM закрыл сделку сам', text: 'Одна сделка прошла без вашего утверждения.', effects: { cash: -400000, trust: 1 } } },
            { id: 'refuse', label: 'Отказать', desc: 'Сохранить контроль.', cost: 'GM −3 • Доверие −1', effects: { trust: -1 } },
            { id: 'raise', label: 'Повысить зарплату', desc: 'Купить лояльность.', cost: '−$200K • GM +3', effects: { cash: -200000 } }
        ]
    },
    {
        id: 'E21', icon: '⚔️', title: 'Конфликт GM и тренера', trigger: 'staff_conflict', chance: 0.4,
        text: 'GM и тренер не сходятся в трансферных приоритетах. Штаб разделился.',
        options: [
            { id: 'gm', label: 'Сторона GM', desc: 'Трансферы важнее.', cost: 'Тренер −4 • Доверие +1', effects: { trust: 1, dressing: -2 }, delayed: { weeks: 3, title: 'Тренер обижен', text: 'Тренер перестал предлагать идеи.', effects: { trust: -2, dressing: -1 } } },
            { id: 'coach', label: 'Сторона тренера', desc: 'Хоккей важнее.', cost: 'GM −4 • Раздевалка +2', effects: { dressing: 2 }, delayed: { weeks: 3, title: 'GM обижен', text: 'GM замедлил работу по трансферам.', effects: { trust: -3, dressing: -1 } } },
            { id: 'mediate', label: 'Медиация', desc: 'Поговорить.', cost: '−$100K • 50% успех', effects: { cash: -100000, trust: 1 }, delayed: { weeks: 2, title: 'Медиация дала результат', text: 'Штаб вернулся к работе.', effects: { dressing: 2 } } },
            { id: 'restructure', label: 'Перераспределить роли', desc: 'Формально.', cost: 'Доверие −2 • оба −2', effects: { trust: -2, dressing: -2 } }
        ]
    },
    {
        id: 'E22', icon: '🚪', title: 'Соперник переманивает тренера', trigger: 'poach_coach', chance: 0.4,
        text: 'Богатый клуб предлагает вашему тренеру контракт. Он ждёт вашей реакции.',
        options: [
            { id: 'raise', label: 'Повысить зарплату', desc: 'Сохранить тренера.', cost: '−$400K • Доверие −2 • Раздевалка +3', effects: { cash: -400000, trust: -2, dressing: 3 } },
            { id: 'let', label: 'Отпустить', desc: 'Получить компенсацию.', cost: '+$1M • Раздевалка −3', effects: { cash: 1000000, dressing: -3 } },
            { id: 'block', label: 'Заблокировать', desc: 'Жёстко.', cost: 'Раздевалка +3 • Доверие −2', effects: { dressing: 3, trust: -2 }, delayed: { weeks: 3, chance: 0.5, title: 'Тренер ушёл', text: 'Конфликт закончился уходом.', effects: { trust: -4, dressing: -4 } } }
        ]
    },
    {
        id: 'E23', icon: '🏟', title: 'Авария на арене', trigger: 'arena_accident', chance: 0.08,
        text: 'На арене обнаружили повреждение конструкции. Нужно срочное решение.',
        options: [
            { id: 'repair', label: 'Полный ремонт', desc: 'Безопасно.', cost: '−$2M • 2 нед. без домашних', effects: { cash: -2000000, fans: -2 } },
            { id: 'patch', label: 'Латание', desc: 'Дешево, но рискованно.', cost: '−$500K • 20% повтор', effects: { cash: -500000 }, delayed: { weeks: 3, chance: 0.2, title: 'Повторная авария', text: 'Пришлось закрыть сектор.', effects: { fans: -4, trust: -3 } } },
            { id: 'close', label: 'Закрыть сектор', desc: 'Безопасность.', cost: 'Фанаты −5 • Вместимость −10%', effects: { fans: -5 } }
        ]
    },
    {
        id: 'E24', icon: '📏', title: 'Лига вводит потолок', trigger: 'salary_cap', chance: 0.5,
        text: 'Лига ужесточает потолок зарплат. Ваша ведомость — одна из самых высоких.',
        options: [
            { id: 'comply', label: 'Соблюдать', desc: 'Срезать ведомость.', cost: 'Раздевалка −4 • Доверие +3', effects: { dressing: -4, trust: 3 } },
            { id: 'challenge', label: 'Оспорить', desc: 'Бороться.', cost: 'Доверие −5 • 50% отсрочка', effects: { trust: -5 } },
            { id: 'bonuses', label: 'Спрятать бонусы', desc: 'Риск аудита.', cost: '+$300K • 30%: Доверие −15', effects: { cash: 300000, trust: -3 }, delayed: { weeks: 4, chance: 0.3, title: 'Аудит лиги', text: 'Нарушения найдены.', effects: { trust: -12, cash: -500000 } } }
        ]
    },
    {
        id: 'E25', icon: '🌍', title: 'Сборная забирает игроков', trigger: 'national_team', chance: 0.45,
        text: 'Три игрока вызваны в сборную на три недели. Клуб остаётся без глубины.',
        options: [
            { id: 'release', label: 'Отпустить', desc: 'Патриотично.', cost: '−$200K • Сила −2% • Фанаты +3', effects: { cash: -200000, fans: 3, dressing: 2 }, delayed: { weeks: 3, title: 'Игроки вернулись из сборной', text: 'Опыт международных матчей пошёл на пользу.', effects: { prestige: 1 } } },
            { id: 'refuse', label: 'Отказать', desc: 'Клуб важнее.', cost: '+$200K • Доверие −5 • Фанаты −5', effects: { cash: 200000, trust: -5, fans: -5 }, delayed: { weeks: 2, title: 'Федерация недовольна', text: 'Но клуб сохранил состав.', effects: { trust: 3 } } },
            { id: 'compromise', label: 'Договориться на двоих', desc: 'Компромисс.', cost: 'Доверие −1 • Фанаты +1', effects: { trust: -1, fans: 1 } }
        ]
    },
    {
        id: 'E26', icon: '📺', title: 'ТВ предлагает реалити', trigger: 'tv_show', chance: 0.35,
        text: 'Телеканал хочет снимать реалити о клубе. Деньги и шум.',
        options: [
            { id: 'accept', label: 'Согласиться', desc: 'Деньги и медиа.', cost: '+$1M • Раздевалка −3 • Риск', effects: { cash: 1000000, dressing: -3 }, delayed: { weeks: 4, chance: 0.2, title: 'Съёмки мешают', text: 'Команда устала от камер.', effects: { dressing: -3, trust: -2 } } },
            { id: 'decline', label: 'Отказаться', desc: 'Тишина.', cost: 'Доверие +1', effects: { trust: 1 } },
            { id: 'doc', label: 'Документалка', desc: 'Мягкий формат.', cost: '+$500K • Фанаты +5', effects: { cash: 500000, fans: 5 } }
        ]
    },
    {
        id: 'E27', icon: '🎯', title: 'Драфт: пик или ветеран', trigger: 'draft', chance: 0.6,
        text: 'На драфте можно взять лучшего доступного или обменять пик на готового ветерана.',
        options: [
            { id: 'best', label: 'Лучший доступный', desc: 'Будущее.', cost: '0 • Престиж +1', effects: { prestige: 1 }, delayed: { weeks: 4, title: 'Драфт дал талант', text: 'Академия пополнилась.', effects: { fans: 2 } } },
            { id: 'vet', label: 'Обменять на ветерана', desc: 'Результат сейчас.', cost: '−$300K • Сила +1%', effects: { cash: -300000, dressing: 1 } },
            { id: 'sell', label: 'Продать пик', desc: 'Деньги.', cost: '+$400K • Престиж −1', effects: { cash: 400000, prestige: -1 } }
        ]
    },
    {
        id: 'E28', icon: '🎟', title: 'Плей-офф: цены', trigger: 'playoff_prices', chance: 1,
        text: 'Плей-офф. Можно поднять цены, но трибуны это запомнят.',
        options: [
            { id: 'raise', label: 'Поднять на 50%', desc: 'Максимум денег.', cost: '+$600K • Фанаты −5', effects: { cash: 600000, fans: -5 } },
            { id: 'keep', label: 'Оставить цены', desc: 'Уважение фанатов.', cost: 'Фанаты +2', effects: { fans: 2 } },
            { id: 'zone', label: 'Фан-зона', desc: 'Атмосфера.', cost: '−$200K • Фанаты +8', effects: { cash: -200000, fans: 8 }, delayed: { weeks: 2, title: 'Фан-зона', text: 'Домашний матч прошёл при аншлаге.', effects: { cash: 150000 } } }
        ]
    },
    {
        id: 'E29', icon: '🎲', title: 'Букмекерский скандал', trigger: 'bookmaker', chance: 0.08,
        text: 'Появилась информация о ставках сотрудника клуба. Лига начинает проверку.',
        options: [
            { id: 'cooperate', label: 'Сотрудничать', desc: 'Чисто.', cost: 'Доверие −5 • Фанаты −5', effects: { trust: -5, fans: -5 } },
            { id: 'hide', label: 'Скрыть', desc: 'Риск.', cost: '+$200K • 50%: крупный скандал', effects: { cash: 200000, trust: -2 }, delayed: { weeks: 3, chance: 0.5, title: 'Скандал разросся', text: 'Лига нашла сокрытие.', effects: { trust: -15, fans: -8 } } },
            { id: 'fire', label: 'Уволить', desc: 'Показать реакцию.', cost: 'Раздевалка −3 • Фанаты +3', effects: { dressing: -3, fans: 3 } }
        ]
    },
    {
        id: 'E30', icon: '🏗', title: 'Город предлагает землю', trigger: 'city_land', chance: 0.25,
        text: 'Город готов дать землю под новую арену. Нужно решение о финансировании.',
        options: [
            { id: 'build', label: 'Строить', desc: 'Большой проект.', cost: '−$15M • Престиж +5 • Долг', effects: { cash: -15000000, prestige: 5 }, delayed: { weeks: 5, title: 'Стройка началась', text: 'Город следит за проектом.', effects: { fans: 3, trust: -3 } } },
            { id: 'cofinance', label: 'Софинансирование', desc: 'Город помогает.', cost: '−$8M • Фанаты +5', effects: { cash: -8000000, fans: 5 } },
            { id: 'plan', label: 'Проект на будущее', desc: 'Проектирование и согласования.', cost: '−$100K • Доверие +2 • Престиж +1', effects: { cash: -100000, trust: 2, prestige: 1 } },
            { id: 'no', label: 'Отказаться', desc: 'Не сейчас.', cost: '0', effects: {} }
        ]
    }
];

if (typeof window !== 'undefined') {
    window.PRESIDENT_STANCES = PRESIDENT_STANCES;
    window.PRESIDENT_BRIEFS = PRESIDENT_BRIEFS;
    window.PRESIDENT_EVENTS = PRESIDENT_EVENTS;
}
