import { useState } from 'react';

const META_KEY = 'shopsmart_lists_meta';
const ACTIVE_KEY = 'shopsmart_active_list';
const DEFAULT_LIST_ID = 'default';

export const listStorageKeys = (listId) => ({
  markets: `shopsmart_list_${listId}_markets`,
  products: `shopsmart_list_${listId}_products`,
  budget: `shopsmart_list_${listId}_budget`,
  history: `shopsmart_list_${listId}_history`,
});

// Migra os dados antigos (uma única lista fixa) para o formato de múltiplas listas,
// na primeira vez que o usuário abrir o app depois dessa atualização.
function migrateLegacyData() {
  const legacyProducts = localStorage.getItem('shopsmart_products');
  const legacyMarkets = localStorage.getItem('shopsmart_markets');
  const legacyBudget = localStorage.getItem('shopsmart_budget');
  const keys = listStorageKeys(DEFAULT_LIST_ID);
  if (legacyProducts !== null) localStorage.setItem(keys.products, legacyProducts);
  if (legacyMarkets !== null) localStorage.setItem(keys.markets, legacyMarkets);
  if (legacyBudget !== null) localStorage.setItem(keys.budget, JSON.stringify(legacyBudget));
}

export function useLists() {
  const [lists, setListsState] = useState(() => {
    const saved = localStorage.getItem(META_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // dados corrompidos, recria abaixo
      }
    }
    const defaultList = { id: DEFAULT_LIST_ID, name: 'Minha Lista', createdAt: Date.now() };
    migrateLegacyData();
    localStorage.setItem(META_KEY, JSON.stringify([defaultList]));
    return [defaultList];
  });

  const [activeListId, setActiveListIdState] = useState(() => {
    const saved = localStorage.getItem(ACTIVE_KEY);
    if (saved && lists.some(l => l.id === saved)) return saved;
    return lists[0].id;
  });

  const persistLists = (newLists) => {
    setListsState(newLists);
    localStorage.setItem(META_KEY, JSON.stringify(newLists));
  };

  const setActiveListId = (id) => {
    setActiveListIdState(id);
    localStorage.setItem(ACTIVE_KEY, id);
  };

  const addList = (name) => {
    const id = `l${Date.now()}`;
    const newList = { id, name: name.trim() || 'Nova Lista', createdAt: Date.now() };
    persistLists([...lists, newList]);
    setActiveListId(id);
    return id;
  };

  const renameList = (id, name) => {
    if (!name.trim()) return;
    persistLists(lists.map(l => l.id === id ? { ...l, name: name.trim() } : l));
  };

  const deleteList = (id) => {
    if (lists.length <= 1) return;
    const remaining = lists.filter(l => l.id !== id);
    persistLists(remaining);
    const keys = listStorageKeys(id);
    Object.values(keys).forEach(k => localStorage.removeItem(k));
    if (activeListId === id) setActiveListId(remaining[0].id);
  };

  return { lists, activeListId, setActiveListId, addList, renameList, deleteList };
}
