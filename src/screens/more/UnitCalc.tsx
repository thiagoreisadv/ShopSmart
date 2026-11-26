import { useMemo } from 'react'
import { Page } from '@/components/Page'
import { Badge, Banner, Button, Card, IconButton } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { formatBRL } from '@/lib/money'

/** Formato idêntico ao da v1 (chave shopsmart_calc): price/quantity em texto, unit em g|kg|ml|L|un. */
interface Option {
  id: string
  name: string
  price: string
  quantity: string
  unit: 'g' | 'kg' | 'ml' | 'L' | 'un'
}
const DEFAULTS: Option[] = [
  { id: '1', name: 'Marca A', price: '', quantity: '', unit: 'g' },
  { id: '2', name: 'Marca B', price: '', quantity: '', unit: 'g' },
]
const family = (u: Option['unit']) => (u === 'g' || u === 'kg' ? 'massa' : u === 'ml' || u === 'L' ? 'volume' : 'unidade')
const num = (s: string) => parseFloat(s.replace(',', '.'))

export default function UnitCalc() {
  const [opts, setOpts] = useLocalStorage<Option[]>('shopsmart_calc', DEFAULTS)
  const rows = useMemo(
    () =>
      opts.map((o) => {
        const price = num(o.price)
        const qty = num(o.quantity)
        const errPrice = o.price !== '' && !(price > 0)
        const errQty = o.quantity !== '' && !(qty > 0)
        if (!(price > 0) || !(qty > 0)) return { o, per: null as number | null, errPrice, errQty }
        // g/ml → por kg/L (×1000), kg/L/un → direto. Mesmo cálculo da v1.
        const mult = o.unit === 'g' || o.unit === 'ml' ? 1000 : 1
        return { o, per: (price / qty) * mult, errPrice, errQty }
      }),
    [opts],
  )
  const fams = new Set(rows.filter((r) => r.per !== null).map((r) => family(r.o.unit)))
  const mixed = fams.size > 1
  const valid = rows.filter((r) => r.per !== null)
  const best = !mixed && valid.length > 1 ? valid.reduce((a, b) => (b.per! < a.per! ? b : a)) : null
  const set = (id: string, p: Partial<Option>) => setOpts(opts.map((o) => (o.id === id ? { ...o, ...p } : o)))
  const unitLabel = (u: Option['unit']) => (u === 'un' ? 'unidade' : u === 'g' || u === 'kg' ? 'kg' : 'litro')

  return (
    <Page title="Preço por unidade" subtitle="Descubra qual embalagem compensa mais" backTo="/">
      <div className="stack">
        {rows.map(({ o, per, errPrice, errQty }, idx) => {
          const isBest = best?.o.id === o.id
          const worst = !mixed && valid.length > 1 ? Math.max(...valid.map((v) => v.per!)) : null
          const extra = isBest && worst ? ((worst - per!) / worst) * 100 : null
          return (
            <Card key={o.id} className={isBest ? 'best' : ''}>
              <div style={isBest ? { outline: '2px solid var(--primary)', outlineOffset: 8, borderRadius: 14 } : undefined}>
                <div className="row-s">
                  <input className="input" style={{ fontWeight: 600 }} value={o.name} aria-label={`Nome da opção ${idx + 1}`} onChange={(e) => set(o.id, { name: e.target.value })} />
                  {opts.length > 2 && <IconButton icon="Trash2" label={`Remover ${o.name}`} onClick={() => setOpts(opts.filter((x) => x.id !== o.id))} />}
                </div>
                <div className="grid-2" style={{ marginTop: 10 }}>
                  <div className="field">
                    <label className="xs" htmlFor={`p${o.id}`}>Preço</label>
                    <div className="input-affix"><span className="affix">R$</span><input id={`p${o.id}`} className="input num" inputMode="decimal" placeholder="0,00" value={o.price} aria-invalid={errPrice || undefined} onChange={(e) => set(o.id, { price: e.target.value.replace(/[^\d.,]/g, '') })} /></div>
                    {errPrice && <span className="error-text">Informe um valor maior que zero.</span>}
                  </div>
                  <div className="field">
                    <label className="xs" htmlFor={`q${o.id}`}>Quantidade</label>
                    <div className="row-s">
                      <input id={`q${o.id}`} className="input num" inputMode="decimal" placeholder="0" value={o.quantity} aria-invalid={errQty || undefined} onChange={(e) => set(o.id, { quantity: e.target.value.replace(/[^\d.,]/g, '') })} />
                      <select className="select" style={{ width: 82, flex: 'none' }} value={o.unit} aria-label="Unidade" onChange={(e) => set(o.id, { unit: e.target.value as Option['unit'] })}>
                        <option value="g">g</option><option value="kg">kg</option><option value="ml">mL</option><option value="L">L</option><option value="un">un</option>
                      </select>
                    </div>
                    {errQty && <span className="error-text">Informe uma quantidade maior que zero.</span>}
                  </div>
                </div>
                {per !== null && (
                  <div className="row between" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                    <div><div className="xs muted">Custo por {unitLabel(o.unit)}</div><div className="bold num" style={{ fontSize: 22, color: isBest ? 'var(--primary)' : undefined }}>{formatBRL(Math.round(per * 100))}</div></div>
                    {isBest && <div className="stack-s" style={{ alignItems: 'flex-end', gap: 2 }}><Badge tone="good" icon="Star">Mais econômico</Badge>{extra !== null && extra > 0 && <span className="xs muted">{Math.round(extra)}% mais barato que o mais caro</span>}</div>}
                  </div>
                )}
              </div>
            </Card>
          )
        })}
        {mixed && <Banner tone="warn">As opções usam tipos de medida diferentes (peso, volume ou unidade). Para comparar, use a mesma família de unidade.</Banner>}
        {valid.length < 2 && <Banner tone="info" icon="Scale">Preencha preço e quantidade de pelo menos duas opções para comparar.</Banner>}
        <div className="grid-2">
          <Button icon="Plus" onClick={() => setOpts([...opts, { id: String(Date.now()), name: `Marca ${String.fromCharCode(65 + opts.length)}`, price: '', quantity: '', unit: opts[0]?.unit ?? 'g' }])}>Adicionar opção</Button>
          <Button variant="ghost" icon="Undo2" onClick={() => setOpts(DEFAULTS)}>Limpar</Button>
        </div>
        <p className="xs muted"><Icon name="Info" size={12} /> Os valores são normalizados por kg, litro ou unidade. Embalagens em g/mL são convertidas.</p>
      </div>
    </Page>
  )
}
