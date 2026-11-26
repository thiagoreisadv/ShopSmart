import { describe, it, expect } from 'vitest'
import { evaluatePrice, priceStats, latestBySupermarket } from '@/domain/prices'
import { price } from '../helpers/factories'

const NOW = new Date('2026-11-15T12:00:00Z')
const H = [
  price({ id: '1', unitPriceCents: 1000, date: '2026-08-01T12:00:00Z', supermarketName: 'A' }),
  price({ id: '2', unitPriceCents: 1200, date: '2026-09-01T12:00:00Z', supermarketName: 'B' }),
  price({ id: '3', unitPriceCents: 1100, date: '2026-11-01T12:00:00Z', supermarketName: 'A' }),
]

describe('histórico de preços', () => {
  it('estatísticas', () => {
    const s = priceStats(H)
    expect(s.last?.unitPriceCents).toBe(1100)
    expect(s.lowest?.unitPriceCents).toBe(1000)
    expect(s.highest?.unitPriceCents).toBe(1200)
    expect(s.avgCents).toBe(1100)
    expect(s.changePct).toBeCloseTo(-8.33, 1)
    expect(priceStats([])).toMatchObject({ count: 0, changePct: null })
  })
  it('menor preço já registrado', () => {
    expect(evaluatePrice(H, 900, 'un', NOW).map((i) => i.type)).toEqual(['lowest'])
  })
  it('abaixo do último, mas não o menor', () => {
    expect(evaluatePrice(H, 1050, 'un', NOW).map((i) => i.type)).toEqual(['below-last'])
  })
  it('aumento e acima da média', () => {
    const t = evaluatePrice(H, 1300, 'un', NOW).map((i) => i.type)
    expect(t).toEqual(['above-last', 'above-avg'])
  })
  it('traz a data de referência e sinaliza dados antigos', () => {
    const old = [price({ unitPriceCents: 1000, date: '2025-01-01T12:00:00Z' })]
    const [i] = evaluatePrice(old, 900, 'un', NOW)
    expect(i.reference.date).toBe('2025-01-01T12:00:00Z')
    expect(i.stale).toBe(true)
  })
  it('não compara unidades diferentes (kg vs un)', () => {
    expect(evaluatePrice(H, 500, 'kg', NOW)).toEqual([])
  })
  it('sem histórico não há alerta', () => {
    expect(evaluatePrice([], 500, 'un', NOW)).toEqual([])
  })
  it('último preço por supermercado, do mais barato ao mais caro', () => {
    const l = latestBySupermarket(H)
    expect(l.map((r) => [r.supermarketName, r.unitPriceCents])).toEqual([['A', 1100], ['B', 1200]])
  })
})
