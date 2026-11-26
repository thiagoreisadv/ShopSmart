import { AnimatePresence, motion } from 'motion/react'
import { dismissToast, useToasts } from '@/store/ui'
import { Icon } from './Icon'

export function Toasts() {
  const toasts = useToasts()
  return (
    <div className="toasts" aria-live="polite" role="status">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className={`toast ${t.tone}`}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 460, damping: 34 }}
          >
            <Icon name={t.tone === 'error' ? 'CircleAlert' : t.tone === 'success' ? 'CircleCheck' : t.tone === 'warn' ? 'TriangleAlert' : 'Info'} size={18} />
            <span className="grow">{t.message}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action!.run()
                  dismissToast(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
