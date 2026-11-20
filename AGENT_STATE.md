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
