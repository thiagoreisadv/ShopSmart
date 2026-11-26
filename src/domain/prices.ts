import type { PriceRecord } from './types'
import type { Cents } from '@/lib/money'
import type { PriceUnit } from '@/lib/units'
import { daysBetween } from '@/lib/dates'

export function recordsFor(prices: PriceRecord[], productId: string, unit?: PriceUnit): PriceRecord[] {
  return prices
    .filter((r) => r.productId === productId && (!unit || r.priceUnit === unit))
    .sort((a, b) => b.date.localeCompare(a.date))
}

export interface PriceStats {
  count: number
  last?: PriceRecord
  lowest?: PriceRecord
  highest?: PriceRecord
  avgCents: Cents
  /** variação % entre o último e o anterior */
  changePct: number | null
}

export function priceStats(records: PriceRecord[]): PriceStats {
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date))
  if (!sorted.length) return { count: 0, avgCents: 0, changePct: null }
  let lowest = sorted[0]
  let highest = sorted[0]
  let sum = 0
  for (const r of sorted) {
    if (r.unitPriceCents < lowest.unitPriceCents) lowest = r
    if (r.unitPriceCents > highest.unitPriceCents) highest = r
    sum += r.unitPriceCents
  }
  const changePct = sorted.length > 1 && sorted[1].unitPriceCents > 0 ? ((sorted[0].unitPriceCents - sorted[1].unitPriceCents) / sorted[1].unitPriceCents) * 100 : null
  return { count: sorted.length, last: sorted[0], lowest, highest, avgCents: Math.round(sum / sorted.length), changePct }
}

export type InsightType = 'lowest' | 'below-last' | 'above-last' | 'above-avg'
export interface PriceInsight {
  type: InsightType
  tone: 'good' | 'warn'
  message: string
  reference: PriceRecord
  /** referência com mais de 90 dias: aviso de que pode estar desatualizada */
  stale: boolean
}

/**
 * Compara um preço atual (por unidade-base) com os registros anteriores do MESMO produto e MESMA unidade.
 * Produtos com embalagens diferentes têm ids diferentes e, portanto, nunca são comparados aqui.
 * O histórico nunca é tratado como preço atual confirmado.
 */
export function evaluatePrice(history: PriceRecord[], currentUnitCents: Cents, unit: PriceUnit, now = new Date()): PriceInsight[] {
  const recs = history.filter((r) => r.priceUnit === unit)
  if (!recs.length || currentUnitCents <= 0) return []
  const st = priceStats(recs)
  const out: PriceInsight[] = []
  const stale = (r: PriceRecord) => daysBetween(r.date, now) > 90
  const last = st.last!
  if (currentUnitCents < st.lowest!.unitPriceCents) {
    out.push({ type: 'lowest', tone: 'good', message: 'Menor preço já registrado', reference: st.lowest!, stale: stale(st.lowest!) })
  } else if (currentUnitCents < last.unitPriceCents) {
    out.push({ type: 'below-last', tone: 'good', message: 'Abaixo do último preço registrado', reference: last, stale: stale(last) })
  } else if (currentUnitCents > last.unitPriceCents) {
    out.push({ type: 'above-last', tone: 'warn', message: 'Aumento em relação à última compra', reference: last, stale: stale(last) })
  }
  if (st.count >= 2 && currentUnitCents > st.avgCents * 1.05) {
    out.push({ type: 'above-avg', tone: 'warn', message: 'Acima da média histórica', reference: last, stale: stale(last) })
  }
  return out
}

export function pctChange(from: Cents, to: Cents): number | null {
  return from > 0 ? ((to - from) / from) * 100 : null
}

/** Último registro por supermercado, para comparar estabelecimentos. */
export function latestBySupermarket(records: PriceRecord[]): PriceRecord[] {
  const m = new Map<string, PriceRecord>()
  for (const r of [...records].sort((a, b) => a.date.localeCompare(b.date))) m.set(r.supermarketId ?? r.supermarketName.toLowerCase(), r)
  return [...m.values()].sort((a, b) => a.unitPriceCents - b.unitPriceCents)
}
