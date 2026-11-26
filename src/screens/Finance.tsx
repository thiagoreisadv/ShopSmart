import { Suspense, lazy, useMemo, useState } from 'react'
import { useRoute } from '@/router'
import { Page } from '@/components/Page'
import { Badge, Banner, Button, Card, EmptyState, Field, IconButton, MoneyInput, Progress, Segmented, SelectInput, TextInput } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { Sheet } from '@/components/Sheet'
import { Money } from '@/components/AnimatedNumber'
import { BarChart, HBars } from '@/components/Charts'
import { useAppState } from '@/store/store'
import { updateSettings } from '@/store/actions'
import { CATEGORIES, UNDETAILED_CATEGORY } from '@/domain/categories'
import { dailySeries, financeAlerts, goalProgress, groupBy, monthSeries, periodTotals, savingsReport, spendRows, topProducts, totals, type Filters } from '@/domain/finance'
import { addMonths, addDays, startOfDay, startOfMonth, startOfWeek, startOfYear } from '@/lib/dates'
import { formatBRL, pct } from '@/lib/money'
import type { PaymentMethod } from '@/domain/types'

type Preset = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom'
const PRESETS: { value: Preset; label: string }[] = [
  { value: 'day', label: 'Dia' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
  { value: 'quarter', label: 'Trim.' },
  { value: 'year', label: 'Ano' },
]
const PAYMENTS: { value: PaymentMethod; label: string }[] = [
  { value: 'pix', label: 'Pix' }, { value: 'debito', label: 'Débito' }, { value: 'credito', label: 'Crédito' },
  { value: 'dinheiro', label: 'Dinheiro' }, { value: 'vale', label: 'Vale-alimentação' }, { value: 'outro', label: 'Outro' },
]

function range(p: Preset, now: Date, custom: { from: string; to: string }): { from?: Date; to?: Date; label: string } {
  switch (p) {
    case 'day': return { from: startOfDay(now), to: addDays(startOfDay(now), 1), label: 'Hoje' }
    case 'week': { const w = startOfWeek(now); return { from: w, to: addDays(w, 7), label: 'Esta semana' } }
    case 'month': { const m = startOfMonth(now); return { from: m, to: addMonths(m, 1), label: 'Este mês' } }
    case 'quarter': { const q = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); return { from: q, to: addMonths(q, 3), label: 'Este trimestre' } }
    case 'year': { const y = startOfYear(now); return { from: y, to: new Date(y.getFullYear() + 1, 0, 1), label: 'Este ano' } }
    case 'custom': {
      const f = custom.from ? new Date(custom.from + 'T00:00:00') : undefined
      const t = custom.to ? addDays(new Date(custom.to + 'T00:00:00'), 1) : undefined
      return { from: f, to: t, label: 'Período personalizado' }
    }
    default: return { label: 'Todo o período' }
  }
}

function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (!prev) return <span className="xs muted">sem base de comparação</span>
  const p = ((cur - prev) / prev) * 100
  return <span className={`trend ${p > 0 ? 'up' : 'down'}`}><Icon name={p > 0 ? 'ArrowUp' : 'ArrowDown'} />{Math.abs(Math.round(p))}%</span>
}

const PurchasesView = lazy(() => import('./more/Purchases'))

