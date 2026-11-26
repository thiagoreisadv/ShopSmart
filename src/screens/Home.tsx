import { Page } from '@/components/Page'
import { Money } from '@/components/AnimatedNumber'
import { Progress } from '@/components/ui'
import { Icon, type IconName } from '@/components/Icon'
import { useAppState, selectActivePurchase } from '@/store/store'
import { setActiveList } from '@/store/actions'
import { useFinance } from '@/hooks/useFinance'
import { navigate } from '@/router'
import { formatBRL, pct } from '@/lib/money'
const monthName = (d: Date) => d.toLocaleDateString('pt-BR', { month: 'long' })
import { cartTotals } from '@/domain/cart'

const TOOLS: { icon: IconName; label: string; to: string }[] = [
  { icon: 'Layers', label: 'Comparar preços', to: '/listas/comparar' },
  { icon: 'Scale', label: 'Preço por unidade', to: '/ferramentas/unidade' },
  { icon: 'Fuel', label: 'Combustível', to: '/ferramentas/combustivel' },
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
      <section className="hero" aria-label="Resumo do mês">
        <div className="row between">
          <span className="label">Gastos em {monthName(now)}</span>
          <button className="link-on-dark" onClick={() => navigate('/gastos')}>Ver gastos</button>
        </div>
        <div className="figure"><Money cents={f.period.month} /></div>
        {budget > 0 ? (
          <>
            <Progress pct={used} tone={tone} />
            <div className="row between small" style={{ marginTop: 8, opacity: 0.92 }}>
              <span>Limite: {formatBRL(budget)}</span>
              <span>{f.balanceCents! >= 0 ? 'Restam: ' : 'Excedido: '}<b className="num">{formatBRL(Math.abs(f.balanceCents!))}</b></span>
            </div>
          </>
        ) : (
          <button className="link-on-dark" style={{ alignSelf: 'flex-start' }} onClick={() => navigate('/gastos')}>Definir orçamento mensal</button>
        )}
      </section>

      <button className="cta-row" onClick={() => navigate('/comprar')} aria-label={active ? `Continuar compra · ${formatBRL(activeTotal)}` : 'Iniciar compra'}>
        <Icon name="ScanBarcode" size={30} />
        <span className="grow">
          <b>{active ? `Continuar compra · ${formatBRL(activeTotal)}` : 'Iniciar compra'}</b>
          <span>{active ? `${active.supermarketName} · compra em andamento` : 'Controle seus gastos em tempo real'}</span>
        </span>
        <Icon name="ChevronRight" size={20} />
      </button>

      <section aria-label="Listas recentes">
        <div className="row between"><h2 className="section-title">Minhas listas</h2><button className="small link" onClick={() => navigate('/listas')}>Ver todas</button></div>
        <div className="stack-s">
          {recent.map((l) => {
            const items = listData[l.id]?.products ?? []
            const done = items.filter((p) => p.inCart).length
            return (
              <button key={l.id} className="list-card" onClick={() => { setActiveList(l.id); navigate('/listas') }}>
                <span className="tile"><Icon name="ShoppingCart" size={22} /></span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <b className="ellipsis" style={{ display: 'block' }}>{l.name}</b>
                  <span className="small muted">{items.length ? `${items.length} produtos · ${done} adquiridos` : 'Lista vazia'}</span>
                  {items.length > 0 && <Progress pct={(done / items.length) * 100} />}
                </span>
                <Icon name="ChevronRight" size={18} />
              </button>
            )
          })}
        </div>
      </section>

      <section aria-label="Ferramentas rápidas">
        <h2 className="section-title">Ferramentas rápidas</h2>
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
