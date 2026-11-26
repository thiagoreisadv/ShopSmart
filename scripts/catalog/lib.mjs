// Funções puras do robô de catálogo (sem rede, sem disco) — testáveis.
// ATENÇÃO: normalizeBarcode/guessCategory/parseSize espelham src/lib/barcode.ts, src/domain/categories.ts e src/lib/units.ts
// (há teste de paridade em tests/unit/catalogLib.test.ts).
import { createHash } from 'node:crypto'

/* ---------- GTIN ---------- */
function checkDigit(body) {
  let sum = 0
  for (let i = 0; i < body.length; i++) {
    const d = body.charCodeAt(body.length - 1 - i) - 48
    sum += i % 2 === 0 ? d * 3 : d
  }
  return (10 - (sum % 10)) % 10
}
export function isValidGtin(code) {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return false
  return checkDigit(code.slice(0, -1)) === Number(code[code.length - 1])
}
export function normalizeBarcode(raw) {
  let c = String(raw ?? '').replace(/\D/g, '')
  if (c.length === 8) return isValidGtin(c) ? c : null // UPC-E não é importado em massa
  if (c.length === 12) c = '0' + c
  return isValidGtin(c) && (c.length === 13 || c.length === 14) ? c : null
}
export const shardKey = (code, len = 5) => code.padStart(13, '0').slice(0, len)

/* ---------- Texto ---------- */
export function normalizeName(s) {
  let t = String(s ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return ''
  const letters = t.replace(/[^\p{L}]/gu, '')
  if (letters.length >= 4 && letters === letters.toUpperCase()) {
    t = t.toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase())
  }
  return t.length > 100 ? t.slice(0, 100).trim() : t
}
export function firstBrand(s) {
  const b = String(s ?? '').split(',')[0].replace(/\s+/g, ' ').trim()
  return b.length > 60 ? b.slice(0, 60) : b
}

export function parseSize(text) {
  const m = String(text ?? '').toLowerCase().replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(kg|g|gr|mg|ml|cl|l|lt|litros?|un|und|unid|unidades?)\b/)
  if (!m) return null
  const n = parseFloat(m[1])
  const u = m[2]
  if (u === 'kg') return { milli: Math.round(n * 1000), unit: 'kg' }
  if (u === 'g' || u === 'gr') return { milli: Math.round(n), unit: 'kg' }
  if (u === 'mg') return { milli: Math.round(n / 1000), unit: 'kg' }
  if (u === 'ml') return { milli: Math.round(n), unit: 'l' }
  if (u === 'cl') return { milli: Math.round(n * 10), unit: 'l' }
  if (u === 'l' || u === 'lt' || u.startsWith('litro')) return { milli: Math.round(n * 1000), unit: 'l' }
  return { milli: Math.round(n) * 1000, unit: 'un' }
}

const RULES = [
  [/(fruit|fruta|vegetable|legum|verdura|hortifrut)/, 'hortifruti'],
  [/(meat|carne|beef|pork|chicken|frango|fish|peixe|sausage|lingui)/, 'acougue'],
  [/(bread|p[aã]o|bakery|padaria|bolo)/, 'padaria'],
  [/(dairy|milk|leite|cheese|queijo|yogurt|iogurte|butter|manteiga|frios|presunto)/, 'laticinios'],
  [/(beverage|bebida|drink|water|[aá]gua|juice|suco|soda|refrigerante|beer|cerveja|wine|vinho|coffee|caf[eé]|tea|ch[aá])/, 'bebidas'],
  [/(frozen|congelad|ice-cream|sorvete)/, 'congelados'],
  [/(clean|limpeza|detergent|detergente|sab[aã]o em p[oó]|amaciante|desinfetante)/, 'limpeza'],
  [/(beauty|cosmetic|hygiene|higiene|shampoo|soap|sabonete|toothpaste|creme dental|desodorante|perfume)/, 'higiene'],
  [/(baby|beb[eê]|fralda|diaper)/, 'bebes'],
  [/(pet|dog|cat|cachorro|gato|ra[cç][aã]o)/, 'pet'],
  [/(cereal|rice|arroz|bean|feij|pasta|macarr|flour|farinha|sugar|a[cç][uú]car|oil|[oó]leo|snack|biscoit|cookie|sauce|molho|canned|conserva|mercearia|grocer)/, 'mercearia'],
]
export function guessCategory(text) {
  const t = String(text ?? '').toLowerCase()
  for (const [re, id] of RULES) if (re.test(t)) return id
  return 'geral'
}

/* ---------- Registro ---------- */
// SRC: f = Open Food Facts, b = Open Beauty Facts, p = Open Products Facts
export const SOURCE_PRIORITY = { f: 3, b: 2, p: 1 }

/**
 * Converte um produto cru (CSV/JSON da base) em registro compacto, ou null se não servir.
 * Só entra produto do Brasil (tag de país ou prefixo GS1 789/790), com código válido e nome.
 */
