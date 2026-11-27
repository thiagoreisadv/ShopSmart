import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useCamera } from '@/hooks/useCamera'
import { useBarcodeLoop } from '@/hooks/useBarcodeLoop'
import { Icon } from './Icon'
import CropView from './CropView'
import { disposeCanvas, fileToCanvas, prepareForOcr, type Rect } from '@/services/ocr/preprocess'
import { parseLabelText } from '@/lib/ocr/parseLabel'
import { applyLabel, canAdd, draftFromFound, emptyDraft, pickCandidate, reticleCrop, toCartItem, type CaptureDraft } from '@/lib/capture'
import { lookupBarcode } from '@/services/lookup'
import { useAppState, selectActivePurchase, getState } from '@/store/store'
import { cartTotals, budgetStatus } from '@/domain/cart'
import { matchProduct } from '@/domain/catalog'
import { evaluatePrice, recordsFor } from '@/domain/prices'
import { normalizeBarcode } from '@/lib/barcode'
import { centsFromDigits, formatBRL, formatDecimal } from '@/lib/money'
import { ageLabel } from '@/lib/dates'
import { haptic, toast } from '@/store/ui'
import type { NewCartItem } from '@/store/actions'

type Phase = 'scan' | 'lookup' | 'ocr' | 'confirm' | 'crop'

const SRC_LABEL: Record<string, string> = { personal: 'Seu catálogo', catalog: 'Catálogo ShopSmart', off: 'Open Food Facts', obf: 'Open Beauty Facts', opf: 'Open Products Facts' }

export interface ListFound {
  name: string
  category: string
  barcode: string
  size?: { milli: number; unit: 'un' | 'kg' | 'l' }
}

/**
 * Câmera unificada: lê código de barras continuamente (leve) e só roda OCR quando o usuário toca em "Ler etiqueta".
 * Permite registrar vários produtos em sequência sem sair da câmera.
 */
