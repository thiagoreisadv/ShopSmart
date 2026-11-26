import { describe, it, expect, beforeEach } from 'vitest'
import { dumpAll, parseBackup, restoreBackup, purchasesToCsv, importLegacyListFile, createLogicalBackup, listLogicalBackups } from '@/storage/backup'
import { boot, startPurchase, addCartItem, finalizePurchase, addListProduct } from '@/store/actions'
import { getState, resetStateForTests, flush } from '@/store/store'
import { getAll, kvGet } from '@/storage/db'
import type { Purchase, ListMeta } from '@/domain/types'
import { resetDb, seedV1 } from '../helpers/v1fixture'

beforeEach(async () => {
  await flush()
  localStorage.clear()
  resetStateForTests()
  await resetDb()
})

async function populate() {
  seedV1()
  await boot()
  const s = startPurchase({ supermarketName: 'Atacadão', city: 'Loanda', budgetCents: 0 })
  addCartItem({ name: 'Café "Especial"; 500g', qtyMilli: 2000, priceUnit: 'un', unitPriceCents: 1890, origin: 'manual', barcode: '7891000100103' })
  finalizePurchase(s.id, { paymentMethod: 'pix' })
  await flush()
}

describe('backup e restauração', () => {
  it('exporta e valida estrutura', async () => {
    await populate()
    const file = await dumpAll(localStorage)
    const r = parseBackup(JSON.stringify(file))
    expect(r.ok).toBe(true)
    expect(r.summary).toMatchObject({ lists: 2, purchases: 3 })
    expect(file.localStorage?.shopsmart_theme).toBe('dark')
  })

  it('rejeita arquivos inválidos', () => {
    expect(parseBackup('não é json').ok).toBe(false)
    expect(parseBackup('{"a":1}').ok).toBe(false)
    expect(parseBackup(JSON.stringify({ format: 'shopsmart-backup', schemaVersion: 99, data: {} })).ok).toBe(false)
    expect(parseBackup('[]').ok).toBe(false)
  })

  it('ignora registros malformados com aviso', async () => {
    await populate()
    const file = await dumpAll()
    const bad = JSON.parse(JSON.stringify(file))
    bad.data.purchases.push({ foo: 1 })
    bad.data.products.push(null)
    const r = parseBackup(JSON.stringify(bad))
    expect(r.ok).toBe(true)
    expect(r.warnings[0]).toMatch(/inválido/)
  })

  it('mesclar: ids repetidos não duplicam', async () => {
    await populate()
    const file = await dumpAll()
    const rep = await restoreBackup(file, 'merge')
    expect(rep.added).toBe(0)
    expect(rep.skippedDuplicates).toBeGreaterThan(0)
    expect(await getAll('purchases')).toHaveLength(3)
    expect(rep.safetyBackupKey).toMatch(/^backup:/)
  })

  it('substituir: restaura de um backup em um banco vazio e cria backup de segurança', async () => {
    await populate()
    const file = await dumpAll()
    await flush()
    resetStateForTests()
    await resetDb()
    const rep = await restoreBackup(file, 'replace')
    expect(rep.added).toBeGreaterThan(0)
    expect(await getAll('purchases')).toHaveLength(3)
    expect(((await kvGet<ListMeta[]>('listsMeta')) ?? []).length).toBe(2)
    await boot()
    expect(getState().purchases.filter((p) => p.status === 'finalized')).toHaveLength(3)
  })

  it('compra finalizada não é sobrescrita por versão "ativa" do backup', async () => {
    await populate()
    const file = await dumpAll()
    const done = file.data.purchases.find((p) => !p.legacy)!
    const stale: Purchase = { ...done, status: 'active', updatedAt: '2999-01-01T00:00:00.000Z' }
    await restoreBackup({ ...file, data: { ...file.data, purchases: [stale] } }, 'merge')
    const now = (await getAll<Purchase>('purchases')).find((p) => p.id === done.id)!
    expect(now.status).toBe('finalized')
  })

  it('mantém só os 3 backups lógicos mais recentes', async () => {
    await boot()
    for (let i = 0; i < 5; i++) {
      await createLogicalBackup('t' + i)
      await new Promise((r) => setTimeout(r, 2))
    }
    expect(await listLogicalBackups()).toHaveLength(3)
  })

  it('importa arquivo de lista exportado pela v1', async () => {
    await boot()
    const text = JSON.stringify({ name: 'Churrasco', markets: [{ id: 'm1', name: 'A', discountPercent: '' }], products: [{ id: 'p', name: 'Carvão', quantity: 2, prices: {}, category: 'geral', isEssential: false, inCart: false, note: '' }], budget: '200', exportedAt: 'x' })
    const r = parseBackup(text)
    expect(r.legacyList?.name).toBe('Churrasco')
    const meta = await importLegacyListFile(r.legacyList!)
    expect(meta.name).toBe('Churrasco')
    expect((await kvGet<ListMeta[]>('listsMeta'))!.some((m) => m.name === 'Churrasco')).toBe(true)
  })

  it('CSV financeiro: separador ;, escapa aspas e só traz finalizadas', async () => {
    await populate()
    const csv = purchasesToCsv(await getAll<Purchase>('purchases'))
    expect(csv.startsWith('﻿Data;Compra')).toBe(true)
    expect(csv).toContain('"Café ""Especial""; 500g"')
    expect(csv).toContain('37,80')
    expect(csv).toContain('(sem detalhamento)')
    expect(csv.split('\r\n').length).toBe(1 + 3)
  })

  it('addListProduct segue funcionando após restauração', async () => {
    await populate()
    addListProduct(getState().activeListId, 'Item novo')
    expect(getState().listData[getState().activeListId].products[0].name).toBe('Item novo')
  })
})
