import { useSyncExternalStore } from 'react'

export type ToastTone = 'success' | 'error' | 'info' | 'warn'
export interface Toast {
  id: number
  message: string
  tone: ToastTone
  action?: { label: string; run: () => void }
}

let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function toast(message: string, tone: ToastTone = 'info', action?: Toast['action'], ms = action ? 6000 : 3200): number {
  const id = nextId++
  toasts = [...toasts.slice(-2), { id, message, tone, action }]
  emit()
  setTimeout(() => dismissToast(id), ms)
  return id
}
export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}
export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => toasts,
  )
}

/** Feedback tátil quando suportado (Android). iOS Safari não expõe vibração. */
let hapticsOn = true
export const setHapticsEnabled = (v: boolean) => (hapticsOn = v)
export function haptic(kind: 'tap' | 'success' | 'warn' | 'error' = 'tap'): void {
  if (!hapticsOn || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  try {
    navigator.vibrate(kind === 'tap' ? 8 : kind === 'success' ? [12, 40, 12] : kind === 'warn' ? [30, 40, 30] : [60, 30, 60])
  } catch {
    /* ignore */
  }
}
