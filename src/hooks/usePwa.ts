import { useEffect, useState, useSyncExternalStore } from 'react'

let waiting: ServiceWorker | null = null
let installPrompt: (Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }) | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    installPrompt = e as typeof installPrompt
    emit()
  })
  window.addEventListener('appinstalled', () => {
    installPrompt = null
    emit()
  })
  const base = import.meta.env.BASE_URL
  navigator.serviceWorker
    .register(`${base}sw.js`, { scope: base })
    .then((reg) => {
      const track = (w: ServiceWorker | null) => {
        if (!w) return
        w.addEventListener('statechange', () => {
          // novo SW instalado enquanto há um ativo => há atualização esperando
          if (w.state === 'installed' && navigator.serviceWorker.controller) {
            waiting = w
            emit()
          }
        })
      }
      if (reg.waiting && navigator.serviceWorker.controller) {
        waiting = reg.waiting
        emit()
      }
      reg.addEventListener('updatefound', () => track(reg.installing))
      // verifica atualizações ao voltar para o app e a cada hora
      const check = () => reg.update().catch(() => {})
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
      setInterval(check, 3600_000)
    })
    .catch((e) => console.warn('[ShopSmart] SW não registrado', e))
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  })
}

export function applyUpdate(): void {
  // os dados ficam no IndexedDB e a sessão de compra é salva a cada alteração: recarregar é seguro
  waiting?.postMessage({ type: 'SKIP_WAITING' })
}

export function usePwa() {
  const snap = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => `${waiting ? 1 : 0}${installPrompt ? 1 : 0}`,
  )
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  const standalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true)
  const ios = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)
  return {
    updateReady: snap[0] === '1',
    canInstall: snap[1] === '1',
    install: async () => {
      if (!installPrompt) return
      await installPrompt.prompt()
      await installPrompt.userChoice
      installPrompt = null
      emit()
    },
    online,
    standalone,
    ios,
  }
}
