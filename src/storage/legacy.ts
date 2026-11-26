/**
 * Leitura (somente leitura!) dos dados da versão 1, guardados em localStorage.
 * A v2 nunca grava nem apaga estas chaves: o rollback para a v1 permanece possível.
 */
import type { LegacyHistoryEntry, ListData, ListMarket, ListMeta, ListProduct, FrequentItem } from '@/domain/types'

export const LEGACY_KEYS = {
  listsMeta: 'shopsmart_lists_meta',
  activeList: 'shopsmart_active_list',
  frequent: 'shopsmart_frequent_items',
  theme: 'shopsmart_theme',
  calc: 'shopsmart_calc',
  fuel: ['shopsmart_eth', 'shopsmart_gas', 'shopsmart_dist', 'shopsmart_cons', 'shopsmart_tfp', 'shopsmart_roundtrip'],
  oldProducts: 'shopsmart_products',
  oldMarkets: 'shopsmart_markets',
  oldBudget: 'shopsmart_budget',
} as const

export const listKeys = (id: string) => ({
  markets: `shopsmart_list_${id}_markets`,
  products: `shopsmart_list_${id}_products`,
  budget: `shopsmart_list_${id}_budget`,
  history: `shopsmart_list_${id}_history`,
})

export interface LegacySnapshot {
  lists: ListMeta[]
  activeListId: string | null
  data: Record<string, ListData>
  frequent: Record<string, FrequentItem>
  /** todas as chaves shopsmart_* como texto bruto (backup lógico) */
  raw: Record<string, string>
}

function readJson<T>(storage: Storage, key: string): T | undefined {
  try {
    const v = storage.getItem(key)
    return v === null ? undefined : (JSON.parse(v) as T)
  } catch {
    return undefined
  }
}

export function snapshotRaw(storage: Storage): Record<string, string> {
  const raw: Record<string, string> = {}
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i)
    if (k && k.startsWith('shopsmart_')) {
      const v = storage.getItem(k)
      if (v !== null) raw[k] = v
    }
  }
  return raw
}

export const DEFAULT_MARKETS: ListMarket[] = [
  { id: 'm1', name: 'Mercado A', discountPercent: '' },
  { id: 'm2', name: 'Mercado B', discountPercent: '' },
]

const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

export function readLegacy(storage: Storage): LegacySnapshot | null {
  const raw = snapshotRaw(storage)
  if (Object.keys(raw).length === 0) return null
  let lists = asArray<ListMeta>(readJson(storage, LEGACY_KEYS.listsMeta)).filter((l) => l && typeof l.id === 'string')
  const data: Record<string, ListData> = {}
  // Instalações muito antigas: chaves sem lista (shopsmart_products...) → lista "default"
  if (lists.length === 0) {
    const hasOld = [LEGACY_KEYS.oldProducts, LEGACY_KEYS.oldMarkets, LEGACY_KEYS.oldBudget].some((k) => k in raw)
    if (!hasOld && !Object.keys(raw).some((k) => k.startsWith('shopsmart_list_'))) {
      return { lists: [], activeListId: null, data, frequent: readJson(storage, LEGACY_KEYS.frequent) ?? {}, raw }
    }
    lists = [{ id: 'default', name: 'Minha Lista', createdAt: Date.now() }]
  }
  for (const l of lists) {
    const k = listKeys(l.id)
    const isDefault = l.id === 'default'
    const marketsRaw = readJson(storage, k.markets) ?? (isDefault ? readJson(storage, LEGACY_KEYS.oldMarkets) : undefined)
    // Na v1 os "Mercado A/B" padrão só existiam em memória até serem editados.
    const markets = marketsRaw === undefined ? DEFAULT_MARKETS.map((m) => ({ ...m })) : asArray<ListMarket>(marketsRaw)
    const products = asArray<ListProduct>(readJson(storage, k.products) ?? (isDefault ? readJson(storage, LEGACY_KEYS.oldProducts) : undefined))
    const budgetRaw = readJson<string | number>(storage, k.budget) ?? (isDefault ? readJson<string | number>(storage, LEGACY_KEYS.oldBudget) : undefined)
    const history = asArray<LegacyHistoryEntry>(readJson(storage, k.history))
    data[l.id] = {
      markets,
      products: products.map((p) => ({
        ...p,
        quantity: Number(p.quantity) > 0 ? Number(p.quantity) : 1,
        prices: p.prices && typeof p.prices === 'object' ? p.prices : {},
        category: p.category || 'geral',
        isEssential: !!p.isEssential,
        inCart: !!p.inCart,
        note: p.note ?? '',
      })),
      budget: budgetRaw === undefined ? '0' : String(budgetRaw),
      history,
    }
  }
  const active = (() => {
    try {
      return storage.getItem(LEGACY_KEYS.activeList)
    } catch {
      return null
    }
  })()
  return { lists, activeListId: active, data, frequent: readJson(storage, LEGACY_KEYS.frequent) ?? {}, raw }
}
