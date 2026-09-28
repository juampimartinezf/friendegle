import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';
const EVENT = 'friendegle:theme';

/** El tema real lo marca la clase `dark` en <html> (la pone public/theme-init.js al cargar). */
const currentTheme = (): Theme => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1a1a2e' : '#1976d2');
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* sin almacenamiento: el tema dura solo esta visita */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Tema actual y función para alternarlo. Todos los botones de tema se mantienen sincronizados. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    const sync = () => setTheme(currentTheme());
    // Otra pestaña cambió el tema: aplicarlo aquí también
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      document.documentElement.classList.toggle('dark', e.newValue === 'dark');
      sync();
    };
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const toggle = useCallback(() => applyTheme(currentTheme() === 'dark' ? 'light' : 'dark'), []);

  return { theme, toggle };
}
