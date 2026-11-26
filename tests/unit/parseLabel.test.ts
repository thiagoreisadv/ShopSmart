import { describe, it, expect } from 'vitest'
import { parseLabelText, fixOcrDigits } from '@/lib/ocr/parseLabel'

const best = (t: string, conf = 90) => parseLabelText(t, { ocrConfidence: conf })

describe('parseLabelText — formatos brasileiros', () => {
  it('R$ 12,99', () => {
    const r = best('ARROZ TIPO 1 CAMIL 5KG\nR$ 12,99')
    expect(r.suggested?.cents).toBe(1299)
    expect(r.size).toMatchObject({ milli: 5000, unit: 'kg' })
    expect(r.brand).toBe('Camil')
    expect(r.name).toMatch(/Arroz/)
  })
  it('12,99 sem símbolo', () => {
    expect(best('Feijão Preto\n12,99').suggested?.cents).toBe(1299)
  })
  it('R$ 1.299,90', () => {
    expect(best('Geladeira Frost Free\nR$ 1.299,90').suggested?.cents).toBe(129990)
  })
  it('R$ 19,90/kg é preço por quilo, não do produto embalado', () => {
    const r = best('Contra filé\nR$ 19,90/kg')
    const c = r.candidates.find((x) => x.cents === 1990)!
    expect(c.kind).toBe('unit-price')
    expect(c.priceUnit).toBe('kg')
    expect(r.suggested).toBeNull() // exige confirmação
  })
  it('R$ 5,49/un', () => {
    const r = best('Iogurte Natural\nR$ 5,49/un')
    expect(r.suggested?.cents).toBe(549)
    expect(r.suggested?.priceUnit).toBe('un')
  })
  it('3 unidades por R$ 10,00', () => {
    const r = best('Sabonete Protex\n3 unidades por R$ 10,00')
    const b = r.candidates.find((x) => x.kind === 'bundle')!
    expect(b.bundle).toEqual({ qty: 3, totalCents: 1000 })
    expect(r.suggested?.kind).toBe('bundle')
  })
  it('leve 3 por 10,00', () => {
    const r = best('Leve 3 por 10,00')
    expect(r.candidates[0].bundle).toEqual({ qty: 3, totalCents: 1000 })
  })
})

describe('parseLabelText — não confundir com outros números', () => {
  it('ignora código de barras, data e peso', () => {
    const r = best('Biscoito Recheado 140g\n7891000100103\nVal: 12/05/2026\nR$ 3,49')
    expect(r.candidates.map((c) => c.cents)).toEqual([349])
    expect(r.suggested?.cents).toBe(349)
  })
  it('preço por kg da embalagem + preço do pacote: escolhe o pacote', () => {
    const r = best('Café Pilão 500g\nR$ 18,90\nR$ 37,80/kg')
    expect(r.suggested?.cents).toBe(1890)
    expect(r.candidates.find((c) => c.cents === 3780)?.kind).toBe('unit-price')
  })
  it('"de R$ X por R$ Y" usa o preço promocional', () => {
    const r = best('Detergente\nde R$ 4,99\npor R$ 3,49')
    expect(r.candidates.find((c) => c.cents === 499)?.kind).toBe('old-price')
    expect(r.suggested?.cents).toBe(349)
  })
  it('parcelado não é o preço', () => {
    const r = best('TV 50 polegadas\n10x de R$ 199,90\nR$ 1.999,00')
    expect(r.candidates.find((c) => c.cents === 19990)?.kind).toBe('installment')
    expect(r.suggested?.cents).toBe(199900)
  })
  it('percentuais não viram preço', () => {
    const r = best('10% OFF\nR$ 8,90')
    expect(r.candidates.map((c) => c.cents)).toEqual([890])
  })
})

describe('confiança e confirmação', () => {
  it('vários preços semelhantes → sem sugestão automática', () => {
    const r = best('Produto X\n12,99\n13,49')
    expect(r.suggested).toBeNull()
    expect(r.confidence).toBe('low')
    expect(r.warnings.length).toBeGreaterThan(0)
  })
  it('sem preço', () => {
    const r = best('Só texto sem valores')
    expect(r.candidates).toHaveLength(0)
    expect(r.suggested).toBeNull()
  })
  it('baixa confiança do OCR rebaixa a confiança', () => {
    const r = parseLabelText('Arroz\nR$ 12,99', { ocrConfidence: 30 })
    expect(r.confidence).not.toBe('high')
    expect(r.warnings.join(' ')).toMatch(/baixa confiança/)
  })
  it('corrige confusões do OCR (RS, O por 0)', () => {
    expect(fixOcrDigits('RS 12,99')).toBe('R$ 12,99')
    expect(best('Leite\nRS 4,O9').suggested?.cents).toBe(409)
  })
})
