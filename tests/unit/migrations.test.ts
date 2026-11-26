import { describe, it, expect, beforeEach } from 'vitest'
import { runMigrations, reimportLegacy } from '@/storage/migrations'
import { kvGet, getAll } from '@/storage/db'
import type { ListData, ListMeta, Purchase, Product } from '@/domain/types'
import { seedV1, resetDb } from '../helpers/v1fixture'

beforeEach(async () => {
  localStorage.clear()
  await resetDb()
})

describe('migração da v1 (localStorage → IndexedDB)', () => {
  it('importa listas, produtos, mercados, orçamento e histórico', async () => {
    seedV1()
    const r = await runMigrations(localStorage)
    expect(r.ran).toEqual([1, 2])
    const metas = (await kvGet<ListMeta[]>('listsMeta'))!
    expect(metas.map((m) => m.id)).toEqual(['default', 'l1700000000001'])
    const d = (await kvGet<ListData>('list:default'))!
    expect(d.products).toHaveLength(2)
    expect(d.products[0]).toMatchObject({ name: 'Arroz 5kg', quantity: 2, prices: { m1: '24.90', m2: '26.50' }, isEssential: true, note: 'tipo 1' })
    expect(d.budget).toBe('350')
    expect(d.markets[0]).toMatchObject({ name: 'Atacadão', discountPercent: '5' })
    expect(await kvGet('activeListId')).toBe('l1700000000001')
    const purchases = await getAll<Purchase>('purchases')
    expect(purchases).toHaveLength(2)
    const h1 = purchases.find((p) => p.id === 'legacy-default-h1')!
    expect(h1).toMatchObject({ status: 'finalized', paidCents: 18735, legacy: true, supermarketName: 'Atacadão' })
  })

  it('lista sem chave de mercados mantém "Mercado A/B" padrão da v1', async () => {
    seedV1()
    await runMigrations(localStorage)
    const d = (await kvGet<ListData>('list:l1700000000001'))!
    expect(d.markets.map((m) => m.name)).toEqual(['Mercado A', 'Mercado B'])
    expect(d.budget).toBe('0')
  })

  it('NÃO altera nem remove as chaves do localStorage da v1', async () => {
    seedV1()
    const before = JSON.stringify(Object.entries(localStorage).sort())
    await runMigrations(localStorage)
    expect(JSON.stringify(Object.entries(localStorage).sort())).toBe(before)
    expect(localStorage.getItem('shopsmart_theme')).toBe('dark')
  })

  it('guarda backup bruto da v1', async () => {
    seedV1()
    await runMigrations(localStorage)
    const b = (await kvGet<{ raw: Record<string, string> }>('legacyRawBackup'))!
    expect(Object.keys(b.raw)).toContain('shopsmart_list_default_products')
  })

  it('é idempotente: rodar duas vezes não duplica nada', async () => {
    seedV1()
    await runMigrations(localStorage)
    const r2 = await runMigrations(localStorage)
    expect(r2.ran).toEqual([])
    const again = await reimportLegacy(localStorage)
    expect(again).toEqual({ lists: 0, purchases: 0 })
    expect(await getAll('purchases')).toHaveLength(2)
    expect((await kvGet<ListMeta[]>('listsMeta'))!).toHaveLength(2)
  })

  it('reimportar não sobrescreve lista já editada na v2', async () => {
    seedV1()
    await runMigrations(localStorage)
    const edited: ListData = { markets: [], products: [], budget: '999', history: [] }
    const { kvSet } = await import('@/storage/db')
    await kvSet('list:default', edited)
    await reimportLegacy(localStorage)
    expect((await kvGet<ListData>('list:default'))!.budget).toBe('999')
  })

  it('itens frequentes viram sugestões e catálogo pessoal', async () => {
    seedV1()
    await runMigrations(localStorage)
    expect(await kvGet('frequent')).toMatchObject({ arroz: { count: 7 } })
    const products = await getAll<Product>('products')
    expect(products.find((p) => p.name === 'Arroz')?.source).toBe('migrated')
  })

  it('usuário novo (sem dados): migra sem erros', async () => {
    const r = await runMigrations(localStorage)
    expect(r.ran).toEqual([1, 2])
    expect(await kvGet('listsMeta')).toBeUndefined()
    expect(await getAll('purchases')).toHaveLength(0)
  })

  it('JSON corrompido em uma chave não derruba a migração', async () => {
    seedV1()
    localStorage.setItem('shopsmart_list_default_products', '{quebrado')
    const r = await runMigrations(localStorage)
    expect(r.ran).toEqual([1, 2])
    expect(((await kvGet<ListData>('list:default'))!).products).toEqual([])
  })

  it('instalação antiga sem metadados de lista (chaves shopsmart_products etc.)', async () => {
    localStorage.setItem('shopsmart_products', JSON.stringify([{ id: 'x', name: 'Café', quantity: 1, prices: {}, category: 'mercearia', isEssential: false, inCart: false, note: '' }]))
    localStorage.setItem('shopsmart_budget', '120')
    await runMigrations(localStorage)
    const d = (await kvGet<ListData>('list:default'))!
    expect(d.products[0].name).toBe('Café')
    expect(d.budget).toBe('120')
  })

  it('migração futura cria backup lógico antes de rodar', async () => {
    seedV1()
    await runMigrations(localStorage)
    const { listLogicalBackups } = await import('@/storage/backup')
    const extra = { id: 3, name: 'teste', async run() {} }
    await runMigrations(localStorage, [extra])
    const b = await listLogicalBackups()
    expect(b.some((x) => x.reason.startsWith('antes-migrar'))).toBe(true)
  })
})
