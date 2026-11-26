import { getState, setState, enqueue, selectActivePurchase } from './store'
import { toast } from './ui'
import { kvGet, kvSet, getAll, writeBatch, deleteOne, putOne } from '@/storage/db'
import { runMigrations } from '@/storage/migrations'
import { DEFAULT_MARKETS } from '@/storage/legacy'
import { DEFAULT_SETTINGS } from '@/domain/types'
import type {
  CartItem,
  FrequentItem,
  ListData,
  ListMeta,
  ListProduct,
  PaymentMethod,
  PriceRecord,
  Product,
  Purchase,
  Settings,
  Supermarket,
} from '@/domain/types'
import { cartTotals, crossedThreshold, findInCart, lineTotal, budgetStatus } from '@/domain/cart'
import { applyUserEdit, matchProduct, newProduct, type ProductDraft } from '@/domain/catalog'
import { parseMoney, formatBRL, type Cents } from '@/lib/money'
import { uid, normalizeText } from '@/lib/id'
import { haptic, setHapticsEnabled } from './ui'
import { guessCategory } from '@/domain/categories'
import type { PriceUnit } from '@/lib/units'

const nowIso = () => new Date().toISOString()

/* ================= Boot ================= */
export async function boot(storage: Storage = localStorage): Promise<void> {
  try {
    await runMigrations(storage)
    const [settings, lists, active, supermarkets, frequent, products, prices, purchases] = await Promise.all([
      kvGet<Settings>('settings'),
      kvGet<ListMeta[]>('listsMeta'),
      kvGet<string>('activeListId'),
      kvGet<Supermarket[]>('supermarkets'),
      kvGet<Record<string, FrequentItem>>('frequent'),
      getAll<Product>('products'),
      getAll<PriceRecord>('prices'),
      getAll<Purchase>('purchases'),
    ])
    let metas = lists ?? []
    const listData: Record<string, ListData> = {}
    if (!metas.length) {
      const first: ListMeta = { id: 'default', name: 'Minha Lista', createdAt: Date.now() }
      metas = [first]
      const d: ListData = { markets: DEFAULT_MARKETS.map((m) => ({ ...m })), products: [], budget: '0', history: [] }
      await kvSet('listsMeta', metas)
      await kvSet('list:default', d)
    }
    for (const m of metas) listData[m.id] = (await kvGet<ListData>(`list:${m.id}`)) ?? { markets: DEFAULT_MARKETS.map((x) => ({ ...x })), products: [], budget: '0', history: [] }
    const merged = { ...DEFAULT_SETTINGS, ...(settings ?? {}), goals: { ...DEFAULT_SETTINGS.goals, ...(settings?.goals ?? {}) } }
    setHapticsEnabled(merged.haptics)
    setState({
      ready: true,
      storageError: null,
      settings: merged,
      lists: metas,
      activeListId: active && metas.some((m) => m.id === active) ? active : metas[0].id,
      listData,
      supermarkets: supermarkets ?? [],
      frequent: frequent ?? {},
      products,
      prices,
      purchases,
    })
  } catch (e) {
    console.error('[ShopSmart] boot falhou', e)
    // Sem IndexedDB: o app abre vazio, em memória, e avisa o usuário.
    const first: ListMeta = { id: 'default', name: 'Minha Lista', createdAt: Date.now() }
    setState({
      ready: true,
      storageError: 'Este navegador não permite salvar dados (modo privado?). Seus dados não serão mantidos ao fechar o app.',
      lists: [first],
      activeListId: first.id,
      listData: { default: { markets: DEFAULT_MARKETS.map((m) => ({ ...m })), products: [], budget: '0', history: [] } },
    })
  }
}

/** Recarrega tudo do IndexedDB (após restaurar backup / reimportar). */
export async function reloadFromDb(): Promise<void> {
  setState({ ready: false })
  await boot()
}

