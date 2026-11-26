import type { ListData, ListMarket, ListProduct } from './types'
import { parseMoney, type Cents } from '@/lib/money'
import { pricePerBase } from '@/lib/units'
import { mulDiv } from '@/lib/money'

export interface MarketResult {
  market: ListMarket
  /** soma de preço × quantidade dos itens com preço, antes do desconto do mercado */
  subtotalCents: Cents
  discountCents: Cents
  totalCents: Cents
  pricedItems: number
  missing: ListProduct[]
  travelCents: Cents
  /** total + deslocamento */
  netCents: Cents
  complete: boolean
}

export interface ProductBest {
  product: ListProduct
  bestMarketId: string | null
  bestCents: Cents | null
  /** melhor preço por kg/L, se o produto tem tamanho informado */
  bestPerBaseCents: Cents | null
  bestPerBaseMarketId: string | null
  pricedIn: number
}

export interface Comparison {
  results: MarketResult[]
  bestProducts: ProductBest[]
  /** melhor mercado considerando apenas mercados com TODOS os itens precificados; null se nenhum completo */
  winner: MarketResult | null
  /** mercado mais barato mesmo com itens faltando (apenas informativo) */
  cheapestPartial: MarketResult | null
  /** economia líquida do vencedor frente ao mais caro entre os completos (inclui deslocamento) */
  netSavingsCents: Cents
  /** quanto seria se cada item fosse comprado no seu melhor mercado (ignora deslocamento) */
  splitTotalCents: Cents
  splitSavingsCents: Cents
  productsWithoutPrice: ListProduct[]
}

const priceOf = (p: ListProduct, marketId: string): Cents | null => {
  const raw = p.prices?.[marketId]
  if (raw === undefined || raw === null || raw === '') return null
  const c = parseMoney(raw)
  return c !== null && c > 0 ? c : null
}

export function compareMarkets(list: Pick<ListData, 'markets' | 'products'>): Comparison {
  const { markets, products } = list
  const results: MarketResult[] = markets.map((m) => {
    let sub = 0
    let priced = 0
    const missing: ListProduct[] = []
    for (const p of products) {
      const c = priceOf(p, m.id)
      if (c === null) missing.push(p)
      else {
        sub += c * Math.max(1, p.quantity)
        priced++
      }
    }
    const pct = parseFloat((m.discountPercent || '0').replace(',', '.')) || 0
    const discount = pct > 0 ? mulDiv(sub, Math.round(pct * 100), 10000) : 0
    const total = sub - discount
    const travel = m.travelCostCents ?? 0
    return {
      market: m,
      subtotalCents: sub,
      discountCents: discount,
      totalCents: total,
      pricedItems: priced,
      missing,
      travelCents: travel,
      netCents: total + travel,
      complete: products.length > 0 && missing.length === 0,
    }
  })
  const complete = results.filter((r) => r.complete).sort((a, b) => a.netCents - b.netCents)
  const winner = complete[0] ?? null
  const partial = results.filter((r) => r.pricedItems > 0).sort((a, b) => a.netCents - b.netCents)
  const bestProducts: ProductBest[] = products.map((p) => {
    let best: Cents | null = null
    let bestM: string | null = null
    let perBase: Cents | null = null
    let perBaseM: string | null = null
    let n = 0
    for (const m of markets) {
      const c = priceOf(p, m.id)
      if (c === null) continue
      n++
      if (best === null || c < best) {
        best = c
        bestM = m.id
      }
      if (p.packSize) {
        const pb = pricePerBase(c, p.packSize)
        if (pb !== null && (perBase === null || pb < perBase)) {
          perBase = pb
          perBaseM = m.id
        }
      }
    }
    return { product: p, bestMarketId: bestM, bestCents: best, bestPerBaseCents: perBase, bestPerBaseMarketId: perBaseM, pricedIn: n }
  })
  const productsWithoutPrice = bestProducts.filter((b) => b.pricedIn === 0).map((b) => b.product)
  const split = bestProducts.reduce((s, b) => (b.bestCents === null ? s : s + b.bestCents * Math.max(1, b.product.quantity)), 0)
  const netSavings = complete.length > 1 ? complete[complete.length - 1].netCents - complete[0].netCents : 0
  const splitSavings = winner ? Math.max(0, winner.subtotalCents - split) : 0
  return {
    results,
    bestProducts,
    winner,
    cheapestPartial: partial[0] ?? null,
    netSavingsCents: netSavings,
    splitTotalCents: split,
    splitSavingsCents: splitSavings,
    productsWithoutPrice,
  }
}
