import { useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

const KEY = 'shopsmart_theme';

export function useTheme() {
  const [theme, setTheme] = useLocalStorage(KEY, 'light');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return { theme, toggleTheme };
}
