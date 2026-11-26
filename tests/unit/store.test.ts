import { describe, it, expect, beforeEach } from 'vitest'
import { boot, startPurchase, addCartItem, removeCartItem, restoreCartItem, changeQty, finalizePurchase, cancelPurchase, addListProduct, editProduct, learnProduct, setCheckoutDiscount, finalizeFromList, updateCartItem } from '@/store/actions'
import { getState, resetStateForTests, flush, selectActivePurchase } from '@/store/store'
import { getAll } from '@/storage/db'
import type { Purchase, PriceRecord, Product } from '@/domain/types'
import { cartTotals } from '@/domain/cart'
import { mergeExternal } from '@/domain/catalog'
import { resetDb, seedV1 } from '../helpers/v1fixture'

beforeEach(async () => {
  await flush()
  localStorage.clear()
  resetStateForTests()
  await resetDb()
})

const apple = { name: 'Arroz Camil 5kg', qtyMilli: 1000, priceUnit: 'un' as const, unitPriceCents: 2490, origin: 'manual' as const }

describe('sessão de compra', () => {
  it('inicia, adiciona itens e atualiza totais em centavos', async () => {
    await boot()
    startPurchase({ supermarketName: 'Atacadão', city: 'Loanda', budgetCents: 10000 })
    addCartItem(apple)
    addCartItem({ name: 'Contra filé', qtyMilli: 532, priceUnit: 'kg', unitPriceCents: 4990, origin: 'manual' })
    const p = selectActivePurchase(getState())!
    expect(cartTotals(p.items).totalCents).toBe(2490 + 2655) // 532g*49,90 = 26,5468 → 26,55
    expect(p.items).toHaveLength(2)
    expect(getState().supermarkets.map((m) => m.name)).toContain('Atacadão')
  })

  it('soma quantidade quando o mesmo produto/preço é lido de novo', async () => {
    await boot()
    startPurchase({ supermarketName: 'X', budgetCents: 0 })
    addCartItem({ ...apple, barcode: '7891000100103' })
    const r = addCartItem({ ...apple, barcode: '7891000100103' })!
    expect(r.merged).toBe(true)
    const p = selectActivePurchase(getState())!
    expect(p.items).toHaveLength(1)
    expect(p.items[0].qtyMilli).toBe(2000)
  })

  it('alerta de orçamento ao cruzar 80/90/100% sem bloquear', async () => {
    await boot()
    startPurchase({ supermarketName: 'X', budgetCents: 10000 })
    expect(addCartItem({ ...apple, name: 'a', unitPriceCents: 7900 })!.alert).toBeNull()
    expect(addCartItem({ ...apple, name: 'b', unitPriceCents: 200 })!.alert).toBe('w80')
    expect(addCartItem({ ...apple, name: 'c', unitPriceCents: 1000 })!.alert).toBe('w90')
    expect(addCartItem({ ...apple, name: 'd', unitPriceCents: 5000 })!.alert).toBe('over')
    expect(selectActivePurchase(getState())!.items).toHaveLength(4)
  })

  it('remover e desfazer', async () => {
    await boot()
    startPurchase({ supermarketName: 'X', budgetCents: 0 })
    const a = addCartItem({ ...apple, name: 'A' })!.item
    addCartItem({ ...apple, name: 'B' })
    const rm = removeCartItem(a.id)!
    expect(selectActivePurchase(getState())!.items.map((i) => i.name)).toEqual(['B'])
    restoreCartItem(rm.item, rm.index)
    expect(selectActivePurchase(getState())!.items.map((i) => i.name).sort()).toEqual(['A', 'B'])
  })

  it('não deixa quantidade ficar zero', async () => {
    await boot()
    startPurchase({ supermarketName: 'X', budgetCents: 0 })
    const a = addCartItem(apple)!.item
    changeQty(a.id, -1000)
    expect(selectActivePurchase(getState())!.items[0].qtyMilli).toBe(1000)
  })

  it('marca automaticamente o item da lista vinculada e desmarca ao remover', async () => {
    await boot()
    const listId = getState().activeListId
    addListProduct(listId, 'Arroz Camil 5kg', 'mercearia')
    startPurchase({ supermarketName: 'X', listId, budgetCents: 0 })
    const a = addCartItem(apple)!.item
    expect(getState().listData[listId].products[0].inCart).toBe(true)
    removeCartItem(a.id)
    expect(getState().listData[listId].products[0].inCart).toBe(false)
  })

  it('só existe uma sessão ativa', async () => {
    await boot()
    const a = startPurchase({ supermarketName: 'X', budgetCents: 0 })
    const b = startPurchase({ supermarketName: 'Y', budgetCents: 0 })
    expect(b.id).toBe(a.id)
  })
})

