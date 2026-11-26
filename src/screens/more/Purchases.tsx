import { useMemo, useState } from 'react'
import { Badge, Button, Card, EmptyState, Segmented } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { Sheet, ConfirmDialog } from '@/components/Sheet'
import { useAppState } from '@/store/store'
import { deletePurchase } from '@/store/actions'
import { formatBRL } from '@/lib/money'
import { formatDate, formatDateTime } from '@/lib/dates'
import { formatQty } from '@/lib/units'
import { lineTotal } from '@/domain/cart'
import { purchasesToCsv } from '@/storage/backup'
import { downloadText } from '@/lib/download'
import { toast } from '@/store/ui'
import type { Purchase } from '@/domain/types'

export default function PurchasesView() {
  const purchases = useAppState((s) => s.purchases)
  const [tab, setTab] = useState<'finalized' | 'cancelled'>('finalized')
  const [sel, setSel] = useState<Purchase | null>(null)
  const [del, setDel] = useState<Purchase | null>(null)
  const list = useMemo(() => purchases.filter((p) => p.status === tab).sort((a, b) => (b.finishedAt ?? b.cancelledAt ?? b.startedAt).localeCompare(a.finishedAt ?? a.cancelledAt ?? a.startedAt)), [purchases, tab])
  const active = purchases.find((p) => p.status === 'active')
  return (
    <div className="stack">
      <Segmented value={tab} onChange={setTab} label="Status" options={[{ value: 'finalized', label: 'Finalizadas' }, { value: 'cancelled', label: 'Canceladas' }]} />
      {active && <Card tight><div className="row between"><span className="small"><Badge tone="warn">em andamento</Badge> {active.supermarketName}</span><span className="xs muted">continue na aba Compra</span></div></Card>}
      {list.length === 0 ? <EmptyState icon="Receipt" title={tab === 'finalized' ? 'Nenhuma compra finalizada' : 'Nenhuma compra cancelada'} text={tab === 'finalized' ? 'Finalize uma compra para vê-la aqui.' : 'Compras canceladas não contam como despesa.'} /> : (
        <Card tight>
          <div className="list">
            {list.map((p) => (
              <button key={p.id} className="list-item list-btn" onClick={() => setSel(p)}>
                <span className="avatar"><Icon name="Store" /></span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="bold ellipsis" style={{ display: 'block' }}>{p.supermarketName}{p.city ? ` · ${p.city}` : ''}</span>
                  <span className="xs muted">{formatDate(p.finishedAt ?? p.cancelledAt ?? p.startedAt)} · {p.items.length ? `${p.items.length} itens` : p.legacy ? 'importada da v1' : 'vazia'}</span>
                </span>
                <b className="num" style={tab === 'cancelled' ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}>{formatBRL(p.paidCents ?? p.items.reduce((s, i) => s + lineTotal(i), 0))}</b>
              </button>
            ))}
          </div>
        </Card>
      )}
      <div className="row" style={{ justifyContent: 'flex-end' }}><Button size="sm" variant="ghost" icon="Download" onClick={() => { downloadText(`shopsmart-compras-${new Date().toISOString().slice(0, 10)}.csv`, purchasesToCsv(purchases), 'text/csv;charset=utf-8'); toast('CSV exportado', 'success') }}>Exportar CSV</Button></div>
      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel?.supermarketName ?? ''} footer={<Button variant="ghost" icon="Trash2" onClick={() => sel && setDel(sel)}>Excluir</Button>}>
        {sel && (
          <div className="stack">
            <div className="small muted">{formatDateTime(sel.finishedAt ?? sel.startedAt)}{sel.city ? ` · ${sel.city}` : ''}{sel.paymentMethod ? ` · ${sel.paymentMethod}` : ''}</div>
            {sel.status === 'finalized' && (
              <div className="card flat tight stack-s">
                <div className="row between small"><span className="muted">Estimado</span><span className="num">{formatBRL(sel.estimatedCents ?? sel.paidCents ?? 0)}</span></div>
                {!!sel.checkoutDiscountCents && <div className="row between small"><span className="muted">Desconto no caixa</span><span className="num">−{formatBRL(sel.checkoutDiscountCents)}</span></div>}
                <div className="row between bold"><span>Pago</span><span className="num">{formatBRL(sel.paidCents ?? 0)}</span></div>
              </div>
            )}
            {sel.note && <p className="small">{sel.note}</p>}
            {sel.items.length > 0 ? (
              <div className="list">{sel.items.map((i) => <div key={i.id} className="list-item" style={{ minHeight: 44 }}><span className="grow ellipsis">{i.name}</span><span className="xs muted">{formatQty(i.qtyMilli, i.priceUnit)}</span><b className="num">{formatBRL(lineTotal(i))}</b></div>)}</div>
            ) : <p className="small muted">Esta compra não tem produtos detalhados.</p>}
          </div>
        )}
      </Sheet>
      <ConfirmDialog open={!!del} danger title="Excluir compra?" message="A compra e os preços que ela gerou no histórico serão removidos. Essa ação não pode ser desfeita." confirmLabel="Excluir" onCancel={() => setDel(null)} onConfirm={() => { if (del) deletePurchase(del.id); setDel(null); setSel(null); toast('Compra excluída', 'info') }} />
    </div>
  )
}
