import { test, expect } from '@playwright/test'
import { seedV1, openApp, go } from './helpers'

test.describe('migração de dados da v1 (usuário real com dados antigos)', () => {
  test('preserva listas, itens, orçamento, tema e histórico — e não toca no localStorage', async ({ page }) => {
    await seedV1(page)
    await openApp(page)
    // tema da v1 preservado (escuro)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    // histórico da v1 vira gasto do mês
    await expect(page.getByText('R$ 187,35').first()).toBeVisible()
    await go(page, 'Listas')
    await expect(page.getByRole('heading', { name: 'Listas', exact: true })).toBeVisible()
    await expect(page.getByText('Arroz 5kg')).toBeVisible()
    await expect(page.getByText('tipo 1')).toBeVisible()
    await expect(page.getByText('R$ 350,00')).toBeVisible() // orçamento
    // lista adicional com seus itens
    await page.getByRole('button', { name: /Minha Lista/ }).first().click()
    await page.getByRole('button', { name: /Churrasco de sábado \d+ itens/ }).click()
    await expect(page.getByText('Picanha')).toBeVisible()
    // as chaves da v1 continuam exatamente como estavam
    const keys = await page.evaluate(() => ({
      products: localStorage.getItem('shopsmart_list_default_products'),
      budget: localStorage.getItem('shopsmart_list_default_budget'),
      meta: localStorage.getItem('shopsmart_lists_meta'),
      theme: localStorage.getItem('shopsmart_theme'),
    }))
    expect(JSON.parse(keys.products!)).toHaveLength(2)
    expect(keys.budget).toBe('350')
    expect(JSON.parse(keys.meta!)).toHaveLength(2)
    expect(keys.theme).toBe('dark')
  })

  test('calculadora de preço por unidade usa os dados salvos pela v1', async ({ page }) => {
    await seedV1(page)
    await openApp(page, '#/mais/unidade')
    await expect(page.getByText('Mais econômico')).toBeVisible()
    // 10 / 500 g = R$ 20/kg ; 18 / 1 kg = R$ 18/kg → Marca B vence
    await expect(page.getByText('R$ 18,00')).toBeVisible()
    await expect(page.getByText('R$ 20,00')).toBeVisible()
  })

  test('migração é idempotente: recarregar não duplica compras do histórico', async ({ page }) => {
    await seedV1(page)
    await openApp(page, '#/mais/compras')
    await expect(page.getByText('Atacadão').first()).toBeVisible()
    await page.reload()
    await page.reload()
    await expect(page.locator('.list-item')).toHaveCount(1)
  })

  test('usuário novo não vê dados fictícios', async ({ page }) => {
    await openApp(page, '#/financas')
    await expect(page.getByText('Nenhuma compra finalizada')).toBeVisible()
    await go(page, 'Início')
    await expect(page.getByText('Sem gastos registrados')).toBeVisible()
    await expect(page.getByText('Nenhuma compra ainda')).toBeVisible()
  })
})
