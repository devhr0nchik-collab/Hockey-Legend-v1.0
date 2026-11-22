// ============================================================
// Батч 2: экономика, баланс тактик и оценка сезона.
// Чистые функции без DOM/глобального состояния — их удобно
// проверять Monte Carlo-тестами и переиспользовать в script.js.
// ============================================================
import { hashString, makeSeededRNG } from '../../core/rng';

export const CLUB_TACTICS = {
    balanced: { id: 'balanced', label: 'Сбалансированная', attack: 1.00, defense: 1.00, risk: 0.00 },
    attack:   { id: 'attack',   label: 'Атакующая',        attack: 1.10, defense: 0.94, risk: 0.05 },
    defense:  { id: 'defense',  label: 'Оборонительная',   attack: 0.93, defense: 1.08, risk: 0.00 },
    physical: { id: 'physical', label: 'Силовая',          attack: 1.03, defense: 1.01, risk: 0.08 }
};

export const TACTIC_IDS = Object.keys(CLUB_TACTICS);

export function getTacticMods(tacticId) {
    return CLUB_TACTICS[tacticId] || CLUB_TACTICS.balanced;
}

// Недельный курс президента — это и есть тактика на матч.
export function tacticForStance(stanceId) {
    switch (stanceId) {
        case 'result': return 'attack';
        case 'economy': return 'defense';
        case 'development': return 'physical';
        case 'fans':
        default: return 'balanced';
    }
}

function clamp01(value) {
    return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

// Monte Carlo по той же модели, что использует simulateMatchWithDetails:
// атака тактики повышает ожидаемые голы, оборона — снижает голы соперника.
// Возвращает winRate в процентах с одним знаком после запятой.
export function simulateTacticWinRate(tacticId, samples = 1200, options = {}) {
    const tactic = getTacticMods(tacticId);
    const count = Math.max(1, Math.round(Number(samples) || 1200));
    const strengthFor = Number.isFinite(options.strengthFor) ? options.strengthFor : 0.72;
    const strengthAgainst = Number.isFinite(options.strengthAgainst) ? options.strengthAgainst : 0.72;
    const rngSeed = options.seed || `tactic-mc|${tactic.id}|${count}|${strengthFor}|${strengthAgainst}`;
    const rng = makeSeededRNG(typeof rngSeed === 'number' ? rngSeed : hashString(String(rngSeed)));
    let wins = 0, losses = 0, draws = 0;
    for (let i = 0; i < count; i++) {
        const goalsFor = Math.max(0, Math.floor(rng() * 4 * strengthFor * tactic.attack + rng() * 3 - 0.5));
        const goalsAgainst = Math.max(0, Math.floor(rng() * 4 * strengthAgainst * (2 - tactic.defense) + rng() * 3 - 0.5));
        if (goalsFor > goalsAgainst) wins++;
        else if (goalsFor < goalsAgainst) losses++;
        else draws++;
    }
    return {
        tactic: tactic.id,
        label: tactic.label,
        samples: count,
        wins,
        losses,
        draws,
        winRate: Math.round((wins / count) * 1000) / 10
    };
}

export function runTacticsMonteCarlo(samples = 1200) {
    return TACTIC_IDS.map((id) => simulateTacticWinRate(id, samples));
}

const GRADE_THRESHOLDS = [
    { grade: 'S', min: 0.86 },
    { grade: 'A', min: 0.72 },
    { grade: 'B', min: 0.58 },
    { grade: 'C', min: 0.44 },
    { grade: 'D', min: 0.30 },
    { grade: 'F', min: 0 }
];

export function gradeSeason(input = {}) {
    const totalTeams = Math.max(1, Math.round(Number(input.totalTeams) || 1));
    const place = Number.isFinite(input.place) ? Math.max(1, Math.min(totalTeams, input.place)) : totalTeams;
    const tasksTotal = Math.max(0, Math.round(Number(input.tasksTotal) || 0));
    const tasksDone = Math.max(0, Math.min(tasksTotal, Math.round(Number(input.tasksDone) || 0)));
    const revenue = Math.max(0, Number(input.revenue) || 0);
    const expenses = Math.max(0, Number(input.expenses) || 0);

    const positionScore = clamp01((totalTeams - place + 1) / totalTeams);
    const taskScore = tasksTotal > 0 ? tasksDone / tasksTotal : 0.5;
    const margin = revenue > 0 ? (revenue - expenses) / revenue : 0;
    const financeScore = clamp01(0.5 + Math.max(-0.5, Math.min(0.5, margin)));

    let score = positionScore * 0.45 + taskScore * 0.35 + financeScore * 0.20;
    if (input.champion) score = Math.min(1, score + 0.12);
    else if (input.playoff) score = Math.min(1, score + 0.04);
    if (input.prestige >= 80 && place > totalTeams * 0.6) score = Math.max(0, score - 0.04);

    const grade = GRADE_THRESHOLDS.find((t) => score >= t.min)?.grade || 'F';
    return {
        grade,
        score: Math.round(score * 1000) / 1000,
        positionScore: Math.round(positionScore * 1000) / 1000,
        taskScore: Math.round(taskScore * 1000) / 1000,
        financeScore: Math.round(financeScore * 1000) / 1000,
        place,
        totalTeams,
        tasksDone,
        tasksTotal,
        revenue,
        expenses
    };
}

const GRADE_BUDGET_MULTIPLIER = {
    S: 1.20,
    A: 1.12,
    B: 1.05,
    C: 1.00,
    D: 0.93,
    F: 0.85
};

export function cashCapForRevenue(revenue) {
    const value = Math.max(0, Number(revenue) || 0);
    return Math.round(value * 2);
}

// Конкретный бюджет на следующий сезон: база от выручки/текущей кассы,
// множитель грейда и жёсткий потолок 2× выручки (п.10 чек-листа).
export function computeNextSeasonBudget(input = {}) {
    const revenue = Math.max(0, Number(input.revenue) || 0);
    const currentBudget = Math.max(0, Number(input.currentBudget) || 0);
    const leagueBudget = Math.max(0, Number(input.leagueBudget) || 0);
    const grade = String(input.grade || 'C').toUpperCase();
    const multiplier = GRADE_BUDGET_MULTIPLIER[grade] || 1;
    const base = Math.max(revenue * 0.60, currentBudget * 0.80, leagueBudget * 0.35, 1);
    const budget = Math.round(base * multiplier);
    return Math.max(0, Math.min(cashCapForRevenue(revenue), budget));
}
