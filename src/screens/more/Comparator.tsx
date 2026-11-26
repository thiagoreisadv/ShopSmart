import { useMemo } from 'react'
import { Badge, Banner, Button, Card, EmptyState } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { useAppState } from '@/store/store'
import { compareMarkets } from '@/domain/compare'
import { formatBRL } from '@/lib/money'
import { navigate } from '@/router'
import { updateList } from '@/store/actions'
import { centsFromDigits, formatDecimal } from '@/lib/money'

export default function ComparatorView({ listId }: { listId: string }) {
  const lists = useAppState((s) => s.lists)
  const allData = useAppState((s) => s.listData)
  const data = allData[listId]
  const cmp = useMemo(() => (data ? compareMarkets(data) : null), [data])
  const list = lists.find((l) => l.id === listId)
  if (!data || !cmp || !list) return null
  const noProducts = data.products.length === 0
  const maxNet = Math.max(...cmp.results.filter((r) => r.complete).map((r) => r.netCents), 0)

  return (
    <div className="stack">

      {noProducts ? (
        <EmptyState icon="Layers" title="A lista está vazia" text="Adicione itens e informe preços em pelo menos dois mercados para comparar." action={<Button variant="primary" onClick={() => navigate('/listas')}>Abrir listas</Button>} />
      ) : (
        <>
          {cmp.winner ? (
            <section className="hero">
              <div className="label">Melhor escolha para a lista completa</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{cmp.winner.market.name}</div>
              <div className="big num">{formatBRL(cmp.winner.netCents)}</div>
              <div className="xs" style={{ opacity: 0.9 }}>
                {cmp.winner.discountCents > 0 && <>desconto de {formatBRL(cmp.winner.discountCents)} já aplicado · </>}
                {cmp.winner.travelCents > 0 ? `inclui ${formatBRL(cmp.winner.travelCents)} de deslocamento` : 'sem custo de deslocamento informado'}
              </div>
              {cmp.netSavingsCents > 0 && <div className="row-s" style={{ marginTop: 10 }}><Badge tone="good" icon="PiggyBank">Economia líquida estimada: {formatBRL(cmp.netSavingsCents)}</Badge></div>}
            </section>
          ) : (
            <Banner tone="warn">Nenhum mercado tem todos os itens com preço. Produtos sem preço <b>não</b> são tratados como gratuitos, então ninguém é declarado vencedor ainda.{cmp.cheapestPartial && <> Mais barato com os itens já precificados: <b>{cmp.cheapestPartial.market.name}</b> ({formatBRL(cmp.cheapestPartial.totalCents)}, parcial).</>}</Banner>
          )}

          <Card>
            <h2 style={{ fontSize: 16, marginBottom: 10 }}>Mercados</h2>
            <div className="stack-s" style={{ gap: 12 }}>
              {[...cmp.results].sort((a, b) => Number(b.complete) - Number(a.complete) || a.netCents - b.netCents).map((r) => (
                <div key={r.market.id} className="card flat tight stack-s" style={cmp.winner?.market.id === r.market.id ? { borderColor: 'var(--primary)' } : undefined}>
                  <div className="row between">
                    <b>{r.market.name}</b>
                    {cmp.winner?.market.id === r.market.id ? <Badge tone="good" icon="Check">melhor</Badge> : r.complete ? <Badge>completo</Badge> : <Badge tone="warn" icon="TriangleAlert">faltam {r.missing.length}</Badge>}
                  </div>
                  <div className="row between small"><span className="muted">Subtotal ({r.pricedItems} itens)</span><span className="num">{formatBRL(r.subtotalCents)}</span></div>
                  {r.discountCents > 0 && <div className="row between small"><span className="muted">Desconto ({r.market.discountPercent}%)</span><span className="num" style={{ color: 'var(--primary)' }}>−{formatBRL(r.discountCents)}</span></div>}
                  <div className="row between small" style={{ alignItems: 'center' }}>
                    <span className="muted">Deslocamento</span>
                    <div className="input-affix" style={{ width: 120 }}><span className="affix" style={{ fontSize: 13 }}>R$</span><input className="input num" style={{ minHeight: 36, padding: '4px 8px 4px 34px', fontSize: 14 }} inputMode="numeric" placeholder="0,00" aria-label={`Custo de deslocamento até ${r.market.name}`} value={r.market.travelCostCents ? formatDecimal(r.market.travelCostCents) : ''} onChange={(e) => updateList(listId, (d) => ({ ...d, markets: d.markets.map((m) => (m.id === r.market.id ? { ...m, travelCostCents: centsFromDigits(e.target.value) || undefined } : m)) }))} /></div>
                  </div>
                  <div className="row between bold"><span>Total</span><span className="num">{formatBRL(r.netCents)}</span></div>
                  {r.complete && maxNet > 0 && r.netCents < maxNet && <div className="xs muted">{formatBRL(maxNet - r.netCents)} mais barato que a opção mais cara completa</div>}
                  {r.missing.length > 0 && <div className="xs" style={{ color: 'var(--warn-text)' }}>Sem preço: {r.missing.slice(0, 4).map((m) => m.name).join(', ')}{r.missing.length > 4 ? '…' : ''}</div>}
                </div>
              ))}
            </div>
            <p className="xs muted" style={{ marginTop: 10 }}>Dica: calcule o custo da viagem em <button style={{ textDecoration: 'underline' }} onClick={() => navigate('/ferramentas/combustivel')}>Combustível</button> e informe aqui.</p>
          </Card>

          <Card>
            <div className="row between" style={{ marginBottom: 8 }}><h2 style={{ fontSize: 16 }}>Melhor preço por produto</h2>{cmp.splitSavingsCents > 0 && <Badge tone="info">dividindo: −{formatBRL(cmp.splitSavingsCents)}</Badge>}</div>
            <div className="list">
              {cmp.bestProducts.map((b) => {
                const m = data.markets.find((x) => x.id === b.bestMarketId)
                const pm = data.markets.find((x) => x.id === b.bestPerBaseMarketId)
                return (
                  <div key={b.product.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="bold ellipsis">{b.product.name} <span className="muted xs">×{b.product.quantity}</span></div>
                      {b.bestCents === null ? <div className="xs" style={{ color: 'var(--warn-text)' }}>Sem preço cadastrado em nenhum mercado</div> : (
                        <div className="xs muted">Menor: <b>{m?.name}</b>{b.pricedIn < 2 ? ' (único preço)' : ''}{b.bestPerBaseCents !== null && pm && <> · por {b.product.packSize?.unit === 'l' ? 'L' : b.product.packSize?.unit === 'kg' ? 'kg' : 'un'}: {formatBRL(b.bestPerBaseCents)} ({pm.name})</>}</div>
                      )}
                    </div>
                    {b.bestCents !== null && <b className="num">{formatBRL(b.bestCents)}</b>}
                  </div>
                )
              })}
            </div>
            {cmp.productsWithoutPrice.length > 0 && <Banner tone="warn">{cmp.productsWithoutPrice.length} produto(s) sem nenhum preço — não entram nas somas.</Banner>}
          </Card>
          <Button icon="Tag" onClick={() => navigate('/listas')}><Icon name="Pencil" /> Editar preços na lista</Button>
        </>
      )}
    </div>
  )
}
