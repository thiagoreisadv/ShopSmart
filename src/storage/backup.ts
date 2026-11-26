import { getAll, putMany, openDb, kvGet, kvSet, kvKeys, kvDelete, type StoreName } from './db'
import { SCHEMA_VERSION } from '@/domain/types'
import type { ListData, ListMeta, Product, PriceRecord, Purchase, Supermarket, Settings, FrequentItem } from '@/domain/types'
import { formatDecimal } from '@/lib/money'
import { formatQty } from '@/lib/units'
import { lineTotal } from '@/domain/cart'
import { categoryById } from '@/domain/categories'
import { uid } from '@/lib/id'

export const BACKUP_FORMAT = 'shopsmart-backup'

export interface BackupData {
  settings?: Settings
  listsMeta?: ListMeta[]
  activeListId?: string
  lists?: Record<string, ListData>
  supermarkets?: Supermarket[]
  frequent?: Record<string, FrequentItem>
  products: Product[]
  prices: PriceRecord[]
  purchases: Purchase[]
}
export interface BackupFile {
  format: typeof BACKUP_FORMAT
  schemaVersion: number
  app: 'ShopSmart'
  exportedAt: string
  data: BackupData
  /** cópia bruta das chaves shopsmart_* da v1 (calculadoras, tema...) */
  localStorage?: Record<string, string>
}

const KV_DATA_KEYS = ['settings', 'listsMeta', 'activeListId', 'supermarkets', 'frequent'] as const

export async function dumpAll(storage?: Storage): Promise<BackupFile> {
  const lists: Record<string, ListData> = {}
  const meta = (await kvGet<ListMeta[]>('listsMeta')) ?? []
  for (const l of meta) {
    const d = await kvGet<ListData>(`list:${l.id}`)
    if (d) lists[l.id] = d
  }
  const data: BackupData = {
    settings: await kvGet<Settings>('settings'),
    listsMeta: meta,
    activeListId: await kvGet<string>('activeListId'),
    lists,
    supermarkets: (await kvGet<Supermarket[]>('supermarkets')) ?? [],
    frequent: (await kvGet<Record<string, FrequentItem>>('frequent')) ?? {},
    products: await getAll<Product>('products'),
    prices: await getAll<PriceRecord>('prices'),
    purchases: await getAll<Purchase>('purchases'),
  }
  const file: BackupFile = { format: BACKUP_FORMAT, schemaVersion: SCHEMA_VERSION, app: 'ShopSmart', exportedAt: new Date().toISOString(), data }
  if (storage) {
    const raw: Record<string, string> = {}
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i)
      if (k && k.startsWith('shopsmart_')) raw[k] = storage.getItem(k) ?? ''
    }
    file.localStorage = raw
  }
  return file
}

/** Backup lógico guardado no próprio dispositivo antes de migrações/restaurações. Mantém os 3 mais recentes. */
export async function createLogicalBackup(reason: string, storage?: Storage): Promise<string> {
  const file = await dumpAll(storage)
  const key = `backup:${Date.now()}-${reason}`
  await kvSet(key, file)
  const keys = (await kvKeys('backup:')).sort()
  for (const k of keys.slice(0, Math.max(0, keys.length - 3))) await kvDelete(k)
  return key
}
export async function listLogicalBackups(): Promise<{ key: string; at: number; reason: string }[]> {
  return (await kvKeys('backup:'))
    .sort()
    .reverse()
    .map((key) => {
      const m = key.match(/^backup:(\d+)-(.*)$/)
      return { key, at: m ? Number(m[1]) : 0, reason: m?.[2] ?? '' }
    })
}
export async function readLogicalBackup(key: string): Promise<BackupFile | undefined> {
  return kvGet<BackupFile>(key)
}