export function toRecord(raw, source) {
  const code = normalizeBarcode(raw.code)
  if (!code) return null
  const countries = String(raw.countries_tags ?? raw.countries ?? '').toLowerCase()
  const isBr = /en:brazil|brasil|brazil/.test(countries) || (code.length === 13 && (code.startsWith('789') || code.startsWith('790')))
  if (!isBr) return null
  const name = normalizeName(raw.product_name_pt || raw.product_name || raw.generic_name)
  if (name.length < 2) return null
  const cats = Array.isArray(raw.categories_tags) ? raw.categories_tags.join(' ') : String(raw.categories_tags ?? raw.categories ?? '')
  const size = parseSize(raw.quantity)
  const ts = Number(raw.last_modified_t) || 0
  const updated = ts ? new Date(ts * 1000).toISOString().slice(0, 10).replace(/-/g, '') : ''
  return {
    code,
    row: [name, firstBrand(raw.brands), guessCategory(`${cats} ${name}`), size?.milli ?? 0, size?.unit ?? '', source, updated],
  }
}

/** Junta dois registros do mesmo código: o mais recente vence; lacunas são preenchidas pelo outro. */
export function mergeRows(a, b) {
  if (!a) return b
  if (!b) return a
  const [, , , , , src, upd] = a
  const [, , , , , src2, upd2] = b
  const aNewer = upd > upd2 || (upd === upd2 && (SOURCE_PRIORITY[src] ?? 0) >= (SOURCE_PRIORITY[src2] ?? 0))
  const win = aNewer ? a : b
  const lose = aNewer ? b : a
  return [win[0] || lose[0], win[1] || lose[1], win[2] !== 'geral' ? win[2] : lose[2] || win[2], win[3] ? win[3] : lose[3], win[3] ? win[4] : lose[4], win[5], win[6] || lose[6]]
}

/* ---------- Shards ---------- */
export const MAX_SHARD_BYTES = 250_000

export function serializeShard(prefix, items) {
  const sorted = {}
  for (const k of Object.keys(items).sort()) sorted[k] = items[k]
  return JSON.stringify({ v: 1, p: prefix, items: sorted })
}

/** Distribui os registros em shards por prefixo; divide (5→6→7 dígitos) os que passarem do limite de tamanho. */
export function buildShards(records /* Map<code,row> */, maxBytes = MAX_SHARD_BYTES) {
  const out = new Map() // prefix -> text
  const place = (prefix, entries, len) => {
    const items = Object.fromEntries(entries)
    const text = serializeShard(prefix, items)
    if (Buffer.byteLength(text) <= maxBytes || len >= 7 || entries.length < 2) {
      out.set(prefix, text)
      return
    }
    const groups = new Map()
    for (const [code, row] of entries) {
      const k = shardKey(code, len + 1)
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k).push([code, row])
    }
    for (const [k, es] of groups) place(k, es, len + 1)
  }
  const groups = new Map()
  for (const [code, row] of records) {
    const k = shardKey(code, 5)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push([code, row])
  }
  for (const [k, es] of groups) place(k, es, 5)
  return out
}

export const sha256 = (text) => createHash('sha256').update(text).digest('hex')

export function buildManifest(shards, { version, generatedAt, sources }) {
  const meta = {}
  let total = 0
  for (const [prefix, text] of [...shards].sort((a, b) => a[0].localeCompare(b[0]))) {
    const n = Object.keys(JSON.parse(text).items).length
    total += n
    meta[prefix] = { n, bytes: Buffer.byteLength(text), sha256: sha256(text) }
  }
  return { schema: 1, version, generatedAt, total, shards: meta, sources }
}

export const SOURCES = [
  { id: 'off', name: 'Open Food Facts', license: 'ODbL 1.0', url: 'https://world.openfoodfacts.org' },
  { id: 'obf', name: 'Open Beauty Facts', license: 'ODbL 1.0', url: 'https://world.openbeautyfacts.org' },
  { id: 'opf', name: 'Open Products Facts', license: 'ODbL 1.0', url: 'https://world.openproductsfacts.org' },
]

/** Valida o catálogo gerado antes de publicar. Retorna lista de problemas (vazia = ok). */
export function validateCatalog(manifest, readShard, previousTotal = 0, opts = {}) {
  const problems = []
  const minRatio = opts.minRatio ?? 0.8
  if (!manifest || manifest.schema !== 1) problems.push('manifesto inválido')
  if (manifest.total <= 0) problems.push('catálogo vazio')
  if (previousTotal > 0 && manifest.total < previousTotal * minRatio) problems.push(`queda suspeita: ${previousTotal} → ${manifest.total} produtos`)
  let count = 0
  for (const [prefix, meta] of Object.entries(manifest.shards)) {
    const text = readShard(prefix)
    if (text === null || text === undefined) {
      problems.push(`shard ausente: ${prefix}`)
      continue
    }
    if (sha256(text) !== meta.sha256) problems.push(`hash divergente: ${prefix}`)
    let json
    try {
      json = JSON.parse(text)
    } catch {
      problems.push(`JSON inválido: ${prefix}`)
      continue
    }
    for (const [code, row] of Object.entries(json.items)) {
      count++
      if (!isValidGtin(code)) problems.push(`código inválido: ${code}`)
      if (!Array.isArray(row) || row.length !== 7 || !row[0]) problems.push(`registro inválido: ${code}`)
      if (!code.startsWith(prefix)) problems.push(`código fora do shard: ${code}`)
    }
    if (Buffer.byteLength(text) > (opts.maxBytes ?? MAX_SHARD_BYTES) * 1.5) problems.push(`shard muito grande: ${prefix}`)
  }
  if (count !== manifest.total) problems.push(`contagem divergente: ${count} vs ${manifest.total}`)
  return problems.slice(0, 50)
}
