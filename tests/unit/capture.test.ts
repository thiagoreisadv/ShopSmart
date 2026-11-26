import { describe, it, expect } from 'vitest'
import { applyLabel, canAdd, draftFromFound, emptyDraft, pickCandidate, reticleCrop, barcodeRegion, toCartItem } from '@/lib/capture'
import { parseLabelText } from '@/lib/ocr/parseLabel'

const found = { barcode: '7891000100103', name: 'Leite Moça', brand: 'Nestlé', category: 'laticinios', source: 'off' as const }

describe('captura unificada — lógica', () => {
  it('produto identificado por código vem SEM preço e não pode ser adicionado ainda', () => {
    const d = draftFromFound(found)
    expect(d.priceCents).toBe(0)
    expect(canAdd(d)).toBe(false)
  })
  it('OCR com leitura confiável pré-seleciona o preço; incerta não pré-seleciona', () => {
    const ok = applyLabel(null, parseLabelText('Arroz Camil\nR$ 24,90', { ocrConfidence: 90 }), false)
    expect(ok.priceCents).toBe(2490)
    expect(ok.priceNeedsConfirm).toBe(true)
    const amb = applyLabel(null, parseLabelText('Produto\n12,99\n13,49', { ocrConfidence: 90 }), false)
    expect(amb.priceCents).toBe(0)
    expect(amb.candidates).toHaveLength(2)
    expect(amb.warnings.length).toBeGreaterThan(0)
  })
  it('OCR depois do código mantém o nome do produto identificado', () => {
    const d = applyLabel(draftFromFound(found), parseLabelText('QUALQUER TEXTO\nR$ 7,99', { ocrConfidence: 90 }), true)
    expect(d.name).toBe('Leite Moça')
    expect(d.barcode).toBe('7891000100103')
    expect(d.priceCents).toBe(799)
    expect(d.origin).toBe('barcode')
  })
  it('candidato de preço por kg muda a unidade; pacote "3 por 10" vira preço unitário + promoção', () => {
    const base = emptyDraft()
    const kg = pickCandidate(base, parseLabelText('Carne\nR$ 19,90/kg').candidates[0])
    expect(kg.priceUnit).toBe('kg')
    const b = pickCandidate(base, parseLabelText('3 unidades por R$ 10,00').candidates[0])
    expect(b.bundle).toEqual({ qty: 3, totalCents: 1000 })
    expect(b.priceCents).toBe(333)
  })
  it('converte em item de carrinho (peso em milésimos; unidades inteiras)', () => {
    const d = { ...emptyDraft(), name: 'Contra filé', priceCents: 4990, priceUnit: 'kg' as const, qty: 0.532 }
    expect(toCartItem(d)).toMatchObject({ qtyMilli: 532, unitPriceCents: 4990, priceUnit: 'kg', priceConfirmed: true })
    expect(toCartItem({ ...emptyDraft(), name: 'Pão', priceCents: 120, qty: 3 }).qtyMilli).toBe(3000)
  })
  it('regiões de processamento são parciais (não processa o quadro inteiro)', () => {
    const r = reticleCrop(1000, 800)
    expect(r.w * r.h).toBeLessThan(1000 * 800 * 0.5)
    const b = barcodeRegion(1280, 720)
    expect(b.w * b.h).toBeLessThan(1280 * 720 * 0.5)
  })
})
