import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Page } from '@/components/Page'
import { Button, Banner, Card, EmptyState, Field, IconButton, MoneyInput, Progress, SelectInput, TextArea, TextInput, Badge } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { Sheet, ConfirmDialog } from '@/components/Sheet'
import { Money } from '@/components/AnimatedNumber'
import { HBars } from '@/components/Charts'
import ItemSheet, { type ItemDraft } from '@/components/ItemSheet'
import { useAppState, selectActivePurchase, getState } from '@/store/store'
import { addCartItem, budgetToast, cancelPurchase, changeQty, finalizePurchase, removeCartItem, restoreCartItem, setCheckoutDiscount, setPurchaseBudget, startPurchase, updateCartItem, type NewCartItem } from '@/store/actions'
import { toast, haptic, takePendingStartList } from '@/store/ui'
import { budgetStatus, cartTotals, lineTotal, spendByCategory } from '@/domain/cart'
import { formatBRL, formatDecimal, parseMoney } from '@/lib/money'
import { formatQty } from '@/lib/units'
import { categoryById } from '@/domain/categories'
import { navigate } from '@/router'
import { formatDateTime } from '@/lib/dates'
import { lookupBarcode, type FoundProduct, type LookupOutcome } from '@/services/lookup'
import { evaluatePrice, recordsFor } from '@/domain/prices'
import type { CartItem, PaymentMethod, Purchase } from '@/domain/types'
import type { LabelResult } from '@/components/LabelCapture'

const BarcodeScanner = lazy(() => import('@/components/BarcodeScanner'))
const LabelCapture = lazy(() => import('@/components/LabelCapture'))

const PAYMENTS: { value: PaymentMethod | ''; label: string }[] = [
  { value: '', label: 'Não informar' },
  { value: 'pix', label: 'Pix' },
  { value: 'debito', label: 'Débito' },
  { value: 'credito', label: 'Crédito' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'vale', label: 'Vale-alimentação' },
  { value: 'outro', label: 'Outro' },
]

/* ============================ Início de compra ============================ */
function StartSheet({ open, onClose, presetList }: { open: boolean; onClose: () => void; presetList?: string }) {
  const supermarkets = useAppState((s) => s.supermarkets)
  const lists = useAppState((s) => s.lists)
  const listData = useAppState((s) => s.listData)
  const defaultCity = useAppState((s) => s.settings.defaultCity)
  const limitCents = useAppState((s) => s.settings.goals.perPurchaseLimitCents)
  const purchases = useAppState((s) => s.purchases)
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [listId, setListId] = useState('')
  const [budget, setBudget] = useState(0)
  const [budgetTouched, setBudgetTouched] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    const last = [...purchases].filter((p) => p.status === 'finalized').sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))[0]
    setName('')
    setCity(last?.city ?? defaultCity)
    setListId(presetList ?? '')
    setBudget((presetList ? parseMoney(getState().listData[presetList]?.budget) ?? 0 : 0) || limitCents)
    setBudgetTouched(false)
    setErr('')
  }, [open, purchases, defaultCity, presetList, limitCents])

  const pickList = (id: string) => {
    setListId(id)
    if (!budgetTouched) setBudget((id ? parseMoney(listData[id]?.budget) ?? 0 : 0) || limitCents)
  }
  const start = () => {
    if (!name.trim()) {
      setErr('Escolha ou digite o supermercado.')
      return
    }
    startPurchase({ supermarketName: name, city, listId: listId || undefined, budgetCents: budget })
    onClose()
  }
  const sorted = useMemo(() => [...supermarkets].sort((a, b) => a.name.localeCompare(b.name)), [supermarkets])
  return (
    <Sheet open={open} onClose={onClose} title="Iniciar compra" footer={<Button variant="primary" size="lg" block icon="ShoppingCart" onClick={start}>Começar</Button>}>
      <div className="stack">
        {sorted.length > 0 && (
          <Field label="Supermercados salvos">
            <div className="row-s wrap">
              {sorted.map((m) => (
                <button key={m.id} className={`chip ${name === m.name ? 'active' : ''}`} onClick={() => { setName(m.name); if (m.city) setCity(m.city); setErr('') }}>
                  <Icon name="Store" /> {m.name}{m.city ? ` · ${m.city}` : ''}
                </button>
              ))}
            </div>
          </Field>
        )}
        <TextInput label={sorted.length ? 'Ou cadastre um novo' : 'Supermercado'} value={name} error={err} placeholder="Ex.: Atacadão" onChange={(e) => { setName(e.target.value); setErr('') }} autoFocus={!sorted.length} />
        <TextInput label="Cidade" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex.: Loanda" autoComplete="address-level2" />
        <SelectInput label="Vincular a uma lista (opcional)" value={listId} onChange={(e) => pickList(e.target.value)}>
          <option value="">Sem lista</option>
          {lists.map((l) => <option key={l.id} value={l.id}>{l.name} ({(listData[l.id]?.products ?? []).filter((p) => !p.inCart).length} pendentes)</option>)}
        </SelectInput>
        <MoneyInput label="Orçamento desta compra (opcional)" value={budget} onChange={(c) => { setBudget(c); setBudgetTouched(true) }} hint="Você será avisado ao chegar em 80%, 90% e 100%, sem bloquear a compra." />
      </div>
    </Sheet>
  )
}

