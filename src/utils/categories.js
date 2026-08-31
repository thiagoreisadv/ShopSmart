import {
  Carrot,
  Beef,
  Croissant,
  Milk,
  ShoppingBasket,
  SprayCan,
  Sparkles,
  Wine,
  Snowflake,
  Dog,
  Baby,
  Tag,
} from 'lucide-react';

export const CATEGORIES = [
  { id: 'hortifruti', label: 'Hortifruti', icon: Carrot, text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30', border: 'border-emerald-100 dark:border-emerald-800' },
  { id: 'acougue', label: 'Açougue e Peixaria', icon: Beef, text: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/30', border: 'border-rose-100 dark:border-rose-800' },
  { id: 'padaria', label: 'Padaria', icon: Croissant, text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-100 dark:border-amber-800' },
  { id: 'laticinios', label: 'Laticínios e Frios', icon: Milk, text: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-900/30', border: 'border-sky-100 dark:border-sky-800' },
  { id: 'mercearia', label: 'Mercearia', icon: ShoppingBasket, text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/30', border: 'border-indigo-100 dark:border-indigo-800' },
  { id: 'bebidas', label: 'Bebidas', icon: Wine, text: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/30', border: 'border-purple-100 dark:border-purple-800' },
  { id: 'congelados', label: 'Congelados', icon: Snowflake, text: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-900/30', border: 'border-cyan-100 dark:border-cyan-800' },
  { id: 'limpeza', label: 'Limpeza', icon: SprayCan, text: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-900/30', border: 'border-teal-100 dark:border-teal-800' },
  { id: 'higiene', label: 'Higiene e Beleza', icon: Sparkles, text: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-900/30', border: 'border-pink-100 dark:border-pink-800' },
  { id: 'bebes', label: 'Bebês', icon: Baby, text: 'text-fuchsia-600 dark:text-fuchsia-400', bg: 'bg-fuchsia-50 dark:bg-fuchsia-900/30', border: 'border-fuchsia-100 dark:border-fuchsia-800' },
  { id: 'pet', label: 'Pet', icon: Dog, text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/30', border: 'border-orange-100 dark:border-orange-800' },
  { id: 'geral', label: 'Outros', icon: Tag, text: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700' },
];

export const getCategory = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