describe('recuperação de sessão interrompida', () => {
  it('sessão ativa sobrevive ao recarregamento do app', async () => {
    await boot()
    startPurchase({ supermarketName: 'Atacadão', city: 'Loanda', budgetCents: 20000 })
    addCartItem({ ...apple, barcode: '7891000100103' })
    await flush()
    // simula fechar/recarregar: memória zerada, banco persiste
    resetStateForTests()
    await boot()
    const p = selectActivePurchase(getState())!
    expect(p).toBeTruthy()
    expect(p.supermarketName).toBe('Atacadão')
    expect(p.items[0]).toMatchObject({ name: 'Arroz Camil 5kg', unitPriceCents: 2490 })
    expect(p.budgetCents).toBe(20000)
  })
})

describe('finalização', () => {
  it('registra compra, preços e estatísticas do produto', async () => {
    await boot()
    const s = startPurchase({ supermarketName: 'Atacadão', budgetCents: 0 })
    addCartItem({ ...apple, barcode: '7891000100103' })
    const done = finalizePurchase(s.id, { paymentMethod: 'pix', note: 'ok' })!
    await flush()
    expect(done.status).toBe('finalized')
    expect(done.paidCents).toBe(2490)
    const prices = await getAll<PriceRecord>('prices')
    expect(prices).toHaveLength(1)
    expect(prices[0]).toMatchObject({ unitPriceCents: 2490, supermarketName: 'Atacadão', kind: 'paid' })
    const prods = await getAll<Product>('products')
    expect(prods[0]).toMatchObject({ purchaseCount: 1, barcode: '7891000100103' })
    expect(selectActivePurchase(getState())).toBeUndefined()
  })

  it('é idempotente: finalizar duas vezes não duplica compra, preço nem contagem', async () => {
    await boot()
    const s = startPurchase({ supermarketName: 'X', budgetCents: 0 })
    addCartItem(apple)
    finalizePurchase(s.id)
    finalizePurchase(s.id)
    finalizePurchase(s.id, { paidCents: 1 })
    await flush()
    const purchases = await getAll<Purchase>('purchases')
    expect(purchases.filter((p) => p.status === 'finalized')).toHaveLength(1)
    expect(purchases[0].paidCents).toBe(2490)
    expect(await getAll('prices')).toHaveLength(1)
    expect((await getAll<Product>('products'))[0].purchaseCount).toBe(1)
  })

  it('permite corrigir o valor pago e guarda a diferença para o estimado', async () => {
    await boot()
    const s = startPurchase({ supermarketName: 'X', budgetCents: 0 })
    addCartItem(apple)
    const d = finalizePurchase(s.id, { paidCents: 2300 })!
    expect(d.estimatedCents).toBe(2490)
    expect(d.paidCents).toBe(2300)
  })

  it('desconto de caixa reduz o estimado a pagar', async () => {
    await boot()
    const s = startPurchase({ supermarketName: 'X', budgetCents: 0 })
    addCartItem(apple)
    setCheckoutDiscount(190)
    const d = finalizePurchase(s.id)!
    expect(d.paidCents).toBe(2300)
  })

  it('cancelada não é contabilizada e não pode ser finalizada depois', async () => {
    await boot()
    const s = startPurchase({ supermarketName: 'X', budgetCents: 0 })
    addCartItem(apple)
    cancelPurchase(s.id)
    expect(finalizePurchase(s.id)).toBeNull()
    await flush()
    const all = await getAll<Purchase>('purchases')
    expect(all[0].status).toBe('cancelled')
    expect(await getAll('prices')).toHaveLength(0)
  })

  it('corrigir preço antes de finalizar atualiza o histórico com o valor corrigido', async () => {
    await boot()
    const s = startPurchase({ supermarketName: 'X', budgetCents: 0 })
    const it = addCartItem(apple)!.item
    updateCartItem(it.id, { unitPriceCents: 2290 })
    finalizePurchase(s.id)
    await flush()
    expect((await getAll<PriceRecord>('prices'))[0].unitPriceCents).toBe(2290)
  })

  it('"Concluir compra" a partir da lista (fluxo da v1) vira compra finalizada no financeiro', async () => {
    seedV1()
    await boot()
    const p = finalizeFromList('default', 'm1')!
    expect(p.status).toBe('finalized')
    // Arroz 2×24,90 + Leite 6×4,59 = 49,80+27,54 = 77,34, desconto 5% = 3,87 → 73,47
    expect(p.paidCents).toBe(7347)
    await flush()
    expect(await getAll('prices')).toHaveLength(2)
    expect(finalizeFromList('default', 'm2')).not.toBeNull()
  })
})

