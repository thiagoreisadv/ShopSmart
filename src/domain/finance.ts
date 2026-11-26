import type { CartItem, Goals, PaymentMethod, PriceRecord, Purchase } from './types'
import { lineGross, lineTotal } from './cart'
import { UNDETAILED_CATEGORY, categoryById } from './categories'
import type { Cents } from '@/lib/money'
import { addDays, addMonths, dayKey, monthKey, monthLabel, startOfDay, startOfMonth, startOfWeek, startOfYear } from '@/lib/dates'
import { normalizeText } from '@/lib/id'
import { priceStats } from './prices'

export interface Filters {
  from?: Date
  /** exclusivo */
  to?: Date
  supermarket?: string
  category?: string
  product?: string
  payment?: PaymentMethod
}

export interface SpendRow {
  purchaseId: string
  date: Date
  iso: string
  supermarket: string
  category: string
  product: string
  productId?: string
  cents: Cents
  payment?: PaymentMethod
}

const finalizedDate = (p: Purchase) => new Date(p.finishedAt ?? p.startedAt)

/** Gastos linha a linha de compras finalizadas (as canceladas e em andamento nunca contam). */
export function spendRows(purchases: Purchase[], f: Filters = {}): SpendRow[] {
  const rows: SpendRow[] = []
  const itemFilter = !!(f.category || f.product)
  const prodQ = f.product ? normalizeText(f.product) : ''
  for (const p of purchases) {
    if (p.status !== 'finalized') continue
    const date = finalizedDate(p)
    if (f.from && date < f.from) continue
    if (f.to && date >= f.to) continue
    if (f.supermarket && p.supermarketName !== f.supermarket) continue
    if (f.payment && p.paymentMethod !== f.payment) continue
    const iso = date.toISOString()
    const base = { purchaseId: p.id, date, iso, supermarket: p.supermarketName, payment: p.paymentMethod }
    if (!p.items.length) {
      // compra importada sem itens: só entra quando não há filtro por item
      if (!itemFilter) rows.push({ ...base, category: UNDETAILED_CATEGORY.id, product: '(sem detalhamento)', cents: p.paidCents ?? 0 })
      continue
    }
    // distribui o desconto de caixa e a diferença para o valor pago proporcionalmente às linhas
    const totals = p.items.map((it) => lineTotal(it))
    const sub = totals.reduce((a, b) => a + b, 0)
    const paid = p.paidCents ?? Math.max(0, sub - p.checkoutDiscountCents)
    let acc = 0
    p.items.forEach((it, i) => {
      const share = i === p.items.length - 1 ? paid - acc : sub > 0 ? Math.round((totals[i] / sub) * paid) : 0
      acc += share
      if (f.category && it.category !== f.category) return
      if (prodQ && !normalizeText(it.name).includes(prodQ)) return
      rows.push({ ...base, category: it.category, product: it.name, productId: it.productId, cents: share })
    })
  }
  return rows
}

export interface Totals {
  totalCents: Cents
  purchases: number
  avgTicketCents: Cents
}
export function totals(rows: SpendRow[]): Totals {
  const ids = new Set<string>()
  let t = 0
  for (const r of rows) {
    t += r.cents
    ids.add(r.purchaseId)
  }
  return { totalCents: t, purchases: ids.size, avgTicketCents: ids.size ? Math.round(t / ids.size) : 0 }
}

export interface Group {
  key: string
  label: string
  cents: Cents
  count: number
}
export function groupBy(rows: SpendRow[], key: 'category' | 'supermarket' | 'product'): Group[] {
  const m = new Map<string, Group>()
  for (const r of rows) {
    const k = key === 'category' ? r.category : key === 'supermarket' ? r.supermarket : normalizeText(r.product)
    const label = key === 'category' ? categoryById(r.category).label : key === 'supermarket' ? r.supermarket : r.product
    const g = m.get(k) ?? { key: k, label, cents: 0, count: 0 }
    g.cents += r.cents
    g.count += 1
    m.set(k, g)
  }
  return [...m.values()].sort((a, b) => b.cents - a.cents)
}

