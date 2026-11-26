import { test, expect } from '@playwright/test'
import { addManual, go, openApp, seedV1, startPurchase } from './helpers'

test.describe('navegação simplificada', () => {
  test('somente 4 destinos: Início, Listas, Comprar e Gastos (sem aba Mais)', async ({ page }) => {
    await openApp(page)
    const nav = page.locator('.bottom-nav:visible, .sidebar:visible').first()
    for (const n of ['Início', 'Listas', 'Comprar', 'Gastos']) await expect(nav.getByRole('button', { name: n })).toBeVisible()
    await expect(nav.getByRole('button', { name: /^Mais$/ })).toHaveCount(0)
  })

  test('configurações na engrenagem do cabeçalho, com backup e restauração integrados', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Configurações' }).click()
    await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Backup e restauração' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Backup completo/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Reimportar dados da v1/ })).toBeVisible()
    // engrenagem presente nas demais telas
    for (const t of ['Listas', 'Comprar', 'Gastos'] as const) {
      await go(page, t)
      await expect(page.getByRole('button', { name: 'Configurações' })).toBeVisible()
    }
  })

  test('Início: essencial, sem gráficos nem duplicação; ferramentas rápidas levam às calculadoras e ao catálogo', async ({ page }) => {
    await seedV1(page)
    await openApp(page)
    await expect(page.getByRole('button', { name: 'Iniciar compra' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Iniciar compra' })).toContainText('Controle seus gastos em tempo real')
    await expect(page.locator('svg.chart')).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Resumo do mês' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Listas recentes' })).toContainText('Minha Lista')
    await page.getByRole('button', { name: 'Preço por unidade' }).click()
    await expect(page.getByRole('heading', { name: 'Preço por unidade' })).toBeVisible()
    await page.goBack()
    await page.getByRole('button', { name: 'Combustível' }).click()
    await expect(page.getByRole('heading', { name: 'Combustível' })).toBeVisible()
    await page.goBack()
    await page.getByRole('button', { name: 'Comparar preços' }).click()
    await expect(page.getByRole('tab', { name: 'Comparar', selected: true })).toBeVisible()
    // catálogo: acessível pelas configurações
    await page.getByRole('button', { name: 'Configurações' }).click()
    await page.getByRole('button', { name: /Catálogo de produtos/ }).click()
    await expect(page.getByRole('heading', { name: 'Catálogo de produtos' })).toBeVisible()
  })

  test('Início muda para "Continuar compra" quando há sessão ativa', async ({ page }) => {
    await startPurchase(page)
    await addManual(page, 'Café', '1890')
    await go(page, 'Início')
    await expect(page.getByRole('button', { name: /Continuar compra · R\$\s18,90/ })).toBeVisible()
    await page.getByRole('button', { name: /Continuar compra/ }).click()
    await expect(page.getByRole('region', { name: 'Resumo do carrinho' })).toContainText('R$ 18,90')
  })

  test('histórico de compras dentro de Gastos', async ({ page }) => {
    await seedV1(page)
    await openApp(page, '#/gastos')
    await page.getByRole('tab', { name: 'Compras' }).click()
    await expect(page.locator('.list-item').first()).toContainText('Atacadão')
    await expect(page.getByRole('button', { name: 'Exportar CSV' })).toBeVisible()
  })

  test('comparador dentro de Listas', async ({ page }) => {
    await seedV1(page)
    await openApp(page, '#/listas')
    await page.getByRole('tab', { name: 'Comparar' }).click()
    await expect(page.getByText('Melhor escolha para a lista completa')).toBeVisible()
  })

  test('histórico de preços nos detalhes do produto (catálogo)', async ({ page }) => {
    await startPurchase(page)
    await addManual(page, 'Café Pilão 500g', '2000')
    await page.getByRole('button', { name: 'Finalizar compra' }).click()
    await page.getByRole('dialog', { name: 'Finalizar compra' }).getByRole('button', { name: /Finalizar e registrar/ }).click()
    await openApp(page, '#/catalogo')
    await page.getByRole('button', { name: /Café Pilão 500g/ }).click()
    const sheet = page.getByRole('dialog', { name: 'Produto' })
    await expect(sheet.getByText('Histórico de preços')).toBeVisible()
    await expect(sheet).toContainText('R$ 20,00')
    await expect(sheet.locator('svg.chart')).toBeVisible()
  })

  test('links antigos da v2.0 continuam funcionando (redirecionamento)', async ({ page }) => {
    await openApp(page, '#/financas')
    await expect(page).toHaveURL(/#\/gastos$/)
    await page.goto('./#/mais/comparador')
    await expect(page).toHaveURL(/#\/listas\/comparar$/)
    await page.goto('./#/compra')
    await expect(page).toHaveURL(/#\/comprar$/)
    await page.goto('./#/mais/backup')
    await expect(page).toHaveURL(/#\/config$/)
  })

  test('compra: total e orçamento restante sempre visíveis; ação principal Escanear ao alcance do polegar', async ({ page }) => {
    await startPurchase(page, { budget: '10000' })
    await addManual(page, 'Arroz', '2490')
    const bar = page.getByRole('region', { name: 'Resumo do carrinho' })
    await expect(bar).toContainText('R$ 24,90')
    await expect(bar).toContainText('Restante')
    await expect(bar).toContainText('R$ 75,10')
    // rolando a página a barra continua visível (sticky)
    for (let i = 0; i < 8; i++) await addManual(page, `Item ${i}`, '100')
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(bar).toBeInViewport()
    const scan = page.getByRole('button', { name: 'Escanear produto' })
    await expect(scan).toBeInViewport()
    const vh = page.viewportSize()!.height
    const box = (await scan.boundingBox())!
    if (page.viewportSize()!.width < 900) expect(box.y).toBeGreaterThan(vh * 0.6) // metade inferior da tela
  })

  test('ações secundárias em menu contextual e edição de item em bottom sheet', async ({ page }) => {
    await startPurchase(page)
    await addManual(page, 'Leite', '500')
    await page.getByRole('button', { name: 'Mais opções da compra' }).click()
    const menu = page.getByRole('dialog', { name: 'Compra' })
    for (const a of ['Orçamento e desconto no caixa', 'Gastos por categoria', 'Cancelar compra']) await expect(menu.getByRole('button', { name: new RegExp(a) })).toBeVisible()
    await menu.getByRole('button', { name: /Gastos por categoria/ }).click()
    await expect(page.getByRole('dialog', { name: 'Gastos por categoria' })).toContainText('R$ 5,00')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Editar Leite' }).click()
    const sheet = page.getByRole('dialog', { name: 'Editar item' })
    await sheet.getByLabel(/Preço atual/).fill('600')
    await sheet.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByRole('region', { name: 'Resumo do carrinho' })).toContainText('R$ 6,00')
  })
})
