import { describe, it, expect } from 'vitest'
import { spendRows, totals, groupBy, monthSeries, periodTotals, savingsReport, financeAlerts, frequentProducts } from '@/domain/finance'
import { purchase, item, price } from '../helpers/factories'

const NOW = new Date(2026, 10, 15, 12) // 15/11/2026

const P = [
  purchase({ finishedAt: new Date(2026, 10, 10).toISOString(), supermarketName: 'A', paymentMethod: 'pix', items: [item({ name: 'Arroz', category: 'mercearia', unitPriceCents: 2500 }), item({ name: 'Leite', category: 'laticinios', unitPriceCents: 500, qtyMilli: 6000 })] }),
  purchase({ finishedAt: new Date(2026, 10, 2).toISOString(), supermarketName: 'B', paymentMethod: 'credito', items: [item({ name: 'Arroz', category: 'mercearia', unitPriceCents: 2700 })] }),
  purchase({ finishedAt: new Date(2026, 9, 20).toISOString(), supermarketName: 'A', items: [item({ name: 'Café', category: 'mercearia', unitPriceCents: 1500 })] }),
  purchase({ status: 'cancelled', finishedAt: new Date(2026, 10, 11).toISOString(), items: [item({ unitPriceCents: 99999 })] }),
  purchase({ status: 'active', items: [item({ unitPriceCents: 88888 })] }),
]

describe('controle financeiro', () => {
  const rows = spendRows(P)
  it('conta apenas compras finalizadas', () => {
    expect(totals(rows).totalCents).toBe(2500 + 3000 + 2700 + 1500)
    expect(totals(rows).purchases).toBe(3)
  })
  it('ticket médio', () => {
    expect(totals(rows).avgTicketCents).toBe(Math.round(9700 / 3))
  })
  it('totais por período e comparação com o anterior', () => {
    const pt = periodTotals(rows, NOW)
    expect(pt.month).toBe(8200)
    expect(pt.prevMonth).toBe(1500)
    expect(pt.monthPurchases).toBe(2)
  })
  it('por categoria e por supermercado', () => {
    expect(groupBy(rows, 'category')[0]).toMatchObject({ label: 'Mercearia', cents: 6700 })
    expect(groupBy(rows, 'supermarket').map((g) => [g.label, g.cents])).toEqual([['A', 7000], ['B', 2700]])
  })
  it('série mensal inclui meses vazios', () => {
    const s = monthSeries(rows, NOW, 4)
    expect(s.map((p) => p.key)).toEqual(['2026-08', '2026-09', '2026-10', '2026-11'])
    expect(s.map((p) => p.cents)).toEqual([0, 0, 1500, 8200])
  })
  it('filtros: período, supermercado, categoria, produto, pagamento', () => {
    expect(totals(spendRows(P, { from: new Date(2026, 10, 1) })).totalCents).toBe(8200)
    expect(totals(spendRows(P, { supermarket: 'B' })).totalCents).toBe(2700)
    expect(totals(spendRows(P, { category: 'laticinios' })).totalCents).toBe(3000)
    expect(totals(spendRows(P, { product: 'arroz' })).totalCents).toBe(5200)
    expect(totals(spendRows(P, { payment: 'pix' })).totalCents).toBe(5500)
  })
  it('compra importada sem itens entra como "não detalhado" e some em filtros por item', () => {
    const legacy = purchase({ legacy: true, items: [], paidCents: 10000, finishedAt: new Date(2026, 10, 5).toISOString() })
    expect(totals(spendRows([legacy])).totalCents).toBe(10000)
    expect(groupBy(spendRows([legacy]), 'category')[0].label).toBe('Não detalhado')
    expect(spendRows([legacy], { category: 'mercearia' })).toHaveLength(0)
  })
  it('valor pago diferente do estimado é distribuído proporcionalmente', () => {
    const p = purchase({ paidCents: 5000, items: [item({ unitPriceCents: 3000 }), item({ unitPriceCents: 3000 })] })
    const r = spendRows([p])
    expect(r.reduce((s, x) => s + x.cents, 0)).toBe(5000)
  })
  it('frequência de produtos', () => {
    expect(frequentProducts(P)[0]).toMatchObject({ name: 'Arroz', count: 2 })
  })
})

describe('economia: verificada vs. estimada', () => {
  it('soma somente descontos registrados como economia verificada', () => {
    const p = [purchase({ checkoutDiscountCents: 300, items: [item({ unitPriceCents: 1000, discountCents: 200 }), item({ qtyMilli: 3000, unitPriceCents: 399, bundle: { qty: 3, totalCents: 1000 } })] })]
    const s = savingsReport(p, [])
    // 200 (item) + (3*399 - 1000 = 197) + 300 (caixa)
    expect(s.verifiedCents).toBe(697)
    expect(s.estimatedCents).toBe(0)
  })
  it('sem dados → zero (nada fictício)', () => {
    expect(savingsReport([], [])).toEqual({ verifiedCents: 0, verifiedItems: 0, estimatedCents: 0, estimatedItems: 0 })
  })
  it('estimativa exige ≥2 registros anteriores do mesmo produto', () => {
    const buy = purchase({ id: 'cur', finishedAt: '2026-11-01T12:00:00.000Z', items: [item({ productId: 'prod1', unitPriceCents: 800 })] })
    const one = [price({ id: 'a', unitPriceCents: 1000 })]
    expect(savingsReport([buy], one).estimatedCents).toBe(0)
    const two = [...one, price({ id: 'b', unitPriceCents: 1200, date: '2026-09-01T12:00:00.000Z' })]
    expect(savingsReport([buy], two)).toMatchObject({ estimatedCents: 300, verifiedCents: 0 })
  })
})

describe('alertas', () => {
  it('orçamento excedido e quase no limite', () => {
    const rows = spendRows(P)
    const goals = { monthlyBudgetCents: 8000, monthlySavingsGoalCents: 0, perPurchaseLimitCents: 0 }
    expect(financeAlerts(rows, P, [], goals, NOW).map((a) => a.id)).toContain('budget-over')
    expect(financeAlerts(rows, P, [], { ...goals, monthlyBudgetCents: 10000 }, NOW).map((a) => a.id)).toContain('budget-near')
    expect(financeAlerts(rows, P, [], { ...goals, monthlyBudgetCents: 0 }, NOW).map((a) => a.id)).not.toContain('budget-over')
  })
  it('crescimento de gastos', () => {
    const prev = purchase({ finishedAt: new Date(2026, 9, 5).toISOString(), items: [item({ unitPriceCents: 5000 })] })
    const cur = purchase({ finishedAt: new Date(2026, 10, 5).toISOString(), items: [item({ unitPriceCents: 9000 })] })
    const rows = spendRows([prev, cur])
    expect(financeAlerts(rows, [prev, cur], [], { monthlyBudgetCents: 0, monthlySavingsGoalCents: 0, perPurchaseLimitCents: 0 }, NOW).map((a) => a.id)).toContain('growth')
  })
})
