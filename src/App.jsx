import { useState } from 'react';
import { ShoppingCart, Smartphone, ListPlus, Scale, Fuel, Sun, Moon } from 'lucide-react';
import ComparatorView from './components/ComparatorView';
import UnitCalculatorView from './components/UnitCalculatorView';
import FuelCalculatorView from './components/FuelCalculatorView';
import { useLists } from './hooks/useLists';
import { useTheme } from './hooks/useTheme';

// --- ESTRUTURA PRINCIPAL ---
export default function App() {
  const [activeTab, setActiveTab] = useState('list');
  const { lists, activeListId, setActiveListId, addList, renameList, deleteList } = useLists();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans selection:bg-indigo-100 transition-colors">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none">
            <ShoppingCart className="w-5 h-5 text-white" />
          </div>
          <span className="font-black text-xl text-slate-900 dark:text-white tracking-tighter italic uppercase">ShopSmart</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-8 h-8 text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-full border border-emerald-100 dark:border-emerald-800 uppercase tracking-widest shadow-sm">
            <Smartphone className="w-3 h-3" /> Memória Local
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full overflow-y-auto">
        {activeTab === 'list' && (
          <ComparatorView
            key={activeListId}
            listId={activeListId}
            lists={lists}
            activeListId={activeListId}
            onSelectList={setActiveListId}
            onAddList={addList}
            onRenameList={renameList}
            onDeleteList={deleteList}
          />
        )}
        {activeTab === 'calc' && <UnitCalculatorView />}
        {activeTab === 'fuel' && <FuelCalculatorView />}

        {/* Assinatura Thiago de Souza Reis */}
        <footer className="py-10 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 dark:text-slate-700">
            Criado por Thiago de Souza Reis
          </p>
        </footer>
      </main>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 h-20 rounded-[2.5rem] shadow-2xl flex items-center px-2 gap-2 z-50">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-[2rem] transition-all duration-500 ${activeTab === 'list' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 dark:shadow-none translate-y-[-10px]' : 'text-slate-400 dark:text-slate-500 hover:text-indigo-400'}`}
        >
          <ListPlus className="w-5 h-5" />
          <span className="text-[8px] font-black uppercase tracking-[0.2em]">Lista</span>
        </button>
        <button
          onClick={() => setActiveTab('calc')}
          className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-[2rem] transition-all duration-500 ${activeTab === 'calc' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 dark:shadow-none translate-y-[-10px]' : 'text-slate-400 dark:text-slate-500 hover:text-indigo-400'}`}
        >
          <Scale className="w-5 h-5" />
          <span className="text-[8px] font-black uppercase tracking-[0.2em]">Preços</span>
        </button>
        <button
          onClick={() => setActiveTab('fuel')}
          className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-[2rem] transition-all duration-500 ${activeTab === 'fuel' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 dark:shadow-none translate-y-[-10px]' : 'text-slate-400 dark:text-slate-500 hover:text-indigo-400'}`}
        >
          <Fuel className="w-5 h-5" />
          <span className="text-[8px] font-black uppercase tracking-[0.2em]">Trajeto</span>
        </button>
      </nav>
    </div>
  );
}
