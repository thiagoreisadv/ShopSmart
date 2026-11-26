import type { CartItem, Purchase, PriceRecord } from '@/domain/types'

let n = 0
export function item(over: Partial<CartItem> = {}): CartItem {
  n++
  return {
    id: `i${n}`,
    name: 'Produto',
    category: 'mercearia',
    qtyMilli: 1000,
    priceUnit: 'un',
    unitPriceCents: 1000,
    discountCents: 0,
    origin: 'manual',
    addedAt: 0,
    priceConfirmed: true,
    ...over,
  }
}
export function purchase(over: Partial<Purchase> = {}): Purchase {
  n++
  const items = over.items ?? [item()]
  const iso = over.finishedAt ?? '2026-11-10T12:00:00.000Z'
  return {
    id: `p${n}`,
    status: 'finalized',
    supermarketName: 'Mercado X',
    budgetCents: 0,
    items,
    checkoutDiscountCents: 0,
    startedAt: iso,
    finishedAt: iso,
    updatedAt: iso,
    paidCents: items.reduce((s, i) => s + Math.round((i.unitPriceCents * i.qtyMilli) / 1000) - i.discountCents, 0),
    ...over,
  }
}
export function price(over: Partial<PriceRecord> = {}): PriceRecord {
  n++
  return {
    id: `r${n}`,
    productId: 'prod1',
    supermarketName: 'Mercado X',
    unitPriceCents: 1000,
    priceUnit: 'un',
    lineCents: 1000,
    date: '2026-10-01T12:00:00.000Z',
    kind: 'paid',
    ...over,
  }
}
