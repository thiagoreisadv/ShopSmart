/** Categorias herdadas da v1 (ids preservados para compatibilidade com os dados salvos). */
export interface Category {
  id: string
  label: string
  /** nome do ícone Lucide usado em src/components/Icon */
  icon: string
}
export const CATEGORIES: Category[] = [
  { id: 'hortifruti', label: 'Hortifruti', icon: 'Apple' },
  { id: 'acougue', label: 'Açougue e Peixaria', icon: 'Beef' },
  { id: 'padaria', label: 'Padaria', icon: 'Croissant' },
  { id: 'laticinios', label: 'Laticínios e Frios', icon: 'Milk' },
  { id: 'mercearia', label: 'Mercearia', icon: 'Wheat' },
  { id: 'bebidas', label: 'Bebidas', icon: 'Wine' },
  { id: 'congelados', label: 'Congelados', icon: 'Snowflake' },
  { id: 'limpeza', label: 'Limpeza', icon: 'SprayCan' },
  { id: 'higiene', label: 'Higiene e Beleza', icon: 'Sparkles' },
  { id: 'bebes', label: 'Bebês', icon: 'Baby' },
  { id: 'pet', label: 'Pet', icon: 'PawPrint' },
  { id: 'geral', label: 'Outros', icon: 'Package' },
]
export const UNDETAILED_CATEGORY: Category = { id: 'nao-detalhado', label: 'Não detalhado', icon: 'Package' }

export function categoryById(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) ?? (id === UNDETAILED_CATEGORY.id ? UNDETAILED_CATEGORY : CATEGORIES[CATEGORIES.length - 1])
}

/** Mapeia categorias das bases públicas (Open Food Facts etc.) para as categorias do app. */
export function guessCategory(tagsOrText: string): string {
  const t = tagsOrText.toLowerCase()
  const rules: [RegExp, string][] = [
    [/(fruit|fruta|vegetable|legum|verdura|hortifrut)/, 'hortifruti'],
    [/(meat|carne|beef|pork|chicken|frango|fish|peixe|sausage|lingui)/, 'acougue'],
    [/(bread|p[aã]o|bakery|padaria|bolo)/, 'padaria'],
    [/(dairy|milk|leite|cheese|queijo|yogurt|iogurte|butter|manteiga|frios|presunto)/, 'laticinios'],
    [/(beverage|bebida|drink|water|[aá]gua|juice|suco|soda|refrigerante|beer|cerveja|wine|vinho|coffee|caf[eé]|tea|ch[aá])/, 'bebidas'],
    [/(frozen|congelad|ice-cream|sorvete)/, 'congelados'],
    [/(clean|limpeza|detergent|detergente|sab[aã]o em p[oó]|amaciante|desinfetante)/, 'limpeza'],
    [/(beauty|cosmetic|hygiene|higiene|shampoo|soap|sabonete|toothpaste|creme dental|desodorante|perfume)/, 'higiene'],
    [/(baby|beb[eê]|fralda|diaper)/, 'bebes'],
    [/(pet|dog|cat|cachorro|gato|ra[cç][aã]o)/, 'pet'],
    [/(cereal|rice|arroz|bean|feij|pasta|macarr|flour|farinha|sugar|a[cç][uú]car|oil|[oó]leo|snack|biscoit|cookie|sauce|molho|canned|conserva|mercearia|grocer)/, 'mercearia'],
  ]
  for (const [re, id] of rules) if (re.test(t)) return id
  return 'geral'
}
