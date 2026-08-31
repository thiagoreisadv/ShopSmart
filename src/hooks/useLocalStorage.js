import { useState } from 'react';

// Estado que persiste automaticamente no localStorage do navegador.
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const update = (newValue) => {
    const resolved = typeof newValue === 'function' ? newValue(value) : newValue;
    setValue(resolved);
    try {
      localStorage.setItem(key, JSON.stringify(resolved));
    } catch {
      // localStorage indisponível ou cheio: ignora, mantém apenas em memória
    }
  };

  return [value, update];
}
