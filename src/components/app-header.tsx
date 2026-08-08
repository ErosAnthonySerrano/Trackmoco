"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { ThemeToggle } from '@/components/theme-toggle';

export function AppHeader() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [signOutLoading, setSignOutLoading] = useState(false);

  useEffect(() => {
    const loadSession = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      setAuthenticated(Boolean(data?.session?.user));
    };

    loadSession();
  }, []);

  const handleSignOut = async () => {
    setSignOutLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    setSignOutLoading(false);
    if (error) {
      console.error('Sign out failed', error);
      return;
    }
    router.replace('/login');
  };

  if (!authenticated) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur-xl">
      <div className="mx-auto flex flex-wrap items-center justify-end gap-3 px-4 py-3">
        <NotificationBell />
        <ThemeToggle />
        <Link href="/installments" className="inline-flex rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink transition hover:bg-accent-soft">
          Add installment
        </Link>
        <Button type="button" onClick={handleSignOut} isLoading={signOutLoading}>
          {signOutLoading ? 'Signing out…' : 'Sign out'}
        </Button>
      </div>
    </header>
  );
}
