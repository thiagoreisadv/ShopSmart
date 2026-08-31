import { useMemo } from 'react';
import { Plus, Trash2, TrendingDown } from 'lucide-react';
import { formatCurrency, handlePriceMask } from '../utils/format';
import { useLocalStorage } from '../hooks/useLocalStorage';

const DEFAULT_ITEMS = [
  { id: '1', name: 'Marca A', price: '', quantity: '', unit: 'g' },
  { id: '2', name: 'Marca B', price: '', quantity: '', unit: 'g' }
];

// --- COMPONENTE: CALCULADORA DE COMPARAÇÃO DE EMBALAGENS ---
export default function UnitCalculatorView() {
  const [items, setItems] = useLocalStorage('shopsmart_calc', DEFAULT_ITEMS);

  const results = useMemo(() => {
    return items.map(item => {
      const p = parseFloat(item.price);
      const q = parseFloat(item.quantity);
      if (!p || !q) return { ...item, perBase: Infinity };
      let factor = 1;
      if (item.unit === 'g' || item.unit === 'ml') factor = 1000;
      if (item.unit === 'kg' || item.unit === 'L') factor = 1;
      const perBase = (p / q) * factor;
      return { ...item, perBase };
    });
  }, [items]);

  const cheapestId = useMemo(() => {
    let min = Infinity;
    let id = null;
    results.forEach(r => {
      if (r.perBase < min && r.perBase !== Infinity) {
        min = r.perBase;
        id = r.id;
      }
    });
    return id;
  }, [results]);

  return (
    <div className="p-5 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32">
      <header>
        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Melhor Preço</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Descubra qual embalagem compensa mais.</p>
      </header>

      <div className="space-y-4">
        {items.map((item) => {
          const res = results.find(r => r.id === item.id);
          const isCheapest = cheapestId === item.id;

          return (
            <div key={item.id} className={`bg-white dark:bg-slate-900 p-5 rounded-3xl border-2 transition-all duration-300 shadow-sm hover:shadow-md ${isCheapest ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-900/10 ring-4 ring-emerald-500/5' : 'border-slate-100 dark:border-slate-800'}`}>
              <div className="flex justify-between items-center mb-4">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => setItems(items.map(it => it.id === item.id ? { ...it, name: e.target.value } : it))}
                  className="font-bold text-slate-700 dark:text-slate-200 bg-transparent outline-none w-2/3 text-lg focus:border-b-2 focus:border-indigo-200 transition-all"
                />
                {items.length > 2 && (
                  <button onClick={() => setItems(items.filter(it => it.id !== item.id))} className="text-slate-300 dark:text-slate-600 hover:text-rose-500 transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Preço Total</span>
                  <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</div>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0,00"
                      value={item.price ? parseFloat(item.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                      onChange={(e) => {
                        const masked = handlePriceMask(e.target.value);
                        setItems(items.map(it => it.id === item.id ? { ...it, price: masked } : it));
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl pl-9 pr-4 py-3 font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Quantidade</span>
                  <div className="flex">
                    <input
                      type="number"
                      placeholder="Ex: 500"
                      value={item.quantity}
                      onChange={(e) => setItems(items.map(it => it.id === item.id ? { ...it, quantity: e.target.value } : it))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-l-2xl px-4 py-3 font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                    <select
                      value={item.unit}
                      onChange={(e) => setItems(items.map(it => it.id === item.id ? { ...it, unit: e.target.value } : it))}
                      className="bg-slate-100 dark:bg-slate-700 border border-l-0 border-slate-100 dark:border-slate-700 rounded-r-2xl px-3 text-xs font-black text-slate-600 dark:text-slate-200 outline-none cursor-pointer"
                    >
                      <option value="g">G</option>
                      <option value="kg">KG</option>
                      <option value="ml">ML</option>
                      <option value="L">L</option>
                      <option value="un">UN</option>
                    </select>
                  </div>
                </div>
              </div>

              {res.perBase !== Infinity && (
                <div className="mt-5 pt-4 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Custo por {item.unit === 'un' ? 'Unidade' : 'Kg/Litro'}</span>
                    <span className={`text-xl font-black ${isCheapest ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>
                      {formatCurrency(res.perBase)}
                    </span>
                  </div>
                  {isCheapest && (
                    <div className="bg-emerald-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 dark:shadow-none uppercase tracking-tighter">
                      <TrendingDown className="w-3.5 h-3.5" /> Mais Econômico
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <button
          onClick={() => setItems([...items, { id: Date.now().toString(), name: `Opção ${String.fromCharCode(65 + items.length)}`, price: '', quantity: '', unit: 'g' }])}
          className="w-full py-5 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl text-slate-400 dark:text-slate-500 font-bold flex items-center justify-center gap-2 hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-300 hover:text-indigo-500 transition-all group"
        >
          <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" /> Adicionar Outra Opção
        </button>
      </div>
    </div>
  );
}
