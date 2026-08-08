"use client";

import { useTheme } from './theme-provider';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="rounded-2xl border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink transition hover:bg-accent-soft"
    >
      {theme === 'light' ? 'Switch to dark' : 'Switch to light'}
    </button>
  );
}