/* ================= Configurações ================= */
export function updateSettings(patch: Partial<Settings>): void {
  const s = { ...getState().settings, ...patch, goals: { ...getState().settings.goals, ...(patch.goals ?? {}) } }
  setState({ settings: s })
  if (patch.haptics !== undefined) setHapticsEnabled(patch.haptics)
  void enqueue(() => kvSet('settings', s))
}

/* ================= Listas ================= */
function persistList(id: string) {
  const d = getState().listData[id]
  if (d) void enqueue(() => kvSet(`list:${id}`, d))
}
export function setActiveList(id: string) {
  setState({ activeListId: id })
  void enqueue(() => kvSet('activeListId', id))
}
export function addList(name: string): string {
  const id = `l${Date.now()}`
  const meta: ListMeta = { id, name: name.trim() || 'Nova Lista', createdAt: Date.now() }
  const d: ListData = { markets: DEFAULT_MARKETS.map((m) => ({ ...m })), products: [], budget: '0', history: [] }
  const lists = [...getState().lists, meta]
  setState({ lists, listData: { ...getState().listData, [id]: d }, activeListId: id })
  void enqueue(async () => {
    await kvSet(`list:${id}`, d)
    await kvSet('listsMeta', lists)
    await kvSet('activeListId', id)
  })
  return id
}
export function renameList(id: string, name: string) {
  if (!name.trim()) return
  const lists = getState().lists.map((l) => (l.id === id ? { ...l, name: name.trim() } : l))
  setState({ lists })
  void enqueue(() => kvSet('listsMeta', lists))
}
export function deleteList(id: string) {
  const s = getState()
  if (s.lists.length <= 1) return
  const lists = s.lists.filter((l) => l.id !== id)
  const { [id]: _drop, ...rest } = s.listData
  void _drop
  const activeListId = s.activeListId === id ? lists[0].id : s.activeListId
  setState({ lists, listData: rest, activeListId })
  void enqueue(async () => {
    await kvSet('listsMeta', lists)
    await kvSet('activeListId', activeListId)
    await deleteOne('kv', `list:${id}`)
  })
}
export function updateList(id: string, fn: (d: ListData) => ListData) {
  const cur = getState().listData[id]
  if (!cur) return
  setState({ listData: { ...getState().listData, [id]: fn(cur) } })
  persistList(id)
}

export function trackFrequent(name: string, category: string) {
  const n = name.trim()
  if (!n) return
  const key = n.toLowerCase()
  const cur = getState().frequent
  const prev = cur[key]
  const next = { ...cur, [key]: { name: prev?.name || n, category: category || prev?.category || 'geral', count: (prev?.count || 0) + 1 } }
  setState({ frequent: next })
  void enqueue(() => kvSet('frequent', next))
}

export function addListProduct(listId: string, name: string, category = 'geral', extra: Partial<ListProduct> = {}) {
  const n = name.trim()
  if (!n) return
  updateList(listId, (d) => {
    const prices: Record<string, string> = {}
    d.markets.forEach((m) => (prices[m.id] = ''))
    const p: ListProduct = { id: uid('lp'), name: n, quantity: 1, prices, category, isEssential: false, inCart: false, note: '', ...extra }
    return { ...d, products: [p, ...d.products] }
  })
  trackFrequent(n, category)
}

/* ================= Supermercados ================= */
export function ensureSupermarket(name: string, city?: string): Supermarket {
  const n = name.trim()
  const key = normalizeText(n)
  const found = getState().supermarkets.find((m) => normalizeText(m.name) === key && (!city || !m.city || normalizeText(m.city) === normalizeText(city)))
  if (found) {
    if (city && !found.city) {
      const upd = getState().supermarkets.map((m) => (m.id === found.id ? { ...m, city } : m))
      setState({ supermarkets: upd })
      void enqueue(() => kvSet('supermarkets', upd))
      return { ...found, city }
    }
    return found
  }
  const m: Supermarket = { id: uid('mk-'), name: n, city: city?.trim() || undefined, createdAt: Date.now() }
  const list = [...getState().supermarkets, m]
  setState({ supermarkets: list })
  void enqueue(() => kvSet('supermarkets', list))
  return m
}
export function deleteSupermarket(id: string) {
  const list = getState().supermarkets.filter((m) => m.id !== id)
  setState({ supermarkets: list })
  void enqueue(() => kvSet('supermarkets', list))
}

