// ============================================================
// Косметический RNG: детерминирован и не сдвигает поток симуляции.
// ============================================================
import { describe, expect, it } from 'vitest';
import { cosmeticRandom, resetCosmeticRandom } from '../src/core/cosmetic-random';
import { getSimulationDraws, setSimulationSeed, simRandom } from '../src/core/sim-random';

describe('cosmetic-random', () => {
    it('воспроизводим после сброса seed', () => {
        resetCosmeticRandom(42);
        const a = [cosmeticRandom(), cosmeticRandom(), cosmeticRandom()];
        resetCosmeticRandom(42);
        const b = [cosmeticRandom(), cosmeticRandom(), cosmeticRandom()];
        expect(b).toEqual(a);
    });

    it('не расходует числа симуляции', () => {
        setSimulationSeed(7);
        const before = getSimulationDraws();
        const expected = simRandom();
        const after = getSimulationDraws();

        for (let i = 0; i < 100; i++) cosmeticRandom();

        expect(getSimulationDraws()).toBe(after);
        expect(after).toBe(before + 1);

        setSimulationSeed(7);
        expect(simRandom()).toBe(expected);
        expect(getSimulationDraws()).toBe(before + 1);
    });
});
