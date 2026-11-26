import { useEffect, useMemo, useState } from 'react'
import { Page } from '@/components/Page'
import PriceHistoryPanel from '@/components/PriceHistoryPanel'
import { Badge, Banner, Button, Card, EmptyState, IconButton, SelectInput, TextInput } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { Sheet, ConfirmDialog } from '@/components/Sheet'
import { useAppState } from '@/store/store'
import { editProduct, learnProduct, removeProduct } from '@/store/actions'
import { searchProducts } from '@/domain/catalog'
import { CATEGORIES, categoryById } from '@/domain/categories'
import { normalizeBarcode } from '@/lib/barcode'
import { toast } from '@/store/ui'
import { formatDate } from '@/lib/dates'
import { defaultDeps, loadManifest, type CatalogManifest } from '@/services/lookup'
import type { Product } from '@/domain/types'

const SRC: Record<string, string> = { manual: 'Manual', ocr: 'Etiqueta', barcode: 'Código de barras', personal: 'Seu catálogo', catalog: 'Catálogo ShopSmart', off: 'Open Food Facts', obf: 'Open Beauty Facts', opf: 'Open Products Facts', migrated: 'Importado da v1', list: 'Lista' }

function sizeText(p: Product): string {
  if (!p.size) return ''
  const { milli, unit } = p.size
  if (unit === 'un') return `${milli / 1000} un`
  return milli >= 1000 ? `${milli / 1000} ${unit === 'kg' ? 'kg' : 'L'}` : `${milli} ${unit === 'kg' ? 'g' : 'mL'}`
}

