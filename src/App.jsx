import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShoppingCart, 
  Calculator, 
  Plus, 
  Trash2, 
  X,
  Smartphone,
  Package,
  Trophy,
  Scale,
  TrendingDown,
  Star,
  CheckCircle2,
  ListPlus,
  Share2,
  Circle,
  RefreshCw,
  Fuel,
  MapPin,
  Carrot,
  Beef,
  Croissant,
  Milk,
  ShoppingBasket,
  SprayCan,
  Sparkles,
  Wine,
  Snowflake,
  Dog,
  Baby,
  Tag,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

// Função auxiliar para formatar números como moeda para exibição
const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value || 0);
};

// Função para converter entrada de texto em valor decimal (máscara de centavos)
const handlePriceMask = (rawValue) => {
  const digits = rawValue.replace(/\D/g, '');
  if (!digits) return '';
  return (parseInt(digits, 10) / 100).toFixed(2);
};

// --- COMPONENTE: CALCULADORA DE COMBUSTÍVEL (NOVA ABA) ---
const FuelCalculatorView = () => {
  // States para Etanol vs Gasolina
  const [ethanolPrice, setEthanolPrice] = useState(() => localStorage.getItem('shopsmart_eth') || '');
  const [gasolinePrice, setGasolinePrice] = useState(() => localStorage.getItem('shopsmart_gas') || '');

  // States para Custo de Trajeto
  const [distance, setDistance] = useState(() => localStorage.getItem('shopsmart_dist') || '');
  const [consumption, setConsumption] = useState(() => localStorage.getItem('shopsmart_cons') || '');
  const [tripFuelPrice, setTripFuelPrice] = useState(() => localStorage.getItem('shopsmart_tfp') || '');

  // Salvar na memória sempre que atualizar
  useEffect(() => {
    localStorage.setItem('shopsmart_eth', ethanolPrice);
    localStorage.setItem('shopsmart_gas', gasolinePrice);
    localStorage.setItem('shopsmart_dist', distance);
    localStorage.setItem('shopsmart_cons', consumption);
    localStorage.setItem('shopsmart_tfp', tripFuelPrice);
  }, [ethanolPrice, gasolinePrice, distance, consumption, tripFuelPrice]);

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
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Combustível</h2>
        <p className="text-slate-500 text-sm">Calcule trajetos e saiba o que compensa.</p>
      </header>

      {/* Seção 1: Etanol vs Gasolina */}
      <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
        <h3 className="font-black text-slate-800 text-lg mb-1 flex items-center gap-2">
          <Fuel className="w-5 h-5 text-indigo-500" /> Etanol vs Gasolina
        </h3>
        <p className="text-xs text-slate-400 font-bold mb-5">A famosa regra dos 70%.</p>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Etanol</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
              <input
                type="text" inputMode="numeric" placeholder="0,00"
                value={ethanolPrice ? parseFloat(ethanolPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                onChange={(e) => setEthanolPrice(handlePriceMask(e.target.value))}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-9 pr-3 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Gasolina</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
              <input
                type="text" inputMode="numeric" placeholder="0,00"
                value={gasolinePrice ? parseFloat(gasolinePrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                onChange={(e) => setGasolinePrice(handlePriceMask(e.target.value))}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-9 pr-3 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>
        </div>

        {betterFuel && (
          <div className={`p-4 rounded-2xl border-2 ${betterFuel === 'Etanol' ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'} flex items-center justify-between`}>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest block mb-0.5 opacity-60">Abasteça com</span>
              <span className={`text-xl font-black ${betterFuel === 'Etanol' ? 'text-emerald-700' : 'text-amber-700'}`}>
                {betterFuel}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black uppercase tracking-widest block mb-0.5 opacity-60">Relação</span>
              <span className={`text-lg font-black ${betterFuel === 'Etanol' ? 'text-emerald-700' : 'text-amber-700'}`}>
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
};

// --- COMPONENTE: CALCULADORA DE COMPARAÇÃO DE EMBALAGENS ---
const UnitCalculatorView = () => {
  const [items, setItemsState] = useState(() => {
    const saved = localStorage.getItem('shopsmart_calc');
    return saved ? JSON.parse(saved) : [
      { id: '1', name: 'Marca A', price: '', quantity: '', unit: 'g' },
      { id: '2', name: 'Marca B', price: '', quantity: '', unit: 'g' }
    ];
  });

  const setItems = (newItems) => {
    setItemsState(newItems);
    localStorage.setItem('shopsmart_calc', JSON.stringify(newItems));
  };

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
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Melhor Preço</h2>
        <p className="text-slate-500 text-sm">Descubra qual embalagem compensa mais.</p>
      </header>

      <div className="space-y-4">
        {items.map((item) => {
          const res = results.find(r => r.id === item.id);
          const isCheapest = cheapestId === item.id;

          return (
            <div key={item.id} className={`bg-white p-5 rounded-3xl border-2 transition-all duration-300 shadow-sm hover:shadow-md ${isCheapest ? 'border-emerald-500 bg-emerald-50/20 ring-4 ring-emerald-500/5' : 'border-slate-100'}`}>
              <div className="flex justify-between items-center mb-4">
                <input 
                  type="text" 
                  value={item.name} 
                  onChange={(e) => setItems(items.map(it => it.id === item.id ? { ...it, name: e.target.value } : it))}
                  className="font-bold text-slate-700 bg-transparent outline-none w-2/3 text-lg focus:border-b-2 focus:border-indigo-200 transition-all"
                />
                {items.length > 2 && (
                  <button onClick={() => setItems(items.filter(it => it.id !== item.id))} className="text-slate-300 hover:text-rose-500 transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preço Total</span>
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
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-9 pr-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantidade</span>
                  <div className="flex">
                    <input 
                      type="number" 
                      placeholder="Ex: 500"
                      value={item.quantity}
                      onChange={(e) => setItems(items.map(it => it.id === item.id ? { ...it, quantity: e.target.value } : it))}
                      className="w-full bg-slate-50 border border-slate-100 rounded-l-2xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                    <select 
                      value={item.unit}
                      onChange={(e) => setItems(items.map(it => it.id === item.id ? { ...it, unit: e.target.value } : it))}
                      className="bg-slate-100 border border-l-0 border-slate-100 rounded-r-2xl px-3 text-xs font-black text-slate-600 outline-none cursor-pointer"
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
                <div className="mt-5 pt-4 border-t border-slate-50 flex justify-between items-center">
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Custo por {item.unit === 'un' ? 'Unidade' : 'Kg/Litro'}</span>
                    <span className={`text-xl font-black ${isCheapest ? 'text-emerald-600' : 'text-slate-700'}`}>
                      {formatCurrency(res.perBase)}
                    </span>
                  </div>
                  {isCheapest && (
                    <div className="bg-emerald-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 uppercase tracking-tighter">
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
          className="w-full py-5 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 font-bold flex items-center justify-center gap-2 hover:bg-white hover:border-indigo-300 hover:text-indigo-500 transition-all group"
        >
          <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" /> Adicionar Outra Opção
        </button>
      </div>
    </div>
  );
};

// --- CATEGORIAS DE PRODUTOS ---
const CATEGORIES = [
  { id: 'hortifruti', label: 'Hortifruti', icon: Carrot, text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  { id: 'acougue', label: 'Açougue e Peixaria', icon: Beef, text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
  { id: 'padaria', label: 'Padaria', icon: Croissant, text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
  { id: 'laticinios', label: 'Laticínios e Frios', icon: Milk, text: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-100' },
  { id: 'mercearia', label: 'Mercearia', icon: ShoppingBasket, text: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
  { id: 'bebidas', label: 'Bebidas', icon: Wine, text: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
  { id: 'congelados', label: 'Congelados', icon: Snowflake, text: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-100' },
  { id: 'limpeza', label: 'Limpeza', icon: SprayCan, text: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-100' },
  { id: 'higiene', label: 'Higiene e Beleza', icon: Sparkles, text: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-100' },
  { id: 'bebes', label: 'Bebês', icon: Baby, text: 'text-fuchsia-600', bg: 'bg-fuchsia-50', border: 'border-fuchsia-100' },
  { id: 'pet', label: 'Pet', icon: Dog, text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
  { id: 'geral', label: 'Outros', icon: Tag, text: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-200' },
];
const getCategory = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

// --- COMPONENTE: LISTA DE COMPRAS ---
const ComparatorView = () => {
  const [viewMode, setViewMode] = useState('list');
  const [newProductName, setNewProductName] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [categoryPickerFor, setCategoryPickerFor] = useState(null);
  const [collapsedCategories, setCollapsedCategories] = useState(() => new Set());

  const [markets, setMarketsState] = useState(() => {
    const saved = localStorage.getItem('shopsmart_markets');
    return saved ? JSON.parse(saved) : [
      { id: 'm1', name: 'Mercado A', discountPercent: '' }, 
      { id: 'm2', name: 'Mercado B', discountPercent: '' }
    ];
  });

  const [products, setProductsState] = useState(() => {
    const saved = localStorage.getItem('shopsmart_products');
    return saved ? JSON.parse(saved) : [];
  });

  const [budget, setBudgetState] = useState(() => localStorage.getItem('shopsmart_budget') || '0');

  const setMarkets = (data) => { setMarketsState(data); localStorage.setItem('shopsmart_markets', JSON.stringify(data)); };
  const setProducts = (data) => { setProductsState(data); localStorage.setItem('shopsmart_products', JSON.stringify(data)); };
  const setBudget = (data) => { setBudgetState(data); localStorage.setItem('shopsmart_budget', data); };

  const addProduct = (e) => {
    e.preventDefault(); 
    if (!newProductName.trim()) return;
    const iP = {}; 
    markets.forEach(m => iP[m.id] = '');
    const nP = [{ id: `p${Date.now()}`, name: newProductName, quantity: 1, prices: iP, category: 'geral', isEssential: false, inCart: false }, ...products];
    setProducts(nP); 
    setNewProductName('');
  };

  const removeMarket = (marketId) => setMarkets(markets.filter(m => m.id !== marketId));

  const totals = useMemo(() => {
    const calc = {}; 
    markets.forEach(m => calc[m.id] = { sub: 0, total: 0 });
    products.forEach(p => {
      markets.forEach(m => {
        const val = parseFloat(p.prices[m.id]);
        if (!isNaN(val)) calc[m.id].sub += (val * p.quantity);
      });
    });
    markets.forEach(m => {
      const sub = calc[m.id].sub; 
      const d = parseFloat(m.discountPercent) || 0;
      calc[m.id].total = sub - (sub * (d / 100));
    });
    return calc;
  }, [products, markets]);

  const bestMarket = useMemo(() => {
    let min = Infinity; 
    let b = null;
    markets.forEach(m => { 
      if (totals[m.id]?.total > 0 && totals[m.id].total < min) { min = totals[m.id].total; b = m.id; } 
    });
    return b ? markets.find(m => m.id === b) : null;
  }, [totals, markets]);

  const budgetProgress = useMemo(() => {
    const bVal = parseFloat(budget) || 0;
    const currentTotal = bestMarket ? totals[bestMarket.id].total : 0;
    if (bVal === 0) return 0;
    return Math.min((currentTotal / bVal) * 100, 100);
  }, [budget, bestMarket, totals]);

  const handleShare = () => {
    let text = `🛒 *Minha Lista de Compras - ShopSmart* 🛒\n\n`;
    if (products.length > 0) {
      text += `*📝 Itens:*\n`;
      products.forEach(p => {
        text += `- ${p.quantity}x ${p.name}`;
        if (p.inCart) text += ` ✅ (No Carrinho)`;
        if (viewMode === 'prices' && bestMarket) {
          const itemPrice = p.prices[bestMarket.id];
          if (itemPrice) text += ` (R$ ${itemPrice})`;
        }
        text += `\n`;
      });
      text += `\n`;
    } else { text += `A lista está vazia.\n\n`; }

    const hasAnyTotal = markets.some(m => totals[m.id].total > 0);
    if (hasAnyTotal) {
      text += `*💰 Resumo dos Valores:*\n`;
      markets.forEach(m => {
        const isBest = bestMarket && m.id === bestMarket.id;
        text += `${isBest ? '🏆 ' : '🏬 '}${m.name}: ${formatCurrency(totals[m.id].total)}\n`;
      });
    }
    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  };

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      if (a.inCart === b.inCart) return 0;
      return a.inCart ? 1 : -1;
    });
  }, [products]);

  const groupedProducts = useMemo(() => {
    const groups = {};
    sortedProducts.forEach(p => {
      const catId = getCategory(p.category).id;
      if (!groups[catId]) groups[catId] = [];
      groups[catId].push(p);
    });
    return CATEGORIES
      .map(cat => ({ category: cat, items: groups[cat.id] || [] }))
      .filter(g => g.items.length > 0);
  }, [sortedProducts]);

  const toggleCategoryCollapsed = (catId) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      return next;
    });
  };

  const inCartCount = products.filter(p => p.inCart).length;

  return (
    <div className="animate-in fade-in duration-700 pb-32">
      <div className="p-5">
        <div className="bg-indigo-600 rounded-[2.5rem] p-6 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
          <div className="relative z-10 space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Gasto Estimado</span>
                <div className="text-3xl font-black">{bestMarket ? formatCurrency(totals[bestMarket.id].total) : formatCurrency(0)}</div>
                {bestMarket && <div className="text-[10px] font-bold bg-white/20 inline-block px-2 py-0.5 rounded-full uppercase tracking-tighter">No {bestMarket.name}</div>}
              </div>
              <div className="text-right space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Orçamento</span>
                <div className="flex items-center justify-end border-b border-white/20 focus-within:border-white transition-all">
                  <span className="text-xs font-bold mr-1 opacity-60">R$</span>
                  <input 
                    type="text" inputMode="numeric"
                    value={budget ? parseFloat(budget).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                    onChange={(e) => setBudget(handlePriceMask(e.target.value))}
                    className="bg-transparent text-right font-black text-xl outline-none w-24"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-black uppercase opacity-70">
                <span>Progresso</span><span>{budgetProgress.toFixed(0)}%</span>
              </div>
              <div className="h-2.5 bg-indigo-900/30 rounded-full overflow-hidden border border-white/10">
                <div className={`h-full transition-all duration-1000 ${budgetProgress > 90 ? 'bg-rose-400' : 'bg-emerald-400'}`} style={{ width: `${budgetProgress}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 mb-4 flex gap-2">
        <div className="flex flex-1 p-1 bg-slate-100 rounded-2xl">
          <button onClick={() => setViewMode('list')} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Lista</button>
          <button onClick={() => setViewMode('prices')} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${viewMode === 'prices' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Preços</button>
        </div>
        <button onClick={handleShare} className="bg-emerald-500 text-white px-4 rounded-2xl active:scale-95 transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 hover:bg-emerald-600">
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      <div className="px-5">
        {viewMode === 'list' ? (
          <div className="space-y-4">
            <form onSubmit={addProduct} className="bg-white p-2 pl-5 rounded-3xl border border-slate-100 flex gap-2 shadow-sm focus-within:ring-4 ring-indigo-500/10 transition-all">
              <input type="text" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} placeholder="Ex: Leite Integral" className="flex-1 outline-none font-bold text-slate-700 placeholder:text-slate-300" />
              <button type="submit" className="bg-indigo-600 text-white p-3 rounded-2xl active:scale-95 transition-all shadow-lg shadow-indigo-200"><Plus className="w-5 h-5" /></button>
            </form>

            <div className="flex justify-between items-center px-2 mt-4 mb-2">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{products.length > 0 ? `${inCartCount} de ${products.length} Pegos` : 'Lista Vazia'}</span>
              {products.length > 0 && (
                <button onClick={() => setShowResetModal(true)} className="text-[10px] font-black text-indigo-600 flex items-center gap-1.5 bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors uppercase tracking-widest">
                  <RefreshCw className="w-3 h-3" /> Nova Compra
                </button>
              )}
            </div>

            <div className="space-y-5">
              {groupedProducts.length === 0 ? (
                <div className="py-20 flex flex-col items-center opacity-20">
                  <Package className="w-16 h-16 mb-4" />
                  <p className="font-black uppercase tracking-widest text-xs">Comece sua lista</p>
                </div>
              ) : (
                groupedProducts.map(({ category: cat, items }) => {
                  const CatIcon = cat.icon;
                  const isCollapsed = collapsedCategories.has(cat.id);
                  const doneInGroup = items.filter(i => i.inCart).length;
                  return (
                    <div key={cat.id} className="space-y-3">
                      <button
                        onClick={() => toggleCategoryCollapsed(cat.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-2xl ${cat.bg} ${cat.text} border ${cat.border} transition-all`}
                      >
                        <span className="flex items-center gap-2 font-black text-xs uppercase tracking-widest">
                          <CatIcon className="w-4 h-4" /> {cat.label}
                          <span className="opacity-60 font-bold normal-case tracking-normal">{doneInGroup}/{items.length}</span>
                        </span>
                        {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </button>

                      {!isCollapsed && items.map(p => (
                        <div key={p.id} className={`bg-white p-4 rounded-3xl border border-slate-50 flex justify-between items-center shadow-sm hover:shadow-md transition-all ${p.isEssential ? 'border-l-4 border-l-amber-400' : ''} ${p.inCart ? 'opacity-50 bg-slate-50 scale-[0.98]' : ''}`}>
                          <div className="flex items-center gap-3 w-full mr-4">
                            <button onClick={() => setProducts(products.map(i => i.id === p.id ? {...i, inCart: !i.inCart} : i))} className="text-slate-300 hover:text-emerald-500 transition-colors flex-shrink-0">
                              {p.inCart ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <Circle className="w-6 h-6" />}
                            </button>
                            <button onClick={() => setProducts(products.map(i => i.id === p.id ? {...i, isEssential: !i.isEssential} : i))} className={`transition-colors flex-shrink-0 ${p.isEssential ? 'text-amber-400' : 'text-slate-200'}`}>
                              <Star className={`w-5 h-5 ${p.isEssential ? 'fill-current' : ''}`} />
                            </button>
                            <button onClick={() => setCategoryPickerFor(p.id)} className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${cat.bg} ${cat.text}`}>
                              <CatIcon className="w-4 h-4" />
                            </button>
                            <input
                              type="text" value={p.name} onChange={(e) => setProducts(products.map(i => i.id === p.id ? {...i, name: e.target.value} : i))}
                              className={`font-bold leading-tight bg-transparent outline-none w-full focus:border-b-2 focus:border-indigo-200 transition-all ${p.inCart ? 'text-slate-400 line-through' : 'text-slate-700'}`}
                            />
                          </div>
                          <div className="flex items-center gap-4 flex-shrink-0">
                            <div className="flex items-center bg-slate-50 rounded-xl px-1">
                              <button onClick={() => { if(p.quantity > 1) setProducts(products.map(i => i.id === p.id ? {...i, quantity: i.quantity - 1} : i)) }} className="w-8 h-8 font-black text-slate-400 hover:text-indigo-600 transition-colors">-</button>
                              <span className="w-6 text-center text-xs font-black text-slate-700">{p.quantity}</span>
                              <button onClick={() => setProducts(products.map(i => i.id === p.id ? {...i, quantity: i.quantity + 1} : i))} className="w-8 h-8 font-black text-slate-400 hover:text-indigo-600 transition-colors">+</button>
                            </div>
                            <button onClick={() => setProducts(products.filter(i => i.id !== p.id))} className="text-slate-200 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
              {markets.map(m => (
                <div key={m.id} className={`min-w-[200px] bg-white p-5 rounded-[2rem] border-2 transition-all shadow-sm ${bestMarket?.id === m.id ? 'border-indigo-600 ring-4 ring-indigo-500/5' : 'border-slate-100 opacity-60'}`}>
                  <div className="flex flex-col h-full justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-4 border-b-2 border-slate-50 focus-within:border-indigo-500 transition-all">
                        <input type="text" value={m.name} onChange={(e) => setMarkets(markets.map(i => i.id === m.id ? {...i, name: e.target.value} : i))} className="bg-transparent font-black text-slate-800 outline-none w-full pb-1" />
                        {markets.length > 1 && <button onClick={() => removeMarket(m.id)} className="text-slate-300 hover:text-rose-500 pb-1 px-1 transition-colors"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Desc. %</span>
                        <input type="number" value={m.discountPercent} onChange={(e) => setMarkets(markets.map(i => i.id === m.id ? {...i, discountPercent: e.target.value} : i))} className="bg-indigo-50 text-indigo-600 font-bold text-[10px] w-10 text-center rounded py-0.5 outline-none" />
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="text-xl font-black text-slate-900">{formatCurrency(totals[m.id]?.total)}</div>
                      {bestMarket?.id === m.id && <div className="mt-1 text-[9px] font-black text-indigo-600 flex items-center gap-1 uppercase tracking-widest"><CheckCircle2 className="w-3 h-3" /> Campeão</div>}
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={() => { const nid = `m${Date.now()}`; setMarkets([...markets, { id: nid, name: 'Mercado', discountPercent: '' }]); setProducts(products.map(p => ({ ...p, prices: { ...p.prices, [nid]: '' } }))); }} className="min-w-[80px] bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 hover:bg-white hover:text-indigo-500 transition-all"><Plus /></button>
            </div>
            <div className="space-y-4">
              <h3 className="font-black text-xs text-slate-400 uppercase tracking-[0.2em] ml-2">Preços por Item</h3>
              {sortedProducts.map(p => (
                <div key={p.id} className={`bg-white p-5 rounded-[2rem] border shadow-sm transition-all ${p.inCart ? 'border-slate-50 opacity-60' : 'border-slate-100'}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center text-[10px] font-black text-indigo-600">{p.quantity}x</div>
                    <span className={`font-black ${p.inCart ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{p.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {markets.map(m => (
                      <div key={m.id} className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest">{m.name}</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">R$</span>
                          <input type="text" inputMode="numeric" value={p.prices[m.id] ? parseFloat(p.prices[m.id]).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''} onChange={(e) => setProducts(products.map(i => i.id === p.id ? { ...i, prices: { ...i.prices, [m.id]: handlePriceMask(e.target.value) } } : i))} className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-8 pr-3 py-2.5 text-sm font-black text-slate-700 focus:bg-white focus:border-indigo-500 outline-none transition-all" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {showResetModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-5 animate-in fade-in">
            <div className="bg-white rounded-[2.5rem] p-6 w-full max-w-sm shadow-2xl space-y-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><RefreshCw className="w-6 h-6" /></div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Nova Compra</h3>
                <p className="text-sm text-slate-500 font-medium">O que deseja fazer com a sua lista atual?</p>
              </div>
              <div className="space-y-3">
                <button onClick={() => { setProducts(products.map(p => { const emptyPrices = {}; markets.forEach(m => emptyPrices[m.id] = ''); return { ...p, prices: emptyPrices, inCart: false }; })); setShowResetModal(false); }} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-200">Manter itens e zerar preços</button>
                <button onClick={() => { setProducts([]); setShowResetModal(false); }} className="w-full bg-rose-50 text-rose-600 font-bold py-4 rounded-2xl hover:bg-rose-100 active:scale-95 transition-all">Apagar tudo (Lista vazia)</button>
                <button onClick={() => setShowResetModal(false)} className="w-full text-slate-400 font-bold py-4 rounded-2xl hover:bg-slate-50 transition-all">Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {categoryPickerFor && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-5 animate-in fade-in" onClick={() => setCategoryPickerFor(null)}>
            <div className="bg-white rounded-[2.5rem] p-6 w-full max-w-sm shadow-2xl space-y-5" onClick={(e) => e.stopPropagation()}>
              <div className="text-center space-y-1">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Categoria</h3>
                <p className="text-sm text-slate-500 font-medium">Onde esse item se encaixa?</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {CATEGORIES.map(cat => {
                  const CatIcon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => { setProducts(products.map(i => i.id === categoryPickerFor ? { ...i, category: cat.id } : i)); setCategoryPickerFor(null); }}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 ${cat.bg} ${cat.text} ${cat.border} hover:scale-105 active:scale-95 transition-all`}
                    >
                      <CatIcon className="w-5 h-5" />
                      <span className="text-[9px] font-black uppercase tracking-tight text-center leading-tight">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setCategoryPickerFor(null)} className="w-full text-slate-400 font-bold py-3 rounded-2xl hover:bg-slate-50 transition-all">Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- ESTRUTURA PRINCIPAL ---
export default function App() {
  const [activeTab, setActiveTab] = useState('list');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-indigo-100">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-2xl shadow-lg shadow-indigo-200">
            <ShoppingCart className="w-5 h-5 text-white" />
          </div>
          <span className="font-black text-xl text-slate-900 tracking-tighter italic uppercase">ShopSmart</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 uppercase tracking-widest shadow-sm">
            <Smartphone className="w-3 h-3" /> Memória Local
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full overflow-y-auto">
        {activeTab === 'list' && <ComparatorView />}
        {activeTab === 'calc' && <UnitCalculatorView />}
        {activeTab === 'fuel' && <FuelCalculatorView />}
        
        {/* Assinatura Thiago de Souza Reis */}
        <footer className="py-10 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">
            Criado por Thiago de Souza Reis
          </p>
        </footer>
      </main>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-md bg-white/90 backdrop-blur-xl border border-slate-200 h-20 rounded-[2.5rem] shadow-2xl flex items-center px-2 gap-2 z-50">
        <button 
          onClick={() => setActiveTab('list')} 
          className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-[2rem] transition-all duration-500 ${activeTab === 'list' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 translate-y-[-10px]' : 'text-slate-400 hover:text-indigo-400'}`}
        >
          <ListPlus className="w-5 h-5" />
          <span className="text-[8px] font-black uppercase tracking-[0.2em]">Lista</span>
        </button>
        <button 
          onClick={() => setActiveTab('calc')} 
          className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-[2rem] transition-all duration-500 ${activeTab === 'calc' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 translate-y-[-10px]' : 'text-slate-400 hover:text-indigo-400'}`}
        >
          <Scale className="w-5 h-5" />
          <span className="text-[8px] font-black uppercase tracking-[0.2em]">Preços</span>
        </button>
        <button 
          onClick={() => setActiveTab('fuel')} 
          className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-[2rem] transition-all duration-500 ${activeTab === 'fuel' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 translate-y-[-10px]' : 'text-slate-400 hover:text-indigo-400'}`}
        >
          <Fuel className="w-5 h-5" />
          <span className="text-[8px] font-black uppercase tracking-[0.2em]">Trajeto</span>
        </button>
      </nav>
    </div>
  );
}