describe('catálogo pessoal ("aprende" produtos)', () => {
  it('produto manual desconhecido é salvo e reconhecido depois', async () => {
    await boot()
    startPurchase({ supermarketName: 'X', budgetCents: 0 })
    addCartItem({ ...apple, barcode: '7891000100103' })
    const again = learnProduct({ barcode: '7891000100103', name: 'qualquer', category: 'geral', source: 'barcode' })
    expect(again.name).toBe('Arroz Camil 5kg')
    expect(getState().products).toHaveLength(1)
  })

  it('correção do usuário não é sobrescrita por atualização externa', async () => {
    await boot()
    startPurchase({ supermarketName: 'X', budgetCents: 0 })
    addCartItem({ ...apple, barcode: '7891000100103', category: 'geral' })
    const id = getState().products[0].id
    editProduct(id, { name: 'Arroz Tio João 5kg', category: 'mercearia' })
    const edited = getState().products[0]
    expect(edited.userEdited).toEqual({ name: true, category: true })
    const merged = mergeExternal(edited, { name: 'ARROZ CAMIL TIPO 1', category: 'bebidas', brand: 'Camil' })
    expect(merged.name).toBe('Arroz Tio João 5kg')
    expect(merged.category).toBe('mercearia')
    expect(merged.brand).toBe('Camil') // campo não corrigido pelo usuário pode ser preenchido
  })

  it('embalagens diferentes sem código de barras são produtos diferentes', async () => {
    await boot()
    const a = learnProduct({ name: 'Arroz', category: 'mercearia', size: { milli: 5000, unit: 'kg' }, source: 'manual' })
    const b = learnProduct({ name: 'Arroz', category: 'mercearia', size: { milli: 1000, unit: 'kg' }, source: 'manual' })
    expect(a.id).not.toBe(b.id)
  })
})

describe('boot com dados da v1', () => {
  it('carrega listas migradas e preserva ordem/ativa', async () => {
    seedV1()
    await boot()
    const s = getState()
    expect(s.lists.map((l) => l.name)).toEqual(['Minha Lista', 'Churrasco de sábado'])
    expect(s.activeListId).toBe('l1700000000001')
    expect(s.listData.default.products.map((p) => p.name)).toEqual(['Arroz 5kg', 'Leite'])
    expect(s.purchases).toHaveLength(2)
  })
  it('usuário novo recebe lista padrão com Mercado A/B', async () => {
    await boot()
    expect(getState().lists).toHaveLength(1)
    expect(getState().listData[getState().activeListId].markets).toHaveLength(2)
  })
})
