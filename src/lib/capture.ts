/** Lógica pura da captura unificada (testável sem câmera). */
import type { FoundProduct } from '@/services/lookup'
import type { ParsedLabel, PriceCandidate } from '@/lib/ocr/parseLabel'
import type { Cents } from '@/lib/money'
import type { PriceUnit, Size } from '@/lib/units'
import type { Rect } from '@/services/ocr/preprocess'
import { guessCategory } from '@/domain/categories'
import type { NewCartItem } from '@/store/actions'

export interface CaptureDraft {
  barcode?: string
  name: string
  brand?: string
  category: string
  size?: Size
  priceCents: Cents
  priceUnit: PriceUnit
  bundle?: { qty: number; totalCents: Cents }
  /** quantidade em unidades (un) ou em kg/L (decimal) */
  qty: number
  /** de onde veio a identificação */
  source: 'personal' | 'catalog' | 'off' | 'obf' | 'opf' | 'ocr' | 'manual' | 'barcode'
  origin: 'barcode' | 'ocr' | 'manual'
  candidates: PriceCandidate[]
  warnings: string[]
  /** preço veio de leitura que o usuário ainda precisa confirmar */
  priceNeedsConfirm: boolean
}

export function draftFromFound(f: FoundProduct): CaptureDraft {
  return {
    barcode: f.barcode,
    name: f.name,
    brand: f.brand,
    category: f.category,
    size: f.size,
    priceCents: 0,
    priceUnit: 'un',
    qty: 1,
    source: f.source as CaptureDraft['source'],
    origin: 'barcode',
    candidates: [],
    warnings: [],
    priceNeedsConfirm: true,
  }
}

export function emptyDraft(barcode?: string): CaptureDraft {
  return { barcode, name: '', category: 'geral', priceCents: 0, priceUnit: 'un', qty: 1, source: barcode ? 'barcode' : 'manual', origin: barcode ? 'barcode' : 'manual', candidates: [], warnings: [], priceNeedsConfirm: true }
}

/**
 * Aplica o resultado do OCR. NUNCA preenche um preço incerto: só pré-seleciona
 * quando o parser deu uma sugestão com confiança suficiente.
 */
export function applyLabel(base: CaptureDraft | null, p: ParsedLabel, keepName: boolean): CaptureDraft {
  const d = base ?? emptyDraft()
  const sug = p.confidence !== 'low' ? p.suggested : null
  const unit = sug?.priceUnit ?? 'un'
  return {
    ...d,
    name: keepName && d.name ? d.name : p.name ?? d.name,
    brand: d.brand ?? p.brand ?? undefined,
    category: keepName && d.name ? d.category : p.name ? guessCategory(p.name) : d.category,
    size: d.size ?? (p.size ? { milli: p.size.milli, unit: p.size.unit } : undefined),
    candidates: p.candidates.filter((c) => c.kind !== 'installment'),
    warnings: p.warnings,
    priceCents: sug ? (sug.bundle ? Math.round(sug.bundle.totalCents / sug.bundle.qty) : sug.cents) : 0,
    priceUnit: unit,
    bundle: sug?.bundle,
    qty: 1,
    origin: base?.origin === 'barcode' ? 'barcode' : 'ocr',
    priceNeedsConfirm: true,
  }
}

export function pickCandidate(d: CaptureDraft, c: PriceCandidate): CaptureDraft {
  return {
    ...d,
    priceCents: c.bundle ? Math.round(c.bundle.totalCents / c.bundle.qty) : c.cents,
    priceUnit: c.priceUnit ?? 'un',
    bundle: c.bundle,
    qty: 1,
  }
}

export const canAdd = (d: CaptureDraft): boolean => d.name.trim().length > 0 && d.priceCents > 0 && d.qty > 0

export function toCartItem(d: CaptureDraft): NewCartItem {
  const qtyMilli = d.priceUnit === 'un' ? Math.round(d.qty) * 1000 : Math.round(d.qty * 1000)
  return {
    name: d.name.trim(),
    brand: d.brand,
    barcode: d.barcode,
    category: d.category,
    qtyMilli: Math.max(qtyMilli, 1),
    priceUnit: d.priceUnit,
    unitPriceCents: d.priceCents,
    bundle: d.bundle,
    origin: d.origin,
    size: d.size,
    priceConfirmed: true, // o usuário confirmou na tela
    productSource: d.source === 'ocr' ? 'ocr' : d.source === 'manual' ? 'manual' : d.source === 'barcode' ? 'barcode' : (d.source as NewCartItem['productSource']),
  }
}

/** Região do quadro (fração central) usada no OCR ao tocar em "Ler etiqueta" — evita processar a imagem inteira. */
export function reticleCrop(w: number, h: number): Rect {
  return { x: w * 0.05, y: h * 0.22, w: w * 0.9, h: h * 0.42 }
}

/** Região central usada na detecção contínua de código de barras (leve). */
export function barcodeRegion(vw: number, vh: number): Rect {
  const cw = Math.round(vw * 0.9)
  const ch = Math.round(vh * 0.5)
  return { x: Math.round((vw - cw) / 2), y: Math.max(0, Math.round(vh * 0.42 - ch / 2)), w: cw, h: ch }
}
