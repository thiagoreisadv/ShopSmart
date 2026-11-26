import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/app.css'
import App from './App'
import { boot } from './store/actions'
import { useAppState, flush } from './store/store'
import { applyTheme } from './hooks/useTheme'
import { registerServiceWorker } from './hooks/usePwa'
import { Icon } from './components/Icon'

// Tema aplicado antes da primeira renderização (evita "flash" claro no modo escuro)
try {
  const v = localStorage.getItem('shopsmart_theme')
  applyTheme(v === '"dark"' || v === 'dark' ? 'dark' : v === '"light"' || v === 'light' ? 'light' : 'system')
} catch {
  applyTheme('system')
}

function Root() {
  const ready = useAppState((s) => s.ready)
  if (!ready) {
    return (
      <div className="splash" role="status" aria-label="Carregando ShopSmart">
        <div className="logo">
          <Icon name="ShoppingBasket" size={32} />
        </div>
      </div>
    )
  }
  return <App />
}

void boot()
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
// garante que gravações pendentes terminem antes de a página ser descartada
window.addEventListener('pagehide', () => void flush())
registerServiceWorker()