function Idle({ autoOpen }: { autoOpen?: boolean }) {
  const [preset] = useState(() => takePendingStartList() ?? undefined)
  const [open, setOpen] = useState(!!preset || !!autoOpen)
  const supermarkets = useAppState((s) => s.supermarkets)
  return (
    <Page title="Compra" subtitle="Registre os preços enquanto compra">
      <div className="hero">
        <div className="label">Modo compra inteligente</div>
        <div style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 10px', letterSpacing: '-0.01em' }}>Acompanhe o carrinho em tempo real</div>
        <p style={{ opacity: 0.9, fontSize: 14, marginBottom: 14 }}>Fotografe etiquetas, leia códigos de barras ou digite. O total, o orçamento e o histórico de preços se atualizam a cada item.</p>
        <button className="btn lg" style={{ background: '#fff', color: '#064e3b', borderColor: '#fff', width: '100%' }} onClick={() => setOpen(true)}>
          <Icon name="ShoppingCart" /> Iniciar compra
        </button>
      </div>
      <div className="grid-2">
        <Card tight><div className="row-s"><span className="avatar primary"><Icon name="Camera" /></span><span className="small"><b>Etiqueta</b><br /><span className="muted">Leitura de preço por foto</span></span></div></Card>
        <Card tight><div className="row-s"><span className="avatar primary"><Icon name="ScanBarcode" /></span><span className="small"><b>Código de barras</b><br /><span className="muted">Identifica o produto</span></span></div></Card>
      </div>
      {supermarkets.length === 0 && <Banner tone="info">Você ainda não cadastrou supermercados. Ao iniciar a compra, informe o nome e a cidade — eles ficam salvos.</Banner>}
      <StartSheet open={open} onClose={() => setOpen(false)} presetList={preset} />
    </Page>
  )
}

