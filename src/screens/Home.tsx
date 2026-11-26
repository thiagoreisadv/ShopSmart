import { useMemo } from 'react'
import { Page } from '@/components/Page'
import { Money } from '@/components/AnimatedNumber'
import { BarChart } from '@/components/Charts'
import { Button, Card, EmptyState, Progress, Badge, IconButton } from '@/components/ui'
import { Icon, type IconName } from '@/components/Icon'
import { useAppState, selectActivePurchase } from '@/store/store'
import { useFinance } from '@/hooks/useFinance'
import { navigate } from '@/router'
import { formatBRL, pct } from '@/lib/money'
import { formatDate, monthLong } from '@/lib/dates'
import { useTheme } from '@/hooks/useTheme'
import { cartTotals } from '@/domain/cart'

function Trend({ cur, prev }: { cur: number; prev: number }) {
  if (!prev) return <span className="xs" style={{ opacity: 0.8 }}>sem mês anterior para comparar</span>
  const p = ((cur - prev) / prev) * 100
  const up = p > 0
  return (
    <span className="xs" style={{ opacity: 0.9 }}>
      {up ? '▲' : '▼'} {Math.abs(Math.round(p))}% vs. mês anterior
    </span>
  )
}

export default function Home() {
  const f = useFinance()
  const { resolved, toggle } = useTheme()
  const active = useAppState(selectActivePurchase)
  const purchases = useAppState((s) => s.purchases)
  const lists = useAppState((s) => s.lists)
  const listData = useAppState((s) => s.listData)
  const now = new Date()
  const recent = useMemo(() => purchases.filter((p) => p.status === 'finalized').sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? '')).slice(0, 3), [purchases])
  const pending = lists
    .map((l) => ({ l, n: (listData[l.id]?.products ?? []).filter((p) => !p.inCart).length }))
    .filter((x) => x.n > 0)
  const budget = f.budgetCents
  const used = budget ? pct(f.period.month, budget) : 0
  const tone = used >= 100 ? 'danger' : used >= 80 ? 'warn' : undefined
  const activeTotal = active ? cartTotals(active.items, active.checkoutDiscountCents).totalCents : 0

  const shortcuts: { icon: IconName; label: string; to: string }[] = [
    { icon: 'ListChecks', label: 'Minhas listas', to: '/listas' },
    { icon: 'Layers', label: 'Comparar mercados', to: '/mais/comparador' },
    { icon: 'ChartLine', label: 'Histórico de preços', to: '/mais/precos' },
    { icon: 'Scale', label: 'Preço por unidade', to: '/mais/unidade' },
  ]

  return (
    <Page
      title="ShopSmart"
      subtitle="Compre melhor. Economize mais."
      actions={<IconButton icon={resolved === 'dark' ? 'Sun' : 'Moon'} label={resolved === 'dark' ? 'Modo claro' : 'Modo escuro'} onClick={toggle} />}
    >
      <section className="hero" aria-label="Resumo do mês">
        <div className="row between">
          <span className="label">Gasto em {monthLong(now)}</span>
          {budget > 0 && <Badge tone={tone === 'danger' ? 'danger' : tone === 'warn' ? 'warn' : 'good'}>{Math.round(used)}% do orçamento</Badge>}
        </div>
        <div className="big"><Money cents={f.period.month} /></div>
        <Trend cur={f.period.month} prev={f.period.prevMonth} />
        {budget > 0 ? (
          <div style={{ marginTop: 14 }}>
            <Progress pct={used} tone={tone} />
            <div className="row between xs" style={{ marginTop: 8, opacity: 0.9 }}>
              <span>Orçamento {formatBRL(budget)}</span>
              <span>{f.balanceCents! >= 0 ? 'Saldo ' : 'Excedido em '}<b className="num">{formatBRL(Math.abs(f.balanceCents!))}</b></span>
            </div>
          </div>
        ) : (
          <button className="btn sm" style={{ marginTop: 12, display: 'flex', width: 'fit-content' }} onClick={() => navigate('/financas')}>
            <Icon name="Target" /> Definir orçamento mensal
          </button>
        )}
      </section>

      <Button variant="primary" size="lg" block icon="ShoppingCart" onClick={() => navigate('/compra')}>
        {active ? `Continuar compra · ${formatBRL(activeTotal)}` : 'Iniciar compra'}
      </Button>

      <div className="grid-2">
        <Card tight>
          <div className="kpi"><span className="l">Compras no mês</span><span className="v num">{f.period.monthPurchases}</span></div>
        </Card>
        <Card tight>
          <div className="kpi"><span className="l">Ticket médio</span><span className="v num">{f.period.monthPurchases ? formatBRL(f.period.monthAvgTicket) : '—'}</span></div>
        </Card>
        <Card tight>
          <div className="kpi">
            <span className="l">Economia comprovada</span>
            <span className="v num">{formatBRL(f.savings.verifiedCents)}</span>
            <span className="xs muted">descontos e promoções registrados</span>
          </div>
        </Card>
        <Card tight>
          <div className="kpi">
            <span className="l">Mês anterior</span>
            <span className="v num">{f.period.prevMonth ? formatBRL(f.period.prevMonth) : '—'}</span>
          </div>
        </Card>
      </div>

      {f.alerts.length > 0 && (
        <div className="stack-s">
          {f.alerts.map((a) => (
            <div key={a.id} className={`banner ${a.tone === 'danger' ? 'danger' : a.tone === 'warn' ? 'warn' : 'info'}`}>
              <Icon name={a.tone === 'info' ? 'Info' : 'TriangleAlert'} />
              <div><b>{a.title}.</b> {a.detail}</div>
            </div>
          ))}
        </div>
      )}

      <div className="two-col">
        <div className="stack">
          <Card>
            <div className="row between" style={{ marginBottom: 8 }}>
              <h2 style={{ fontSize: 16 }}>Evolução dos gastos</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/financas')}>Ver finanças</Button>
            </div>
            {f.hasData ? (
              <BarChart data={f.series.map((p) => ({ key: p.key, label: p.label, cents: p.cents }))} ariaLabel="Gastos mensais dos últimos 6 meses" />
            ) : (
              <EmptyState icon="ChartColumn" title="Sem gastos registrados" text="Finalize uma compra para ver a evolução dos seus gastos mês a mês." />
            )}
          </Card>

          <Card>
            <h2 style={{ fontSize: 16, marginBottom: 4 }}>Compras recentes</h2>
            {recent.length === 0 ? (
              <EmptyState icon="Receipt" title="Nenhuma compra ainda" text="Suas compras finalizadas aparecem aqui." />
            ) : (
              <div className="list">
                {recent.map((p) => (
                  <button key={p.id} className="list-item list-btn" onClick={() => navigate('/mais/compras')}>
                    <span className="avatar"><Icon name="Store" /></span>
                    <span className="grow">
                      <span className="bold ellipsis" style={{ display: 'block' }}>{p.supermarketName}</span>
                      <span className="xs muted">{formatDate(p.finishedAt ?? p.startedAt)} · {p.items.length ? `${p.items.length} itens` : 'sem detalhamento'}</span>
                    </span>
                    <span className="bold num">{formatBRL(p.paidCents ?? 0)}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="stack">
          <Card>
            <h2 style={{ fontSize: 16, marginBottom: 4 }}>Listas pendentes</h2>
            {pending.length === 0 ? (
              <EmptyState icon="ListChecks" title="Nada pendente" text="Crie uma lista para planejar a próxima compra." action={<Button size="sm" onClick={() => navigate('/listas')}>Abrir listas</Button>} />
            ) : (
              <div className="list">
                {pending.map(({ l, n }) => (
                  <button key={l.id} className="list-item list-btn" onClick={() => { import('@/store/actions').then((m) => m.setActiveList(l.id)); navigate('/listas') }}>
                    <span className="avatar primary"><Icon name="ListChecks" /></span>
                    <span className="grow bold ellipsis">{l.name}</span>
                    <Badge>{n} {n === 1 ? 'item' : 'itens'}</Badge>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 style={{ fontSize: 16, marginBottom: 4 }}>Mais comprados</h2>
            {f.frequent.length === 0 ? (
              <p className="muted small" style={{ padding: '8px 0' }}>Os produtos que você mais compra aparecem aqui depois das primeiras compras detalhadas.</p>
            ) : (
              <div className="list">
                {f.frequent.map((p, i) => (
                  <div key={p.name + i} className="list-item" style={{ minHeight: 44 }}>
                    <span className="grow ellipsis">{p.name}</span>
                    <span className="xs muted">{p.count}× compras</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <h2 className="section-title">Atalhos</h2>
      <div className="grid-2">
        {shortcuts.map((s) => (
          <button key={s.to} className="shortcut" onClick={() => navigate(s.to)}>
            <span className="avatar primary"><Icon name={s.icon} /></span>
            <b>{s.label}</b>
          </button>
        ))}
      </div>
    </Page>
  )
}
