import { test, expect } from '@playwright/test'
import { go, openApp, seedV1 } from './helpers'

test.describe('listas (funcionalidades da v1 preservadas e modernizadas)', () => {
  test('adicionar, quantidade, essencial, marcar, desfazer exclusão, categorias recolhíveis', async ({ page }) => {
    await openApp(page, '#/listas')
    const add = async (n: string) => {
      await page.getByLabel('Adicionar item à lista').fill(n)
      await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
    }
    await add('Maçã')
    await add('Picanha')
    await expect(page.getByText('Maçã', { exact: true })).toBeVisible()
    // categoria sugerida automaticamente? (v1 usava 'geral'; aqui só garantimos que aparecem)
    await page.getByRole('button', { name: 'Aumentar Maçã' }).click()
    await expect(page.getByRole('button', { name: 'Diminuir Maçã' }).locator('xpath=following-sibling::span')).toHaveText('2')
    await page.getByRole('button', { name: /Marcar Maçã como essencial/ }).click()
    await page.getByRole('checkbox', { name: /Marcar Maçã/ }).click()
    await expect(page.getByText('No carrinho (1)')).toBeVisible()
    // remover + desfazer
    await page.getByRole('button', { name: 'Remover Picanha' }).click()
    await expect(page.locator('.list-item').getByText('Picanha', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Desfazer' }).click()
    await expect(page.locator('.list-item').getByText('Picanha', { exact: true })).toBeVisible()
    // recolher a categoria
    await page.getByRole('button', { name: /Outros/ }).first().click()
    await expect(page.locator('.list-item').getByText('Picanha', { exact: true })).toBeHidden()
  })

  test('múltiplas listas: criar, renomear, trocar, excluir com confirmação', async ({ page }) => {
    await openApp(page, '#/listas')
    await page.getByRole('button', { name: /Minha Lista/ }).first().click()
    const sheet = page.getByRole('dialog', { name: 'Minhas listas' })
    await sheet.getByLabel('Nome da nova lista').fill('Churrasco')
    await sheet.getByRole('button', { name: 'Criar lista' }).click()
    await expect(page.getByRole('heading', { name: 'Listas', exact: true })).toBeVisible()
    await expect(page.locator('.topbar .sub')).toHaveText('Churrasco')
    await page.getByRole('button', { name: /Churrasco/ }).first().click()
    await sheet.getByRole('button', { name: 'Renomear Churrasco' }).click()
    await sheet.getByLabel('Novo nome da lista').fill('Festa')
    await sheet.getByRole('button', { name: 'Salvar nome' }).click()
    await sheet.getByRole('button', { name: 'Excluir Festa' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir' }).click()
    await expect(sheet.getByText('Festa')).toHaveCount(0)
  })

  test('preços por mercado, melhor mercado, produto sem preço e comparador com deslocamento', async ({ page }) => {
    await seedV1(page)
    await openApp(page, '#/listas')
    await page.getByRole('tab', { name: 'Preços' }).click()
    await expect(page.getByLabel('Arroz 5kg em Atacadão')).toHaveValue('24,90')
    // comparador: Atacadão 5% off
    await openApp(page, '#/mais/comparador')
    await expect(page.getByText('Melhor escolha para a lista completa')).toBeVisible()
    // Atacadão: (2×24,90 + 6×4,59)=77,34 −5% = 73,47 ; Mercado B: 2×26,50 + 6×4,20 = 78,20
    await expect(page.getByText('R$ 73,47').first()).toBeVisible()
    await expect(page.getByText(/Economia líquida estimada: R\$\s4,73/)).toBeVisible()
    // deslocamento de R$ 10 no Atacadão inverte o vencedor
    await page.getByLabel('Custo de deslocamento até Atacadão').fill('1000')
    await expect(page.getByText(/Economia líquida estimada: R\$\s5,27/)).toBeVisible()
    await expect(page.locator('section.hero')).toContainText('Mercado B')
  })

  test('produto sem preço não é tratado como gratuito', async ({ page }) => {
    await seedV1(page)
    await openApp(page, '#/listas')
    await page.getByLabel('Adicionar item à lista').fill('Sem preço')
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
    await openApp(page, '#/mais/comparador')
    await expect(page.getByText(/Sem nenhum preço|sem nenhum preço/i).first()).toBeVisible()
    await expect(page.getByText('Melhor escolha para a lista completa')).toHaveCount(0)
    await expect(page.getByText(/Nenhum mercado tem todos os itens/)).toBeVisible()
  })

  test('concluir compra da lista registra no financeiro', async ({ page }) => {
    await seedV1(page)
    await openApp(page, '#/listas')
    await page.getByRole('button', { name: 'Concluir compra' }).click()
    await page.getByRole('dialog', { name: 'Concluir compra' }).getByRole('button', { name: /Atacadão/ }).click()
    await expect(page.getByText(/registrada em Finanças/)).toBeVisible()
    await go(page, 'Finanças')
    await expect(page.getByText('R$ 260,82').first()).toBeVisible() // 187,35 (v1) + 73,47
  })
})

test.describe('calculadoras', () => {
  test('preço por unidade: validação, melhor opção e conversão', async ({ page }) => {
    await openApp(page, '#/mais/unidade')
    await page.getByLabel('Preço').first().fill('10')
    await page.getByLabel('Quantidade').first().fill('500')
    await page.getByLabel('Preço').nth(1).fill('18')
    await page.getByLabel('Quantidade').nth(1).fill('1')
    await page.getByLabel('Unidade').nth(1).selectOption('kg')
    await expect(page.getByText('Mais econômico')).toBeVisible()
    await expect(page.getByText('R$ 18,00')).toBeVisible()
    await page.getByLabel('Preço').first().fill('0')
    await expect(page.getByText('Informe um valor maior que zero.')).toBeVisible()
  })
  test('preço por unidade: tipos de medida diferentes avisam', async ({ page }) => {
    await openApp(page, '#/mais/unidade')
    await page.getByLabel('Preço').first().fill('10')
    await page.getByLabel('Quantidade').first().fill('500')
    await page.getByLabel('Preço').nth(1).fill('9')
    await page.getByLabel('Quantidade').nth(1).fill('1')
    await page.getByLabel('Unidade').nth(1).selectOption('L')
    await expect(page.getByText(/tipos de medida diferentes/)).toBeVisible()
  })
  test('combustível: regra dos 70% e custo do trajeto', async ({ page }) => {
    await openApp(page, '#/mais/combustivel')
    await page.getByLabel('Etanol (R$/L)').fill('3.99')
    await page.getByLabel('Gasolina (R$/L)').fill('5.99')
    await expect(page.getByRole('status').filter({ hasText: 'Abasteça com' })).toContainText('Etanol')
    await expect(page.getByRole('status').filter({ hasText: 'Abasteça com' })).toContainText('66,6%')
    await page.getByLabel('Gasolina (R$/L)').fill('5.00')
    await expect(page.getByRole('status').filter({ hasText: 'Abasteça com' })).toContainText('Gasolina')
    await page.getByLabel('Distância (km)').fill('50')
    await page.getByLabel('Consumo (km/L)').fill('10')
    await page.getByLabel('Preço do combustível (R$/L)').fill('5')
    await expect(page.getByText('R$ 25,00')).toBeVisible()
    await page.getByRole('switch', { name: 'Ida e volta' }).click()
    await expect(page.getByText('R$ 50,00')).toBeVisible()
    // persistência nas mesmas chaves da v1
    expect(await page.evaluate(() => localStorage.getItem('shopsmart_dist'))).toBe('"50"')
    expect(await page.evaluate(() => localStorage.getItem('shopsmart_roundtrip'))).toBe('true')
  })
})

test.describe('backup e restauração', () => {
  test('exporta JSON/CSV e restaura em um banco limpo', async ({ page, context }) => {
    await seedV1(page)
    await openApp(page, '#/mais/backup')
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Backup completo/ }).click()])
    const path = await dl.path()
    const fs = await import('node:fs')
    const json = JSON.parse(fs.readFileSync(path!, 'utf8'))
    expect(json.format).toBe('shopsmart-backup')
    expect(json.data.listsMeta).toHaveLength(2)
    expect(json.data.purchases.length).toBeGreaterThanOrEqual(1)
    const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Financeiro \(CSV\)/ }).click()])
    const text = fs.readFileSync((await csv.path())!, 'utf8')
    expect(text).toContain('Data;Compra;Supermercado')

    // "Outro aparelho": contexto novo, sem dados
    const p2 = await context.browser()!.newContext({ ...(test.info().project.use as object), acceptDownloads: true })
    const page2 = await p2.newPage()
    await page2.goto('./#/mais/backup')
    await page2.locator('input[type=file]').setInputFiles(path!)
    await expect(page2.getByRole('dialog', { name: 'Importar backup' })).toContainText('2 listas')
    await page2.getByRole('button', { name: 'Mesclar com meus dados' }).click()
    await expect(page2.getByText(/Restaurado:/)).toBeVisible()
    await page2.goto('./#/listas')
    await page2.reload()
    await expect(page2.getByText('Arroz 5kg')).toBeVisible()
    await p2.close()
  })

  test('arquivo inválido é recusado sem alterar dados', async ({ page }) => {
    await openApp(page, '#/mais/backup')
    await page.locator('input[type=file]').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"foo":1}') })
    await expect(page.getByRole('dialog', { name: 'Importar backup' })).toContainText('não é um backup do ShopSmart')
    await expect(page.getByRole('button', { name: /Mesclar|Substituir/ })).toHaveCount(0)
  })

  test('substituir tudo exige confirmação', async ({ page }) => {
    await seedV1(page)
    await openApp(page, '#/mais/backup')
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Backup completo/ }).click()])
    await page.locator('input[type=file]').setInputFiles((await dl.path())!)
    const dlg = page.getByRole('dialog', { name: 'Importar backup' })
    await dlg.getByRole('button', { name: /Substituir tudo/ }).click()
    await dlg.getByRole('button', { name: 'Substituir meus dados' }).click()
    await expect(page.getByRole('alertdialog')).toContainText('Substituir todos os dados?')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
  })
})
