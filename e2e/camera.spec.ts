import { test, expect } from '@playwright/test'
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

test.describe('leitor de código de barras (câmera simulada)', () => {
  test('lê o código com a câmera, consulta a base pública e preenche o produto', async ({ page }) => {
    let offCalls = 0
    await page.route('**/world.openfoodfacts.org/api/v2/product/**', async (r) => { offCalls++; await r.fulfill({ json: offResponse }) })
    await page.route('**/catalog/manifest.json', (r) => r.fulfill({ status: 404, body: '' }))
    await startPurchase(page)
    await page.getByRole('button', { name: 'Código' }).click()
    const scanner = page.getByRole('dialog', { name: 'Leitor de código de barras' })
    await expect(scanner).toBeVisible()
    // produto identificado → formulário de confirmação com preço em branco (histórico não vira preço atual)
    const form = page.getByRole('dialog', { name: 'Adicionar produto' })
    await expect(form).toBeVisible({ timeout: 30000 })
    await expect(form.getByLabel('Nome', { exact: true })).toHaveValue('Leite Condensado Moça')
    await expect(form.getByLabel('Marca')).toHaveValue('Nestlé')
    await expect(form).toContainText(CODE)
    await expect(form).toContainText('Open Food Facts')
    await expect(form.getByLabel(/Preço atual/)).toHaveValue('')
    await form.getByLabel(/Preço atual/).fill('799')
    await form.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
    await expect(page.getByRole('region', { name: 'Resumo do carrinho' })).toContainText('R$ 7,99')
    expect(offCalls).toBe(1)
    // a câmera foi liberada
    const live = await page.evaluate(() => [...document.querySelectorAll('video')].filter((v) => (v.srcObject as MediaStream | null)?.active).length)
    expect(live).toBe(0)
  })

  test('segunda leitura do mesmo produto vem do catálogo pessoal, sem rede', async ({ page }) => {
    await page.route('**/world.openfoodfacts.org/api/v2/product/**', (r) => r.fulfill({ json: offResponse }))
    await page.route('**/catalog/manifest.json', (r) => r.fulfill({ status: 404, body: '' }))
    await startPurchase(page)
    await page.getByRole('button', { name: 'Código' }).click()
    const form = page.getByRole('dialog', { name: 'Adicionar produto' })
    await expect(form).toBeVisible({ timeout: 30000 })
    await form.getByLabel(/Preço atual/).fill('799')
    await form.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
    // agora sem internet e sem rota externa
    await page.unroute('**/world.openfoodfacts.org/api/v2/product/**')
    await page.context().setOffline(true)
    await page.getByRole('button', { name: 'Código' }).click()
    const form2 = page.getByRole('dialog', { name: 'Adicionar produto' })
    await expect(form2).toBeVisible({ timeout: 30000 })
    await expect(form2.getByLabel('Nome', { exact: true })).toHaveValue('Leite Condensado Moça')
    await expect(form2).toContainText('Seu catálogo')
    await page.context().setOffline(false)
  })

  test('produto desconhecido em todas as bases: cadastro manual e aprendizado', async ({ page }) => {
    await page.route('**/world.open*facts.org/api/v2/product/**', (r) => r.fulfill({ json: { status: 0 } }))
    await page.route('**/catalog/manifest.json', (r) => r.fulfill({ status: 404, body: '' }))
    await startPurchase(page)
    await page.getByRole('button', { name: 'Código' }).click()
    const form = page.getByRole('dialog', { name: 'Adicionar produto' })
    await expect(form).toBeVisible({ timeout: 40000 })
    await expect(form.getByLabel('Nome', { exact: true })).toHaveValue('')
    await expect(form).toContainText('Produto novo')
    await form.getByLabel('Nome', { exact: true }).fill('Doce de leite caseiro')
    await form.getByLabel(/Preço atual/).fill('1250')
    await form.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
    await expect(page.getByText('Doce de leite caseiro', { exact: true })).toBeVisible()
  })

  test('digitar código manualmente e fechar libera a câmera', async ({ page }) => {
    await page.route('**/world.open*facts.org/api/v2/product/**', (r) => r.fulfill({ json: offResponse }))
    await page.route('**/catalog/manifest.json', (r) => r.fulfill({ status: 404, body: '' }))
    await startPurchase(page)
    await page.getByRole('button', { name: 'Código' }).click()
    const scanner = page.getByRole('dialog', { name: 'Leitor de código de barras' })
    await scanner.getByLabel('Digitar código de barras').fill('1234567890123')
    await scanner.getByRole('button', { name: 'Buscar' }).click()
    await expect(scanner.getByText(/Código inválido/)).toBeVisible()
    await scanner.getByRole('button', { name: 'Fechar leitor' }).click()
    await expect(scanner).toBeHidden()
    const live = await page.evaluate(() => [...document.querySelectorAll('video')].length)
    expect(live).toBe(0)
  })
})

test.describe('leitura de etiqueta (OCR local real)', () => {
  test('foto de etiqueta → recorte → OCR → candidatos de preço → confirmação manual obrigatória', async ({ page }) => {
    test.setTimeout(180_000)
    // gera a "foto" da etiqueta
    const lab = await page.context().newPage()
    await lab.setViewportSize({ width: 900, height: 420 })
    await lab.setContent(`<body style="margin:0;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#000"><div style="padding:30px 40px"><div style="font-size:44px;font-weight:700">ARROZ BRANCO CAMIL 5KG</div><div style="font-size:30px;margin-top:10px">Cod 7891000100103   Val 12/05/2027</div><div style="font-size:96px;font-weight:800;margin-top:10px">R$ 24,90</div><div style="font-size:30px">R$ 4,98/kg</div></div></body>`)
    const png = await lab.screenshot()
    await lab.close()

    await startPurchase(page)
    await page.getByRole('button', { name: 'Etiqueta' }).click()
    const cap = page.getByRole('dialog', { name: 'Fotografar etiqueta de preço' })
    await expect(cap).toBeVisible()
    await cap.getByLabel('Escolher da galeria').locator('input').setInputFiles({ name: 'etiqueta.png', mimeType: 'image/png', buffer: png })
    await expect(cap.getByText('Recortar o preço')).toBeVisible()
    await cap.getByRole('button', { name: 'Ler etiqueta' }).click()
    await expect(cap.getByText('Confirme os dados')).toBeVisible({ timeout: 150_000 })
    // preço efetivo entre os candidatos; preço por kg classificado à parte; código de barras/data ignorados
    await expect(cap.getByRole('radio', { name: /24,90/ })).toBeVisible()
    const texts = await cap.locator('[role=radiogroup]').innerText()
    expect(texts).not.toMatch(/7891000100103/)
    // confirmação: só habilita com um preço escolhido
    const use = cap.getByRole('button', { name: 'Usar estes dados' })
    await cap.getByRole('radio', { name: /^24,90|R\$\s24,90/ }).first().click()
    // o recorte padrão pode cortar o título: o nome é obrigatório, então o usuário completa
    const nm = cap.getByLabel('Nome do produto')
    if (!(await nm.inputValue()).trim()) await nm.fill('Arroz Camil 5kg')
    await expect(use).toBeEnabled()
    await use.click()
    const form = page.getByRole('dialog', { name: 'Adicionar produto' })
    await expect(form).toBeVisible()
    await expect(form.getByLabel(/Preço atual/)).toHaveValue('24,90')
    await form.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
    await expect(page.getByRole('region', { name: 'Resumo do carrinho' })).toContainText('R$ 24,90')
  })
})
