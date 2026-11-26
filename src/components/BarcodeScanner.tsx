import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useCamera } from '@/hooks/useCamera'
import { Icon } from './Icon'
import { normalizeBarcode } from '@/lib/barcode'
import { haptic } from '@/store/ui'

export interface ScanResult {
  /** código GTIN normalizado (EAN-13/8, UPC convertido) */
  barcode: string
  format: string
}

/**
 * Leitor de código de barras em tela cheia. Usa BarcodeDetector nativo quando existir
 * e ZXing (carregado sob demanda) no restante — incluindo Safari/iPhone.
 */
export default function BarcodeScanner({ onResult, onClose }: { onResult: (r: ScanResult) => void; onClose: () => void }) {
  const cam = useCamera(true)
  const [manual, setManual] = useState('')
  const [manualErr, setManualErr] = useState('')
  const [hit, setHit] = useState(false)
  const [hint, setHint] = useState('')
  const lastRef = useRef<{ code: string; at: number }>({ code: '', at: 0 })
  const doneRef = useRef(false)

  useEffect(() => {
    if (cam.status !== 'ready') return
    let stopped = false
    let timer: number | undefined
    let detector: { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string; format: string }[]> } | null = null
    let zx: typeof import('@/services/scanner/decode') | null = null
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!

    const accept = (text: string, format: string) => {
      if (doneRef.current) return
      const code = normalizeBarcode(text)
      const now = Date.now()
      if (!code) {
        // QR/Code128 que não é GTIN: avisa sem travar a leitura
        if (now - lastRef.current.at > 2500 || lastRef.current.code !== text) {
          setHint('Código lido não é um código de produto (EAN/UPC).')
          lastRef.current = { code: text, at: now }
        }
        return
      }
      // evita leituras duplicadas involuntárias do mesmo código
      if (lastRef.current.code === code && now - lastRef.current.at < 2500) return
      lastRef.current = { code, at: now }
      doneRef.current = true
      haptic('success')
      setHit(true)
      cam.stop()
      window.setTimeout(() => onResult({ barcode: code, format }), 650)
    }

    const loop = async () => {
      if (stopped || doneRef.current) return
      const v = cam.videoRef.current
      try {
        if (v && v.readyState >= 2) {
          if (detector) {
            const res = await detector.detect(v)
            if (res[0]) accept(res[0].rawValue, res[0].format.toUpperCase())
          } else if (zx) {
            // recorta a região central (onde está a mira) para acelerar em aparelhos antigos
            const vw = v.videoWidth
            const vh = v.videoHeight
            const cw = Math.round(vw * 0.9)
            const ch = Math.round(vh * 0.5)
            const sx = Math.round((vw - cw) / 2)
            const sy = Math.round(vh * 0.42 - ch / 2)
            const scale = Math.min(1, 900 / cw)
            canvas.width = Math.round(cw * scale)
            canvas.height = Math.round(ch * scale)
            ctx.drawImage(v, sx, Math.max(0, sy), cw, ch, 0, 0, canvas.width, canvas.height)
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const r = zx.decodeLuminance(canvas.width, canvas.height, zx.rgbaToLuma(img.data, canvas.width, canvas.height))
            if (r) accept(r.text, r.format)
          }
        }
      } catch {
        /* quadro sem código */
      }
      timer = window.setTimeout(loop, detector ? 90 : 140)
    }

    ;(async () => {
      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => typeof detector & object }).BarcodeDetector
      if (BD) {
        try {
          const supported: string[] = (await (BD as unknown as { getSupportedFormats: () => Promise<string[]> }).getSupportedFormats?.()) ?? []
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam.status])

  const submitManual = () => {
    const code = normalizeBarcode(manual)
    if (!code) {
      setManualErr('Código inválido. Confira os dígitos (EAN-13, EAN-8 ou UPC).')
      return
    }
    doneRef.current = true
    cam.stop()
    onResult({ barcode: code, format: 'MANUAL' })
  }

  return (
    <div className="camera" role="dialog" aria-modal="true" aria-label="Leitor de código de barras">
      <video ref={cam.videoRef} playsInline muted autoPlay />
      <div className="top">
        <button className="icon-btn" onClick={onClose} aria-label="Fechar leitor">
          <Icon name="X" />
        </button>
        {cam.torchSupported && (
          <button className="icon-btn" onClick={() => cam.setTorch(!cam.torchOn)} aria-pressed={cam.torchOn} aria-label={cam.torchOn ? 'Desligar lanterna' : 'Ligar lanterna'}>
            <Icon name={cam.torchOn ? 'Flashlight' : 'FlashlightOff'} />
          </button>
        )}
      </div>
      {cam.status !== 'error' && (
        <div className={`reticle ${hit ? 'ok' : ''}`} aria-hidden="true">
          {!hit && cam.status === 'ready' && <div className="scan-line" />}
        </div>
      )}
      <AnimatePresence>
        {hit && (
          <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 22 }} style={{ position: 'absolute', left: '50%', top: '42%', marginLeft: -36, marginTop: -36, zIndex: 3 }}>
            <div className="check-burst"><Icon name="Check" /></div>
          </motion.div>
        )}
      </AnimatePresence>
      {cam.status === 'error' && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', zIndex: 1 }}>
          <div className="stack-s" style={{ maxWidth: 340, alignItems: 'center' }}>
            <Icon name="Camera" size={36} />
            <p role="alert">{cam.error?.message}</p>
            <p className="small" style={{ opacity: 0.8 }}>Você ainda pode digitar o código abaixo.</p>
          </div>
        </div>
      )}
      <div className="bottom">
        <p className="small" aria-live="polite" style={{ textAlign: 'center', opacity: 0.95 }}>
          {hit ? 'Código lido!' : hint || (cam.status === 'starting' ? 'Abrindo câmera…' : 'Aponte para o código de barras')}
        </p>
        <form
          style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 420 }}
          onSubmit={(e) => {
            e.preventDefault()
            submitManual()
          }}
        >
          <input
            className="input"
            inputMode="numeric"
            placeholder="Ou digite o código"
            aria-label="Digitar código de barras"
            aria-invalid={manualErr ? true : undefined}
            value={manual}
            onChange={(e) => {
              setManual(e.target.value.replace(/[^\d]/g, ''))
              setManualErr('')
            }}
            style={{ background: 'rgb(255 255 255 / 0.95)', color: '#0f172a' }}
          />
          <button type="submit" className="btn primary" style={{ flex: 'none' }}>
            <Icon name="Search" /> Buscar
          </button>
        </form>
        {manualErr && <p className="small" role="alert" style={{ color: '#fecaca' }}>{manualErr}</p>}
      </div>
    </div>
  )
}
