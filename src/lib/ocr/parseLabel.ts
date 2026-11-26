import { parseSize, type PriceUnit, type Size } from '../units'
import { KNOWN_BRANDS } from './brands'
import type { Cents } from '../money'

export type CandidateKind = 'price' | 'unit-price' | 'bundle' | 'old-price' | 'installment'

export interface PriceCandidate {
  cents: Cents
  kind: CandidateKind
  /** Unidade em que o preço é cobrado (un, kg, L), quando legível. */
  priceUnit?: PriceUnit
  /** Para "3 por R$ 10,00": leve `qty` e pague `totalCents`. */
  bundle?: { qty: number; totalCents: Cents }
  raw: string
  /** Quanto mais alto, mais provável de ser o preço efetivo. */
  score: number
  promo?: boolean
}

export interface ParsedLabel {
  name: string | null
  brand: string | null
  size: (Size & { text: string }) | null
  candidates: PriceCandidate[]
  /** Candidato sugerido; null quando não há certeza (usuário precisa escolher). */
  suggested: PriceCandidate | null
  promoText: string | null
  confidence: 'high' | 'medium' | 'low'
  warnings: string[]
}

const NOISE_WORDS =
  /^(r\$|rs|oferta|ofertas|promo[cç][aã]o|preco|preço|pre[cç]o|validade|val|fab|lote|peso|liq|líq|cada|leve|pague|economize|de|por|ate|até|unid|un|und|kg|ml|cod|código|codigo|sku|ref|total|desconto|so|só|apenas|somente|ean)$/i

/** Corrige confusões típicas do OCR dentro de números: "O"→0, "l"/"I"→1, "S"→5 quando vizinhos de dígitos. */
export function fixOcrDigits(text: string): string {
  return text
    .replace(/R[S5](?=\s?\d)/g, 'R$') // "RS 12,99" / "R5 12,99"
    .replace(/(?<=\d)[Oo](?=[\d,.])|(?<=[,.])[Oo](?=\d)/g, '0')
    .replace(/(?<=\d)[lI|](?=[\d,.])|(?<=[,.])[lI|](?=\d)/g, '1')
    .replace(/(?<=\d[,.]\d)S(?=\b|\d)/g, '5')
}

interface Mask {
  start: number
  end: number
}

function inMask(masks: Mask[], i: number, len: number): boolean {
  return masks.some((m) => i < m.end && i + len > m.start)
}

const MONEY_RE = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)\s?[,.]\s?(\d{2})(?!\d)/g
const INT_WITH_RS = /R\$\s*(\d{1,4})(?![\d,.]|\s?[,.]\d)/g

