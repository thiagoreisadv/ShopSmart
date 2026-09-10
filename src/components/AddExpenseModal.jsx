import { useRef, useState } from 'react';
import { Camera, Loader2, Receipt, Trash2, X } from 'lucide-react';
import { handlePriceMask } from '../utils/format';
import { EXPENSE_CATEGORIES } from '../utils/expenseCategories';
import { compressImage } from '../utils/image';
import { extractTotalFromText } from '../utils/receiptParser';

const todayISODate = () => new Date().toISOString().slice(0, 10);

// --- MODAL: NOVO LANÇAMENTO FINANCEIRO (manual ou por foto de nota fiscal) ---
export default function AddExpenseModal({ onClose, onSave }) {
  const fileInputRef = useRef(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('mercado');
  const [date, setDate] = useState(todayISODate());
  const [label, setLabel] = useState('');
  const [photo, setPhoto] = useState(null);
  const [ocrStatus, setOcrStatus] = useState('idle'); // idle | reading | done | error

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    let compressed;
    try {
      compressed = await compressImage(file);
    } catch {
      return;
    }
    setPhoto(compressed);
    setOcrStatus('reading');

    try {
      // Carregada só quando uma foto é anexada: a lib de OCR baixa dados de
      // idioma sob demanda e não deve pesar no carregamento inicial do app.
      const { recognize } = await import('tesseract.js');
      const { data } = await recognize(compressed, 'por');
      const found = extractTotalFromText(data.text);
      if (found) {
        setAmount(found.toFixed(2));
        setOcrStatus('done');
      } else {
        setOcrStatus('error');
      }
    } catch {
      setOcrStatus('error');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (!value || value <= 0) return;
    onSave({
      amount: value,
      category,
      date: new Date(`${date}T12:00:00`).toISOString(),
      label: label.trim(),
      photo,
      source: photo ? 'receipt' : 'manual',
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-5 animate-in fade-in" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 w-full max-w-sm shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Novo Gasto</h3>
          <button type="button" onClick={onClose} className="text-slate-300 dark:text-slate-600 hover:text-slate-500 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="hidden" />
          {photo ? (
            <div className="relative">
              <img src={photo} alt="Nota fiscal" className="w-full h-40 object-cover rounded-2xl" />
              <button
                type="button"
                onClick={() => { setPhoto(null); setOcrStatus('idle'); }}
                className="absolute top-2 right-2 bg-slate-900/70 text-white p-1.5 rounded-full hover:bg-slate-900 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              {ocrStatus === 'reading' && (
                <div className="absolute inset-0 bg-slate-900/60 rounded-2xl flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                  <span className="text-white text-xs font-black uppercase tracking-widest">Lendo nota...</span>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-5 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400 dark:text-slate-500 font-bold flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-indigo-300 hover:text-indigo-500 transition-all text-sm"
            >
              <Camera className="w-5 h-5" /> Tirar foto da nota fiscal
            </button>
          )}
          {ocrStatus === 'done' && (
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1"><Receipt className="w-3 h-3" /> Valor lido automaticamente — confira antes de salvar.</p>
          )}
          {ocrStatus === 'error' && (
            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-2">Não consegui ler o valor da nota. Digite manualmente abaixo.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase ml-1">Valor</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
            <input
              type="text" inputMode="numeric" placeholder="0,00" autoFocus
              value={amount ? parseFloat(amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
              onChange={(e) => setAmount(handlePriceMask(e.target.value))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl pl-9 pr-3 py-3 font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase ml-1">Categoria</label>
          <div className="grid grid-cols-4 gap-2">
            {EXPENSE_CATEGORIES.map(cat => {
              const CatIcon = cat.icon;
              const isSelected = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-2xl border-2 transition-all ${isSelected ? `${cat.bg} ${cat.text} ${cat.border}` : 'bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 border-transparent'}`}
                >
                  <CatIcon className="w-4 h-4" />
                  <span className="text-[8px] font-black uppercase tracking-tight text-center leading-tight">{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase ml-1">Data</label>
            <input
              type="date" value={date} max={todayISODate()} onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl px-3 py-3 font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase ml-1">Estabelecimento</label>
            <input
              type="text" placeholder="Opcional" value={label} onChange={(e) => setLabel(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl px-3 py-3 font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!amount || parseFloat(amount) <= 0}
          className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-40 disabled:pointer-events-none"
        >
          Salvar Gasto
        </button>
      </form>
    </div>
  );
}
