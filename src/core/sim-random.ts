// ============================================================
// RNG для игровой симуляции.
//
// Отдельный от косметики поток: анимации не влияют на результаты.
// До явного setSimulationSeed() используется ФИКСИРОВАННЫЙ
// детерминированный поток — Math.random в симуляции запрещён.
// ============================================================
import { makeSeededRNG, type Rng } from './rng';

const DEFAULT_SIM_SEED = 0x4d595df4;
let impl: Rng = makeSeededRNG(DEFAULT_SIM_SEED);
let seed = DEFAULT_SIM_SEED;
let seeded = false;
let draws = 0;

export function setSimulationSeed(value: number): void {
    seed = value >>> 0;
    seeded = true;
    draws = 0;
    impl = makeSeededRNG(seed);
}

/** Сколько чисел сгенерировано с последнего seed (диагностика/тесты). */
export function getSimulationDraws(): number {
    return draws;
}

export function isSimulationSeeded(): boolean {
    return seeded;
}

export function getSimulationSeed(): number {
    return seed;
}

export function simRandom(): number {
    draws++;
    return impl();
}

export function simInt(min: number, max: number): number {
    return Math.floor(simRandom() * (max - min + 1)) + min;
}

export function simChoice<T>(arr: T[]): T {
    return arr[Math.floor(simRandom() * arr.length)];
}

/**
 * Seed матча: одинаковые лига/команды/сезон/неделя/агентство дают
 * одинаковый результат, но разные сохранения играют по-разному.
 */
export function matchSeed(parts: Array<string | number>): number {
    let h = 0;
    const s = parts.join('|');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
}
