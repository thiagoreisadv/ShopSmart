import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, TrendingDown, TrendingUp, Wallet, X } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { EXPENSE_CATEGORIES, getExpenseCategory } from '../utils/expenseCategories';
import { useExpenses } from '../hooks/useExpenses';
import { getAllListPurchases } from '../utils/listHistory';
import AddExpenseModal from './AddExpenseModal';

const monthKeyOf = (iso) => iso.slice(0, 7);

const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const shiftMonth = (key, delta) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const formatDay = (dateKey) => {
  const d = new Date(`${dateKey}T00:00:00`);
  const label = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

// --- COMPONENTE: CONTROLE FINANCEIRO ---
export default function FinanceView() {
  const { expenses, addExpense, deleteExpense } = useExpenses();
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(() => monthKeyOf(new Date().toISOString()));

  const currentRealMonth = monthKeyOf(new Date().toISOString());

  // Junta as compras já finalizadas nas listas com os gastos avulsos
  // (manuais ou por foto de nota) num único extrato.
  const allExpenses = useMemo(() => {
    const listPurchases = getAllListPurchases();
    return [...expenses, ...listPurchases].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [expenses]);

  const monthlyTotals = useMemo(() => {
    const map = {};
    allExpenses.forEach(e => {
      const key = monthKeyOf(e.date);
      map[key] = (map[key] || 0) + e.amount;
    });
    return map;
  }, [allExpenses]);

  const last6Months = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) months.push(shiftMonth(selectedMonth, -i));
    return months;
  }, [selectedMonth]);

  const maxMonthTotal = Math.max(1, ...last6Months.map(k => monthlyTotals[k] || 0));

  const currentMonthExpenses = useMemo(
    () => allExpenses.filter(e => monthKeyOf(e.date) === selectedMonth),
    [allExpenses, selectedMonth]
  );

  const currentTotal = monthlyTotals[selectedMonth] || 0;
  const previousTotal = monthlyTotals[shiftMonth(selectedMonth, -1)] || 0;
  const delta = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : null;

  const categoryTotals = useMemo(() => {
    const map = {};
    currentMonthExpenses.forEach(e => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    return EXPENSE_CATEGORIES
      .map(cat => ({ category: cat, total: map[cat.id] || 0 }))
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [currentMonthExpenses]);

  const groupedByDate = useMemo(() => {
    const groups = {};
    currentMonthExpenses.forEach(e => {
      const dateKey = e.date.slice(0, 10);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(e);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [currentMonthExpenses]);

  const handleSaveExpense = (expense) => {
    addExpense(expense);
    setShowAddModal(false);
  };

  return (
    <div className="p-5 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Financeiro</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Controle completo dos seus gastos.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-indigo-600 text-white p-3.5 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none active:scale-95 transition-all hover:bg-indigo-700"
        >
          <Plus className="w-5 h-5" />
        </button>
      </header>

      <section className="bg-indigo-600 rounded-[2.5rem] p-6 text-white shadow-2xl shadow-indigo-200 dark:shadow-none relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
        <div className="relative z-10 space-y-5">
          <div className="flex items-center justify-between">
            <button onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-black uppercase tracking-widest">{monthLabel(selectedMonth)}</span>
            <button
              onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
              disabled={selectedMonth >= currentRealMonth}
              className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-end justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Total do mês</span>
              <div className="text-3xl font-black">{formatCurrency(currentTotal)}</div>
            </div>
            {delta !== null && (
              <div className={`flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-full ${delta > 0 ? 'bg-rose-400/20 text-rose-200' : 'bg-emerald-400/20 text-emerald-200'}`}>
                {delta > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {Math.abs(delta).toFixed(0)}% vs mês anterior
              </div>
            )}
          </div>

          <div className="flex items-end gap-2 h-20 pt-2">
            {last6Months.map(key => {
              const value = monthlyTotals[key] || 0;
              const heightPct = value > 0 ? Math.max((value / maxMonthTotal) * 100, 6) : 2;
              const isSelected = key === selectedMonth;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedMonth(key)}
                  className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full group"
                >
                  <div
                    className={`w-full rounded-t-lg transition-all ${isSelected ? 'bg-white' : 'bg-white/25 group-hover:bg-white/40'}`}
                    style={{ height: `${heightPct}%` }}
                  ></div>
                  <span className={`text-[8px] font-black uppercase ${isSelected ? 'text-white' : 'text-indigo-200'}`}>
                    {monthLabel(key).slice(0, 3)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {categoryTotals.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-black text-xs text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-2">Por Categoria</h3>
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
            {categoryTotals.map(({ category: cat, total }) => {
              const CatIcon = cat.icon;
              const pct = currentTotal > 0 ? (total / currentTotal) * 100 : 0;
              return (
                <div key={cat.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`flex items-center gap-1.5 font-black ${cat.text}`}><CatIcon className="w-3.5 h-3.5" /> {cat.label}</span>
                    <span className="font-black text-slate-600 dark:text-slate-300">{formatCurrency(total)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${cat.bar}`} style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h3 className="font-black text-xs text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-2">Lançamentos</h3>
        {groupedByDate.length === 0 ? (
          <div className="py-16 flex flex-col items-center opacity-20">
            <Wallet className="w-16 h-16 mb-4" />
            <p className="font-black uppercase tracking-widest text-xs text-center">Nenhum gasto neste mês</p>
          </div>
        ) : (
          <div className="space-y-5">
            {groupedByDate.map(([dateKey, items]) => (
              <div key={dateKey} className="space-y-2">
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">{formatDay(dateKey)}</span>
                {items.map(item => {
                  const cat = getExpenseCategory(item.category);
                  const CatIcon = cat.icon;
                  return (
                    <div key={item.id} className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-50 dark:border-slate-800 shadow-sm flex items-center gap-3">
                      <button
                        onClick={() => item.photo && setViewingPhoto(item.photo)}
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${cat.bg} ${cat.text} ${item.photo ? 'cursor-zoom-in' : ''}`}
                      >
                        <CatIcon className="w-5 h-5" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-700 dark:text-slate-200 truncate">{item.label || cat.label}</p>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                          {item.source === 'list' ? `Via lista ${item.listName}` : cat.label}
                        </p>
                      </div>
                      <span className="font-black text-slate-800 dark:text-slate-100 flex-shrink-0">{formatCurrency(item.amount)}</span>
                      {item.source !== 'list' && (
                        <button onClick={() => deleteExpense(item.id)} className="text-slate-200 dark:text-slate-700 hover:text-rose-500 transition-colors flex-shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </section>

      {showAddModal && (
        <AddExpenseModal onClose={() => setShowAddModal(false)} onSave={handleSaveExpense} />
      )}

      {viewingPhoto && (
        <div className="fixed inset-0 bg-slate-950/90 z-[110] flex items-center justify-center p-5" onClick={() => setViewingPhoto(null)}>
          <button className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors" onClick={() => setViewingPhoto(null)}><X className="w-6 h-6" /></button>
          <img src={viewingPhoto} alt="Nota fiscal" className="max-w-full max-h-full rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