/* ================= Catálogo pessoal ================= */
export function saveProduct(p: Product) {
  const products = [...getState().products.filter((x) => x.id !== p.id), p]
  setState({ products })
  void enqueue(() => putOne('products', p))
}
export function editProduct(id: string, patch: Partial<Pick<Product, 'name' | 'brand' | 'category'>>) {
  const cur = getState().products.find((p) => p.id === id)
  if (!cur) return
  saveProduct(applyUserEdit(cur, patch))
}
export function removeProduct(id: string) {
  setState({ products: getState().products.filter((p) => p.id !== id) })
  void enqueue(() => deleteOne('products', id))
}

/** Reconhece o produto no catálogo pessoal ou cria um novo ("aprende" produtos desconhecidos). */
export function learnProduct(d: ProductDraft): Product {
  const existing = matchProduct(getState().products, d)
  if (existing) {
    // completa lacunas sem sobrescrever campos corrigidos pelo usuário
    let next = existing
    if (d.barcode && !existing.barcode) next = { ...next, barcode: d.barcode, updatedAt: Date.now() }
    if (!existing.size && d.size) next = { ...next, size: d.size, updatedAt: Date.now() }
    if (next !== existing) saveProduct(next)
    return next
  }
  const p = newProduct(d)
  saveProduct(p)
  return p
}

/* ================= Sessão de compra ================= */
export interface StartPurchaseInput {
  supermarketName: string
  city?: string
  listId?: string
  budgetCents: Cents
}

function persistPurchase(p: Purchase) {
  void enqueue(() => putOne('purchases', p))
}
function replacePurchase(p: Purchase) {
  const purchases = getState().purchases.some((x) => x.id === p.id) ? getState().purchases.map((x) => (x.id === p.id ? p : x)) : [...getState().purchases, p]
  setState({ purchases })
  persistPurchase(p)
}

export function startPurchase(input: StartPurchaseInput): Purchase {
  const existing = selectActivePurchase(getState())
  if (existing) return existing // só uma sessão ativa por vez
  const mk = ensureSupermarket(input.supermarketName, input.city)
  const t = nowIso()
  const p: Purchase = {
    id: uid('pu-'),
    status: 'active',
    supermarketId: mk.id,
    supermarketName: mk.name,
    city: input.city?.trim() || mk.city,
    listId: input.listId,
    budgetCents: input.budgetCents,
    items: [],
    checkoutDiscountCents: 0,
    startedAt: t,
    updatedAt: t,
  }
  replacePurchase(p)
  haptic('tap')
  return p
}

export interface NewCartItem {
  name: string
  brand?: string
  barcode?: string
  category?: string
  qtyMilli: number
  priceUnit: PriceUnit
  unitPriceCents: Cents
  discountCents?: number
  bundle?: CartItem['bundle']
  origin: CartItem['origin']
  size?: Product['size']
  productId?: string
  priceConfirmed?: boolean
  note?: string
  /** origem da identificação do produto, para o catálogo pessoal */
  productSource?: Product['source']
}

export interface AddResult {
  item: CartItem
  merged: boolean
  alert: 'w80' | 'w90' | 'over' | null
}

