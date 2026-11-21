// ============================================================
// Блок A роудмапа (hockey-legend-roadmap.md): регрессия A1–A8.
// A1 — старение один раз за сезон; A2 — сброс lostPlayerThisSeason;
// A3 — деньги NPC-переманивания в долларах (×1000 из тысяч);
// A4 — совет не сбрасывается при reload с постом; A5 — оценка совета
// на границе сезона и снятие за 3 провала; A6 — контракты клиентов
// списываются один раз, FA не получают мгновенный контракт;
// A7 — отставки без «призраков»; A8 — молодёжь пополняет NHL/AHL/KHL.
// ============================================================
import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const INDEX_HTML = readFileSync(join(process.cwd(), 'index.html'), 'utf8');

beforeAll(async () => {
    window.matchMedia = window.matchMedia || ((query) => ({
        matches: false, media: query, onchange: null,
        addListener() {}, removeListener() {},
        addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; }
    }));

    const body = INDEX_HTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    document.body.innerHTML = body[1].replace(/<script[\s\S]*?<\/script>/gi, '');

    await import('../i18n.js');
    await import('../datapack_rosters.js');
    await import('../script.js');
    await import('../datapack.js');

    document.getElementById('btn-new-game').click();
    document.getElementById('ca-name').value = 'Блок А';
    document.getElementById('ca-agency').value = 'Block A Agency';
    document.getElementById('ca-start').click();
});

describe('A1: старение клиентов', () => {
    it('клиент и мир стареют ровно на 1 год за сезон (один проход)', () => {
        window.__HL.addClient('A1 Клиент');
        const worldName = window.__HL.firstWorldPlayerName();
        const clientBefore = window.__HL.playerContractProbe('A1 Клиент');
        const worldBefore = window.__HL.playerContractProbe(worldName);

        window.__HL.setSeed(101);
        window.__HL.advanceSeasonAgesNow();

        const clientAfter = window.__HL.playerContractProbe('A1 Клиент');
        const worldAfter = window.__HL.playerContractProbe(worldName);
        expect(clientAfter.age).toBe(clientBefore.age + 1);
        expect(worldAfter.age).toBe(worldBefore.age + 1);
    });
});

describe('A2: флаг потери клиента', () => {
    it('сбрасывается на границе сезона и в resetGame', () => {
        window.__HL.setLostPlayerThisSeason(true);
        expect(window.__HL.npcPoachFlags().lostPlayerThisSeason).toBe(true);

        const season0 = window.__HL.getState().currentSeason;
        window.__HL.setPhaseForTest('transfer_off', 1);
        window.__HL.setSeed(202);
        window.__HL.playPhaseTick(); // конец большого ТО → новый сезон

        expect(window.__HL.getState().currentSeason).toBe(season0 + 1);
        expect(window.__HL.npcPoachFlags().lostPlayerThisSeason).toBe(false);

        window.__HL.setLostPlayerThisSeason(true);
        window.__HL.resetGame();
        expect(window.__HL.npcPoachFlags().lostPlayerThisSeason).toBe(false);
    });
});

