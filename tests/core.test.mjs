// ============================================================
// Юнит-тесты чистого ядра: RNG, атрибуты, зарплаты, упаковка сейва.
// Эти функции перенесены из script.js без изменения поведения —
// тесты фиксируют это поведение, чтобы дальнейший рефакторинг был безопасным.
// ============================================================
import { describe, expect, it } from 'vitest';
import { hashString, makeSeededRNG } from '../src/core/rng';
import { generateAttributes } from '../src/core/attributes';
import { calculateSalary, calculateSalaryCap, formatSalary, getLeagueSalaryCap } from '../src/core/salary';
import { packClub, packPlayer, unpackClub, unpackPlayer } from '../src/core/pack';

function makePlayer(overrides = {}) {
    return {
        name: 'Иван Петров',
        nationality: 'RU',
        club: 'Boston Bruins',
        league: 'NHL',
        position: 'C',
        age: 24,
        rating: 78,
        potential: 88,
        form: 3,
        injuryWeeks: 0,
        loyalty: 80,
        clubLoyalty: 40,
        lastTransferSeason: 2025,
        contractYears: 2,
        declinedRenewal: false,
        trophies: ['Кубок Стэнли'],
        awards: ['MVP'],
        character: 'calm',
        agentId: 'me',
        draftInfo: '#12 2024',
        draftYear: 2024,
        isScouted: true,
        trainingWeeks: 2,
        trainingAttr: 'attack',
        youngMilestones: { first_goal: true, all_star: false },
        stats: { gp: 60, goals: 20, assists: 30, pim: 12, plusMinus: 8, ratingSum: 430, goalsAgainst: 0 },
        seasonHistory: [
            {
                season: 2025, club: 'Boston Bruins', league: 'NHL', gp: 70, goals: 18, assists: 25,
                avgRating: 7.1, rating: 76, goalsAgainst: 0, gaa: '—', pim: 10, plusMinus: 4,
                salary: 900, age: 23, position: 'C'
            }
        ],
        ...overrides
    };
}

describe('rng', () => {
    it('детерминирован по seed', () => {
        const a = makeSeededRNG(42);
        const b = makeSeededRNG(42);
        const seqA = [a(), a(), a()];
        const seqB = [b(), b(), b()];
        expect(seqA).toEqual(seqB);
        expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true);
    });

    it('hashString стабилен и неотрицателен', () => {
        expect(hashString('Иван Петров_C')).toBe(hashString('Иван Петров_C'));
        expect(hashString('abc')).toBeGreaterThanOrEqual(0);
    });
});

describe('generateAttributes', () => {
    it('детерминирован по имени и позиции', () => {
        expect(generateAttributes('C', 80, 'Тест Тестов')).toEqual(generateAttributes('C', 80, 'Тест Тестов'));
    });

    it('все значения в диапазоне 1..100', () => {
        for (const pos of ['G', 'D', 'C']) {
            const attrs = generateAttributes(pos, 95, 'Игрок ' + pos);
            for (const v of Object.values(attrs)) {
                expect(v).toBeGreaterThanOrEqual(1);
                expect(v).toBeLessThanOrEqual(100);
            }
        }
    });

    it('вратарь слабее в скорости и атаке, сильнее в защите', () => {
        const g = generateAttributes('G', 80, 'Goalie');
        const c = generateAttributes('C', 80, 'Center');
        expect(g.speed).toBeLessThan(c.speed);
        expect(g.attack).toBeLessThan(c.attack);
        expect(g.defense).toBeGreaterThan(c.defense);
    });
});

