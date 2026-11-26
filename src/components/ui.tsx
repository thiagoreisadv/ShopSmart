import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, forwardRef, useEffect, useId, useState } from 'react'
import { motion } from 'motion/react'
import { Icon, type IconName } from './Icon'
import { centsFromDigits, formatDecimal, type Cents } from '@/lib/money'
import { haptic } from '@/store/ui'

type BtnVariant = 'default' | 'primary' | 'danger' | 'ghost' | 'outline'
export function Button({
  variant = 'default',
  size,
  block,
  icon,
  children,
  className = '',
  onClick,
  ...rest
}: { variant?: BtnVariant; size?: 'sm' | 'lg'; block?: boolean; icon?: IconName } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = ['btn', variant !== 'default' ? variant : '', size ?? '', block ? 'block' : '', className].filter(Boolean).join(' ')
  return (
    <button
      type="button"
      className={cls}
      onClick={(e) => {
        haptic('tap')
        onClick?.(e)
      }}
      {...rest}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  )
}

export function IconButton({ icon, label, size, className = '', ...rest }: { icon: IconName; label: string; size?: 'sm' } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`icon-btn ${size ?? ''} ${className}`} aria-label={label} title={label} {...rest}>
      <Icon name={icon} />
    </button>
  )
}

export function Field({ label, hint, error, children, htmlFor }: { label?: string; hint?: string; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {error ? <span className="error-text" role="alert">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  )
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string; error?: string }>(function TextInput(
  { label, hint, error, id, className = '', ...rest },
  ref,
) {
  const auto = useId()
  const iid = id ?? auto
  return (
    <Field label={label} hint={hint} error={error} htmlFor={iid}>
      <input ref={ref} id={iid} className={`input ${className}`} aria-invalid={error ? true : undefined} {...rest} />
    </Field>
  )
})

export function SelectInput({ label, id, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const auto = useId()
  const iid = id ?? auto
  return (
    <Field label={label} htmlFor={iid}>
      <select id={iid} className="select" {...rest}>
        {children}
      </select>
    </Field>
  )
}

export function TextArea({ label, id, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  const auto = useId()
  const iid = id ?? auto
  return (
    <Field label={label} htmlFor={iid}>
      <textarea id={iid} className="textarea" rows={3} {...rest} />
    </Field>
  )
}

/** Campo de moeda por dígitos: digitar 1299 mostra "12,99". Valor em centavos. */
export function MoneyInput({
  label,
  value,
  onChange,
  hint,
  error,
  autoFocus,
  placeholder = '0,00',
  id,
}: {
  label?: string
  value: Cents
  onChange: (c: Cents) => void
  hint?: string
  error?: string
  autoFocus?: boolean
  placeholder?: string
  id?: string
}) {
  const auto = useId()
  const iid = id ?? auto
  return (
    <Field label={label} hint={hint} error={error} htmlFor={iid}>
      <div className="input-affix">
        <span className="affix">R$</span>
        <input
          id={iid}
          className="input num"
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          value={value ? formatDecimal(value) : ''}
          onChange={(e) => onChange(centsFromDigits(e.target.value))}
          onFocus={(e) => e.target.select()}
        />
      </div>
    </Field>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label?: string }) {
  const gid = useId()
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => { haptic('tap'); onChange(o.value) }}>
          {value === o.value && (
            <motion.span layoutId={`seg-${gid}`} className="pill" style={{ inset: 0, margin: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
          )}
          <span style={{ position: 'relative', zIndex: 1 }}>{o.label}</span>
        </button>
      ))}
    </div>
  )
}

export function Chip({ active, children, onClick, icon }: { active?: boolean; children: ReactNode; onClick?: () => void; icon?: IconName }) {
  return (
    <button type="button" className={`chip ${active ? 'active' : ''}`} onClick={onClick} aria-pressed={active}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  )
}

export function Badge({ tone, children, icon }: { tone?: 'good' | 'warn' | 'danger' | 'info'; children: ReactNode; icon?: IconName }) {
  return (
    <span className={`badge ${tone ?? ''}`}>
      {icon && <Icon name={icon} />}
      {children}
    </span>
  )
}

export function Banner({ tone = 'info', icon, children }: { tone?: 'info' | 'warn' | 'danger' | 'good'; icon?: IconName; children: ReactNode }) {
  return (
    <div className={`banner ${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon name={icon ?? (tone === 'danger' || tone === 'warn' ? 'TriangleAlert' : tone === 'good' ? 'CircleCheck' : 'Info')} />
      <div>{children}</div>
    </div>
  )
}

export function Progress({ pct, tone }: { pct: number; tone?: 'warn' | 'danger' }) {
  const w = Math.max(0, Math.min(100, pct))
  return (
    <div className={`progress ${tone ?? ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(w)}>
      <motion.div initial={false} animate={{ width: `${w}%` }} transition={{ type: 'spring', stiffness: 160, damping: 26 }} />
    </div>
  )
}

export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="avatar primary">
        <Icon name={icon} />
      </div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}

export function Skeleton({ w = '100%', h = 16, r }: { w?: number | string; h?: number; r?: number }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r }} aria-hidden="true" />
}

export function Card({ children, className = '', tight, onClick }: { children: ReactNode; className?: string; tight?: boolean; onClick?: () => void }) {
  if (onClick) {
    return (
      <button type="button" className={`card interactive ${tight ? 'tight' : ''} ${className}`} onClick={() => { haptic('tap'); onClick() }}>
        {children}
      </button>
    )
  }
  return <div className={`card ${tight ? 'tight' : ''} ${className}`}>{children}</div>
}

/** Atraso para evitar "flash" de skeleton em carregamentos rápidos. */
export function useDelayed(ms = 120): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setOn(true), ms)
    return () => clearTimeout(t)
  }, [ms])
  return on
}
