import { test, expect, type Page } from '@playwright/test'
import { startPurchase } from './helpers'
import { writeBlankY4m } from './media'

test.use({
  permissions: ['camera'],
  launchOptions: { executablePath: process.env.PW_CHROMIUM, args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${writeBlankY4m()}`] },
})

const mockNet = async (page: Page) => {
  await page.route('**/world.open*facts.org/api/v2/product/**', (r) => r.fulfill({ json: { status: 0 } }))
  await page.route('**/catalog/manifest.json', (r) => r.fulfill({ status: 404, body: '' }))
}
async function labelPng(page: Page) {
  const lab = await page.context().newPage()
  await lab.setViewportSize({ width: 900, height: 360 })
  await lab.setContent('<body style="margin:0;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#000"><div style="padding:30px 40px"><div style="font-size:44px;font-weight:700">ARROZ BRANCO CAMIL 5KG</div><div style="font-size:100px;font-weight:800;margin-top:14px">R$ 24,90</div></div></body>')
  const png = await lab.screenshot()
  await lab.close()
  return png
}

test.describe('câmera unificada — OCR de etiqueta (Tesseract real, câmera sem código)', () => {
    test('OCR só roda sob demanda: foto da etiqueta → candidatos → confirmação → carrinho', async ({ page }) => {
    test.setTimeout(180_000)
    await mockNet(page)
    const png = await labelPng(page)
    await startPurchase(page)
    await page.getByRole('button', { name: 'Escanear produto' }).click()
    const cam = page.getByRole('dialog', { name: 'Escanear produto' })
    await expect(cam).toBeVisible()
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
})
