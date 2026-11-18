// ============================================================
// Миграции сейва.
// Всё здесь — чистые функции над данными: без DOM и без состояния игры.
// Правило: миграция должна быть идемпотентной (повторный запуск не ломает сейв).
// ============================================================
import type { SaveData } from '../../core/types';

/** Текущая версия формата сохранения (поле `v`). */
export const SAVE_VERSION = 23;

export function isSaveData(value: unknown): value is SaveData {
    if (!value || typeof value !== 'object') return false;
    const v = value as Partial<SaveData>;
    return !!v.v && Array.isArray(v.players);
}

/**
 * Разбивает ключ вида "lk_club" на лигу и клуб.
 * Длинные ключи лиг проверяются первыми: в названиях есть "_"
 * (Belarus_Extraliga, NL_Switzerland, Czech_Extraliga).
 */
export function splitSaveKey(
    key: unknown,
    leagueKeys: string[]
): { lk: string; club: string } | null {
    if (!key || typeof key !== 'string') return null;

    const sorted = [...leagueKeys].sort((a, b) => b.length - a.length);
    for (const lk of sorted) {
        if (key.startsWith(lk + '_')) return { lk, club: key.substring(lk.length + 1) };
    }

    const idx = key.indexOf('_');
    if (idx < 0) return null;
    return { lk: key.substring(0, idx), club: key.substring(idx + 1) };
}

/**
 * Единая миграция переименований: map — словарь «старое имя → новое».
 * Покрывает всех, у кого в сейве лежит название клуба.
 */
export function migrateSaveWithMap<T extends Partial<SaveData> | null | undefined>(
    data: T,
    map: Record<string, string>,
    leagueKeys: string[]
): T {
    if (!data) return data;
    const d = data as any;
    const apply = (name: string | null | undefined) => (name && map[name]) ? map[name] : name;

    // players (упакованные): club на индексе 1, seasonHistory на индексе 17
    if (Array.isArray(d.players)) {
        d.players.forEach((p: any) => {
            if (!Array.isArray(p)) return;
            if (typeof p[1] === 'string') p[1] = apply(p[1]);
            if (Array.isArray(p[17])) {
                p[17].forEach((h: any) => {
                    if (Array.isArray(h) && typeof h[1] === 'string') h[1] = apply(h[1]);
                });
            }
        });
    }

    // standings
    if (d.standings) {
        Object.keys(d.standings).forEach((lk) => {
            (d.standings[lk] || []).forEach((t: any) => { if (t.club) t.club = apply(t.club); });
        });
    }

    // clubs — ключи вида "lk_club"
    if (d.clubs) {
        const newClubs: Record<string, unknown> = {};
        Object.keys(d.clubs).forEach((key) => {
            const parts = splitSaveKey(key, leagueKeys);
            if (!parts) { newClubs[key] = d.clubs[key]; return; }
            const newClub = apply(parts.club) as string;
            const c = d.clubs[key];
            if (Array.isArray(c)) c[0] = newClub;
            newClubs[parts.lk + '_' + newClub] = c;
        });
        d.clubs = newClubs;
    }

    // seasonSchedule
    if (d.seasonSchedule) {
        Object.keys(d.seasonSchedule).forEach((lk) => {
            (d.seasonSchedule[lk] || []).forEach((m: any) => {
                if (m.home) m.home = apply(m.home);
                if (m.away) m.away = apply(m.away);
            });
        });
    }

    // championsHistory
    if (d.championsHistory) {
        Object.keys(d.championsHistory).forEach((lk) => {
            (d.championsHistory[lk] || []).forEach((h: any) => {
                if (h.champion) h.champion = apply(h.champion);
                if (h.finalist) h.finalist = apply(h.finalist);
            });
        });
    }

    // clubSeasonPositions — ключи вида "lk_club"
    if (d.clubSeasonPositions) {
        const newPos: Record<string, unknown> = {};
        Object.keys(d.clubSeasonPositions).forEach((key) => {
            const parts = splitSaveKey(key, leagueKeys);
            if (!parts) { newPos[key] = d.clubSeasonPositions[key]; return; }
            newPos[parts.lk + '_' + (apply(parts.club) as string)] = d.clubSeasonPositions[key];
        });
        d.clubSeasonPositions = newPos;
    }

    // worldCupState
    if (d.worldCupState) {
        const wc = d.worldCupState;
        if (Array.isArray(wc.teams)) wc.teams.forEach((t: any) => { if (t.club) t.club = apply(t.club); });
        if (wc.teamLeague) {
            const tl: Record<string, unknown> = {};
            Object.keys(wc.teamLeague).forEach((k) => { tl[apply(k) as string] = wc.teamLeague[k]; });
            wc.teamLeague = tl;
        }
        if (wc.strengths) {
            const st: Record<string, unknown> = {};
            Object.keys(wc.strengths).forEach((k) => { st[apply(k) as string] = wc.strengths[k]; });
            wc.strengths = st;
        }
        if (wc.standings) {
            ['A', 'B'].forEach((conf) => {
                if (!wc.standings[conf]) return;
                const ns: Record<string, unknown> = {};
                Object.keys(wc.standings[conf]).forEach((k) => {
                    const row = wc.standings[conf][k];
                    if (row) row.club = apply(row.club || k);
                    ns[apply(k) as string] = row;
                });
                wc.standings[conf] = ns;
            });
        }
        if (wc.conferences) {
            ['A', 'B'].forEach((conf) => {
                if (Array.isArray(wc.conferences[conf])) {
                    wc.conferences[conf].forEach((t: any) => { if (t.club) t.club = apply(t.club); });
                }
            });
        }
        if (wc.playoff) {
            const fixSeries = (s: any) => {
                if (!s) return;
                if (s.teamA && s.teamA.club) s.teamA.club = apply(s.teamA.club);
                if (s.teamB && s.teamB.club) s.teamB.club = apply(s.teamB.club);
                if (s.winner && s.winner.club) s.winner.club = apply(s.winner.club);
            };
            if (Array.isArray(wc.playoff.series)) wc.playoff.series.forEach(fixSeries);
            if (Array.isArray(wc.playoff.history)) {
                wc.playoff.history.forEach((h: any) => {
                    if (Array.isArray(h.series)) h.series.forEach(fixSeries);
                });
            }
        }
        if (wc.champion && wc.champion.club) wc.champion.club = apply(wc.champion.club);
        if (Array.isArray(wc.history)) {
            wc.history.forEach((h: any) => {
                if (h.champion) h.champion = apply(h.champion);
                if (h.runnerUp) h.runnerUp = apply(h.runnerUp);
            });
        }
    }

    // lastDraft
    if (Array.isArray(d.lastDraft)) {
        d.lastDraft.forEach((a: any) => {
            if (Array.isArray(a) && typeof a[2] === 'string') a[2] = apply(a[2]);
        });
    }

    return data;
}

/**
 * Нормализация загруженного сейва: значения, появившиеся после старых версий.
 * Возвращает тот же объект (мутирует), чтобы вызывающий код сохранял поведение.
 */
export function normalizeLoadedSave(data: SaveData): SaveData {
    const d = (data || {}) as SaveData;

    if (!d.upgrades) {
        d.upgrades = { office: 1, scouting: 1, reveal: 1, youth: 1, negotiator: 1, reputation: 1, media: 1 };
    }
    // Карточка тренера появилась позже остальных
    if (d.upgrades.trainer === undefined) d.upgrades.trainer = 1;

    d.playoffRound = d.playoffRound ?? 0;
    if (d.playoffRound > 4) d.playoffRound = 1;

    return d;
}
