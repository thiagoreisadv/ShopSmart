import { Clock, Trash2, X } from 'lucide-react';
import { formatCurrency } from '../utils/format';

const formatDate = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

// --- MODAL: HISTÓRICO DE COMPRAS FINALIZADAS ---
export default function HistoryModal({ history, onClose, onDelete }) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-5 animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 w-full max-w-sm shadow-2xl space-y-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" /> Histórico
          </h3>
          <button onClick={onClose} className="text-slate-300 dark:text-slate-600 hover:text-slate-500 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 font-medium text-center py-8">Nenhuma compra finalizada ainda.</p>
        ) : (
          <div className="space-y-3">
            {history.map(entry => (
              <div key={entry.id} className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5">{formatDate(entry.date)}</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{entry.marketName || 'Sem mercado definido'}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-bold block">{entry.boughtCount}/{entry.itemCount} itens</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-black text-indigo-600 dark:text-indigo-300">{formatCurrency(entry.total)}</span>
                  <button onClick={() => onDelete(entry.id)} className="text-slate-200 dark:text-slate-700 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
