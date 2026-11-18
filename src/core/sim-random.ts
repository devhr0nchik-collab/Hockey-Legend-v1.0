// ============================================================
// RNG для игровой симуляции.
//
// Отдельный от Math.random поток: косметика (анимации, снежинки)
// не должна влиять на результаты матчей. По умолчанию обёртка
// использует Math.random, поэтому поведение не меняется, пока
// симуляция явно не засеяна через setSimulationSeed().
// ============================================================
import { makeSeededRNG, type Rng } from './rng';

let impl: Rng = Math.random;
let seed = 0;
let seeded = false;

export function setSimulationSeed(value: number): void {
    seed = value >>> 0;
    seeded = true;
    impl = makeSeededRNG(seed);
}

export function isSimulationSeeded(): boolean {
    return seeded;
}

export function getSimulationSeed(): number {
    return seed;
}

export function simRandom(): number {
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
