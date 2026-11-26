import { expect, type Page } from '@playwright/test'

/** Semeia o localStorage exatamente como a v1 gravava, ANTES do primeiro carregamento. */
export async function seedV1(page: Page) {
  await page.addInitScript(() => {
    if (localStorage.getItem('__seeded')) return
    localStorage.setItem('__seeded', '1')
    const set = (k: string, v: unknown) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v))
    set('shopsmart_lists_meta', [{ id: 'default', name: 'Minha Lista', createdAt: 1700000000000 }, { id: 'l1700000000001', name: 'Churrasco de sábado', createdAt: 1700000000001 }])
    set('shopsmart_active_list', 'default')
    set('shopsmart_list_default_markets', [{ id: 'm1', name: 'Atacadão', discountPercent: '5' }, { id: 'm2', name: 'Mercado B', discountPercent: '' }])
    set('shopsmart_list_default_products', [
      { id: 'p1', name: 'Arroz 5kg', quantity: 2, prices: { m1: '24.90', m2: '26.50' }, category: 'mercearia', isEssential: true, inCart: false, note: 'tipo 1' },
      { id: 'p2', name: 'Leite', quantity: 6, prices: { m1: '4.59', m2: '4.20' }, category: 'laticinios', isEssential: false, inCart: true, note: '' },
    ])
    set('shopsmart_list_default_budget', '350')
    set('shopsmart_list_default_history', [{ id: 'h1', date: new Date().toISOString(), marketName: 'Atacadão', total: 187.35, itemCount: 12, boughtCount: 12 }])
    set('shopsmart_list_l1700000000001_products', [{ id: 'p9', name: 'Picanha', quantity: 1, prices: {}, category: 'acougue', isEssential: false, inCart: false, note: '' }])
    set('shopsmart_frequent_items', { arroz: { name: 'Arroz', category: 'mercearia', count: 7 } })
    set('shopsmart_theme', 'dark')
    set('shopsmart_calc', [{ id: '1', name: 'Marca A', price: '10', quantity: '500', unit: 'g' }, { id: '2', name: 'Marca B', price: '18', quantity: '1', unit: 'kg' }])
  })
}

export async function openApp(page: Page, hash = '') {
  await page.goto('./' + hash)
  await expect(page.locator('#main')).toBeVisible()
}

export async function go(page: Page, tab: 'Início' | 'Listas' | 'Compra' | 'Finanças' | 'Mais') {
  const nav = page.locator('.bottom-nav:visible, .sidebar:visible').first()
  await nav.getByRole('button', { name: tab, exact: false }).first().click()
}

export async function startPurchase(page: Page, opts: { market?: string; city?: string; budget?: string } = {}) {
  await openApp(page, '#/compra')
  await page.getByRole('button', { name: /Iniciar compra/ }).first().click()
  const dlg = page.getByRole('dialog', { name: 'Iniciar compra' })
  await dlg.getByLabel(/Supermercado|Ou cadastre um novo/).fill(opts.market ?? 'Atacadão')
  await dlg.getByLabel('Cidade').fill(opts.city ?? 'Loanda')
  if (opts.budget) await dlg.getByLabel(/Orçamento desta compra/).fill(opts.budget)
  await dlg.getByRole('button', { name: 'Começar' }).click()
  await expect(page.getByRole('region', { name: 'Resumo do carrinho' })).toBeVisible()
}

export async function addManual(page: Page, name: string, priceDigits: string, qty = '1') {
  await page.getByRole('button', { name: 'Manual' }).click()
  const dlg = page.getByRole('dialog', { name: 'Adicionar produto' })
  await dlg.getByLabel('Nome', { exact: true }).fill(name)
  await dlg.getByLabel(/Preço atual/).fill(priceDigits)
  if (qty !== '1') await dlg.getByLabel('Quantidade').fill(qty)
  await dlg.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  await expect(dlg).toBeHidden()
}
