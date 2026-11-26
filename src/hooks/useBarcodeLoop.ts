import { useEffect, useRef } from 'react'
import { normalizeBarcode } from '@/lib/barcode'
import { barcodeRegion } from '@/lib/capture'

type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string; format: string }[]> }

/**
 * Detecção CONTÍNUA e LEVE de código de barras: BarcodeDetector nativo quando existe, ZXing (carregado sob demanda)
 * no restante, incluindo Safari/iPhone. Só roda com `active` (fase de escaneamento) e aba visível.
 * Leituras repetidas do mesmo código em < 2,5 s são ignoradas.
 */
export function useBarcodeLoop(opts: {
  videoRef: React.RefObject<HTMLVideoElement | null>
  active: boolean
  onCode: (code: string, format: string) => void
  onInvalid?: (text: string) => void
}) {
  const { videoRef, active } = opts
  const cb = useRef(opts)
  cb.current = opts
  const last = useRef({ code: '', at: 0 })

  useEffect(() => {
    if (!active) return
    let stopped = false
    let timer: number | undefined
    let detector: Detector | null = null
    let zx: typeof import('@/services/scanner/decode') | null = null
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!

    const accept = (text: string, format: string) => {
      const code = normalizeBarcode(text)
      const now = Date.now()
      if (!code) {
        if (last.current.code !== text || now - last.current.at > 2500) {
          last.current = { code: text, at: now }
          cb.current.onInvalid?.(text)
        }
        return
      }
      if (last.current.code === code && now - last.current.at < 2500) return
      last.current = { code, at: now }
      cb.current.onCode(code, format)
    }

    const loop = async () => {
      if (stopped) return
      const v = videoRef.current
      try {
        if (v && v.readyState >= 2 && document.visibilityState === 'visible') {
          if (detector) {
            const res = await detector.detect(v)
            if (res[0]) accept(res[0].rawValue, res[0].format.toUpperCase())
          } else if (zx) {
            const r = barcodeRegion(v.videoWidth, v.videoHeight)
            const scale = Math.min(1, 900 / r.w)
            canvas.width = Math.round(r.w * scale)
            canvas.height = Math.round(r.h * scale)
            ctx.drawImage(v, r.x, r.y, r.w, r.h, 0, 0, canvas.width, canvas.height)
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const res = zx.decodeLuminance(canvas.width, canvas.height, zx.rgbaToLuma(img.data, canvas.width, canvas.height))
            if (res) accept(res.text, res.format)
          }
        }
      } catch {
        /* quadro sem código */
      }
      if (!stopped) timer = window.setTimeout(loop, detector ? 90 : 150)
    }

    ;(async () => {
      const BD = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector
      if (BD) {
        try {
          const supported = (await BD.getSupportedFormats?.()) ?? []
          const want = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'].filter((f) => supported.includes(f))
          if (want.length >= 3) detector = new BD({ formats: want })
        } catch {
          detector = null
        }
      }
      if (!detector) zx = await import('@/services/scanner/decode')
      if (!stopped) loop()
    })()
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
    }
  }, [active, videoRef])
}
