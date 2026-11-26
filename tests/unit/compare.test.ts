import { describe, it, expect } from 'vitest'
import { compareMarkets } from '@/domain/compare'
import type { ListProduct, ListMarket } from '@/domain/types'

const p = (id: string, qty: number, prices: Record<string, string>, extra: Partial<ListProduct> = {}): ListProduct => ({
  id, name: id, quantity: qty, prices, category: 'geral', isEssential: false, inCart: false, note: '', ...extra,
})
const markets: ListMarket[] = [
  { id: 'a', name: 'A', discountPercent: '10' },
  { id: 'b', name: 'B', discountPercent: '', travelCostCents: 0 },
]

describe('comparador de supermercados', () => {
  it('aplica desconto percentual e quantidade', () => {
    const r = compareMarkets({ markets, products: [p('x', 2, { a: '10.00', b: '9.00' }), p('y', 1, { a: '5.00', b: '6.00' })] })
    const a = r.results[0]
    expect(a.subtotalCents).toBe(2500)
    expect(a.discountCents).toBe(250)
    expect(a.totalCents).toBe(2250)
    expect(r.results[1].totalCents).toBe(2400)
    expect(r.winner?.market.id).toBe('a')
    expect(r.netSavingsCents).toBe(150)
  })
  it('produto sem preço NÃO é tratado como grátis: mercado incompleto não vence', () => {
    const r = compareMarkets({ markets, products: [p('x', 1, { a: '10', b: '12' }), p('y', 1, { a: '', b: '3' })] })
    expect(r.results[0].missing.map((m) => m.id)).toEqual(['y'])
    expect(r.results[0].complete).toBe(false)
    expect(r.winner?.market.id).toBe('b')
    expect(r.cheapestPartial).not.toBeNull()
  })
  it('deslocamento entra na economia líquida', () => {
    const ms: ListMarket[] = [
      { id: 'a', name: 'A', discountPercent: '', travelCostCents: 2000 },
      { id: 'b', name: 'B', discountPercent: '', travelCostCents: 0 },
    ]
    const r = compareMarkets({ markets: ms, products: [p('x', 1, { a: '50', b: '60' })] })
    expect(r.winner?.market.id).toBe('b') // 50+20 > 60
    expect(r.netSavingsCents).toBe(1000)
  })
  it('produtos sem nenhum preço são listados', () => {
    const r = compareMarkets({ markets, products: [p('z', 1, {})] })
    expect(r.productsWithoutPrice.map((x) => x.id)).toEqual(['z'])
    expect(r.winner).toBeNull()
  })
  it('melhor preço por produto e por unidade de medida', () => {
    const r = compareMarkets({ markets, products: [p('arroz', 1, { a: '25', b: '12' }, { packSize: { milli: 5000, unit: 'kg' } })] })
    expect(r.bestProducts[0]).toMatchObject({ bestMarketId: 'b', bestCents: 1200, bestPerBaseCents: 240 })
  })
  it('economia ao dividir a compra por produto', () => {
    const r = compareMarkets({ markets: [{ ...markets[0], discountPercent: '' }, markets[1]], products: [p('x', 1, { a: '10', b: '15' }), p('y', 1, { a: '20', b: '10' })] })
    expect(r.splitTotalCents).toBe(2000)
    expect(r.winner?.totalCents).toBe(2500)
    expect(r.splitSavingsCents).toBe(500)
  })
  it('lista vazia não quebra', () => {
    expect(compareMarkets({ markets, products: [] }).winner).toBeNull()
  })
})