/* ---------- Validação ---------- */
export interface ParseResult {
  ok: boolean
  error?: string
  file?: BackupFile
  /** arquivo no formato da lista da v1 */
  legacyList?: { name: string; markets: ListData['markets']; products: ListData['products']; budget: string }
  summary?: { lists: number; products: number; purchases: number; prices: number; supermarkets: number }
  warnings: string[]
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function parseBackup(text: string): ParseResult {
  const warnings: string[] = []
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: 'O arquivo não é um JSON válido.', warnings }
  }
  if (!isObj(json)) return { ok: false, error: 'Estrutura inesperada.', warnings }
  // Exportação de lista da v1
  if (Array.isArray(json.products) && Array.isArray(json.markets) && !json.format) {
    return {
      ok: true,
      warnings,
      legacyList: {
        name: typeof json.name === 'string' ? json.name : 'Lista importada',
        markets: json.markets as ListData['markets'],
        products: json.products as ListData['products'],
        budget: json.budget === undefined ? '0' : String(json.budget),
      },
      summary: { lists: 1, products: (json.products as unknown[]).length, purchases: 0, prices: 0, supermarkets: 0 },
    }
  }
  if (json.format !== BACKUP_FORMAT) return { ok: false, error: 'Este arquivo não é um backup do ShopSmart.', warnings }
  if (typeof json.schemaVersion !== 'number') return { ok: false, error: 'Versão do backup ausente.', warnings }
  if (json.schemaVersion > SCHEMA_VERSION) return { ok: false, error: 'Este backup foi gerado por uma versão mais nova do app.', warnings }
  if (!isObj(json.data)) return { ok: false, error: 'Dados do backup ausentes.', warnings }
  const d = json.data
  const arr = (k: string) => (Array.isArray(d[k]) ? (d[k] as unknown[]) : [])
  const products = arr('products').filter((p) => isObj(p) && typeof p.id === 'string' && typeof p.name === 'string')
  const prices = arr('prices').filter((p) => isObj(p) && typeof p.id === 'string' && typeof p.productId === 'string' && Number.isInteger(p.unitPriceCents))
  const purchases = arr('purchases').filter(
    (p) => isObj(p) && typeof p.id === 'string' && typeof p.status === 'string' && Array.isArray(p.items),
  )
  const dropped = arr('products').length - products.length + (arr('prices').length - prices.length) + (arr('purchases').length - purchases.length)
  if (dropped) warnings.push(`${dropped} registro(s) inválido(s) serão ignorados.`)
  const lists = isObj(d.lists) ? d.lists : {}
  const file: BackupFile = {
    format: BACKUP_FORMAT,
    schemaVersion: json.schemaVersion,
    app: 'ShopSmart',
    exportedAt: typeof json.exportedAt === 'string' ? json.exportedAt : new Date().toISOString(),
    data: {
      settings: isObj(d.settings) ? (d.settings as unknown as Settings) : undefined,
      listsMeta: arr('listsMeta') as ListMeta[],
      activeListId: typeof d.activeListId === 'string' ? d.activeListId : undefined,
      lists: lists as Record<string, ListData>,
      supermarkets: arr('supermarkets') as Supermarket[],
      frequent: isObj(d.frequent) ? (d.frequent as Record<string, FrequentItem>) : {},
      products: products as unknown as Product[],
      prices: prices as unknown as PriceRecord[],
      purchases: purchases as unknown as Purchase[],
    },
    localStorage: isObj(json.localStorage) ? (json.localStorage as Record<string, string>) : undefined,
  }
  return {
    ok: true,
    file,
    warnings,
    summary: {
      lists: file.data.listsMeta?.length ?? 0,
      products: products.length,
      purchases: purchases.length,
      prices: prices.length,
      supermarkets: file.data.supermarkets?.length ?? 0,
    },
  }
}

/* ---------- Restauração ---------- */
export interface RestoreReport {
  added: number
  updated: number
  skippedDuplicates: number
  safetyBackupKey: string
}

async function mergeStore<T extends { id: string }>(store: StoreName, incoming: T[], newer: (a: T, b: T) => boolean): Promise<{ added: number; updated: number; dup: number }> {
  const existing = new Map((await getAll<T>(store)).map((x) => [x.id, x]))
  const toPut: T[] = []
  let added = 0
  let updated = 0
  let dup = 0
  for (const rec of incoming) {
    const cur = existing.get(rec.id)
    if (!cur) {
      toPut.push(rec)
      added++
    } else if (newer(rec, cur)) {
      toPut.push(rec)
      updated++
    } else dup++
  }
  await putMany(store, toPut)
  return { added, updated, dup }
}

const ts = (r: { updatedAt?: string | number }) => (typeof r.updatedAt === 'number' ? r.updatedAt : r.updatedAt ? Date.parse(r.updatedAt) : 0)

/**
 * mode 'merge': soma ao que existe (ids repetidos: vence o mais recente; compra finalizada nunca é sobrescrita por ativa).
 * mode 'replace': substitui tudo (exige confirmação na UI). Sempre cria backup de segurança antes.
 */