describe('A3: деньги NPC-переманивания', () => {
    it('«Отпустить» платит компенсацию в долларах (тысячи × 1000)', () => {
        window.__HL.completeCareerGoalsForTest();
        window.__HL.addClient('A3 Отпустить');
        const p = window.__HL.playerContractProbe('A3 Отпустить');
        const compK = Math.round(p.salary * 0.1);
        window.__HL.setMoneyForTest(0);
        expect(window.__HL.showPoachingEventNow('A3 Отпустить', p.salary + 400, compK)).toBe(true);

        document.querySelector('#event-actions .btn-warning').click();

        expect(window.__HL.getState().agentMoney).toBe(compK * 1000);
        expect(window.__HL.getState().roster).not.toContain('A3 Отпустить');
        const agency = window.__HL.npcAgentClientIds(0);
        expect(agency.clientIds).toContain('A3 Отпустить');
    });

    it('«Удержать» списывает стоимость в долларах и поднимает зарплату', () => {
        window.__HL.addClient('A3 Удержать');
        const p = window.__HL.playerContractProbe('A3 Удержать');
        const newSalaryK = p.salary + 400;
        const costK = Math.round((newSalaryK - p.salary) * 0.25); // 100 (тыс.)
        window.__HL.setMoneyForTest(costK * 1000);
        window.__HL.showPoachingEventNow('A3 Удержать', newSalaryK, 10);

        document.querySelector('#event-actions .btn-success').click();

        expect(window.__HL.getState().agentMoney).toBe(0);
        const after = window.__HL.playerContractProbe('A3 Удержать');
        expect(after.salary).toBe(newSalaryK);
        expect(after.inRoster).toBe(true);
    });

    it('не хватает денег — удержание не списывает тысячи как доллары', () => {
        window.__HL.addClient('A3 Бедный');
        const p = window.__HL.playerContractProbe('A3 Бедный');
        window.__HL.setMoneyForTest(99999); // < 100K стоимости удержания
        window.__HL.showPoachingEventNow('A3 Бедный', p.salary + 400, 10);

        document.querySelector('#event-actions .btn-success').click();

        expect(window.__HL.getState().agentMoney).toBe(99999);
        const after = window.__HL.playerContractProbe('A3 Бедный');
        expect(after.salary).toBe(p.salary);
        expect(after.inRoster).toBe(true);
    });
});

describe('A4: совет директоров при перезагрузке', () => {
    it('пост и совет сохраняются при reload, сбрасываются только при потере 51%', async () => {
        const st = window.__HL.setPresidentForTest(null, 60);
        expect(st.presidentClubKey).toBeTruthy();
        expect(st.clubCouncil).toBeTruthy();

        await window.__HL.saveGame();
        await new Promise((r) => setTimeout(r, 100));
        const ok = await window.__HL.loadGame();
        expect(ok).toBe(true);

        const after = window.__HL.councilState();
        expect(after.presidentClubKey).toBe(st.presidentClubKey);
        expect(after.clubCouncil).toEqual(st.clubCouncil);

        // Продажа акций ниже 51% — совет сбрасывается при загрузке.
        const data = JSON.parse(JSON.stringify(window._lastSaveData));
        data.portfolio[st.presidentClubKey].shares = 40;
        await window.__HL.importSaveData(data);
        const lost = window.__HL.councilState();
        expect(lost.presidentClubKey).toBeNull();
        expect(lost.clubCouncil).toBeNull();
    });
});

describe('A5: оценка задач совета', () => {
    it('до границы сезона оценка не срабатывает (защита от двойного зачёта)', () => {
        window.__HL.setPresidentForTest(null, 60);
        const before = window.__HL.councilState();
        window.__HL.evaluateCouncilSeasonNow();
        expect(window.__HL.councilState()).toEqual(before);
    });

    it('3 провала подряд на границе сезона снимают с поста', () => {
        window.__HL.setPresidentForTest(null, 60);
        const cs = window.__HL.councilState();
        window.__HL.patchCouncilForTest({
            failsStreak: 2,
            tasks: cs.clubCouncil.tasks.map(t => ({ ...t, done: false }))
        });
        const season0 = window.__HL.getState().currentSeason;
        window.__HL.setPhaseForTest('transfer_off', 1);
        window.__HL.setSeed(303);
        window.__HL.playPhaseTick(); // currentSeason++ → evaluateCouncilSeason

        expect(window.__HL.getState().currentSeason).toBe(season0 + 1);
        const after = window.__HL.councilState();
        expect(after.presidentClubKey).toBeNull();
        expect(after.clubCouncil).toBeNull();
    });

    it('все задачи выполнены — лояльность растёт, совет пересоздаётся на новый сезон', () => {
        window.__HL.setPresidentForTest(null, 60);
        const cs = window.__HL.councilState();
        window.__HL.patchCouncilForTest({
            loyalty: 70, failsStreak: 1,
            tasks: cs.clubCouncil.tasks.map(t => ({ ...t, done: true }))
        });
        const season0 = window.__HL.getState().currentSeason;
        window.__HL.setPhaseForTest('transfer_off', 1);
        window.__HL.setSeed(304);
        window.__HL.playPhaseTick();

        const after = window.__HL.councilState();
        expect(after.presidentClubKey).toBe(cs.presidentClubKey);
        expect(after.clubCouncil.season).toBe(season0 + 1);
        expect(after.clubCouncil.loyalty).toBe(80);
        expect(after.clubCouncil.failsStreak).toBe(0);
        const hist = after.clubCouncil.history;
        expect(hist[hist.length - 1]).toEqual({ season: season0, done: cs.clubCouncil.tasks.length, total: cs.clubCouncil.tasks.length });
    });
});

