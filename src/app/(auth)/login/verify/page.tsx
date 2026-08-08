"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui';

const supabase = createClient();

export default function VerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
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
      token: code,
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

    const { error: resendError } = await supabase.auth.signInWithOtp({ email });
    setLoading(false);

    if (resendError) {
      setError(resendError.message);
      return;
    }

    setMessage('Verification code resent. Check your inbox.');
    setResendCountdown(30);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-surface p-8 shadow-lg">
        <h1 className="mb-6 text-3xl font-semibold text-ink">Enter your code</h1>
        <p className="mb-6 text-sm text-ink-muted">We sent a 6-digit code to <strong>{email}</strong>.</p>
        <form onSubmit={handleVerify} className="space-y-4">
          <label className="block text-sm font-medium text-ink-muted">
            Verification code
            <input
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
              maxLength={6}
              className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
              placeholder="123456"
            />
          </label>
          {message && <p className="text-sm text-success mt-2">{message}</p>}
          {error && <p className="text-sm text-danger mt-2">{error}</p>}
          <Button type="submit" isLoading={loading} className="w-full">
            {loading ? 'Verifying…' : 'Verify'}
          </Button>
        </form>
        <div className="mt-6 flex items-center justify-between text-sm text-ink-muted">
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCountdown > 0 || loading}
            className="font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend code'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="font-semibold text-primary"
          >
            Change email
          </button>
        </div>
      </div>
    </div>
  );
}
