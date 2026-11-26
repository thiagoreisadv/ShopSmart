import { getAll, kvGet, kvSet, putMany } from './db'
import { readLegacy, snapshotRaw, type LegacySnapshot } from './legacy'
import { createLogicalBackup } from './backup'
import { SCHEMA_VERSION, DEFAULT_SETTINGS } from '@/domain/types'
import type { FrequentItem, ListData, ListMeta, Product, Purchase, Settings, Supermarket } from '@/domain/types'
import { parseMoney } from '@/lib/money'
import { normalizeText } from '@/lib/id'

export interface MetaRecord {
  schemaVersion: number
  applied: { id: number; name: string; at: string }[]
}

export interface Migration {
  id: number
  name: string
  /** Idempotente: pode rodar de novo sem duplicar nada. */
  run(ctx: { storage: Storage }): Promise<void>
}

const PLACEHOLDER_MARKET = /^mercado [ab]$/i

/** Importa listas, mercados, produtos e orçamento da v1 sem sobrescrever listas que já existam na v2. */
async function importLegacyLists(legacy: LegacySnapshot): Promise<void> {
  const metas = (await kvGet<ListMeta[]>('listsMeta')) ?? []
  const have = new Set(metas.map((m) => m.id))
  for (const l of legacy.lists) {
    if (have.has(l.id)) continue
    metas.push({ id: l.id, name: l.name || 'Minha Lista', createdAt: l.createdAt || Date.now() })
    const d = legacy.data[l.id]
    // cópia dos dados (sem a história: ela vira "compras" na migração 2)
    await kvSet(`list:${l.id}`, { markets: d.markets, products: d.products, budget: d.budget, history: [] } satisfies ListData)
  }
  if (metas.length) await kvSet('listsMeta', metas)
  const active = await kvGet<string>('activeListId')
  if (!active && legacy.activeListId && metas.some((m) => m.id === legacy.activeListId)) await kvSet('activeListId', legacy.activeListId)
}

async function importLegacyHistoryAndCatalog(legacy: LegacySnapshot): Promise<void> {
  const purchases = new Map((await getAll<Purchase>('purchases')).map((p) => [p.id, p]))
  const markets = (await kvGet<Supermarket[]>('supermarkets')) ?? []
  const marketByName = new Map(markets.map((m) => [normalizeText(m.name), m]))
  const ensureMarket = (name: string): Supermarket => {
    const key = normalizeText(name)
    let m = marketByName.get(key)
    if (!m) {
      m = { id: `mk-${key.replace(/\s/g, '-') || 'sem-nome'}`, name: name.trim(), createdAt: Date.now() }
      marketByName.set(key, m)
      markets.push(m)
    }
    return m
  }
  const toPut: Purchase[] = []
  for (const l of legacy.lists) {
    const d = legacy.data[l.id]
    for (const h of d.history) {
      const id = `legacy-${l.id}-${h.id}`
      if (purchases.has(id)) continue
      const cents = parseMoney(Number(h.total) || 0) ?? 0
      const name = h.marketName || 'Mercado não informado'
      const mk = h.marketName ? ensureMarket(h.marketName) : undefined
      const date = Number.isNaN(Date.parse(h.date)) ? new Date().toISOString() : h.date
      toPut.push({
        id,
        status: 'finalized',
        supermarketId: mk?.id,
        supermarketName: name,
        listId: l.id,
        budgetCents: parseMoney(d.budget) ?? 0,
        items: [],
        checkoutDiscountCents: 0,
        startedAt: date,
        finishedAt: date,
        updatedAt: date,
        estimatedCents: cents,
        paidCents: cents,
        note: `Importada da versão 1 (${h.boughtCount ?? 0}/${h.itemCount ?? 0} itens)`,
        legacy: true,
      })
    }
    // Mercados da lista com nome próprio (ou com preços cadastrados) viram supermercados
    for (const m of d.markets) {
      const hasPrices = d.products.some((p) => p.prices && p.prices[m.id])
      if (m.name && (!PLACEHOLDER_MARKET.test(m.name.trim()) || hasPrices)) ensureMarket(m.name)
    }
  }
  await putMany('purchases', toPut)
  await kvSet('supermarkets', markets)

  // Itens frequentes → sugestões + catálogo pessoal
  const existingFreq = (await kvGet<Record<string, FrequentItem>>('frequent')) ?? {}
  const freq: Record<string, FrequentItem> = { ...existingFreq }
  for (const [k, v] of Object.entries(legacy.frequent)) {
    if (!v || typeof v.name !== 'string') continue
    freq[k] = freq[k] ? { ...freq[k], count: Math.max(freq[k].count, v.count || 0) } : { name: v.name, category: v.category || 'geral', count: v.count || 1 }
  }
  await kvSet('frequent', freq)
  const products = await getAll<Product>('products')
  const byName = new Set(products.filter((p) => !p.barcode).map((p) => normalizeText(p.name)))
  const now = Date.now()
  const catalog: Product[] = []
  for (const f of Object.values(freq)) {
    const key = normalizeText(f.name)
    if (!key || byName.has(key)) continue
    byName.add(key)
    catalog.push({
      id: `mig-${key.replace(/\s/g, '-')}`,
      name: f.name,
      category: f.category || 'geral',
      unit: 'un',
      firstSeenAt: now,
      purchaseCount: 0,
      source: 'migrated',
      updatedAt: now,
    })
  }
  await putMany('products', catalog)
}

