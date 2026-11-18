// ============================================================
// Тесты миграций сейва: переименование клубов real↔fake и
// нормализация старых сохранений.
// ============================================================
import { describe, expect, it } from 'vitest';
import {
    SAVE_VERSION,
    isSaveData,
    migrateSaveWithMap,
    normalizeLoadedSave,
    splitSaveKey
} from '../src/features/save/migrations';

const LEAGUES = ['NHL', 'AHL', 'KHL', 'Belarus_Extraliga', 'NL_Switzerland', 'Czech_Extraliga', 'MHL'];

const MAP = {
    'Boston Bruins': 'Boston Bears',
    'Providence Bruins': 'Providence Foxes'
};

function makeSave() {
    return {
        v: 23,
        players: [
            ['Игрок', 'Boston Bruins', 'NHL', 'C', 20, 60, 70, 0, 0, 100,
             0, 0, 0, 0, 0, 0, 0,
             [[2025, 'Boston Bruins', 'NHL', 10, 1, 2, 7, 60, 0, '—', 0, 0, 0, 20, 'C']],
             0, 1, false, [], [], 'calm', null, 0, '', 0, null, false, 0, null, '']
        ],
        standings: { NHL: [{ club: 'Boston Bruins', points: 10 }, { club: 'Другой', points: 5 }] },
        clubs: {
            'NHL_Boston Bruins': ['Boston Bruins', 'NHL', 90, 1000],
            'Belarus_Extraliga_Минск': ['Минск', 'Belarus_Extraliga', 50, 100]
        },
        seasonSchedule: { NHL: [{ home: 'Boston Bruins', away: 'Providence Bruins' }] },
        championsHistory: { NHL: [{ champion: 'Boston Bruins', finalist: 'Providence Bruins' }] },
        clubSeasonPositions: { 'NHL_Boston Bruins': 1 },
        worldCupState: {
            teams: [{ club: 'Boston Bruins' }],
            teamLeague: { 'Boston Bruins': 'NHL' },
            strengths: { 'Boston Bruins': 88 },
            standings: { A: { 'Boston Bruins': { club: 'Boston Bruins', pts: 3 } } },
            conferences: { A: [{ club: 'Boston Bruins' }] },
            playoff: {
                series: [{ teamA: { club: 'Boston Bruins' }, teamB: { club: 'Providence Bruins' } }],
                history: [{ series: [{ winner: { club: 'Boston Bruins' } }] }]
            },
            champion: { club: 'Boston Bruins' },
            history: [{ champion: 'Boston Bruins', runnerUp: 'Providence Bruins' }]
        },
        lastDraft: [[1, 1, 'Boston Bruins', 'Игрок']]
    };
}

describe('splitSaveKey', () => {
    it('понимает лиги с подчёркиванием', () => {
        expect(splitSaveKey('Belarus_Extraliga_Минск', LEAGUES)).toEqual({ lk: 'Belarus_Extraliga', club: 'Минск' });
        expect(splitSaveKey('NL_Switzerland_ZSC Lions', LEAGUES)).toEqual({ lk: 'NL_Switzerland', club: 'ZSC Lions' });
    });

    it('обычные ключи', () => {
        expect(splitSaveKey('NHL_Boston Bruins', LEAGUES)).toEqual({ lk: 'NHL', club: 'Boston Bruins' });
    });

    it('невалидные ключи', () => {
        expect(splitSaveKey('', LEAGUES)).toBeNull();
        expect(splitSaveKey(null, LEAGUES)).toBeNull();
        expect(splitSaveKey('без разделителя', LEAGUES)).toBeNull();
    });
});

describe('isSaveData', () => {
    it('принимает валидный сейв', () => {
        expect(isSaveData(makeSave())).toBe(true);
    });

    it('отклоняет мусор', () => {
        expect(isSaveData(null)).toBe(false);
        expect(isSaveData({})).toBe(false);
        expect(isSaveData({ v: 23 })).toBe(false);
        expect(isSaveData({ v: 23, players: 'нет' })).toBe(false);
        expect(SAVE_VERSION).toBe(23);
    });
});

