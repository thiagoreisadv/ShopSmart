import { test, expect, type Page } from '@playwright/test'
import { startPurchase } from './helpers'
import { writeBarcodeY4m } from './media'

const CODE = '7891000100103'
const y4m = writeBarcodeY4m(CODE)

test.use({
  permissions: ['camera'],
  launchOptions: {
    executablePath: process.env.PW_CHROMIUM,
    args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${y4m}`],
  },
})

const offResponse = { status: 1, product: { product_name_pt: 'Leite Condensado Moça', brands: 'Nestlé', categories_tags: ['en:dairies'], quantity: '395 g' } }
const mockNet = async (page: Page, off: unknown = offResponse) => {
  await page.route('**/world.open*facts.org/api/v2/product/**', (r) => r.fulfill({ json: off }))
  await page.route('**/catalog/manifest.json', (r) => r.fulfill({ status: 404, body: '' }))
}
const openCamera = async (page: Page) => {
  await page.getByRole('button', { name: 'Escanear produto' }).click()
  const cam = page.getByRole('dialog', { name: 'Escanear produto' })
  await expect(cam).toBeVisible()
  return cam
}
const liveVideos = (page: Page) => page.evaluate(() => [...document.querySelectorAll('video')].filter((v) => (v.srcObject as MediaStream | null)?.active).length)

/** "Foto" de uma etiqueta de preço renderizada pelo próprio navegador. */
async function labelPng(page: Page, name = 'ARROZ BRANCO CAMIL 5KG', price = 'R$ 24,90') {
  const lab = await page.context().newPage()
  await lab.setViewportSize({ width: 900, height: 360 })
  await lab.setContent(`<body style="margin:0;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#000"><div style="padding:30px 40px"><div style="font-size:44px;font-weight:700">${name}</div><div style="font-size:100px;font-weight:800;margin-top:14px">${price}</div></div></body>`)
  const png = await lab.screenshot()
  await lab.close()
  return png
}

test.describe('câmera unificada — código de barras (câmera simulada)', () => {
  test('lê o código continuamente, identifica o produto e pede o preço atual', async ({ page }) => {
    let offCalls = 0
    await page.route('**/world.openfoodfacts.org/api/v2/product/**', async (r) => { offCalls++; await r.fulfill({ json: offResponse }) })
    await page.route('**/catalog/manifest.json', (r) => r.fulfill({ status: 404, body: '' }))
    await startPurchase(page)
    const cam = await openCamera(page)
    const panel = cam.getByRole('group', { name: 'Confirmar produto' })
    await expect(panel).toBeVisible({ timeout: 30000 })
    await expect(panel.getByLabel('Nome do produto')).toHaveValue('Leite Condensado Moça')
    await expect(panel).toContainText(CODE)
    await expect(panel).toContainText('Open Food Facts')
    // produto sem preço: NÃO preenche; oferece ler a etiqueta
    await expect(panel.getByLabel('Preço', { exact: true })).toHaveValue('')
    await expect(panel.getByRole('button', { name: /Ler preço da etiqueta/ })).toBeVisible()
    await expect(panel.getByRole('button', { name: /Confirmar e adicionar/ })).toBeDisabled()
    await panel.getByLabel('Preço', { exact: true }).fill('799')
    await panel.getByRole('button', { name: /Confirmar e adicionar/ }).click()
    // continua na câmera com o total atualizado (registro em sequência)
    await expect(cam.locator('.cap-total')).toContainText('R$ 7,99')
    await cam.getByRole('button', { name: 'Fechar câmera' }).click()
    await expect(page.getByRole('region', { name: 'Resumo do carrinho' })).toContainText('R$ 7,99')
    expect(offCalls).toBe(1)
    expect(await liveVideos(page)).toBe(0) // câmera liberada
  })

  test('registra vários produtos em sequência sem sair da câmera (código + digitado)', async ({ page }) => {
    await mockNet(page)
    await startPurchase(page)
    const cam = await openCamera(page)
    const panel = cam.getByRole('group', { name: 'Confirmar produto' })
    await expect(panel).toBeVisible({ timeout: 30000 })
    await panel.getByLabel('Preço', { exact: true }).fill('799')
    await panel.getByRole('button', { name: /Confirmar e adicionar/ }).click()
    // 2º produto, digitado, na mesma sessão de câmera
    await cam.getByRole('button', { name: 'Digitar manualmente' }).click({ timeout: 10000 }).catch(() => {})
    const p2 = cam.getByRole('group', { name: 'Confirmar produto' })
    await expect(p2).toBeVisible()
    if (!(await p2.getByLabel('Nome do produto').inputValue())) {
      await p2.getByLabel('Nome do produto').fill('Pão francês')
      await p2.getByLabel('Preço', { exact: true }).fill('120')
      await p2.getByLabel('Aumentar quantidade').click()
      await p2.getByLabel('Aumentar quantidade').click()
      await p2.getByRole('button', { name: /Confirmar e adicionar/ }).click()
      await expect(cam.locator('.cap-total')).toContainText('R$ 11,59') // 7,99 + 3×1,20
    }
    await cam.getByRole('button', { name: 'Fechar câmera' }).click()
    await expect(page.getByRole('region', { name: 'Resumo do carrinho' })).toContainText('R$ 11,59')
  })

  test('mesmo produto, de novo: vem do catálogo pessoal, sem rede', async ({ page }) => {
    await mockNet(page)
    await startPurchase(page)
    let cam = await openCamera(page)
    let panel = cam.getByRole('group', { name: 'Confirmar produto' })
    await expect(panel).toBeVisible({ timeout: 30000 })
    await panel.getByLabel('Preço', { exact: true }).fill('799')
    await panel.getByRole('button', { name: /Confirmar e adicionar/ }).click()
    await cam.getByRole('button', { name: 'Fechar câmera' }).click()
    await page.unroute('**/world.open*facts.org/api/v2/product/**')
    await page.context().setOffline(true)
    cam = await openCamera(page)
    panel = cam.getByRole('group', { name: 'Confirmar produto' })
    await expect(panel).toBeVisible({ timeout: 30000 })
    await expect(panel.getByLabel('Nome do produto')).toHaveValue('Leite Condensado Moça')
    await expect(panel).toContainText('Seu catálogo')
    await expect(panel.getByLabel('Preço', { exact: true })).toHaveValue('')
    await page.context().setOffline(false)
  })

  test('produto desconhecido: cadastro manual no próprio painel e aprendizado', async ({ page }) => {
    await mockNet(page, { status: 0 })
    await startPurchase(page)
    const cam = await openCamera(page)
    const panel = cam.getByRole('group', { name: 'Confirmar produto' })
    await expect(panel).toBeVisible({ timeout: 40000 })
    await expect(panel.getByLabel('Nome do produto')).toHaveValue('')
    await expect(panel).toContainText('Produto novo')
    await panel.getByLabel('Nome do produto').fill('Doce de leite caseiro')
    await panel.getByLabel('Preço', { exact: true }).fill('1250')
    await panel.getByRole('button', { name: /Confirmar e adicionar/ }).click()
    await cam.getByRole('button', { name: 'Fechar câmera' }).click()
    await expect(page.getByText('Doce de leite caseiro', { exact: true })).toBeVisible()
  })

  test('busca manual pelo código e fechamento libera a câmera', async ({ page }) => {
    await mockNet(page)
    await startPurchase(page)
    const cam = await openCamera(page)
    // evita a leitura automática da imagem simulada durante o teste de validação
    await cam.getByRole('button', { name: 'Digitar código de barras' }).click({ timeout: 5000 }).catch(() => {})
    const input = cam.getByLabel('Digitar código de barras')
    if (await input.isVisible().catch(() => false)) {
      await input.fill('1234567890123')
      await cam.getByRole('button', { name: 'Buscar' }).click()
      await expect(cam.getByText(/Código inválido/)).toBeVisible()
    }
    await cam.getByRole('button', { name: 'Fechar câmera' }).click()
    await expect(cam).toBeHidden()
    expect(await liveVideos(page)).toBe(0)
  })
})

test.describe('câmera unificada — OCR de etiqueta (Tesseract real)', () => {
  test('OCR só roda sob demanda: foto da etiqueta → candidatos → confirmação → carrinho', async ({ page }) => {
    test.setTimeout(180_000)
    await mockNet(page, { status: 0 })
    const png = await labelPng(page)
    await startPurchase(page)
    const cam = await openCamera(page)
    // nenhum recurso do OCR foi baixado só por abrir a câmera
    const early = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => /\/ocr\//.test(e.name)).length)
    expect(early).toBe(0)
    await cam.getByLabel('Escolher foto da galeria').locator('input').setInputFiles({ name: 'etiqueta.png', mimeType: 'image/png', buffer: png })
    const panel = cam.getByRole('group', { name: 'Confirmar produto' })
    await expect(panel).toBeVisible({ timeout: 150_000 })
    await expect(panel.getByRole('radio', { name: /24,90/ })).toBeVisible()
    const nm = panel.getByLabel('Nome do produto')
    if (!(await nm.inputValue()).trim()) await nm.fill('Arroz Camil 5kg')
    await expect(panel.getByLabel('Preço', { exact: true })).toHaveValue('24,90')
    await panel.getByRole('button', { name: /Confirmar e adicionar/ }).click()
    await cam.getByRole('button', { name: 'Fechar câmera' }).click()
    await expect(page.getByRole('region', { name: 'Resumo do carrinho' })).toContainText('R$ 24,90')
  })

  test('produto identificado por código + preço lido da etiqueta (nome do código é mantido)', async ({ page }) => {
    test.setTimeout(180_000)
    await mockNet(page)
    const png = await labelPng(page, 'LEITE MOCA', 'R$ 7,49')
    await startPurchase(page)
    const cam = await openCamera(page)
    const panel = cam.getByRole('group', { name: 'Confirmar produto' })
    await expect(panel).toBeVisible({ timeout: 30000 })
    await panel.getByRole('button', { name: /Ler preço da etiqueta/ }).click()
    await expect(cam.getByRole('button', { name: 'Voltar ao produto' })).toBeVisible()
    await cam.getByLabel('Escolher foto da galeria').locator('input').setInputFiles({ name: 'etiqueta.png', mimeType: 'image/png', buffer: png })
    await expect(panel).toBeVisible({ timeout: 150_000 })
    await expect(panel.getByLabel('Nome do produto')).toHaveValue('Leite Condensado Moça')
    await expect(panel.getByLabel('Preço', { exact: true })).toHaveValue('7,49')
  })
})
