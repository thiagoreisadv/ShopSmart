import { useRef, useState } from 'react';
import { Check, ChevronRight, Download, FolderOpen, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';

// --- MODAL: TROCAR / GERENCIAR LISTAS + BACKUP ---
export default function ListSwitcherModal({
  onClose,
  lists,
  activeListId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onExport,
  onImportFile,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [newListName, setNewListName] = useState('');
  const fileInputRef = useRef(null);

  const startEditing = (list) => { setEditingId(list.id); setEditingName(list.name); };
  const confirmEditing = () => { onRename(editingId, editingName); setEditingId(null); };

  const handleImportClick = () => fileInputRef.current?.click();
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onImportFile(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-5 animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 w-full max-w-sm shadow-2xl space-y-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-indigo-500" /> Minhas Listas
          </h3>
          <button onClick={onClose} className="text-slate-300 dark:text-slate-600 hover:text-slate-500 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-2">
          {lists.map(list => (
            <div key={list.id} className={`flex items-center gap-2 p-3 rounded-2xl border-2 transition-all ${list.id === activeListId ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20' : 'border-slate-100 dark:border-slate-800'}`}>
              {editingId === list.id ? (
                <>
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && confirmEditing()}
                    className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500"
                  />
                  <button onClick={confirmEditing} className="text-emerald-500 hover:text-emerald-600 flex-shrink-0"><Check className="w-4 h-4" /></button>
                </>
              ) : (
                <>
                  <button onClick={() => onSelect(list.id)} className="flex-1 flex items-center gap-2 text-left">
                    <span className={`font-bold ${list.id === activeListId ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300'}`}>{list.name}</span>
                    {list.id === activeListId && <ChevronRight className="w-4 h-4 text-indigo-400" />}
                  </button>
                  <button onClick={() => startEditing(list)} className="text-slate-300 dark:text-slate-600 hover:text-indigo-500 flex-shrink-0 transition-colors"><Pencil className="w-4 h-4" /></button>
                  {lists.length > 1 && (
                    <button
                      onClick={() => { if (window.confirm(`Excluir a lista "${list.name}" e todos os seus itens? Essa ação não pode ser desfeita.`)) onDelete(list.id); }}
                      className="text-slate-300 dark:text-slate-600 hover:text-rose-500 flex-shrink-0 transition-colors"
                    ><Trash2 className="w-4 h-4" /></button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); if (newListName.trim()) { onAdd(newListName); setNewListName(''); } }}
          className="flex gap-2"
        >
          <input
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="Ex: Churrasco de sábado"
            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl px-4 py-2.5 font-bold text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          <button type="submit" className="bg-indigo-600 text-white p-2.5 rounded-2xl active:scale-95 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"><Plus className="w-5 h-5" /></button>
        </form>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Backup da lista atual</p>
          <div className="flex gap-2">
            <button onClick={onExport} className="flex-1 flex items-center justify-center gap-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm py-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">
              <Download className="w-4 h-4" /> Exportar
            </button>
            <button onClick={handleImportClick} className="flex-1 flex items-center justify-center gap-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm py-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">
              <Upload className="w-4 h-4" /> Importar
            </button>
            <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileChange} className="hidden" />
          </div>
        </div>
      </div>
    </div>
  );
}
