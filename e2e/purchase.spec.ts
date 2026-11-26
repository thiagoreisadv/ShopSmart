import { test, expect } from '@playwright/test'
import { addManual, go, openApp, startPurchase } from './helpers'

test.describe('modo compra inteligente', () => {
  test('fluxo completo: iniciar → adicionar → orçamento → recuperar sessão → finalizar → finanças', async ({ page }) => {
    await startPurchase(page, { market: 'Atacadão', city: 'Loanda', budget: '10000' })
    const bar = page.getByRole('region', { name: 'Resumo do carrinho' })
    await expect(bar).toContainText('R$ 0,00')
    await addManual(page, 'Arroz Camil 5kg', '2490')
    await expect(bar).toContainText('R$ 24,90')
    await expect(bar).toContainText('25%')
    await addManual(page, 'Leite integral', '499', '6')
    await expect(bar).toContainText('R$ 54,84') // 24,90 + 6×4,99
    // 80% → 100%: alerta, sem bloquear
    await addManual(page, 'Carne', '3500')
    await expect(page.getByText(/90% do orçamento|80% do orçamento/).first()).toBeVisible()
    await addManual(page, 'Cerveja', '2000')
    await expect(page.getByText(/Orçamento ultrapassado/).first()).toBeVisible()
    await expect(bar).toContainText('R$ 109,84')

    // Recuperação de sessão: recarrega a página no meio da compra
    await page.reload()
    await expect(page.getByRole('region', { name: 'Resumo do carrinho' })).toContainText('R$ 109,84')
    await expect(page.getByText('Arroz Camil 5kg')).toBeVisible()

    // Finalizar (com valor pago diferente do estimado)
    await page.getByRole('button', { name: 'Finalizar compra' }).click()
    const dlg = page.getByRole('dialog', { name: 'Finalizar compra' })
    await expect(dlg).toContainText('R$ 109,84')
    await dlg.getByLabel('Valor efetivamente pago').fill('10800')
    await expect(dlg).toContainText('a menos que o estimado')
    await dlg.getByLabel(/Forma de pagamento/).selectOption('pix')
    const fin = dlg.getByRole('button', { name: /Finalizar e registrar/ })
    await fin.dblclick() // duplo toque não pode duplicar
    await expect(page.getByRole('heading', { name: 'Compra registrada' })).toBeVisible()
    await expect(page.getByText('R$ 108,00').first()).toBeVisible()

    // Finanças reflete exatamente uma compra
    await go(page, 'Finanças')
    await expect(page.getByText('R$ 108,00').first()).toBeVisible()
    await go(page, 'Mais')
    await page.getByRole('button', { name: /Histórico de compras/ }).click()
    await expect(page.locator('.list-item')).toHaveCount(1)
  })

  test('cancelar não contabiliza despesa e libera nova compra', async ({ page }) => {
    await startPurchase(page)
    await addManual(page, 'Café', '1890')
    await page.getByRole('button', { name: 'Cancelar compra' }).first().click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar compra' }).click()
    await expect(page.getByRole('button', { name: /Iniciar compra/ }).first()).toBeVisible()
    await go(page, 'Finanças')
    await expect(page.getByText('Nenhuma compra finalizada')).toBeVisible()
    await openApp(page, '#/mais/compras')
    await page.getByRole('tab', { name: 'Canceladas' }).click()
    await expect(page.locator('.list-item')).toHaveCount(1)
  })

  test('remover item com desfazer, quantidade e produto por peso', async ({ page }) => {
    await startPurchase(page)
    await addManual(page, 'Pão francês', '120', '4')
    const bar = page.getByRole('region', { name: 'Resumo do carrinho' })
    await expect(bar).toContainText('R$ 4,80')
    await page.getByRole('button', { name: 'Aumentar Pão francês' }).click()
    await expect(bar).toContainText('R$ 6,00')
    // por peso
    await page.getByRole('button', { name: 'Manual' }).click()
    const dlg = page.getByRole('dialog', { name: 'Adicionar produto' })
    await dlg.getByLabel('Nome', { exact: true }).fill('Contra filé')
    await dlg.getByRole('tab', { name: 'Quilo' }).click()
    await dlg.getByLabel(/Preço atual/).fill('4990')
    await dlg.getByLabel('Unidade').selectOption('g')
    await dlg.getByLabel('Peso / volume').fill('532')
    await expect(dlg).toContainText('R$ 26,55')
    await dlg.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
    await expect(bar).toContainText('R$ 32,55')
    // remove e desfaz
    await page.getByRole('button', { name: 'Remover Contra filé' }).click()
    await expect(bar).toContainText('R$ 6,00')
    await page.getByRole('button', { name: 'Desfazer' }).click()
    await expect(bar).toContainText('R$ 32,55')
  })

  test('produto desconhecido é aprendido e promoção "3 por R$ 10" é calculada', async ({ page }) => {
    await startPurchase(page)
    await page.getByRole('button', { name: 'Manual' }).click()
    const dlg = page.getByRole('dialog', { name: 'Adicionar produto' })
    await dlg.getByLabel('Nome', { exact: true }).fill('Sabonete Dove')
    await dlg.getByLabel(/Preço atual/).fill('399')
    await dlg.getByLabel('Quantidade', { exact: true }).fill('7')
    await dlg.getByRole('switch', { name: /promoção por quantidade/ }).click()
    await dlg.getByLabel('Por (total)').fill('1000')
    await expect(dlg).toContainText('R$ 23,99') // 2×10,00 + 1×3,99
    await dlg.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
    await expect(page.getByRole('region', { name: 'Resumo do carrinho' })).toContainText('R$ 23,99')
    // aprendido no catálogo
    await openApp(page, '#/mais/catalogo')
    await expect(page.getByText('Sabonete Dove', { exact: true })).toBeVisible()
  })

  test('vincular lista marca itens automaticamente', async ({ page }) => {
    await openApp(page, '#/listas')
    await page.getByLabel('Adicionar item à lista').fill('Arroz Camil 5kg')
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
    await expect(page.getByText('Arroz Camil 5kg')).toBeVisible()
    await page.getByRole('button', { name: 'Comprar com esta lista' }).click()
    const dlg = page.getByRole('dialog', { name: 'Iniciar compra' })
    await expect(dlg.getByLabel(/Vincular a uma lista/)).not.toHaveValue('')
    await dlg.getByLabel(/Supermercado|Ou cadastre/).fill('Mercado Central')
    await dlg.getByRole('button', { name: 'Começar' }).click()
    await addManual(page, 'Arroz Camil 5kg', '2490')
    await go(page, 'Listas')
    await expect(page.getByRole('checkbox', { name: /Desmarcar Arroz Camil 5kg/ })).toBeVisible()
  })

  test('histórico de preços e alerta de preço no segundo registro', async ({ page }) => {
    await startPurchase(page, { market: 'A' })
    await addManual(page, 'Café Pilão 500g', '2000')
    await page.getByRole('button', { name: 'Finalizar compra' }).click()
    await page.getByRole('dialog', { name: 'Finalizar compra' }).getByRole('button', { name: /Finalizar e registrar/ }).click()
    await page.getByRole('button', { name: 'Nova compra' }).click() // já abre o início de compra
    const st = page.getByRole('dialog', { name: 'Iniciar compra' })
    await st.getByLabel(/Supermercado|Ou cadastre/).fill('B')
    await st.getByRole('button', { name: 'Começar' }).click()
    await page.getByRole('button', { name: 'Manual' }).click()
    const dlg = page.getByRole('dialog', { name: 'Adicionar produto' })
    await dlg.getByLabel('Nome', { exact: true }).fill('Café Pilão 500g')
    // histórico aparece como referência, NÃO como preço atual
    await expect(dlg).toContainText('Histórico (não é o preço de hoje)')
    await expect(dlg.getByLabel(/Preço atual/)).toHaveValue('')
    await dlg.getByLabel(/Preço atual/).fill('1800')
    await expect(dlg).toContainText(/Menor preço já registrado/)
    await dlg.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
    await expect(page.getByText(/Menor preço já registrado/).first()).toBeVisible()
  })
})
