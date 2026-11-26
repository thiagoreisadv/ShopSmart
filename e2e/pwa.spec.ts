import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { addManual, openApp, startPurchase } from './helpers'

test.describe('PWA', () => {
  test('manifest válido e ícones acessíveis no subdiretório /ShopSmart/', async ({ page, request }) => {
    await openApp(page)
    const href = await page.locator('link[rel=manifest]').getAttribute('href')
    expect(href).toBe('/ShopSmart/manifest.webmanifest')
    const m = await (await request.get(href!)).json()
    expect(m).toMatchObject({ name: 'ShopSmart', display: 'standalone', scope: './', start_url: './' })
    for (const i of m.icons) expect((await request.get(`/ShopSmart/${i.src}`)).status()).toBe(200)
    expect((await request.get('/ShopSmart/icons/apple-touch-icon.png')).status()).toBe(200)
  })

  test('funciona offline após a primeira visita (listas, carrinho, dados salvos)', async ({ page, context }) => {
    await startPurchase(page)
    await addManual(page, 'Pão', '120', '3')
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload() // agora controlada pelo SW
    await page.waitForFunction(() => !!navigator.serviceWorker.controller)
    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('region', { name: 'Resumo do carrinho' })).toContainText('R$ 3,60')
    await expect(page.getByText('Sem conexão')).toBeVisible()
    await page.goto('./#/listas')
    await expect(page.getByRole('heading', { name: 'Listas', exact: true })).toBeVisible()
    await page.goto('./#/mais/unidade')
    await expect(page.getByRole('heading', { name: 'Preço por unidade' })).toBeVisible()
    await context.setOffline(false)
  })

  test('atualização: aviso, compra em andamento e dados preservados', async ({ page }) => {
    await startPurchase(page)
    await addManual(page, 'Leite', '500', '2')
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await page.waitForFunction(() => !!navigator.serviceWorker.controller)
    // simula uma nova versão publicada: o sw.js em dist muda (restaurado ao final)
    const swPath = path.resolve('dist/sw.js')
    const original = fs.readFileSync(swPath, 'utf8')
    test.info().annotations.push({ type: 'info', description: 'sw.js alterado temporariamente' })
    fs.writeFileSync(swPath, original.replace(/const VERSION = '[^']*'/, "const VERSION = 'nova-versao-teste'"))
    try {
    await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r?.update() })
    await expect(page.getByText('Nova versão do ShopSmart disponível.')).toBeVisible({ timeout: 15000 })
    // a compra continua intacta enquanto a atualização espera
    await expect(page.getByRole('region', { name: 'Resumo do carrinho' })).toContainText('R$ 10,00')
    await page.getByRole('button', { name: 'Atualizar', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Resumo do carrinho' })).toContainText('R$ 10,00', { timeout: 15000 })
    await expect(page.getByText('Leite', { exact: true })).toBeVisible()
    const v = await page.evaluate(async () => (await (await fetch('/ShopSmart/sw.js')).text()).includes('nova-versao-teste'))
    expect(v).toBe(true)
    } finally {
      fs.writeFileSync(swPath, original)
    }
  })
})
