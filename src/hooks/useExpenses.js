import { useLocalStorage } from './useLocalStorage';

const KEY = 'shopsmart_expenses';

// Gastos lançados manualmente ou via foto de nota fiscal, para completar
// o histórico automático das listas no painel Financeiro.
export function useExpenses() {
  const [expenses, setExpenses] = useLocalStorage(KEY, []);

  const addExpense = (expense) => {
    const entry = {
      id: `e${Date.now()}`,
      date: expense.date || new Date().toISOString(),
      amount: expense.amount,
      category: expense.category || 'outros',
      label: expense.label || '',
      photo: expense.photo || null,
      source: expense.source || 'manual',
    };
    setExpenses([entry, ...expenses]);
    return entry;
  };

  const deleteExpense = (id) => {
    setExpenses(expenses.filter(e => e.id !== id));
  };

  return { expenses, addExpense, deleteExpense };
}
