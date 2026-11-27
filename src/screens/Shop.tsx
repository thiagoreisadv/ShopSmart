import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Page } from '@/components/Page'
import { Button, EmptyState, Field, MoneyInput, Progress, SelectInput, TextArea, TextInput } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { Sheet, ConfirmDialog, ActionSheet, type ActionItem } from '@/components/Sheet'
import { Money } from '@/components/AnimatedNumber'
import { HBars } from '@/components/Charts'
import ItemSheet, { type ItemDraft } from '@/components/ItemSheet'
import { useAppState, selectActivePurchase, getState } from '@/store/store'
import { addCartItem, budgetToast, cancelPurchase, changeQty, finalizePurchase, removeCartItem, restoreCartItem, setCheckoutDiscount, setPurchaseBudget, startPurchase, updateCartItem, type NewCartItem } from '@/store/actions'
import { toast, takePendingStartList } from '@/store/ui'
import { budgetStatus, cartTotals, lineTotal, spendByCategory } from '@/domain/cart'
import { formatBRL, formatDecimal, parseMoney } from '@/lib/money'
import { formatQty, formatSizeText } from '@/lib/units'
import { navigate } from '@/router'
import { formatDateTime } from '@/lib/dates'
import type { CartItem, PaymentMethod, Purchase } from '@/domain/types'

const SmartCapture = lazy(() => import('@/components/SmartCapture'))

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
  return (
    <Page title="Comprar" subtitle="Acompanhe o carrinho em tempo real">
      <div className="stack" style={{ alignItems: 'stretch', paddingTop: 24 }}>
        <EmptyState icon="ScanBarcode" title="Pronto para comprar?" text="Escaneie o código de barras ou a etiqueta de cada produto. O total e o orçamento se atualizam na hora." />
        <Button variant="primary" size="lg" block icon="ShoppingCart" onClick={() => setOpen(true)}>Iniciar compra</Button>
      </div>
      <StartSheet open={open} onClose={() => setOpen(false)} presetList={preset} />
    </Page>
  )
}

/* ============================ Item do carrinho ============================ */
function CartRow({ item, onEdit }: { item: CartItem; onEdit: (i: CartItem) => void }) {
  const remove = () => {
    const r = removeCartItem(item.id)
    if (r) toast(`“${item.name}” removido`, 'info', { label: 'Desfazer', run: () => restoreCartItem(r.item, r.index) })
  }
  const total = lineTotal(item)
  return (
    <div className="swipe-wrap">
      <div className="swipe-bg" aria-hidden="true"><Icon name="Trash2" /></div>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.5, right: 0 }}
        onDragEnd={(_, info) => info.offset.x < -110 && remove()}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.16 }}
        style={{ background: 'var(--bg)', position: 'relative' }}
      >
        <div className="cart-item">
          <button className="list-btn" style={{ minWidth: 0 }} onClick={() => onEdit(item)} aria-label={`Editar ${item.name}`}>
            <div className="bold ellipsis">{item.name}</div>
            <div className="xs muted ellipsis">
              {formatBRL(item.unitPriceCents)}/{item.priceUnit === 'l' ? 'L' : item.priceUnit}
              {item.bundle ? ` · ${item.bundle.qty} por ${formatBRL(item.bundle.totalCents)}` : ''}
              {item.discountCents ? ` · −${formatBRL(item.discountCents)}` : ''}
              {!item.priceConfirmed ? ' · preço não confirmado' : ''}
            </div>
          </button>
          <div className="right">
            <div className="bold num"><Money cents={total} /></div>
            {item.priceUnit === 'un' ? (
              <div className="stepper sm" style={{ marginTop: 2 }}>
                <button aria-label={`Diminuir ${item.name}`} onClick={() => (item.qtyMilli > 1000 ? changeQty(item.id, -1000) : remove())}><Icon name={item.qtyMilli > 1000 ? 'Minus' : 'Trash2'} /></button>
                <span className="q num" aria-live="polite">{Math.round(item.qtyMilli / 1000)}</span>
                <button aria-label={`Aumentar ${item.name}`} onClick={() => changeQty(item.id, 1000)}><Icon name="Plus" /></button>
              </div>
            ) : (
              <div className="xs muted num" style={{ marginTop: 2 }}>{formatQty(item.qtyMilli, item.priceUnit)}</div>
            )}
          </div>
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
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center', paddingTop: 28 }}>
        <motion.div className="check-burst" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 24 }}><Icon name="Check" /></motion.div>
        <h2>Compra registrada</h2>
        <div className="bold num" style={{ fontSize: 34 }}><Money cents={purchase.paidCents ?? 0} /></div>
        <p className="muted small">{purchase.supermarketName}{purchase.city ? ` · ${purchase.city}` : ''} · {purchase.items.length} produtos</p>
        {diff !== 0 && <p className="small" style={{ color: diff > 0 ? 'var(--warn-text)' : 'var(--primary-soft-text)' }}>{diff > 0 ? '+' : '−'}{formatBRL(Math.abs(diff))} em relação ao estimado</p>}
        <p className="muted xs">Preços atualizados no histórico de cada produto.</p>
      </div>
      <div className="grid-2">
        <Button variant="outline" onClick={() => navigate('/gastos')} icon="Wallet">Ver gastos</Button>
        <Button variant="primary" onClick={onNew} icon="ShoppingCart">Nova compra</Button>
      </div>
    </Page>
  )
}

