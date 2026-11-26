import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { useCamera } from '@/hooks/useCamera'
import { Icon } from './Icon'
import { Banner, Button, MoneyInput, TextInput } from './ui'
import CropView from './CropView'
import { disposeCanvas, fileToCanvas, prepareForOcr, type Rect } from '@/services/ocr/preprocess'
import { parseLabelText, type ParsedLabel, type PriceCandidate } from '@/lib/ocr/parseLabel'
import { formatBRL, type Cents } from '@/lib/money'
import type { PriceUnit } from '@/lib/units'
import { haptic } from '@/store/ui'

export interface LabelResult {
  name: string
  brand?: string
  sizeText?: string
  priceCents: Cents
  priceUnit: PriceUnit
  bundle?: { qty: number; totalCents: Cents }
  promo?: boolean
}

type Step = 'capture' | 'crop' | 'processing' | 'confirm'

const KIND_LABEL: Record<PriceCandidate['kind'], string> = {
  price: 'Preço',
  'unit-price': 'Preço por kg/L',
  bundle: 'Promoção por quantidade',
  'old-price': 'Preço antigo (riscado?)',
  installment: 'Valor da parcela',
}

export default function LabelCapture({ onResult, onClose }: { onResult: (r: LabelResult) => void; onClose: () => void }) {
  const [step, setStep] = useState<Step>('capture')
  const cam = useCamera(step === 'capture')
  const [source, setSource] = useState<HTMLCanvasElement | null>(null)
  const cropRef = useRef<Rect | null>(null)
  const [progress, setProgress] = useState({ stage: 'Preparando…', p: 0 })
  const [error, setError] = useState('')
  const [parsed, setParsed] = useState<ParsedLabel | null>(null)
  const [ocrText, setOcrText] = useState('')
  const [ocrConf, setOcrConf] = useState(0)
  const [sel, setSel] = useState<number | 'manual' | null>(null)
  const [manualCents, setManualCents] = useState(0)
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [showText, setShowText] = useState(false)
  const cancelled = useRef(false)

  // descarta as imagens ao sair (privacidade: nada é guardado)
  useEffect(
    () => () => {
      cancelled.current = true
    },
    [],
  )
  useEffect(() => () => disposeCanvas(source), [source])

  const take = useCallback(() => {
    const frame = cam.grabFrame(2400)
    if (!frame) return
    haptic('tap')
    cam.stop()
    setSource(frame)
    setStep('crop')
  }, [cam])

  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      const c = await fileToCanvas(f)
      setSource(c)
      setStep('crop')
    } catch {
      setError('Não consegui abrir essa imagem.')
    }
  }

  const run = async () => {
    if (!source) return
    setStep('processing')
    setError('')
    setProgress({ stage: 'Carregando leitor de texto…', p: 0.05 })
    try {
      const prepared = prepareForOcr(source, cropRef.current ?? undefined)
      const { recognize } = await import('@/services/ocr/engine')
      const res = await recognize(prepared, (stage, p) => {
        if (cancelled.current) return
        const label = stage.includes('loading') ? 'Carregando leitor de texto…' : stage.includes('recogniz') ? 'Lendo a etiqueta…' : 'Preparando…'
        setProgress({ stage: label, p: Math.max(0.05, p) })
      })
      disposeCanvas(prepared)
      if (cancelled.current) return
      const result = parseLabelText(res.text, { ocrConfidence: res.confidence })
      setParsed(result)
      setOcrText(res.text)
      setOcrConf(res.confidence)
      setName(result.name ?? '')
      setBrand(result.brand ?? '')
      // NUNCA pré-seleciona valor incerto
      const idx = result.suggested ? result.candidates.indexOf(result.suggested) : -1
      setSel(result.confidence !== 'low' && idx >= 0 ? idx : null)
      setManualCents(0)
      // a foto não é mais necessária
      disposeCanvas(source)
      setSource(null)
      haptic('success')
      setStep('confirm')
    } catch (e) {
      console.error(e)
      setError('Não foi possível ler a etiqueta agora (o leitor de texto não carregou). Você pode digitar os dados manualmente.')
      setStep('crop')
    }
  }

  const selected = parsed && typeof sel === 'number' ? parsed.candidates[sel] : null
  const price = sel === 'manual' ? manualCents : selected?.cents ?? 0
  const canConfirm = price > 0 && name.trim().length > 0

  const confirm = () => {
    if (!canConfirm) return
    onResult({
      name: name.trim(),
      brand: brand.trim() || undefined,
      sizeText: parsed?.size?.text,
      priceCents: selected?.bundle ? Math.round(selected.bundle.totalCents / selected.bundle.qty) : price,
      priceUnit: selected?.priceUnit ?? 'un',
      bundle: selected?.bundle,
      promo: selected?.promo || !!selected?.bundle || undefined,
    })
  }

  return (
    <div className="camera" role="dialog" aria-modal="true" aria-label="Fotografar etiqueta de preço" style={step === 'capture' ? undefined : { background: 'var(--bg)', color: 'var(--text)' }}>
      {step === 'capture' && (
        <>
          <video ref={cam.videoRef} playsInline muted autoPlay />
          <div className="top">
            <button className="icon-btn" onClick={onClose} aria-label="Fechar"><Icon name="X" /></button>
            {cam.torchSupported && (
              <button className="icon-btn" onClick={() => cam.setTorch(!cam.torchOn)} aria-pressed={cam.torchOn} aria-label="Lanterna"><Icon name={cam.torchOn ? 'Flashlight' : 'FlashlightOff'} /></button>
            )}
          </div>
          {cam.status === 'error' ? (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
              <div className="stack-s" style={{ alignItems: 'center', maxWidth: 340 }}>
                <Icon name="Camera" size={36} />
                <p role="alert">{cam.error?.message}</p>
                <p className="small" style={{ opacity: 0.8 }}>Use a câmera do sistema ou escolha uma foto.</p>
              </div>
            </div>
          ) : (
            <div className="reticle" aria-hidden="true" style={{ height: 'min(36vw, 160px)' }} />
          )}
          <div className="bottom">
            <p className="small">Enquadre a etiqueta com o preço bem visível</p>
            <div className="row" style={{ width: '100%', justifyContent: 'space-between', maxWidth: 420 }}>
              <label className="icon-btn" style={{ cursor: 'pointer' }} aria-label="Escolher da galeria" title="Escolher da galeria">
                <Icon name="Image" />
                <input type="file" accept="image/*" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
              </label>
              {cam.status === 'ready' ? (
                <button className="shutter" onClick={take} aria-label="Tirar foto" />
              ) : (
                <label className="btn primary" style={{ cursor: 'pointer' }}>
                  <Icon name="Camera" /> Tirar foto
                  <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
                </label>
              )}
              <span style={{ width: 44 }} />
            </div>
          </div>
        </>
      )}

      {step === 'crop' && source && (
        <div className="stack" style={{ padding: 'calc(var(--safe-t) + 12px) 16px calc(var(--safe-b) + 16px)', overflowY: 'auto', height: '100%' }}>
          <div className="row between">
            <h2 style={{ fontSize: 17 }}>Recortar o preço</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Fechar"><Icon name="X" /></button>
          </div>
          <p className="muted small">Ajuste o quadro para cobrir só a etiqueta (nome e preço). Quanto menor a área, melhor a leitura.</p>
          <CropView source={source} onChange={(r) => (cropRef.current = r)} />
          {error && <Banner tone="danger">{error}</Banner>}
          <div className="row">
            <Button variant="outline" icon="Camera" onClick={() => { disposeCanvas(source); setSource(null); setStep('capture') }}>Refazer</Button>
            <Button variant="primary" className="grow" icon="Zap" onClick={run}>Ler etiqueta</Button>
          </div>
        </div>
      )}

      {step === 'processing' && (
        <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 24 }}>
          <div className="stack" style={{ alignItems: 'center', width: '100%', maxWidth: 320 }}>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}>
              <Icon name="LoaderCircle" size={36} />
            </motion.div>
            <p className="bold" aria-live="polite">{progress.stage}</p>
            <div className="progress" style={{ width: '100%' }}><motion.div animate={{ width: `${Math.round(progress.p * 100)}%` }} /></div>
            <p className="xs muted">A leitura acontece no seu aparelho. A foto não é enviada nem guardada.</p>
          </div>
        </div>
      )}

      {step === 'confirm' && parsed && (
        <div className="stack" style={{ padding: 'calc(var(--safe-t) + 12px) 16px calc(var(--safe-b) + 16px)', overflowY: 'auto', height: '100%' }}>
          <div className="row between">
            <h2 style={{ fontSize: 17 }}>Confirme os dados</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Fechar"><Icon name="X" /></button>
          </div>
          {parsed.confidence === 'low' && <Banner tone="warn">Leitura incerta. Confira com a etiqueta e escolha o preço correto — nada será registrado sem a sua confirmação.</Banner>}
          {parsed.warnings.map((w) => <Banner key={w} tone="info">{w}</Banner>)}
          <div className="stack-s" role="radiogroup" aria-label="Preços encontrados">
            {parsed.candidates.map((c, i) => (
              <button key={`${c.kind}-${c.cents}-${i}`} className="cand" role="radio" aria-checked={sel === i} onClick={() => { setSel(i); haptic('tap') }}>
                <span className="radio" />
                <span className="grow">
                  <span className="bold num" style={{ fontSize: 17 }}>{c.bundle ? `${c.bundle.qty} por ${formatBRL(c.bundle.totalCents)}` : formatBRL(c.cents)}{c.priceUnit && c.priceUnit !== 'un' ? ` /${c.priceUnit === 'kg' ? 'kg' : 'L'}` : ''}</span>
                  <span className="xs muted" style={{ display: 'block' }}>{KIND_LABEL[c.kind]} · “{c.raw}”</span>
                </span>
              </button>
            ))}
            <button className="cand" role="radio" aria-checked={sel === 'manual'} onClick={() => setSel('manual')}>
              <span className="radio" />
              <span className="grow bold">Digitar o preço manualmente</span>
            </button>
          </div>
          {sel === 'manual' && <MoneyInput label="Preço" value={manualCents} onChange={setManualCents} autoFocus />}
          <TextInput label="Nome do produto" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Arroz tipo 1 5 kg" />
          <TextInput label="Marca (opcional)" value={brand} onChange={(e) => setBrand(e.target.value)} />
          {parsed.size && <p className="small muted">Embalagem detectada: <b>{parsed.size.text}</b></p>}
          {parsed.promoText && <p className="small muted">Promoção detectada: “{parsed.promoText}”</p>}
          <button className="small muted" style={{ textAlign: 'left', textDecoration: 'underline' }} onClick={() => setShowText((s) => !s)}>
            {showText ? 'Ocultar' : 'Ver'} texto lido (confiança {Math.round(ocrConf)}%)
          </button>
          {showText && <pre className="card flat small" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{ocrText || '(vazio)'}</pre>}
          <div className="row">
            <Button variant="outline" onClick={() => { setParsed(null); setStep('capture') }}>Refazer foto</Button>
            <Button variant="primary" className="grow" icon="Check" disabled={!canConfirm} onClick={confirm}>Usar estes dados</Button>
          </div>
        </div>
      )}
    </div>
  )
}
