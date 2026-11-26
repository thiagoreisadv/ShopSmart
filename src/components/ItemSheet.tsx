import { useEffect, useMemo, useState } from 'react'
import { Sheet } from './Sheet'
import { Badge, Button, Field, MoneyInput, Segmented, SelectInput, Switch, TextInput } from './ui'
import { Icon } from './Icon'
import { CATEGORIES, guessCategory } from '@/domain/categories'
import { formatBRL, type Cents } from '@/lib/money'
import { formatQty, lineAmount, parseSize, toQtyMilli, type PriceUnit, type QtyUnit } from '@/lib/units'
import { lineGross } from '@/domain/cart'
import { evaluatePrice, priceStats, recordsFor } from '@/domain/prices'
import { useAppState } from '@/store/store'
import { searchProducts, matchProduct } from '@/domain/catalog'
import { ageLabel, formatDate } from '@/lib/dates'
import { Money } from './AnimatedNumber'
import type { CartItem, Product } from '@/domain/types'
import type { NewCartItem } from '@/store/actions'

export interface ItemDraft {
  name?: string
  brand?: string
  barcode?: string
  category?: string
  priceCents?: Cents
  priceUnit?: PriceUnit
  qtyMilli?: number
  sizeText?: string
  bundle?: { qty: number; totalCents: Cents }
  discountCents?: number
  origin: CartItem['origin']
  /** o preço veio de uma leitura que o usuário já confirmou */
  priceConfirmed?: boolean
  productSource?: Product['source']
  note?: string
}

const UNIT_OPTS: { value: PriceUnit; label: string }[] = [
  { value: 'un', label: 'Unidade' },
  { value: 'kg', label: 'Quilo' },
  { value: 'l', label: 'Litro' },
]

