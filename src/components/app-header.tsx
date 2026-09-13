"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarClock, Home, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { ThemeToggle } from '@/components/theme-toggle';

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);
  const [signOutLoading, setSignOutLoading] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('/default-avatar.svg');
  const [profileName, setProfileName] = useState('Account');
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const loadSession = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      setAuthenticated(Boolean(user));

      if (user) {
        setProfileName(user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Account');
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url, display_name, email')
          .eq('id', user.id)
          .maybeSingle();
        // Google exposes the photo in user metadata; use it directly like Quentadoz.
        const avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture;
        setAvatarUrl(avatar || profile?.avatar_url || '/default-avatar.svg');
        setProfileName(profile?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || profile?.email || user.email || 'Account');
      }
    };

    loadSession();

    const { data: authState } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user;
      setAuthenticated(Boolean(user));
      if (!user || event === 'SIGNED_OUT') {
        setAvatarUrl('/default-avatar.svg');
        setProfileName('Account');
        setProfileMenuOpen(false);
      }
    });

    return () => authState.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileMenuOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileMenuOpen]);

  const handleSignOut = async () => {
    setSignOutLoading(true);
    setAuthenticated(false);
    setProfileMenuOpen(false);
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

  const isActive = (route: string) => {
    if (route === '/') return pathname === '/';
    if (route === '/installments/all') {
      return pathname === route || pathname.startsWith(`${route}/`) || /^\/[0-9a-f-]{36}$/.test(pathname);
    }
    return pathname === route || pathname.startsWith(`${route}/`);
  };

  const navLinkClass = (route: string) => `inline-flex rounded-2xl border px-4 py-3 text-sm font-semibold transition ${isActive(route) ? 'border-accent bg-accent-soft text-ink' : 'border-line bg-surface text-ink hover:bg-accent-soft'}`;
  const bottomNavClass = (route: string) => `mobile-bottom-nav__item ${isActive(route) ? 'mobile-bottom-nav__item--active' : ''}`;

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur-xl">
      <div className="flex justify-center px-4 sm:px-0">
        <div className="flex h-14 w-full max-w-6xl items-center justify-between sm:h-auto sm:py-3">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-ink transition hover:text-accent">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.svg" alt="" className="h-8 w-8 rounded-lg" />
            <span>Trackmoco</span>
          </Link>
          <div className="hidden items-center justify-end gap-3 sm:flex">
            <NotificationBell />
            <ThemeToggle />
            <Link href="/installments/all" aria-current={isActive('/installments/all') ? 'page' : undefined} className={navLinkClass('/installments/all')}>
              Installments
            </Link>
            <Link href="/installments" aria-current={isActive('/installments') ? 'page' : undefined} className={navLinkClass('/installments')}>
              Add installment
            </Link>
            <div ref={profileMenuRef} className="relative">
              <button
                type="button"
                aria-label={`Open account menu for ${profileName}`}
                aria-expanded={profileMenuOpen}
                onClick={() => setProfileMenuOpen((current) => !current)}
                className="inline-flex rounded-full border-2 border-line bg-surface p-0.5 transition hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    setAvatarUrl('/default-avatar.svg');
                  }}
                />
              </button>
              {profileMenuOpen ? (
                <div className="absolute right-0 top-full z-50 mt-3 w-64 rounded-2xl border border-line bg-surface p-2 shadow-xl">
                  <div className="border-b border-line px-3 py-3">
                    <p className="truncate text-sm font-semibold text-ink">{profileName}</p>
                    <p className="mt-1 text-xs text-ink-muted">Account menu</p>
                  </div>
                  <Link
                    href="/settings"
                    onClick={() => setProfileMenuOpen(false)}
                    className="mt-2 block rounded-xl px-3 py-2.5 text-sm font-semibold text-ink transition hover:bg-accent-soft"
                  >
                    Account settings
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleSignOut}
                    isLoading={signOutLoading}
                    className="mt-1 w-full justify-start text-danger"
                  >
                    Sign out
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </header>
      <nav className="mobile-bottom-nav sm:hidden" aria-label="Mobile navigation">
        <Link href="/" aria-current={isActive('/') ? 'page' : undefined} className={bottomNavClass('/')}>
          <Home className="h-5 w-5" aria-hidden="true" />
          <span>Home</span>
        </Link>
        <Link href="/installments/all" aria-current={isActive('/installments/all') ? 'page' : undefined} className={bottomNavClass('/installments/all')}>
          <CalendarClock className="h-5 w-5" aria-hidden="true" />
          <span>Plans</span>
        </Link>
        <Link href="/installments" aria-current={isActive('/installments') ? 'page' : undefined} className={`mobile-bottom-nav__add ${isActive('/installments') ? 'mobile-bottom-nav__add--active' : ''}`}>
          <Plus className="h-5 w-5" aria-hidden="true" />
          <span>Add</span>
        </Link>
        <Link href="/upcoming" aria-current={isActive('/upcoming') ? 'page' : undefined} className={bottomNavClass('/upcoming')}>
          <CalendarClock className="h-5 w-5" aria-hidden="true" />
          <span>Upcoming</span>
        </Link>
        <Link href="/settings" aria-current={isActive('/settings') ? 'page' : undefined} className={bottomNavClass('/settings')}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover" referrerPolicy="no-referrer" />
          <span>Account</span>
        </Link>
      </nav>
    </>
  );
}
