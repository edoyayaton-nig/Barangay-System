import React, { createContext, useContext, useEffect, useState, useRef } from 'react';

export interface ThemeContextType {
  theme: 'light' | 'dark';
  isDark: boolean;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
}

export const THEME_STORAGE_KEY = 'smart_barangay_theme';

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  isDark: false,
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) || localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const themeRef = useRef(theme);
  themeRef.current = theme;

  // Apply theme to DOM elements safely without infinite loops or unnecessary DOM writes
  const applyDomTheme = (targetTheme: 'light' | 'dark') => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const body = document.body;

    const shouldBeDark = targetTheme === 'dark';
    const isCurrentlyDark = root.classList.contains('dark');

    // Only touch DOM if state actually differs
    if (shouldBeDark !== isCurrentlyDark) {
      if (shouldBeDark) {
        root.classList.add('dark');
        if (body) body.classList.add('dark');
        root.style.colorScheme = 'dark';
        root.setAttribute('data-theme', 'dark');
      } else {
        root.classList.remove('dark');
        if (body) body.classList.remove('dark');
        root.style.colorScheme = 'light';
        root.setAttribute('data-theme', 'light');
      }
    }
  };

  const setTheme = (newTheme: 'light' | 'dark') => {
    if (newTheme === themeRef.current) return; // Prevent redundant updates

    themeRef.current = newTheme;
    setThemeState(newTheme);
    applyDomTheme(newTheme);

    try {
      if (localStorage.getItem(THEME_STORAGE_KEY) !== newTheme) {
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      }
      if (localStorage.getItem('theme') !== newTheme) {
        localStorage.setItem('theme', newTheme);
      }

      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('smart_theme_sync');
        bc.postMessage({ theme: newTheme });
        bc.close();
      }
    } catch {}
  };

  const toggleTheme = () => {
    setTheme(themeRef.current === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    // Initial DOM alignment
    applyDomTheme(theme);

    // Cross-tab sync handler
    const handleStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY || e.key === 'theme') {
        const val = e.newValue;
        if ((val === 'dark' || val === 'light') && val !== themeRef.current) {
          themeRef.current = val;
          setThemeState(val);
          applyDomTheme(val);
        }
      }
    };

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('smart_theme_sync');
        bc.onmessage = (event) => {
          const val = event.data?.theme;
          if ((val === 'dark' || val === 'light') && val !== themeRef.current) {
            themeRef.current = val;
            setThemeState(val);
            applyDomTheme(val);
          }
        };
      }
    } catch {}

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      if (bc) bc.close();
    };
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === 'dark', setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  return context;
}
