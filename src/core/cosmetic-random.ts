// ============================================================
// RNG для косметики (анимации, снежинки).
//
// Отдельный поток: визуальные эффекты не должны сдвигать
// последовательность симуляции. Seed фиксирован, поэтому
// косметика воспроизводима и не зависит от Math.random().
// ============================================================
import { hashString, makeSeededRNG, type Rng } from './rng';

const DEFAULT_SEED = hashString('cosmetic|snowflakes');
let impl: Rng = makeSeededRNG(DEFAULT_SEED);

export function cosmeticRandom(): number {
    return impl();
}

export function cosmeticInt(min: number, max: number): number {
    return Math.floor(cosmeticRandom() * (max - min + 1)) + min;
}

export function cosmeticChoice<T>(arr: T[]): T {
    return arr[Math.floor(cosmeticRandom() * arr.length)];
}

/** Сброс косметического потока (детерминированно, без Math.random). */
export function resetCosmeticRandom(seed: number = DEFAULT_SEED): void {
    impl = makeSeededRNG(seed >>> 0);
}