export default function Finance() {
  const route = useRoute()
  const [section, setSection] = useState<'resumo' | 'compras'>(route === '/gastos/compras' || route === '/mais/compras' ? 'compras' : 'resumo')
  const purchases = useAppState((s) => s.purchases)
  const prices = useAppState((s) => s.prices)
  const goals = useAppState((s) => s.settings.goals)
  const [preset, setPreset] = useState<Preset>('month')
  const [custom, setCustom] = useState({ from: '', to: '' })
  const [supermarket, setSupermarket] = useState('')
  const [category, setCategory] = useState('')
  const [product, setProduct] = useState('')
  const [payment, setPayment] = useState<PaymentMethod | ''>('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [goalsOpen, setGoalsOpen] = useState(false)
  const [trendMode, setTrendMode] = useState<'month' | 'day'>('month')
  const now = useMemo(() => new Date(), [])

  const all = useMemo(() => spendRows(purchases), [purchases])
  const hasData = all.length > 0
  const r = useMemo(() => range(preset, now, custom), [preset, now, custom])
  const rows = useMemo(() => {
    const f: Filters = { from: r.from, to: r.to, supermarket: supermarket || undefined, category: category || undefined, product: product.trim() || undefined, payment: payment || undefined }
    return spendRows(purchases, f)
  }, [purchases, r.from, r.to, supermarket, category, product, payment])
  const tot = totals(rows)
  const unfilteredRows = useMemo(() => spendRows(purchases, { supermarket: supermarket || undefined, category: category || undefined, product: product.trim() || undefined, payment: payment || undefined }), [purchases, supermarket, category, product, payment])
  const pt = periodTotals(all, now)
  const monthSeriesData = useMemo(() => monthSeries(unfilteredRows, now, 12), [unfilteredRows, now])
  const dailyData = useMemo(() => dailySeries(unfilteredRows, now, 30), [unfilteredRows, now])
  const byCat = groupBy(rows, 'category')
  const byMarket = groupBy(rows, 'supermarket')
  const topProd = topProducts(rows, 6)
  const sv = useMemo(() => savingsReport(purchases, prices, { from: r.from, to: r.to }), [purchases, prices, r.from, r.to])
  const alerts = useMemo(() => financeAlerts(all, purchases, prices, goals, now), [all, purchases, prices, goals, now])
  const marketNames = useMemo(() => [...new Set(purchases.filter((p) => p.status === 'finalized').map((p) => p.supermarketName))].sort(), [purchases])
  const activeFilters = [supermarket, category, product.trim(), payment].filter(Boolean).length

  const budget = goals.monthlyBudgetCents
  const used = pct(pt.month, budget)
  const months = useMemo(() => { const m = monthSeries(all, now, 2); return { cur: m[1], prev: m[0] } }, [all, now])
  const catCur = groupBy(spendRows(purchases, { from: startOfMonth(now), to: addMonths(startOfMonth(now), 1) }), 'category')
  const catPrev = groupBy(spendRows(purchases, { from: addMonths(startOfMonth(now), -1), to: startOfMonth(now) }), 'category')
  const catDiff = catCur.map((c) => ({ key: c.key, label: c.label, cur: c.cents, prev: catPrev.find((p) => p.key === c.key)?.cents ?? 0 })).sort((a, b) => Math.abs(b.cur - b.prev) - Math.abs(a.cur - a.prev)).slice(0, 4)
  const daysInPeriod = r.from && r.to ? Math.max(1, Math.round((r.to.getTime() - r.from.getTime()) / 86400000)) : 0

  return (
    <Page title="Gastos" subtitle="Supermercado e compras" actions={<><IconButton icon="Target" label="Metas e limites" onClick={() => setGoalsOpen(true)} /><IconButton icon="Layers" label="Filtros" onClick={() => setFiltersOpen(true)} style={activeFilters ? { color: 'var(--primary)' } : undefined} /></>}>
      <Segmented value={section} onChange={setSection} label="Seção" options={[{ value: 'resumo', label: 'Resumo' }, { value: 'compras', label: 'Compras' }]} />
      {section === 'compras' ? <Suspense fallback={null}><PurchasesView /></Suspense> : !hasData ? (
        <>
          <EmptyState icon="Wallet" title="Nenhuma compra finalizada" text="Quando você finalizar compras, aqui aparecem gastos por período, categoria e supermercado, evolução mensal e economia." />
          <Card>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>Comece definindo suas metas</h2>
            <p className="small muted" style={{ marginBottom: 12 }}>Um orçamento mensal permite acompanhar o saldo disponível e receber alertas.</p>
            <Button variant="primary" icon="Target" onClick={() => setGoalsOpen(true)}>Definir orçamento mensal</Button>
          </Card>
        </>
      ) : (
        <>
          <div className="row-s wrap">
            <div style={{ flex: 1, minWidth: 240 }}>
              <Segmented value={preset === 'all' || preset === 'custom' ? ('month' as Preset) : preset} options={PRESETS} onChange={setPreset} label="Período" />
            </div>
            <button className={`chip ${preset === 'all' || preset === 'custom' ? 'active' : ''}`} onClick={() => setFiltersOpen(true)}><Icon name="Clock" />{preset === 'all' ? 'Tudo' : preset === 'custom' ? 'Personalizado' : 'Outro período'}</button>
          </div>

          {activeFilters > 0 && (
            <div className="row-s wrap">
              {supermarket && <button className="chip active" onClick={() => setSupermarket('')}>{supermarket} <Icon name="X" /></button>}
              {category && <button className="chip active" onClick={() => setCategory('')}>{CATEGORIES.find((c) => c.id === category)?.label ?? category} <Icon name="X" /></button>}
              {product.trim() && <button className="chip active" onClick={() => setProduct('')}>“{product}” <Icon name="X" /></button>}
              {payment && <button className="chip active" onClick={() => setPayment('')}>{PAYMENTS.find((p) => p.value === payment)?.label} <Icon name="X" /></button>}
            </div>
          )}

          <section className="hero" aria-label="Total do período">
            <div className="label">{r.label}</div>
            <div className="big"><Money cents={tot.totalCents} /></div>
            <div className="row" style={{ gap: 20, marginTop: 10, flexWrap: 'wrap' }}>
              <div><div className="xs" style={{ opacity: 0.8 }}>Compras</div><b className="num">{tot.purchases}</b></div>
              <div><div className="xs" style={{ opacity: 0.8 }}>Ticket médio</div><b className="num">{tot.purchases ? formatBRL(tot.avgTicketCents) : '—'}</b></div>
              {daysInPeriod > 1 && <div><div className="xs" style={{ opacity: 0.8 }}>Média por dia</div><b className="num">{formatBRL(Math.round(tot.totalCents / daysInPeriod))}</b></div>}
            </div>
          </section>

          <div className="grid-2">
            <Card tight><div className="kpi"><span className="l">Hoje</span><span className="v num">{formatBRL(pt.day)}</span><Delta cur={pt.day} prev={pt.prevDay} /></div></Card>
            <Card tight><div className="kpi"><span className="l">Semana</span><span className="v num">{formatBRL(pt.week)}</span><Delta cur={pt.week} prev={pt.prevWeek} /></div></Card>
            <Card tight><div className="kpi"><span className="l">Mês</span><span className="v num">{formatBRL(pt.month)}</span><Delta cur={pt.month} prev={pt.prevMonth} /></div></Card>
            <Card tight><div className="kpi"><span className="l">Ano</span><span className="v num">{formatBRL(pt.year)}</span><Delta cur={pt.year} prev={pt.prevYear} /></div></Card>
          </div>

          {alerts.map((a) => <Banner key={a.id} tone={a.tone === 'danger' ? 'danger' : a.tone === 'warn' ? 'warn' : 'info'}><b>{a.title}.</b> {a.detail}</Banner>)}

          <div className="two-col">
            <div className="stack">
              <Card>
                <div className="row between" style={{ marginBottom: 8 }}>
                  <h2 style={{ fontSize: 16 }}>Evolução dos gastos</h2>
                  <div style={{ width: 150 }}><Segmented value={trendMode} onChange={setTrendMode} options={[{ value: 'month', label: '12 meses' }, { value: 'day', label: '30 dias' }]} label="Escala" /></div>
                </div>
                {trendMode === 'month'
                  ? <BarChart data={monthSeriesData.map((p) => ({ key: p.key, label: p.label, cents: p.cents }))} ariaLabel="Gastos por mês nos últimos 12 meses" />
                  : <BarChart data={dailyData.map((p) => ({ key: p.key, label: p.label, cents: p.cents }))} ariaLabel="Gastos por dia nos últimos 30 dias" />}
              </Card>

              <Card>
                <h2 style={{ fontSize: 16, marginBottom: 12 }}>Por categoria</h2>
                <HBars items={byCat} total={tot.totalCents} emptyText="Sem compras neste período." />
                {byCat.some((c) => c.key === UNDETAILED_CATEGORY.id) && <p className="xs muted" style={{ marginTop: 10 }}>“Não detalhado” = compras importadas da versão anterior, sem lista de produtos.</p>}
              </Card>

              <Card>
                <h2 style={{ fontSize: 16, marginBottom: 12 }}>Por supermercado</h2>
                <HBars items={byMarket} total={tot.totalCents} emptyText="Sem compras neste período." />
              </Card>
            </div>

            <div className="stack">
              {budget > 0 ? (
                <Card>
                  <div className="row between"><h2 style={{ fontSize: 16 }}>Orçamento do mês</h2><Badge tone={used >= 100 ? 'danger' : used >= 80 ? 'warn' : 'good'}>{Math.round(used)}%</Badge></div>
                  <div style={{ margin: '12px 0 8px' }}><Progress pct={used} tone={used >= 100 ? 'danger' : used >= 80 ? 'warn' : undefined} /></div>
                  <div className="row between small"><span className="muted">Gasto {formatBRL(pt.month)}</span><span className="muted">Meta {formatBRL(budget)}</span></div>
                  <div className="row between bold" style={{ marginTop: 6 }}><span>{budget - pt.month >= 0 ? 'Saldo disponível' : 'Excedido em'}</span><span className="num">{formatBRL(Math.abs(budget - pt.month))}</span></div>
                </Card>
              ) : (
                <Card><div className="row between"><div><b>Orçamento mensal</b><div className="xs muted">Defina para ver o saldo disponível</div></div><Button size="sm" onClick={() => setGoalsOpen(true)}>Definir</Button></div></Card>
              )}

              <Card>
                <h2 style={{ fontSize: 16, marginBottom: 4 }}>Economia</h2>
                <div className="stack-s">
                  <div className="row between"><span className="small"><b>Comprovada</b><br /><span className="xs muted">descontos e promoções registrados</span></span><b className="num" style={{ color: 'var(--primary)' }}>{formatBRL(sv.verifiedCents)}</b></div>
                  <div className="row between"><span className="small"><b>Estimada</b> <Badge tone="info">estimativa</Badge><br /><span className="xs muted">preço abaixo da média histórica do produto</span></span><b className="num">{formatBRL(sv.estimatedCents)}</b></div>
                  {goals.monthlySavingsGoalCents > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <div className="row between xs muted"><span>Meta de economia do mês</span><span>{formatBRL(goals.monthlySavingsGoalCents)}</span></div>
                      <Progress pct={goalProgress(savingsReport(purchases, prices, { from: startOfMonth(now), to: addMonths(startOfMonth(now), 1) }).verifiedCents, goals.monthlySavingsGoalCents)} />
                      <p className="xs muted" style={{ marginTop: 4 }}>Considera apenas a economia comprovada.</p>
                    </div>
                  )}
                </div>
              </Card>

              <Card>
                <h2 style={{ fontSize: 16, marginBottom: 8 }}>Mês atual × anterior</h2>
                <div className="row between small"><span className="muted">{months.prev.label}</span><b className="num">{formatBRL(months.prev.cents)}</b></div>
                <div className="row between small"><span className="muted">{months.cur.label}</span><b className="num">{formatBRL(months.cur.cents)}</b></div>
                <div className="row between small" style={{ marginBottom: 8 }}><span className="muted">Variação</span><Delta cur={months.cur.cents} prev={months.prev.cents} /></div>
                {catDiff.length > 0 && <hr className="divider" />}
                {catDiff.map((c) => (
                  <div key={c.key} className="row between small" style={{ padding: '4px 0' }}>
                    <span className="ellipsis">{c.label}</span>
                    <span className="num">{formatBRL(c.cur)} <span className="muted xs">vs {formatBRL(c.prev)}</span></span>
                  </div>
                ))}
              </Card>

              <Card>
                <h2 style={{ fontSize: 16, marginBottom: 12 }}>Produtos que mais pesam</h2>
                <HBars items={topProd} total={tot.totalCents} emptyText="Compras detalhadas por produto aparecerão aqui." />
              </Card>
            </div>
          </div>
        </>
      )}

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtros" footer={<><Button variant="ghost" onClick={() => { setSupermarket(''); setCategory(''); setProduct(''); setPayment(''); setPreset('month') }}>Limpar</Button><Button variant="primary" className="grow" onClick={() => setFiltersOpen(false)}>Aplicar</Button></>}>
        <div className="stack">
          <Field label="Período">
            <div className="row-s wrap">
              {([['day', 'Hoje'], ['week', 'Semana'], ['month', 'Mês'], ['quarter', 'Trimestre'], ['year', 'Ano'], ['all', 'Tudo'], ['custom', 'Personalizado']] as [Preset, string][]).map(([v, l]) => <button key={v} className={`chip ${preset === v ? 'active' : ''}`} onClick={() => setPreset(v)}>{l}</button>)}
            </div>
          </Field>
          {preset === 'custom' && (
            <div className="grid-2">
              <TextInput label="De" type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
              <TextInput label="Até" type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
            </div>
          )}
          <SelectInput label="Supermercado" value={supermarket} onChange={(e) => setSupermarket(e.target.value)}><option value="">Todos</option>{marketNames.map((m) => <option key={m}>{m}</option>)}</SelectInput>
          <SelectInput label="Categoria" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Todas</option>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</SelectInput>
          <TextInput label="Produto" value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Ex.: arroz" />
          <SelectInput label="Forma de pagamento" value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod | '')}><option value="">Todas</option>{PAYMENTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</SelectInput>
          <p className="xs muted">Filtros por categoria e produto consideram só compras detalhadas por item.</p>
        </div>
      </Sheet>

      <GoalsSheet open={goalsOpen} onClose={() => setGoalsOpen(false)} />
    </Page>
  )
}

function GoalsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const goals = useAppState((s) => s.settings.goals)
  const [b, setB] = useState(goals.monthlyBudgetCents)
  const [s, setS] = useState(goals.monthlySavingsGoalCents)
  const [l, setL] = useState(goals.perPurchaseLimitCents)
  const [seen, setSeen] = useState(false)
  if (open && !seen) { setSeen(true); setB(goals.monthlyBudgetCents); setS(goals.monthlySavingsGoalCents); setL(goals.perPurchaseLimitCents) }
  if (!open && seen) setSeen(false)
  return (
    <Sheet open={open} onClose={onClose} title="Metas e limites" footer={<Button variant="primary" block onClick={() => { updateSettings({ goals: { monthlyBudgetCents: b, monthlySavingsGoalCents: s, perPurchaseLimitCents: l } }); onClose() }}>Salvar</Button>}>
      <div className="stack">
        <MoneyInput label="Orçamento mensal de supermercado" value={b} onChange={setB} hint="Usado no saldo disponível e nos alertas de 80% e 100%." autoFocus />
        <MoneyInput label="Meta de economia mensal" value={s} onChange={setS} hint="Medida pela economia comprovada (descontos e promoções registrados)." />
        <MoneyInput label="Limite por compra" value={l} onChange={setL} hint="Sugestão de orçamento ao iniciar cada compra." />
      </div>
    </Sheet>
  )
}
