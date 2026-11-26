/**
 * Consulta de produto por código de barras.
 * Ordem: catálogo pessoal → catálogo estático do ShopSmart (shards) → bases públicas (Open * Facts) → cadastro manual.
 * Todas as chamadas de rede têm timeout, cache, limite de taxa, deduplicação e fallback entre fontes.
 */
import type { Product, ProductSource } from '@/domain/types'
import { findByBarcode } from '@/domain/catalog'
import { guessCategory } from '@/domain/categories'
import { normalizeBarcode, shardKey } from '@/lib/barcode'
import { parseSize, type Size } from '@/lib/units'
import { getOne, putOne } from '@/storage/db'

export interface FoundProduct {
  barcode: string
  name: string
  brand?: string
  category: string
  size?: Size
  source: ProductSource
  /** texto original da quantidade (ex.: "500 g") */
  quantityText?: string
  /** quando veio do catálogo pessoal, o produto completo */
  personal?: Product
}

export interface LookupOutcome {
  found: FoundProduct | null
  /** código normalizado/validado; null se inválido */
  barcode: string | null
  /** problemas de rede/fonte (não impedem o cadastro manual) */
  errors: string[]
  offline: boolean
  /** fontes que responderam "não encontrado" */
  missedSources: string[]
}

export interface LookupDeps {
  fetch: typeof fetch
  now: () => number
  baseUrl: string
  online: () => boolean
  externalEnabled: boolean
  personal: Product[]
  timeoutMs: number
  /** intervalo mínimo entre chamadas ao mesmo host */
  minIntervalMs: number
  sleep: (ms: number) => Promise<void>
}

export const defaultDeps = (over: Partial<LookupDeps> = {}): LookupDeps => ({
  fetch: (...a) => fetch(...a),
  now: () => Date.now(),
  baseUrl: import.meta.env?.BASE_URL ?? '/',
  online: () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false),
  externalEnabled: true,
  personal: [],
  timeoutMs: 6000,
  minIntervalMs: 700,
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  ...over,
})

const POS_TTL = 30 * 86400_000
const NEG_TTL = 1 * 86400_000
const MANIFEST_TTL = 12 * 3600_000

interface CacheRow<T = unknown> {
  key: string
  at: number
  value: T
}

async function cacheGet<T>(key: string, ttl: number, now: number): Promise<{ hit: boolean; value?: T }> {
  try {
    const row = await getOne<CacheRow<T>>('lookupCache', key)
    if (row && now - row.at < ttl) return { hit: true, value: row.value }
  } catch {
    /* sem cache */
  }
  return { hit: false }
}
async function cachePut<T>(key: string, value: T, now: number): Promise<void> {
  try {
    await putOne('lookupCache', { key, at: now, value } satisfies CacheRow<T>)
  } catch {
    /* ignore */
  }
}

/* ---------- limitador de taxa por host + dedupe de requisições em andamento ---------- */
const lastCall = new Map<string, number>()
const inflight = new Map<string, Promise<unknown>>()
export function resetLookupRuntime(): void {
  lastCall.clear()
  inflight.clear()
  manifestMem = null
}

async function throttle(host: string, deps: LookupDeps): Promise<void> {
  const last = lastCall.get(host) ?? 0
  const wait = last + deps.minIntervalMs - deps.now()
  lastCall.set(host, Math.max(deps.now(), last + deps.minIntervalMs))
  if (wait > 0) await deps.sleep(wait)
}

async function fetchJson<T>(url: string, deps: LookupDeps, signal?: AbortSignal, opts: { rate?: boolean } = {}): Promise<{ status: number; json?: T }> {
  const existing = inflight.get(url) as Promise<{ status: number; json?: T }> | undefined
  if (existing) return existing
  const p = (async () => {
    if (opts.rate !== false) await throttle(new URL(url, 'https://x.invalid').host, deps)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(new Error('timeout')), deps.timeoutMs)
    const onAbort = () => ctrl.abort(signal?.reason)
    signal?.addEventListener('abort', onAbort)
    try {
      const res = await deps.fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
      if (res.status === 404) return { status: 404 }
      if (!res.ok) return { status: res.status }
      return { status: res.status, json: (await res.json()) as T }
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  })()
  inflight.set(url, p)
  try {
    return await p
  } finally {
    inflight.delete(url)
  }
}

