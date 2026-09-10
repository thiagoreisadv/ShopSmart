const MONEY_REGEX = /\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2}/g;

function parseMoney(str) {
  let s = str.trim();
  if (/,\d{2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

// Extrai, por melhor esforço, o valor total de uma nota fiscal a partir do
// texto lido por OCR. Prioriza linhas com "TOTAL" (comum em cupons fiscais
// brasileiros); na falta disso, assume o maior valor monetário do texto.
export function extractTotalFromText(text) {
  if (!text) return null;
  const lines = text.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.includes('TOTAL') && !upper.includes('QTD')) {
      const matches = line.match(MONEY_REGEX);
      if (matches && matches.length > 0) {
        const value = parseMoney(matches[matches.length - 1]);
        if (value !== null && value > 0) return value;
      }
    }
  }

  const allMatches = text.match(MONEY_REGEX);
  if (allMatches && allMatches.length > 0) {
    const values = allMatches.map(parseMoney).filter(v => v !== null && v > 0);
    if (values.length > 0) return Math.max(...values);
  }

  return null;
}