export interface SeriesPoint {
  key: string
  label: string
  cents: Cents
  purchases: number
}
/** Série mensal dos últimos `n` meses terminando em `endMonth` (incluindo meses sem gasto). */
export function monthSeries(rows: SpendRow[], now: Date, n = 12): SeriesPoint[] {
  const pts: SeriesPoint[] = []
  const idx = new Map<string, SeriesPoint>()
  for (let i = n - 1; i >= 0; i--) {
    const k = monthKey(addMonths(startOfMonth(now), -i))
    const p = { key: k, label: monthLabel(k), cents: 0, purchases: 0 }
    pts.push(p)
    idx.set(k, p)
  }
  const seen = new Set<string>()
  for (const r of rows) {
    const p = idx.get(monthKey(r.date))
    if (!p) continue
    p.cents += r.cents
    if (!seen.has(r.purchaseId)) {
      seen.add(r.purchaseId)
      p.purchases += 1
    }
  }
  return pts
}

export function dailySeries(rows: SpendRow[], now: Date, days = 30): SeriesPoint[] {
  const pts: SeriesPoint[] = []
  const idx = new Map<string, SeriesPoint>()
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(startOfDay(now), -i)
    const k = dayKey(d)
    const p = { key: k, label: `${d.getDate()}/${d.getMonth() + 1}`, cents: 0, purchases: 0 }
    pts.push(p)
    idx.set(k, p)
  }
  for (const r of rows) {
    const p = idx.get(dayKey(r.date))
    if (p) p.cents += r.cents
  }
  return pts
}

export interface PeriodTotals {
  day: Cents
  week: Cents
  month: Cents
  year: Cents
  prevDay: Cents
  prevWeek: Cents
  prevMonth: Cents
  prevYear: Cents
  monthPurchases: number
  monthAvgTicket: Cents
}
export function periodTotals(rows: SpendRow[], now: Date): PeriodTotals {
  const sum = (a: Date, b: Date) => rows.filter((r) => r.date >= a && r.date < b).reduce((s, r) => s + r.cents, 0)
  const d0 = startOfDay(now)
  const w0 = startOfWeek(now)
  const m0 = startOfMonth(now)
  const y0 = startOfYear(now)
  const next = (d: Date) => addDays(d, 1)
  const monthRows = rows.filter((r) => r.date >= m0 && r.date < addMonths(m0, 1))
  const mt = totals(monthRows)
  return {
    day: sum(d0, next(d0)),
    week: sum(w0, addDays(w0, 7)),
    month: mt.totalCents,
    year: sum(y0, new Date(y0.getFullYear() + 1, 0, 1)),
    prevDay: sum(addDays(d0, -1), d0),
    prevWeek: sum(addDays(w0, -7), w0),
    prevMonth: sum(addMonths(m0, -1), m0),
    prevYear: sum(new Date(y0.getFullYear() - 1, 0, 1), y0),
    monthPurchases: mt.purchases,
    monthAvgTicket: mt.avgTicketCents,
  }
}

export function topProducts(rows: SpendRow[], n = 5): Group[] {
  return groupBy(rows.filter((r) => r.category !== UNDETAILED_CATEGORY.id), 'product').slice(0, n)
}

/** Produtos comprados com mais frequência (nº de compras em que aparecem). */
export function frequentProducts(purchases: Purchase[], n = 5): { name: string; count: number }[] {
  const m = new Map<string, { name: string; count: number }>()
  for (const p of purchases) {
    if (p.status !== 'finalized') continue
    const seen = new Set<string>()
    for (const it of p.items) {
      const k = it.productId ?? normalizeText(it.name)
      if (seen.has(k)) continue
      seen.add(k)
      const e = m.get(k) ?? { name: it.name, count: 0 }
      e.count++
      m.set(k, e)
    }
  }
  return [...m.values()].sort((a, b) => b.count - a.count).slice(0, n)
}

/* ---------- Economia ---------- */
export interface Savings {
  /** descontos e promoções registrados nas compras finalizadas: valor que realmente deixou de ser pago */
  verifiedCents: Cents
  verifiedItems: number
  /** estimativa baseada em comparação com a média histórica de preços do mesmo produto — NÃO é garantia */
  estimatedCents: Cents
  estimatedItems: number
}

function bundleSaving(it: CartItem): Cents {
  if (!it.bundle) return 0
  const without = lineGross({ ...it, bundle: undefined })
  return Math.max(0, without - lineGross(it))
}

