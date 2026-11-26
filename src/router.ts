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
