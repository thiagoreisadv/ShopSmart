import { useCallback, useEffect, useSyncExternalStore } from 'react'

/** Mesma chave da v1 (valores "light" | "dark"); ausência da chave = seguir o sistema. */
export const THEME_KEY = 'shopsmart_theme'
export type ThemeChoice = 'light' | 'dark' | 'system'

const listeners = new Set<() => void>()
function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === null) return 'system'
    const parsed = (() => {
      try {
        return JSON.parse(v)
      } catch {
        return v
      }
    })()
    return parsed === 'dark' ? 'dark' : parsed === 'light' ? 'light' : 'system'
  } catch {
    return 'system'
  }
}
export function resolveTheme(c: ThemeChoice): 'light' | 'dark' {
  if (c !== 'system') return c
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
export function applyTheme(c: ThemeChoice): void {
  const t = resolveTheme(c)
  document.documentElement.dataset.theme = t
  document.documentElement.classList.toggle('dark', t === 'dark') // compatível com a v1
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#0b1120' : '#059669')
}
export function setThemeChoice(c: ThemeChoice): void {
  try {
    if (c === 'system') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, JSON.stringify(c))
  } catch {
    /* ignore */
  }
  applyTheme(c)
  listeners.forEach((l) => l())
}

export function useTheme() {
  const choice = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => readChoice(),
    () => 'system' as ThemeChoice,
  )
  useEffect(() => {
    applyTheme(choice)
    if (choice !== 'system' || typeof matchMedia === 'undefined') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const on = () => applyTheme('system')
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [choice])
  const toggle = useCallback(() => setThemeChoice(resolveTheme(readChoice()) === 'dark' ? 'light' : 'dark'), [])
  return { choice, resolved: resolveTheme(choice), setChoice: setThemeChoice, toggle }
}
