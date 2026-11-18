# Состояние этапа (трансферы)
- Переведены на simRandom/simInt: generateTransferOffer, tryPassiveTransferOffer, resolveNegotiationRound, generateRenewalOffer, rollPlayerWantsToLeave, generateOffersForPlayer, tickTransferOffers, tryTradeOffer/Contract, poaching/transfer-флоу.
- Добавлены seed'ы: оффер (игрок+клуб+неделя), пассивный оффер (сезон+неделя+фаза), продление и уход (игрок+сезон), переговоры (игрок+тип+раунд).
- Новый tests/transfers-determinism.test.mjs: 2 прогона зонда (оффер/продление/уход/пакет) идентичны, 0 вызовов Math.random. Всего 56 тестов, tsc и build зелёные.
