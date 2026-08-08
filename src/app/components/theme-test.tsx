"use client";

import { ThemeToggle } from '@/components/theme-toggle';

export function ThemeTest() {
  return (
    <div className="mt-8 rounded-3xl border border-line bg-bg p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold text-ink">Theme switcher</h2>
      <ThemeToggle />
    </div>
  );
}
