import { resetDbConnection, DB_NAME } from '@/storage/db'

/** Reproduz exatamente o formato gravado pela versão 1 (ReisSmart) no localStorage. */
export function seedV1(storage: Storage = localStorage) {
  storage.setItem('shopsmart_lists_meta', JSON.stringify([
    { id: 'default', name: 'Minha Lista', createdAt: 1700000000000 },
    { id: 'l1700000000001', name: 'Churrasco de sábado', createdAt: 1700000000001 },
  ]))
  storage.setItem('shopsmart_active_list', 'l1700000000001')
  storage.setItem('shopsmart_list_default_markets', JSON.stringify([
    { id: 'm1', name: 'Atacadão', discountPercent: '5' },
    { id: 'm2', name: 'Mercado B', discountPercent: '' },
  ]))
  storage.setItem('shopsmart_list_default_products', JSON.stringify([
    { id: 'p1', name: 'Arroz 5kg', quantity: 2, prices: { m1: '24.90', m2: '26.50' }, category: 'mercearia', isEssential: true, inCart: false, note: 'tipo 1' },
    { id: 'p2', name: 'Leite', quantity: 6, prices: { m1: '4.59', m2: '' }, category: 'laticinios', isEssential: false, inCart: true, note: '' },
  ]))
  storage.setItem('shopsmart_list_default_budget', JSON.stringify('350'))
  storage.setItem('shopsmart_list_default_history', JSON.stringify([
    { id: 'h1', date: '2025-03-10T14:00:00.000Z', marketName: 'Atacadão', total: 187.35, itemCount: 12, boughtCount: 12 },
    { id: 'h2', date: '2025-04-02T10:30:00.000Z', marketName: 'Mercado B', total: 99.9, itemCount: 5, boughtCount: 4 },
  ]))
  storage.setItem('shopsmart_list_l1700000000001_products', JSON.stringify([
    { id: 'p9', name: 'Picanha', quantity: 1, prices: {}, category: 'acougue', isEssential: false, inCart: false, note: '' },
  ]))
  storage.setItem('shopsmart_frequent_items', JSON.stringify({ arroz: { name: 'Arroz', category: 'mercearia', count: 7 } }))
  storage.setItem('shopsmart_theme', 'dark')
  storage.setItem('shopsmart_calc', JSON.stringify([{ id: '1', name: 'Marca A', price: '10', quantity: '500', unit: 'g' }]))
  storage.setItem('shopsmart_eth', JSON.stringify('3.99'))
}

export async function resetDb() {
  await resetDbConnection()
  await new Promise<void>((resolve) => {
    const r = indexedDB.deleteDatabase(DB_NAME)
    r.onsuccess = r.onerror = r.onblocked = () => resolve()
  })
}
