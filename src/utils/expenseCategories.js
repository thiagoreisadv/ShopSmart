import { ShoppingCart, Fuel, Car, Home, HeartPulse, Gamepad2, Tag } from 'lucide-react';

export const EXPENSE_CATEGORIES = [
  { id: 'mercado', label: 'Mercado', icon: ShoppingCart, text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/30', border: 'border-indigo-100 dark:border-indigo-800', bar: 'bg-indigo-500' },
  { id: 'combustivel', label: 'Combustível', icon: Fuel, text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-100 dark:border-amber-800', bar: 'bg-amber-500' },
  { id: 'transporte', label: 'Transporte', icon: Car, text: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-900/30', border: 'border-sky-100 dark:border-sky-800', bar: 'bg-sky-500' },
  { id: 'casa', label: 'Casa e Contas', icon: Home, text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30', border: 'border-emerald-100 dark:border-emerald-800', bar: 'bg-emerald-500' },
  { id: 'saude', label: 'Saúde', icon: HeartPulse, text: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/30', border: 'border-rose-100 dark:border-rose-800', bar: 'bg-rose-500' },
  { id: 'lazer', label: 'Lazer', icon: Gamepad2, text: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/30', border: 'border-purple-100 dark:border-purple-800', bar: 'bg-purple-500' },
  { id: 'outros', label: 'Outros', icon: Tag, text: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700', bar: 'bg-slate-400' },
];

export const getExpenseCategory = (id) => EXPENSE_CATEGORIES.find(c => c.id === id) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
