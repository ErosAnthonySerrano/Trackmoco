"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui';

const supabase = createClient();

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState('Completing sign in...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let timer: NodeJS.Timeout | null = null;
    let subscription: { unsubscribe: () => void } | null = null;

    const attemptRedirect = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace('/');
        return;
      }

      const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
          router.replace('/');
        }
      });

      subscription = listener?.subscription ?? null;
      setMessage('Waiting for authentication to complete...');

      timer = setTimeout(async () => {
        if (!mounted) return;
        const { data: laterData } = await supabase.auth.getSession();
        if (laterData.session) {
          router.replace('/');
          return;
        }
        setError('Unable to complete sign in. Please return to login and try again.');
        setMessage('Sign in could not be completed.');
      }, 1500);
    };

    attemptRedirect();

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
      subscription?.unsubscribe();
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 py-10 text-ink">
      <div className="w-full max-w-md rounded-3xl bg-surface p-8 shadow-lg">
        <h1 className="mb-4 text-3xl font-semibold">Signing you in</h1>
        <p className="text-sm text-ink-muted">{message}</p>
        {error ? (
          <div className="mt-6 rounded-2xl border border-danger-soft bg-danger-soft/20 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}
        {error ? (
          <Button type="button" onClick={() => router.replace('/login')} className="mt-6 w-full">
            Return to login
          </Button>
        ) : null}
      </div>
    </div>
  );
}
