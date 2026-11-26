import { useMemo, useRef, useState, Suspense, lazy } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Page } from '@/components/Page'
import { Badge, Button, Card, EmptyState, IconButton, MoneyInput, Progress, Segmented, SelectInput, TextArea, TextInput, Banner } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { Sheet, ConfirmDialog } from '@/components/Sheet'
import { Money } from '@/components/AnimatedNumber'
import { useAppState } from '@/store/store'
import { addList, addListProduct, deleteList, finalizeFromList, renameList, setActiveList, updateList } from '@/store/actions'
import { toast, setPendingStartList } from '@/store/ui'
import { CATEGORIES, categoryById } from '@/domain/categories'
import { compareMarkets } from '@/domain/compare'
import { formatBRL, parseMoney, centsFromDigits, formatDecimal } from '@/lib/money'
import { navigate, useRoute } from '@/router'
import { uid } from '@/lib/id'
import { parseSize } from '@/lib/units'
import { formatDate } from '@/lib/dates'
import { parseBackup, importLegacyListFile } from '@/storage/backup'
import { reloadFromDb } from '@/store/actions'
import type { ListData, ListProduct } from '@/domain/types'

const SmartCapture = lazy(() => import('@/components/SmartCapture'))
const ComparatorView = lazy(() => import('./more/Comparator'))

function ListsManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const lists = useAppState((s) => s.lists)
  const activeId = useAppState((s) => s.activeListId)
  const listData = useAppState((s) => s.listData)
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [newName, setNewName] = useState('')
  const [delId, setDelId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const active = lists.find((l) => l.id === activeId)

  const exportList = () => {
    const d = listData[activeId]
    if (!d || !active) return
    const blob = new Blob([JSON.stringify({ name: active.name, markets: d.markets, products: d.products, budget: d.budget, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `shopsmart-${active.name.toLowerCase().replace(/\s+/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const importFile = async (f: File) => {
    const r = parseBackup(await f.text())
    if (r.legacyList) {
      const meta = await importLegacyListFile(r.legacyList)
      await reloadFromDb()
      setActiveList(meta.id)
      toast(`Lista “${meta.name}” importada`, 'success')
    } else if (r.ok) toast('Esse arquivo é um backup completo. Use Mais › Backup e restauração.', 'info')
    else toast(r.error ?? 'Arquivo inválido', 'error')
  }
  return (
    <>
      <Sheet open={open} onClose={onClose} title="Minhas listas">
        <div className="stack">
          <div className="stack-s">
            {lists.map((l) => (
              <div key={l.id} className={`card flat tight row-s`} style={l.id === activeId ? { borderColor: 'var(--primary)', background: 'var(--primary-soft)' } : undefined}>
                {editing === l.id ? (
                  <>
                    <input className="input" autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (renameList(l.id, editName), setEditing(null))} aria-label="Novo nome da lista" />
                    <IconButton icon="Check" label="Salvar nome" onClick={() => { renameList(l.id, editName); setEditing(null) }} />
                  </>
                ) : (
                  <>
                    <button className="grow list-btn row-s" style={{ minHeight: 44 }} onClick={() => { setActiveList(l.id); onClose() }}>
                      <b className="ellipsis">{l.name}</b>
                      {l.id === activeId && <Icon name="Check" size={16} />}
                      <span className="xs muted">{(listData[l.id]?.products ?? []).length} itens</span>
                    </button>
                    <IconButton size="sm" icon="Pencil" label={`Renomear ${l.name}`} onClick={() => { setEditing(l.id); setEditName(l.name) }} />
                    {lists.length > 1 && <IconButton size="sm" icon="Trash2" label={`Excluir ${l.name}`} onClick={() => setDelId(l.id)} />}
                  </>
                )}
              </div>
            ))}
          </div>
          <form className="row-s" onSubmit={(e) => { e.preventDefault(); if (newName.trim()) { addList(newName); setNewName(''); onClose() } }}>
            <input className="input" placeholder="Nova lista (ex.: Churrasco de sábado)" value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="Nome da nova lista" />
            <Button variant="primary" icon="Plus" type="submit" aria-label="Criar lista" />
          </form>
          <div className="stack-s">
            <h3 className="section-title">Backup da lista atual</h3>
            <div className="grid-2">
              <Button icon="Download" onClick={exportList}>Exportar</Button>
              <Button icon="Upload" onClick={() => fileRef.current?.click()}>Importar</Button>
            </div>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = '' }} />
          </div>
        </div>
      </Sheet>
      <ConfirmDialog open={!!delId} danger title="Excluir lista?" message={`Excluir “${lists.find((l) => l.id === delId)?.name}” e todos os seus itens? Essa ação não pode ser desfeita (as compras já finalizadas continuam no histórico).`} confirmLabel="Excluir" onCancel={() => setDelId(null)} onConfirm={() => { if (delId) deleteList(delId); setDelId(null) }} />
    </>
  )
}

function ItemEditSheet({ listId, item, open, onClose }: { listId: string; item: ListProduct | null; open: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  const [cat, setCat] = useState('geral')
  const [note, setNote] = useState('')
  const [size, setSize] = useState('')
  const [lastId, setLastId] = useState('')
  if (item && open && lastId !== item.id) {
    setLastId(item.id)
    setName(item.name)
    setCat(item.category)
    setNote(item.note)
    setSize(item.packSize ? `${item.packSize.unit === 'un' ? item.packSize.milli / 1000 + ' un' : item.packSize.milli >= 1000 ? item.packSize.milli / 1000 + (item.packSize.unit === 'kg' ? ' kg' : ' L') : item.packSize.milli + (item.packSize.unit === 'kg' ? ' g' : ' ml')}` : '')
  }
  if (!open && lastId) setLastId('')
  return (
    <Sheet open={open} onClose={onClose} title="Editar item" footer={
      <Button variant="primary" block onClick={() => {
        if (!item || !name.trim()) return
        const packSize = size.trim() ? parseSize(size) ?? undefined : undefined
        updateList(listId, (d) => ({ ...d, products: d.products.map((p) => (p.id === item.id ? { ...p, name: name.trim(), category: cat, note, packSize } : p)) }))
        onClose()
      }}>Salvar</Button>
    }>
      <div className="stack">
        <TextInput label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
        <SelectInput label="Categoria" value={cat} onChange={(e) => setCat(e.target.value)}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</SelectInput>
        <TextInput label="Embalagem (opcional)" value={size} onChange={(e) => setSize(e.target.value)} placeholder="Ex.: 5 kg, 900 ml" hint="Permite comparar o preço por kg/L entre mercados." />
        <TextArea label="Observação" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Marca, tipo, detalhe…" />
        {item?.barcode && <p className="small muted">Código de barras: <span className="num">{item.barcode}</span></p>}
      </div>
    </Sheet>
  )
}

export default function Lists() {
  const lists = useAppState((s) => s.lists)
  const activeId = useAppState((s) => s.activeListId)
  const data = useAppState((s) => s.listData[s.activeListId]) as ListData | undefined
  const frequent = useAppState((s) => s.frequent)
  const purchases = useAppState((s) => s.purchases)
  const route = useRoute()
  const [view, setView] = useState<'list' | 'prices' | 'compare'>(route === '/listas/comparar' || route === '/mais/comparador' ? 'compare' : 'list')
  const [text, setText] = useState('')
  const [mgr, setMgr] = useState(false)
  const [hist, setHist] = useState(false)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [edit, setEdit] = useState<ListProduct | null>(null)
  const [scan, setScan] = useState(false)
  const [finOpen, setFinOpen] = useState(false)
  const [marketDel, setMarketDel] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const list = lists.find((l) => l.id === activeId)

  const cmp = useMemo(() => (data ? compareMarkets(data) : null), [data])
  const budgetCents = parseMoney(data?.budget) ?? 0
  const bestTotal = cmp?.winner?.totalCents ?? cmp?.cheapestPartial?.totalCents ?? 0
  const pct = budgetCents ? (bestTotal / budgetCents) * 100 : 0
  const sorted = useMemo(() => [...(data?.products ?? [])].sort((a, b) => (a.isEssential === b.isEssential ? 0 : a.isEssential ? -1 : 1)), [data?.products])
  const pending = sorted.filter((p) => !p.inCart)
  const inCart = sorted.filter((p) => p.inCart)
  const groups = useMemo(() => {
    const g = new Map<string, ListProduct[]>()
    for (const p of pending) {
      const id = categoryById(p.category).id
      g.set(id, [...(g.get(id) ?? []), p])
    }
    return CATEGORIES.map((c) => ({ c, items: g.get(c.id) ?? [] })).filter((x) => x.items.length)
  }, [pending])
  const suggestions = useMemo(() => {
    const names = new Set((data?.products ?? []).map((p) => p.name.trim().toLowerCase()))
    return Object.values(frequent).filter((f) => !names.has(f.name.trim().toLowerCase())).sort((a, b) => b.count - a.count).slice(0, 8)
  }, [frequent, data?.products])
  const listHistory = purchases.filter((p) => p.status === 'finalized' && p.listId === activeId).sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))

  if (!data || !list) return null
  const upd = (fn: (d: ListData) => ListData) => updateList(activeId, fn)
  const patch = (id: string, p: Partial<ListProduct>) => upd((d) => ({ ...d, products: d.products.map((x) => (x.id === id ? { ...x, ...p } : x)) }))

  const remove = (p: ListProduct) => {
    const idx = data.products.findIndex((x) => x.id === p.id)
    upd((d) => ({ ...d, products: d.products.filter((x) => x.id !== p.id) }))
    toast(`“${p.name}” removido`, 'info', { label: 'Desfazer', run: () => upd((d) => { const arr = [...d.products]; arr.splice(Math.min(idx, arr.length), 0, p); return { ...d, products: arr } }) })
  }

  const share = () => {
    let msg = '🛒 *Minha Lista de Compras - ShopSmart* 🛒\n\n'
    if (data.products.length) {
      msg += '*📝 Itens:*\n'
      for (const p of data.products) {
        msg += `- ${p.quantity}x ${p.name}`
        if (p.inCart) msg += ' ✅ (No Carrinho)'
        if (view === 'prices' && cmp?.winner) {
          const pr = p.prices[cmp.winner.market.id]
          if (pr) msg += ` (R$ ${pr})`
        }
        msg += '\n'
      }
      msg += '\n'
    } else msg += 'A lista está vazia.\n\n'
    if (cmp && cmp.results.some((r) => r.totalCents > 0)) {
      msg += '*💰 Resumo dos Valores:*\n'
      for (const r of cmp.results) msg += `${cmp.winner?.market.id === r.market.id ? '🏆 ' : '🏬 '}${r.market.name}: ${formatBRL(r.totalCents)}${r.complete ? '' : ' (faltam preços)'}\n`
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    addListProduct(activeId, text)
    setText('')
  }

  const onScanned = (p: { name: string; category: string; barcode: string; size?: { milli: number; unit: 'un' | 'kg' | 'l' } }) => {
    addListProduct(activeId, p.name, p.category, { barcode: p.barcode || undefined, packSize: p.size })
    toast(`“${p.name}” adicionado à lista`, 'success')
  }

  const finishFromList = (marketId: string) => {
    const p = finalizeFromList(activeId, marketId)
    setFinOpen(false)
    if (p) toast(`Compra de ${formatBRL(p.paidCents ?? 0)} registrada em Finanças`, 'success')
    else toast('Defina preços em algum mercado antes de concluir.', 'warn')
  }

  const addMarket = () => upd((d) => ({ ...d, markets: [...d.markets, { id: uid('m'), name: `Mercado ${String.fromCharCode(65 + d.markets.length)}`, discountPercent: '' }], products: d.products.map((p) => p) }))

  return (
    <Page
      title="Listas"
      subtitle={list.name}
      actions={
        <>
          <IconButton icon="History" label="Histórico da lista" onClick={() => setHist(true)} />
          <IconButton icon="Share2" label="Compartilhar" onClick={share} />
        </>
      }
    >
      <div className="row-s wrap">
        <button className="chip active" onClick={() => setMgr(true)}><Icon name="ListChecks" /> {list.name} <Icon name="ChevronDown" /></button>
        <div style={{ flex: 1, minWidth: 220 }}>
          <Segmented value={view} onChange={setView} label="Visualização" options={[{ value: 'list', label: 'Lista' }, { value: 'prices', label: 'Preços' }, { value: 'compare', label: 'Comparar' }]} />
        </div>
      </div>

      {view !== 'compare' && (
        <>
      <section className="hero" aria-label="Resumo da lista">
        <div className="row between">
          <div>
            <div className="label">Gasto estimado{cmp?.winner ? ` · ${cmp.winner.market.name}` : cmp?.cheapestPartial ? ` · ${cmp.cheapestPartial.market.name} (parcial)` : ''}</div>
            <div className="big"><Money cents={bestTotal} /></div>
          </div>
          <button className="btn sm" onClick={() => setBudgetOpen(true)}><Icon name="Target" /> {budgetCents ? formatBRL(budgetCents) : 'Orçamento'}</button>
        </div>
        {budgetCents > 0 && (
          <div style={{ marginTop: 12 }}>
            <Progress pct={pct} tone={pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : undefined} />
            <div className="xs" style={{ marginTop: 6, opacity: 0.9 }}>{Math.round(pct)}% do orçamento{budgetCents - bestTotal >= 0 ? ` · restam ${formatBRL(budgetCents - bestTotal)}` : ` · excedido em ${formatBRL(bestTotal - budgetCents)}`}</div>
          </div>
        )}
        {cmp && cmp.cheapestPartial && !cmp.winner && data.products.length > 0 && <div className="xs" style={{ marginTop: 8, opacity: 0.9 }}>Total parcial: há produtos sem preço nos mercados.</div>}
      </section>

      <form onSubmit={submitAdd} className="row-s">
        <input ref={inputRef} className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Adicionar item (ex.: Arroz 5 kg)" aria-label="Adicionar item à lista" enterKeyHint="done" />
        <IconButton icon="ScanBarcode" label="Adicionar por código de barras" onClick={() => setScan(true)} style={{ border: '1px solid var(--border-strong)', flex: 'none' }} />
        <Button variant="primary" type="submit" icon="Plus" aria-label="Adicionar" style={{ flex: 'none' }} />
      </form>
      {suggestions.length > 0 && (
        <div className="row-s" style={{ overflowX: 'auto', paddingBottom: 2 }} aria-label="Itens frequentes">
          {suggestions.map((s) => (
            <button key={s.name} className="chip" style={{ flex: 'none' }} onClick={() => addListProduct(activeId, s.name, s.category)}><Icon name="Plus" /> {s.name}</button>
          ))}
        </div>
      )}

        </>
      )}

      {view === 'list' ? (
        <>
          {data.products.length === 0 && <EmptyState icon="ListChecks" title="Sua lista está vazia" text="Adicione itens acima. Os que você usa com frequência aparecem como atalhos." />}
          {groups.map(({ c, items }) => {
            const open = !collapsed.has(c.id)
            return (
              <Card key={c.id} tight>
                <button className="row between list-btn" style={{ minHeight: 44 }} aria-expanded={open} onClick={() => setCollapsed((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n })}>
                  <span className="row-s"><span className="avatar primary" style={{ width: 32, height: 32, borderRadius: 10 }}><Icon name={c.icon} size={16} /></span><b>{c.label}</b><Badge>{items.length}</Badge></span>
                  <motion.span animate={{ rotate: open ? 0 : -90 }}><Icon name="ChevronDown" size={18} /></motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                      <div className="list">
                        <AnimatePresence initial={false}>
                          {items.map((p) => <ListRow key={p.id} p={p} onToggle={() => patch(p.id, { inCart: !p.inCart })} onStar={() => patch(p.id, { isEssential: !p.isEssential })} onQty={(d) => patch(p.id, { quantity: Math.max(1, p.quantity + d) })} onEdit={() => setEdit(p)} onRemove={() => remove(p)} />)}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            )
          })}
          {inCart.length > 0 && (
            <Card tight>
              <h3 className="section-title" style={{ margin: '4px 0' }}>No carrinho ({inCart.length})</h3>
              <div className="list">
                <AnimatePresence initial={false}>
                  {inCart.map((p) => <ListRow key={p.id} p={p} onToggle={() => patch(p.id, { inCart: !p.inCart })} onStar={() => patch(p.id, { isEssential: !p.isEssential })} onQty={(d) => patch(p.id, { quantity: Math.max(1, p.quantity + d) })} onEdit={() => setEdit(p)} onRemove={() => remove(p)} />)}
                </AnimatePresence>
              </div>
            </Card>
          )}
        </>
      ) : view === 'compare' ? (
        <Suspense fallback={null}><ComparatorView listId={activeId} /></Suspense>
      ) : (
        <PricesView data={data} listId={activeId} cmp={cmp!} onAddMarket={addMarket} onDeleteMarket={(id) => setMarketDel(id)} onCompare={() => setView('compare')} />
      )}

      {data.products.length > 0 && (
        <div className="grid-2">
          <Button variant="primary" icon="ShoppingCart" onClick={() => { setPendingStartList(activeId); navigate('/comprar') }}>Comprar com esta lista</Button>
          <Button icon="Check" onClick={() => setFinOpen(true)}>Concluir compra</Button>
        </div>
      )}

      <ListsManager open={mgr} onClose={() => setMgr(false)} />
      <ItemEditSheet listId={activeId} item={edit} open={!!edit} onClose={() => setEdit(null)} />
      <Suspense fallback={null}>{scan && <SmartCapture mode="list" onListProduct={onScanned} onClose={() => setScan(false)} />}</Suspense>

      <Sheet open={budgetOpen} onClose={() => setBudgetOpen(false)} title="Orçamento da lista">
        <BudgetEditor value={budgetCents} onSave={(c) => { upd((d) => ({ ...d, budget: c ? (c / 100).toFixed(2) : '0' })); setBudgetOpen(false) }} />
      </Sheet>

      <Sheet open={hist} onClose={() => setHist(false)} title="Histórico desta lista">
        {listHistory.length === 0 ? <EmptyState icon="History" title="Nenhuma compra finalizada" text="As compras feitas com esta lista aparecem aqui." /> : (
          <div className="list">
            {listHistory.map((p) => (
              <div key={p.id} className="list-item">
                <div className="grow"><div className="bold">{p.supermarketName}</div><div className="xs muted">{formatDate(p.finishedAt ?? p.startedAt)} · {p.items.length || '—'} itens</div></div>
                <b className="num">{formatBRL(p.paidCents ?? 0)}</b>
              </div>
            ))}
          </div>
        )}
        <p className="xs muted" style={{ marginTop: 8 }}>Para excluir compras, use Mais › Histórico de compras.</p>
      </Sheet>

      <Sheet open={finOpen} onClose={() => setFinOpen(false)} title="Concluir compra">
        <div className="stack-s">
          <p className="small muted">Registre esta lista como compra finalizada, usando os preços do mercado escolhido. Ela entra no controle financeiro.</p>
          {cmp?.results.map((r) => (
            <button key={r.market.id} className="card flat tight row between" disabled={r.pricedItems === 0} onClick={() => finishFromList(r.market.id)} style={{ textAlign: 'left', opacity: r.pricedItems === 0 ? 0.5 : 1 }}>
              <span><b>{r.market.name}</b>{cmp.winner?.market.id === r.market.id && <Badge tone="good"> melhor preço</Badge>}<br /><span className="xs muted">{r.pricedItems} de {data.products.length} itens com preço</span></span>
              <b className="num">{formatBRL(r.totalCents)}</b>
            </button>
          ))}
        </div>
      </Sheet>

      <ConfirmDialog open={!!marketDel} danger title="Remover mercado?" message="Os preços cadastrados para esse mercado nesta lista serão perdidos." confirmLabel="Remover" onCancel={() => setMarketDel(null)} onConfirm={() => { const id = marketDel!; upd((d) => ({ ...d, markets: d.markets.filter((m) => m.id !== id) })); setMarketDel(null) }} />
    </Page>
  )
}

function BudgetEditor({ value, onSave }: { value: number; onSave: (c: number) => void }) {
  const [v, setV] = useState(value)
  return (
    <div className="stack">
      <MoneyInput label="Orçamento" value={v} onChange={setV} autoFocus hint="Deixe 0,00 para não usar orçamento." />
      <Button variant="primary" block onClick={() => onSave(v)}>Salvar</Button>
    </div>
  )
}

function ListRow({ p, onToggle, onStar, onQty, onEdit, onRemove }: { p: ListProduct; onToggle: () => void; onStar: () => void; onQty: (d: number) => void; onEdit: () => void; onRemove: () => void }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ type: 'spring', stiffness: 420, damping: 36 }} className="list-item">
      <button onClick={onToggle} role="checkbox" aria-checked={p.inCart} aria-label={`${p.inCart ? 'Desmarcar' : 'Marcar'} ${p.name}`} style={{ width: 28, height: 28, borderRadius: 9, border: `2px solid ${p.inCart ? 'var(--primary)' : 'var(--border-strong)'}`, background: p.inCart ? 'var(--primary)' : 'transparent', display: 'grid', placeItems: 'center', color: '#fff', flex: 'none' }}>
        {p.inCart && <Icon name="Check" size={16} />}
      </button>
      <button className="grow list-btn" style={{ minWidth: 0 }} onClick={onEdit} aria-label={`Editar ${p.name}`}>
        <div className="bold ellipsis" style={p.inCart ? { textDecoration: 'line-through', opacity: 0.55 } : undefined}>{p.name}</div>
        {p.note && <div className="xs muted ellipsis">{p.note}</div>}
      </button>
      <IconButton size="sm" icon="Star" label={p.isEssential ? `Remover ${p.name} dos essenciais` : `Marcar ${p.name} como essencial`} onClick={onStar} style={p.isEssential ? { color: 'var(--warn)' } : undefined} aria-pressed={p.isEssential} />
      <div className="stepper">
        <button aria-label={`Diminuir ${p.name}`} onClick={() => onQty(-1)}><Icon name="Minus" /></button>
        <span className="q num">{p.quantity}</span>
        <button aria-label={`Aumentar ${p.name}`} onClick={() => onQty(1)}><Icon name="Plus" /></button>
      </div>
      <IconButton size="sm" icon="Trash2" label={`Remover ${p.name}`} onClick={onRemove} />
    </motion.div>
  )
}

function PricesView({ data, listId, cmp, onAddMarket, onDeleteMarket, onCompare }: { data: ListData; listId: string; cmp: NonNullable<ReturnType<typeof compareMarkets>>; onAddMarket: () => void; onDeleteMarket: (id: string) => void; onCompare: () => void }) {
  const upd = (fn: (d: ListData) => ListData) => updateList(listId, fn)
  const setMarket = (id: string, p: Partial<ListData['markets'][number]>) => upd((d) => ({ ...d, markets: d.markets.map((m) => (m.id === id ? { ...m, ...p } : m)) }))
  const setPrice = (pid: string, mid: string, v: string) => upd((d) => ({ ...d, products: d.products.map((p) => (p.id === pid ? { ...p, prices: { ...p.prices, [mid]: v } } : p)) }))
  return (
    <div className="stack">
      <Card>
        <div className="row between"><h2 style={{ fontSize: 16 }}>Mercados</h2><Button size="sm" icon="Plus" onClick={onAddMarket}>Adicionar</Button></div>
        <div className="stack-s" style={{ marginTop: 10 }}>
          {cmp.results.map((r) => (
            <div key={r.market.id} className="card flat tight stack-s" style={cmp.winner?.market.id === r.market.id ? { borderColor: 'var(--primary)' } : undefined}>
              <div className="row-s">
                <input className="input" value={r.market.name} aria-label="Nome do mercado" onChange={(e) => setMarket(r.market.id, { name: e.target.value })} />
                {data.markets.length > 1 && <IconButton size="sm" icon="Trash2" label={`Remover ${r.market.name}`} onClick={() => onDeleteMarket(r.market.id)} />}
              </div>
              <div className="grid-2">
                <div className="field"><label className="xs">Desconto %</label><input className="input" inputMode="decimal" placeholder="0" value={r.market.discountPercent} onChange={(e) => setMarket(r.market.id, { discountPercent: e.target.value.replace(/[^\d.,]/g, '') })} /></div>
                <div className="field"><label className="xs">Deslocamento (R$)</label><input className="input num" inputMode="numeric" placeholder="0,00" value={r.market.travelCostCents ? formatDecimal(r.market.travelCostCents) : ''} onChange={(e) => setMarket(r.market.id, { travelCostCents: centsFromDigits(e.target.value) || undefined })} /></div>
              </div>
              <div className="row between small">
                <span className="muted">{r.pricedItems}/{data.products.length} itens com preço{r.discountCents ? ` · desc. ${formatBRL(r.discountCents)}` : ''}</span>
                <b className="num">{formatBRL(r.totalCents)}</b>
              </div>
            </div>
          ))}
        </div>
        {cmp.winner && <Banner tone="good">Melhor preço: <b>{cmp.winner.market.name}</b> ({formatBRL(cmp.winner.totalCents)}).{' '}<button className="small" style={{ textDecoration: 'underline' }} onClick={onCompare}>Ver comparação completa</button></Banner>}
      </Card>

      {data.products.length === 0 ? <EmptyState icon="Tag" title="Sem itens para precificar" text="Adicione itens na aba Lista e volte aqui para informar os preços em cada mercado." /> : (
        <Card>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Preços por item</h2>
          <div className="stack">
            {data.products.map((p) => {
              const best = cmp.bestProducts.find((b) => b.product.id === p.id)
              return (
                <div key={p.id} className="stack-s">
                  <div className="row between"><b className="ellipsis">{p.name}</b><span className="xs muted">{p.quantity}×</span></div>
                  <div className="grid-2">
                    {data.markets.map((m) => {
                      const v = p.prices[m.id] ?? ''
                      const isBest = best?.bestMarketId === m.id && best.pricedIn > 1
                      return (
                        <div className="field" key={m.id}>
                          <label className="xs ellipsis">{m.name}{isBest ? ' · menor' : ''}</label>
                          <div className="input-affix">
                            <span className="affix">R$</span>
                            <input className="input num" inputMode="decimal" placeholder="0,00" value={v.replace('.', ',')} aria-label={`${p.name} em ${m.name}`} style={isBest ? { borderColor: 'var(--primary)', background: 'var(--primary-soft)' } : undefined}
                              onChange={(e) => setPrice(p.id, m.id, e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
