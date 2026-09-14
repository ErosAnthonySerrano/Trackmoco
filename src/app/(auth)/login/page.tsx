"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui';

const supabase = createClient();

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const callbackError = new URLSearchParams(window.location.search).get('error');
    if (callbackError) setError(callbackError);

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace('/');
      }
    });
  }, [router]);

  const handlePasswordLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);

    if (signInError) {
      setError(signInError.message.toLowerCase().includes('invalid login credentials')
        ? 'The email or password is incorrect. If this account was created with a code, switch to Email code.'
        : signInError.message);
      return;
    }

    router.replace('/');
    router.refresh();
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);

    if (oauthError) {
      setError(oauthError.message);
    }
  };

  return (
    <main className="relative min-h-svh overflow-hidden bg-bg px-4 py-6 text-ink sm:px-8 sm:py-10">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border-[3rem] border-accent-soft opacity-70" />
      <div className="relative mx-auto grid min-h-[calc(100svh-3rem)] w-full max-w-5xl items-center gap-10 lg:grid-cols-[1fr_26rem] lg:gap-20">
        <section className="hidden lg:block">
          <div className="mb-8 flex items-center gap-3">
            <img src="/icons/icon-192.svg" alt="" className="h-12 w-12 rounded-2xl shadow-sm" />
            <span className="font-heading text-2xl font-semibold tracking-tight">Trackmoco</span>
          </div>
          <p className="max-w-xl text-5xl font-semibold leading-[1.05] tracking-tight text-ink">
            Keep every payment on track.
          </p>
          <p className="mt-6 max-w-md text-base leading-7 text-ink-muted">
            A calm, shared place for installment schedules, due dates, and proof of payment.
          </p>
          <div className="mt-10 space-y-4 text-sm text-ink-muted">
            {['Shared schedules with clear roles', 'Payment reminders before due dates', 'Email and password sign in'].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="w-full rounded-4xl border border-line bg-surface p-6 shadow-xl shadow-ink/5 sm:p-9">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src="/icons/icon-192.svg" alt="" className="h-10 w-10 rounded-xl" />
            <span className="font-heading text-xl font-semibold tracking-tight">Trackmoco</span>
          </div>
          <div className="mb-8">
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Welcome back</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Sign in securely</h1>
            <p className="mt-3 text-sm leading-6 text-ink-muted">Sign in with your Trackmoco email and password, or continue with Google.</p>
          </div>

          <form onSubmit={handlePasswordLogin} className="space-y-5">
            <label className="block text-sm font-medium text-ink">
              Email address
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3.5 text-sm text-ink outline-none transition placeholder:text-ink-muted focus:border-accent focus:ring-4 focus:ring-accent-soft"
                placeholder="you@example.com"
              />
            </label>
            <label className="block text-sm font-medium text-ink">
              Password
              <div className="relative mt-2">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-2xl border border-line bg-bg px-4 py-3.5 pr-12 text-sm text-ink outline-none transition placeholder:text-ink-muted focus:border-accent focus:ring-4 focus:ring-accent-soft"
                  placeholder="Enter your password"
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-ink-muted transition hover:bg-accent-soft hover:text-ink">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            {message && <p className="rounded-2xl bg-success-soft px-4 py-3 text-sm text-success">{message}</p>}
            {error && <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
            <Button type="submit" isLoading={loading} className="w-full py-3.5">
              Sign in with password <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-ink-muted">
            <span className="h-px flex-1 bg-line" />
            <span>or continue with</span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <Button type="button" variant="secondary" onClick={handleGoogle} isLoading={loading} className="w-full py-3.5">
            <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 24 24" role="img">
              <path fill="#4285F4" d="M21.35 12.23c0-.79-.07-1.55-.22-2.28H12v4.32h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.43Z" />
              <path fill="#34A853" d="M12 21.5c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.29v2.53A9.74 9.74 0 0 0 12 21.5Z" />
              <path fill="#FBBC05" d="M6.53 13.58a5.86 5.86 0 0 1 0-3.16V7.89H3.29a9.74 9.74 0 0 0 0 8.22l3.24-2.53Z" />
              <path fill="#EA4335" d="M12 6.39c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.48 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.71 5.39l3.24 2.53C7.3 8.11 9.46 6.39 12 6.39Z" />
            </svg>
            Continue with Google
          </Button>
          <p className="mt-5 text-center text-sm text-ink-muted">
            New to Trackmoco? <Link href="/signup" className="font-semibold text-primary hover:text-accent">Create an account</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