describe('A6: контракты конца сезона', () => {
    it('контракт клиента списывается один раз, бонусы не сбрасываются', () => {
        window.__HL.addClient('A6 Два Года');
        window.__HL.setPlayerContract('A6 Два Года', { contractYears: 2, goalBonus: 5000, guaranteedYears: 2 });
        window.__HL.addClient('A6 Три Года');
        window.__HL.setPlayerContract('A6 Три Года', { contractYears: 3, goalBonus: 3000, guaranteedYears: 1 });

        window.__HL.setSeed(404);
        window.__HL.endOfSeasonContractsNow();

        const two = window.__HL.playerContractProbe('A6 Два Года');
        expect(two.contractYears).toBe(1); // двойное списание дало бы 0 → случайное продление
        expect(two.goalBonus).toBe(5000);
        expect(two.guaranteedYears).toBe(1);
        expect(two.club).toBeTruthy();
        expect(two.inRoster).toBe(true);

        const three = window.__HL.playerContractProbe('A6 Три Года');
        expect(three.contractYears).toBe(2);
        expect(three.goalBonus).toBe(3000);
    });

    it('клиент с последним годом становится FA и НЕ получает мгновенный контракт', () => {
        window.__HL.addClient('A6 Последний Год');
        window.__HL.setPlayerContract('A6 Последний Год', { contractYears: 1, goalBonus: 7000, guaranteedYears: 1 });

        window.__HL.setSeed(405);
        window.__HL.endOfSeasonContractsNow();

        const fa = window.__HL.playerContractProbe('A6 Последний Год');
        expect(fa.club).toBe('');
        expect(fa.contractYears).toBe(0);
        expect(fa.salary).toBe(25);
        expect(fa.goalBonus).toBe(0);
        expect(fa.inRoster).toBe(true);
    });

    it('мир продлевает контракты игроков без клуба-клиента', () => {
        const worldName = window.__HL.firstWorldPlayerName();
        window.__HL.setPlayerContract(worldName, { contractYears: 1 });

        window.__HL.setSeed(406);
        window.__HL.endOfSeasonContractsNow();

        const w = window.__HL.playerContractProbe(worldName);
        expect(w.club).toBeTruthy();
        expect(w.contractYears).toBeGreaterThanOrEqual(1);
        expect(w.contractYears).toBeLessThanOrEqual(4);
    });
});

describe('A8: пополнение молодёжи', () => {
    it('NHL/AHL/KHL получают юниоров напрямую из ключей YPS', () => {
        const before = window.__HL.worldLeagueProbe();
        window.__HL.setSeed(606);
        window.__HL.replenishYouthNow();
        const after = window.__HL.worldLeagueProbe();

        const minYoung = { NHL: 8, AHL: 10, KHL: 15 };
        for (const lk of ['NHL', 'AHL', 'KHL']) {
            expect(after[lk].count).toBeGreaterThan(before[lk].count);
            expect(after[lk].young - before[lk].young).toBeGreaterThanOrEqual(minYoung[lk]);
        }
    });
});

describe('A7: отставки', () => {
    it('один бросок на игрока — myRoster и players синхронны, без призраков', () => {
        window.__HL.addClient('A7 Ветеран');
        const before = window.__HL.getState().playersCount;
        window.__HL.agePlayersForTest(40); // все ≥ 34 → шанс отставки 0.5
        window.__HL.setSeed(505);
        const r = window.__HL.retirementsNow();

        expect(r.ghosts).toEqual([]);
        expect(r.playersCount).toBeLessThan(before); // отставки реально происходят
        expect(r.rosterSize).toBeLessThanOrEqual(r.playersCount);
        // Все оставшиеся клиенты присутствуют в мире.
        const probe = window.__HL.playerContractProbe('A7 Ветеран');
        if (probe) expect(probe.inRoster).toBe(true);
    });
});
