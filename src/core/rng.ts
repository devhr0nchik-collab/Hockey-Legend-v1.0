// ============================================================
// Детерминированный RNG.
// Симуляция должна воспроизводиться по seed — иначе её нельзя
// ни тестировать, ни балансировать. Math.random() — только для
// косметики (анимации, снежинки).
// ============================================================

export type Rng = () => number;

/** Стабильный числовой хеш строки (используется как seed). */
export function hashString(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(h);
}

/** LCG-генератор: одинаковый seed → одинаковая последовательность. */
export function makeSeededRNG(seed: number): Rng {
    let s = seed | 0;
    return function () {
        s = (s * 1664525 + 1013904223) | 0;
        return ((s >>> 0) / 4294967296);
    };
}
