import { useEffect, useState } from 'react';
import { Fuel, MapPin, ArrowRightLeft, Loader2, Navigation } from 'lucide-react';
import { formatCurrency, handlePriceMask } from '../utils/format';
import { useLocalStorage } from '../hooks/useLocalStorage';
import CityAutocomplete from './CityAutocomplete';

// --- COMPONENTE: CALCULADORA DE COMBUSTÍVEL ---
export default function FuelCalculatorView() {
  const [ethanolPrice, setEthanolPrice] = useLocalStorage('shopsmart_eth', '');
  const [gasolinePrice, setGasolinePrice] = useLocalStorage('shopsmart_gas', '');
  const [distance, setDistance] = useLocalStorage('shopsmart_dist', '');
  const [consumption, setConsumption] = useLocalStorage('shopsmart_cons', '');
  const [tripFuelPrice, setTripFuelPrice] = useLocalStorage('shopsmart_tfp', '');

  const [originPlace, setOriginPlace] = useState(null);
  const [destPlace, setDestPlace] = useState(null);
  const [routeKey, setRouteKey] = useState(0);
  const [routeStatus, setRouteStatus] = useState('idle'); // idle | loading | done | error

  useEffect(() => {
    if (!originPlace || !destPlace) { setRouteStatus('idle'); return; }
    let cancelled = false;
    setRouteStatus('loading');
    fetch(`https://router.project-osrm.org/route/v1/driving/${originPlace.lon},${originPlace.lat};${destPlace.lon},${destPlace.lat}?overview=false`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        const meters = data?.routes?.[0]?.distance;
        if (meters) {
          setDistance((meters / 1000).toFixed(1));
          setRouteStatus('done');
        } else {
          setRouteStatus('error');
        }
      })
      .catch(() => { if (!cancelled) setRouteStatus('error'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originPlace, destPlace, routeKey]);

  // Cálculos Etanol vs Gasolina (Regra dos 70%)
  const eth = parseFloat(ethanolPrice);
  const gas = parseFloat(gasolinePrice);
  const ratio = (eth && gas) ? (eth / gas) : null;
  const betterFuel = ratio !== null ? (ratio < 0.7 ? 'Etanol' : 'Gasolina') : null;

  // Cálculos Trajeto
  const d = parseFloat(distance);
  const c = parseFloat(consumption);
  const p = parseFloat(tripFuelPrice);
  const tripCost = (d && c && p) ? (d / c) * p : null;

  return (
    <div className="p-5 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32">
      <header>
        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Combustível</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Calcule trajetos e saiba o que compensa.</p>
      </header>

      {/* Seção 1: Etanol vs Gasolina */}
      <section className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
        <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg mb-1 flex items-center gap-2">
          <Fuel className="w-5 h-5 text-indigo-500" /> Etanol vs Gasolina
        </h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mb-5">A famosa regra dos 70%.</p>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase ml-1">Etanol</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
              <input
                type="text" inputMode="numeric" placeholder="0,00"
                value={ethanolPrice ? parseFloat(ethanolPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                onChange={(e) => setEthanolPrice(handlePriceMask(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl pl-9 pr-3 py-3 font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase ml-1">Gasolina</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
              <input
                type="text" inputMode="numeric" placeholder="0,00"
                value={gasolinePrice ? parseFloat(gasolinePrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                onChange={(e) => setGasolinePrice(handlePriceMask(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl pl-9 pr-3 py-3 font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>
        </div>

        {betterFuel && (
          <div className={`p-4 rounded-2xl border-2 ${betterFuel === 'Etanol' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800'} flex items-center justify-between`}>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest block mb-0.5 opacity-60">Abasteça com</span>
              <span className={`text-xl font-black ${betterFuel === 'Etanol' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {betterFuel}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black uppercase tracking-widest block mb-0.5 opacity-60">Relação</span>
              <span className={`text-lg font-black ${betterFuel === 'Etanol' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {(ratio * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Seção 2: Custo de Trajeto */}
      <section className="bg-indigo-600 p-6 rounded-[2rem] shadow-xl shadow-indigo-200 text-white relative overflow-hidden">
         <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
         <div className="relative z-10">
            <h3 className="font-black text-xl mb-1 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-indigo-200" /> Custo do Trajeto
            </h3>
            <p className="text-xs text-indigo-200 font-bold mb-6">Vai viajar? Calcule o gasto.</p>

            <div className="space-y-4 mb-6">
              <div className="space-y-3 relative">
                <CityAutocomplete
                  label="De"
                  placeholder="Cidade ou endereço de origem"
                  allowCurrentLocation
                  place={originPlace}
                  onPlaceSelected={setOriginPlace}
                />
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => { setOriginPlace(destPlace); setDestPlace(originPlace); setRouteKey(k => k + 1); }}
                    className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-200" />
                  </button>
                </div>
                <CityAutocomplete
                  label="Para"
                  placeholder="Cidade ou endereço de destino"
                  place={destPlace}
                  onPlaceSelected={setDestPlace}
                />
              </div>

              {routeStatus === 'loading' && (
                <p className="text-xs font-bold text-indigo-200 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Calculando rota...</p>
              )}
              {routeStatus === 'done' && (
                <p className="text-xs font-bold text-emerald-300 flex items-center gap-1.5"><Navigation className="w-3.5 h-3.5" /> Rota calculada automaticamente</p>
              )}
              {routeStatus === 'error' && (
                <p className="text-xs font-bold text-amber-300">Não foi possível calcular a rota. Informe a distância manualmente abaixo.</p>
              )}

              <p className="text-[9px] text-indigo-300/70 font-medium">Busca e rota via © colaboradores do OpenStreetMap</p>

              <div className="flex gap-4">
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-black text-indigo-200 uppercase ml-1">Distância (km)</label>
                  <input
                    type="number" placeholder="Ex: 150"
                    value={distance} onChange={(e) => setDistance(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 font-bold text-white placeholder:text-indigo-300 outline-none focus:bg-white/20 transition-all"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-black text-indigo-200 uppercase ml-1">Consumo (km/l)</label>
                  <input
                    type="number" placeholder="Ex: 12"
                    value={consumption} onChange={(e) => setConsumption(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 font-bold text-white placeholder:text-indigo-300 outline-none focus:bg-white/20 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-indigo-200 uppercase ml-1">Preço na Bomba</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-300 font-bold text-sm">R$</span>
                  <input
                    type="text" inputMode="numeric" placeholder="0,00"
                    value={tripFuelPrice ? parseFloat(tripFuelPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                    onChange={(e) => setTripFuelPrice(handlePriceMask(e.target.value))}
                    className="w-full bg-white/10 border border-white/20 rounded-2xl pl-10 pr-4 py-3 font-bold text-white placeholder:text-indigo-300 outline-none focus:bg-white/20 transition-all"
                  />
                </div>
              </div>
            </div>

            {tripCost !== null && (
              <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-100">Custo Total</span>
                <span className="text-2xl font-black text-white">{formatCurrency(tripCost)}</span>
              </div>
            )}
         </div>
      </section>
    </div>
  );
}
