// ============================================================
// Модель данных игры (типы — единственный источник истины).
// Форматы сохранения (Packed*) менять только аддитивно:
// старые сейвы должны продолжать загружаться.
// ============================================================

export type Position = 'G' | 'D' | 'C' | 'LW' | 'RW';

export interface PlayerStats {
    gp: number;
    goals: number;
    assists: number;
    pim: number;
    plusMinus: number;
    ratingSum: number;
    goalsAgainst: number;
}

export interface SeasonHistoryEntry {
    season: number;
    club: string;
    league: string;
    gp: number;
    goals: number;
    assists: number;
    avgRating: number;
    rating: number;
    goalsAgainst: number;
    gaa: number | string;
    pim: number;
    plusMinus: number;
    salary: number;
    age: number;
    position: Position | string;
}

export interface PlayerAttributes {
    attack: number;
    defense: number;
    technique: number;
    psyche: number;
    physics: number;
    speed: number;
}

export interface Player {
    name: string;
    nationality: string | null;
    club: string;
    league: string;
    position: Position | string;
    age: number;
    rating: number;
    potential: number;
    form: number;
    injuryWeeks: number;
    loyalty: number;
    clubLoyalty: number;
    lastTransferSeason: number;
    contractYears: number;
    declinedRenewal: boolean;
    trophies: string[];
    awards: string[];
    character: string;
    agentId: string | null;
    draftInfo: string;
    draftYear: number;
    isScouted: boolean;
    trainingWeeks: number;
    trainingAttr: string | null;
    youngMilestones: Record<string, boolean>;
    cost: number;
    salary: number;
    attributes: PlayerAttributes;
    stats: PlayerStats;
    seasonHistory: SeasonHistoryEntry[];
}

/** Упакованный игрок: кортеж из 33 полей (см. packPlayer). */
export type PackedPlayer = [
    string, string, string, string, number, number, number, number, number, number,
    number, number, number, number, number, number, number,
    unknown[],
    number, number, boolean,
    string[], string[],
    string,
    string | null,
    number,
    string,
    number,
    string | null,
    boolean,
    number,
    string | null,
    string
];

/** Упакованная история сезона: 15 значений (см. packPlayer). */
export type PackedSeason = [
    number, string, string, number, number, number, number, number,
    number, number | string, number, number, number, number, string
];

export interface ClubUpgrades {
    stadium: number;
    marketing: number;
    medical: number;
    training: number;
    scouting: number;
    academy: number;
}

export interface Club {
    club: string;
    league: string;
    prestige: number;
    budget: number;
    upgrades: ClubUpgrades;
    founded: number;
    titles: number;
    legends: unknown[];
    bestSeasons: unknown[];
    form: unknown[];
    stockPrice: number;
    stockHistory: number[];
    sharesTotal: number;
    weeklyIncome: number;
    weeklyExpenses: number;
    weeklyResult: number;
    _wasInDebt: boolean;
}

/** Упакованный клуб: 17 полей (см. packClub). */
export type PackedClub = [
    string, string, number, number, number[],
    number, number, unknown[], unknown[], unknown[], number, number[],
    number, number, number, number, boolean
];

/**
 * Полный сейв (v23). Список полей соответствует saveGame().
 * Все поля, кроме v/players, терпимы к отсутствию в старых сейвах.
 */
export interface SaveData {
    v: number;
    t: number;
    agentName: string;
    agencyName: string;
    agencyCountry: string;
    agencyFlag: string;
    money: number;
    s: number;
    w: number;
    upgrades: Record<string, number>;
    rosterNames: string[];
    news: unknown[];
    standings: Record<string, any[]>;
    teamStrengths: Record<string, unknown>;
    npcAgencies: unknown[];
    clubs: Record<string, PackedClub>;
    portfolio: Record<string, unknown>;
    agentXP: number;
    agentLevel: number;
    transferOffers: Record<string, unknown>;
    activeCommissions: unknown[];
    pendingClubReturn: unknown[];
    playerNegotiations: Record<string, unknown>;
    poachedPlayersThisSeason: Record<string, unknown>;
    agencyPoachAttempts: Record<string, unknown>;
    closedAgencies: Record<string, unknown>;
    phase: string;
    phaseWeeks: number;
    playoffState: Record<string, unknown>;
    playoffRound: number;
    championsHistory: Record<string, any>;
    presidentClubKey: string | null;
    seasonSchedule: Record<string, any[]>;
    clubSeasonPositions: Record<string, unknown>;
    clubCouncil: unknown;
    careerGoals: Record<string, number>;
    careerCounters: Record<string, number>;
    activeTasks: unknown[];
    eventCooldowns: Record<string, unknown>;
    eventHistory: unknown[];
    weeklyEventCounter: number;
    lastEventWeek: number;
    activeChains: unknown[];
    npcCooldownWeeks: number;
    lostPlayerThisSeason: boolean;
    worldCupState: any;
    nationalTournament: unknown;
    nationalTournamentHistory: unknown[];
    favoriteNationalTeam: unknown;
    datapackActive: boolean;
    pendingEventId: string | null;
    pendingEventPlayer: string | null;
    draftData: unknown;
    players: PackedPlayer[];
    lastDraft?: unknown[];
}
