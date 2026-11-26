import { mulDiv, type Cents } from './money'

/** Unidade em que o preço é cobrado. */
export type PriceUnit = 'un' | 'kg' | 'l'
/** Unidades aceitas para digitar quantidade. */
export type QtyUnit = 'un' | 'kg' | 'g' | 'l' | 'ml'

export const PRICE_UNIT_LABEL: Record<PriceUnit, string> = { un: 'un', kg: 'kg', l: 'L' }
export const QTY_UNIT_LABEL: Record<QtyUnit, string> = { un: 'un', kg: 'kg', g: 'g', l: 'L', ml: 'mL' }

/** Quantidade é guardada em milésimos da unidade-base de preço (2 un = 2000; 532 g com preço/kg = 532). */
export type QtyMilli = number

export function priceUnitOf(u: QtyUnit): PriceUnit {
  if (u === 'kg' || u === 'g') return 'kg'
  if (u === 'l' || u === 'ml') return 'l'
  return 'un'
}

/** Converte quantidade digitada na unidade escolhida para milésimos da unidade-base. */
export function toQtyMilli(value: number, unit: QtyUnit): QtyMilli {
  if (!Number.isFinite(value) || value < 0) return 0
  switch (unit) {
    case 'un':
      return Math.round(value) * 1000
    case 'kg':
    case 'l':
      return Math.round(value * 1000)
    case 'g':
    case 'ml':
      return Math.round(value)
  }
}

/** Texto amigável para a quantidade. */
export function formatQty(q: QtyMilli, unit: PriceUnit): string {
  if (unit === 'un') return `${Math.round(q / 1000)} un`
  if (q < 1000) return `${q} ${unit === 'kg' ? 'g' : 'mL'}`
  const v = (q / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
  return `${v} ${PRICE_UNIT_LABEL[unit]}`
}

/** Total (centavos) de unitPrice × quantidade, em aritmética inteira. */
export function lineAmount(unitPriceCents: Cents, qtyMilli: QtyMilli): Cents {
  return mulDiv(unitPriceCents, qtyMilli, 1000)
}

export interface Size {
  /** Quantidade na unidade-base (kg, L ou un) × 1000. */
  milli: number
  unit: PriceUnit
}

/** Interpreta "500g", "1,5 L", "2 kg", "350 ml", "12 un". */
export function parseSize(text: string): Size | null {
  const m = text
    .toLowerCase()
    .replace(',', '.')
    .match(/(\d+(?:\.\d+)?)\s*(kg|g|gr|mg|ml|l|lt|litros?|un|und|unid|unidades?)\b/)
  if (!m) return null
  const n = parseFloat(m[1])
  const u = m[2]
  if (u === 'kg') return { milli: Math.round(n * 1000), unit: 'kg' }
  if (u === 'g' || u === 'gr') return { milli: Math.round(n), unit: 'kg' }
  if (u === 'mg') return { milli: Math.round(n / 1000), unit: 'kg' }
  if (u === 'ml') return { milli: Math.round(n), unit: 'l' }
  if (u === 'l' || u === 'lt' || u.startsWith('litro')) return { milli: Math.round(n * 1000), unit: 'l' }
  return { milli: Math.round(n) * 1000, unit: 'un' }
}

/** Preço por kg/L/un de uma embalagem (centavos por unidade-base). Retorna null se tamanho inválido. */
export function pricePerBase(priceCents: Cents, size: Size): Cents | null {
  if (!size.milli) return null
  return mulDiv(priceCents, 1000, size.milli)
}

/** "500 g", "1,5 L", "12 un" a partir de um tamanho de embalagem. */
export function formatSizeText(s: Size): string {
  if (s.unit === 'un') return `${s.milli / 1000} un`
  if (s.milli >= 1000) return `${(s.milli / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${s.unit === 'kg' ? 'kg' : 'L'}`
  return `${s.milli} ${s.unit === 'kg' ? 'g' : 'mL'}`
}