/* ============================ Item do carrinho ============================ */
function CartRow({ item, purchase, onEdit }: { item: CartItem; purchase: Purchase; onEdit: (i: CartItem) => void }) {
  const prices = useAppState((s) => s.prices)
  const insight = useMemo(() => {
    if (!item.productId) return null
    const h = recordsFor(prices, item.productId, item.priceUnit)
    if (!h.length) return null
    const total = lineTotal(item)
    const eff = item.qtyMilli ? Math.round((total * 1000) / item.qtyMilli) : item.unitPriceCents
    return evaluatePrice(h, eff, item.priceUnit)[0] ?? null
  }, [prices, item])
  const remove = () => {
    const r = removeCartItem(item.id)
    if (r) toast(`“${item.name}” removido`, 'info', { label: 'Desfazer', run: () => restoreCartItem(r.item, r.index) })
  }
  const total = lineTotal(item)
  void purchase
  return (
    <div className="swipe-wrap">
      <div className="swipe-bg" aria-hidden="true"><Icon name="Trash2" /></div>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.5, right: 0 }}
        onDragEnd={(_, info) => info.offset.x < -110 && remove()}
        layout
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -60, height: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
        style={{ background: 'var(--bg)', position: 'relative' }}
      >
        <div className="cart-item">
          <button className="list-btn" style={{ minWidth: 0 }} onClick={() => onEdit(item)} aria-label={`Editar ${item.name}`}>
            <div className="bold ellipsis">{item.name}</div>
            <div className="xs muted ellipsis">
              {item.brand ? `${item.brand} · ` : ''}{categoryById(item.category).label} · {formatBRL(item.unitPriceCents)}/{item.priceUnit === 'l' ? 'L' : item.priceUnit}
              {item.discountCents ? ` · −${formatBRL(item.discountCents)}` : ''}
            </div>
            <div className="row-s wrap" style={{ marginTop: 2 }}>
              {item.bundle && <Badge tone="info">{item.bundle.qty} por {formatBRL(item.bundle.totalCents)}</Badge>}
              {!item.priceConfirmed && <Badge tone="warn">preço não confirmado</Badge>}
              {item.origin === 'ocr' && <Badge icon="Camera">etiqueta</Badge>}
              {item.origin === 'barcode' && <Badge icon="ScanBarcode">código</Badge>}
            </div>
          </button>
          <div className="right">
            <div className="bold num"><Money cents={total} /></div>
            {item.priceUnit === 'un' ? (
              <div className="stepper" style={{ marginTop: 4 }}>
                <button aria-label={`Diminuir ${item.name}`} onClick={() => (item.qtyMilli > 1000 ? changeQty(item.id, -1000) : remove())}><Icon name={item.qtyMilli > 1000 ? 'Minus' : 'Trash2'} /></button>
                <span className="q num" aria-live="polite">{Math.round(item.qtyMilli / 1000)}</span>
                <button aria-label={`Aumentar ${item.name}`} onClick={() => changeQty(item.id, 1000)}><Icon name="Plus" /></button>
              </div>
            ) : (
              <div className="row-s" style={{ justifyContent: 'flex-end', marginTop: 4 }}>
                <span className="small muted num">{formatQty(item.qtyMilli, item.priceUnit)}</span>
                <IconButton size="sm" icon="Trash2" label={`Remover ${item.name}`} onClick={remove} />
              </div>
            )}
          </div>
          {insight && (
            <div className={`insight ${insight.tone}`} style={{ gridColumn: '1 / -1' }}>
              <Icon name={insight.tone === 'good' ? 'TrendingDown' : 'TrendingUp'} />
              <span>{insight.message} <span className="muted">(ref. {formatBRL(insight.reference.unitPriceCents)} em {new Date(insight.reference.date).toLocaleDateString('pt-BR')})</span></span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

/* ============================ Finalização ============================ */
function FinalizeSheet({ purchase, open, onClose, onDone }: { purchase: Purchase; open: boolean; onClose: () => void; onDone: (p: Purchase) => void }) {
  const totals = cartTotals(purchase.items, purchase.checkoutDiscountCents)
  const [paid, setPaid] = useState(totals.totalCents)
  const [discount, setDiscount] = useState(purchase.checkoutDiscountCents)
  const [method, setMethod] = useState<PaymentMethod | ''>('')
  const [note, setNote] = useState('')
  const busy = useRef(false)
  const est = cartTotals(purchase.items, discount).totalCents
  useEffect(() => {
    if (open) {
      setPaid(cartTotals(purchase.items, purchase.checkoutDiscountCents).totalCents)
      setDiscount(purchase.checkoutDiscountCents)
      setMethod('')
      setNote('')
      busy.current = false
    }
  }, [open, purchase.items, purchase.checkoutDiscountCents])
  const diff = paid - est
  const submit = () => {
    if (busy.current) return // evita duplo toque
    busy.current = true
    const done = finalizePurchase(purchase.id, { paidCents: paid, paymentMethod: method || undefined, note, checkoutDiscountCents: discount })
    if (done) onDone(done)
    else busy.current = false
  }
  return (
    <Sheet open={open} onClose={onClose} title="Finalizar compra" footer={<Button variant="primary" size="lg" block icon="Check" onClick={submit} disabled={purchase.items.length === 0}>Finalizar e registrar</Button>}>
      <div className="stack">
        <div className="card flat tight">
          <div className="row between"><span className="bold">{purchase.supermarketName}</span><span className="muted small">{formatDateTime(purchase.startedAt)}</span></div>
          {purchase.city && <div className="xs muted">{purchase.city}</div>}
          <hr className="divider" />
          <div className="row between small"><span className="muted">Itens</span><span className="num">{totals.lines} produtos · {totals.units} un.</span></div>
          <div className="row between small"><span className="muted">Subtotal</span><span className="num">{formatBRL(totals.subtotalCents + totals.itemDiscountsCents)}</span></div>
          {totals.itemDiscountsCents > 0 && <div className="row between small"><span className="muted">Descontos nos itens</span><span className="num">−{formatBRL(totals.itemDiscountsCents)}</span></div>}
          <div className="row between bold" style={{ marginTop: 4 }}><span>Total estimado</span><span className="num">{formatBRL(est)}</span></div>
        </div>
        <MoneyInput label="Desconto no caixa" value={discount} onChange={(c) => { setDiscount(c); setPaid(cartTotals(purchase.items, c).totalCents) }} hint="Cupons, cashback ou desconto aplicado ao passar no caixa." />
        <MoneyInput label="Valor efetivamente pago" value={paid} onChange={setPaid} hint="Corrija aqui se o valor do caixa foi diferente do estimado." />
        {diff !== 0 && (
          <div className={`banner ${diff > 0 ? 'warn' : 'good'}`}>
            <Icon name={diff > 0 ? 'TrendingUp' : 'TrendingDown'} />
            <div>Você pagou <b className="num">{formatBRL(Math.abs(diff))}</b> {diff > 0 ? 'a mais' : 'a menos'} que o estimado.</div>
          </div>
        )}
        <SelectInput label="Forma de pagamento (opcional)" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod | '')}>
          {PAYMENTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </SelectInput>
        <TextArea label="Observações (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <details className="small">
          <summary className="bold" style={{ cursor: 'pointer', minHeight: 32 }}>Ver {purchase.items.length} produtos</summary>
          <div className="list" style={{ marginTop: 8 }}>
            {purchase.items.map((i) => (
              <div key={i.id} className="list-item" style={{ minHeight: 40, padding: '6px 0' }}>
                <span className="grow ellipsis">{i.name}</span>
                <span className="xs muted">{formatQty(i.qtyMilli, i.priceUnit)}</span>
                <span className="num bold">{formatBRL(lineTotal(i))}</span>
              </div>
            ))}
          </div>
        </details>
      </div>
    </Sheet>
  )
}

function Done({ purchase, onNew }: { purchase: Purchase; onNew: () => void }) {
  const diff = (purchase.paidCents ?? 0) - (purchase.estimatedCents ?? 0)
  return (
    <Page title="Compra finalizada">
      <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }}>
        <Card>
          <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
            <motion.div className="check-burst" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.1 }}><Icon name="Check" /></motion.div>
            <h2>Compra registrada</h2>
            <div className="bold num" style={{ fontSize: 32 }}><Money cents={purchase.paidCents ?? 0} /></div>
            <p className="muted small">{purchase.supermarketName}{purchase.city ? ` · ${purchase.city}` : ''} · {purchase.items.length} produtos</p>
            {diff !== 0 && <Badge tone={diff > 0 ? 'warn' : 'good'}>{diff > 0 ? '+' : '−'}{formatBRL(Math.abs(diff))} em relação ao estimado</Badge>}
            <p className="muted xs">Preços atualizados no histórico de cada produto.</p>
          </div>
        </Card>
      </motion.div>
      <div className="grid-2">
        <Button variant="outline" onClick={() => navigate('/financas')} icon="Wallet">Ver finanças</Button>
        <Button variant="primary" onClick={onNew} icon="ShoppingCart">Nova compra</Button>
      </div>
    </Page>
  )
}

