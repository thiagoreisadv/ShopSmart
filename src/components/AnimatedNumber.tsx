import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'motion/react'
import { formatBRL, type Cents } from '@/lib/money'

/** Valor financeiro com contagem animada. Respeita prefers-reduced-motion. */
export function Money({ cents, className, format = formatBRL }: { cents: Cents; className?: string; format?: (c: Cents) => string }) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(cents)
  const from = useRef(cents)
  useEffect(() => {
    if (reduce || from.current === cents) {
      from.current = cents
      setShown(cents)
      return
    }
    const controls = animate(from.current, cents, {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setShown(Math.round(v)),
      onComplete: () => {
        from.current = cents
        setShown(cents)
      },
    })
    from.current = cents
    return () => controls.stop()
  }, [cents, reduce])
  return (
    <span className={`num ${className ?? ''}`} aria-label={format(cents)}>
      {format(shown)}
    </span>
  )
}
