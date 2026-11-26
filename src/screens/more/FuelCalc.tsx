import { useEffect, useRef, useState } from 'react'
import { Page } from '@/components/Page'
import { Badge, Banner, Button, Card, Switch } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { formatBRL } from '@/lib/money'

interface Place { label: string; lat: number; lon: number }
const num = (s: string) => parseFloat(String(s).replace(',', '.'))

function PlaceInput({ label, place, onPick, current }: { label: string; place: Place | null; onPick: (p: Place | null) => void; current?: boolean }) {
  const [text, setText] = useState(place?.label ?? '')
  const [results, setResults] = useState<{ display_name: string; lat: string; lon: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [locating, setLocating] = useState(false)
  const [err, setErr] = useState('')
  const picked = useRef<Place | null>(place)
  useEffect(() => {
    if (picked.current || text.trim().length < 3) return
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      setLoading(true)
      setErr('')
      fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=5`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((j) => setResults(Array.isArray(j) ? j : []))
        .catch((e) => { if (e?.name !== 'AbortError') { setResults([]); setErr('Busca de endereço indisponível (sem internet?).') } })
        .finally(() => setLoading(false))
    }, 700)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [text])
  const choose = (p: Place) => { picked.current = p; setText(p.label); setResults([]); onPick(p) }
  const locate = () => {
    if (!navigator.geolocation) { setErr('Localização indisponível neste navegador.'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords
      let l = `${lat.toFixed(4)}, ${lon.toFixed(4)}`
      try { const j = await (await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)).json(); if (j?.display_name) l = j.display_name } catch { /* mantém coordenadas */ }
      setLocating(false)
      choose({ label: l, lat, lon })
    }, () => { setLocating(false); setErr('Não consegui obter sua localização.') }, { timeout: 8000 })
  }
  return (
    <div className="field">
      <div className="row between"><label className="label">{label}</label>{current && <button className="small" style={{ color: 'var(--primary)', fontWeight: 600 }} onClick={locate} disabled={locating}><Icon name="MapPin" size={14} /> {locating ? 'Localizando…' : 'Local atual'}</button>}</div>
      <input className="input" value={text} placeholder="Digite um endereço ou cidade" onChange={(e) => { setText(e.target.value); if (picked.current) { picked.current = null; onPick(null) } if (e.target.value.trim().length < 3) setResults([]) }} />
      {loading && <span className="hint">Buscando…</span>}
      {err && <span className="error-text">{err}</span>}
      {results.length > 0 && (
        <div className="card flat tight list" role="listbox">
          {results.map((r) => <button key={r.display_name + r.lat} role="option" className="list-item list-btn small" style={{ minHeight: 44 }} onClick={() => choose({ label: r.display_name, lat: parseFloat(r.lat), lon: parseFloat(r.lon) })}>{r.display_name}</button>)}
        </div>
      )}
    </div>
  )
}

export default function FuelCalc() {
  // Chaves idênticas às da v1
  const [eth, setEth] = useLocalStorage('shopsmart_eth', '')
  const [gas, setGas] = useLocalStorage('shopsmart_gas', '')
  const [dist, setDist] = useLocalStorage('shopsmart_dist', '')
  const [cons, setCons] = useLocalStorage('shopsmart_cons', '')
  const [tfp, setTfp] = useLocalStorage('shopsmart_tfp', '')
  const [round, setRound] = useLocalStorage('shopsmart_roundtrip', false)
  const [from, setFrom] = useState<Place | null>(null)
  const [to, setTo] = useState<Place | null>(null)
  const [route, setRoute] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [retry, setRetry] = useState(0)
  const [resetKey, setResetKey] = useState(0)

  useEffect(() => {
    if (!from || !to) { setRoute('idle'); return }
    const ctrl = new AbortController()
    setRoute('loading')
    fetch(`https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => { const d = j?.routes?.[0]?.distance; if (d) { setDist((d / 1000).toFixed(1)); setRoute('done') } else setRoute('error') })
      .catch((e) => { if (e?.name !== 'AbortError') setRoute('error') })
    return () => ctrl.abort()
  }, [from, to, retry, setDist])

  const e = num(eth), g = num(gas)
  const ratio = e > 0 && g > 0 ? e / g : null
  const best = ratio === null ? null : ratio < 0.7 ? 'Etanol' : 'Gasolina'
  const km = num(dist), kpl = num(cons), price = num(tfp)
  const total = km > 0 ? (round ? km * 2 : km) : null
  const cost = total && kpl > 0 && price > 0 ? (total / kpl) * price : null
  const liters = total && kpl > 0 ? total / kpl : null

  return (
    <Page title="Combustível" subtitle="Etanol ou gasolina? Quanto custa o trajeto?" backTo="/">
      <Card>
        <h2 style={{ fontSize: 16 }}>Etanol × Gasolina</h2>
        <p className="small muted" style={{ marginBottom: 12 }}>A regra dos 70%: etanol compensa se custar menos de 70% da gasolina.</p>
        <div className="grid-2">
          <div className="field"><label className="label" htmlFor="eth">Etanol (R$/L)</label><div className="input-affix"><span className="affix">R$</span><input id="eth" className="input num" inputMode="decimal" placeholder="0,00" value={eth} onChange={(ev) => setEth(ev.target.value.replace(/[^\d.,]/g, ''))} /></div></div>
          <div className="field"><label className="label" htmlFor="gas">Gasolina (R$/L)</label><div className="input-affix"><span className="affix">R$</span><input id="gas" className="input num" inputMode="decimal" placeholder="0,00" value={gas} onChange={(ev) => setGas(ev.target.value.replace(/[^\d.,]/g, ''))} /></div></div>
        </div>
        {ratio !== null ? (
          <div className="row between" style={{ marginTop: 14, padding: 14, borderRadius: 12, background: 'var(--primary-soft)', color: 'var(--primary-soft-text)' }} role="status">
            <div><div className="xs">Abasteça com</div><div className="bold" style={{ fontSize: 22 }}>{best}</div></div>
            <div className="right"><div className="xs">Relação</div><div className="bold num" style={{ fontSize: 22 }}>{(ratio * 100).toFixed(1).replace('.', ',')}%</div></div>
          </div>
        ) : (e > 0 || g > 0) ? <p className="hint" style={{ marginTop: 8 }}>Preencha os dois preços para comparar.</p> : null}
      </Card>

      <Card className="stack">
        <h2 style={{ fontSize: 16 }}>Custo do trajeto</h2>
        <PlaceInput key={`o${resetKey}`} label="Origem" place={from} onPick={setFrom} current />
        <PlaceInput key={`d${resetKey}`} label="Destino" place={to} onPick={setTo} />
        {route === 'loading' && <p className="small muted">Calculando rota…</p>}
        {route === 'error' && <Banner tone="warn">Não foi possível calcular a rota. Informe a distância manualmente. <button style={{ textDecoration: 'underline' }} onClick={() => setRetry((r) => r + 1)}>Tentar de novo</button></Banner>}
        <div className="grid-2">
          <div className="field"><label className="label" htmlFor="dist">Distância (km)</label><input id="dist" className="input num" inputMode="decimal" placeholder="0" value={dist} onChange={(ev) => setDist(ev.target.value.replace(/[^\d.,]/g, ''))} /></div>
          <div className="field"><label className="label" htmlFor="cons">Consumo (km/L)</label><input id="cons" className="input num" inputMode="decimal" placeholder="0" value={cons} onChange={(ev) => setCons(ev.target.value.replace(/[^\d.,]/g, ''))} /></div>
        </div>
        <div className="field">
          <label className="label" htmlFor="tfp">Preço do combustível (R$/L)</label>
          <div className="input-affix"><span className="affix">R$</span><input id="tfp" className="input num" inputMode="decimal" placeholder="0,00" value={tfp} onChange={(ev) => setTfp(ev.target.value.replace(/[^\d.,]/g, ''))} /></div>
          <div className="row-s wrap" style={{ marginTop: 4 }}>
            {e > 0 && <button className="chip" onClick={() => setTfp(String(eth))}>Usar etanol</button>}
            {g > 0 && <button className="chip" onClick={() => setTfp(String(gas))}>Usar gasolina</button>}
          </div>
        </div>
        <div className="row between"><span className="bold small">Ida e volta</span><Switch checked={round} onChange={setRound} label="Ida e volta" /></div>
        {cost !== null ? (
          <div className="card flat" role="status" style={{ background: 'var(--primary-soft)', borderColor: 'transparent' }}>
            <div className="row between"><div><div className="xs muted">Custo estimado</div><div className="bold num" style={{ fontSize: 26, color: 'var(--primary-soft-text)' }}>{formatBRL(Math.round(cost * 100))}</div></div>
              <div className="right small muted"><div>{total!.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km</div><div>{liters!.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L</div></div></div>
            <Badge icon="Info">Use este valor como “deslocamento” no comparador de mercados.</Badge>
          </div>
        ) : <p className="hint">Informe distância, consumo e preço do combustível para ver o custo.</p>}
        {(!(km > 0) && dist !== '') || (!(kpl > 0) && cons !== '') ? <p className="error-text">Use valores maiores que zero.</p> : null}
        <Button variant="ghost" onClick={() => { setDist(''); setFrom(null); setTo(null); setResetKey((k) => k + 1) }}>Limpar trajeto</Button>
      </Card>
    </Page>
  )
}
