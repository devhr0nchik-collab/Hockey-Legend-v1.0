// ============================================================
// Упаковка/распаковка сущностей для сохранения.
// Формат — кортежи фиксированной длины (компактно для IndexedDB).
// ВАЖНО: менять только аддитивно (в конец), старые сейвы должны читаться.
// ============================================================
import { generateAttributes } from './attributes';
import { calculateSalary } from './salary';
import type {
    Club,
    PackedClub,
    PackedPlayer,
    PackedSeason,
    Player,
    SeasonHistoryEntry
} from './types';

export function packPlayer(p: Player): PackedPlayer {
    const safeLoyalty = Math.max(0, Math.min(100, p.loyalty ?? 100));
    const safeClubLoyalty = Math.max(0, Math.min(100, p.clubLoyalty ?? 0));
    const hist: PackedSeason[] = (p.seasonHistory || []).slice(-20).map((s) => [
        s.season, s.club, s.league, s.gp, s.goals, s.assists, s.avgRating, s.rating,
        s.goalsAgainst || 0, s.gaa || '—',
        s.pim || 0, s.plusMinus || 0, s.salary || 0, s.age || 0, s.position || p.position
    ]);

    return [
        p.name, p.club, p.league, p.position, p.age, p.rating, p.potential, p.form, p.injuryWeeks,
        safeLoyalty,
        p.stats.gp, p.stats.goals, p.stats.assists, p.stats.pim, p.stats.plusMinus,
        p.stats.ratingSum, p.stats.goalsAgainst,
        hist,
        p.lastTransferSeason || 0, p.contractYears ?? 1, p.declinedRenewal || false,
        (p.trophies || []).slice(-10), (p.awards || []).slice(-10),
        p.character || 'calm', p.agentId,
        safeClubLoyalty, p.draftInfo || '', p.draftYear || 0,
        p.nationality || null, p.isScouted || false,
        p.trainingWeeks || 0, p.trainingAttr || null,
        p.youngMilestones
            ? Object.keys(p.youngMilestones).filter((k) => p.youngMilestones[k]).join(',')
            : ''
    ];
}

export function unpackPlayer(a: PackedPlayer | any[]): Player {
    const [
        name, club, league, position, age, rating, potential, form, injuryWeeks, loyaltyRaw,
        gp, goals, assists, pim, plusMinus, ratingSum, goalsAgainst, hist, lastTransferSeason,
        contractYears, declinedRenewal, trophies, awards, character, agentId, clubLoyaltyRaw,
        draftInfo, draftYear, nationality, isScouted, trainingWeeks, trainingAttr, milestonesRaw
    ] = a;

    const loyalty = Math.max(0, Math.min(100, loyaltyRaw ?? 100));
    const clubLoyalty = Math.max(0, Math.min(100, clubLoyaltyRaw ?? 0));

    const youngMilestones: Record<string, boolean> = {};
    String(milestonesRaw || '').split(',').forEach((k) => { if (k) youngMilestones[k] = true; });

    return {
        name,
        nationality: nationality || null,
        club,
        league,
        position,
        age,
        rating,
        potential: potential || rating + 10,
        isScouted: !!isScouted,
        trainingWeeks: trainingWeeks || 0,
        trainingAttr: trainingAttr || null,
        youngMilestones,
        form,
        injuryWeeks,
        loyalty,
        lastTransferSeason: lastTransferSeason || 0,
        contractYears: contractYears ?? 1,
        declinedRenewal: declinedRenewal || false,
        trophies: trophies || [],
        awards: awards || [],
        character: character || 'calm',
        agentId: agentId !== undefined ? agentId : null,
        clubLoyalty: clubLoyalty || 0,
        draftInfo: draftInfo || '',
        draftYear: draftYear || 0,
        cost: Math.max(100, (rating - 10) * 50),
        salary: club ? calculateSalary(rating, league) : 25,
        attributes: generateAttributes(position, rating, name),
        stats: { gp, goals, assists, pim, plusMinus, ratingSum, goalsAgainst },
        seasonHistory: (hist || []).map((h: any[]): SeasonHistoryEntry => ({
            season: h[0],
            club: h[1],
            league: h[2],
            gp: h[3],
            goals: h[4],
            assists: h[5],
            avgRating: h[6],
            rating: h[7] || rating,
            goalsAgainst: h[8] || 0,
            gaa: h[9] || '—',
            pim: h[10] || 0,
            plusMinus: h[11] || 0,
            salary: h[12] || 0,
            age: h[13] || 0,
            position: h[14] || position
        }))
    };
}

export function packClub(c: Club): PackedClub {
    return [
        c.club, c.league, c.prestige, c.budget,
        [c.upgrades.stadium, c.upgrades.marketing, c.upgrades.medical,
         c.upgrades.training, c.upgrades.scouting, c.upgrades.academy],
        c.founded, c.titles, c.legends, c.bestSeasons, c.form, c.stockPrice,
        (c.stockHistory || []).slice(-12),
        c.sharesTotal, c.weeklyIncome, c.weeklyExpenses, c.weeklyResult,
        c._wasInDebt || false
    ];
}

export function unpackClub(a: PackedClub | any[]): Club {
    const [club, league, prestige, budget, upArr, founded, titles, legends, bestSeasons, form,
        stockPrice, stockHistory, sharesTotal, weeklyIncome, weeklyExpenses, weeklyResult, wasInDebt] = a;

    return {
        club,
        league,
        prestige,
        budget,
        upgrades: {
            stadium: upArr[0] || 5,
            marketing: upArr[1] || 5,
            medical: upArr[2] || 5,
            training: upArr[3] || 5,
            scouting: upArr[4] || 5,
            academy: upArr[5] || 5
        },
        founded,
        titles,
        legends,
        bestSeasons,
        form,
        stockPrice,
        stockHistory,
        sharesTotal: sharesTotal || 100,
        weeklyIncome: weeklyIncome || 0,
        weeklyExpenses: weeklyExpenses || 0,
        weeklyResult: weeklyResult || 0,
        _wasInDebt: !!wasInDebt
    };
}