/* ============================ Compra ativa ============================ */
function Active({ purchase, onDone }: { purchase: Purchase; onDone: (p: Purchase) => void }) {
  const listData = useAppState((s) => s.listData)
  const listName = useAppState((s) => s.lists.find((l) => l.id === purchase.listId)?.name ?? '')
  const [camera, setCamera] = useState(false)
  const [draft, setDraft] = useState<ItemDraft | null>(null)
  const [itemOpen, setItemOpen] = useState(false)
  const [editing, setEditing] = useState<CartItem | null>(null)
  const [finalize, setFinalize] = useState(false)
  const [cancelAsk, setCancelAsk] = useState(false)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const [catOpen, setCatOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  useEffect(() => {
    document.body.classList.add('has-dock')
    return () => document.body.classList.remove('has-dock')
  }, [])

  const totals = cartTotals(purchase.items, purchase.checkoutDiscountCents)
  const bs = budgetStatus(totals.totalCents, purchase.budgetCents)
  const tone = bs.level === 'over' ? 'danger' : bs.level === 'w90' || bs.level === 'w80' ? 'warn' : undefined
  const cats = useMemo(() => spendByCategory(purchase.items).map((c) => ({ key: c.category, label: c.label, cents: c.cents })), [purchase.items])
  const list = purchase.listId ? listData[purchase.listId] : undefined
  const pendingList = list ? list.products.filter((p) => !p.inCart) : []

  const openManual = (d: ItemDraft = { origin: 'manual' }) => {
    setEditing(null)
    setDraft(d)
    setItemOpen(true)
  }

  const handleAdd = (n: NewCartItem) => {
    const r = addCartItem(n)
    if (!r) return
    toast(r.merged ? `+1 ${r.item.name}` : `${r.item.name} adicionado`, 'success')
    if (r.alert) budgetToast(r.alert)
  }

  const submitItem = (n: NewCartItem) => {
    if (editing) {
      updateCartItem(editing.id, {
        name: n.name, brand: n.brand, category: n.category ?? editing.category, qtyMilli: n.qtyMilli, priceUnit: n.priceUnit,
        unitPriceCents: n.unitPriceCents, discountCents: n.discountCents ?? 0, bundle: n.bundle, priceConfirmed: n.priceConfirmed ?? true,
      })
      setEditing(null)
      setItemOpen(false)
      toast('Item atualizado', 'success')
      return
    }
    setItemOpen(false)
    handleAdd(n)
  }

  const editDraft = (i: CartItem): ItemDraft => ({
    name: i.name, brand: i.brand, barcode: i.barcode, category: i.category, priceCents: i.unitPriceCents, priceUnit: i.priceUnit, qtyMilli: i.qtyMilli,
    bundle: i.bundle, discountCents: i.discountCents, origin: i.origin, priceConfirmed: i.priceConfirmed,
  })

  const actions: ActionItem[] = [
    { label: 'Orçamento e desconto no caixa', icon: 'Target', detail: purchase.budgetCents ? `Orçamento ${formatBRL(purchase.budgetCents)}` : 'Sem orçamento definido', run: () => setBudgetOpen(true) },
    { label: 'Gastos por categoria', icon: 'ChartColumn', run: () => setCatOpen(true) },
    ...(list ? [{ label: `Lista: ${listName}`, icon: 'ListChecks' as const, detail: pendingList.length ? `${pendingList.length} pendentes` : 'tudo no carrinho', run: () => setListOpen(true) }] : []),
    { label: 'Cancelar compra', icon: 'X', danger: true, run: () => setCancelAsk(true) },
  ]

  return (
    <>
      <div className="content stack with-dock" style={{ paddingTop: 0, gap: 8 }}>
        <div className="cart-bar" role="region" aria-label="Resumo do carrinho">
          <div className="row between">
            <div className="xs ellipsis" style={{ opacity: 0.85 }}>{purchase.supermarketName}{purchase.city ? ` · ${purchase.city}` : ''}</div>
            <button className="icon-btn sm" style={{ color: '#fff' }} onClick={() => setMenu(true)} aria-label="Mais opções da compra"><Icon name="Ellipsis" /></button>
          </div>
          <div className="row between" style={{ alignItems: 'flex-end' }}>
            <div>
              <div className="total"><Money cents={totals.totalCents} /></div>
              <div className="xs" style={{ opacity: 0.85 }}>{totals.lines} {totals.lines === 1 ? 'produto' : 'produtos'} · {totals.units} un.</div>
            </div>
            {purchase.budgetCents > 0 ? (
              <button className="right" style={{ color: '#fff' }} onClick={() => setBudgetOpen(true)} aria-label="Orçamento">
                <div className="xs" style={{ opacity: 0.85 }}>{bs.level === 'over' ? 'Excedido' : 'Restante'}</div>
                <div className="bold num" style={{ fontSize: 18 }}>{formatBRL(Math.abs(bs.remainingCents))}</div>
              </button>
            ) : (
              <button className="xs" style={{ color: '#fff', textDecoration: 'underline' }} onClick={() => setBudgetOpen(true)}>Definir orçamento</button>
            )}
          </div>
          {purchase.budgetCents > 0 && <Progress pct={bs.usedPct} tone={tone} />}
          {(bs.level === 'w80' || bs.level === 'w90' || bs.level === 'over') && (
            <div className="xs" role="status" style={{ marginTop: 6 }}>
              {bs.level === 'over' ? <>Orçamento ultrapassado em <b className="num">{formatBRL(-bs.remainingCents)}</b>. Você pode continuar comprando.</> : <>{bs.level === 'w90' ? '90%' : '80%'} do orçamento usado.</>}
            </div>
          )}
        </div>

        {purchase.items.length === 0 ? (
          <EmptyState icon="ScanBarcode" title="Carrinho vazio" text="Toque em Escanear e aponte para o código de barras ou para a etiqueta de preço." />
        ) : (
          <div>
            <AnimatePresence initial={false}>
              {purchase.items.map((it) => <CartRow key={it.id} item={it} onEdit={(i) => { setEditing(i); setDraft(editDraft(i)); setItemOpen(true) }} />)}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="capture-dock">
        <div className="inner" role="group" aria-label="Adicionar produto">
          <button className="dock-side" onClick={() => openManual()} aria-label="Digitar produto"><Icon name="Pencil" /><span>Digitar</span></button>
          <button className="dock-main" onClick={() => setCamera(true)} aria-label="Escanear produto"><Icon name="ScanBarcode" size={24} /> Escanear</button>
          <button className="dock-side" disabled={purchase.items.length === 0} onClick={() => setFinalize(true)} aria-label="Finalizar compra"><Icon name="Check" /><span>Finalizar</span></button>
        </div>
      </div>

      {camera && (
        <Suspense fallback={null}>
          <SmartCapture
            mode="cart"
            onAdd={handleAdd}
            onDetails={(d) => {
              setCamera(false)
              openManual({ name: d.name, brand: d.brand, barcode: d.barcode, category: d.category, priceCents: d.priceCents || undefined, priceUnit: d.priceUnit, qtyMilli: d.priceUnit === 'un' ? d.qty * 1000 : Math.round(d.qty * 1000), bundle: d.bundle, sizeText: d.size ? formatSizeText(d.size) : undefined, origin: d.origin, priceConfirmed: d.priceCents > 0, productSource: d.origin === 'ocr' ? 'ocr' : 'barcode' })
            }}
            onClose={() => setCamera(false)}
          />
        </Suspense>
      )}

      <ActionSheet open={menu} onClose={() => setMenu(false)} title="Compra" actions={actions} />
      <Sheet open={catOpen} onClose={() => setCatOpen(false)} title="Gastos por categoria">
        {cats.length ? <HBars items={cats} total={totals.subtotalCents} /> : <p className="muted small">Adicione produtos para ver os gastos por categoria.</p>}
      </Sheet>
      <Sheet open={listOpen} onClose={() => setListOpen(false)} title={`Lista: ${listName}`}>
        {pendingList.length === 0 ? <p className="muted small">Todos os itens da lista já estão no carrinho.</p> : (
          <div className="list">
            {pendingList.map((p) => (
              <button key={p.id} className="list-item list-btn" onClick={() => { setListOpen(false); openManual({ name: p.name, category: p.category, barcode: p.barcode, origin: 'list', qtyMilli: Math.max(1, p.quantity) * 1000 }) }}>
                <span className="grow">{p.name}{p.quantity > 1 ? ` ×${p.quantity}` : ''}</span><Icon name="Plus" size={18} />
              </button>
            ))}
          </div>
        )}
      </Sheet>

      <ItemSheet open={itemOpen} onClose={() => { setItemOpen(false); setEditing(null) }} draft={draft} mode={editing ? 'edit' : 'add'} onSubmit={submitItem} onRemove={editing ? () => { const it = editing; setItemOpen(false); setEditing(null); const r = removeCartItem(it.id); if (r) toast(`“${it.name}” removido`, 'info', { label: 'Desfazer', run: () => restoreCartItem(r.item, r.index) }) } : undefined} />
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