/* ---------- catálogo estático ---------- */
export interface CatalogManifest {
  schema: number
  version: string
  generatedAt: string
  shards: Record<string, { n: number; bytes: number; sha256: string }>
  total: number
  sources: { id: string; name: string; license: string; url: string }[]
}
type ShardRow = [name: string, brand: string, category: string, sizeMilli: number, sizeUnit: string, source: string, updated: string]
interface Shard {
  v: number
  p: string
  items: Record<string, ShardRow>
}

let manifestMem: { at: number; m: CatalogManifest | null } | null = null

export async function loadManifest(deps: LookupDeps, signal?: AbortSignal): Promise<CatalogManifest | null> {
  const now = deps.now()
  if (manifestMem && now - manifestMem.at < MANIFEST_TTL) return manifestMem.m
  const cached = await cacheGet<CatalogManifest>('catalog:manifest', MANIFEST_TTL, now)
  if (cached.hit && cached.value) {
    manifestMem = { at: now, m: cached.value }
    return cached.value
  }
  if (!deps.online()) {
    // offline: usa qualquer cópia anterior, mesmo vencida
    const stale = await cacheGet<CatalogManifest>('catalog:manifest', Infinity, now)
    return stale.value ?? null
  }
  try {
    const r = await fetchJson<CatalogManifest>(`${deps.baseUrl}catalog/manifest.json`, deps, signal, { rate: false })
    if (r.json && r.json.schema === 1 && r.json.shards) {
      await cachePut('catalog:manifest', r.json, now)
      manifestMem = { at: now, m: r.json }
      return r.json
    }
  } catch {
    /* tenta cópia antiga */
  }
  const stale = await cacheGet<CatalogManifest>('catalog:manifest', Infinity, now)
  // evita refazer a requisição falha a cada leitura (nova tentativa após o TTL curto)
  manifestMem = { at: now - MANIFEST_TTL + 5 * 60_000, m: stale.value ?? null }
  return stale.value ?? null
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function loadShard(key: string, m: CatalogManifest, deps: LookupDeps, signal?: AbortSignal): Promise<Shard | null> {
  const meta = m.shards[key]
  if (!meta) return null
  const ck = `catalog:shard:${key}:${meta.sha256}`
  const cached = await cacheGet<Shard>(ck, Infinity, deps.now())
  if (cached.hit && cached.value) return cached.value
  if (!deps.online()) return null
  const url = `${deps.baseUrl}catalog/s/${key}.json`
  const res = await deps.fetch(url, { signal }).catch(() => null)
  if (!res || !res.ok) return null
  const text = await res.text()
  // controle de integridade: hash do manifesto precisa bater
  if ((await sha256Hex(text)) !== meta.sha256) return null
  const shard = JSON.parse(text) as Shard
  await cachePut(ck, shard, deps.now())
  return shard
}

export async function lookupInCatalog(code: string, deps: LookupDeps, signal?: AbortSignal): Promise<FoundProduct | null> {
  const m = await loadManifest(deps, signal)
  if (!m) return null
  for (const len of [7, 6, 5]) {
    const key = shardKey(code, len)
    if (!m.shards[key]) continue
    const shard = await loadShard(key, m, deps, signal)
    const row = shard?.items[code]
    if (row) {
      const unit = row[4] as Size['unit'] | ''
      return {
        barcode: code,
        name: row[0],
        brand: row[1] || undefined,
        category: row[2] || 'geral',
        size: unit && row[3] ? { milli: row[3], unit } : undefined,
        source: 'catalog',
      }
    }
  }
  return null
}

/* ---------- bases públicas ---------- */
interface OffResponse {
  status?: number
  product?: {
    product_name?: string
    product_name_pt?: string
    generic_name?: string
    brands?: string
    categories_tags?: string[]
    categories?: string
    quantity?: string
  }
}

export const EXTERNAL_SOURCES: { id: ProductSource; label: string; host: string }[] = [
  { id: 'off', label: 'Open Food Facts', host: 'world.openfoodfacts.org' },
  { id: 'obf', label: 'Open Beauty Facts', host: 'world.openbeautyfacts.org' },
  { id: 'opf', label: 'Open Products Facts', host: 'world.openproductsfacts.org' },
]

export function parseOffProduct(code: string, json: OffResponse, source: ProductSource): FoundProduct | null {
  if (json.status !== 1 || !json.product) return null
  const p = json.product
  const name = (p.product_name_pt || p.product_name || p.generic_name || '').trim()
  if (!name) return null
  const brand = p.brands?.split(',')[0]?.trim() || undefined
  const cats = (p.categories_tags ?? []).join(' ') || p.categories || ''
  const size = p.quantity ? parseSize(p.quantity) ?? undefined : undefined
  return { barcode: code, name, brand, category: guessCategory(`${cats} ${name}`), size, source, quantityText: p.quantity }
}

async function lookupExternal(code: string, deps: LookupDeps, signal: AbortSignal | undefined, errors: string[], missed: string[]): Promise<FoundProduct | null> {
  for (const src of EXTERNAL_SOURCES) {
    const ck = `ext:${src.id}:${code}`
    const row = await getOne<CacheRow<FoundProduct | null>>('lookupCache', ck).catch(() => undefined)
    if (row && deps.now() - row.at < (row.value ? POS_TTL : NEG_TTL)) {
      if (row.value) return row.value
      missed.push(src.label)
      continue
    }
    const url = `https://${src.host}/api/v2/product/${code}.json?fields=product_name,product_name_pt,generic_name,brands,categories_tags,categories,quantity`
    try {
      const r = await fetchJson<OffResponse>(url, deps, signal)
      if (r.status === 429) {
        errors.push(`${src.label}: limite de requisições atingido`)
        continue
      }
      if (r.status === 404 || (r.json && r.json.status === 0)) {
        await cachePut(ck, null, deps.now())
        missed.push(src.label)
        continue
      }
      if (!r.json) {
        errors.push(`${src.label}: indisponível (${r.status})`)
        continue
      }
      const found = parseOffProduct(code, r.json, src.id)
      if (found) {
        await cachePut(ck, found, deps.now())
        return found
      }
      await cachePut(ck, null, deps.now())
      missed.push(src.label)
    } catch (e) {
      if (signal?.aborted) throw e
      errors.push(`${src.label}: ${(e as Error)?.message === 'timeout' ? 'demorou demais' : 'sem resposta'}`)
    }
  }
  return null
}

export async function lookupBarcode(raw: string, depsIn: Partial<LookupDeps> = {}, signal?: AbortSignal): Promise<LookupOutcome> {
  const deps = defaultDeps(depsIn)
  const barcode = normalizeBarcode(raw)
  const out: LookupOutcome = { found: null, barcode, errors: [], offline: !deps.online(), missedSources: [] }
  if (!barcode) return out
  // 1) catálogo pessoal (funciona offline)
  const mine = findByBarcode(deps.personal, barcode)
  if (mine) {
    out.found = { barcode, name: mine.name, brand: mine.brand, category: mine.category, size: mine.size, source: 'personal', personal: mine }
    return out
  }
  // 2) catálogo automatizado
  try {
    const c = await lookupInCatalog(barcode, deps, signal)
    if (c) {
      out.found = c
      return out
    }
  } catch (e) {
    if (signal?.aborted) throw e
    out.errors.push('Catálogo ShopSmart indisponível')
  }
  // 3) bases públicas
  if (deps.externalEnabled && deps.online()) {
    out.found = await lookupExternal(barcode, deps, signal, out.errors, out.missedSources)
  } else if (!deps.online()) {
    out.errors.push('Sem conexão: apenas produtos já salvos no aparelho podem ser consultados.')
  }
  return out
}
