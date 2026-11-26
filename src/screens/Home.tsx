import { Page } from '@/components/Page'
import { Money } from '@/components/AnimatedNumber'
import { Button, Progress } from '@/components/ui'
import { Icon, type IconName } from '@/components/Icon'
import { useAppState, selectActivePurchase } from '@/store/store'
import { setActiveList } from '@/store/actions'
import { useFinance } from '@/hooks/useFinance'
import { navigate } from '@/router'
import { formatBRL, pct } from '@/lib/money'
import { monthLong } from '@/lib/dates'
import { cartTotals } from '@/domain/cart'

const TOOLS: { icon: IconName; label: string; to: string }[] = [
  { icon: 'Scale', label: 'Preço por unidade', to: '/ferramentas/unidade' },
  { icon: 'Fuel', label: 'Combustível', to: '/ferramentas/combustivel' },
  { icon: 'Package', label: 'Produtos', to: '/catalogo' },
]

export default function Home() {
  const f = useFinance()
  const active = useAppState(selectActivePurchase)
  const lists = useAppState((s) => s.lists)
  const listData = useAppState((s) => s.listData)
  const activeId = useAppState((s) => s.activeListId)
  const now = new Date()
  const budget = f.budgetCents
  const used = budget ? pct(f.period.month, budget) : 0
  const tone = used >= 100 ? 'danger' : used >= 80 ? 'warn' : undefined
  const activeTotal = active ? cartTotals(active.items, active.checkoutDiscountCents).totalCents : 0
  const recent = [...lists].sort((a, b) => (a.id === activeId ? -1 : b.id === activeId ? 1 : b.createdAt - a.createdAt)).slice(0, 3)

  return (
    <Page title="ShopSmart" subtitle="Compre melhor. Economize mais.">
      <Button variant="primary" size="lg" block icon="ShoppingCart" onClick={() => navigate('/comprar')}>
        {active ? `Continuar compra · ${formatBRL(activeTotal)}` : 'Iniciar compra'}
      </Button>

      <section className="plain" aria-label="Resumo do mês">
        <div className="row between">
          <span className="muted small">Gasto em {monthLong(now)}</span>
          <button className="small link" onClick={() => navigate('/gastos')}>Ver gastos</button>
        </div>
        <div className="figure"><Money cents={f.period.month} /></div>
        {budget > 0 ? (
          <>
            <Progress pct={used} tone={tone} />
            <div className="row between small muted" style={{ marginTop: 8 }}>
              <span>Orçamento {formatBRL(budget)}</span>
              <span>{f.balanceCents! >= 0 ? 'Saldo ' : 'Excedido '}<b className="num" style={{ color: 'var(--text)' }}>{formatBRL(Math.abs(f.balanceCents!))}</b></span>
            </div>
          </>
        ) : (
          <button className="small link" onClick={() => navigate('/gastos')}>Definir orçamento mensal</button>
        )}
      </section>

      <section aria-label="Listas recentes">
        <div className="row between"><h2 className="section-title">Listas</h2><button className="small link" onClick={() => navigate('/listas')}>Ver todas</button></div>
        <div className="list">
          {recent.map((l) => {
            const items = listData[l.id]?.products ?? []
            const pending = items.filter((p) => !p.inCart).length
            return (
              <button key={l.id} className="list-item list-btn" onClick={() => { setActiveList(l.id); navigate('/listas') }}>
                <Icon name="ListChecks" size={20} />
                <span className="grow ellipsis bold">{l.name}</span>
                <span className="small muted">{items.length ? `${pending} pendente${pending === 1 ? '' : 's'}` : 'vazia'}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section aria-label="Ferramentas rápidas">
        <h2 className="section-title">Ferramentas</h2>
        <div className="tools">
          {TOOLS.map((t) => (
            <button key={t.to} className="tool" onClick={() => navigate(t.to)}>
              <Icon name={t.icon} size={22} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </section>
    </Page>
  )
}
