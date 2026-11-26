import type { Cents } from '@/lib/money'
import type { PriceUnit } from '@/lib/units'

/* ---------- Listas (formato compatível com a v1) ---------- */
export interface ListMeta {
  id: string
  name: string
  createdAt: number
}
export interface ListMarket {
  id: string
  name: string
  /** string, como na v1 (ex.: "5" = 5%) */
  discountPercent: string
  /** custo de deslocamento até este mercado, em centavos (opcional) */
  travelCostCents?: Cents
}
export interface ListProduct {
  id: string
  name: string
  quantity: number
  /** preço por mercado, string decimal como na v1 ("12.50") */
  prices: Record<string, string>
  category: string
  isEssential: boolean
  inCart: boolean
  note: string
  /** ligação opcional com o catálogo pessoal */
  productId?: string
  barcode?: string
  /** tamanho da embalagem para comparar preço por kg/L */
  packSize?: { milli: number; unit: PriceUnit }
}
export interface LegacyHistoryEntry {
  id: string
  date: string
  marketName: string
  total: number
  itemCount: number
  boughtCount: number
}
export interface ListData {
  markets: ListMarket[]
  products: ListProduct[]
  budget: string
  history: LegacyHistoryEntry[]
}

/* ---------- Catálogo pessoal ---------- */
export type ProductSource = 'manual' | 'ocr' | 'barcode' | 'personal' | 'catalog' | 'off' | 'obf' | 'opf' | 'migrated' | 'list'

export interface Product {
  id: string
  barcode?: string
  name: string
  brand?: string
  category: string
  /** tamanho da embalagem, ex.: 5 kg → {milli:5000, unit:'kg'} */
  size?: { milli: number; unit: PriceUnit }
  unit: PriceUnit
  firstSeenAt: number
  lastPurchasedAt?: number
  purchaseCount: number
  source: ProductSource
  /** campos que o usuário corrigiu: atualizações externas não podem sobrescrever */
  userEdited?: { name?: boolean; category?: boolean; brand?: boolean }
  updatedAt: number
}

export interface PriceRecord {
  id: string
  productId: string
  barcode?: string
  supermarketId?: string
  supermarketName: string
  city?: string
  /** preço por unidade-base (un/kg/L) em centavos, já considerando promoção unitária */
  unitPriceCents: Cents
  priceUnit: PriceUnit
  /** valor pago por esta compra (linha), para auditoria */
  lineCents: Cents
  date: string // ISO
  promo?: boolean
  /** 'paid' = registrado no fechamento de uma compra; 'observed' = visto na etiqueta durante a compra */
  kind: 'paid' | 'observed'
  purchaseId?: string
}

/* ---------- Supermercados ---------- */
export interface Supermarket {
  id: string
  name: string
  city?: string
  createdAt: number
}

/* ---------- Compra ---------- */
export type PurchaseStatus = 'active' | 'finalized' | 'cancelled'
export type ItemOrigin = 'ocr' | 'barcode' | 'manual' | 'list' | 'migrated'

export interface CartItem {
  id: string
  productId?: string
  name: string
  brand?: string
  barcode?: string
  category: string
  /** milésimos da unidade-base (2 un = 2000, 532 g = 532 com unidade kg) */
  qtyMilli: number
  priceUnit: PriceUnit
  unitPriceCents: Cents
  /** desconto total da linha, em centavos */
  discountCents: Cents
  /** promoção "leve N por R$ X" (somente para un) */
  bundle?: { qty: number; totalCents: Cents }
  origin: ItemOrigin
  listItemId?: string
  addedAt: number
  note?: string
  /** sinaliza que o preço veio da etiqueta confirmada (vs. digitado/estimado) */
  priceConfirmed: boolean
}

export type PaymentMethod = 'dinheiro' | 'debito' | 'credito' | 'pix' | 'vale' | 'outro'

export interface Purchase {
  /** identificador único; é a chave de idempotência da finalização */
  id: string
  status: PurchaseStatus
  supermarketId?: string
  supermarketName: string
  city?: string
  listId?: string
  budgetCents: Cents
  items: CartItem[]
  /** desconto aplicado no caixa (além dos descontos por item) */
  checkoutDiscountCents: Cents
  startedAt: string
  updatedAt: string
  finishedAt?: string
  cancelledAt?: string
  /** valor estimado no momento de finalizar */
  estimatedCents?: Cents
  paidCents?: Cents
  paymentMethod?: PaymentMethod
  note?: string
  /** compras importadas da v1 não têm itens detalhados */
  legacy?: boolean
}

/* ---------- Configurações ---------- */
export interface Goals {
  monthlyBudgetCents: Cents
  /** meta de economia mensal em centavos (0 = sem meta) */
  monthlySavingsGoalCents: Cents
  /** limite de gasto por compra (0 = nenhum) */
  perPurchaseLimitCents: Cents
}
export interface Settings {
  haptics: boolean
  reducedMotion: 'system' | 'on' | 'off'
  defaultCity: string
  /** guardar a foto das etiquetas após o OCR (padrão: descartar) */
  keepOcrPhotos: boolean
  goals: Goals
  catalogLookupExternal: boolean
}
export const DEFAULT_SETTINGS: Settings = {
  haptics: true,
  reducedMotion: 'system',
  defaultCity: '',
  keepOcrPhotos: false,
  goals: { monthlyBudgetCents: 0, monthlySavingsGoalCents: 0, perPurchaseLimitCents: 0 },
  catalogLookupExternal: true,
}

export interface FrequentItem {
  name: string
  category: string
  count: number
}

export const SCHEMA_VERSION = 2