export function addCartItem(input: NewCartItem): AddResult | null {
  const purchase = selectActivePurchase(getState())
  if (!purchase) return null
  const name = input.name.trim()
  if (!name || !(input.unitPriceCents >= 0) || input.qtyMilli <= 0) return null
  const product = learnProduct({
    barcode: input.barcode,
    name,
    brand: input.brand,
    category: input.category ?? guessCategory(name),
    size: input.size,
    unit: input.priceUnit,
    source: input.productSource ?? (input.origin === 'ocr' ? 'ocr' : input.origin === 'barcode' ? 'barcode' : 'manual'),
  })
  const before = cartTotals(purchase.items, purchase.checkoutDiscountCents).totalCents
  let items = purchase.items
  let result: CartItem
  let merged = false
  const dup = findInCart(items, { barcode: input.barcode, productId: product.id })
  if (dup && dup.unitPriceCents === input.unitPriceCents && dup.priceUnit === input.priceUnit && !dup.bundle && !input.bundle) {
    // mesmo produto e mesmo preço: soma a quantidade em vez de duplicar a linha
    result = { ...dup, qtyMilli: dup.qtyMilli + input.qtyMilli, discountCents: (dup.discountCents || 0) + (input.discountCents ?? 0) }
    items = items.map((i) => (i.id === dup.id ? result : i))
    merged = true
  } else {
    // vincula a um item da lista (marca como no carrinho)
    let listItemId: string | undefined
    if (purchase.listId) {
      const d = getState().listData[purchase.listId]
      const match = d?.products.find((p) => !p.inCart && ((p.productId && p.productId === product.id) || (input.barcode && p.barcode === input.barcode) || normalizeText(p.name) === normalizeText(name)))
      if (match) {
        listItemId = match.id
        updateList(purchase.listId, (dd) => ({ ...dd, products: dd.products.map((p) => (p.id === match.id ? { ...p, inCart: true, productId: product.id } : p)) }))
      }
    }
    result = {
      id: uid('ci-'),
      productId: product.id,
      name: product.name,
      brand: input.brand ?? product.brand,
      barcode: input.barcode ?? product.barcode,
      category: product.category,
      qtyMilli: input.qtyMilli,
      priceUnit: input.priceUnit,
      unitPriceCents: input.unitPriceCents,
      discountCents: input.discountCents ?? 0,
      bundle: input.bundle,
      origin: input.origin,
      listItemId,
      addedAt: Date.now(),
      note: input.note,
      priceConfirmed: input.priceConfirmed ?? true,
    }
    items = [result, ...items]
  }
  const next: Purchase = { ...purchase, items, updatedAt: nowIso() }
  replacePurchase(next)
  trackFrequent(name, product.category)
  const after = cartTotals(items, next.checkoutDiscountCents).totalCents
  const alert = crossedThreshold(before, after, next.budgetCents)
  haptic(alert ? 'warn' : 'success')
  return { item: result, merged, alert }
}

export function updateCartItem(itemId: string, patch: Partial<CartItem>): void {
  const p = selectActivePurchase(getState())
  if (!p) return
  const before = cartTotals(p.items, p.checkoutDiscountCents).totalCents
  const next: Purchase = { ...p, items: p.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)), updatedAt: nowIso() }
  replacePurchase(next)
  const after = cartTotals(next.items, next.checkoutDiscountCents).totalCents
  const c = crossedThreshold(before, after, next.budgetCents)
  if (c) budgetToast(c)
}

export function changeQty(itemId: string, deltaMilli: number): void {
  const p = selectActivePurchase(getState())
  const it = p?.items.find((i) => i.id === itemId)
  if (!p || !it) return
  const q = it.qtyMilli + deltaMilli
  if (q <= 0) return
  updateCartItem(itemId, { qtyMilli: q })
  haptic('tap')
}

export function removeCartItem(itemId: string): { item: CartItem; index: number } | null {
  const p = selectActivePurchase(getState())
  if (!p) return null
  const index = p.items.findIndex((i) => i.id === itemId)
  if (index < 0) return null
  const item = p.items[index]
  replacePurchase({ ...p, items: p.items.filter((i) => i.id !== itemId), updatedAt: nowIso() })
  if (item.listItemId && p.listId) updateList(p.listId, (d) => ({ ...d, products: d.products.map((lp) => (lp.id === item.listItemId ? { ...lp, inCart: false } : lp)) }))
  haptic('tap')
  return { item, index }
}

