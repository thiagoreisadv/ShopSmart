// Gera os ícones PNG do PWA a partir de SVG, usando o Chromium do Playwright.
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const out = resolve(import.meta.dirname, '..', 'public', 'icons')
mkdirSync(out, { recursive: true })

const glyph = (stroke) => `<g fill="none" stroke="${stroke}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 26h32l-3.5 18a4 4 0 0 1-3.9 3.2H23.4a4 4 0 0 1-3.9-3.2z"/><path d="M24 26l6-10M40 26l-6-10"/><path d="M27 33v8M37 33v8"/></g>`
const any = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#059669"/>${glyph('#fff')}</svg>`
// "maskable": fundo sangrado + glifo dentro da zona segura (80%)
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#059669"/><g transform="translate(32 32) scale(0.74) translate(-32 -32)">${glyph('#fff')}</g></svg>`
// iOS não aplica máscara: quadrado sangrado, o sistema arredonda
const apple = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#059669"/><g transform="translate(32 32) scale(0.86) translate(-32 -32)">${glyph('#fff')}</g></svg>`

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
const page = await browser.newPage()
async function render(svg, size, file) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`)
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } })
  writeFileSync(join(out, file), buf)
}
await render(any, 192, 'icon-192.png')
await render(any, 512, 'icon-512.png')
await render(maskable, 512, 'icon-maskable-512.png')
await render(apple, 180, 'apple-touch-icon.png')
await browser.close()
console.log('ícones gerados em public/icons')