/* ============================ Compra ativa ============================ */
type LookupState = { status: 'loading' | 'done'; code: string; outcome?: LookupOutcome } | null

function Active({ purchase, onDone }: { purchase: Purchase; onDone: (p: Purchase) => void }) {
  const listData = useAppState((s) => s.listData)
  const listName = useAppState((s) => s.lists.find((l) => l.id === purchase.listId)?.name ?? '')
  const externalEnabled = useAppState((s) => s.settings.catalogLookupExternal)
  const [scanner, setScanner] = useState(false)
  const [ocr, setOcr] = useState<'new' | 'price' | null>(null)
  const [lookup, setLookup] = useState<LookupState>(null)
  const [draft, setDraft] = useState<ItemDraft | null>(null)
  const [sourceNote, setSourceNote] = useState<string | undefined>()
  const [itemOpen, setItemOpen] = useState(false)
  const [editing, setEditing] = useState<CartItem | null>(null)
  const [finalize, setFinalize] = useState(false)
  const [cancelAsk, setCancelAsk] = useState(false)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [catOpen, setCatOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const totals = cartTotals(purchase.items, purchase.checkoutDiscountCents)
  const bs = budgetStatus(totals.totalCents, purchase.budgetCents)
  const tone = bs.level === 'over' ? 'danger' : bs.level === 'w90' || bs.level === 'w80' ? 'warn' : undefined
  const cats = useMemo(() => spendByCategory(purchase.items).map((c) => ({ key: c.category, label: c.label, cents: c.cents })), [purchase.items])
  const list = purchase.listId ? listData[purchase.listId] : undefined
  const pendingList = list ? list.products.filter((p) => !p.inCart) : []

  const openDraft = (d: ItemDraft, note?: string) => {
    setDraft(d)
    setSourceNote(note)
    setItemOpen(true)
  }

  const onScan = async (barcode: string) => {
    setScanner(false)
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLookup({ status: 'loading', code: barcode })
    try {
      const out = await lookupBarcode(barcode, { personal: getState().products, externalEnabled }, ctrl.signal)
      if (ctrl.signal.aborted) return
      setLookup(null)
      const f: FoundProduct | null = out.found
      if (f) {
        const sizeTxt = f.size ? (f.size.unit === 'un' ? `${f.size.milli / 1000} un` : f.size.milli >= 1000 ? `${f.size.milli / 1000} ${f.size.unit === 'kg' ? 'kg' : 'L'}` : `${f.size.milli} ${f.size.unit === 'kg' ? 'g' : 'mL'}`) : undefined
        const src = f.source === 'personal' ? 'Seu catálogo' : f.source === 'catalog' ? 'Catálogo ShopSmart' : f.source === 'off' ? 'Open Food Facts' : f.source === 'obf' ? 'Open Beauty Facts' : f.source === 'opf' ? 'Open Products Facts' : undefined
        openDraft({ name: f.name, brand: f.brand, barcode: f.barcode, category: f.category, sizeText: sizeTxt, origin: 'barcode', productSource: f.source }, src)
        haptic('success')
      } else {
        openDraft({ barcode: out.barcode ?? barcode, origin: 'barcode', productSource: 'manual' }, 'Produto novo')
        toast(out.offline ? 'Sem internet: cadastre o produto manualmente.' : out.errors.length ? 'Não consegui consultar as bases agora. Cadastre manualmente.' : 'Produto não encontrado. Cadastre manualmente — ele será reconhecido nas próximas leituras.', 'info')
      }
    } catch {
      if (!ctrl.signal.aborted) {
        setLookup(null)
        openDraft({ barcode, origin: 'barcode' }, 'Produto novo')
      }
    }
  }

  const onLabel = (r: LabelResult) => {
    const target = ocr
    setOcr(null)
    if (target === 'price' && draft) {
      setDraft({ ...draft, priceCents: r.priceCents, priceUnit: r.priceUnit, bundle: r.bundle, priceConfirmed: true })
      setItemOpen(true)
      return
    }
    openDraft({ name: r.name, brand: r.brand, sizeText: r.sizeText, priceCents: r.priceCents, priceUnit: r.priceUnit, bundle: r.bundle, origin: 'ocr', priceConfirmed: true, productSource: 'ocr' })
  }

  const submitItem = (n: NewCartItem) => {
    if (editing) {
      updateCartItem(editing.id, {
        name: n.name,
        brand: n.brand,
        category: n.category ?? editing.category,
        qtyMilli: n.qtyMilli,
        priceUnit: n.priceUnit,
        unitPriceCents: n.unitPriceCents,
        discountCents: n.discountCents ?? 0,
        bundle: n.bundle,
        priceConfirmed: n.priceConfirmed ?? true,
      })
      setEditing(null)
      setItemOpen(false)
      toast('Item atualizado', 'success')
      return
    }
    const r = addCartItem(n)
    setItemOpen(false)
    if (!r) return
    toast(r.merged ? `Quantidade de “${r.item.name}” atualizada` : `“${r.item.name}” adicionado`, 'success')
    if (r.alert) budgetToast(r.alert)
  }

  const editDraft = (i: CartItem): ItemDraft => ({
    name: i.name, brand: i.brand, barcode: i.barcode, category: i.category, priceCents: i.unitPriceCents, priceUnit: i.priceUnit, qtyMilli: i.qtyMilli,
    bundle: i.bundle, discountCents: i.discountCents, origin: i.origin, priceConfirmed: i.priceConfirmed,
  })

  useEffect(() => () => abortRef.current?.abort(), [])

  return (
    <>
      <div className="content stack with-dock" style={{ paddingTop: 0 }}>
        <div className="cart-bar" role="region" aria-label="Resumo do carrinho">
          <div className="row between">
            <div style={{ minWidth: 0 }}>
              <div className="xs" style={{ opacity: 0.85 }}>{purchase.supermarketName}{purchase.city ? ` · ${purchase.city}` : ''}</div>
              <div className="total"><Money cents={totals.totalCents} /></div>
              <div className="xs" style={{ opacity: 0.85 }}>estimado no caixa{totals.checkoutDiscountCents ? ` (−${formatBRL(totals.checkoutDiscountCents)} desconto)` : ''}</div>
            </div>
            <div className="row-s">
              <button className="icon-btn" style={{ color: '#fff' }} onClick={() => setBudgetOpen(true)} aria-label="Definir orçamento"><Icon name="Target" /></button>
              <button className="icon-btn" style={{ color: '#fff' }} onClick={() => setCancelAsk(true)} aria-label="Cancelar compra"><Icon name="X" /></button>
            </div>
          </div>
          <div className="meta">
            <div><span>Produtos</span><b className="num">{totals.lines} <span style={{ fontWeight: 400, opacity: 0.8 }}>({totals.units} un.)</span></b></div>
            <div><span>{bs.level === 'over' ? 'Excedido' : 'Disponível'}</span><b className="num">{purchase.budgetCents ? formatBRL(Math.abs(bs.remainingCents)) : '—'}</b></div>
            <div><span>Orçamento usado</span><b className="num">{purchase.budgetCents ? `${Math.round(bs.usedPct)}%` : '—'}</b></div>
          </div>
          {purchase.budgetCents > 0 ? <Progress pct={bs.usedPct} tone={tone} /> : <button className="xs" style={{ color: '#fff', textDecoration: 'underline', marginTop: 8 }} onClick={() => setBudgetOpen(true)}>Definir orçamento</button>}
        </div>

        <AnimatePresence initial={false}>
          {bs.level !== 'none' && bs.level !== 'ok' && (
            <motion.div key={bs.level} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <Banner tone={bs.level === 'over' ? 'danger' : 'warn'}>
                {bs.level === 'over' ? <>Orçamento ultrapassado em <b className="num">{formatBRL(-bs.remainingCents)}</b>. Você pode continuar comprando.</> : bs.level === 'w90' ? <>90% do orçamento usado. Restam <b className="num">{formatBRL(bs.remainingCents)}</b>.</> : <>80% do orçamento usado. Restam <b className="num">{formatBRL(bs.remainingCents)}</b>.</>}
              </Banner>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="capture-dock">
          <div className="inner" role="group" aria-label="Adicionar produto">
            <button className="capture-btn main" onClick={() => setOcr('new')}><Icon name="Camera" />Etiqueta</button>
            <button className="capture-btn" onClick={() => setScanner(true)}><Icon name="ScanBarcode" />Código</button>
            <button className="capture-btn" onClick={() => { setEditing(null); openDraft({ origin: 'manual' }) }}><Icon name="Plus" />Manual</button>
          </div>
        </div>

        {list && (
          <Card tight>
            <button className="row between list-btn" onClick={() => setListOpen((o) => !o)} aria-expanded={listOpen}>
              <span className="row-s"><Icon name="ListChecks" size={18} /> <b className="small">Lista: {listName}</b></span>
              <span className="row-s"><Badge tone={pendingList.length ? 'warn' : 'good'}>{pendingList.length ? `${pendingList.length} pendentes` : 'tudo no carrinho'}</Badge><Icon name={listOpen ? 'ChevronDown' : 'ChevronRight'} size={16} /></span>
            </button>
            <AnimatePresence initial={false}>
              {listOpen && pendingList.length > 0 && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                  <div className="row-s wrap" style={{ paddingTop: 10 }}>
                    {pendingList.map((p) => (
                      <button key={p.id} className="chip" onClick={() => { setEditing(null); openDraft({ name: p.name, category: p.category, barcode: p.barcode, origin: 'list', qtyMilli: Math.max(1, p.quantity) * 1000 }) }}>
                        <Icon name="Plus" /> {p.name}{p.quantity > 1 ? ` ×${p.quantity}` : ''}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        )}

        <div className="two-col">
          <div>
            {purchase.items.length === 0 ? (
              <EmptyState icon="ShoppingBasket" title="Carrinho vazio" text="Fotografe a etiqueta, leia o código de barras ou adicione manualmente o primeiro produto." />
            ) : (
              <div>
                <div className="row between" style={{ margin: '4px 2px 4px' }}>
                  <h2 className="section-title" style={{ margin: 0 }}>No carrinho</h2>
                  <span className="xs muted">Deslize para a esquerda para remover</span>
                </div>
                <AnimatePresence initial={false}>
                  {purchase.items.map((it) => <CartRow key={it.id} item={it} purchase={purchase} onEdit={(i) => { setEditing(i); setDraft(editDraft(i)); setSourceNote(undefined); setItemOpen(true) }} />)}
                </AnimatePresence>
              </div>
            )}
          </div>
          <div className="stack">
            {cats.length > 0 && (
              <Card tight>
                <button className="row between list-btn" onClick={() => setCatOpen((o) => !o)} aria-expanded={catOpen}>
                  <b>Gastos por categoria</b>
                  <motion.span animate={{ rotate: catOpen ? 180 : 0 }}><Icon name="ChevronDown" size={18} /></motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {catOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                      <div style={{ paddingTop: 12 }}><HBars items={cats} total={totals.subtotalCents} /></div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            )}
            <Button variant="primary" size="lg" block icon="Check" disabled={purchase.items.length === 0} onClick={() => setFinalize(true)}>Finalizar compra</Button>
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        {scanner && <BarcodeScanner onResult={(r) => void onScan(r.barcode)} onClose={() => setScanner(false)} />}
        {ocr && <LabelCapture onResult={onLabel} onClose={() => setOcr(null)} />}
      </Suspense>

      <Sheet open={!!lookup} onClose={() => { abortRef.current?.abort(); setLookup(null) }} title="Identificando produto">
        <div className="stack" style={{ alignItems: 'center', padding: '16px 0' }} aria-busy="true">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}><Icon name="LoaderCircle" size={32} /></motion.div>
          <p className="small muted">Código <b className="num">{lookup?.code}</b></p>
          <p className="small muted">Consultando seu catálogo, o catálogo ShopSmart e bases públicas…</p>
          <Button variant="ghost" onClick={() => { abortRef.current?.abort(); const c = lookup?.code; setLookup(null); if (c) openDraft({ barcode: c, origin: 'barcode' }, 'Produto novo') }}>Cadastrar manualmente</Button>
        </div>
      </Sheet>

      <ItemSheet
        open={itemOpen}
        onClose={() => { setItemOpen(false); setEditing(null) }}
        draft={draft}
        mode={editing ? 'edit' : 'add'}
        onSubmit={submitItem}
        sourceNote={sourceNote}
        onScanPrice={editing ? undefined : () => { setItemOpen(false); setOcr('price') }}
      />
      <FinalizeSheet purchase={purchase} open={finalize} onClose={() => setFinalize(false)} onDone={(p) => { setFinalize(false); onDone(p) }} />
      <BudgetSheet open={budgetOpen} onClose={() => setBudgetOpen(false)} purchase={purchase} />
      <ConfirmDialog
        open={cancelAsk}
        danger
        title="Cancelar esta compra?"
        message="Os itens não serão contabilizados como despesa. Você poderá iniciar outra compra em seguida."
        confirmLabel="Cancelar compra"
        onCancel={() => setCancelAsk(false)}
        onConfirm={() => { setCancelAsk(false); cancelPurchase(purchase.id); toast('Compra cancelada. Nada foi contabilizado.', 'info') }}
      />
    </>
  )
}

function BudgetSheet({ open, onClose, purchase }: { open: boolean; onClose: () => void; purchase: Purchase }) {
  const [v, setV] = useState(purchase.budgetCents)
  const [d, setD] = useState(purchase.checkoutDiscountCents)
  useEffect(() => { if (open) { setV(purchase.budgetCents); setD(purchase.checkoutDiscountCents) } }, [open, purchase.budgetCents, purchase.checkoutDiscountCents])
  return (
    <Sheet open={open} onClose={onClose} title="Orçamento e desconto" footer={<Button variant="primary" block onClick={() => { setPurchaseBudget(v); setCheckoutDiscount(d); onClose() }}>Salvar</Button>}>
      <div className="stack">
        <MoneyInput label="Orçamento desta compra" value={v} onChange={setV} hint="Deixe em branco para não usar orçamento." autoFocus />
        <MoneyInput label="Desconto no caixa (cupom, cashback)" value={d} onChange={setD} />
        <p className="small muted">Atual: {purchase.budgetCents ? formatBRL(purchase.budgetCents) : 'sem orçamento'}{d ? ` · desconto ${formatDecimal(d)}` : ''}</p>
      </div>
    </Sheet>
  )
}

export default function Shop() {
  const active = useAppState(selectActivePurchase)
  const [done, setDone] = useState<Purchase | null>(null)
  const [autoStart, setAutoStart] = useState(false)
  // a compra finalizada deixa de ser "ativa": o resumo vive aqui, acima da tela da compra
  if (done && !active) return <Done purchase={done} onNew={() => { setDone(null); setAutoStart(true) }} />
  return active ? <Active purchase={active} onDone={setDone} /> : <Idle autoOpen={autoStart} />
}
