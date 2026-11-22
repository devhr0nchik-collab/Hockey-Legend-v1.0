# Состояние этапа (детерминизм + CI)
- Косметика (снежинки) переведена на отдельный seeded-RNG: src/core/cosmetic-random.ts; Math.random в script.js отсутствует.
- Аудит недетерминизма: ID задач/офферов больше не используют Date.now (careerCounters.idSeq); toLocaleString заменён на formatInt; performance.now отсутствует; Date.now остался только метаданным сейва.
- Добавлены tests/cosmetic-rng.test.mjs и tests/determinism-audit.test.mjs.
- CI: .github/workflows/ci.yml (unit + season-regression), npm run test:unit / test:season.
- Проверка: 63 теста / 12 файлов, tsc 0, build 0.
- Статус: Портирование завершено.

# Этап: динамические свободные агенты (ТО)
- N = min(60, 5 + agentLevel * 2) на каждое ТО; неподписанный пул прошлого окна очищается.
- Архетипы (снайпер/плеймейкер/двусторонний/обороняющийся/вратарь) в src/core/attributes.ts; скиллы и потенциал различаются, формат сейва не изменён.
- База талантов: структурированные карточки (имя, позиция, архетип, рейтинг, ATK/DEF/POT).
- generateTransferOffer/generateOffersForPlayer: базовый интерес клуба к скиллам, офферы только при score >= -2.
- Проверка: 68 тестов / 13 файлов, tsc 0, build 0.

# Этап: старт новой карьеры (баг пустой базы талантов)
- Причина: generateScoutedPlayers/generateFreeAgentWindow вызывались только при старте ТО; seedFreeAgents создаёт молодых игроков с рейтингом 18–38 и без isScouted, поэтому фильтр базы талантов отдавал 0.
- Исправление: добавлена функция generateFreeAgentWindow(level) (общая для ТО и dev-API), startNewGame вызывает её с уровнем 1 сразу после resetGame.
- Регрессионный тест: tests/free-agents.test.mjs — при старте новой игры пул свободных агентов больше 0.
- Проверка: 69 тестов / 13 файлов, tsc 0. Статус: ОК.

# Этап: RPG-переговоры (контракты, мотивация, hard-reject, интрига)
- Контракт расширен полями goalBonus (долл./гол), gamesPlayedBonus (долл./игра), guaranteedYears; старые сейвы получают дефолты через normalizeContractData/normalizeOfferContract.
- Добавлена скрытая мотивация greed/ambition/loyalty/playtime; выводится из character без дополнительных RNG-вызовов, влияет на интерес клуба и шансы торга.
- resolveNegotiationRound поддерживает goalBonus/gamesBonus/guarantee; evaluateNegotiationDemand делает hard-reject при нереальных зарплате, бонусах или гарантиях.
- Agent Level: getNegotiationInsight скрывает бюджет/интерес на ур.1, показывает диапазон с ур.6 и точные значения с ур.10; уровень даёт бонус к шансу.
- UI: новые строки оффера, панель интриги, кнопки Goal/Games/Guaranteed, мотивация и пункты контракта в карточке игрока; стили neg-insight/neg-guarantee.
- Сейв: новые поля вынесены в contractExtras, формат PackedPlayer (33 поля) не изменён.
- Тесты: tests/negotiation.test.mjs (9 тестов). Проверка: 78 тестов / 14 файлов, tsc 0. Статус: ОК.

# Этап: позиционные бонусы и требования
- Бонусы зависят от позиции и архетипа: вратарь — cleanSheetBonus (сухие матчи) + savesBonus (сейвы), защитник — cleanSheetBonus + gamesPlayedBonus, нападающий — goalBonus + assistBonus.
- goalBonus для вратарей и защитников при генерации оффера равен 0; вратарь не может требовать бонус за голы (evaluateNegotiationDemand → hard-reject, reason 'positionBonus').
- getBonusImportance(player, kind) задаёт важность бонуса по позиции и архетипу; используется в evaluateNegotiationDemand, генерации гарантий, шансе торга и интересе клуба.
- UI: подписи и единицы бонусов динамические (getContractBonusMeta/buildOfferBonusRows), кнопки торга строятся из getContractBonusKinds; карточка игрока и окно продления тоже позиционные.
- Сейв: contractExtras расширен до 7 значений [motivation, goalBonus, gamesPlayedBonus, guaranteedYears, assistBonus, cleanSheetBonus, savesBonus]; старые 4-элементные сейвы читаются с дефолтами.
- Тест: «вратарь не требует и не получает бонус за голы» в tests/negotiation.test.mjs.
- Проверка: test:unit 78/78 (13 файлов), test:season 1/1, tsc 0, build 0. Статус: ОК.

