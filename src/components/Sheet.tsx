import { type ReactNode, useEffect, useId, useRef } from 'react'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { Button } from './ui'

/** Trava a rolagem do corpo enquanto há camadas abertas e devolve o foco ao fechar. */
function useLayer(open: boolean, onClose: () => void) {
  const returnFocus = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!open) return
    returnFocus.current = document.activeElement as HTMLElement | null
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      returnFocus.current?.focus?.()
    }
  }, [open, onClose])
}

export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const tid = useId()
  const controls = useDragControls()
  useLayer(open, onClose)
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="scrim" className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={onClose} />
          <div key="layer" className="layer">
            <motion.div
              className="sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby={tid}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38, mass: 0.9 }}
              drag="y"
              dragListener={false}
              dragControls={controls}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => (info.offset.y > 110 || info.velocity.y > 600) && onClose()}
            >
              <div className="grab" onPointerDown={(e) => controls.start(e)} style={{ touchAction: 'none', padding: '8px 40% 10px', cursor: 'grab', background: 'none', height: 'auto' }}>
                <div style={{ height: 4, borderRadius: 4, background: 'var(--border-strong)' }} />
              </div>
              <div className="sheet-head" onPointerDown={(e) => controls.start(e)}>
                <h2 id={tid}>{title}</h2>
                <button className="icon-btn" onClick={onClose} aria-label="Fechar">
                  <Icon name="X" />
                </button>
              </div>
              <div className="sheet-body">{children}</div>
              {footer && <div className="sheet-foot">{footer}</div>}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  useLayer(open, onCancel)
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="s" className="scrim" style={{ zIndex: 70 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel} />
          <div key="l" className="layer center">
            <motion.div className="dialog" role="alertdialog" aria-modal="true" aria-label={title} initial={{ opacity: 0, scale: 0.94, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ type: 'spring', stiffness: 420, damping: 32 }}>
              <h2>{title}</h2>
              <div className="muted small" style={{ marginBottom: 16 }}>{message}</div>
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
                <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export interface ActionItem {
  label: string
  icon?: import('./Icon').IconName
  danger?: boolean
  detail?: string
  run: () => void
}

/** Menu contextual de ações secundárias, em bottom sheet (alcançável com o polegar). */
export function ActionSheet({ open, onClose, title, actions }: { open: boolean; onClose: () => void; title: string; actions: ActionItem[] }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="list" style={{ margin: '0 -4px' }}>
        {actions.map((a) => (
          <button
            key={a.label}
            className="list-item list-btn"
            style={a.danger ? { color: 'var(--danger)' } : undefined}
            onClick={() => {
              onClose()
              setTimeout(a.run, 60)
            }}
          >
            {a.icon && <Icon name={a.icon} size={20} />}
            <span className="grow">{a.label}{a.detail && <span className="xs muted" style={{ display: 'block' }}>{a.detail}</span>}</span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}
