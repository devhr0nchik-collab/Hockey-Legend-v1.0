// ============================================================
// Атрибуты игрока. Детерминированы по имени+позиции:
// сохранение их не хранит, они пересчитываются при загрузке.
// Архетип тоже выводится из имени+позиции, поэтому сейв
// остаётся совместимым без новых полей.
// ============================================================
import { hashString, makeSeededRNG } from './rng';
import type { PlayerAttributes } from './types';

const clamp = (n: number) => Math.max(1, Math.min(100, n));

export type PlayerArchetype = 'sniper' | 'playmaker' | 'twoWay' | 'defensive' | 'goalie';

const FORWARD_ARCHETYPES: PlayerArchetype[] = ['sniper', 'playmaker', 'twoWay', 'defensive'];
const DEFENSE_ARCHETYPES: PlayerArchetype[] = ['defensive', 'twoWay', 'playmaker'];

/** Детерминированный архетип: одинаковое имя+позиция → одинаковый стиль. */
export function getPlayerArchetype(position: string, name?: string | null): PlayerArchetype {
    if (position === 'G') return 'goalie';
    const h = hashString((name || 'unknown') + '|' + position + '|archetype');
    const list = position === 'D' ? DEFENSE_ARCHETYPES : FORWARD_ARCHETYPES;
    return list[h % list.length];
}

const POSITION_BASE: Record<string, PlayerAttributes> = {
    G: { attack: -30, defense: 5, technique: 0, psyche: 0, physics: 0, speed: -15 },
    D: { attack: -15, defense: 5, technique: -5, psyche: 0, physics: 0, speed: -5 },
    F: { attack: 5, defense: -15, technique: 0, psyche: 0, physics: -5, speed: 5 }
};

const ARCHETYPE_MODS: Record<PlayerArchetype, PlayerAttributes> = {
    sniper:    { attack: 10, defense: -4, technique: 2, psyche: 0, physics: 0, speed: 2 },
    playmaker: { attack: 2, defense: -2, technique: 8, psyche: 2, physics: 0, speed: 1 },
    twoWay:    { attack: -2, defense: 8, technique: 2, psyche: 0, physics: 2, speed: 0 },
    defensive: { attack: -8, defense: 6, technique: 0, psyche: 0, physics: 4, speed: -2 },
    goalie:    { attack: 0, defense: 10, technique: -2, psyche: 4, physics: 2, speed: -6 }
};

export function generateAttributes(
    position: string,
    rating: number,
    name?: string | null
): PlayerAttributes {
    const rng = name ? makeSeededRNG(hashString(name + '_' + position)) : Math.random;
    const v = () => Math.round((rng() - 0.5) * 16);
    const base = POSITION_BASE[position] || POSITION_BASE.F;
    const mods = ARCHETYPE_MODS[getPlayerArchetype(position, name)];

    return {
        attack: clamp(rating + base.attack + mods.attack + v()),
        defense: clamp(rating + base.defense + mods.defense + v()),
        technique: clamp(rating + base.technique + mods.technique + v()),
        psyche: clamp(rating + base.psyche + mods.psyche + v()),
        physics: clamp(rating + base.physics + mods.physics + v()),
        speed: clamp(rating + base.speed + mods.speed + v())
    };
}
