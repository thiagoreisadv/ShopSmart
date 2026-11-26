import { useMemo, useState } from 'react'
import { Page } from '@/components/Page'
import { Badge, Card, EmptyState, Segmented } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { LineChart } from '@/components/Charts'
import { useAppState } from '@/store/store'
import { recordsFor, priceStats, latestBySupermarket } from '@/domain/prices'
import { searchProducts } from '@/domain/catalog'
import { formatBRL } from '@/lib/money'
import { ageLabel, formatDate } from '@/lib/dates'
import type { PriceUnit } from '@/lib/units'

const UNIT: Record<PriceUnit, string> = { un: 'unidade', kg: 'kg', l: 'litro' }

export default function PriceHistory() {
  const products = useAppState((s) => s.products)
  const prices = useAppState((s) => s.prices)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<string | null>(null)
  const [unit, setUnit] = useState<PriceUnit | null>(null)
  const withPrices = useMemo(() => {
    const ids = new Set(prices.map((p) => p.productId))
    return products.filter((p) => ids.has(p.id))
  }, [products, prices])
  const results = useMemo(() => searchProducts(withPrices, q, 30), [withPrices, q])
  const product = withPrices.find((p) => p.id === sel)
  const units = useMemo(() => (product ? [...new Set(prices.filter((r) => r.productId === product.id).map((r) => r.priceUnit))] : []), [prices, product])
  const u = unit && units.includes(unit) ? unit : units[0]
  const recs = useMemo(() => (product && u ? recordsFor(prices, product.id, u) : []), [prices, product, u])
  const st = priceStats(recs)
  const bySm = useMemo(() => latestBySupermarket(recs), [recs])

  return (
    <Page title="Histórico de preços" subtitle="Por produto, mercado e data" backTo="/mais">
      {!product ? (
        <>
          <div className="input-affix"><span className="affix"><Icon name="Search" size={18} /></span><input className="input" type="search" placeholder="Buscar produto" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar produto" /></div>
          {withPrices.length === 0 ? <EmptyState icon="ChartLine" title="Sem histórico ainda" text="O histórico de preços é montado a partir das compras que você finaliza. Cada produto guarda preço, mercado, cidade e data." /> : (
            <Card tight>
              <div className="list">
                {results.map((p) => {
                  const s = priceStats(recordsFor(prices, p.id))
                  return (
                    <button key={p.id} className="list-item list-btn" onClick={() => { setSel(p.id); setUnit(null) }}>
                      <span className="grow" style={{ minWidth: 0 }}><span className="bold ellipsis" style={{ display: 'block' }}>{p.name}</span><span className="xs muted">{s.count} registro(s) · último {s.last && ageLabel(s.last.date)}</span></span>
                      <b className="num">{s.last && formatBRL(s.last.unitPriceCents)}</b>
                    </button>
                  )
                })}
              </div>
            </Card>
          )}
        </>
      ) : (
        <>
          <button className="chip" style={{ alignSelf: 'flex-start' }} onClick={() => setSel(null)}><Icon name="ChevronLeft" /> Outros produtos</button>
          <div><h2 style={{ fontSize: 18 }}>{product.name}</h2><p className="small muted">{[product.brand, product.barcode].filter(Boolean).join(' · ')}</p></div>
          {units.length > 1 && <Segmented value={u!} onChange={setUnit} options={units.map((x) => ({ value: x, label: `Por ${UNIT[x]}` }))} label="Unidade de preço" />}
          <div className="grid-2">
            <Card tight><div className="kpi"><span className="l">Último preço</span><span className="v num">{st.last ? formatBRL(st.last.unitPriceCents) : '—'}</span><span className="xs muted">{st.last && `${formatDate(st.last.date)} · ${ageLabel(st.last.date)}`}</span></div></Card>
            <Card tight><div className="kpi"><span className="l">Variação</span><span className="v num" style={{ color: st.changePct === null ? undefined : st.changePct > 0 ? 'var(--danger)' : 'var(--primary)' }}>{st.changePct === null ? '—' : `${st.changePct > 0 ? '+' : ''}${st.changePct.toFixed(1).replace('.', ',')}%`}</span><span className="xs muted">vs. registro anterior</span></div></Card>
            <Card tight><div className="kpi"><span className="l">Menor</span><span className="v num" style={{ color: 'var(--primary)' }}>{st.lowest ? formatBRL(st.lowest.unitPriceCents) : '—'}</span><span className="xs muted">{st.lowest && `${formatDate(st.lowest.date)} · ${st.lowest.supermarketName}`}</span></div></Card>
            <Card tight><div className="kpi"><span className="l">Maior</span><span className="v num">{st.highest ? formatBRL(st.highest.unitPriceCents) : '—'}</span><span className="xs muted">{st.highest && `${formatDate(st.highest.date)} · ${st.highest.supermarketName}`}</span></div></Card>
          </div>
          <Card tight><div className="row between"><span className="small muted">Preço médio ({st.count} registros)</span><b className="num">{formatBRL(st.avgCents)}</b></div></Card>
          {recs.length > 0 && (
            <Card>
              <h2 style={{ fontSize: 16, marginBottom: 8 }}>Evolução</h2>
              <LineChart data={[...recs].reverse().map((r) => ({ key: r.id, label: new Date(r.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }), value: r.unitPriceCents, note: r.supermarketName }))} ariaLabel={`Evolução do preço de ${product.name}`} />
            </Card>
          )}
          {bySm.length > 1 && (
            <Card>
              <h2 style={{ fontSize: 16, marginBottom: 8 }}>Comparação entre mercados</h2>
              <p className="xs muted" style={{ marginBottom: 8 }}>Último preço pago em cada lugar — confira a data de cada um.</p>
              <div className="list">
                {bySm.map((r, i) => (
                  <div key={r.id} className="list-item">
                    <div className="grow"><div className="bold">{r.supermarketName}{i === 0 && <> <Badge tone="good">menor</Badge></>}</div><div className="xs muted">{formatDate(r.date)} · {ageLabel(r.date)}{r.city ? ` · ${r.city}` : ''}</div></div>
                    <b className="num">{formatBRL(r.unitPriceCents)}</b>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Card>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>Todos os registros</h2>
            <div className="list">
              {recs.map((r) => (
                <div key={r.id} className="list-item" style={{ minHeight: 48 }}>
                  <div className="grow"><div className="small">{formatDate(r.date)} · {r.supermarketName}</div><div className="xs muted">{r.city ?? ''}{r.promo ? ' · promoção' : ''}</div></div>
                  <b className="num">{formatBRL(r.unitPriceCents)}</b>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </Page>
  )
}
