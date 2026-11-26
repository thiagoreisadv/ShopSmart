import { Suspense, lazy, useEffect, useRef } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useRoute, navigate, segments, canonicalRoute, tabOf } from './router'
import { useAppState, selectActivePurchase } from './store/store'
import { Icon, type IconName } from './components/Icon'
import { Toasts } from './components/Toasts'
import { Skeleton } from './components/ui'
import { useTheme } from './hooks/useTheme'
import { usePwa, applyUpdate } from './hooks/usePwa'
import { Banner } from './components/ui'

const Home = lazy(() => import('./screens/Home'))
const Lists = lazy(() => import('./screens/Lists'))
const Shop = lazy(() => import('./screens/Shop'))
const Finance = lazy(() => import('./screens/Finance'))
const Catalog = lazy(() => import('./screens/more/Catalog'))
const UnitCalc = lazy(() => import('./screens/more/UnitCalc'))
const FuelCalc = lazy(() => import('./screens/more/FuelCalc'))
const Settings = lazy(() => import('./screens/more/Settings'))

const TABS: { path: string; label: string; icon: IconName; cta?: boolean }[] = [
  { path: '/', label: 'Início', icon: 'House' },
  { path: '/listas', label: 'Listas', icon: 'ListChecks' },
  { path: '/comprar', label: 'Comprar', icon: 'ScanBarcode', cta: true },
  { path: '/gastos', label: 'Gastos', icon: 'Wallet' },
]

function PageSkeleton() {
  return (
    <div className="content stack" aria-busy="true" aria-label="Carregando">
      <Skeleton h={28} w="50%" />
      <Skeleton h={120} r={16} />
      <Skeleton h={72} r={16} />
      <Skeleton h={72} r={16} />
    </div>
  )
}

function Screen({ route }: { route: string }) {
  const r = segments(route)
  switch (r[0]) {
    case 'listas': return <Lists />
    case 'comprar': return <Shop />
    case 'gastos': return <Finance />
    case 'config': return <Settings />
    case 'catalogo': return <Catalog />
    case 'ferramentas': return r[1] === 'combustivel' ? <FuelCalc /> : <UnitCalc />
    default: return <Home />
  }
}

export default function App() {
  const rawRoute = useRoute()
  const route = canonicalRoute(rawRoute)
  const tab = tabOf(route)
  const screenKey = segments(route).slice(0, 2).join('/') || 'home'
  const { toggle, resolved } = useTheme()
  const active = useAppState(selectActivePurchase)
  const storageError = useAppState((s) => s.storageError)
  const motionPref = useAppState((s) => s.settings.reducedMotion)
  const pwa = usePwa()
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    document.documentElement.dataset.motion = motionPref === 'on' ? 'off' : 'on'
  }, [motionPref])
  useEffect(() => {
    if (rawRoute !== route) navigate(route, { replace: true }) // links antigos (v2.0) → novas rotas
  }, [rawRoute, route])
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [route])

  const NavButtons = ({ side }: { side?: boolean }) => (
    <>
      {TABS.map((t) =>
        side ? (
          <button key={t.path} className={`side-item ${t.cta ? 'cta' : ''}`} aria-current={tab === t.path ? 'page' : undefined} onClick={() => navigate(t.path)}>
            <Icon name={t.icon} />
            {t.label}
            {t.cta && active && <span className="badge warn" style={{ marginLeft: 'auto' }}>em andamento</span>}
          </button>
        ) : (
          <li key={t.path}>
            <button className={`nav-item ${t.cta ? 'cta' : ''}`} aria-current={tab === t.path ? 'page' : undefined} onClick={() => navigate(t.path)}>
              {t.cta ? (
                <>
                  <span className="nav-cta-btn">
                    <Icon name={t.icon} size={24} />
                  </span>
                  <span className="label">{t.label}</span>
                </>
              ) : (
                <>
                  <Icon name={t.icon} />
                  <span>{t.label}</span>
                </>
              )}
              {t.cta && active && <span className="nav-dot" aria-label="Compra em andamento" />}
            </button>
          </li>
        ),
      )}
    </>
  )

  return (
    <MotionConfig reducedMotion={motionPref === 'on' ? 'always' : motionPref === 'off' ? 'never' : 'user'}>
      <div className="app">
        {pwa.updateReady && (
          <div className="update-banner" role="status">
            <Icon name="RefreshCw" size={18} />
            <span className="grow small">Nova versão do ShopSmart disponível.</span>
            <button className="btn sm primary" onClick={applyUpdate}>Atualizar</button>
          </div>
        )}
        <div className="shell">
          <aside className="sidebar" aria-label="Navegação principal">
            <div className="brand">
              <span className="brand-mark"><Icon name="ShoppingBasket" /></span>
              ShopSmart
            </div>
            <NavButtons side />
            <div className="side-sep" />
            <button className="side-item" onClick={toggle}>
              <Icon name={resolved === 'dark' ? 'Sun' : 'Moon'} />
              {resolved === 'dark' ? 'Modo claro' : 'Modo escuro'}
            </button>
            <p className="xs muted" style={{ marginTop: 'auto', padding: '0 10px' }}>Compre melhor. Economize mais.</p>
          </aside>
          <main className="main" ref={mainRef} id="main">
            {!pwa.online && (
              <div className="content" style={{ paddingBottom: 0 }}>
                <Banner tone="warn" icon="WifiOff">Sem conexão. Listas, carrinho, histórico e calculadoras continuam funcionando; consultas de novos produtos precisam de internet.</Banner>
              </div>
            )}
            {storageError && (
              <div className="content" style={{ paddingBottom: 0 }}>
                <Banner tone="danger">{storageError}</Banner>
              </div>
            )}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={screenKey}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
                style={{ flex: 1 }}
              >
                <Suspense fallback={<PageSkeleton />}>
                  <Screen route={route} />
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
        <nav className="bottom-nav" aria-label="Navegação principal">
          <ul>
            <NavButtons />
          </ul>
        </nav>
        <Toasts />
      </div>
    </MotionConfig>
  )
}
