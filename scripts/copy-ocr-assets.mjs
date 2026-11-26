// Copia o motor OCR (Tesseract.js) e o idioma português para public/ocr, para hospedar tudo no próprio site
// (sem CDN de terceiros, e com cache pelo Service Worker após o primeiro uso).
import { cpSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const out = join(root, 'public', 'ocr')
const nm = join(root, 'node_modules')

if (!existsSync(join(nm, 'tesseract.js'))) {
  console.warn('[ocr] tesseract.js não instalado; pulando')
  process.exit(0)
}
mkdirSync(join(out, 'core'), { recursive: true })
mkdirSync(join(out, 'lang'), { recursive: true })
cpSync(join(nm, 'tesseract.js', 'dist', 'worker.min.js'), join(out, 'worker.min.js'))
for (const f of readdirSync(join(nm, 'tesseract.js-core'))) {
  // somente variantes LSTM (as usadas pelo createWorker com OEM padrão)
  if (/-lstm\.wasm\.js$/.test(f) || /-lstm\.js$/.test(f)) cpSync(join(nm, 'tesseract.js-core', f), join(out, 'core', f))
}
cpSync(join(nm, '@tesseract.js-data', 'por', '4.0.0_best_int', 'por.traineddata.gz'), join(out, 'lang', 'por.traineddata.gz'))
console.log('[ocr] assets copiados para public/ocr')
