"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Eye, EyeOff, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/');
    });
  }, [router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (password.length < 6) {
      setError('Use at least 6 characters for your password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { data, error: signupError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);
    if (signupError) {
      setError(signupError.message.toLowerCase().includes('already registered')
        ? 'An account with this email already exists. Sign in instead.'
        : 'Unable to create your account. Please try again.');
      return;
    }

    if (data.session) {
      router.replace('/');
      router.refresh();
      return;
    }

    setMessage('Account created. Check your email to confirm your account, then sign in with your password.');
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
          <p className="max-w-xl text-5xl font-semibold leading-[1.05] tracking-tight text-ink">Start keeping every payment on track.</p>
          <p className="mt-6 max-w-md text-base leading-7 text-ink-muted">Create your account to manage installment schedules, share due dates, and stay ahead of payments.</p>
          <div className="mt-10 space-y-4 text-sm text-ink-muted">
            {['Create and share schedules', 'Track paid and unpaid items', 'Set a password for quick sign-in'].map((item) => (
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
              <UserPlus className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">New account</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Create your account</h1>
            <p className="mt-3 text-sm leading-6 text-ink-muted">Use your email and a password to get started with Trackmoco.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
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
                  autoComplete="new-password"
                  className="w-full rounded-2xl border border-line bg-bg px-4 py-3.5 pr-12 text-sm text-ink outline-none transition placeholder:text-ink-muted focus:border-accent focus:ring-4 focus:ring-accent-soft"
                  placeholder="At least 6 characters"
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-ink-muted transition hover:bg-accent-soft hover:text-ink">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            <label className="block text-sm font-medium text-ink">
              Confirm password
              <div className="relative mt-2">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full rounded-2xl border border-line bg-bg px-4 py-3.5 pr-12 text-sm text-ink outline-none transition placeholder:text-ink-muted focus:border-accent focus:ring-4 focus:ring-accent-soft"
                  placeholder="Re-enter your password"
                />
                <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-ink-muted transition hover:bg-accent-soft hover:text-ink">
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            {message ? <p className="rounded-2xl bg-success-soft px-4 py-3 text-sm text-success">{message}</p> : null}
            {error ? <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p> : null}
            <Button type="submit" isLoading={loading} className="w-full py-3.5">
              Create account <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="mt-7 text-center text-sm text-ink-muted">
            Already have an account? <Link href="/login" className="font-semibold text-primary hover:text-accent">Sign in</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