export default function SmartCapture({
  mode,
  onAdd,
  onListProduct,
  onDetails,
  onClose,
}: {
  mode: 'cart' | 'list'
  onAdd?: (item: NewCartItem) => void
  onListProduct?: (p: ListFound) => void
  /** abre o formulário completo (promoção, desconto…) com o rascunho atual */
  onDetails?: (d: CaptureDraft) => void
  onClose: () => void
}) {
  const [phase, setPhase] = useState<Phase>('scan')
  const [draft, setDraft] = useState<CaptureDraft | null>(null)
  const [hint, setHint] = useState('')
  const [ocrProgress, setOcrProgress] = useState('Preparando…')
  const [flash, setFlash] = useState(false)
  const [added, setAdded] = useState(0)
  const [ocrText, setOcrText] = useState('')
  const [showText, setShowText] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [manualErr, setManualErr] = useState('')
  const cam = useCamera(true)
  const frameRef = useRef<HTMLCanvasElement | null>(null)
  const cropRef = useRef<Rect | null>(null)
  const alive = useRef(true)
  const abortRef = useRef<AbortController | null>(null)
  const active = useAppState(selectActivePurchase)
  const products = useAppState((s) => s.products)
  const prices = useAppState((s) => s.prices)
  const externalEnabled = useAppState((s) => s.settings.catalogLookupExternal)

  useEffect(() => {
    document.body.classList.add('camera-open')
    return () => document.body.classList.remove('camera-open')
  }, [])
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      abortRef.current?.abort()
      disposeCanvas(frameRef.current)
      frameRef.current = null
    }
  }, [])

  const totals = active ? cartTotals(active.items, active.checkoutDiscountCents) : null
  const bs = active && totals ? budgetStatus(totals.totalCents, active.budgetCents) : null

  /* ---------- código de barras ---------- */
  const onCode = useCallback(
    async (code: string) => {
      if (!alive.current) return
      haptic('success')
      setHint('')
      setPhase('lookup')
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      try {
        const out = await lookupBarcode(code, { personal: getState().products, externalEnabled }, ctrl.signal)
        if (!alive.current || ctrl.signal.aborted) return
        // fluxo "preço da etiqueta para um produto já identificado" não passa por aqui (detecção pausada)
        if (mode === 'list') {
          if (out.found) {
            onListProduct?.({ name: out.found.name, category: out.found.category, barcode: out.found.barcode, size: out.found.size })
            setFlash(true)
            setTimeout(() => alive.current && setFlash(false), 700)
            setAdded((n) => n + 1)
            setPhase('scan')
          } else {
            setDraft({ ...emptyDraft(out.barcode ?? code), warnings: ['Produto não encontrado. Digite o nome para adicionar à lista.'] })
            setPhase('confirm')
          }
          return
        }
        if (out.found) {
          setDraft(draftFromFound(out.found))
        } else {
          const d = emptyDraft(out.barcode ?? code)
          d.warnings = [out.offline ? 'Sem internet: informe o nome e o preço.' : 'Produto novo: informe o nome e o preço — ele será reconhecido nas próximas leituras.']
          setDraft(d)
        }
        setPhase('confirm')
      } catch {
        if (alive.current && !ctrl.signal.aborted) {
          setDraft({ ...emptyDraft(code), warnings: ['Não consegui consultar o produto. Informe os dados.'] })
          setPhase('confirm')
        }
      }
    },
    [externalEnabled, mode, onListProduct],
  )
  useBarcodeLoop({
    videoRef: cam.videoRef,
    active: phase === 'scan' && cam.status === 'ready' && !draft,
    onCode: (c) => void onCode(c),
    onInvalid: () => setHint('Esse código não é de produto (EAN/UPC). Tente outro.'),
  })

  /* ---------- OCR (somente sob demanda) ---------- */
  const runOcr = useCallback(
    async (source: HTMLCanvasElement, crop?: Rect) => {
      setPhase('ocr')
      setOcrProgress('Carregando leitor de texto…')
      try {
        const prepared = prepareForOcr(source, crop)
        const { recognize } = await import('@/services/ocr/engine')
        const res = await recognize(prepared, (stage, p) => {
          if (!alive.current) return
          setOcrProgress(stage.includes('recogniz') ? `Lendo a etiqueta… ${Math.round(p * 100)}%` : 'Carregando leitor de texto…')
        })
        disposeCanvas(prepared)
        if (!alive.current) return
        const parsed = parseLabelText(res.text, { ocrConfidence: res.confidence })
        setOcrText(res.text)
        setDraft((cur) => applyLabel(cur, parsed, !!cur?.name))
        haptic(parsed.suggested ? 'success' : 'warn')
        setPhase('confirm')
      } catch (e) {
        console.error(e)
        if (!alive.current) return
        toast('Não consegui ler a etiqueta agora. Digite os dados.', 'warn')
        setDraft((cur) => cur ?? { ...emptyDraft(), warnings: ['Leitura indisponível. Digite o nome e o preço.'] })
        setPhase('confirm')
      }
    },
    [],
  )

  const shutter = () => {
    const frame = cam.grabFrame(2400)
    if (!frame) return
    haptic('tap')
    disposeCanvas(frameRef.current)
    frameRef.current = frame
    void runOcr(frame, reticleCrop(frame.width, frame.height))
  }
  const fromFile = async (f: File | undefined) => {
    if (!f) return
    try {
      const c = await fileToCanvas(f)
      disposeCanvas(frameRef.current)
      frameRef.current = c
      void runOcr(c)
    } catch {
      toast('Não consegui abrir essa imagem.', 'error')
    }
  }

  /* ---------- confirmação ---------- */
  const confirmAdd = () => {
    if (!draft || !canAdd(draft)) return
    if (mode === 'list') return
    onAdd?.(toCartItem(draft))
    setFlash(true)
    setTimeout(() => alive.current && setFlash(false), 650)
    setAdded((n) => n + 1)
    setDraft(null)
    setOcrText('')
    disposeCanvas(frameRef.current)
    frameRef.current = null
    setPhase('scan')
  }
  const addToList = () => {
    if (!draft || !draft.name.trim()) return
    onListProduct?.({ name: draft.name.trim(), category: draft.category, barcode: draft.barcode ?? '', size: draft.size })
    setAdded((n) => n + 1)
    setDraft(null)
    setPhase('scan')
  }
  const cancelDraft = () => {
    setDraft(null)
    setOcrText('')
    setPhase('scan')
  }

  const known = useMemo(() => (draft && draft.name.trim().length > 1 ? matchProduct(products, { barcode: draft.barcode, name: draft.name, brand: draft.brand, size: draft.size }) : undefined), [products, draft])
  const history = useMemo(() => (known ? recordsFor(prices, known.id, draft?.priceUnit) : []), [known, prices, draft?.priceUnit])
  const last = history[0]
  const insight = useMemo(() => (draft && draft.priceCents > 0 && history.length ? evaluatePrice(history, draft.priceCents, draft.priceUnit)[0] : undefined), [draft, history])

  const patch = (p: Partial<CaptureDraft>) => setDraft((d) => (d ? { ...d, ...p } : d))
  const camError = cam.status === 'error'

  return (
    <div className="camera" role="dialog" aria-modal="true" aria-label="Escanear produto">
      <video ref={cam.videoRef} playsInline muted autoPlay />

      <div className="top">
        <button className="icon-btn" onClick={onClose} aria-label="Fechar câmera"><Icon name="X" /></button>
        {mode === 'cart' && totals && (
          <div className="cap-total" aria-live="polite">
            <b className="num">{formatBRL(totals.totalCents)}</b>
            <span>{bs && bs.level !== 'none' ? (bs.remainingCents >= 0 ? `restam ${formatBRL(bs.remainingCents)}` : `excedido ${formatBRL(-bs.remainingCents)}`) : `${totals.lines} ${totals.lines === 1 ? 'item' : 'itens'}`}</span>
          </div>
        )}
        {mode === 'list' && <div className="cap-total"><b>{added}</b><span>na lista</span></div>}
        {cam.torchSupported ? (
          <button className="icon-btn" onClick={() => cam.setTorch(!cam.torchOn)} aria-pressed={cam.torchOn} aria-label={cam.torchOn ? 'Desligar lanterna' : 'Ligar lanterna'}><Icon name={cam.torchOn ? 'Flashlight' : 'FlashlightOff'} /></button>
        ) : <span style={{ width: 44 }} />}
      </div>

      {!camError && phase !== 'crop' && (
        <div className={`reticle ${phase === 'lookup' || flash ? 'ok' : ''}`} aria-hidden="true">
          {phase === 'scan' && cam.status === 'ready' && <div className="scan-line" />}
        </div>
      )}

      <AnimatePresence>
        {flash && (
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} style={{ position: 'absolute', left: '50%', top: '38%', marginLeft: -32, marginTop: -32, zIndex: 3 }}>
            <div className="check-burst" style={{ width: 64, height: 64 }}><Icon name="Check" /></div>
          </motion.div>
        )}
      </AnimatePresence>

      {camError && phase === 'scan' && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
          <div className="stack-s" style={{ alignItems: 'center', maxWidth: 340 }}>
            <Icon name="Camera" size={34} />
            <p role="alert">{cam.error?.message}</p>
            <p className="small" style={{ opacity: 0.8 }}>Use a câmera do sistema, escolha uma foto ou digite.</p>
          </div>
        </div>
      )}

      {/* ---------- escaneando ---------- */}
      {phase === 'scan' && (
        <div className="bottom">
          <p className="small" aria-live="polite" style={{ textAlign: 'center' }}>
            {hint || (cam.status === 'starting' ? 'Abrindo câmera…' : mode === 'list' ? 'Aponte para o código de barras' : 'Aponte para o código de barras ou leia a etiqueta')}
          </p>
          <div className="cap-actions">
            <label className="cap-side" aria-label="Escolher foto da galeria">
              <Icon name="Image" /><span>Galeria</span>
              <input type="file" accept="image/*" hidden onChange={(e) => { void fromFile(e.target.files?.[0]); e.target.value = '' }} />
            </label>
            {mode === 'cart' ? (
              cam.status === 'ready' ? (
                <button className="cap-shutter" onClick={shutter} aria-label="Ler etiqueta de preço"><Icon name="Camera" size={26} /><span>Ler etiqueta</span></button>
              ) : (
                <label className="cap-shutter" style={{ cursor: 'pointer' }}>
                  <Icon name="Camera" size={26} /><span>Tirar foto</span>
                  <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void fromFile(e.target.files?.[0]); e.target.value = '' }} />
                </label>
              )
            ) : <span style={{ flex: 1 }} />}
            <button className="cap-side" onClick={() => { setDraft(emptyDraft()); setPhase('confirm') }} aria-label="Digitar manualmente"><Icon name="Pencil" /><span>Digitar</span></button>
          </div>
          {!draft && (manualOpen ? (
            <form className="row-s" style={{ width: '100%', maxWidth: 440 }} onSubmit={(e) => { e.preventDefault(); const c = normalizeBarcode(manualCode); if (!c) { setManualErr('Código inválido. Confira os dígitos.'); return } setManualOpen(false); setManualCode(''); setManualErr(''); void onCode(c) }}>
              <input className="input" inputMode="numeric" autoFocus placeholder="Código de barras" aria-label="Digitar código de barras" aria-invalid={manualErr ? true : undefined} value={manualCode} onChange={(e) => { setManualCode(e.target.value.replace(/\D/g, '')); setManualErr('') }} style={{ background: 'rgb(255 255 255 / 0.95)', color: '#0f172a' }} />
              <button type="submit" className="btn primary" style={{ flex: 'none' }}>Buscar</button>
            </form>
          ) : <button className="xs" style={{ textDecoration: 'underline', opacity: 0.9, minHeight: 32 }} onClick={() => setManualOpen(true)}>Digitar código de barras</button>)}
          {manualErr && <p className="xs" role="alert" style={{ color: '#fecaca' }}>{manualErr}</p>}
          {draft && <button className="btn" onClick={() => setPhase('confirm')}>Voltar ao produto</button>}
          {added > 0 && !draft && <button className="btn primary" style={{ minWidth: 200 }} onClick={onClose}><Icon name="Check" /> Concluir ({added})</button>}
        </div>
      )}

      {phase === 'lookup' && (
        <div className="bottom"><div className="cap-pill" aria-live="polite"><motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ display: 'inline-flex' }}><Icon name="LoaderCircle" size={18} /></motion.span> Identificando produto…</div></div>
      )}
      {phase === 'ocr' && (
        <div className="bottom"><div className="cap-pill" aria-live="polite"><motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ display: 'inline-flex' }}><Icon name="LoaderCircle" size={18} /></motion.span> {ocrProgress}</div><p className="xs" style={{ opacity: 0.8 }}>Lido no seu aparelho; a foto não é guardada.</p></div>
      )}

      {/* ---------- confirmação rápida ---------- */}
      <AnimatePresence>
        {phase === 'confirm' && draft && (
          <motion.div key="confirm" className="cap-panel" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 420, damping: 40 }} role="group" aria-label="Confirmar produto">
            <div className="stack-s">
              {draft.name && draft.source !== 'manual' && draft.source !== 'ocr' && <div className="pid"><Icon name="CircleCheck" size={16} /> Produto identificado</div>}
              {draft.warnings.map((w) => <p key={w} className="xs muted">{w}</p>)}
              <input className="input" aria-label="Nome do produto" placeholder="Nome do produto" value={draft.name} onChange={(e) => patch({ name: e.target.value })} autoFocus={!draft.name} />
              <div className="xs muted ellipsis">
                {[draft.brand, draft.barcode && `Código ${draft.barcode}`, SRC_LABEL[draft.source]].filter(Boolean).join(' · ')}
              </div>

              {mode === 'cart' && (
                <>
                  {draft.candidates.length > 0 && (
                    <div className="row-s" style={{ overflowX: 'auto' }} role="radiogroup" aria-label="Preços encontrados">
                      {draft.candidates.map((c, i) => {
                        const label = c.bundle ? `${c.bundle.qty} por ${formatBRL(c.bundle.totalCents)}` : `${formatBRL(c.cents)}${c.priceUnit && c.priceUnit !== 'un' ? `/${c.priceUnit === 'kg' ? 'kg' : 'L'}` : ''}`
                        const on = pickCandidate(draft, c).priceCents === draft.priceCents && (c.priceUnit ?? 'un') === draft.priceUnit
                        return (
                          <button key={`${c.kind}${c.cents}${i}`} className={`chip ${on ? 'active' : ''}`} role="radio" aria-checked={on} style={{ flex: 'none' }} onClick={() => { setDraft(pickCandidate(draft, c)); haptic('tap') }}>
                            {label}{c.kind === 'unit-price' ? ' · por kg/L' : c.kind === 'old-price' ? ' · antigo' : ''}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  <div className="row-s">
                    <div className="input-affix grow bigprice">
                      <span className="affix">R$</span>
                      <input className="input num" inputMode="numeric" autoComplete="off" aria-label="Preço" placeholder="0,00" autoFocus={!!draft.name && draft.priceCents === 0}
                        value={draft.priceCents ? formatDecimal(draft.priceCents) : ''}
                        onChange={(e) => patch({ priceCents: centsFromDigits(e.target.value), bundle: undefined })}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => e.key === 'Enter' && canAdd(draft) && confirmAdd()} />
                    </div>
                    <select className="select" style={{ width: 96, flex: 'none' }} aria-label="Vendido por" value={draft.priceUnit} onChange={(e) => patch({ priceUnit: e.target.value as CaptureDraft['priceUnit'], qty: 1, bundle: undefined })}>
                      <option value="un">un</option><option value="kg">kg</option><option value="l">L</option>
                    </select>
                    {draft.priceUnit === 'un' ? (
                      <div className="stepper" aria-label="Quantidade">
                        <button aria-label="Diminuir quantidade" onClick={() => patch({ qty: Math.max(1, draft.qty - 1) })}><Icon name="Minus" /></button>
                        <span className="q num">{draft.qty}</span>
                        <button aria-label="Aumentar quantidade" onClick={() => patch({ qty: draft.qty + 1 })}><Icon name="Plus" /></button>
                      </div>
                    ) : (
                      <input className="input num" style={{ width: 84, flex: 'none' }} inputMode="decimal" aria-label={`Quantidade em ${draft.priceUnit === 'kg' ? 'kg' : 'L'}`} value={String(draft.qty).replace('.', ',')} onChange={(e) => { const n = parseFloat(e.target.value.replace(',', '.')); patch({ qty: Number.isFinite(n) ? n : 0 }) }} />
                    )}
                  </div>
                  {draft.bundle && <p className="xs muted">Promoção: {draft.bundle.qty} por {formatBRL(draft.bundle.totalCents)}</p>}
                  {last && (
                    <p className={`xs ${insight?.tone === 'good' ? 'good-text' : 'muted'}`}>
                      Referência: {formatBRL(last.unitPriceCents)} {ageLabel(last.date)} em {last.supermarketName}{insight ? ` · ${insight.message.toLowerCase()}` : ''}
                    </p>
                  )}
                  {draft.priceCents === 0 && (
                    <div className="row-s">
                      <button className="btn sm" onClick={() => { cancelPreserve(); }}><Icon name="Camera" /> Ler preço da etiqueta</button>
                    </div>
                  )}
                  {ocrText && (
                    <div className="row-s wrap">
                      {frameRef.current && <button className="xs muted" style={{ textDecoration: 'underline' }} onClick={() => { cropRef.current = null; setPhase('crop') }}>Ajustar recorte</button>}
                      <button className="xs muted" style={{ textDecoration: 'underline' }} onClick={() => setShowText((s) => !s)}>{showText ? 'Ocultar' : 'Ver'} texto lido</button>
                    </div>
                  )}
                  {showText && ocrText && <pre className="xs muted" style={{ whiteSpace: 'pre-wrap', margin: 0, maxHeight: 90, overflow: 'auto' }}>{ocrText}</pre>}
                </>
              )}
              <button className="btn primary confirm-btn" disabled={mode === 'cart' ? !canAdd(draft) : !draft.name.trim()} onClick={mode === 'cart' ? confirmAdd : addToList}>
                <Icon name="Check" /> {mode === 'cart' ? 'Confirmar e adicionar' : 'Adicionar à lista'}
              </button>
              <div className="row-s" style={{ justifyContent: 'center', gap: 20 }}>
                {mode === 'cart' && onDetails && <button className="link" onClick={() => onDetails(draft)}>Inserir manualmente</button>}
                <button className="link" style={{ color: 'var(--muted)' }} onClick={cancelDraft}>Cancelar</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === 'crop' && frameRef.current && (
        <div className="cap-crop stack">
          <p className="small">Ajuste o quadro para cobrir só a etiqueta.</p>
          <CropView source={frameRef.current} onChange={(r) => (cropRef.current = r)} />
          <div className="row">
            <button className="btn" onClick={() => setPhase('confirm')}>Voltar</button>
            <button className="btn primary grow" onClick={() => frameRef.current && void runOcr(frameRef.current, cropRef.current ?? undefined)}>Ler novamente</button>
          </div>
        </div>
      )}
    </div>
  )

  /** "Ler preço da etiqueta" para um produto já identificado: volta à câmera preservando o rascunho. */
  function cancelPreserve() {
    setPhase('scan')
    setHint('Enquadre a etiqueta e toque em “Ler etiqueta”.')
    // o rascunho continua em `draft`; a detecção de códigos fica pausada até concluir
  }
}