export default function Catalog() {
  const products = useAppState((s) => s.products)
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Product | null>(null)
  const [add, setAdd] = useState(false)
  const [del, setDel] = useState<Product | null>(null)
  const [manifest, setManifest] = useState<CatalogManifest | null | undefined>(undefined)
  const results = useMemo(() => searchProducts(products, q, 100), [products, q])

  useEffect(() => {
    let alive = true
    loadManifest(defaultDeps()).then((m) => alive && setManifest(m)).catch(() => alive && setManifest(null))
    return () => { alive = false }
  }, [])

  return (
    <Page title="Catálogo de produtos" subtitle={`${products.length} no seu aparelho`} backTo="/" actions={<IconButton icon="Plus" label="Cadastrar produto" onClick={() => setAdd(true)} />}>
      <div className="input-affix"><span className="affix"><Icon name="Search" size={18} /></span><input className="input" type="search" placeholder="Nome, marca, categoria ou código" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar produtos" /></div>
      {results.length === 0 ? (
        <EmptyState icon="Package" title={q ? 'Nada encontrado' : 'Catálogo vazio'} text={q ? 'Tente outro termo ou cadastre o produto.' : 'Os produtos que você comprar, escanear ou fotografar são salvos aqui e reconhecidos nas próximas vezes — até sem internet.'} action={<Button onClick={() => setAdd(true)} icon="Plus">Cadastrar produto</Button>} />
      ) : (
        <Card tight>
          <div className="list">
            {results.map((p) => (
              <button key={p.id} className="list-item list-btn" onClick={() => setEdit(p)}>
                <span className="avatar"><Icon name={categoryById(p.category).icon} /></span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="bold ellipsis" style={{ display: 'block' }}>{p.name}</span>
                  <span className="xs muted ellipsis" style={{ display: 'block' }}>{[p.brand, sizeText(p), categoryById(p.category).label].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="stack-s" style={{ alignItems: 'flex-end', gap: 2 }}>
                  {p.purchaseCount > 0 && <Badge>{p.purchaseCount}×</Badge>}
                  {p.userEdited && Object.values(p.userEdited).some(Boolean) && <Badge tone="info" icon="Pencil">seu ajuste</Badge>}
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 style={{ fontSize: 16, marginBottom: 6 }}>Catálogo automatizado ShopSmart</h2>
        {manifest === undefined ? <p className="small muted">Verificando…</p> : manifest ? (
          <div className="stack-s small">
            <div className="row between"><span className="muted">Versão</span><b>{manifest.version}</b></div>
            <div className="row between"><span className="muted">Produtos</span><b className="num">{manifest.total.toLocaleString('pt-BR')}</b></div>
            <div className="row between"><span className="muted">Atualizado em</span><b>{formatDate(manifest.generatedAt)}</b></div>
            <p className="xs muted">Fontes: {manifest.sources.map((s) => `${s.name} (${s.license})`).join('; ')}. Dados sob licença ODbL, com atribuição às fontes.</p>
          </div>
        ) : <p className="small muted">O catálogo automatizado ainda não foi publicado ou está indisponível. O app consulta bases públicas diretamente quando há internet.</p>}
      </Card>

      <EditSheet product={edit} onClose={() => setEdit(null)} onDelete={(p) => setDel(p)} />
      <AddSheet open={add} onClose={() => setAdd(false)} />
      <ConfirmDialog open={!!del} danger title="Excluir produto?" message={`“${del?.name}” será removido do catálogo pessoal. O histórico de preços e as compras já registradas permanecem.`} confirmLabel="Excluir" onCancel={() => setDel(null)} onConfirm={() => { if (del) removeProduct(del.id); setDel(null); setEdit(null) }} />
    </Page>
  )
}

function EditSheet({ product, onClose, onDelete }: { product: Product | null; onClose: () => void; onDelete: (p: Product) => void }) {
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [cat, setCat] = useState('geral')
  useEffect(() => { if (product) { setName(product.name); setBrand(product.brand ?? ''); setCat(product.category) } }, [product])
  return (
    <Sheet open={!!product} onClose={onClose} title="Produto" footer={<><Button variant="ghost" icon="Trash2" onClick={() => product && onDelete(product)}>Excluir</Button><Button variant="primary" className="grow" onClick={() => { if (product && name.trim()) { editProduct(product.id, { name, brand, category: cat }); toast('Produto atualizado. Sua correção é preservada.', 'success'); onClose() } }}>Salvar</Button></>}>
      {product && (
        <div className="stack">
          <TextInput label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
          <TextInput label="Marca" value={brand} onChange={(e) => setBrand(e.target.value)} />
          <SelectInput label="Categoria" value={cat} onChange={(e) => setCat(e.target.value)}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</SelectInput>
          <div><h3 className="section-title" style={{ margin: '0 0 8px' }}>Histórico de preços</h3><PriceHistoryPanel productId={product.id} /></div>
          <Banner tone="info">Suas correções de nome, marca e categoria nunca são sobrescritas por atualizações automáticas do catálogo.</Banner>
          <div className="small muted stack-s">
            {product.barcode && <div>Código de barras: <b className="num">{product.barcode}</b></div>}
            {sizeText(product) && <div>Embalagem: {sizeText(product)}</div>}
            <div>Origem: {SRC[product.source] ?? product.source}</div>
            <div>Primeiro registro: {formatDate(new Date(product.firstSeenAt).toISOString())}</div>
            {product.lastPurchasedAt && <div>Última compra: {formatDate(new Date(product.lastPurchasedAt).toISOString())} · {product.purchaseCount} compra(s)</div>}
          </div>
        </div>
      )}
    </Sheet>
  )
}

function AddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [cat, setCat] = useState('geral')
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => { if (open) { setName(''); setBrand(''); setCat('geral'); setCode(''); setErr('') } }, [open])
  const save = () => {
    if (!name.trim()) return setErr('Informe o nome.')
    let barcode: string | undefined
    if (code.trim()) {
      const n = normalizeBarcode(code)
      if (!n) return setErr('Código de barras inválido.')
      barcode = n
    }
    learnProduct({ name, brand, category: cat, barcode, source: 'manual' })
    toast('Produto cadastrado', 'success')
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title="Cadastrar produto" footer={<Button variant="primary" block onClick={save}>Salvar</Button>}>
      <div className="stack">
        <TextInput label="Nome" value={name} onChange={(e) => { setName(e.target.value); setErr('') }} error={err && !name.trim() ? err : undefined} autoFocus />
        <TextInput label="Marca (opcional)" value={brand} onChange={(e) => setBrand(e.target.value)} />
        <SelectInput label="Categoria" value={cat} onChange={(e) => setCat(e.target.value)}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</SelectInput>
        <TextInput label="Código de barras (opcional)" inputMode="numeric" value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setErr('') }} error={err && name.trim() ? err : undefined} />
      </div>
    </Sheet>
  )
}
