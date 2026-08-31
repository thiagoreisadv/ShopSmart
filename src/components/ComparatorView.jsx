import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  Package,
  Star,
  CheckCircle2,
  Share2,
  Circle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  ChevronRight,
  Clock,
  Undo2,
  X,
  Trophy,
  StickyNote,
  BadgeCheck,
  ScanBarcode,
} from 'lucide-react';
import { formatCurrency, handlePriceMask } from '../utils/format';
import { CATEGORIES, getCategory } from '../utils/categories';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useFrequentItems } from '../hooks/useFrequentItems';
import { listStorageKeys } from '../hooks/useLists';
import ListSwitcherModal from './ListSwitcherModal';
import HistoryModal from './HistoryModal';

// Carregada só quando o scanner é aberto: a lib de leitura de código de barras
// é pesada e não deve inflar o carregamento inicial do app para quem não usa.
const BarcodeScannerModal = lazy(() => import('./BarcodeScannerModal'));

const UNDO_TIMEOUT_MS = 5000;

// --- COMPONENTE: LISTA DE COMPRAS ---
export default function ComparatorView({
  listId,
  lists,
  activeListId,
  onSelectList,
  onAddList,
  onRenameList,
  onDeleteList,
}) {
  const keys = listStorageKeys(listId);
  const activeList = lists.find(l => l.id === activeListId);

  const [viewMode, setViewMode] = useState('list');
  const [newProductName, setNewProductName] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [showListSwitcher, setShowListSwitcher] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [categoryPickerFor, setCategoryPickerFor] = useState(null);
  const [collapsedCategories, setCollapsedCategories] = useState(() => new Set());
  const [undoState, setUndoState] = useState(null);
  const [notesEditingFor, setNotesEditingFor] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [showScanner, setShowScanner] = useState(false);

  const [markets, setMarkets] = useLocalStorage(keys.markets, [
    { id: 'm1', name: 'Mercado A', discountPercent: '' },
    { id: 'm2', name: 'Mercado B', discountPercent: '' }
  ]);
  const [products, setProducts] = useLocalStorage(keys.products, []);
  const [budget, setBudget] = useLocalStorage(keys.budget, '0');
  const [history, setHistory] = useLocalStorage(keys.history, []);
  const { track: trackFrequentItem, top: topFrequentItems } = useFrequentItems();

  useEffect(() => () => { if (undoState?.timer) clearTimeout(undoState.timer); }, [undoState]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const addProductByName = (name, category = 'geral') => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const iP = {};
    markets.forEach(m => iP[m.id] = '');
    const nP = [{ id: `p${Date.now()}`, name: trimmed, quantity: 1, prices: iP, category, isEssential: false, inCart: false, note: '' }, ...products];
    setProducts(nP);
    trackFrequentItem(trimmed, category);
  };

  const addProduct = (e) => {
    e.preventDefault();
    addProductByName(newProductName);
    setNewProductName('');
  };

  const addFromScanner = (name) => {
    setNewProductName(name);
    setShowScanner(false);
  };

  const deleteProduct = (p) => {
    const index = products.findIndex(i => i.id === p.id);
    setProducts(products.filter(i => i.id !== p.id));
    if (undoState?.timer) clearTimeout(undoState.timer);
    const timer = setTimeout(() => setUndoState(null), UNDO_TIMEOUT_MS);
    setUndoState({ product: p, index, timer });
  };

  const undoDelete = () => {
    if (!undoState) return;
    clearTimeout(undoState.timer);
    const restored = [...products];
    restored.splice(undoState.index, 0, undoState.product);
    setProducts(restored);
    setUndoState(null);
  };

  const removeMarket = (marketId) => {
    const market = markets.find(m => m.id === marketId);
    if (market && !window.confirm(`Remover "${market.name}"? Os preços cadastrados para esse mercado serão perdidos.`)) return;
    setMarkets(markets.filter(m => m.id !== marketId));
  };

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

  // Menor preço de cada item individualmente, e em qual mercado — útil pra quem
  // compra misturado entre mercados, em vez de fechar tudo num só.
  const cheapestPerItem = useMemo(() => {
    const map = {};
    products.forEach(p => {
      let min = Infinity;
      let marketId = null;
      markets.forEach(m => {
        const val = parseFloat(p.prices[m.id]);
        if (!isNaN(val) && val < min) { min = val; marketId = m.id; }
      });
      map[p.id] = marketId ? { price: min, marketId } : null;
    });
    return map;
  }, [products, markets]);

  const mixedTotal = useMemo(() => {
    return products.reduce((sum, p) => {
      const cheapest = cheapestPerItem[p.id];
      return cheapest ? sum + cheapest.price * p.quantity : sum;
    }, 0);
  }, [products, cheapestPerItem]);

  const mixedSavings = bestMarket ? Math.max(totals[bestMarket.id].total - mixedTotal, 0) : 0;

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
      if (a.inCart !== b.inCart) return a.inCart ? 1 : -1;
      if (a.isEssential !== b.isEssential) return a.isEssential ? -1 : 1;
      return 0;
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

  const saveCurrentToHistory = () => {
    if (!bestMarket) return false;
    const total = totals[bestMarket.id]?.total || 0;
    if (total <= 0) return false;
    const entry = {
      id: `h${Date.now()}`,
      date: new Date().toISOString(),
      marketName: bestMarket.name,
      total,
      itemCount: products.length,
      boughtCount: inCartCount,
    };
    setHistory([entry, ...history]);
    return true;
  };

  const finishPurchaseKeepList = () => {
    const saved = saveCurrentToHistory();
    setToastMessage(saved ? 'Compra registrada no histórico!' : 'Defina preços em algum mercado antes de concluir.');
  };

  const frequentSuggestions = useMemo(
    () => topFrequentItems(products.map(p => p.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products]
  );

  const handleExport = () => {
    const data = { name: activeList?.name || 'Lista', markets, products, budget, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shopsmart-${(activeList?.name || 'lista').toLowerCase().replace(/\s+/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data.products) || !Array.isArray(data.markets)) throw new Error('formato inválido');
        setMarkets(data.markets);
        setProducts(data.products);
        setBudget(data.budget || '0');
      } catch {
        alert('Não foi possível importar. Selecione um arquivo de backup exportado pelo ShopSmart.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="animate-in fade-in duration-700 pb-32">
      <div className="px-5 pt-5">
        <button
          onClick={() => setShowListSwitcher(true)}
          className="flex items-center gap-1.5 text-xs font-black text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/40 px-3 py-1.5 rounded-full mb-3 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 transition-colors"
        >
          <FolderOpen className="w-3.5 h-3.5" /> {activeList?.name || 'Minha Lista'} <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="px-5">
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

      <div className="px-5 mb-4 mt-4 flex gap-2">
        <div className="flex flex-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
          <button onClick={() => setViewMode('list')} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}>Lista</button>
          <button onClick={() => setViewMode('prices')} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${viewMode === 'prices' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}>Preços</button>
        </div>
        <button onClick={handleShare} className="bg-emerald-500 text-white px-4 rounded-2xl active:scale-95 transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 hover:bg-emerald-600">
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      <div className="px-5">
        {viewMode === 'list' ? (
          <div className="space-y-4">
            <form onSubmit={addProduct} className="bg-white dark:bg-slate-900 p-2 pl-5 rounded-3xl border border-slate-100 dark:border-slate-800 flex gap-2 shadow-sm focus-within:ring-4 ring-indigo-500/10 transition-all">
              <input type="text" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} placeholder="Ex: Leite Integral" className="flex-1 outline-none font-bold text-slate-700 dark:text-slate-200 bg-transparent placeholder:text-slate-300 dark:placeholder:text-slate-600" />
              <button type="button" onClick={() => setShowScanner(true)} className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 p-3 rounded-2xl active:scale-95 transition-all hover:bg-slate-200 dark:hover:bg-slate-700"><ScanBarcode className="w-5 h-5" /></button>
              <button type="submit" className="bg-indigo-600 text-white p-3 rounded-2xl active:scale-95 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"><Plus className="w-5 h-5" /></button>
            </form>

            {frequentSuggestions.length > 0 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {frequentSuggestions.map(item => (
                  <button
                    key={item.name}
                    onClick={() => addProductByName(item.name, item.category)}
                    className="flex-shrink-0 flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold px-3 py-2 rounded-full shadow-sm hover:border-indigo-200 dark:hover:border-indigo-800 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all"
                  >
                    <Plus className="w-3 h-3" /> {item.name}
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center px-2 mt-4 mb-2 gap-2 flex-wrap">
              <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{products.length > 0 ? `${inCartCount} de ${products.length} Pegos` : 'Lista Vazia'}</span>
              <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
                <button onClick={() => setShowHistory(true)} className="text-[10px] font-black text-slate-500 dark:text-slate-400 flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors uppercase tracking-widest">
                  <Clock className="w-3 h-3" /> Histórico
                </button>
                {products.length > 0 && (
                  <>
                    <button onClick={finishPurchaseKeepList} className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors uppercase tracking-widest">
                      <BadgeCheck className="w-3 h-3" /> Concluir
                    </button>
                    <button onClick={() => setShowResetModal(true)} className="text-[10px] font-black text-indigo-600 dark:text-indigo-300 flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/40 px-3 py-1.5 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/70 transition-colors uppercase tracking-widest">
                      <RefreshCw className="w-3 h-3" /> Nova Compra
                    </button>
                  </>
                )}
              </div>
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
                        <div key={p.id} className={`bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-50 dark:border-slate-800 shadow-sm hover:shadow-md transition-all ${p.isEssential ? 'border-l-4 border-l-amber-400' : ''} ${p.inCart ? 'opacity-50 bg-slate-50 dark:bg-slate-800/50 scale-[0.98]' : ''}`}>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3 w-full mr-4">
                              <button onClick={() => setProducts(products.map(i => i.id === p.id ? {...i, inCart: !i.inCart} : i))} className="text-slate-300 dark:text-slate-600 hover:text-emerald-500 transition-colors flex-shrink-0">
                                {p.inCart ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <Circle className="w-6 h-6" />}
                              </button>
                              <button onClick={() => setProducts(products.map(i => i.id === p.id ? {...i, isEssential: !i.isEssential} : i))} className={`transition-colors flex-shrink-0 ${p.isEssential ? 'text-amber-400' : 'text-slate-200 dark:text-slate-700'}`}>
                                <Star className={`w-5 h-5 ${p.isEssential ? 'fill-current' : ''}`} />
                              </button>
                              <button onClick={() => setCategoryPickerFor(p.id)} className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${cat.bg} ${cat.text}`}>
                                <CatIcon className="w-4 h-4" />
                              </button>
                              <input
                                type="text" value={p.name} onChange={(e) => setProducts(products.map(i => i.id === p.id ? {...i, name: e.target.value} : i))}
                                className={`font-bold leading-tight bg-transparent outline-none w-full focus:border-b-2 focus:border-indigo-200 transition-all ${p.inCart ? 'text-slate-400 dark:text-slate-600 line-through' : 'text-slate-700 dark:text-slate-200'}`}
                              />
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <div className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-xl px-1">
                                <button onClick={() => { if(p.quantity > 1) setProducts(products.map(i => i.id === p.id ? {...i, quantity: i.quantity - 1} : i)) }} className="w-8 h-8 font-black text-slate-400 dark:text-slate-500 hover:text-indigo-600 transition-colors">-</button>
                                <span className="w-6 text-center text-xs font-black text-slate-700 dark:text-slate-200">{p.quantity}</span>
                                <button onClick={() => setProducts(products.map(i => i.id === p.id ? {...i, quantity: i.quantity + 1} : i))} className="w-8 h-8 font-black text-slate-400 dark:text-slate-500 hover:text-indigo-600 transition-colors">+</button>
                              </div>
                              <button onClick={() => setNotesEditingFor(notesEditingFor === p.id ? null : p.id)} className={`transition-colors flex-shrink-0 ${p.note ? 'text-amber-500' : 'text-slate-200 dark:text-slate-700 hover:text-slate-400'}`}>
                                <StickyNote className={`w-4 h-4 ${p.note ? 'fill-amber-100' : ''}`} />
                              </button>
                              <button onClick={() => deleteProduct(p)} className="text-slate-200 dark:text-slate-700 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>

                          {(notesEditingFor === p.id || p.note) && (
                            <div className="mt-3 pt-3 border-t border-slate-50 dark:border-slate-800 pl-9">
                              {notesEditingFor === p.id ? (
                                <input
                                  autoFocus
                                  type="text"
                                  value={p.note || ''}
                                  placeholder="Ex: marca específica, sem lactose..."
                                  onChange={(e) => setProducts(products.map(i => i.id === p.id ? {...i, note: e.target.value} : i))}
                                  onBlur={() => setNotesEditingFor(null)}
                                  onKeyDown={(e) => e.key === 'Enter' && setNotesEditingFor(null)}
                                  className="w-full bg-amber-50/60 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-200 outline-none focus:border-amber-300"
                                />
                              ) : (
                                <button onClick={() => setNotesEditingFor(p.id)} className="text-xs text-slate-400 dark:text-slate-500 italic font-medium hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-left">
                                  {p.note}
                                </button>
                              )}
                            </div>
                          )}
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
                <div key={m.id} className={`min-w-[200px] bg-white dark:bg-slate-900 p-5 rounded-[2rem] border-2 transition-all shadow-sm ${bestMarket?.id === m.id ? 'border-indigo-600 ring-4 ring-indigo-500/5' : 'border-slate-100 dark:border-slate-800 opacity-60'}`}>
                  <div className="flex flex-col h-full justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-4 border-b-2 border-slate-50 dark:border-slate-800 focus-within:border-indigo-500 transition-all">
                        <input type="text" value={m.name} onChange={(e) => setMarkets(markets.map(i => i.id === m.id ? {...i, name: e.target.value} : i))} className="bg-transparent font-black text-slate-800 dark:text-slate-100 outline-none w-full pb-1" />
                        {markets.length > 1 && <button onClick={() => removeMarket(m.id)} className="text-slate-300 dark:text-slate-600 hover:text-rose-500 pb-1 px-1 transition-colors"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Desc. %</span>
                        <input type="number" value={m.discountPercent} onChange={(e) => setMarkets(markets.map(i => i.id === m.id ? {...i, discountPercent: e.target.value} : i))} className="bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 font-bold text-[10px] w-10 text-center rounded py-0.5 outline-none" />
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="text-xl font-black text-slate-900 dark:text-white">{formatCurrency(totals[m.id]?.total)}</div>
                      {bestMarket?.id === m.id && <div className="mt-1 text-[9px] font-black text-indigo-600 dark:text-indigo-300 flex items-center gap-1 uppercase tracking-widest"><CheckCircle2 className="w-3 h-3" /> Campeão</div>}
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={() => { const nid = `m${Date.now()}`; setMarkets([...markets, { id: nid, name: 'Mercado', discountPercent: '' }]); setProducts(products.map(p => ({ ...p, prices: { ...p.prices, [nid]: '' } }))); }} className="min-w-[80px] bg-slate-50 dark:bg-slate-800 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-300 dark:text-slate-600 hover:bg-white dark:hover:bg-slate-700 hover:text-indigo-500 transition-all"><Plus /></button>
            </div>

            {mixedTotal > 0 && markets.length > 1 && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-100 dark:border-emerald-800 rounded-[2rem] p-5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5" /> Misturando os mais baratos</span>
                  <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">{formatCurrency(mixedTotal)}</div>
                </div>
                {mixedSavings > 0 && (
                  <div className="text-right">
                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block">Economia</span>
                    <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(mixedSavings)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              <h3 className="font-black text-xs text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-2">Preços por Item</h3>
              {sortedProducts.map(p => (
                <div key={p.id} className={`bg-white dark:bg-slate-900 p-5 rounded-[2rem] border shadow-sm transition-all ${p.inCart ? 'border-slate-50 dark:border-slate-800 opacity-60' : 'border-slate-100 dark:border-slate-800'}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 bg-indigo-50 dark:bg-indigo-900/40 rounded-lg flex items-center justify-center text-[10px] font-black text-indigo-600 dark:text-indigo-300">{p.quantity}x</div>
                    <span className={`font-black ${p.inCart ? 'text-slate-400 dark:text-slate-600 line-through' : 'text-slate-800 dark:text-slate-100'}`}>{p.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {markets.map(m => {
                      const isCheapestForItem = markets.length > 1 && cheapestPerItem[p.id]?.marketId === m.id;
                      return (
                      <div key={m.id} className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase ml-1 tracking-widest flex items-center gap-1">
                          {m.name} {isCheapestForItem && <Trophy className="w-2.5 h-2.5 text-emerald-500" />}
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">R$</span>
                          <input type="text" inputMode="numeric" value={p.prices[m.id] ? parseFloat(p.prices[m.id]).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''} onChange={(e) => setProducts(products.map(i => i.id === p.id ? { ...i, prices: { ...i.prices, [m.id]: handlePriceMask(e.target.value) } } : i))} className={`w-full border rounded-2xl pl-8 pr-3 py-2.5 text-sm font-black text-slate-700 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-500 outline-none transition-all ${isCheapestForItem ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`} />
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {showResetModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-5 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 w-full max-w-sm shadow-2xl space-y-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 rounded-2xl flex items-center justify-center mx-auto mb-4"><RefreshCw className="w-6 h-6" /></div>
                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Nova Compra</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">O que deseja fazer com a sua lista atual?</p>
              </div>
              <div className="space-y-3">
                <button onClick={() => { saveCurrentToHistory(); setProducts(products.map(p => { const emptyPrices = {}; markets.forEach(m => emptyPrices[m.id] = ''); return { ...p, prices: emptyPrices, inCart: false }; })); setShowResetModal(false); }} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-200 dark:shadow-none">Manter itens e zerar preços</button>
                <button onClick={() => { saveCurrentToHistory(); setProducts([]); setShowResetModal(false); }} className="w-full bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 font-bold py-4 rounded-2xl hover:bg-rose-100 dark:hover:bg-rose-900/60 active:scale-95 transition-all">Apagar tudo (Lista vazia)</button>
                <button onClick={() => setShowResetModal(false)} className="w-full text-slate-400 dark:text-slate-500 font-bold py-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {categoryPickerFor && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-5 animate-in fade-in" onClick={() => setCategoryPickerFor(null)}>
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 w-full max-w-sm shadow-2xl space-y-5" onClick={(e) => e.stopPropagation()}>
              <div className="text-center space-y-1">
                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Categoria</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Onde esse item se encaixa?</p>
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
              <button onClick={() => setCategoryPickerFor(null)} className="w-full text-slate-400 dark:text-slate-500 font-bold py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancelar</button>
            </div>
          </div>
        )}

        {showListSwitcher && (
          <ListSwitcherModal
            onClose={() => setShowListSwitcher(false)}
            lists={lists}
            activeListId={activeListId}
            onSelect={(id) => { onSelectList(id); setShowListSwitcher(false); }}
            onAdd={onAddList}
            onRename={onRenameList}
            onDelete={onDeleteList}
            onExport={handleExport}
            onImportFile={handleImportFile}
          />
        )}

        {showHistory && (
          <HistoryModal
            history={history}
            onClose={() => setShowHistory(false)}
            onDelete={(id) => setHistory(history.filter(h => h.id !== id))}
          />
        )}

        {showScanner && (
          <Suspense fallback={
            <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[100] flex items-center justify-center">
              <span className="text-white text-xs font-black uppercase tracking-widest">Carregando scanner...</span>
            </div>
          }>
            <BarcodeScannerModal
              onClose={() => setShowScanner(false)}
              onDetected={addFromScanner}
            />
          </Suspense>
        )}
      </div>

      {undoState && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 w-[92%] max-w-md bg-slate-900 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center justify-between z-[110] animate-in fade-in slide-in-from-bottom-4">
          <span className="text-sm font-bold truncate mr-3">"{undoState.product.name}" removido</span>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button onClick={undoDelete} className="flex items-center gap-1.5 text-emerald-400 font-black text-xs uppercase tracking-widest hover:text-emerald-300 transition-colors">
              <Undo2 className="w-4 h-4" /> Desfazer
            </button>
            <button onClick={() => setUndoState(null)} className="text-slate-400 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {toastMessage && !undoState && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 w-[92%] max-w-md bg-slate-900 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center justify-center z-[110] animate-in fade-in slide-in-from-bottom-4">
          <span className="text-sm font-bold">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
