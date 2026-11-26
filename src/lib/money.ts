/** Todo valor monetário do app é um inteiro em centavos. */
export type Cents = number

/** Converte texto digitado ("12,99", "1.299,90", "R$ 5", "12.5") em centavos. Retorna null se inválido. */
export function parseMoney(input: string | number | null | undefined): Cents | null {
  if (input === null || input === undefined) return null
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null
    return Math.round(input * 100 + (input < 0 ? -1e-7 : 1e-7))
  }
  let s = input.replace(/R\$|\s/g, '')
  if (!s || !/^-?[\d.,]+$/.test(s)) return null
  const neg = s.startsWith('-')
  if (neg) s = s.slice(1)
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  let intPart: string
  let decPart = ''
  if (lastComma >= 0 && lastDot >= 0) {
    // o separador que aparece por último é o decimal
    const sep = Math.max(lastComma, lastDot)
    intPart = s.slice(0, sep).replace(/[.,]/g, '')
    decPart = s.slice(sep + 1)
  } else if (lastComma >= 0 || lastDot >= 0) {
    const ch = lastComma >= 0 ? ',' : '.'
    const sep = s.lastIndexOf(ch)
    const after = s.slice(sep + 1)
    const repeated = s.split(ch).length - 1 > 1
    const thousands = repeated || (ch === '.' && after.length === 3 && sep > 0)
    if (thousands) {
      intPart = s.replace(/[.,]/g, '')
    } else {
      intPart = s.slice(0, sep)
      decPart = after
    }
  } else {
    intPart = s
  }
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(decPart) || (!intPart && !decPart)) return null
  const whole = Number(intPart || '0') * 100
  let frac = 0
  if (decPart) {
    frac = Number(decPart.slice(0, 2).padEnd(2, '0'))
    if (decPart.length > 2 && Number(decPart[2]) >= 5) frac += 1
  }
  const cents = whole + frac
  if (!Number.isSafeInteger(cents)) return null
  return neg ? -cents : cents
}

/** Máscara de entrada de moeda por dígitos: "1299" → 1299 centavos. */
export function centsFromDigits(raw: string): Cents {
  const d = raw.replace(/\D/g, '').slice(0, 9)
  return d ? parseInt(d, 10) : 0
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export function formatBRL(cents: Cents): string {
  return brl.format((cents || 0) / 100)
}
/** Sem o símbolo, para campos de edição: 1299 → "12,99" */
export function formatDecimal(cents: Cents): string {
  return ((cents || 0) / 100).toFixed(2).replace('.', ',')
}

export function formatPercent(v: number, digits = 0): string {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`
}

/** Divisão inteira arredondada (half away from zero) — evita ponto flutuante em multiplicações. */
export function mulDiv(a: number, b: number, d: number): number {
  const n = a * b
  const q = Math.abs(n) / d
  const r = Math.floor(q + 0.5 + 1e-9)
  return n < 0 ? -r : r
}

/** Porcentagem inteira de `part` sobre `whole` (não limitada). */
export function pct(part: Cents, whole: Cents): number {
  if (!whole) return 0
  return (part / whole) * 100
}

export function sum(values: Cents[]): Cents {
  let t = 0
  for (const v of values) t += v
  return t
}
