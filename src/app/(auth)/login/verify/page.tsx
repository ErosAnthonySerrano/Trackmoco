"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui';

const supabase = createClient();

export default function VerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [resendCountdown, setResendCountdown] = useState(60);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace('/');
      }
    });
  }, [router]);

  useEffect(() => {
    const storedEmail = window.localStorage.getItem('trackmoco_otp_email');
    if (storedEmail) {
      setEmail(storedEmail);
    } else {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = window.setTimeout(() => setResendCountdown((count) => count - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleVerify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'email',
    });

    setLoading(false);

    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    router.replace('/');
  };

  const handleResend = async () => {
    if (!email || resendCountdown > 0) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error: resendError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setLoading(false);

    if (resendError) {
      const rateLimited = resendError.message.toLowerCase().includes('rate limit');
      setError(rateLimited ? 'A code was recently sent. Please wait before requesting another.' : resendError.message);
      if (rateLimited) setResendCountdown(60);
      return;
    }

    setMessage('Verification code resent. Check your inbox.');
    setResendCountdown(30);
  };

  return (
    <main className="relative min-h-svh overflow-hidden bg-bg px-4 py-6 text-ink sm:px-8 sm:py-10">
      <div className="pointer-events-none absolute -left-28 -top-28 h-80 w-80 rounded-full border-[3rem] border-accent-soft opacity-70" />
      <div className="relative mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-5xl items-center justify-center">
        <div className="grid w-full max-w-4xl items-center gap-10 lg:grid-cols-[0.9fr_26rem] lg:gap-20">
          <section className="hidden lg:block">
            <div className="mb-8 flex items-center gap-3">
              <img src="/icons/icon-192.svg" alt="" className="h-12 w-12 rounded-2xl shadow-sm" />
              <span className="font-heading text-2xl font-semibold tracking-tight">Trackmoco</span>
            </div>
            <p className="max-w-md text-4xl font-semibold leading-tight tracking-tight">A small step, then you are back on track.</p>
            <p className="mt-5 max-w-sm text-sm leading-6 text-ink-muted">Use the secure code from your inbox to continue managing your shared payment schedules.</p>
          </section>

          <section className="w-full rounded-4xl border border-line bg-surface p-6 shadow-xl shadow-ink/5 sm:p-9">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <img src="/icons/icon-192.svg" alt="" className="h-10 w-10 rounded-xl" />
              <span className="font-heading text-xl font-semibold tracking-tight">Trackmoco</span>
            </div>
            <button type="button" onClick={() => router.push('/login')} className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-ink-muted transition hover:text-ink">
              <ArrowLeft className="h-4 w-4" /> Change email
            </button>
            <div className="mb-8">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                <KeyRound className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Check your inbox</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Enter your code</h1>
              <p className="mt-3 text-sm leading-6 text-ink-muted">We sent a 6-digit sign-in code to <strong className="font-semibold text-ink">{email}</strong>.</p>
            </div>
            <form onSubmit={handleVerify} className="space-y-5">
              <label className="block text-sm font-medium text-ink">
                Verification code
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  maxLength={6}
                  pattern="[0-9]{6}"
                  autoFocus
                  className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-4 text-center text-2xl font-semibold tracking-[0.45em] text-ink outline-none transition placeholder:text-ink-muted focus:border-accent focus:ring-4 focus:ring-accent-soft"
                  placeholder="000000"
                />
              </label>
              {message && <p className="flex items-center gap-2 rounded-2xl bg-success-soft px-4 py-3 text-sm text-success"><CheckCircle2 className="h-4 w-4 shrink-0" />{message}</p>}
              {error && <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
              <Button type="submit" isLoading={loading} disabled={code.length !== 6} className="w-full py-3.5">
                {loading ? 'Verifying code' : 'Verify and continue'}
              </Button>
            </form>
            <div className="mt-7 border-t border-line pt-6 text-center">
              <p className="text-sm text-ink-muted">Did not receive it?</p>
              <button type="button" onClick={handleResend} disabled={resendCountdown > 0 || loading} className="mt-2 text-sm font-semibold text-primary transition hover:text-accent disabled:cursor-not-allowed disabled:opacity-50">
                {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend code'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