export function restoreCartItem(item: CartItem, index: number): void {
  const p = selectActivePurchase(getState())
  if (!p || p.items.some((i) => i.id === item.id)) return
  const items = [...p.items]
  items.splice(Math.min(index, items.length), 0, item)
  replacePurchase({ ...p, items, updatedAt: nowIso() })
  if (item.listItemId && p.listId) updateList(p.listId, (d) => ({ ...d, products: d.products.map((lp) => (lp.id === item.listItemId ? { ...lp, inCart: true } : lp)) }))
}

export function setCheckoutDiscount(cents: Cents): void {
  const p = selectActivePurchase(getState())
  if (!p) return
  replacePurchase({ ...p, checkoutDiscountCents: Math.max(0, cents), updatedAt: nowIso() })
}
export function setPurchaseBudget(cents: Cents): void {
  const p = selectActivePurchase(getState())
  if (!p) return
  replacePurchase({ ...p, budgetCents: Math.max(0, cents), updatedAt: nowIso() })
}

function budgetToast(level: 'w80' | 'w90' | 'over') {
  toast(level === 'w80' ? 'Você já usou 80% do orçamento.' : level === 'w90' ? 'Atenção: 90% do orçamento utilizado.' : 'Orçamento ultrapassado. Você pode continuar comprando.', level === 'over' ? 'error' : 'warn')
}
export { budgetToast }

export interface FinalizeInput {
  paidCents?: Cents
  paymentMethod?: PaymentMethod
  note?: string
  /** quando o usuário corrige os preços após passar no caixa */
  items?: CartItem[]
  checkoutDiscountCents?: Cents
}

/**
 * Finaliza a compra. Idempotente: chamar duas vezes (duplo toque, retry) nunca contabiliza duas vezes —
 * a segunda chamada devolve a compra já finalizada sem alterar nada.
 */
export function finalizePurchase(id: string, input: FinalizeInput = {}): Purchase | null {
  const cur = getState().purchases.find((p) => p.id === id)
  if (!cur) return null
  if (cur.status === 'finalized') return cur
  if (cur.status === 'cancelled') return null
  const items = input.items ?? cur.items
  const checkoutDiscountCents = input.checkoutDiscountCents ?? cur.checkoutDiscountCents
  const totals = cartTotals(items, checkoutDiscountCents)
  const finishedAt = nowIso()
  const paid = input.paidCents ?? totals.totalCents
  const done: Purchase = {
    ...cur,
    items,
    checkoutDiscountCents,
    status: 'finalized',
    finishedAt,
    updatedAt: finishedAt,
    estimatedCents: cartTotals(cur.items, cur.checkoutDiscountCents).totalCents,
    paidCents: paid,
    paymentMethod: input.paymentMethod,
    note: input.note?.trim() || undefined,
  }
  // histórico de preços: id determinístico por (compra, item) → regravar nunca duplica
  const newPrices: PriceRecord[] = items.map((it) => {
    const gross = lineTotal(it)
    // preço efetivo por unidade-base, já com promoções/descontos da linha
    const unit = it.qtyMilli > 0 ? Math.round((gross * 1000) / it.qtyMilli) : it.unitPriceCents
    return {
      id: `${id}:${it.id}`,
      productId: it.productId ?? `name:${normalizeText(it.name)}`,
      barcode: it.barcode,
      supermarketId: done.supermarketId,
      supermarketName: done.supermarketName,
      city: done.city,
      unitPriceCents: unit,
      priceUnit: it.priceUnit,
      lineCents: gross,
      date: finishedAt,
      promo: !!(it.bundle || it.discountCents),
      kind: 'paid',
      purchaseId: id,
    }
  })
  const touched = new Set(items.map((i) => i.productId).filter(Boolean) as string[])
  const products = getState().products.map((p) => (touched.has(p.id) ? { ...p, lastPurchasedAt: Date.now(), purchaseCount: p.purchaseCount + 1, updatedAt: Date.now() } : p))
  const changedProducts = products.filter((p) => touched.has(p.id))
  const purchases = getState().purchases.map((p) => (p.id === id ? done : p))
  const prices = [...getState().prices.filter((r) => r.purchaseId !== id), ...newPrices]
  setState({ purchases, prices, products })
  void enqueue(() =>
    writeBatch([
      { store: 'prices', put: newPrices },
      { store: 'products', put: changedProducts },
      { store: 'purchases', put: [done] },
    ]),
  )
  haptic('success')
  return done
}