export async function restoreBackup(file: BackupFile, mode: 'merge' | 'replace', storage?: Storage): Promise<RestoreReport> {
  const safetyBackupKey = await createLogicalBackup(`antes-restaurar-${mode}`, storage)
  await openDb()
  const d = file.data
  let added = 0
  let updated = 0
  let dup = 0
  if (mode === 'replace') {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['products', 'prices', 'purchases'], 'readwrite')
      tx.objectStore('products').clear()
      tx.objectStore('prices').clear()
      tx.objectStore('purchases').clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    for (const k of KV_DATA_KEYS) await kvDelete(k)
    for (const k of await kvKeys('list:')) await kvDelete(k)
  }
  const r1 = await mergeStore<Product>('products', d.products, (a, b) => (a.updatedAt ?? 0) > (b.updatedAt ?? 0))
  const r2 = await mergeStore<PriceRecord>('prices', d.prices, () => false)
  const r3 = await mergeStore<Purchase>('purchases', d.purchases, (a, b) => !(b.status === 'finalized' && a.status !== 'finalized') && ts(a) > ts(b))
  for (const r of [r1, r2, r3]) {
    added += r.added
    updated += r.updated
    dup += r.dup
  }
  // Listas
  const meta = (await kvGet<ListMeta[]>('listsMeta')) ?? []
  const metaIds = new Set(meta.map((m) => m.id))
  for (const l of d.listsMeta ?? []) {
    if (!metaIds.has(l.id)) {
      meta.push(l)
      added++
      if (d.lists?.[l.id]) await kvSet(`list:${l.id}`, d.lists[l.id])
    } else dup++
  }
  if (meta.length) await kvSet('listsMeta', meta)
  if (d.supermarkets?.length) {
    const cur = (await kvGet<Supermarket[]>('supermarkets')) ?? []
    const ids = new Set(cur.map((s) => s.id))
    await kvSet('supermarkets', [...cur, ...d.supermarkets.filter((s) => !ids.has(s.id))])
  }
  if (d.frequent) {
    const cur = (await kvGet<Record<string, FrequentItem>>('frequent')) ?? {}
    for (const [k, v] of Object.entries(d.frequent)) cur[k] = cur[k] ? { ...cur[k], count: Math.max(cur[k].count, v.count) } : v
    await kvSet('frequent', cur)
  }
  if (mode === 'replace' && d.settings) await kvSet('settings', d.settings)
  if (mode === 'replace' && d.activeListId) await kvSet('activeListId', d.activeListId)
  return { added, updated, skippedDuplicates: dup, safetyBackupKey }
}

/** Importa uma lista exportada pela v1 como nova lista. */
export async function importLegacyListFile(l: NonNullable<ParseResult['legacyList']>): Promise<ListMeta> {
  const meta = (await kvGet<ListMeta[]>('listsMeta')) ?? []
  const id = uid('l')
  const entry: ListMeta = { id, name: l.name || 'Lista importada', createdAt: Date.now() }
  await kvSet(`list:${id}`, { markets: l.markets, products: l.products, budget: l.budget, history: [] } satisfies ListData)
  await kvSet('listsMeta', [...meta, entry])
  return entry
}

/* ---------- CSV ---------- */
const csvCell = (v: string | number) => {
  const s = String(v)
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV financeiro (separador ";" e vírgula decimal, abre direto no Excel pt-BR). */
export function purchasesToCsv(purchases: Purchase[]): string {
  const head = ['Data', 'Compra', 'Supermercado', 'Cidade', 'Status', 'Pagamento', 'Produto', 'Marca', 'Categoria', 'Código de barras', 'Quantidade', 'Preço unitário', 'Desconto do item', 'Total do item', 'Total pago da compra', 'Observações']
  const rows: string[] = [head.join(';')]
  for (const p of purchases.filter((x) => x.status === 'finalized')) {
    const date = (p.finishedAt ?? p.startedAt).slice(0, 10)
    const base = [date, p.id, p.supermarketName, p.city ?? '', p.status, p.paymentMethod ?? '']
    const paid = formatDecimal(p.paidCents ?? 0)
    if (!p.items.length) {
      rows.push([...base, '(sem detalhamento)', '', '', '', '', '', '', '', paid, p.note ?? ''].map(csvCell).join(';'))
      continue
    }
    for (const it of p.items) {
      rows.push(
        [
          ...base,
          it.name,
          it.brand ?? '',
          categoryById(it.category).label,
          it.barcode ?? '',
          formatQty(it.qtyMilli, it.priceUnit),
          formatDecimal(it.unitPriceCents),
          formatDecimal(it.discountCents),
          formatDecimal(lineTotal(it)),
          paid,
          p.note ?? '',
        ]
          .map(csvCell)
          .join(';'),
      )
    }
  }
  return '﻿' + rows.join('\r\n')
}
