import { useMemo, useState } from 'react'
import { LineChart } from './Charts'
import { Segmented } from './ui'
import { useAppState } from '@/store/store'
import { latestBySupermarket, priceStats, recordsFor } from '@/domain/prices'
import { formatBRL } from '@/lib/money'
import { ageLabel, formatDate } from '@/lib/dates'
import type { PriceUnit } from '@/lib/units'

const UNIT: Record<PriceUnit, string> = { un: 'unidade', kg: 'kg', l: 'litro' }

/** Histórico de preços de UM produto (preço, mercado, data) — mostrado nos detalhes do produto. */
export default function PriceHistoryPanel({ productId }: { productId: string }) {
  const prices = useAppState((s) => s.prices)
  const [unit, setUnit] = useState<PriceUnit | null>(null)
  const units = useMemo(() => [...new Set(prices.filter((r) => r.productId === productId).map((r) => r.priceUnit))], [prices, productId])
  const u = unit && units.includes(unit) ? unit : units[0]
  const recs = useMemo(() => (u ? recordsFor(prices, productId, u) : []), [prices, productId, u])
  const st = priceStats(recs)
  const bySm = useMemo(() => latestBySupermarket(recs), [recs])

  if (!recs.length) return <p className="small muted">Ainda não há preços registrados para este produto. Eles aparecem aqui depois que você finaliza compras com ele.</p>

  return (
    <div className="stack">
      {units.length > 1 && <Segmented value={u!} onChange={setUnit} options={units.map((x) => ({ value: x, label: `Por ${UNIT[x]}` }))} label="Unidade de preço" />}
      <div className="stats">
        <div><span className="l">Último</span><b className="num">{formatBRL(st.last!.unitPriceCents)}</b><span className="xs muted">{formatDate(st.last!.date)} · {ageLabel(st.last!.date)}</span></div>
        <div><span className="l">Menor</span><b className="num" style={{ color: 'var(--primary-soft-text)' }}>{formatBRL(st.lowest!.unitPriceCents)}</b><span className="xs muted">{formatDate(st.lowest!.date)}</span></div>
        <div><span className="l">Maior</span><b className="num">{formatBRL(st.highest!.unitPriceCents)}</b><span className="xs muted">{formatDate(st.highest!.date)}</span></div>
        <div><span className="l">Média</span><b className="num">{formatBRL(st.avgCents)}</b><span className="xs muted">{st.changePct === null ? `${st.count} registro` : `${st.changePct > 0 ? '+' : ''}${st.changePct.toFixed(1).replace('.', ',')}% vs. anterior`}</span></div>
      </div>
      <LineChart data={[...recs].reverse().map((r) => ({ key: r.id, label: new Date(r.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }), value: r.unitPriceCents, note: r.supermarketName }))} ariaLabel="Evolução do preço" />
      {bySm.length > 1 && (
        <div>
          <h3 className="section-title">Por mercado (último preço — confira a data)</h3>
          <div className="list">
            {bySm.map((r, i) => (
              <div key={r.id} className="list-item" style={{ minHeight: 44 }}>
                <div className="grow"><div className="bold">{r.supermarketName}{i === 0 ? ' · menor' : ''}</div><div className="xs muted">{formatDate(r.date)} · {ageLabel(r.date)}{r.city ? ` · ${r.city}` : ''}</div></div>
                <b className="num">{formatBRL(r.unitPriceCents)}</b>
              </div>
            ))}
          </div>
        </div>
      )}
      <details>
        <summary className="small bold" style={{ cursor: 'pointer', minHeight: 36 }}>Todos os registros ({recs.length})</summary>
        <div className="list">
          {recs.map((r) => (
            <div key={r.id} className="list-item" style={{ minHeight: 44 }}>
              <div className="grow small">{formatDate(r.date)} · {r.supermarketName}{r.promo ? ' · promoção' : ''}</div>
              <b className="num">{formatBRL(r.unitPriceCents)}</b>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
