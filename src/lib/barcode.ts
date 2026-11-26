/** Utilidades de código de barras (EAN/UPC/GTIN). */

export function onlyDigits(s: string): string {
  return s.replace(/\D/g, '')
}

/** Dígito verificador GTIN (mod 10) para o corpo sem o último dígito. */
function gtinCheckDigit(body: string): number {
  let sum = 0
  for (let i = 0; i < body.length; i++) {
    const d = body.charCodeAt(body.length - 1 - i) - 48
    sum += i % 2 === 0 ? d * 3 : d
  }
  return (10 - (sum % 10)) % 10
}

/** Expande UPC-E (8 dígitos) para UPC-A (12). */
export function upcEtoUpcA(upce: string): string | null {
  if (!/^\d{8}$/.test(upce)) return null
  const ns = upce[0]
  const d = upce.slice(1, 7)
  const check = upce[7]
  let body: string
  switch (d[5]) {
    case '0':
    case '1':
    case '2':
      body = d[0] + d[1] + d[5] + '0000' + d[2] + d[3] + d[4]
      break
    case '3':
      body = d[0] + d[1] + d[2] + '00000' + d[3] + d[4]
      break
    case '4':
      body = d[0] + d[1] + d[2] + d[3] + '00000' + d[4]
      break
    default:
      body = d[0] + d[1] + d[2] + d[3] + d[4] + '0000' + d[5]
  }
  const full = ns + body + check
  return full.length === 12 ? full : null
}

export function isValidGtin(code: string): boolean {
  if (!/^\d+$/.test(code)) return false
  if (![8, 12, 13, 14].includes(code.length)) return false
  return gtinCheckDigit(code.slice(0, -1)) === Number(code[code.length - 1])
}

/**
 * Normaliza para a forma canônica usada como chave: EAN-13 (UPC-A ganha zero à esquerda).
 * EAN-8 e GTIN-14 mantêm o tamanho. Retorna null se o código não for um GTIN válido.
 */
export function normalizeBarcode(raw: string): string | null {
  let c = onlyDigits(raw)
  if (c.length === 8) {
    // pode ser EAN-8 ou UPC-E: EAN-8 válido tem prioridade
    if (isValidGtin(c)) return c
    const a = upcEtoUpcA(c)
    if (a && isValidGtin(a)) return '0' + a
    return null
  }
  if (c.length === 12) c = '0' + c
  return isValidGtin(c) && (c.length === 13 || c.length === 14) ? c : null
}

/** Prefixos GS1 brasileiros: 789 e 790. */
export function isBrazilianGtin(code: string): boolean {
  return code.length === 13 && (code.startsWith('789') || code.startsWith('790'))
}

/** Sequência de dígitos longa demais para ser preço: provável código de barras. */
export function looksLikeBarcode(digits: string): boolean {
  return digits.length >= 8 && /^\d+$/.test(digits)
}

/** Chave de shard do catálogo estático (primeiros N dígitos do EAN-13 normalizado). */
export function shardKey(code: string, len = 5): string {
  return code.padStart(13, '0').slice(0, len)
}
