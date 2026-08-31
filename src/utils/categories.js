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
  { id: 'hortifruti', label: 'Hortifruti', icon: Carrot, text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  { id: 'acougue', label: 'Açougue e Peixaria', icon: Beef, text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
  { id: 'padaria', label: 'Padaria', icon: Croissant, text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
  { id: 'laticinios', label: 'Laticínios e Frios', icon: Milk, text: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-100' },
  { id: 'mercearia', label: 'Mercearia', icon: ShoppingBasket, text: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
  { id: 'bebidas', label: 'Bebidas', icon: Wine, text: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
  { id: 'congelados', label: 'Congelados', icon: Snowflake, text: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-100' },
  { id: 'limpeza', label: 'Limpeza', icon: SprayCan, text: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-100' },
  { id: 'higiene', label: 'Higiene e Beleza', icon: Sparkles, text: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-100' },
  { id: 'bebes', label: 'Bebês', icon: Baby, text: 'text-fuchsia-600', bg: 'bg-fuchsia-50', border: 'border-fuchsia-100' },
  { id: 'pet', label: 'Pet', icon: Dog, text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
  { id: 'geral', label: 'Outros', icon: Tag, text: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-200' },
];

export const getCategory = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
