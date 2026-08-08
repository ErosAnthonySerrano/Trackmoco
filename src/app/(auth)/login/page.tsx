"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui';

const supabase = createClient();

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace('/');
      }
    });
  }, [router]);

  const handleSendCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    window.localStorage.setItem('trackmoco_otp_email', email);
    setMessage('Check your inbox for the sign-in link or code.');
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
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-surface p-8 shadow-lg">
        <h1 className="mb-6 text-3xl font-semibold text-ink">Welcome back</h1>
        <form onSubmit={handleSendCode} className="space-y-4">
          <label className="block text-sm font-medium text-ink-muted">
            Email address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
              placeholder="you@example.com"
            />
          </label>
          {message && <p className="text-sm text-success mt-2">{message}</p>}
          {error && <p className="text-sm text-danger mt-2">{error}</p>}
          <Button type="submit" isLoading={loading} className="w-full">
            {loading ? 'Sending…' : 'Send code'}
          </Button>
        </form>
        <div className="my-6 flex items-center gap-3 text-sm text-ink-muted">
          <span className="h-px flex-1 bg-line" />
          <span>or</span>
          <span className="h-px flex-1 bg-line" />
        </div>
        <Button type="button" variant="secondary" onClick={handleGoogle} isLoading={loading} className="w-full">
          Continue with Google
        </Button>
      </div>
    </div>
  );
}
