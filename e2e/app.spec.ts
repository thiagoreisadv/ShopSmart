import { test, expect } from '@playwright/test'
import { go, openApp } from './helpers'

test.describe('navegação e responsividade', () => {
  test('abre sem erros e navega pelas 5 abas', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text()) && errors.push(m.text()))
    await openApp(page)
    await expect(page.getByRole('heading', { name: 'ShopSmart' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Iniciar compra' })).toBeVisible()
    for (const [tab, heading] of [['Listas', 'Listas'], ['Compra', 'Compra'], ['Finanças', 'Finanças'], ['Mais', 'Mais'], ['Início', 'ShopSmart']] as const) {
      await go(page, tab)
      await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible()
    }
    expect(errors).toEqual([])
  })

  test('layout correto por tamanho de tela e sem rolagem horizontal', async ({ page }, info) => {
    await openApp(page)
    const w = page.viewportSize()!.width
    if (w >= 900) {
      await expect(page.locator('.sidebar')).toBeVisible()
      await expect(page.locator('.bottom-nav')).toBeHidden()
    } else {
      await expect(page.locator('.bottom-nav')).toBeVisible()
      await expect(page.locator('.sidebar')).toBeHidden()
      // Compra em destaque
      await expect(page.locator('.nav-cta-btn')).toBeVisible()
    }
    for (const h of ['#/', '#/listas', '#/compra', '#/financas', '#/mais', '#/mais/comparador', '#/mais/catalogo', '#/mais/precos', '#/mais/compras', '#/mais/unidade', '#/mais/combustivel', '#/mais/config', '#/mais/backup']) {
      await page.goto('./' + h)
      await page.waitForTimeout(150)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, `rolagem horizontal em ${h} (${info.project.name})`).toBeLessThanOrEqual(1)
    }
  })

  test('menu Mais lista todas as ferramentas exigidas', async ({ page }) => {
    await openApp(page, '#/mais')
    for (const t of ['Comparador de supermercados', 'Catálogo de produtos', 'Histórico de preços', 'Histórico de compras', 'Calculadora de preço por unidade', 'Calculadora de combustível', 'Configurações', 'Backup e restauração']) {
      await expect(page.getByRole('button', { name: new RegExp(t) })).toBeVisible()
    }
  })

  test('modo claro/escuro alterna e persiste na chave shopsmart_theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await openApp(page, '#/mais/config')
    await page.getByRole('tab', { name: 'Escuro' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(await page.evaluate(() => localStorage.getItem('shopsmart_theme'))).toBe('"dark"')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.getByRole('tab', { name: 'Claro' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  })

  test('segue o tema do sistema quando não há preferência salva', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await openApp(page)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })
})
