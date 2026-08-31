import { useLocalStorage } from './useLocalStorage';

const KEY = 'shopsmart_frequent_items';

// Guarda, entre todas as listas, quais produtos o usuário mais adiciona,
// para sugerir como atalho na hora de montar uma nova lista.
export function useFrequentItems() {
  const [items, setItems] = useLocalStorage(KEY, {});

  const track = (name, category) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    const existing = items[key];
    setItems({
      ...items,
      [key]: {
        name: existing?.name || trimmed,
        category: category || existing?.category || 'geral',
        count: (existing?.count || 0) + 1,
      },
    });
  };

  const top = (excludeNames = [], limit = 8) => {
    const excludeSet = new Set(excludeNames.map(n => n.trim().toLowerCase()));
    return Object.values(items)
      .filter(i => !excludeSet.has(i.name.trim().toLowerCase()))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  };

  return { track, top };
}