# Этап: редизайн UI — стиль №2 «NEON RINK» (киберспорт HUD)
- Выбрано направление 2 из 3 предложенных (неоновый киберспорт); реализация без внешних картинок, только код.
- style.css: новые токены :root — палитра (#05070c фон, циан #00e5ff, лайм #c6ff00, маджента #ff2e88, янтарь #ffb300), свечения (--glow-*), HUD-радиусы и --notch (срезанные углы через clip-path), шрифт --font-hud (Chakra Petch/Rajdhani с фолбэком).
- Текстуры через data:image/svg+xml: --tex-noise (feTurbulence шум), --tex-grid, --tex-scan (сканлайны), --tex-ice (трещины льда), --tex-hex (гекс-сетка); body — многослойный градиент арены + body::before шум overlay.
- Перекрашены все legacy-цвета по всему файлу: 00d4ff→00e5ff, 9945ff→ff2e88, 00ff88→c6ff00, 0088cc→0097c7, фоны 0d1420/16202f/1b2839/21304a→05070c/0b1018/101826/16233a, границы/текст под новую палитру (~200 вхождений).
- Анимации: screenIn (экраны), modalAppear+overlayFade (модалки, ease-hud), btnSheen (блик главной кнопки), avatarPulse+ringSpin (аватар), navGlow, titleFlicker, gridDrift, glowBreathe; hover — неоновые рамки/свечение/подъём карточек (tile, player-row, menu-btn, continue-card); focus-visible; prefers-reduced-motion глушит анимации.
- script.js: getTeamLogoHTML возвращает inline <svg class="team-logo-img"> — неоновый гекс-щит (детерминированный hue по имени клуба, feDropShadow-свечение); новые getClubNeonColors/getClubInitials/generateNeonShieldInner (экспортируется).
- datapack.js: generateShieldSVG (fallback для PNG) переиспользует generateNeonShieldInner — единый вид щита inline и data-uri; удалены дубли getShieldColors/getClubAbbr.
- index.html: theme-color #05070c, inline-SVG меню/о-игре перекрашены в #00e5ff/#0097c7.
- script.js (JS-инлайн-цвета графиков/спарклайнов/офферов): #00ff88→#c6ff00, #00d4ff→#00e5ff, #ff2d55→#ff2e55, #ffaa00/#ffcc00→#ffb300, rgba(0,212,255)→rgba(0,229,255); grep по legacy-палитре в исходниках — 0 совпадений.
- Проверка: test:unit 78/78 (13 файлов), test:season 1/1, tsc 0, build 0, dev-сервер отдаёт новые css/js/html. Статус: ОК.

# Этап: 2D-аватары NEON RINK (getPlayerAvatar)
- Портреты фактически лежат в public/faces/{players,goalies} (в задании был путь public/assets/faces — использовано реальное расположение; vite base './' → src 'faces/...').
- script.js: getPlayerAvatar(player) (export) — <img class="player-avatar" loading=lazy>: позиция 'G' → faces/goalies/gN.png, остальные (C/LW/RW/D) → faces/players/pN.png; N = hashString(name) % AVATAR_COUNTS + 1 (детерминированно, 8 игроков / 1 вратарь).
- Fallback: onerror → window.getPlayerAvatarFallbackSrc(folder) — data-uri неоновый силуэт (игроки циан hue190, вратари янтарь hue55); getPlayerAvatarFallbackHTML переиспользует getClubInitials.
- Удалён старый процедурный SVG-генератор getPlayerAvatarSVG (~290 строк) вместе с getAvatarEthnicity/hexToRgb/rgbToHex/shadeColor; все 11 мест вызова (списки клиентов/ростеры/лидерборд/карточка игрока/база талантов/драфт-выбор/NPC-модалка/модалка переманивания) переведены на getPlayerAvatar.
- Эмодзи-заглушки убраны: новый getAgentAvatarHTML() (неоновый inline-SVG агент в костюме) — в renderOffice (#office-agent-avatar, заполняется один раз) и renderUpgradeTab (.ap-avatar); index.html: span.avatar-emoji emptied + id.
- style.css: .player-avatar — круглая, object-fit: cover, неон-рамка rgba(0,229,255,0.45) + glow, hover-усиление; обёртки (.p-avatar/.pp-avatar/.pd-avatar/.rr-avatar/.ncr-avatar/.draft-choice-avatar/.lb-avatar) очищены от дублирующих border/shadow — стилизует только .player-avatar; .ap-avatar теперь круглый бокс 72px; .agent-avatar-svg без рамки (её рисует контейнер).
- Тест: tests/avatar.test.mjs (7 тестов) — папка по позиции (G vs C/LW/RW/D), детерминизм, диапазон индекса + существование файлов, класс .player-avatar, fallback на null, синхронность AVATAR_COUNTS с диском.
- Проверка: test:unit 85/85 (14 файлов), test:season 1/1, tsc 0, build 0, dist/faces скопирован. Статус: ОК.

# Этап: углубление просмотра матча — play-by-play трансляция NEON RINK
- Аудит: старый рендер дёргал simRandom() на каждый кадр (счёт «дрожал»), лента = только голы, полная перерисовка innerHTML на тик, подсветка клиента через String.includes, модалка матча дублировала расчёты.
- buildMatchScript переписан: весь сценарий (start/shot/save/hit/faceoff/penalty/goal/period/ot/end, ~40 событий) строится ОДИН раз локальным makeSeededRNG(matchSeed(...)); глобальный sim-RNG не сдвигается (детерминизм недели/сезона сохранён — test:season проходит). Каждое событие хранит накопительный after{shotsH/A,savesH/A,hitsH/A,faceoffsH/A,pimH/A}, scoreHome/Away, isClient (Set имён клиентов, O(1)), delay. Голы берутся из r.goals (симуляция матча не менялась), гол добавляет бросок. Стабильная сортировка minute→тип→id.
- Контроллер matchPlayback (чистая логика без DOM): idx/playing/speed(1|2)/timer + play/pause/toggleSpeed/skip/stepBack/delayFor (задержка от важности события / скорость, ≥200ms); шаг назад стирает верхнюю строку ленты.
- Инкрементальный рендер: mvMountSkeleton один раз (скоринг-борд с id, серия, ринк в неоне, статистика, лента, финал, контролы); mvSyncAll точечно обновляет textContent/class (mvSnapshot — чистая функция от (сценарий, idx)); mvSyncFeed дописывает строки через insertAdjacentHTML('afterbegin') только по дельте renderedCount→idx; mvRenderControls с data-key-кэшем (перерисовка только при смене состояния/языка); обработчик кнопок — одно делегирование на контейнер.
- Клиент агента: mvPickClientName + «живая строка» (G+A/броски/штраф по показанным событиям), .mv-event-client — лаймовая рамка+пульс, бейдж «Мой клиент»; звук/вибрация/toast — только голы клиента и финальная сирена (раньше — на каждый гол).
- Унификация: openMatchModal берёт shotsH/A, pimH/A из buildMatchScript(match).totals — дублирующие simRandom/randomInt удалены; иконки событий — inline SVG (currentColor) вместо эмодзи; ринк в неоновой палитре.
- i18n: добавлены ключи ru+en (Бросок по воротам/Сейв/Силовой приём/Вбрасывание выиграл/Удаление/мин/Овертайм/Серия буллитов/Шаг назад/Конец 3-го периода/Счёт в серии).
- onLanguageChanged: mvRemount() при видимом экране матча; closeMatchView/resetGame чистят matchPlayback.
- CSS: .mv-live(LIVE/ПАУЗА/x2 с пульсом), .mv-event-minor, .mv-event-client+mvClientPulse, .mv-feed-list, .mv-ico, .mv-client-line, кнопки x1/x2 и ↺ на токенах NEON RINK.
- Тесты: tests/match-view.test.mjs (12) — детерминизм JSON-сценария, sim-RNG draws не меняются, сортировка/типы/границы периодов, монотонность статистики и totals, isClient только клиент, нарастание счёта, контроллер (open/stepOnce/toggleSpeed/skip/stepBack/finished), тексты локализованы; тест-хуки __HL.mv*.
- Проверка: test:unit 97/97 (15 файлов), test:season 1/1, tsc 0, build 0. Статус: ОК.

# Этап: переговоры 2.0 — интерактивный диалог агент ↔ клуб (FIFA-style)
- Универсальное ядро evaluateContractPackage(player, offer, perspective='club'|'agent', anchor) — чистая оценка ВСЕГО пакета (ЗП/срок/комиссия/бонусы/гарантии) против cap/бюджета/престижа; возвращает {score 0..100, verdict accept|counter|reject, reasons[], hardReject/hardReason, counter, limits}. Перспектива агента зеркальна (дороже = лучше) — готова к режиму Президента. anchor не даёт контр-офферу опуститься ниже исходного оффера клуба. evaluateNegotiationDemand сохранён для совместимости.
- Комиссия агента стала договорной: offer.agentCommissionRate (5–20%, дефолт COMMISSION_RATE=0.10 перенесён вверх против TDZ), getOfferCommissionRate; acceptNegotiation(player, termsOverride) подписывает контр-оффер и считает комиссию по negotiated rate (activeCommissions.commissionRate); новость «Комиссия: {c} ({p}% от годовой зарплаты)».
- Диалоговый движок resolveDialogueRound(player, neg, pkg, action: offer|press|adjust): seed раунда matchSeed([...,'dialogue',round,action]); «Надавить» при patience<20 → walkAwayFromDialogue (оффер удалён, walkedClubs); успех/провал press тратит 25–40 терпения; offer тратит 8+6×причин (макс 30), interest двигается от score; patience<=0 → ультиматум (оффер остаётся, можно принять). adjust возвращает в builder за 5 терпения и +1 раунд.
- Шкалы: interest = 50 + trueInterest×5 (из evaluateClubInterest), patience 0..100 вместо 3 сердечек; getGaugeTone >=60 green / 30–59 amber / <30 red; точный % интереса скрыт до ур.10 агента (getNegotiationInsight), цвет виден всегда.
- UI split-screen: index.html .negotiation-console = .neg-builder-panel (ползунки ЗП/срок/комиссия/подписной/позиционные бонусы/гарантии + итог комиссии + «Сделать предложение») + .neg-club-panel.phone-mockup (шапка, .neg-gauges Interest/Patience, чат, кнопки). Контр-оффер автоподставляется в ползунки с подсветкой .counter-changed; в response-фазе ползунки заблокированы, кнопки «Принять контр-оффер»/«Надавить»/«Скорректировать»; «Отклонить»/«Закрыть»/«Отправить в Мой Клуб» сохранены. mode-list скрывает конструктор (список клубов/события). Старое меню renderTradeOptionsMenu удалено; resolveNegotiationRound — тонкая обёртка над диалогом.
- Персистентность: playerNegotiations[name].sessions[clubKey] = {v:2, patience, interest, round, phase, counterOffer, messages, finished, walkedAway}; сохраняется при закрытии/раундах/ультиматуме, нормализуется при loadGame; повторное открытие продолжает диалог. Формат PackedPlayer (33) и v23 не изменены.
- CSS NEON RINK: .neg-range (ромб-Thumb 45°, циан→лайм заполнение через --fill, webkit+moz), .neg-gauge-green/amber/red (glow, сегментированный трек, красный пульс gaugeDanger), .neg-submit-btn (лайм+блик btnSheen, срезанные углы), .phone-btn-press (маджента), адаптив <760px стопкой; prefers-reduced-motion глушит анимации.
- i18n: +24 ключа ru/en (действия, шкалы, шаблоны реакций клуба по причинам salary/commission/signingBonus/years/guarantee/bonus).
- Тесты: tests/negotiation-dialogue.test.mjs (19) — зеркальность перспектив, чистота ядра (0 sim-RNG draws), anchor, hard-reject, пороги getGaugeTone, DOM конструктора/шкал, детерминизм раунда, контр-оффер в ползунках, выход при press<20%, adjust −5, подписание контр-оффера, live-ползунки, resume и сейв сессии; старые negotiation.test.mjs (10) зелёные. Хуки __HL: evaluateContractPackage/gaugeTone/negotiationGauges/buildGaugesHTML/openNegotiationDialogue/openDialogueWithOffer/reopenNegotiation/negotiationState/dialogueRound/acceptDialogue/closeDialogue/refreshDialogueUI/negotiationSessions.
- Проверка: test:unit 116/116 (16 файлов), test:season 1/1, tsc 0, build 0. Статус: ОК.

# Этап: аудит блока A роудмапа (A1–A8) + фикс A6
- Роудмап найден: ~/.opencode/plan/hockey-legend-roadmap.md (блок A). Номера строк в нём устарели — проверка шла по именам функций и симптомам.
- A1 (двойное старение): код корректен — advanceSeasonAges один проход по players с rosterSet. Тест есть.
- A2 (lostPlayerThisSeason навсегда): код корректен — сброс в playTransferWeek (новый сезон) и resetGame. Тест есть.
- A3 (деньги переманивания ×1000): Я ошибся в роудмапе, баг A3 не существует, код уже корректный — showPoachingEvent: cost*1000 и compensation*1000 (salary в тысячах, agentMoney в долларах); payTransferCommission согласован. Тесты есть (отпустить/удержать/не хватает денег).
- A4 (сброс совета при reload): код корректен — loadGame сбрасывает clubCouncil только при !pos || shares < 51. Тест есть (save/load + потеря 51%).
- A5 (мёртвая проверка задач совета): код корректен — evaluateCouncilSeason вызывается ПОСЛЕ currentSeason++ (playTransferWeek), поэтому prev.season === currentSeason - 1 верно; снятие за 3 провала работает. Тесты есть (защита от двойного зачёта, снятие, успех).
- A6 (контракты конца сезона): НАЙДЕН И ИСПРАВЛЕН остаточный баг — processEndOfSeasonContracts пропускал во втором цикле только новых FA, но не остальных клиентов; myRoster хранит ссылки на players, поэтому контракт клиента списывался ДВАЖДЫ за сезон, а 2-летний контракт сразу «продлевался» случайно со сбросом negotiated-бонусов. Фикс: второй цикл пропускает всех клиентов (rosterSet), как в A1. Red/green проверено: без фикса тест падает (2 года → случайные 4), с фиксом 2→1 и бонусы целы.
- A7 (призраки при отставке): код корректен — processRetirements один бросок на игрока, retireSet фильтрует оба списка. Тест есть.
- A8 (NHL/AHL/KHL без молодёжи): код корректен — replenishYouth передаёт лигу из ключа YPS (TOP_TIER), generateYouthPlayer(forcedLeague) её уважает. Тест есть.
- Тесты: tests/roadmap-block-a.test.mjs (14). Хуки __HL: advanceSeasonAgesNow/npcPoachFlags/setLostPlayerThisSeason/showPoachingEventNow/npcAgentClientIds/councilState/setPresidentForTest/evaluateCouncilSeasonNow/patchCouncilForTest/setPhaseForTest/endOfSeasonContractsNow/setPlayerContract/playerContractProbe/firstWorldPlayerName/setMoneyForTest/completeCareerGoalsForTest/retirementsNow/agePlayersForTest/replenishYouthNow/worldLeagueProbe. Формат сейва не изменён.
- Проверка: test:unit 130/130 (17 файлов), test:season 1/1, tsc 0, build 0. Статус: ОК.

# Этап: плейтест-план, Этап 1 (1.1 биржа, 1.2 ивенты, 1.3 сборная)
- План: ~/.opencode/plan/hockey-legend-playtest-fixes.md, раздел 2. Реализовано полностью.
- 1.1 Биржа: единый LEAGUE_BUDGET/getLeagueBudget; чистые getClubEnterpriseValue(club, noise=1) (множители: престиж 0.35+p/100, апгрейды ≤+25% (levels/600), форма (W−L)/5×0.04, титулы ≤+10%, бюджет клуба ±5%), getFairStockPrice (value/100, ≥1), getStockBounds (0.75×fair…1.5×fair), clampStockMove (±2.5%/нед). generateClubData: старт = fair, история от fair через clamp+коридор. recalculateStockPrice: target = EV(noise 0.97…1.03)/100 → clampStockMove(prev) → bounds; один simRandom() на тик (детерминизм сохранён). getLeagueStockMultiplier удалён (мёртв). Миграция в loadGame после unpackClub: цена вне [0.5×fair, 2×fair] → fair, stockHistory фильтруется по коридору, одноразовая новость «Рынок акций пересчитан». sharesTotal=100 не менялся.
- 1.2 Ивенты: home_return_chain.canStart (есть клиент с клубом не дома); startChain проверяет canStart и фиксирует ac.playerName на старте; getChainPlayer(ac, stage) — привязанный игрок приоритетнее getPlayer, stage.playerCondition = p.club && !isInHomeCountry(p) на всех 4 стадиях; triggerChainStart проверяет canStart + кулдаун eventCooldowns[chainId]; tryChainEvent не splice-ит молча — finishChain(id, reason) с новостью «История закрыта: игрок уже дома», без изменения лояльности и подмены; advanceChain завершает через finishChain. EVENT_POOL.family_home: condition/getPlayer согласованы (p.club && !isInHomeCountry), getPlayer пропускает игроков с активной find_club_home. createHomeTask — единая точка создания задачи без дублей (family_home, стадия 1 цепочки, visa_issue). checkActiveTasks: при завершении/провале find_club_home → closeHomeChainFor (закрытие цепочки + кулдаун +4 недели); кулдаун учитывается и в случайном старте цепочек playRegularWeek.
- 1.3 Сборная: clearFavoriteNationalTeam() (null + _pendingMatches=[] + saveGame + перерисовка бара/экрана/настроек); showNationalPickModal работает без турнира (сообщение + кнопка сброса), кнопка «Сбросить выбор»/«Не болеть ни за кого» всегда видна; renderNtFavBar: кнопка СБРОСИТЬ рядом со СМЕНИТЬ (.nt-fav-reset, красный); настройки index.html: строка «Сборная для просмотра» (setting-nt-value + setting-nt-reset), renderNationalTeamSetting в loadSettings; сброс вне турнира работает, выбор на следующий турнир не блокируется. i18n: +6 ключей ru/en.
- Тесты: tests/economy-balance.test.mjs (8: fair-старт, 100 недель ≤2.5x, апгрейды ≤+25%, недельный лимит ±2.5%, clamp, абьюз MHL закрыт, миграция космической цены+новость, 1 draw/тик), tests/events-home-return.test.mjs (6: canStart/family_home при всех дома, привязка, стадия не подменяет первого в ростере, закрытие при возвращении домой без потери лояльности, нет дублей задач, закрытие+кулдаун), tests/national-team.test.mjs (5: сброс из модалки+save/load null, сброс из настроек вне турнира, модалка без турнира, после сброса очередь пуста, кнопка СБРОСИТЬ в баре). Тесты форсируют RU через localStorage hockeyLegendLang.
- Хуки __HL (этап 1): stockFairProbe/stockValueProbe/stockClampProbe/stockTickNow/stockWeeksNow/setClubStockForTest/clubKeysForTest/setClubUpgradesForTest/chainState/clearChainCooldownForTest/triggerChainStartNow/chainTickNow/setChainStageForTest/eventPoolProbe/eventChoiceNow/eventChoiceForPlayerNow/homeTasksFor/checkTasksNow/setPlayerClubForTest/playerLoyaltyProbe/rosterReorderForTest/ntState/setFavoriteForTest/clearFavoriteNow/startTournamentNow/openNtPickModalNow/ntFavBarNow/addPendingNtMatchForTest/tournamentWeekNow/matchQueueSize. Формат сейва (PackedPlayer 33 / PackedClub 17, v23) не изменён.
- Проверка: test:unit 149/149 (20 файлов), test:season 1/1, tsc 0, build 0. Статус: ОК.

# Этап: плейтест-план, Этап 2 (2.1 тренировки, 2.2 апгрейды клуба, 2.3 переманивание)
- План: ~/.opencode/plan/hockey-legend-playtest-fixes.md, раздел 3. Реализовано полностью.
- 2.1 Тренировки: `TRAINING_COST` заменён на `getTrainingCost(player)` = clamp(round((1500 + rating*40) * (1 + (agentLevel−1)*0.06)), …, 25000); все места UI/старта используют функцию. Добавлен корневой `trainingAuto` `{ [playerName]: attr }` (PackedPlayer не изменён, сейв v23): saveGame/loadGame (старые сейвы → `{}`, невалидные атрибуты отбрасываются)/resetGame. `renderPlayerDevelopment` получил блок «Автотренировка» (атрибут + вкл/выкл, подсветка цели и цены). `toggleAutoTraining`/`tryStartAutoTraining`: блок стартует сразу при включении и автоматически после завершения; при `agentMoney < cost`, атрибуте 99 или удалении клиента авто отключается с новостью; в минус не уходит. Автостарт не вызывает simRandom — завершение тратит ровно 1 бросок.
- 2.2 Апгрейды клуба: удалён дубль `LEAGUE_PRIZE_BUDGETS` (getLeaguePrize → getLeagueBudget) и локальный словарь в `getLeagueBaseCost` (функция удалена). `clubUpgradeCost = max(100, round(LEAGUE_BUDGET[league] * 0.005 * level^1.35))`. В `buildClubUpgradeCard` рядом с ценой показывается доля от текущего бюджета клуба (`.infra-cost-pct`), helper `getClubUpgradeBudgetShare`. Эффекты и максимум 25 не менялись; старые уровни сохраняются.
- 2.3 Переманивание: чистая `getPoachChance(player, agency, reply, offer, myRep?)` — база 20, repPart=(rep−agencyRep)*0.8, qualityPart=quality*30, reply ±25/−20, loyalty*25, возрастной множитель 0.9–1.1, clamp [5,85]. `getMyAgentReputation()` вместо `upgrades.reputation*3`; жёсткие потолки 3/8/18/30/45/60/75 удалены, остались только rating 80+ при rep<20 (5%) и разрыв топ-агентства >60 (≤10%). `getPoachOfferQuality` учитывает прибавку к зарплате, комиссию, подъёмные и обещания; пресеты «Стандарт» (0), «Агент года» ($5K), «Медийный» ($2.5K) с quality ≈0.25/0.90/0.63, цена списывается при попытке (с проверкой баланса). Одна попытка за сезон и 3 попытки → закрытие агентства сохранены. Целевой диапазон: max rep + лучший оффер + верная реплика ≈51%.
- UI: стили `.dev-auto*`, `.pd-offer-presets/.pd-offer-preset`, `.infra-cost-pct`; i18n +26 ключей ru/en.
- Тесты: tests/training-balance.test.mjs (7: цена/потолок, автостарт+продление без минуса, остановка без денег/на 99, 0 лишних RNG-бросков, старый сейв без trainingAuto), tests/club-upgrades.test.mjs (5: монотонность, 0.5% бюджета lvl1, потолок полной прокачки, точное списание+уровень, % в карточке), tests/poach-chance.test.mjs (9: пресеты/quality, монотонность по rep и quality, max-rep 45–55%, min-rep ≤15%, частные случаи, диапазон/NaN, детерминизм).
- Хуки __HL (этап 2): trainingCostProbe/trainingAutoState/trainingProbe/setPlayerAttrForTest/setTrainingAutoForTest/toggleAutoTrainingNow/tryAutoTrainingNow/processTrainingsNow/startTrainingNow; clubUpgradeCostProbe/clubUpgradeTotalProbe/clubUpgradeShareProbe/clubUpgradeCardHTMLForTest/purchaseClubUpgradeNow; poachPresetsProbe/poachOfferQualityProbe/poachChanceProbe/poachChanceRawProbe/poachRollProbe.
- Проверка: test:unit 170/170 (23 файла), test:season 1/1, tsc 0, build 0. Статус: ОК.

# Этап: плейтест-план, Этап 3 (3.1 просмотр матчей, 3.2 тултипы атрибутов)
- План: ~/.opencode/plan/hockey-legend-playtest-fixes.md, раздел 4. Реализовано полностью.
- 3.1 Просмотр матчей: `gameSettings.matchView = 'full' | 'score' | 'off'` (дефолт full) хранится в localStorage `hockeyLegendSettings`; `loadSettings` валидирует режим и синхронизирует радио-кнопки, старые настройки без поля получают full. В модалку настроек добавлен блок из 3 радио-кнопок (`setting-match-view-*`).
- Политика централизована: `normalizeMatchViewMode`/`applyMatchViewPolicy()`/`shouldOpenMatchView()`. `openMatchQueueFromData`, `openMatchQueue`, `openNextMatchInQueue` применяют режим:
  - `off` — экран не открывается, все матчи очереди помечаются `viewed`, `onFinish` вызывается ровно один раз (защита от двойного вызова), затем возврат в офис;
  - `score` — экран открывается и сразу `matchPlayback.skip()` (финальный счёт/оценки), callback — после закрытия;
  - `full` — прежнее поведение.
  `completeMatchQueue()` — единая точка завершения: не теряет `matchQueueOnFinish`, корректно вызывает `finishPlayoffs()` (плей-офф → draft) и `proceedAfterMatches` (сборная).
- 3.2 Атрибуты: объект `ATTRIBUTE_INFO` (attack/defense/technique/psyche/physics/speed/potential) с иконками и описаниями, `getAttributeInfo()` переводит RU/EN. `attrHelpButton(attrKey)` — кнопка «?» с `data-attr-help` и aria-label. `ppAttrBar(label, value, attrKey)` получил `data-attr` и кнопку помощи; `buildTalentCard` и `renderPlayerDevelopment` используют те же ключи/данные. Тултип: один делегированный обработчик, hover на desktop, tap/click на mobile, закрытие по клику вне и Escape; позиционирование fixed с авто-переворотом. В «Об игре» добавлена секция «Атрибуты» (`#about-attributes`, renderAttributeHelpInto) со всеми 6 атрибутами и потенциалом; перерисовывается при смене языка.
- UI/CSS: `.match-view-option(s)`, `.attr-help`, `.attr-tooltip`, `.about-attributes/.attr-guide-*`; i18n +14 ключей ru/en (настройки просмотра, названия/описания атрибутов, справка).
- Тесты: tests/match-settings.test.mjs (10: дефолт/миграция настроек, сохранение localStorage, радио-кнопки, full/score/off очереди, callback один раз, viewed-флаги, неделя президента, финал плей-офф → draft, матчи сборной без потери proceedAfterMatches), tests/attribute-help.test.mjs (7: RU/EN описания всех 7 ключей, data-attr/«?» в ppAttrBar/buildTalentCard/renderPlayerDevelopment, клик+Escape тултипа, справка «Об игре» со всеми атрибутами).
- Хуки __HL (этап 3): applyMatchViewPolicy/shouldOpenMatchView/matchViewSettings/setMatchViewSetting/reloadSettingsNow/matchQueueState/openMatchQueueForTest/closeMatchViewNow/openPlayoffFinalQueueForTest; attributeKeys/attributeInfoProbe/attributeHelpHTML/ppAttrBarHTML/developmentHTMLForTest/renderAboutAttributesNow/openAboutNow/showAttrTooltipNow/attrTooltipState/hideAttrTooltipNow.
- Проверка: test:unit 187/187 (25 файлов), test:season 1/1, tsc 0, build 0. Статус: ОК.

# Этап: v1.1 «Живой мир и Звук» (звук + динамические новости мира)
- Звук: пресеты вынесены в `SOUND_PRESETS` (click/levelup/goal/event/error + whistle/siren); Web Audio без файлов. Свисток — на старт/периоды/удаления, сирена — на любой гол и финальную сирену; вибрация/toast за клиента только на его гол. `prefers`-настройка — существующий `gameSettings.sound`.
- Живой мир: `worldState` в корне сейва (v23, PackedClub не изменён): `{v, cooldowns, debtWeeks, effects, feed}`; старые сейвы → пустое состояние. `simulateWorldEvents()` вызывается в `playRegularWeek` после `simulateClubActions`.
- Детерминизм: отдельный `makeSeededRNG(matchSeed([...,'world',season,week]))` — 0 бросков основного sim-RNG (матчи/сезон не сдвигаются).
- События (макс. 1/нед, шанс 12%, кулдаун 12 недель на клуб): банкротство (только при долге 3+ недели, не для клуба президента; 1–2 не-клиента → FA, долг обнуляется, престиж −3), смена тренера (`getEffectiveTeamStrength` ×0.92/×1.05 на 6–8 недель; учитывается в матчах и плей-офф), арена (+5% годового бюджета лиги, stadium +1).
- UI: `addNews(text, type, category)`; категория `world` (иконка 🌍) показывается во вкладке «Лиги»; тикер меню берёт последние 5 событий из `worldState.feed` с фолбэком на статичный `WORLD_NEWS`; i18n +4 ключа ru/en.
- Тесты: tests/world-events.test.mjs (13: пресеты и безопасный вызов без AudioContext/при sound off, 0 sim-бросков, эффект тренера и истечение, арена, банкротство→FA, защита президента, кулдаун, news-категория, старый сейв без worldState, повторяемость события, save/load worldState).
- Хуки __HL: worldStateProbe/worldTickNow/worldEffectiveStrength/worldStrengthProbe/worldCandidatesNow/setWorldClockForTest/setClubBudgetForTest/worldClubSquadSize/worldClubProbe/playerClubProbe; soundPresetsProbe/soundPlayNow/setSoundForTest.
- Проверка: test:unit 200/200 (26 файлов), test:season 1/1, tsc 0, build 0. Статус: ОК.

# Этап: v1.1 polish (мягкий звук, трансферные слухи, NEON-баннеры)
- Звук: `playSound()` переписан на цепочку osc → GainNode → BiquadFilter(lowpass) → master GainNode → destination. У каждой ноты attack 0.008–0.06 с и release 0.04–0.42 с через `exponentialRampToValueAtTime`; лёгкий сдвиг тона вниз к концу, фильтр 1800–3600 Гц; master volume `SOUND_MASTER_VOLUME = 0.62`, громкости пресетов снижены до 0.030–0.060. Резкие square/sawtooth заменены на sine/triangle.
- Трансферные слухи: `generateTransferRumor(force)` — отдельный seeded-RNG `matchSeed([...,'rumor',season,week])`, свой кулдаун `worldState.rumorUntil` (1–2 недели, шанс 70%). Цель — клиент агентства (70%) или свободный агент; клуб из той же лиги. Новость «📣 {club} проявляет интерес к вашему клиенту {player}» / «...к свободному агенту...». Вызывается в `playRegularWeek` после `simulateWorldEvents`; основной sim-RNG не тратится.
- Баннеры: `showWorldToast()` + `#world-toast-wrap` (нижний правый угол, NEON RINK: срезанные углы, неоновая рамка, прогресс-бар 5.2 с, клик закрывает, максимум 3, `aria-live`). Банкротство/увольнение/арена показывают «Внимание: ...», общий тост подавлен через `addNews(..., silent=true)`, чтобы не дублировать.
- CSS: `#world-toast-wrap`, `.world-toast`, `.world-toast-ico/-body/-title/-text/-bar`, варианты negative/positive, мобильная ширина, prefers-reduced-motion.
- i18n: +8 ключей ru/en (баннеры и слухи).
- Тесты: tests/world-events.test.mjs расширен до 17 — фейковый AudioContext проверяет GainNode+low-pass+ramp и master volume < 0.8; NEON-баннер в DOM; слух с новостью и нулевыми sim-бросками; кулдаун 1–2 недели.
- Хуки __HL: + rumorNow/rumorUntilProbe/worldToastCount/worldToastTexts/soundMasterProbe/setAudioContextForTest.
- Проверка: test:unit 204/204 (26 файлов), test:season 1/1, tsc 0, build 0. Статус: ОК.

# Этап: v1.1 B12 — очередь модальных окон
- В очередь кладётся функция отрисовки (`queueEventModal(render)`), а не готовая разметка: второй билдер не перезаписывает DOM первой модалки. `eventModalQueue` + `eventModalBusy`; `closeEventModal()` снимает busy и через `setTimeout(0)` запускает следующую.
- На очередь переведены все окна `#event-modal`: `openSimpleInfoModal`, `showChainStage` (ивенты с выбором), `showPoachingEvent`, `openTransferOfferModal`, `showPassiveOffer`, `showContractRenewalModal` (каждая разделена на публичную очередь-обёртку и `render*`).
- Блокировки: пока открыт `event-modal` или `negotiation-modal`, очередь ждёт; `closeNegotiationModal()` возобновляет её. Это не ломает телефонные ивенты (event-modal → negotiation-modal) и выборы с кнопками.
- Все прямые закрытия `eventModal.style.display='none'` (кнопки выбора/OK, смена на переговоры, Android BACK) переведены на `closeEventModal()`. `resetGame()` очищает очередь.
- Тесты: tests/modal-queue.test.mjs (2) — 3 модалки подряд: в DOM видна только первая, pending=2; после OK открывается вторая, затем третья; модалка с выбором закрывается своей кнопкой и не блокирует очередь.
- Хуки __HL: + modalQueueState/queueInfoModalForTest/closeEventModalForTest/resetModalQueueForTest.
- Проверка: test:unit 206/206 (27 файлов), test:season 1/1, tsc 0, build 0. Статус: ОК.

# Этап: v1.1.1 — закрытие блоков B/C и баланса (21.11.2026)
- Блок B: B6 (КЧ по престижу в первый сезон), B8 (карточка «Продолжить» читает rosterNames), B10 (getCareerGoalMoney — одна сумма для UI и начисления), B11 (escapeHtml + имена по убыванию длины одним regex, офисный мини-фид тоже), B13 (кубок совета по championsHistory), B15 (сила клуба от состава: топ-6 полевых 55%, средний рейтинг 20%, лучший вратарь 25%; форма ±5%, травмы до −10%), B16 (удалены 33 дубля из datapack_rosters.js), B17 (паддинг и rebalanceClubRosters по медиане состава ±6).
- Баланс: Б1 — пороги XP [0…120K/250K/400K] + awardWeeklyClientXP (голы 10, ассисты 6, игры 2; вратари — рейтинг/пропущенные; 0 RNG-бросков); Б2 — налог 0.15%/нед от 500K + 100K×(level−1), цели бизнеса $25M/$75M; Б3 — шанс события после кулдауна 0.35; Б5 — ICE_HL 12 клубов + фейковые названия; Б4 осознанно оставлен (104 матча).
- Блок C: C1/C11 — PNG-иконки (180/192/512/maskable) через System.Drawing; C2 — viewport-fit=cover + safe-area-inset для экранов/nav/pagination/модалок; C3 — -webkit-backdrop-filter везде; C4 — все 17 модалок в BACK_HANDLERS; C5 — ординалы 1st/2nd/3rd/th в обе стороны; C6 — обратные паттерны place/place of; C7 — кэш cyrKeys; C8/C9 — перевод только затронутых поддеревьев + очередь pendingRoots; C10 — SKIP_WAITING, offline.html, cacheKeyFor без query; C13 — role/aria-modal/подписи/фокус-трап; C14 — глобальный Escape; C15 — OG/Twitter + обложка 1200×630.
- Документация: README/маршрутный лист обновлены, package.json 1.1.1, CACHE_NAME hockey-legend-v1.1.1.
- Тесты: добавлен tests/roadmap-block-bc.test.mjs (19). Итог: test:unit 225/225 (28 файлов), test:season 1/1, tsc 0, build 0. Статус: ОК.
- Хуки __HL: + xpThresholdsProbe/weeklyEventChanceProbe/wealthTaxProbe/awardWeeklyXPForTest/careerGoalMoneyProbe/careerGoalProbe/worldCupTeamsNow/clubStrengthProbe/refreshStrengthsNow/teamInjuryPenaltyProbe/setPlayerInjuryForTest/setClubFormForTest/escapeHtmlProbe/checkTaskProgressNow/backHandlersProbe/topModalProbe/closeTopModalNow/modalA11yProbe/continueClientsProbe/newsRenderProbe/setChampionForTest/setPlayerRatingForTest/clubPrestigeProbe/clubPlayersProbe/leagueClubsProbe/rebalanceRostersNow.


# Батч 1: события, недельные решения и UX
- Реализован недельный цикл президента: 4 курса недели + 3 брифинга + 1 событие. Без подтверждения решений кнопка «Играть неделю» ведёт на экран «Решения» и не прокручивает неделю.
- Добавлено 31 событие (E00–E30) и 11 брифингов в src/features/president/events.js. У каждого события 2–4 варианта, видимая цена, минимум одно отложенное последствие (1–5 недель), chance для рискованных исходов.
- Отложенные последствия хранятся в presidentDecisions.delayed и разрешаются при смене недели; рискованные — детерминированным seeded-RNG.
- Проверка доминирования: нет варианта, который строго лучше другого по cash/trust/fans/dressing/prestige/conflict с учётом ожидаемых отложенных эффектов.
- Первый вход в президентство: онбординг-модалка (роль, мандат, 3 решения, обратимость), затем экран решений. Первая неделя гарантированно даёт 3 решения: курс, брифинг, событие E00.
- UI: вкладка «Решения» в хабе клуба и нижней навигации; карточка «Решения недели» на обзоре; дашборд обзора — 6 виджетов + футер (≤7); «Почему?»-тултипы для баланса, ведомости, фанатов, раздевалки, престижа.
- Шрифты: проверка исходников на U+FFFD; HUD-шрифт имеет кириллический fallback (Segoe UI/Noto Sans/Arial/system-ui).
- Сейв: presidentDecisions добавлен в save/load с нормализацией и дефолтами для старых сейвов; сбрасывается при уходе с поста.
- Тесты: tests/president-events.test.mjs — 11 тестов (контент, доминирование, первый цикл, рендер, ≤7 виджетов, кириллица).
- Проверка: test:unit 236/236, test:season 1/1, tsc 0, build 0.

# Батч 2: экономика, баланс и ИИ
- Пункт 3: замкнутый контур «деньги → штат/трансферы → сила → результат → фанаты → деньги». Сила клуба учитывает уровни training/medical/scouting; форма клуба обновляется только по реальным результатам матчей (случайный form-бросок убран); фанаты зависят от результатов/престижа и повышают билетную выручку; у президента результат двигает недельную шкалу фанатов.
- Пункт 4: 4 тактики (balanced/attack/defense/physical) в src/features/economy/balance.js. Курс недели президента превращается в тактику матча. Monte Carlo 2000 матчей: ни одна тактика не превышает 70% побед, тактики различимы, прогон детерминирован.
- Пункт 6: после сезона выставляется грейд S/A/B/C/D/F по месту, задачам совета и финансам; считается конкретный бюджет на следующий сезон (потолок 2× выручки) и показывается в обзоре клуба. История отзывов сохраняется.
- Пункт 7: увольнение советом возвращает в агентство без потери денег/клиентов/акций; warm-up 2–8 недель (seeded-RNG), блокирует повторное президентство, сохраняется в сейве.
- Пункт 10: касса клуба ограничена 2× годовой выручки; избыток выводится собственникам. Решение совета (approveClubCashCap) может временно поднять потолок. Проверен прогон 5 сезонов.
- Пункт 14: ИИ-клубы reinvestируют бюджет в инфраструктуру/штат (деньги → сила), президентский клуб не получает автоматических апгрейдов и скрытого бонуса силы без выбранного курса.
- Сейв: clubFinance, seasonReviews, presidentWarmup добавлены в корень сейва с нормализацией; PackedClub/PackedPlayer не менялись.
- Хуки __HL: + economyTickNow/economyProbe/economySeasonsNow/clubFanbaseProbe/clubAnnualRevenueProbe/clubCashCapProbe/approveCashCapNow/enforceCashCapNow/seasonReviewNow/seasonReviewProbe/setClubSeasonPlaceForTest/presidentWarmupProbe/dismissPresidentNow/clearPresidentWarmupForTest/aiUpgradesNow/tacticsProbe/tacticsMonteCarlo/tacticWinRate/tacticForStanceNow/presidentTacticProbe/gradeSeasonProbe/nextSeasonBudgetProbe/cashCapProbe/setPresidentFansForTest/applyResultForTest.
- Тесты: tests/economy-ai-batch2.test.mjs (13). Итог: test:unit 249/249 (30 файлов), test:season 1/1, tsc 0, build 0. Статус: ОК.

# Батч 3: бывший клиент, миграция сейва, детерминизм, локализация
- Пункт 9: бывший клиент — реальная сделка с измеряемой скидкой и риском. При вступлении в должность клиенты замороженного агентства попадают в `presidentDecisions.formerClients`; глобальная история `formerClientNames` переживает save/load и фиксируется при уходе/переманивании/завершении карьеры. `getFormerClientDeal()` считает рыночную цену (от рейтинга), скидку 15–35% (от лояльности), экономию и риск аудита 10–40; `commitFormerClientSigning` переводит игрока в клуб, начисляет conflict и пишет новость. Событие E15 и брифинг `former_client` собираются динамически (`buildFormerClientOffer`), показывают точные цифры и блокируются при лимите.
- Лимиты строгие и централизованы: `FORMER_CLIENT_SEASON_LIMIT = 2`, `FORMER_CLIENT_TERM_LIMIT = 4`; проверка до применения эффектов, один бывший клиент за неделю, GM-вариант тоже считается. Счётчики сбрасываются по сезону и по сроку полномочий; при лимите событие/брифинг не выдаются, кнопка disabled.
- Пункт 11: `presidentState`/`presidentDecisions` нормализуются с явным `loadedPresidentClubKey` до восстановления глобального ключа; поддержан старый алиас `presidentState`, сохраняются meters/log/delayed/cooldowns/formerClients/лимиты. Сейв без состояния получает безопасный default для действующего клуба. Порядок загрузки не меняет поведение КЧ/биржи.
- Пункт 12: убран `Math.random` из runtime-симуляции: `sim-random` по умолчанию использует фиксированный seeded-поток, `generateAttributes` без имени — seeded от позиции/рейтинга, мир новой игры сеется `matchSeed([agent,agency,'game',season])`. Аудит расширен на `script.js`, датапаки и все `src/**/*.{js,ts}` (с вырезанием комментариев). Полный сезон по-прежнему воспроизводим.
- Пункт 15: добавлены `src/features/president/events-i18n.js` (566 EN-ключей: все события, брифинги, курсы, отложенные последствия, тактики) и `src/features/president/ui-i18n.js` (президентский UI, инфраструктура, отчёты, динамические сделки). i18n.js импортирует словари и добавляет RU-identities для обратного перевода DOM. Логика президента/экономики переведена на `LANG.t`/`presidentFormat`; события рендерятся через `LANG.t`.
- Тесты: tests/batch3.test.mjs (7) — измеримость сделки, лимиты 2/4 и сброс по сезону, миграция `presidentState` без потери данных, default без состояния, детерминизм атрибутов, полнота EN-перевода событий, перевод через LANG. Обновлён determinism-audit (runtime-модули).
- Хуки __HL: + formerClientDealProbe/formerClientSignNow/formerClientLimitsProbe/setFormerClientSigningsForTest/setFormerClientsForTest/presidentStateProbe/presidentEventProbe.
- Проверка: test:unit 257/257 (31 файл), test:season 1/1, tsc 0, build 0. Формат PackedPlayer/PackedClub/v23 не изменён. Статус: ОК.

# Этап: интерактивные туториалы агента и президента (21.11.2026)
- Добавлен `src/features/tutorial/TutorialManager.js`: движок шагов, сценарии `agent`/`president`, ожидание кнопки «Далее» или клика по подсвеченному элементу, `waitFor`-события, затемняющий оверлей, spotlight-рамка и неоновая карточка с «Далее»/«Пропустить».
- Флаги `tutorialAgentDone`/`tutorialPresidentDone` живут в `gameSettings` (localStorage `hockeyLegendSettings`), сохраняются через `saveSettings`. `start()` не запускает сценарий после флага; «Пропустить» и завершение всех шагов ставят только соответствующий флаг.
- Агент (5 шагов): приветствие → база талантов (`[data-nav="clients"]`) → «Играть неделю» (`#btn-play-week`) → агентство (`[data-nav="agency"]`) → переговоры. Шаг 5 ждёт событие `negotiation`; `renderNegotiationModal` вызывает `notifyTutorial('negotiation')`, затем подсвечивается первый `.neg-range` в конструкторе контракта.
- Президент (5 шагов): приветствие → экран клуба (`#club-hub-screen .mobile-header`) → инфраструктура (`[data-chub="upgrade"]`) → симуляция матчей (`#setting-match-view-full`, на шаге открывается модалка настроек) → совет директоров (`[data-chub="decisions"]`). Запуск: после онбординга первой покупки 51% (кнопка «Стать президентом»), повторно не запускается.
- Все тексты вынесены в `i18n.js` (ru/en, ~19 ключей на язык). CSS NEON RINK: `.tutorial-overlay/.tutorial-shade/.tutorial-spotlight/.tutorial-card/.tutorial-btn`, адаптив ≤480px, prefers-reduced-motion.
- Тесты: tests/tutorial.test.mjs (7) — агент и президент стартуют один раз, клик по spotlight переводит шаг, шаг переговоров ждёт событие (в т.ч. пришедшее заранее), завершение ставит флаг, «Пропустить» ставит только нужный флаг, состав/таргеты 5 президентских шагов.
- Хуки __HL: + tutorialState/startTutorialForTest/skipTutorialNow/nextTutorialNow/notifyTutorialForTest/setTutorialFlagForTest/maybeStartPresidentTutorialForTest.
- Проверка: test:unit 264/264 (32 файла), test:season 1/1, tsc 0, build 0. Формат сейва не изменён. Статус: ОК.

# QA v1.2 — глобальная проверка навигации/логики/экономики (22.11.2026)
- Критический баг подтверждён: Президент → Состав → игрок → «Назад» → офис агента.
- Причина 1: `#player-back` подписывался на исходную `closePlayerScreen`, а позднее переопределение функции (`_origClosePlayerScreen`) слушатель не заменяло.
- Причина 2: `buildRosterRow` (состав президента) сбрасывал `playerReturnContext = null`.
- Фикс: единая `closePlayerScreen` с ветками `president-club` / `pch` / `club` / `national` / `screen`; возврат в `club-hub-screen` через `showPresidentClubHub()` с сохранением вкладки; позднее переопределение удалено.
- Дополнительно найдено и исправлено:
  - Публичный хаб терял вкладку и экран-источник после карточки игрока (передавались `public-club-hub-screen` вместо исходных значений).
  - Прямой просмотр матча из расписания всегда вёл в офис; теперь возврат на экран-источник (лига/хаб/офис).
  - Карточка игрока из новостей, лидерборда, активных обещаний и «Все предложения» вела в клиентов/офис; добавлен контекст `screen`.
  - Экономика: покупка акций принимала введённое вручную количество > лимита 100% (дивиденды росли сверх доли) — добавлена проверка лимита/денег и clamp.
  - Старые/повреждённые сейвы с долей >100% нормализуются (`normalizePortfolio`).
  - Повторная подпись уже подписанного свободного агента дублировала клиента и начисляла XP/счётчики — добавлен guard и скрытие кнопки.
  - `requestPlayWeek` не был защищён от double-click из хаба президента (риск двойного тика экономики) — lock перенесён внутрь функции.
- Новый тест: `tests/navigation-return.test.mjs` (2) — президентский состав → карточка → хаб президента; публичный хаб → карточка → хаб/вкладка/источник. На baseline-коде тесты падают.
- Хуки __HL: + `navProbe`, `openPublicClubHubForTest`, `setClubHubTabForTest`.
- Проверка: test:unit 266/266 (33 файла), test:season 1/1, tsc 0, build 0. Статус: ОК.

# v1.2 «Lean Agency» — экономика событий, 2 клиента, групповая тренировка (22.11.2026)
- Экономика событий вынесена в `src/features/economy/event-rewards.js`: капы наград по уровню агента (1–3 → $500, 4–6 → $5K, 7–9 → $15K, 10–14 → $35K, 15–19 → $75K, 20+ → $150K).
- Критический фикс: расходы больше не масштабируются (списываются по номиналу), вложенные в событие деньги возвращаются полностью, прибыль сверху ограничена капом. XP за событие — до 100 на ур. 1–3. Логика применена и к событиям, и к этапам цепочек; в цепочках `invested` копится и возвращается при выводе.
- Пул событий: у «жирных» событий добавлен `minLevel` (спонсоры, допинг, налоговая, инсайд, документалка, Кубок мира, сборная и т.д.); цепочки с крупными суммами не стартуют на ранних уровнях.
- Старт: `seedStartingClients()` создаёт 2 клиентов (полевой + вратарь) в МХЛ. `getSlots() = 1 + upgrades.office` → 2 слота на старте; первый апгрейд офиса стоит $1 500 и открывает 3-й слот.
- Тренировки: `groupTrainingAttr` + `setGroupTraining(attr)` — один атрибут на всех клиентов, автостарт блоков; сохраняется в сейве (`groupTrainingAttr`), старые сейвы читаются с `null`. Новые клиенты автоматически подхватывают групповой режим.
- UI: экран агентства по умолчанию показывает групповую тренировку и офис; остальные карточки — по кнопке «Все улучшения». Версия в футере/титуле — `v1.2` из константы `VERSION = '1.2.0'`.
- Тесты: `tests/v1.2-lean-agency.test.mjs` (8) — версия, 2 стартовых клиента/2 слота, дешёвый офис → 3 слота, кап $500 на ур. 1, возврат вложенных денег, `minLevel` жирных событий, упрощённый экран, групповая тренировка. `training-balance` изолирован от денежных наград карьерных целей.
- Проверка: test:unit 275/275 (35 файлов), test:season 1/1, tsc 0, build 0. Статус: ОК.

# v1.2.1 «Единое окно игрока» — ребаланс скаутинга, вкладка «Диалог», чистые агентства (22.11.2026)
- Скаутинг: `getScoutingRatingRange()` жёстко привязан к `upgrades.scouting`. Ур.1 → рейтинг 18–53 (потолок ≤55), 70+ появляются примерно с 13 уровня (формула до 88 на ур.25). Сильные новички больше не выпадают на старте.
- Экран «Рейтинг агентств» стал информационным: `openNpcAgency` показывает только репутацию, бюджет и клиентов. Удалены `openPoachDialog`, `resolvePoach`, клики/счётчики попыток/замки и модалка `poach-dialog-modal`.
- Карточка игрока: 5-я вкладка `playerTab = 'dialogue'` («Диалог»). Статусы:
  - нет агентства → «Предложить контракт» + мини-диалог (ползунок подъёмных, обещания);
  - чужое агентство → «Переманить», шанс от разницы репутаций и уровня «Переговорщика» + качество пакета;
  - свой клиент → текущие условия контракта и «Разорвать контракт» (освобождает слот, `agentId = null`).
- UI NEON RINK: `.dlg-*` (hero, статусы, сравнение репутаций, контракт, chance-card, неоновый range, promise-чипы), адаптив ≤400px. Модалка `player-dialogue-modal` зарегистрирована в BACK_HANDLERS.
- i18n: ru/en ключи для вкладки, диалога, обещаний, ошибок и результатов.
- Тесты: `tests/v1.2.1-player-dialogue.test.mjs` (8) — скаутинг ур.1 ≤55, 70+ только при прокачке, кнопка «Предложить контракт» у свободного агента, «Переманить» у чужого, условия + «Разорвать контракт» у своего, ползунок/обещания в мини-диалоге, рост шанса от разницы репутаций, информационная карточка NPC-агентства.
- Хуки __HL: + setScoutingLevelForTest/scoutingRangeProbe/createTestFreeAgent/createTestAgencyPlayer/openPlayerForTest/setPlayerTabForTest/playerDialogueProbe/dialoguePoachChanceProbe/signFreeAgentNow/attemptPoachNow/releaseClientNow/openNpcAgencyForTest.
- Проверка: test:unit 282/282 (35 файлов), test:season 1/1, tsc 0, build 0. Статус: ОК.

# v1.2.2 «NEON RINK Polish» — рейтинг, старт и обучение (22.11.2026)
- Рейтинг агентств: своё агентство встроено в общий список `renderRatingTab`, сортируется по тем же фильтрам (репутация/клиенты/бюджет), строка выделена лаймовой неоновой рамкой, бейджем «ТЫ» и свечением.
- UI: для `.agency-row`, `.talent-card`, `.npc-client-row` добавлены clip-path со срезанными углами, градиентные поверхности, hover-glow, блик-свайп и плавное появление (`hl-hud-appear`); у карточек FA появился лаймовый бейдж. prefers-reduced-motion отключает анимации.
- Ребаланс старта: `getScoutingRatingRange()` на ур.1 скаутинга даёт 28–48 (было 18–53); свободные агенты из `generateFreeAgentProfile` и `generateFreeAgentYouth` создаются как FA без клуба и с `contractYears = 0`, `agentId = null`.
- Туториал агента — 4 шага: «Клиенты» → карточка игрока с FA → вкладка «Диалог»/«Предложить контракт» → «Играть неделю». Добавлен `advanceOn: 'client-signed'`: клик по кнопке скрывает оверлей, шаг завершается после реального подписания; офис для шага недели открывается после закрытия модалки.
- Хуки __HL: + renderAgencyRatingForTest/freeAgentContractProbe; generateFreeAgentWindow отдаёт club/contractYears/agentId.
- Тесты: `tests/v1.2.2-polish.test.mjs` (3) — ур.1 ≤48, FA без клубного контракта, своя строка в рейтинге; `tests/tutorial.test.mjs` обновлён под 4 шага и advanceOn.
- Проверка: `npm test` 285/285 (37 файлов), tsc 0, build 0. Статус: ОК.

# v1.2.3 «Фиксы UX патча v1.2.2» — рейтинг, клиенты NPC, старт, обучение (22.11.2026)
- Рейтинг агентств: `.agency-row` больше не сжимается как flex-item внутри `.mobile-content` (`flex: 0 0 auto`), колонка имени `minmax(0, 1fr)`, имя/мета обрезаются через ellipsis, блок статистики зафиксирован (`flex-shrink: 0`, tabular-nums). Строки списка снова отображают название, репутацию, клиентов и бюджет без схлопывания.
- Клиенты чужого агентства: у `.npc-client-row` появился `data-npc-client` и обработчик клика; открывается карточка игрока (`openPlayerScreen`) сразу на вкладке «Диалог», модалка агентства закрывается, возврат ведёт на экран агентства. Курсор строки — pointer.
- Стартовые 2 клиента (`seedStartingClients`): создаются как свободные агенты с `club = null`, `contractYears = 0`, `agentId = -1`, `isScouted = true`, рейтинг 44/42 (диапазон 40–48), без клубной зарплаты/контракта.
- Обучение: `resetGame()` принудительно сбрасывает `gameSettings.tutorialAgentDone` и `tutorialPresidentDone`, сохраняет настройки; новая карьера снова запускает туториал агента.
- Проверка: `npm test` 285/285 (37 файлов), `npm run typecheck` 0, `npm run build` 0. Статус: ОК.

# v1.2.3 «Шанс подписания + финансовая история» (22.11.2026)
- Шаг 1: в конструкторе контракта появился блок `#neg-chance` («Шанс подписания», прогресс-бар + %). `getContractSuccessChance(player, offer)` вызывает `evaluateContractPackage(..., 'club')` и учитывает бюджет пакета (годовая ЗП + подписной бонус + комиссия). Цвета: >75% — зелёный (лайм), 40–75% — жёлтый (янтарь), <40% — красный. При превышении бюджета — «Превышен бюджет!» и 0%. `updateNegotiationChance` вызывается на каждое событие `input` ползунков (ЗП/срок/комиссия/бонусы/гарантии).
- Шаг 2: `financeHistory = []` в корне сейва, лимит `FINANCE_HISTORY_LIMIT = 100` (старые записи удаляются). `logTransaction(type, amount, reason)` пишет `{season, week, type: 'income'|'expense', amount, reason}`; `applyMoney(delta, reason)` — централизованная точка изменения `agentMoney` + лог. Переведены комиссии, зарплаты/пассивный доход, налог, дивиденды, тренировки, апгрейды, трансферы/переманивание, подписные бонусы, задачи/штрафы, спонсоры, биржа, события и цепочки (нетто-сумма после `settleEventMoney`), медали сборной.
- Шаг 3: в хабе «Моё агентство» новая вкладка «Финансы» (`data-atab="finance"`). `renderFinanceTab`: сводка доходов/расходов/баланса и список NEON RINK — слева причина + сезон/неделя, справа сумма (зелёная с «+» / красная с «−»). Стили `.finance-*`, адаптив ≤420px.
- Шаг 4: `tests/v1.2.3-finance.test.mjs` (5) — input на ползунке ЗП обновляет `#neg-chance` и цвет; «Превышен бюджет!»; лимит 100 записей; save/load истории; вкладка «Финансы» и разметка строк.
- Хуки __HL: + contractChanceProbe/logTransaction/financeHistoryProbe/clearFinanceHistoryForTest/financeTabHTMLForTest.
- Версия: `VERSION = '1.2.3'`, package.json/package-lock 1.2.3, `CACHE_NAME = hockey-legend-v1.2.3`. Формат PackedPlayer/PackedClub/v23 не изменён.
- Проверка: test:unit 289/289 (37 файлов), test:season 1/1, tsc 0, build 0. Статус: ОК.

# v1.3 «Карьера глубже» — Зал Славы, лиговые рекорды, достижения (22.11.2026)
- Данные — только в корне сейва: `agencyHall`, `leagueRecords`, `achievements`, `seasonGoalie`. `PackedPlayer` (33)/`PackedClub` (17)/v23 не менялись, `SAVE_KEY` прежний. Старые сейвы получают виртуальную историю лиг и снимки текущих клиентов.
- Зал Славы агентства: снимок карьеры (`buildHallEntry`) при refresh активных, увольнении (`removeClientFromRoster`), переманивании и пенсии (`processRetirements` — до удаления из `players`). Хранит сезоны, пик рейтинга, GP/G/A/P, лучшие сухари/сейвы, трофеи, награды, клубы; `legacyScore` = очки + голы×1.5 + трофеи×40 + награды×15 + рейтинг×2 + рекорды×50. Лимит 72, дедуп по имени.
- Лиговые рекорды: `updateLeagueRecords()` в конце `awardEndOfSeason()` (stats ещё живые), идемпотентно по `updatedSeason`. 13 лиг × 5 таблиц: голы, передачи, очки, сухие игры, сейвы; топ-10, только улучшение, клуб+сезон. Маркер «ВАШ КЛИЕНТ» — динамический (`isMyClientName` = roster + hall).
- Вратари: `seasonGoalie {gp,saves,shutouts}` обновляется в `simulateMatchWithDetails` и `simulateWeekForPlayer`; сейвы считаются детерминированно (без новых `simRandom`) — season-regression не сдвинут. Сбрасывается в `resetWorldPlayerStats`.
- Достижения: 39 ачивок в 6 категориях (деньги, карьера, лига/рекорды, трофеи, интриги, наследие). `checkAchievements()` идемпотентен, ретро-активен при load (silent), хуки — `updateAllDisplays` и конец сезона. Награды: XP/титул/репутация + деньги ≤ $50K, без слотов. Лиговые: «Первопроходец», «Король снайперов», «Маэстро передач», «Легенда лиги», «Стена», «Полный комплект», «Мировой рекордсмен», «Снайпер», «Сухой сезон».
- UI: новый экран `hall-of-fame-screen` (плитка офиса «Зал Славы»), 3 вкладки — Агентство / Лиги / Достижения; подиум топ-3, карточки клиентов с аватарами, 5 таблиц рекордов с чипами лиг, сетка достижений с прогрессом и фильтрами, модалка карьеры (`hall-client-modal`, в `BACK_HANDLERS`). Деплинк «Рекорды лиги →» во вкладке истории лиги и бейдж рекордов в истории игрока. NEON RINK-классы `.hlf-*` (без конфликта с `.hall-of-fame/.hof-*`). i18n RU/EN ~150 ключей.
- Версия: `VERSION = '1.3.0'`, package.json/package-lock 1.3.0, `CACHE_NAME = hockey-legend-v1.3.0`, about-тег v1.3.
- Тесты: `tests/v1.3-hall-of-fame.test.mjs` (16) — виртуальные рекорды 13 лиг, топ-10/улучшение, вратарские таблицы, маркер клиента, снимок при уходе, модалка, каталог 30–40, ретро/идемпотентность, лимит $50K, save/load/reset, UI/CSS/i18n. Обновлён `v1.2-lean-agency` под версию 1.3.
- Хуки __HL: + leagueRecordsProbe/updateLeagueRecordsNow/seedLeagueRecordsForTest/setPlayerSeasonStatsForTest/setGoalieSeasonStatsForTest/seasonGoalieProbe/agencyHallProbe/syncAgencyHallNow/upsertHallNow/hallEntryProbe/removeClientNow/achievementsProbe/checkAchievementsNow/achievementValueProbe/achievementCatalogProbe/resetAchievementsForTest/setCareerCountersForTest/hallScreenHTMLForTest/setHallTabForTest.
- Проверка: test:unit 305/305 (38 файлов), test:season 1/1, tsc 0, build 0. Статус: ОК.