import { useSyncExternalStore } from 'react'
import type { FrequentItem, ListData, ListMeta, PriceRecord, Product, Purchase, Settings, Supermarket } from '@/domain/types'
import { DEFAULT_SETTINGS } from '@/domain/types'

export interface AppState {
  ready: boolean
  /** true quando o IndexedDB não está disponível (ex.: aba anônima de alguns navegadores) */
  storageError: string | null
  settings: Settings
  lists: ListMeta[]
  activeListId: string
  listData: Record<string, ListData>
  supermarkets: Supermarket[]
  products: Product[]
  prices: PriceRecord[]
  purchases: Purchase[]
  frequent: Record<string, FrequentItem>
}

export const initialState: AppState = {
  ready: false,
  storageError: null,
  settings: DEFAULT_SETTINGS,
  lists: [],
  activeListId: '',
  listData: {},
  supermarkets: [],
  products: [],
  prices: [],
  purchases: [],
  frequent: {},
}

let state: AppState = initialState
const listeners = new Set<() => void>()

export const getState = (): AppState => state
export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)): void {
  const p = typeof patch === 'function' ? patch(state) : patch
  state = { ...state, ...p }
  for (const l of listeners) l()
}
export function resetStateForTests(): void {
  state = initialState
  for (const l of listeners) l()
}
export function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useAppState<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(initialState))
}

/* ---------- Seletores estáveis ---------- */
export const selectActivePurchase = (s: AppState): Purchase | undefined => s.purchases.find((p) => p.status === 'active')
export const selectFinalized = (s: AppState): Purchase[] => s.purchases.filter((p) => p.status === 'finalized')

/* ---------- Fila de gravação (ordem garantida; flush para testes/pagehide) ---------- */
let queue: Promise<void> = Promise.resolve()
let lastError: unknown = null
export function enqueue(fn: () => Promise<void>): Promise<void> {
  queue = queue.then(fn).catch((e) => {
    lastError = e
    console.error('[ShopSmart] falha ao gravar', e)
    setState({ storageError: 'Não foi possível salvar no dispositivo. Exporte um backup assim que possível.' })
  })
  return queue
}
export const flush = (): Promise<void> => queue
export const getLastWriteError = () => lastError
