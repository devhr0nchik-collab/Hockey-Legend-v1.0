// ============================================================
// Зарплаты и потолки лиг (чистая математика, без DOM).
// ============================================================

export const LEAGUE_SALARY_CAPS: Record<string, number> = {
    NHL: 15000,
    AHL: 700,
    KHL: 3500,
    SHL: 900,
    Liiga: 600,
    NL_Switzerland: 1000,
    Czech_Extraliga: 600,
    DEL: 550,
    ICE_HL: 400,
    VHL: 120,
    Belarus_Extraliga: 150,
    MHL: 25,
    Belarus_Vysshaya: 15
};

export function getLeagueSalaryCap(leagueKey: string): number {
    return LEAGUE_SALARY_CAPS[leagueKey] || 1000000;
}

/** Базовая зарплата по рейтингу, ограниченная потолком лиги. */
export function calculateSalary(rating: number, league?: string | null): number {
    let base: number;
    if (rating <= 30) base = 30 + rating * 5;
    else if (rating <= 50) base = 180 + (rating - 30) * 20;
    else if (rating <= 70) base = 580 + (rating - 50) * 60;
    else if (rating <= 85) base = 1780 + (rating - 70) * 150;
    else base = 4030 + (rating - 85) * 300;

    if (!league) return base;
    return Math.min(base, getLeagueSalaryCap(league));
}

export function calculateSalaryCap(rating: number, league: string): number {
    const cappedRating = Math.min(100, rating + 20);
    return calculateSalary(cappedRating, league);
}

export function formatSalary(k: number): string {
    if (k >= 1000) return '$' + (k / 1000).toFixed(1) + 'M';
    return '$' + k + 'K';
}
