import { useEffect, useRef, useState } from 'react'
import type { Rect } from '@/services/ocr/preprocess'

/** Recorte da região de interesse: arraste o retângulo ou os cantos. Retorna coordenadas na imagem original. */
export default function CropView({ source, onChange }: { source: HTMLCanvasElement; onChange: (r: Rect) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [box, setBox] = useState({ x: 0.06, y: 0.25, w: 0.88, h: 0.5 }) // frações da imagem
  const drag = useRef<{ mode: 'move' | 'tl' | 'tr' | 'bl' | 'br'; sx: number; sy: number; start: typeof box } | null>(null)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    c.width = source.width
    c.height = source.height
    c.getContext('2d')!.drawImage(source, 0, 0)
  }, [source])

  useEffect(() => {
    onChange({ x: box.x * source.width, y: box.y * source.height, w: box.w * source.width, h: box.h * source.height })
  }, [box, source, onChange])

  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
  const MIN = 0.08

  const onPointerDown = (mode: 'move' | 'tl' | 'tr' | 'bl' | 'br') => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { mode, sx: e.clientX, sy: e.clientY, start: box }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    const el = wrapRef.current
    if (!d || !el) return
    const r = el.getBoundingClientRect()
    const dx = (e.clientX - d.sx) / r.width
    const dy = (e.clientY - d.sy) / r.height
    const s = d.start
    let next: typeof s
    if (d.mode === 'move') {
      next = { ...s, x: clamp(s.x + dx, 0, 1 - s.w), y: clamp(s.y + dy, 0, 1 - s.h) }
    } else {
      let x1 = s.x
      let y1 = s.y
      let x2 = s.x + s.w
      let y2 = s.y + s.h
      if (d.mode === 'tl' || d.mode === 'bl') x1 = clamp(s.x + dx, 0, x2 - MIN)
      if (d.mode === 'tr' || d.mode === 'br') x2 = clamp(s.x + s.w + dx, x1 + MIN, 1)
      if (d.mode === 'tl' || d.mode === 'tr') y1 = clamp(s.y + dy, 0, y2 - MIN)
      if (d.mode === 'bl' || d.mode === 'br') y2 = clamp(s.y + s.h + dy, y1 + MIN, 1)
      next = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
    }
    setBox(next)
  }
  const end = () => (drag.current = null)

  const pct = (v: number) => `${v * 100}%`
  return (
    <div ref={wrapRef} className="crop-area" onPointerMove={onPointerMove} onPointerUp={end} onPointerCancel={end} aria-label="Área de recorte">
      <canvas ref={canvasRef} />
      <div className="crop-box" style={{ left: pct(box.x), top: pct(box.y), width: pct(box.w), height: pct(box.h) }} onPointerDown={onPointerDown('move')}>
        {(
          [
            ['tl', 0, 0],
            ['tr', 100, 0],
            ['bl', 0, 100],
            ['br', 100, 100],
          ] as const
        ).map(([m, lx, ly]) => (
          <div key={m} className="crop-handle" style={{ left: `${lx}%`, top: `${ly}%` }} onPointerDown={onPointerDown(m)} role="slider" aria-label={`Ajustar canto ${m}`} />
        ))}
      </div>
    </div>
  )
}
