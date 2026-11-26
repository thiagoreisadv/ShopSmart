import { Suspense, lazy } from 'react'
import { Page } from '@/components/Page'
import { Icon, type IconName } from '@/components/Icon'
import { navigate, segments } from '@/router'
import { Skeleton } from '@/components/ui'

const Comparator = lazy(() => import('./more/Comparator'))
const Catalog = lazy(() => import('./more/Catalog'))
const PriceHistory = lazy(() => import('./more/PriceHistory'))
const Purchases = lazy(() => import('./more/Purchases'))
const UnitCalc = lazy(() => import('./more/UnitCalc'))
const FuelCalc = lazy(() => import('./more/FuelCalc'))
const Settings = lazy(() => import('./more/Settings'))
const Backup = lazy(() => import('./more/Backup'))

const ITEMS: { key: string; icon: IconName; label: string; desc: string }[] = [
  { key: 'comparador', icon: 'Layers', label: 'Comparador de supermercados', desc: 'Qual mercado compensa para a sua lista' },
  { key: 'catalogo', icon: 'Package', label: 'Catálogo de produtos', desc: 'Produtos reconhecidos neste aparelho' },
  { key: 'precos', icon: 'ChartLine', label: 'Histórico de preços', desc: 'Evolução por produto, mercado e data' },
  { key: 'compras', icon: 'Receipt', label: 'Histórico de compras', desc: 'Compras finalizadas e canceladas' },
  { key: 'unidade', icon: 'Scale', label: 'Calculadora de preço por unidade', desc: 'Compare embalagens por kg, litro ou unidade' },
  { key: 'combustivel', icon: 'Fuel', label: 'Calculadora de combustível', desc: 'Etanol × gasolina e custo do trajeto' },
  { key: 'config', icon: 'Settings', label: 'Configurações', desc: 'Tema, animações, privacidade e app' },
  { key: 'backup', icon: 'Database', label: 'Backup e restauração', desc: 'Exportar, importar e proteger seus dados' },
]

export default function More({ route }: { route: string }) {
  const sub = segments(route)[1]
  const fallback = (
    <div className="content stack"><Skeleton h={28} w="50%" /><Skeleton h={120} r={16} /><Skeleton h={80} r={16} /></div>
  )
  if (sub) {
    return (
      <Suspense fallback={fallback}>
        {sub === 'comparador' ? <Comparator /> : sub === 'catalogo' ? <Catalog /> : sub === 'precos' ? <PriceHistory /> : sub === 'compras' ? <Purchases /> : sub === 'unidade' ? <UnitCalc /> : sub === 'combustivel' ? <FuelCalc /> : sub === 'config' ? <Settings /> : sub === 'backup' ? <Backup /> : <Menu />}
      </Suspense>
    )
  }
  return <Menu />
}

function Menu() {
  return (
    <Page title="Mais" subtitle="Ferramentas e ajustes">
      <div className="card" style={{ padding: '4px 16px' }}>
        <div className="list">
          {ITEMS.map((i) => (
            <button key={i.key} className="list-item list-btn" onClick={() => navigate(`/mais/${i.key}`)}>
              <span className="avatar primary"><Icon name={i.icon} /></span>
              <span className="grow"><span className="bold" style={{ display: 'block' }}>{i.label}</span><span className="xs muted">{i.desc}</span></span>
              <Icon name="ChevronRight" size={18} />
            </button>
          ))}
        </div>
      </div>
      <p className="xs muted" style={{ textAlign: 'center' }}>ShopSmart 2.0 · Compre melhor. Economize mais.<br />Criado por Thiago de Souza Reis</p>
    </Page>
  )
}
