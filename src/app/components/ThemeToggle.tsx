import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  variant?: 'pill' | 'icon' | 'compact';
  showLabel?: boolean;
}

export default function ThemeToggle({
  className = '',
  variant = 'pill',
  showLabel = false,
}: ThemeToggleProps) {
  const { theme, isDark, toggleTheme } = useTheme();

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`relative inline-flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 cursor-pointer select-none
          ${
            isDark
              ? 'bg-[#202538] text-amber-300 hover:text-amber-200 border border-[#2E3650] hover:border-amber-400/40 shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
              : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-blue-400 shadow-xs'
          } ${className}`}
        aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        <div className="relative w-4 h-4 flex items-center justify-center">
          <Sun
            size={16}
            className={`absolute transition-all duration-300 transform ${
              isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100 text-amber-500'
            }`}
          />
          <Moon
            size={16}
            className={`absolute transition-all duration-300 transform ${
              isDark ? 'rotate-0 scale-100 opacity-100 text-indigo-300' : '-rotate-90 scale-0 opacity-0'
            }`}
          />
        </div>
      </button>
    );
  }

  // Pill variant (Rich interactive capsule with Sun and Moon indicators)
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`group relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all duration-200 cursor-pointer select-none text-xs font-semibold
        ${
          isDark
            ? 'bg-[#151824] hover:bg-[#202538] text-slate-200 border border-[#2E3650] hover:border-indigo-500/40 shadow-[0_2px_10px_rgba(0,0,0,0.35)]'
            : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200 hover:border-slate-300 shadow-xs'
        } ${className}`}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${
          isDark
            ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-500/40 shadow-inner'
            : 'bg-white text-amber-500 border border-slate-200 shadow-xs'
        }`}
      >
        {isDark ? (
          <Moon size={13} className="transition-transform duration-300 group-hover:-rotate-12" />
        ) : (
          <Sun size={13} className="transition-transform duration-300 group-hover:rotate-45" />
        )}
      </div>

      <span className="text-[11px] font-bold tracking-tight">
        {showLabel ? (isDark ? 'Dark Mode' : 'Light Mode') : (isDark ? 'Dark' : 'Light')}
      </span>
    </button>
  );
}
