import type { CartItem, Purchase } from './types'
import type { Cents } from '@/lib/money'
import { lineAmount } from '@/lib/units'
import { categoryById } from './categories'

/** Total de uma linha do carrinho, em centavos inteiros (promoção "leve N por R$ X" e descontos aplicados). */
export function lineGross(item: Pick<CartItem, 'qtyMilli' | 'unitPriceCents' | 'bundle' | 'priceUnit'>): Cents {
  if (item.bundle && item.priceUnit === 'un' && item.bundle.qty > 1) {
    const units = Math.round(item.qtyMilli / 1000)
    const groups = Math.floor(units / item.bundle.qty)
    const rest = units - groups * item.bundle.qty
    return groups * item.bundle.totalCents + rest * item.unitPriceCents
  }
  return lineAmount(item.unitPriceCents, item.qtyMilli)
}

export function lineTotal(item: CartItem): Cents {
  return Math.max(0, lineGross(item) - (item.discountCents || 0))
}

export interface CartTotals {
  /** soma das linhas já com desconto de item */
  subtotalCents: Cents
  /** soma dos descontos por item */
  itemDiscountsCents: Cents
  checkoutDiscountCents: Cents
  /** valor estimado a pagar no caixa */
  totalCents: Cents
  lines: number
  /** unidades (peso conta como 1 item) */
  units: number
}

export function cartTotals(items: CartItem[], checkoutDiscountCents = 0): CartTotals {
  let subtotal = 0
  let disc = 0
  let units = 0
  for (const it of items) {
    subtotal += lineTotal(it)
    disc += Math.min(it.discountCents || 0, lineGross(it))
    units += it.priceUnit === 'un' ? Math.round(it.qtyMilli / 1000) : 1
  }
  const checkout = Math.max(0, Math.min(checkoutDiscountCents || 0, subtotal))
  return {
    subtotalCents: subtotal,
    itemDiscountsCents: disc,
    checkoutDiscountCents: checkout,
    totalCents: subtotal - checkout,
    lines: items.length,
    units,
  }
}

export type BudgetLevel = 'none' | 'ok' | 'w80' | 'w90' | 'over'
export interface BudgetStatus {
  budgetCents: Cents
  usedPct: number
  remainingCents: Cents
  level: BudgetLevel
}

export function budgetStatus(totalCents: Cents, budgetCents: Cents): BudgetStatus {
  if (!budgetCents || budgetCents <= 0) return { budgetCents: 0, usedPct: 0, remainingCents: 0, level: 'none' }
  const usedPct = (totalCents / budgetCents) * 100
  const level: BudgetLevel = usedPct >= 100 ? 'over' : usedPct >= 90 ? 'w90' : usedPct >= 80 ? 'w80' : 'ok'
  return { budgetCents, usedPct, remainingCents: budgetCents - totalCents, level }
}

const ORDER: BudgetLevel[] = ['none', 'ok', 'w80', 'w90', 'over']
/** Retorna o nível se a mudança de total cruzou um novo limiar (80/90/100%) para cima; senão null. */
export type AlertLevel = 'w80' | 'w90' | 'over'
export function crossedThreshold(prevTotal: Cents, nextTotal: Cents, budgetCents: Cents): AlertLevel | null {
  const a = budgetStatus(prevTotal, budgetCents).level
  const b = budgetStatus(nextTotal, budgetCents).level
  if (ORDER.indexOf(b) > ORDER.indexOf(a) && (b === 'w80' || b === 'w90' || b === 'over')) return b
  return null
}

export function spendByCategory(items: CartItem[]): { category: string; label: string; cents: Cents }[] {
  const m = new Map<string, number>()
  for (const it of items) m.set(it.category, (m.get(it.category) ?? 0) + lineTotal(it))
  return [...m.entries()]
    .map(([category, cents]) => ({ category, label: categoryById(category).label, cents }))
    .sort((a, b) => b.cents - a.cents)
}

/** Procura item equivalente já presente no carrinho (mesmo código de barras ou mesmo produto/nome). */
export function findInCart(items: CartItem[], q: { barcode?: string; productId?: string; name?: string }): CartItem | undefined {
  const norm = (s: string) => s.trim().toLowerCase()
  return items.find(
    (i) =>
      (q.barcode && i.barcode === q.barcode) ||
      (q.productId && i.productId === q.productId) ||
      (!q.barcode && !q.productId && q.name && norm(i.name) === norm(q.name)),
  )
}

export function newPurchaseTotals(p: Purchase): CartTotals {
  return cartTotals(p.items, p.checkoutDiscountCents)
}
