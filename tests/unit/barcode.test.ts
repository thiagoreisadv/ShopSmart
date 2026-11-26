import { describe, it, expect } from 'vitest'
import { isValidGtin, normalizeBarcode, upcEtoUpcA, isBrazilianGtin, shardKey } from '@/lib/barcode'
import { decodeLuminance } from '@/services/scanner/decode'

// Codificador EAN-13 mínimo para gerar imagens de teste sintéticas
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100']
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']
function ean13Bits(code: string): string {
  const p = PARITY[Number(code[0])]
  let bits = '101'
  for (let i = 0; i < 6; i++) bits += (p[i] === 'L' ? L : G)[Number(code[i + 1])]
  bits += '01010'
  for (let i = 0; i < 6; i++) bits += R[Number(code[i + 7])]
  return bits + '101'
}
function render(code: string, scale = 3, quiet = 12, h = 80) {
  const bits = ean13Bits(code)
  const w = (bits.length + quiet * 2) * scale
  const luma = new Uint8ClampedArray(w * h).fill(255)
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== '1') continue
    for (let x = 0; x < scale; x++) for (let y = 0; y < h; y++) luma[y * w + (quiet + i) * scale + x] = 0
  }
  return { w, h, luma }
}

describe('validação de GTIN', () => {
  it('valida EAN-13 e rejeita dígito errado', () => {
    expect(isValidGtin('7891000100103')).toBe(true)
    expect(isValidGtin('7891000100104')).toBe(false)
    expect(isValidGtin('123')).toBe(false)
    expect(isValidGtin('78910001001ab')).toBe(false)
  })
  it('UPC-A vira EAN-13 com zero à esquerda', () => {
    expect(normalizeBarcode('036000291452')).toBe('0036000291452')
  })
  it('EAN-8 válido permanece', () => {
    expect(normalizeBarcode('96385074')).toBe('96385074')
  })
  it('UPC-E é expandido', () => {
    expect(upcEtoUpcA('01234565')).toBe('012345000065')
    expect(isValidGtin('012345000065')).toBe(true)
  })
  it('rejeita inválidos', () => {
    expect(normalizeBarcode('7891000100104')).toBeNull()
    expect(normalizeBarcode('abc')).toBeNull()
  })
  it('prefixo brasileiro e shard', () => {
    expect(isBrazilianGtin('7891000100103')).toBe(true)
    expect(isBrazilianGtin('0036000291452')).toBe(false)
    expect(shardKey('7891000100103')).toBe('78910')
    expect(shardKey('96385074')).toBe('00000')
  })
})

describe('decodificação ZXing (imagem sintética)', () => {
  it('lê EAN-13', () => {
    const { w, h, luma } = render('7891000100103')
    const r = decodeLuminance(w, h, luma)
    expect(r?.text).toBe('7891000100103')
    expect(r?.format).toBe('EAN_13')
  })
  it('retorna null sem código', () => {
    const luma = new Uint8ClampedArray(200 * 100).fill(255)
    expect(decodeLuminance(200, 100, luma)).toBeNull()
  })
})
