// ============================================================
// Атрибуты игрока. Детерминированы по имени+позиции:
// сохранение их не хранит, они пересчитываются при загрузке.
// ============================================================
import { hashString, makeSeededRNG } from './rng';
import type { PlayerAttributes } from './types';

const clamp = (n: number) => Math.max(1, Math.min(100, n));

export function generateAttributes(
    position: string,
    rating: number,
    name?: string | null
): PlayerAttributes {
    const rng = name ? makeSeededRNG(hashString(name + '_' + position)) : Math.random;
    const v = () => Math.round((rng() - 0.5) * 16);

    if (position === 'G') {
        return {
            attack: clamp(rating - 30 + v()),
            defense: clamp(rating + 5 + v()),
            technique: clamp(rating + v()),
            psyche: clamp(rating + v()),
            physics: clamp(rating + v()),
            speed: clamp(rating - 15 + v())
        };
    }
    if (position === 'D') {
        return {
            attack: clamp(rating - 15 + v()),
            defense: clamp(rating + 5 + v()),
            technique: clamp(rating - 5 + v()),
            psyche: clamp(rating + v()),
            physics: clamp(rating + v()),
            speed: clamp(rating - 5 + v())
        };
    }
    return {
        attack: clamp(rating + 5 + v()),
        defense: clamp(rating - 15 + v()),
        technique: clamp(rating + v()),
        psyche: clamp(rating + v()),
        physics: clamp(rating - 5 + v()),
        speed: clamp(rating + 5 + v())
    };
}
