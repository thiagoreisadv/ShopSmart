import { listStorageKeys } from '../hooks/useLists';

const META_KEY = 'shopsmart_lists_meta';

// Lê, direto do localStorage, as compras já finalizadas em todas as listas
// (aba Lista > Histórico) para juntá-las com os gastos avulsos no painel
// Financeiro. Não é reativo por hook porque cada aba já remonta do zero
// sempre que o usuário navega até ela, então uma leitura por montagem basta.
export function getAllListPurchases() {
  let lists = [];
  try {
    lists = JSON.parse(localStorage.getItem(META_KEY)) || [];
  } catch {
    lists = [];
  }

  const purchases = [];
  lists.forEach(list => {
    const keys = listStorageKeys(list.id);
    let history = [];
    try {
      history = JSON.parse(localStorage.getItem(keys.history)) || [];
    } catch {
      history = [];
    }
    history.forEach(entry => {
      purchases.push({
        id: entry.id,
        date: entry.date,
        amount: entry.total,
        category: 'mercado',
        label: entry.marketName || 'Mercado',
        listName: list.name,
        source: 'list',
      });
    });
  });
  return purchases;
}
