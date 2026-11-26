import { describe, it, expect } from 'vitest'
import { cartTotals, lineTotal, budgetStatus, crossedThreshold, findInCart, spendByCategory } from '@/domain/cart'
import { item } from '../helpers/factories'

describe('carrinho em centavos', () => {
  it('soma sem erro de ponto flutuante (0,10 + 0,20)', () => {
    const t = cartTotals([item({ unitPriceCents: 10 }), item({ unitPriceCents: 20 })])
    expect(t.totalCents).toBe(30)
  })
  it('quantidade × preço', () => {
    expect(lineTotal(item({ qtyMilli: 3000, unitPriceCents: 499 }))).toBe(1497)
  })
  it('produto por peso (kg, g)', () => {
    expect(lineTotal(item({ priceUnit: 'kg', qtyMilli: 532, unitPriceCents: 1999 }))).toBe(1063)
    expect(lineTotal(item({ priceUnit: 'l', qtyMilli: 1500, unitPriceCents: 899 }))).toBe(1349)
  })
  it('desconto da linha e do caixa', () => {
    const t = cartTotals([item({ unitPriceCents: 1000, discountCents: 150 }), item({ unitPriceCents: 500 })], 100)
    expect(t.subtotalCents).toBe(1350)
    expect(t.itemDiscountsCents).toBe(150)
    expect(t.totalCents).toBe(1250)
  })
  it('desconto nunca deixa total negativo', () => {
    expect(lineTotal(item({ unitPriceCents: 100, discountCents: 500 }))).toBe(0)
    expect(cartTotals([item({ unitPriceCents: 100 })], 9999).totalCents).toBe(0)
  })
  it('promoção "3 por R$ 10": 7 unidades = 2 grupos + 1', () => {
    const it = item({ qtyMilli: 7000, unitPriceCents: 399, bundle: { qty: 3, totalCents: 1000 } })
    expect(lineTotal(it)).toBe(2 * 1000 + 399)
    expect(lineTotal(item({ qtyMilli: 2000, unitPriceCents: 399, bundle: { qty: 3, totalCents: 1000 } }))).toBe(798)
  })
  it('contagem de linhas e unidades (peso conta 1)', () => {
    const t = cartTotals([item({ qtyMilli: 3000 }), item({ priceUnit: 'kg', qtyMilli: 400 })])
    expect(t.lines).toBe(2)
    expect(t.units).toBe(4)
  })
  it('gastos por categoria', () => {
    const r = spendByCategory([item({ category: 'bebidas', unitPriceCents: 500 }), item({ category: 'bebidas', unitPriceCents: 300 }), item({ category: 'padaria', unitPriceCents: 100 })])
    expect(r[0]).toMatchObject({ category: 'bebidas', cents: 800 })
  })
  it('detecta item já no carrinho', () => {
    const items = [item({ barcode: '789', name: 'Leite' }), item({ name: 'Pão' })]
    expect(findInCart(items, { barcode: '789' })?.name).toBe('Leite')
    expect(findInCart(items, { name: ' pão ' })?.name).toBe('Pão')
    expect(findInCart(items, { barcode: '000' })).toBeUndefined()
  })
})

describe('orçamento e alertas 80/90/100%', () => {
  it('níveis', () => {
    expect(budgetStatus(7999, 10000).level).toBe('ok')
    expect(budgetStatus(8000, 10000).level).toBe('w80')
    expect(budgetStatus(9000, 10000).level).toBe('w90')
    expect(budgetStatus(10000, 10000).level).toBe('over')
    expect(budgetStatus(12000, 10000)).toMatchObject({ level: 'over', remainingCents: -2000 })
    expect(budgetStatus(5000, 0).level).toBe('none')
  })
  it('alerta apenas ao cruzar limiar para cima', () => {
    expect(crossedThreshold(7000, 8100, 10000)).toBe('w80')
    expect(crossedThreshold(8100, 8500, 10000)).toBeNull()
    expect(crossedThreshold(8500, 9100, 10000)).toBe('w90')
    expect(crossedThreshold(9100, 10100, 10000)).toBe('over')
    expect(crossedThreshold(10100, 9000, 10000)).toBeNull()
    expect(crossedThreshold(0, 100, 0)).toBeNull()
  })
  it('compra não é bloqueada ao exceder (retorna apenas status)', () => {
    expect(budgetStatus(99999, 100).remainingCents).toBeLessThan(0)
  })
})
