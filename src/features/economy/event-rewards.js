// ============================================================
// v1.2 «Lean Agency»: экономика событий.
// Ранние уровни не должны получать «жирные» разовые награды.
// Деньги, вложенные в событие, возвращаются клиенту полностью,
// а сверху начисляется только ограниченная прибыль.
// ============================================================

export const VERSION = '1.3.0';

export const EVENT_REWARD_CAPS = Object.freeze([
    { minLevel: 1, cap: 500 },
    { minLevel: 4, cap: 5000 },
    { minLevel: 7, cap: 15000 },
    { minLevel: 10, cap: 35000 },
    { minLevel: 15, cap: 75000 },
    { minLevel: 20, cap: 150000 }
]);

export function getEventRewardCap(level = 1) {
    const lvl = Math.max(1, Math.round(Number(level) || 1));
    let cap = EVENT_REWARD_CAPS[0].cap;
    for (const row of EVENT_REWARD_CAPS) {
        if (lvl >= row.minLevel) cap = row.cap;
    }
    return cap;
}

export function getEventMoneyMultiplier(level = 1) {
    const lvl = Math.max(1, Math.round(Number(level) || 1));
    return 0.08 + (lvl - 1) * 0.07;
}

// Взнос — только сумма в скобках: «Нанять юриста ($15K)».
// Суммы без скобок («Взять $40K») — это доход, а не вложение.
export function parseEventInvestment(label = '') {
    const text = String(label || '');
    const match = text.match(/\(\s*\$\s*(\d+(?:[.,]\d+)?)\s*([KkМмMm]?)\s*\)/);
    if (!match) return 0;
    const base = Number(match[1].replace(',', '.'));
    if (!Number.isFinite(base) || base <= 0) return 0;
    const unit = match[2].toUpperCase();
    if (unit === 'K' || unit === 'М' || unit === 'M') return Math.round(base * 1000);
    return Math.round(base);
}

// rawDelta — фактическая дельта агентского счёта после choice.apply().
// Отрицательные суммы (расходы) больше не масштабируются: игрок платит
// ровно столько, сколько написано в варианте.
// Положительные: взнос возвращается целиком, прибыль режется по уровню.
export function settleEventMoney(rawDelta, level, label = '', investedOverride = 0) {
    const delta = Number(rawDelta) || 0;
    if (delta === 0) return 0;
    if (delta < 0) return Math.round(delta);

    // Взнос передаётся явно (choice.invested). Суммы в подписи могут быть
    // и доходом («За деньги ($20K)»), поэтому угадывать по тексту нельзя.
    const invested = Math.max(0, Math.round(Number(investedOverride) || 0));
    const multiplier = getEventMoneyMultiplier(level);
    const cap = getEventRewardCap(level);

    if (invested > 0) {
        // Сначала возвращаем сам взнос из полученной суммы,
        // затем масштабируем и капим только чистую прибыль.
        const stakeBack = Math.min(invested, delta);
        const profitBase = Math.max(0, delta - stakeBack);
        const profit = Math.max(0, Math.min(
            Math.round(profitBase * multiplier),
            cap
        ));
        return stakeBack + profit;
    }

    return Math.max(0, Math.min(Math.round(delta * multiplier), cap));
}
