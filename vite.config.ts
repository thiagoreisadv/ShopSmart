/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const BASE = process.env.VITE_BASE ?? '/ShopSmart/'

/** Gera a lista de pré-cache e a versão do Service Worker a partir do build. */
function swPrecache(): Plugin {
  let outDir = 'dist'
  return {
    name: 'shopsmart-sw-precache',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir
    },
    closeBundle() {
      const root = resolve(outDir)
      const files: string[] = []
      const walk = (d: string) => {
        for (const f of readdirSync(d)) {
          const p = join(d, f)
          if (statSync(p).isDirectory()) walk(p)
          else files.push(relative(root, p).split('\\').join('/'))
        }
      }
      walk(root)
      const precache = files.filter(
        (f) =>
          f !== 'sw.js' &&
          !f.startsWith('catalog/') &&
          !/tesseract|\.traineddata/i.test(f) &&
          !f.startsWith('ocr/') &&
          !f.endsWith('.map'),
      )
      const hash = createHash('sha256')
      for (const f of precache) hash.update(f).update(readFileSync(join(root, f)))
      const version = hash.digest('hex').slice(0, 12)
      const swPath = join(root, 'sw.js')
      let sw = readFileSync(swPath, 'utf8')
      sw = sw
        .replace('__SW_VERSION__', version)
        .replace('/*__PRECACHE__*/', precache.map((f) => JSON.stringify(f)).join(', '))
      writeFileSync(swPath, sw)
    },
  }
}

export default defineConfig({
  base: BASE,
  resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
  plugins: [react(), swPrecache()],
  build: { target: 'es2020', sourcemap: false, chunkSizeWarningLimit: 700 },
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
    css: false,
  },
})