export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: 'importar-listas-da-v1',
    async run({ storage }) {
      const legacy = readLegacy(storage)
      if (legacy) await importLegacyLists(legacy)
    },
  },
  {
    id: 2,
    name: 'importar-historico-e-itens-frequentes',
    async run({ storage }) {
      const legacy = readLegacy(storage)
      if (legacy) await importLegacyHistoryAndCatalog(legacy)
      const s = await kvGet<Settings>('settings')
      if (!s) await kvSet('settings', DEFAULT_SETTINGS)
    },
  },
]

export async function runMigrations(storage: Storage, migrations: Migration[] = MIGRATIONS): Promise<{ ran: number[] }> {
  const meta = (await kvGet<MetaRecord>('meta')) ?? { schemaVersion: 0, applied: [] }
  const pending = migrations.filter((m) => m.id > meta.schemaVersion).sort((a, b) => a.id - b.id)
  if (!pending.length) return { ran: [] }
  // 1) cópia bruta da v1 (nunca sobrescreve a primeira)
  if (!(await kvGet('legacyRawBackup'))) {
    const raw = snapshotRaw(storage)
    if (Object.keys(raw).length) await kvSet('legacyRawBackup', { at: new Date().toISOString(), raw })
  }
  // 2) backup lógico completo do que já existe antes de qualquer alteração estrutural
  if (meta.schemaVersion > 0) await createLogicalBackup(`antes-migrar-v${meta.schemaVersion}`, storage)
  const ran: number[] = []
  for (const m of pending) {
    await m.run({ storage })
    meta.schemaVersion = m.id
    meta.applied.push({ id: m.id, name: m.name, at: new Date().toISOString() })
    await kvSet('meta', meta) // progresso gravado migração a migração
    ran.push(m.id)
  }
  return { ran }
}

/** Reimporta dados que ainda estejam na v1 (por exemplo, após voltar temporariamente à versão antiga). Só adiciona o que falta. */
export async function reimportLegacy(storage: Storage): Promise<{ lists: number; purchases: number }> {
  await createLogicalBackup('antes-reimportar-v1', storage)
  const before = { lists: ((await kvGet<ListMeta[]>('listsMeta')) ?? []).length, purchases: (await getAll<Purchase>('purchases')).length }
  const legacy = readLegacy(storage)
  if (legacy) {
    await importLegacyLists(legacy)
    await importLegacyHistoryAndCatalog(legacy)
  }
  const after = { lists: ((await kvGet<ListMeta[]>('listsMeta')) ?? []).length, purchases: (await getAll<Purchase>('purchases')).length }
  return { lists: after.lists - before.lists, purchases: after.purchases - before.purchases }
}

export { SCHEMA_VERSION }
