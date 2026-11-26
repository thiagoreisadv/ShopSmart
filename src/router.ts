import { useSyncExternalStore } from 'react'

function current(): string {
  const h = window.location.hash.replace(/^#/, '')
  if (!h || h === '/') return '/'
  return (h.startsWith('/') ? h : '/' + h).replace(/\/+$/, '') || '/'
}
const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}
export function useRoute(): string {
  return useSyncExternalStore(subscribe, current, () => '/')
}
export function navigate(path: string, opts: { replace?: boolean } = {}): void {
  const target = '#' + path
  if (window.location.hash === target) return
  if (opts.replace) window.location.replace(target)
  else window.location.hash = target
}
export function back(fallback = '/'): void {
  if (window.history.length > 1) window.history.back()
  else navigate(fallback)
}
/** "/mais/comparador" → ["mais", "comparador"] */
export const segments = (p: string): string[] => p.split('/').filter(Boolean)

/** Rotas da v2.0 → rotas atuais (links, atalhos do PWA e favoritos antigos continuam funcionando). */
const LEGACY: Record<string, string> = {
  '/compra': '/comprar',
  '/financas': '/gastos',
  '/mais': '/',
  '/mais/comparador': '/listas/comparar',
  '/mais/catalogo': '/catalogo',
  '/mais/precos': '/catalogo',
  '/mais/compras': '/gastos/compras',
  '/mais/unidade': '/ferramentas/unidade',
  '/mais/combustivel': '/ferramentas/combustivel',
  '/mais/config': '/config',
  '/mais/backup': '/config',
}
export function canonicalRoute(path: string): string {
  return LEGACY[path] ?? path
}

/** Aba da navegação inferior à qual a rota pertence (ferramentas e catálogo ficam sob Início). */
export function tabOf(route: string): '/' | '/listas' | '/comprar' | '/gastos' {
  const s = segments(canonicalRoute(route))[0]
  return s === 'listas' ? '/listas' : s === 'comprar' ? '/comprar' : s === 'gastos' ? '/gastos' : '/'
}