export default function ItemSheet({
  open,
  onClose,
  draft,
  mode = 'add',
  onSubmit,
  title,
  onScanPrice,
  sourceNote,
  onRemove,
}: {
  open: boolean
  onClose: () => void
  draft: ItemDraft | null
  mode?: 'add' | 'edit'
  onSubmit: (item: NewCartItem) => void
  title?: string
  /** abre a leitura da etiqueta para preencher o preço */
  onScanPrice?: () => void
  /** de onde veio a identificação do produto */
  sourceNote?: string
  /** só no modo edição: remove o item do carrinho */
  onRemove?: () => void
}) {
  const products = useAppState((s) => s.products)
  const prices = useAppState((s) => s.prices)
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState('geral')
  const [catTouched, setCatTouched] = useState(false)
  const [priceUnit, setPriceUnit] = useState<PriceUnit>('un')
  const [price, setPrice] = useState(0)
  const [fromHistory, setFromHistory] = useState(false)
  const [qty, setQty] = useState('1')
  const [qtyUnit, setQtyUnit] = useState<QtyUnit>('un')
  const [discount, setDiscount] = useState(0)
  const [promoOn, setPromoOn] = useState(false)
  const [bundleQty, setBundleQty] = useState('3')
  const [bundleTotal, setBundleTotal] = useState(0)
  const [sizeText, setSizeText] = useState('')
  const [errors, setErrors] = useState<{ name?: string; price?: string; qty?: string }>({})

  useEffect(() => {
    if (!open || !draft) return
    setName(draft.name ?? '')
    setBrand(draft.brand ?? '')
    setCategory(draft.category ?? (draft.name ? guessCategory(draft.name) : 'geral'))
    setCatTouched(!!draft.category)
    const pu = draft.priceUnit ?? 'un'
    setPriceUnit(pu)
    setPrice(draft.priceCents ?? 0)
    setFromHistory(false)
    const qm = draft.qtyMilli ?? 1000
    if (pu === 'un') {
      setQty(String(Math.max(1, Math.round(qm / 1000))))
      setQtyUnit('un')
    } else if (qm < 1000 && draft.qtyMilli) {
      setQty(String(qm))
      setQtyUnit(pu === 'kg' ? 'g' : 'ml')
    } else {
      setQty(draft.qtyMilli ? String(qm / 1000).replace('.', ',') : '1')
      setQtyUnit(pu === 'kg' ? 'kg' : 'l')
    }
    setDiscount(draft.discountCents ?? 0)
    setPromoOn(!!draft.bundle)
    setBundleQty(String(draft.bundle?.qty ?? 3))
    setBundleTotal(draft.bundle?.totalCents ?? 0)
    setSizeText(draft.sizeText ?? '')
    setErrors({})
  }, [open, draft])

  // ao trocar o tipo de venda, ajusta a unidade da quantidade
  const changeUnit = (u: PriceUnit) => {
    setPriceUnit(u)
    setQtyUnit(u === 'un' ? 'un' : u === 'kg' ? 'kg' : 'l')
    setQty(u === 'un' ? '1' : '1')
    if (u !== 'un') setPromoOn(false)
  }

  const qtyNum = useMemo(() => {
    const n = parseFloat(qty.replace(',', '.'))
    return Number.isFinite(n) ? n : 0
  }, [qty])
  const qtyMilli = toQtyMilli(qtyNum, qtyUnit)
  const bq = parseInt(bundleQty, 10) || 0
  const bundle = promoOn && priceUnit === 'un' && bq > 1 && bundleTotal > 0 ? { qty: bq, totalCents: bundleTotal } : undefined
  const gross = lineGross({ qtyMilli, unitPriceCents: price, bundle, priceUnit })
  const total = Math.max(0, gross - discount)

  // produto já conhecido (catálogo pessoal) → histórico de preços
  const size = useMemo(() => (sizeText ? parseSize(sizeText) ?? undefined : undefined), [sizeText])
  const known = useMemo(() => (name.trim().length >= 2 ? matchProduct(products, { barcode: draft?.barcode, name, brand, size }) : undefined), [products, name, brand, size, draft?.barcode])
  const history = useMemo(() => (known ? recordsFor(prices, known.id, priceUnit) : []), [known, prices, priceUnit])
  const stats = useMemo(() => priceStats(history), [history])
  const effectiveUnit = qtyMilli > 0 && total > 0 ? Math.round((total * 1000) / qtyMilli) : price
  const insights = useMemo(() => (price > 0 && history.length ? evaluatePrice(history, effectiveUnit, priceUnit) : []), [history, effectiveUnit, price, priceUnit])
  const suggestions = useMemo(() => (mode === 'add' && !draft?.barcode && name.trim().length >= 2 && !known ? searchProducts(products, name, 4) : []), [mode, draft?.barcode, name, known, products])

  const submit = () => {
    const e: typeof errors = {}
    if (!name.trim()) e.name = 'Informe o nome do produto.'
    if (!(price > 0)) e.price = 'Informe o preço atual.'
    if (!(qtyMilli > 0)) e.qty = 'Quantidade inválida.'
    setErrors(e)
    if (Object.keys(e).length) return
    onSubmit({
      name: name.trim(),
      brand: brand.trim() || undefined,
      barcode: draft?.barcode,
      category,
      qtyMilli,
      priceUnit,
      unitPriceCents: price,
      discountCents: discount || 0,
      bundle,
      origin: draft?.origin ?? 'manual',
      size,
      priceConfirmed: !fromHistory && (draft?.priceConfirmed ?? true),
      note: draft?.note,
      productSource: draft?.productSource,
    })
  }

  const unitLabel = priceUnit === 'un' ? 'por unidade' : priceUnit === 'kg' ? 'por quilo' : 'por litro'

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title ?? (mode === 'edit' ? 'Editar item' : 'Adicionar produto')}
      footer={
        <>
          {mode === 'edit' && onRemove ? <Button variant="ghost" icon="Trash2" onClick={onRemove}>Remover item</Button> : <Button variant="ghost" onClick={onClose}>Cancelar</Button>}
          <Button variant="primary" className="grow" icon="Check" onClick={submit}>
            {mode === 'edit' ? 'Salvar' : 'Adicionar ao carrinho'}
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="card flat tight row between" aria-live="polite">
          <div>
            <div className="xs muted">Total do item</div>
            <div className="bold num" style={{ fontSize: 22 }}><Money cents={total} /></div>
          </div>
          <div className="right xs muted">
            {qtyMilli > 0 ? formatQty(qtyMilli, priceUnit) : '—'}
            {price > 0 && <div>{formatBRL(price)} {unitLabel}</div>}
          </div>
        </div>

        {draft?.barcode && (
          <div className="row-s small muted wrap"><Icon name="ScanBarcode" size={16} /> Código <span className="num bold">{draft.barcode}</span>{sourceNote && <Badge tone="info">{sourceNote}</Badge>}</div>
        )}

        <TextInput label="Nome" value={name} error={errors.name} placeholder="Ex.: Leite integral 1 L" autoFocus={mode === 'add' && !draft?.name}
          onChange={(e) => {
            setName(e.target.value)
            if (!catTouched) setCategory(guessCategory(e.target.value))
          }}
        />
        {suggestions.length > 0 && (
          <div className="row-s wrap" aria-label="Produtos parecidos já cadastrados">
            {suggestions.map((p) => (
              <button key={p.id} className="chip" onClick={() => { setName(p.name); setBrand(p.brand ?? ''); setCategory(p.category); setCatTouched(true); if (p.size) setSizeText(`${p.size.unit === 'un' ? p.size.milli / 1000 + ' un' : p.size.milli >= 1000 ? p.size.milli / 1000 + (p.size.unit === 'kg' ? ' kg' : ' L') : p.size.milli + (p.size.unit === 'kg' ? ' g' : ' ml')}`) }}>
                <Icon name="Search" /> {p.name}
              </button>
            ))}
          </div>
        )}
        <div className="grid-2">
          <TextInput label="Marca" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Opcional" />
          <SelectInput label="Categoria" value={category} onChange={(e) => { setCategory(e.target.value); setCatTouched(true) }}>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </SelectInput>
        </div>

        <Field label="Como é vendido">
          <Segmented value={priceUnit} options={UNIT_OPTS} onChange={changeUnit} label="Tipo de venda" />
        </Field>

        <MoneyInput
          label={`Preço atual (${unitLabel})`}
          value={price}
          error={errors.price}
          hint={known && history.length ? 'Digite o preço que está na etiqueta hoje. O histórico abaixo é só referência.' : undefined}
          onChange={(c) => { setPrice(c); setFromHistory(false) }}
          autoFocus={mode === 'add' && !!draft?.name}
        />

        {onScanPrice && price === 0 && (
          <Button icon="Camera" onClick={onScanPrice}>Ler preço pela etiqueta</Button>
        )}

        {stats.last && (
          <div className="card flat tight stack-s" aria-label="Histórico de preços deste produto">
            <div className="row between">
              <span className="bold small">Histórico (não é o preço de hoje)</span>
              <Badge icon="History">{history.length} {history.length === 1 ? 'registro' : 'registros'}</Badge>
            </div>
            <div className="small muted">
              Último: <b className="num">{formatBRL(stats.last.unitPriceCents)}</b> em {formatDate(stats.last.date)} ({ageLabel(stats.last.date)}) · {stats.last.supermarketName}
            </div>
            <div className="small muted">
              Menor: <b className="num">{formatBRL(stats.lowest!.unitPriceCents)}</b> ({formatDate(stats.lowest!.date)}) · Média: <b className="num">{formatBRL(stats.avgCents)}</b>
            </div>
            <div>
              <Button size="sm" onClick={() => { setPrice(stats.last!.unitPriceCents); setFromHistory(true) }}>Usar último preço ({formatBRL(stats.last.unitPriceCents)})</Button>
              {fromHistory && <span className="xs muted" style={{ marginLeft: 8 }}>será marcado como “não confirmado”</span>}
            </div>
          </div>
        )}
        {insights.map((i) => (
          <div key={i.type} className={`insight ${i.tone}`} role="status">
            <Icon name={i.tone === 'good' ? 'TrendingDown' : 'TrendingUp'} />
            <span>
              <b>{i.message}.</b> Comparado a {formatBRL(i.reference.unitPriceCents)} em {formatDate(i.reference.date)}
              {i.stale ? ' — registro antigo, pode estar desatualizado' : ''}.
            </span>
          </div>
        ))}

        <div className="grid-2" style={{ alignItems: 'end' }}>
          <TextInput
            label={priceUnit === 'un' ? 'Quantidade' : 'Peso / volume'}
            value={qty}
            error={errors.qty}
            inputMode={priceUnit === 'un' ? 'numeric' : 'decimal'}
            onChange={(e) => setQty(e.target.value.replace(/[^\d.,]/g, ''))}
            onFocus={(e) => e.target.select()}
          />
          {priceUnit === 'un' ? (
            <div className="stepper" style={{ justifySelf: 'start' }} aria-label="Ajustar quantidade">
              <button type="button" aria-label="Diminuir" onClick={() => setQty(String(Math.max(1, Math.round(qtyNum) - 1)))}><Icon name="Minus" /></button>
              <span className="q num">{Math.max(1, Math.round(qtyNum))}</span>
              <button type="button" aria-label="Aumentar" onClick={() => setQty(String(Math.round(qtyNum) + 1))}><Icon name="Plus" /></button>
            </div>
          ) : (
            <SelectInput label="Unidade" value={qtyUnit} onChange={(e) => { const u = e.target.value as QtyUnit; setQtyUnit(u) }}>
              {priceUnit === 'kg' ? (<><option value="kg">kg</option><option value="g">g</option></>) : (<><option value="l">L</option><option value="ml">mL</option></>)}
            </SelectInput>
          )}
        </div>

        {priceUnit === 'un' && (
          <>
            <div className="row between">
              <div>
                <div className="bold small">Promoção “leve N por R$ X”</div>
                <div className="xs muted">Ex.: 3 unidades por R$ 10,00</div>
              </div>
              <Switch checked={promoOn} onChange={setPromoOn} label="Ativar promoção por quantidade" />
            </div>
            {promoOn && (
              <div className="grid-2">
                <TextInput label="Leve (unid.)" inputMode="numeric" value={bundleQty} onChange={(e) => setBundleQty(e.target.value.replace(/\D/g, ''))} />
                <MoneyInput label="Por (total)" value={bundleTotal} onChange={setBundleTotal} />
              </div>
            )}
          </>
        )}
        <MoneyInput label="Desconto neste item (opcional)" value={discount} onChange={setDiscount} hint="Total de desconto da linha, em reais." />
        {priceUnit === 'un' && (
          <TextInput label="Tamanho da embalagem (opcional)" value={sizeText} onChange={(e) => setSizeText(e.target.value)} placeholder="Ex.: 500 g, 1,5 L" hint="Ajuda a comparar preços de embalagens iguais." />
        )}
        {lineAmount(price, qtyMilli) > 0 && discount > lineAmount(price, qtyMilli) && <p className="error-text">O desconto é maior que o valor do item.</p>}
      </div>
    </Sheet>
  )
}