describe('migrateSaveWithMap', () => {
    it('переименовывает клуб игрока и историю сезонов', () => {
        const save = migrateSaveWithMap(makeSave(), MAP, LEAGUES);
        expect(save.players[0][1]).toBe('Boston Bears');
        expect(save.players[0][17][0][1]).toBe('Boston Bears');
    });

    it('переименовывает таблицы, расписание, чемпионов, позиции', () => {
        const save = migrateSaveWithMap(makeSave(), MAP, LEAGUES);
        expect(save.standings.NHL[0].club).toBe('Boston Bears');
        expect(save.seasonSchedule.NHL[0].home).toBe('Boston Bears');
        expect(save.seasonSchedule.NHL[0].away).toBe('Providence Foxes');
        expect(save.championsHistory.NHL[0].champion).toBe('Boston Bears');
        expect(save.clubSeasonPositions['NHL_Boston Bears']).toBe(1);
    });

    it('перестраивает ключи клубов и не ломает лиги с "_"', () => {
        const save = migrateSaveWithMap(makeSave(), MAP, LEAGUES);
        expect(save.clubs['NHL_Boston Bears'][0]).toBe('Boston Bears');
        expect(save.clubs['NHL_Boston Bruins']).toBeUndefined();
        expect(save.clubs['Belarus_Extraliga_Минск'][0]).toBe('Минск');
    });

    it('чинит worldCupState во всех вложенных местах', () => {
        const wc = migrateSaveWithMap(makeSave(), MAP, LEAGUES).worldCupState;
        expect(wc.teams[0].club).toBe('Boston Bears');
        expect(wc.teamLeague['Boston Bears']).toBe('NHL');
        expect(wc.strengths['Boston Bears']).toBe(88);
        expect(wc.standings.A['Boston Bears'].club).toBe('Boston Bears');
        expect(wc.conferences.A[0].club).toBe('Boston Bears');
        expect(wc.playoff.series[0].teamA.club).toBe('Boston Bears');
        expect(wc.playoff.history[0].series[0].winner.club).toBe('Boston Bears');
        expect(wc.champion.club).toBe('Boston Bears');
        expect(wc.history[0].champion).toBe('Boston Bears');
    });

    it('переименовывает lastDraft', () => {
        expect(migrateSaveWithMap(makeSave(), MAP, LEAGUES).lastDraft[0][2]).toBe('Boston Bears');
    });

    it('идемпотентна', () => {
        const once = migrateSaveWithMap(makeSave(), MAP, LEAGUES);
        const twice = migrateSaveWithMap(JSON.parse(JSON.stringify(once)), MAP, LEAGUES);
        expect(twice).toEqual(once);
    });

    it('не падает на старом/пустом сейве', () => {
        expect(migrateSaveWithMap(null, MAP, LEAGUES)).toBeNull();
        expect(migrateSaveWithMap({}, MAP, LEAGUES)).toEqual({});
    });
});

describe('normalizeLoadedSave', () => {
    it('добавляет карточку тренера и дефолтные апгрейды', () => {
        const d = normalizeLoadedSave({ v: 23, players: [] });
        expect(d.upgrades.trainer).toBe(1);
        expect(d.upgrades.office).toBe(1);
        expect(d.playoffRound).toBe(0);
    });

    it('сохраняет существующие значения', () => {
        const d = normalizeLoadedSave({
            v: 23, players: [],
            upgrades: { office: 5, trainer: 3 }, playoffRound: 2
        });
        expect(d.upgrades).toEqual({ office: 5, trainer: 3 });
        expect(d.playoffRound).toBe(2);
    });

    it('чинит выходящий за диапазон раунд плей-офф', () => {
        expect(normalizeLoadedSave({ v: 23, players: [], playoffRound: 9 }).playoffRound).toBe(1);
    });
});
