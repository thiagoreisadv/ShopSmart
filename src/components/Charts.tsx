import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { formatBRL, type Cents } from '@/lib/money'

function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null)
  const [w, setW] = useState(320)
  useLayoutEffect(() => {
    if (!ref.current) return
    setW(Math.max(200, ref.current.clientWidth || 320))
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => ref.current && setW(Math.max(200, ref.current.clientWidth || 320)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

const compact = (c: Cents) => {
  const v = c / 100
  if (v >= 1000) return `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

function niceMax(max: number): number {
  if (max <= 0) return 100
  const pow = Math.pow(10, Math.floor(Math.log10(max)))
  const n = max / pow
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return nice * pow
}

export interface BarPoint {
  key: string
  label: string
  cents: Cents
}

/** Gráfico de barras interativo (toque/hover/teclado mostram o valor). */
export function BarChart({ data, height = 180, highlightLast = true, ariaLabel }: { data: BarPoint[]; height?: number; highlightLast?: boolean; ariaLabel: string }) {
  const [ref, width] = useWidth()
  const [active, setActive] = useState<number | null>(null)
  const padL = 34
  const padB = 22
  const padT = 8
  const innerW = width - padL - 4
  const innerH = height - padB - padT
  const max = niceMax(Math.max(...data.map((d) => d.cents), 0))
  const bw = Math.max(6, Math.min(36, (innerW / data.length) * 0.62))
  const step = innerW / data.length
  const skip = Math.ceil(data.length / Math.max(1, Math.floor(innerW / 38)))
  const ticks = [0, 0.5, 1]
  const a = active !== null ? data[active] : null
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg className="chart" width={width} height={height} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={padL} x2={width - 4} y1={padT + innerH * (1 - t)} y2={padT + innerH * (1 - t)} />
            <text x={padL - 6} y={padT + innerH * (1 - t) + 4} textAnchor="end">{compact(max * t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = (d.cents / max) * innerH
          const x = padL + step * i + (step - bw) / 2
          const isCur = highlightLast && i === data.length - 1
          return (
            <g key={d.key}>
              <motion.rect
                className={`bar ${isCur ? 'cur' : ''} ${active !== null && active !== i ? 'dim' : ''}`}
                x={x}
                width={bw}
                rx={4}
                initial={{ y: padT + innerH, height: 0 }}
                animate={{ y: padT + innerH - h, height: Math.max(h, d.cents > 0 ? 2 : 0) }}
                transition={{ type: 'spring', stiffness: 220, damping: 28, delay: Math.min(i * 0.02, 0.3) }}
              />
              <rect
                x={padL + step * i}
                y={padT}
                width={step}
                height={innerH + padB}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${d.label}: ${formatBRL(d.cents)}`}
                onPointerEnter={() => setActive(i)}
                onPointerDown={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onPointerLeave={() => setActive(null)}
                style={{ outline: 'none' }}
              />
              {i % skip === 0 && (
                <text x={x + bw / 2} y={height - 6} textAnchor="middle">{d.label}</text>
              )}
            </g>
          )
        })}
      </svg>
      {a && active !== null && (
        <div className="tooltip" style={{ position: 'absolute', top: 0, left: Math.min(Math.max(padL + step * active + step / 2 - 50, 0), width - 110), pointerEvents: 'none' }}>
          <b>{a.label}</b> · {formatBRL(a.cents)}
        </div>
      )}
    </div>
  )
}

export interface LinePoint {
  key: string
  label: string
  value: Cents
  note?: string
}

/** Linha de evolução (histórico de preços). */
export function LineChart({ data, height = 170, ariaLabel }: { data: LinePoint[]; height?: number; ariaLabel: string }) {
  const [ref, width] = useWidth()
  const [active, setActive] = useState<number | null>(null)
  const padL = 40
  const padR = 10
  const padT = 12
  const padB = 22
  const innerW = width - padL - padR
  const innerH = height - padT - padB
  const vals = data.map((d) => d.value)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = Math.max(max - min, Math.max(max, 1) * 0.1)
  const lo = Math.max(0, min - span * 0.2)
  const hi = max + span * 0.2
  const x = (i: number) => padL + (data.length === 1 ? innerW / 2 : (innerW * i) / (data.length - 1))
  const y = (v: number) => padT + innerH * (1 - (v - lo) / (hi - lo || 1))
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ')
  const area = data.length > 1 ? `${path} L${x(data.length - 1)},${padT + innerH} L${x(0)},${padT + innerH} Z` : ''
  const pathRef = useRef<SVGPathElement | null>(null)
  useEffect(() => {
    const p = pathRef.current
    if (!p || typeof p.getTotalLength !== 'function') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const len = p.getTotalLength()
    p.style.strokeDasharray = `${len}`
    p.style.strokeDashoffset = `${len}`
    p.getBoundingClientRect()
    p.style.transition = 'stroke-dashoffset 0.7s cubic-bezier(0.22,1,0.36,1)'
    p.style.strokeDashoffset = '0'
  }, [path])
  const a = active !== null ? data[active] : null
  const skip = Math.ceil(data.length / Math.max(1, Math.floor(innerW / 54)))
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg className="chart" width={width} height={height} role="img" aria-label={ariaLabel}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line className="grid" x1={padL} x2={width - padR} y1={padT + innerH * (1 - t)} y2={padT + innerH * (1 - t)} />
            <text x={padL - 6} y={padT + innerH * (1 - t) + 4} textAnchor="end">{((lo + (hi - lo) * t) / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</text>
          </g>
        ))}
        {area && <path className="area" d={area} />}
        <path ref={pathRef} className="line" d={path} />
        {data.map((d, i) => (
          <g key={d.key}>
            <circle className="dot" cx={x(i)} cy={y(d.value)} r={active === i ? 6 : 4} />
            <circle cx={x(i)} cy={y(d.value)} r={18} fill="transparent" tabIndex={0} role="button" aria-label={`${d.label}: ${formatBRL(d.value)}`} onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} onPointerLeave={() => setActive(null)} style={{ outline: 'none' }} />
            {i % skip === 0 && <text x={x(i)} y={height - 6} textAnchor="middle">{d.label}</text>}
          </g>
        ))}
      </svg>
      {a && active !== null && (
        <div className="tooltip" style={{ position: 'absolute', top: 0, left: Math.min(Math.max(x(active) - 60, 0), width - 150), pointerEvents: 'none' }}>
          <b>{formatBRL(a.value)}</b> · {a.label}
          {a.note ? ` · ${a.note}` : ''}
        </div>
      )}
    </div>
  )
}

export function HBars({ items, total, emptyText }: { items: { key: string; label: string; cents: Cents }[]; total?: Cents; emptyText?: string }) {
  const sum = total ?? items.reduce((s, i) => s + i.cents, 0)
  if (!items.length) return <p className="muted small">{emptyText ?? 'Sem dados no período.'}</p>
  const max = Math.max(...items.map((i) => i.cents), 1)
  return (
    <div className="stack-s" style={{ gap: 14 }}>
      {items.map((it, idx) => (
        <div key={it.key} className="hbar">
          <span className="small ellipsis">{it.label}</span>
          <span className="small num bold">
            {formatBRL(it.cents)} <span className="muted xs">{sum ? Math.round((it.cents / sum) * 100) : 0}%</span>
          </span>
          <div className="track">
            <motion.div initial={{ width: 0 }} animate={{ width: `${(it.cents / max) * 100}%` }} transition={{ type: 'spring', stiffness: 140, damping: 24, delay: Math.min(idx * 0.04, 0.3) }} />
          </div>
        </div>
      ))}
    </div>
  )
}