describe('зарплаты', () => {
    it('растут с рейтингом', () => {
        let prev = 0;
        for (let r = 1; r <= 99; r += 3) {
            const s = calculateSalary(r);
            expect(s).toBeGreaterThanOrEqual(prev);
            prev = s;
        }
    });

    it('ограничены потолком лиги', () => {
        expect(calculateSalary(99, 'MHL')).toBe(getLeagueSalaryCap('MHL'));
        expect(calculateSalary(99, 'NHL')).toBeLessThanOrEqual(getLeagueSalaryCap('NHL'));
        expect(calculateSalary(50, 'NHL')).toBeLessThan(getLeagueSalaryCap('NHL'));
    });

    it('calculateSalaryCap не меньше обычной зарплаты', () => {
        expect(calculateSalaryCap(80, 'KHL')).toBeGreaterThanOrEqual(calculateSalary(80, 'KHL'));
    });

    it('formatSalary', () => {
        expect(formatSalary(500)).toBe('$500K');
        expect(formatSalary(1500)).toBe('$1.5M');
    });
});

describe('packPlayer / unpackPlayer', () => {
    it('кортеж содержит 33 поля', () => {
        expect(packPlayer(makePlayer()).length).toBe(33);
    });

    it('roundtrip сохраняет ключевые поля', () => {
        const p = makePlayer();
        const restored = unpackPlayer(JSON.parse(JSON.stringify(packPlayer(p))));

        expect(restored.name).toBe(p.name);
        expect(restored.club).toBe(p.club);
        expect(restored.league).toBe(p.league);
        expect(restored.position).toBe(p.position);
        expect(restored.age).toBe(p.age);
        expect(restored.rating).toBe(p.rating);
        expect(restored.potential).toBe(p.potential);
        expect(restored.loyalty).toBe(p.loyalty);
        expect(restored.clubLoyalty).toBe(p.clubLoyalty);
        expect(restored.contractYears).toBe(p.contractYears);
        expect(restored.agentId).toBe(p.agentId);
        expect(restored.draftInfo).toBe(p.draftInfo);
        expect(restored.nationality).toBe(p.nationality);
        expect(restored.isScouted).toBe(true);
        expect(restored.trainingAttr).toBe('attack');
        expect(restored.stats).toEqual(p.stats);
        expect(restored.trophies).toEqual(p.trophies);
        expect(restored.seasonHistory[0].season).toBe(2025);
        expect(restored.seasonHistory[0].position).toBe('C');
        // атрибуты не хранятся, а пересчитываются детерминированно
        expect(restored.attributes).toEqual(generateAttributes('C', 78, 'Иван Петров'));
    });

    it('youngMilestones сериализуются только включённые', () => {
        const restored = unpackPlayer(packPlayer(makePlayer()));
        expect(restored.youngMilestones.first_goal).toBe(true);
        expect(restored.youngMilestones.all_star).toBeUndefined();
    });

    it('пустые/старые сейвы получают безопасные значения', () => {
        const minimal = [
            'Игрок', 'Клуб', 'NHL', 'C', 20, 60, 0, 0, 0, 100,
            0, 0, 0, 0, 0, 0, 0,
            [],
            0, 1, false, [], [], 'calm', null, 0, '', 0, null, false, 0, null, ''
        ];
        const restored = unpackPlayer(minimal);
        expect(restored.potential).toBe(70);      // rating + 10
        expect(restored.loyalty).toBe(100);
        expect(restored.clubLoyalty).toBe(0);
        expect(restored.contractYears).toBe(1);
        expect(restored.salary).toBeGreaterThan(0);
        expect(restored.seasonHistory).toEqual([]);
    });
});

describe('packClub / unpackClub', () => {
    it('roundtrip сохраняет апгрейды и экономику', () => {
        const club = {
            club: 'Boston Bruins',
            league: 'NHL',
            prestige: 88,
            budget: 123456,
            upgrades: { stadium: 7, marketing: 6, medical: 5, training: 8, scouting: 9, academy: 4 },
            founded: 1924,
            titles: 6,
            legends: ['Bobby Orr'],
            bestSeasons: [],
            form: [1, 0, 1],
            stockPrice: 120,
            stockHistory: [110, 120],
            sharesTotal: 100,
            weeklyIncome: 5000,
            weeklyExpenses: 4000,
            weeklyResult: 1000,
            _wasInDebt: false
        };
        const packed = packClub(club);
        expect(packed.length).toBe(17);
        expect(unpackClub(packed)).toEqual(club);
    });
});