export function cancelPurchase(id: string): void {
  const cur = getState().purchases.find((p) => p.id === id)
  if (!cur || cur.status !== 'active') return
  const t = nowIso()
  // itens marcados na lista voltam a pendente
  if (cur.listId) {
    const ids = new Set(cur.items.map((i) => i.listItemId).filter(Boolean))
    if (ids.size) updateList(cur.listId, (d) => ({ ...d, products: d.products.map((p) => (ids.has(p.id) ? { ...p, inCart: false } : p)) }))
  }
  replacePurchase({ ...cur, status: 'cancelled', cancelledAt: t, updatedAt: t })
}

export function deletePurchase(id: string): void {
  const removed = getState().prices.filter((r) => r.purchaseId === id).map((r) => r.id)
  setState({ purchases: getState().purchases.filter((p) => p.id !== id), prices: getState().prices.filter((r) => r.purchaseId !== id) })
  void enqueue(() =>
    writeBatch([
      { store: 'purchases', delete: [id] },
      { store: 'prices', delete: removed },
    ]),
  )
}

/** Cria uma compra finalizada a partir da lista (fluxo "Concluir compra" da v1, agora integrado às finanças). */
export function finalizeFromList(listId: string, marketId: string): Purchase | null {
  const d = getState().listData[listId]
  const m = d?.markets.find((x) => x.id === marketId)
  if (!d || !m) return null
  const items: CartItem[] = []
  for (const p of d.products) {
    const c = parseMoney(p.prices?.[marketId])
    if (c === null || c <= 0) continue
    items.push({
      id: uid('ci-'),
      productId: p.productId,
      name: p.name,
      barcode: p.barcode,
      category: p.category,
      qtyMilli: Math.max(1, p.quantity) * 1000,
      priceUnit: 'un',
      unitPriceCents: c,
      discountCents: 0,
      origin: 'list',
      listItemId: p.id,
      addedAt: Date.now(),
      priceConfirmed: false,
    })
  }
  if (!items.length) return null
  const mk = ensureSupermarket(m.name)
  const pct = parseFloat((m.discountPercent || '0').replace(',', '.')) || 0
  const sub = cartTotals(items).totalCents
  const discount = pct > 0 ? Math.round((sub * pct) / 100) : 0
  const t = nowIso()
  const purchase: Purchase = {
    id: uid('pu-'),
    status: 'active',
    supermarketId: mk.id,
    supermarketName: mk.name,
    listId,
    budgetCents: parseMoney(d.budget) ?? 0,
    items,
    checkoutDiscountCents: discount,
    startedAt: t,
    updatedAt: t,
  }
  const purchases = [...getState().purchases, purchase]
  setState({ purchases })
  return finalizePurchase(purchase.id, { note: 'Registrada a partir da lista' })
}

/* ================= Utilidades ================= */
export function activeBudgetStatus(p: Purchase) {
  return budgetStatus(cartTotals(p.items, p.checkoutDiscountCents).totalCents, p.budgetCents)
}
export const money = formatBRL
