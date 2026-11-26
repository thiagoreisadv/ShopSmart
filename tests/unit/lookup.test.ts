import { describe, it, expect, beforeEach, vi } from 'vitest'
import { lookupBarcode, resetLookupRuntime, sha256Hex, parseOffProduct } from '@/services/lookup'
import type { Product } from '@/domain/types'
import { resetDb } from '../helpers/v1fixture'

const CODE = '7891000100103'
const offOk = { status: 1, product: { product_name_pt: 'Leite Condensado Moça', brands: 'Nestlé, Outra', categories_tags: ['en:dairies'], quantity: '395 g' } }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const noSleep = { sleep: async () => {}, minIntervalMs: 0 }

beforeEach(async () => {
  resetLookupRuntime()
  await resetDb()
})

describe('consulta de código de barras', () => {
  it('código inválido não consulta ninguém', async () => {
    const f = vi.fn()
    const r = await lookupBarcode('123', { fetch: f as never, ...noSleep })
    expect(r.barcode).toBeNull()
    expect(f).not.toHaveBeenCalled()
  })

  it('1) catálogo pessoal tem prioridade e funciona offline', async () => {
    const mine: Product = { id: 'p1', barcode: CODE, name: 'Meu Leite', category: 'laticinios', unit: 'un', firstSeenAt: 0, purchaseCount: 2, source: 'manual', updatedAt: 0 }
    const f = vi.fn()
    const r = await lookupBarcode(CODE, { fetch: f as never, personal: [mine], online: () => false, ...noSleep })
    expect(r.found?.name).toBe('Meu Leite')
    expect(r.found?.source).toBe('personal')
    expect(f).not.toHaveBeenCalled()
  })

  it('3) Open Food Facts quando não há nos catálogos', async () => {
    const f = vi.fn(async (url: string) => {
      if (String(url).includes('catalog/manifest.json')) return new Response('', { status: 404 })
      if (String(url).includes('openfoodfacts')) return json(offOk)
      return json({ status: 0 })
    })
    const r = await lookupBarcode(CODE, { fetch: f as never, ...noSleep })
    expect(r.found).toMatchObject({ name: 'Leite Condensado Moça', brand: 'Nestlé', category: 'laticinios', source: 'off', size: { milli: 395, unit: 'kg' } })
  })

  it('fallback: OFF fora do ar → Open Products Facts responde', async () => {
    const f = vi.fn(async (url: string) => {
      const u = String(url)
      if (u.includes('catalog/manifest.json')) return new Response('', { status: 404 })
      if (u.includes('openfoodfacts')) return new Response('erro', { status: 503 })
      if (u.includes('openbeautyfacts')) return json({ status: 0 })
      if (u.includes('openproductsfacts')) return json({ status: 1, product: { product_name: 'Vassoura', brands: 'Bettanin', categories: 'Limpeza' } })
      return json({})
    })
    const r = await lookupBarcode(CODE, { fetch: f as never, ...noSleep })
    expect(r.found?.source).toBe('opf')
    expect(r.errors.join()).toMatch(/Open Food Facts/)
    expect(r.missedSources).toContain('Open Beauty Facts')
  })

  it('timeout de uma fonte não trava as demais', async () => {
    const f = vi.fn((url: string, init?: RequestInit) => {
      const u = String(url)
      if (u.includes('catalog/manifest.json')) return Promise.resolve(new Response('', { status: 404 }))
      if (u.includes('openfoodfacts')) return new Promise<Response>((_, rej) => init?.signal?.addEventListener('abort', () => rej(new Error('timeout'))))
      return Promise.resolve(json({ status: 1, product: { product_name: 'Sabonete' } }))
    })
    const r = await lookupBarcode(CODE, { fetch: f as never, timeoutMs: 30, ...noSleep })
    expect(r.found?.name).toBe('Sabonete')
    expect(r.errors.join()).toMatch(/demorou demais/)
  })

  it('não encontrado em nenhuma fonte → cadastro manual (found = null)', async () => {
    const f = vi.fn(async (url: string) => (String(url).includes('manifest') ? new Response('', { status: 404 }) : json({ status: 0 })))
    const r = await lookupBarcode(CODE, { fetch: f as never, ...noSleep })
    expect(r.found).toBeNull()
    expect(r.missedSources).toHaveLength(3)
  })

  it('cache: segunda consulta não repete a requisição', async () => {
    const f = vi.fn(async (url: string) => (String(url).includes('manifest') ? new Response('', { status: 404 }) : json(offOk)))
    await lookupBarcode(CODE, { fetch: f as never, ...noSleep })
    const calls = f.mock.calls.length
    const r = await lookupBarcode(CODE, { fetch: f as never, ...noSleep })
    expect(r.found?.name).toBe('Leite Condensado Moça')
    expect(f.mock.calls.length).toBe(calls)
  })

  it('cache negativo evita martelar a API', async () => {
    const f = vi.fn(async (url: string) => (String(url).includes('manifest') ? new Response('', { status: 404 }) : json({ status: 0 })))
    await lookupBarcode(CODE, { fetch: f as never, ...noSleep })
    const calls = f.mock.calls.length
    await lookupBarcode(CODE, { fetch: f as never, ...noSleep })
    expect(f.mock.calls.length).toBe(calls)
  })

  it('offline: informa e não tenta rede', async () => {
    const f = vi.fn()
    const r = await lookupBarcode(CODE, { fetch: f as never, online: () => false, ...noSleep })
    expect(r.offline).toBe(true)
    expect(r.found).toBeNull()
    expect(r.errors[0]).toMatch(/Sem conexão/)
    expect(f).not.toHaveBeenCalled()
  })

  it('respeita a configuração de desligar consultas externas', async () => {
    const f = vi.fn(async (url: string) => (String(url).includes('manifest') ? new Response('', { status: 404 }) : json(offOk)))
    const r = await lookupBarcode(CODE, { fetch: f as never, externalEnabled: false, ...noSleep })
    expect(r.found).toBeNull()
    expect(f.mock.calls.some((c) => String(c[0]).includes('openfoodfacts'))).toBe(false)
  })

  it('limite de taxa: espera entre chamadas ao mesmo host', async () => {
    const sleeps: number[] = []
    const t = 0
    const f = vi.fn(async (url: string) => (String(url).includes('manifest') ? new Response('', { status: 404 }) : json({ status: 0 })))
    await lookupBarcode(CODE, { fetch: f as never, now: () => t, minIntervalMs: 700, sleep: async (ms) => void sleeps.push(ms) })
    await lookupBarcode('7891000100202'.slice(0, 12) + '5', { fetch: f as never, now: () => t, minIntervalMs: 700, sleep: async (ms) => void sleeps.push(ms) })
    expect(sleeps.length).toBeGreaterThan(0)
  })

  it('2) catálogo estático: consulta shard e valida integridade (sha256)', async () => {
    const shard = JSON.stringify({ v: 1, p: '78910', items: { [CODE]: ['Café Pilão', 'Pilão', 'mercearia', 500, 'kg', 'f', '20261120'] } })
    const sha = await sha256Hex(shard)
    const manifest = { schema: 1, version: 'x', generatedAt: '', total: 1, sources: [], shards: { '78910': { n: 1, bytes: shard.length, sha256: sha } } }
    const f = vi.fn(async (url: string) => {
      const u = String(url)
      if (u.endsWith('catalog/manifest.json')) return json(manifest)
      if (u.endsWith('catalog/s/78910.json')) return new Response(shard)
      throw new Error('não deveria chamar externo: ' + u)
    })
    const r = await lookupBarcode(CODE, { fetch: f as never, ...noSleep })
    expect(r.found).toMatchObject({ name: 'Café Pilão', brand: 'Pilão', source: 'catalog', size: { milli: 500, unit: 'kg' } })
  })

  it('shard corrompido (hash não confere) é descartado e cai para as bases públicas', async () => {
    const shard = JSON.stringify({ v: 1, p: '78910', items: { [CODE]: ['Adulterado', '', 'geral', 0, '', 'f', ''] } })
    const manifest = { schema: 1, version: 'x', generatedAt: '', total: 1, sources: [], shards: { '78910': { n: 1, bytes: 1, sha256: 'deadbeef' } } }
    const f = vi.fn(async (url: string) => {
      const u = String(url)
      if (u.endsWith('catalog/manifest.json')) return json(manifest)
      if (u.includes('catalog/s/')) return new Response(shard)
      return json(offOk)
    })
    const r = await lookupBarcode(CODE, { fetch: f as never, ...noSleep })
    expect(r.found?.name).toBe('Leite Condensado Moça')
  })
})

describe('parseOffProduct', () => {
  it('ignora produto sem nome', () => {
    expect(parseOffProduct(CODE, { status: 1, product: { brands: 'X' } }, 'off')).toBeNull()
    expect(parseOffProduct(CODE, { status: 0 }, 'off')).toBeNull()
  })
})
