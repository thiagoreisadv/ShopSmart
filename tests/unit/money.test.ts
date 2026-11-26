import { describe, it, expect } from 'vitest'
import { parseMoney, formatBRL, mulDiv, centsFromDigits } from '@/lib/money'
import { lineAmount, toQtyMilli, parseSize, pricePerBase, formatQty } from '@/lib/units'

describe('parseMoney', () => {
  it.each([
    ['12,99', 1299],
    ['R$ 12,99', 1299],
    ['1.299,90', 129990],
    ['1,299.90', 129990],
    ['12.5', 1250],
    ['12.50', 1250],
    ['5', 500],
    ['0,5', 50],
    ['1.299', 129900],
    ['19,9', 1990],
    ['0,999', 100],
  ])('%s -> %i', (i, o) => expect(parseMoney(i)).toBe(o))
  it('rejeita lixo', () => {
    expect(parseMoney('abc')).toBeNull()
    expect(parseMoney('')).toBeNull()
    expect(parseMoney(null)).toBeNull()
    expect(parseMoney('1,2,3a')).toBeNull()
  })
  it('numbers sem erro de ponto flutuante', () => {
    expect(parseMoney(1.15)).toBe(115)
    expect(parseMoney(0.1 + 0.2)).toBe(30)
    expect(parseMoney(19.99)).toBe(1999)
  })
})

describe('dinheiro/unidades', () => {
  it('formata BRL', () => {
    expect(formatBRL(129990).replace(/\s/g, ' ')).toBe('R$ 1.299,90')
  })
  it('centsFromDigits', () => {
    expect(centsFromDigits('1299')).toBe(1299)
    expect(centsFromDigits('R$ 0,05')).toBe(5)
    expect(centsFromDigits('')).toBe(0)
  })
  it('mulDiv arredonda sem float', () => {
    expect(mulDiv(1999, 532, 1000)).toBe(1063) // 1063.468
    expect(mulDiv(333, 3000, 1000)).toBe(999)
    expect(mulDiv(5, 500, 1000)).toBe(3) // 2.5 -> 3
  })
  it('produto por peso: 532 g a R$ 19,99/kg', () => {
    expect(lineAmount(1999, toQtyMilli(532, 'g'))).toBe(1063)
    expect(lineAmount(1999, toQtyMilli(0.532, 'kg'))).toBe(1063)
  })
  it('unidades', () => {
    expect(toQtyMilli(3, 'un')).toBe(3000)
    expect(lineAmount(499, toQtyMilli(3, 'un'))).toBe(1497)
    expect(formatQty(532, 'kg')).toBe('532 g')
    expect(formatQty(1500, 'kg')).toBe('1,5 kg')
    expect(formatQty(250, 'l')).toBe('250 mL')
  })
  it('parseSize + preço por base', () => {
    expect(parseSize('Arroz 5kg')).toEqual({ milli: 5000, unit: 'kg' })
    expect(parseSize('Leite 1,5 L')).toEqual({ milli: 1500, unit: 'l' })
    expect(parseSize('Biscoito 140g')).toEqual({ milli: 140, unit: 'kg' })
    expect(parseSize('sem tamanho')).toBeNull()
    expect(pricePerBase(2500, { milli: 5000, unit: 'kg' })).toBe(500)
    expect(pricePerBase(399, { milli: 500, unit: 'kg' })).toBe(798)
  })
})