export function parseLabelText(rawText: string, opts: { ocrConfidence?: number } = {}): ParsedLabel {
  const warnings: string[] = []
  const text = fixOcrDigits(rawText.replace(/\r/g, ''))
  const masks: Mask[] = []
  const addMasks = (re: RegExp) => {
    for (const m of text.matchAll(re)) masks.push({ start: m.index!, end: m.index! + m[0].length })
  }
  // Códigos de barras (sequências longas, inclusive com espaços entre grupos de EAN)
  addMasks(/\b\d{8,14}\b/g)
  addMasks(/\b\d{1}\s\d{6}\s\d{6}\b/g)
  addMasks(/\b\d{3}\s\d{4}\s\d{3}\s\d{3}\s?\d?\b/g)
  // Datas
  addMasks(/\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g)
  addMasks(/\b\d{1,2}[/-]\d{4}\b/g)
  // Percentuais e pesos/volumes (não são preço)
  addMasks(/\d+(?:[.,]\d+)?\s?%/g)
  addMasks(/\b\d+(?:[.,]\d+)?\s?(?:kg|g|gr|mg|ml|l|lt|litros?)\b(?!\s?\))/gi)
  // Parcelamentos: "12x de R$ 10,00" — o valor é da parcela
  const installmentRanges: Mask[] = []
  for (const m of text.matchAll(/\b(\d{1,2})\s?x\s*(?:de\s*)?(?=R\$|\d)/gi)) {
    const afterIdx = m.index! + m[0].length
    const nxt = /(?:R\$\s*)?\d[\d.]*\s?[,.]\s?\d{2}/y
    nxt.lastIndex = afterIdx
    const mm = nxt.exec(text)
    if (mm) installmentRanges.push({ start: afterIdx, end: afterIdx + mm[0].length })
  }

  const candidates: PriceCandidate[] = []
  const seen = new Set<string>()
  const push = (c: PriceCandidate) => {
    const key = `${c.kind}:${c.cents}:${c.bundle?.qty ?? ''}`
    if (c.cents <= 0 || c.cents > 10_000_000 || seen.has(key)) return
    seen.add(key)
    candidates.push(c)
  }

  const toCents = (intp: string, dec: string) => Number(intp.replace(/\./g, '')) * 100 + Number(dec)

  // Pacotes: "3 unidades por R$ 10,00", "leve 3 por R$ 10", "3 por 10,00", "leve 3 pague 2" (sem valor → ignora)
  const bundleRe = /(?<![\d,.])(?:leve[ \t]+)?(\d{1,2})[ \t]*(?:unidades?|unids?|und|un|uni|itens?|pcs?|pe[cç]as?)?[ \t]+por[ \t]+(?:R\$[ \t]*)?(\d{1,3}(?:\.\d{3})*|\d+)(?:[,.](\d{2}))?(?!\d)/gi
  for (const m of text.matchAll(bundleRe)) {
    const qty = Number(m[1])
    if (qty < 2 || qty > 99) continue
    const total = toCents(m[2], m[3] ?? '00')
    push({
      cents: total,
      kind: 'bundle',
      priceUnit: 'un',
      bundle: { qty, totalCents: total },
      raw: m[0].trim(),
      score: 60,
      promo: true,
    })
    masks.push({ start: m.index!, end: m.index! + m[0].length })
  }

  const lineStartOf = (idx: number) => text.lastIndexOf('\n', idx - 1) + 1
  const classify = (idx: number, len: number, hasRs: boolean, cents: Cents): PriceCandidate => {
    const after = text.slice(idx + len, idx + len + 14).toLowerCase()
    const before = text.slice(Math.max(lineStartOf(idx), idx - 18), idx).toLowerCase()
    const raw = text.slice(idx, idx + len).trim()
    let kind: CandidateKind = 'price'
    let priceUnit: PriceUnit | undefined
    let score = 50
    let promo = false

    if (/^\s*(?:\/|por|p\/|a\s)?\s*\.?\s*(?:kg|quilo|kilo)\b/.test(after) || /^\s*\/\s*100\s?g/.test(after)) {
      kind = 'unit-price'
      priceUnit = 'kg'
    } else if (/^\s*(?:\/|por|p\/)?\s*\.?\s*(?:l|lt|litro|ltr)\b/.test(after)) {
      kind = 'unit-price'
      priceUnit = 'l'
    } else if (/^\s*(?:\/|por|p\/|cada)\s*\.?\s*(?:un|und|unid|unidade)\b/.test(after) || /^\s*(?:un|und|unid|cada)\b/.test(after)) {
      priceUnit = 'un'
      score += 5
    }
    if (/\b(?:kg|quilo)\s*[:=]?\s*(?:r\$)?\s*$/.test(before) && kind === 'price') {
      kind = 'unit-price'
      priceUnit = 'kg'
    }
    if (/\b(?:litro|l|lt)\s*[:=]?\s*(?:r\$)?\s*$/.test(before) && /pre[cç]o\s*(?:por\s*)?(?:litro|l)\s*[:=]?\s*(?:r\$)?\s*$/.test(before)) {
      kind = 'unit-price'
      priceUnit = 'l'
    }
    if (/\bde\s*(?:r\$)?\s*$/.test(before)) {
      kind = 'old-price'
      score -= 40
    }
    if (/\b(?:por|s[óo]|apenas|agora|oferta)\s*(?:r\$)?\s*$/.test(before)) {
      promo = true
      score += 12
    }
    if (installmentRanges.some((r) => idx >= r.start && idx < r.end)) {
      kind = 'installment'
      score -= 50
    }
    if (hasRs) score += 15
    if (kind === 'unit-price') score -= 20
    // preço maior costuma ser o destacado quando há "R$ grande" — leve preferência a preços na linha do "R$"
    if (/r\$\s*$/.test(before) || hasRs) score += 5
    return { cents, kind, priceUnit, raw, score, promo }
  }

  for (const m of text.matchAll(MONEY_RE)) {
    const idx = m.index!
    const len = m[0].length
    if (inMask(masks, idx, len)) continue
    const hasRs = /^R\$/.test(m[0])
    push(classify(idx, len, hasRs, toCents(m[1], m[2])))
  }
  for (const m of text.matchAll(INT_WITH_RS)) {
    const idx = m.index!
    if (inMask(masks, idx, m[0].length)) continue
    if (candidates.some((c) => c.raw.includes(m[0]))) continue
    const c = classify(idx, m[0].length, true, Number(m[1]) * 100)
    c.score -= 12 // inteiro sem centavos é menos certo
    push(c)
  }

  // Promoção textual (apenas indício)
  const promoMatch = text.match(/(leve\s+\d+\s+pague\s+\d+|oferta|promo[cç][aã]o|economize[^\n]*|\d+\s?%\s?(?:off|de desconto)|[aà] partir de \d+ un[^\n]*)/i)
  const promoText = promoMatch ? promoMatch[0].replace(/\s+/g, ' ').trim() : null
  if (promoText) for (const c of candidates) if (c.kind === 'price' && c.score >= 50) c.score += 3

  candidates.sort((a, b) => b.score - a.score || a.cents - b.cents)

  // Tamanho (peso/volume do produto)
  let size: ParsedLabel['size'] = null
  const sizeMatch = text.match(/\b\d+(?:[.,]\d+)?\s?(?:kg|g|gr|ml|l|lt|litros?)\b(?!\s?\/)/i)
  if (sizeMatch) {
    const s = parseSize(sizeMatch[0])
    if (s) size = { ...s, text: sizeMatch[0].replace(/\s+/g, ' ').trim() }
  }

  // Marca por dicionário
  let brand: string | null = null
  const lower = text.toLowerCase()
  for (const b of KNOWN_BRANDS) {
    if (lower.includes(b.toLowerCase())) {
      brand = b
      break
    }
  }

  // Nome: melhor linha "textual"
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const scored = lines
    .map((l) => {
      const cleaned = l
        .replace(MONEY_RE, ' ')
        .replace(/\b\d{8,14}\b/g, ' ')
        .replace(/\b\d+(?:[.,]\d+)?\s?(?:kg|g|gr|ml|l|lt)\b/gi, ' ')
        .replace(/R\$/g, ' ')
        .replace(/[^\p{L}\p{N}\s.\-/&']/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      const words = cleaned.split(' ').filter((w) => !NOISE_WORDS.test(w))
      const letters = (words.join(' ').match(/\p{L}/gu) ?? []).length
      const digits = (words.join(' ').match(/\d/g) ?? []).length
      return { text: words.join(' '), letters, digits }
    })
    .filter((l) => l.letters >= 4 && l.digits <= l.letters)
  scored.sort((a, b) => b.letters - a.letters)
  let name: string | null = scored[0]?.text ?? null
  if (name) {
    name = name.length > 80 ? name.slice(0, 80) : name
    // Capitaliza texto todo em caixa alta (rótulos) para ficar legível
    if (name === name.toUpperCase()) {
      name = name.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, s, c) => s + c.toUpperCase())
    }
  }

  // Sugestão e confiança — nunca autoaceitar valor incerto
  const priceLike = candidates.filter((c) => c.kind === 'price' || c.kind === 'bundle')
  let suggested: PriceCandidate | null = null
  let confidence: ParsedLabel['confidence'] = 'low'
  const ocrConf = opts.ocrConfidence ?? 70
  if (priceLike.length === 1) {
    suggested = priceLike[0]
    confidence = ocrConf >= 70 && suggested.score >= 60 ? 'high' : 'medium'
  } else if (priceLike.length > 1) {
    const [a, b] = priceLike
    if (a.score - b.score >= 15 && ocrConf >= 70) {
      suggested = a
      confidence = 'medium'
    } else {
      warnings.push('Vários valores encontrados: escolha o preço correto.')
      confidence = 'low'
    }
  } else if (candidates.some((c) => c.kind === 'unit-price')) {
    suggested = null
    warnings.push('Só encontrei preço por kg/L. Informe o peso ou o preço da embalagem.')
  } else {
    warnings.push('Nenhum preço identificado com segurança.')
  }
  if (ocrConf < 55) {
    warnings.push('Leitura com baixa confiança: confira os dados.')
    if (confidence === 'high') confidence = 'medium'
    if (confidence === 'medium' && ocrConf < 40) confidence = 'low'
  }
  if (confidence === 'low') suggested = suggested && priceLike.length === 1 ? suggested : null

  return { name, brand, size, candidates, suggested, promoText, confidence, warnings }
}
