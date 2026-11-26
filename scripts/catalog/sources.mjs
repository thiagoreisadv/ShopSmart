// Leitura das fontes públicas oficiais (exportações em massa e deltas) — sem scraping de supermercados.
import { createGunzip } from 'node:zlib'
import { Readable, pipeline } from 'node:stream'
import { toRecord } from './lib.mjs'

export const URLS = {
  offCsv: 'https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz',
  obfCsv: 'https://static.openbeautyfacts.org/data/en.openbeautyfacts.org.products.csv.gz',
  opfCsv: 'https://static.openproductsfacts.org/data/en.openproductsfacts.org.products.csv.gz',
  offDeltaIndex: 'https://static.openfoodfacts.org/data/delta/index.txt',
  offDeltaBase: 'https://static.openfoodfacts.org/data/delta/',
}

const UA = 'ShopSmart-catalog-bot/2.0 (+https://github.com/thiagoreisadv/ShopSmart)'

export async function httpStream(url, fetchImpl = fetch, { retries = 3, timeoutMs = 120_000 } = {}) {
  let lastErr
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetchImpl(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(timeoutMs) })
      if (res.status === 404) throw Object.assign(new Error(`404 ${url}`), { notFound: true })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} em ${url}`)
      return Readable.fromWeb(res.body)
    } catch (e) {
      lastErr = e
      if (e.notFound) break
      await new Promise((r) => setTimeout(r, Math.min(2000 * 2 ** i, 15_000)))
    }
  }
  throw lastErr
}

export async function httpText(url, fetchImpl = fetch, opts) {
  const s = await httpStream(url, fetchImpl, opts)
  const chunks = []
  for await (const c of s) chunks.push(c)
  return Buffer.concat(chunks).toString('utf8')
}

/** Itera linhas de um stream (gz opcional). Erros de leitura/descompressão rejeitam a iteração. */
async function* linesOf(stream, gz) {
  const src = gz ? pipeline(stream, createGunzip(), () => {}) : stream
  const dec = new TextDecoder('utf-8')
  let tail = ''
  for await (const chunk of src) {
    tail += dec.decode(chunk, { stream: true })
    let i
    while ((i = tail.indexOf('\n')) >= 0) {
      yield tail.slice(0, i).replace(/\r$/, '')
      tail = tail.slice(i + 1)
    }
  }
  tail += dec.decode()
  if (tail) yield tail.replace(/\r$/, '')
}

/** Lê um CSV/TSV (opcionalmente .gz) em streaming e chama onRecord(code,row) para cada produto aceito. */
export async function readCsv(stream, source, onRecord, { gz = true, limit = Infinity } = {}) {
  let header = null
  let idx = {}
  let seen = 0
  let kept = 0
  for await (const line of linesOf(stream, gz)) {
    if (!header) {
      header = line.split('\t')
      idx = Object.fromEntries(header.map((h, i) => [h, i]))
      for (const need of ['code', 'product_name']) if (!(need in idx)) throw new Error(`coluna ausente no CSV: ${need}`)
      continue
    }
    seen++
    if (seen > limit) break
    const f = line.split('\t')
    const rec = toRecord(
      {
        code: f[idx.code],
        product_name: f[idx.product_name],
        generic_name: f[idx.generic_name],
        brands: f[idx.brands],
        categories_tags: f[idx.categories_tags],
        categories: f[idx.categories],
        quantity: f[idx.quantity],
        countries_tags: f[idx.countries_tags],
        last_modified_t: f[idx.last_modified_t],
      },
      source,
    )
    if (rec) {
      kept++
      onRecord(rec.code, rec.row)
    }
  }
  if (!header) throw new Error('arquivo vazio')
  return { seen, kept }
}

/** Lê arquivo delta (JSON por linha, .gz) da Open Food Facts. */
export async function readDelta(stream, source, onRecord) {
  let seen = 0
  let kept = 0
  for await (const line of linesOf(stream, true)) {
    if (!line.trim()) continue
    seen++
    let p
    try {
      p = JSON.parse(line)
    } catch {
      continue
    }
    const rec = toRecord(p, source)
    if (rec) {
      kept++
      onRecord(rec.code, rec.row)
    }
  }
  return { seen, kept }
}

/** Interpreta o index.txt dos deltas: nomes "<inicio>.<fim>.json.gz". Retorna os mais novos que `afterTs`. */
export function pickDeltas(indexText, afterTs, max = 14) {
  const files = indexText
    .split(/\s+/)
    .map((f) => f.trim())
    .filter((f) => /^\d+\.\d+\.json\.gz$/.test(f))
    .map((f) => ({ f, end: Number(f.split('.')[1]) }))
    .filter((x) => x.end > afterTs)
    .sort((a, b) => a.end - b.end)
  return files.slice(0, max)
}