export function savingsReport(purchases: Purchase[], prices: PriceRecord[], range?: { from?: Date; to?: Date }): Savings {
  let verified = 0
  let vItems = 0
  let est = 0
  let eItems = 0
  const paidByProduct = new Map<string, PriceRecord[]>()
  for (const r of prices) {
    if (r.kind !== 'paid') continue
    const arr = paidByProduct.get(r.productId) ?? []
    arr.push(r)
    paidByProduct.set(r.productId, arr)
  }
  for (const p of purchases) {
    if (p.status !== 'finalized') continue
    const d = finalizedDate(p)
    if (range?.from && d < range.from) continue
    if (range?.to && d >= range.to) continue
    verified += p.checkoutDiscountCents
    for (const it of p.items) {
      const v = (it.discountCents || 0) + bundleSaving(it)
      if (v > 0) {
        verified += v
        vItems++
      }
      if (it.productId && it.discountCents === 0 && !it.bundle) {
        // compara com a média dos registros ANTERIORES a esta compra (mesma unidade)
        const prev = (paidByProduct.get(it.productId) ?? []).filter((r) => r.priceUnit === it.priceUnit && r.purchaseId !== p.id && r.date < (p.finishedAt ?? p.startedAt))
        if (prev.length >= 2) {
          const avg = priceStats(prev).avgCents
          if (it.unitPriceCents < avg) {
            est += Math.round(((avg - it.unitPriceCents) * it.qtyMilli) / 1000)
            eItems++
          }
        }
      }
    }
  }
  return { verifiedCents: verified, verifiedItems: vItems, estimatedCents: est, estimatedItems: eItems }
}

/* ---------- Alertas ---------- */
export interface FinanceAlert {
  id: string
  tone: 'warn' | 'danger' | 'info'
  title: string
  detail: string
}

export function financeAlerts(rows: SpendRow[], purchases: Purchase[], prices: PriceRecord[], goals: Goals, now: Date): FinanceAlert[] {
  const out: FinanceAlert[] = []
  const pt = periodTotals(rows, now)
  const budget = goals.monthlyBudgetCents
  if (budget > 0) {
    const used = (pt.month / budget) * 100
    if (used >= 100) out.push({ id: 'budget-over', tone: 'danger', title: 'Orçamento do mês excedido', detail: `Você já usou ${Math.round(used)}% do orçamento mensal.` })
    else if (used >= 80) out.push({ id: 'budget-near', tone: 'warn', title: 'Orçamento do mês quase no limite', detail: `${Math.round(used)}% do orçamento mensal já foi utilizado.` })
  }
  // crescimento: o mês corrente, no mesmo ponto do mês anterior
  const dom = now.getDate()
  const m0 = startOfMonth(now)
  const prevStart = addMonths(m0, -1)
  const prevSame = rows.filter((r) => r.date >= prevStart && r.date < addDays(prevStart, dom)).reduce((s, r) => s + r.cents, 0)
  if (prevSame > 0 && pt.month > prevSame * 1.2 && pt.month - prevSame >= 2000) {
    const pct = Math.round(((pt.month - prevSame) / prevSame) * 100)
    out.push({ id: 'growth', tone: 'warn', title: 'Gastos crescendo', detail: `${pct}% a mais que o mesmo período do mês passado.` })
  }
  // variação relevante de preços (produtos pagos ≥ 15% acima da média anterior)
  const recent = new Map<string, PriceRecord>()
  const byProduct = new Map<string, PriceRecord[]>()
  for (const r of prices.filter((p) => p.kind === 'paid')) {
    const a = byProduct.get(r.productId) ?? []
    a.push(r)
    byProduct.set(r.productId, a)
  }
  for (const [pid, arr] of byProduct) {
    const sorted = [...arr].sort((a, b) => b.date.localeCompare(a.date))
    if (sorted.length >= 3) recent.set(pid, sorted[0])
  }
  let flagged = 0
  for (const [pid, last] of recent) {
    const prev = (byProduct.get(pid) ?? []).filter((r) => r.id !== last.id && r.priceUnit === last.priceUnit)
    if (prev.length >= 2 && last.unitPriceCents > priceStats(prev).avgCents * 1.15) flagged++
  }
  if (flagged) out.push({ id: 'price-var', tone: 'info', title: 'Variação de preços', detail: `${flagged} produto(s) foram comprados mais de 15% acima da média histórica.` })
  void purchases
  return out
}

export function goalProgress(savedCents: Cents, goalCents: Cents): number {
  return goalCents > 0 ? Math.min(100, (savedCents / goalCents) * 100) : 0
}
