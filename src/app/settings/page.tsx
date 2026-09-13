"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Eye, EyeOff, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { BackButton, Button, Modal, Skeleton, useToast } from '@/components/ui';

type BlockedEmail = {
  id: string;
  blocked_email: string;
  created_at: string;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function SettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [accountName, setAccountName] = useState('Account');
  const [accountEmail, setAccountEmail] = useState('');
  const [receiveInvitations, setReceiveInvitations] = useState(true);
  const [savingPreference, setSavingPreference] = useState(false);
  const [blockedEmails, setBlockedEmails] = useState<BlockedEmail[]>([]);
  const [blockEmail, setBlockEmail] = useState('');
  const [blockError, setBlockError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient();
      const userResult = await supabase.auth.getUser();
      const user = userResult.data.user;
      const userId = user?.id;

      if (!userId) {
        router.replace('/login');
        return;
      }

      setAccountEmail(user.email ?? '');
      setAccountName(user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Account');

      const [{ data: profile }, { data: blocklist }] = await Promise.all([
        supabase.from('profiles').select('receive_invitations, email, display_name').eq('id', userId).maybeSingle(),
        supabase.from('blocklist').select('id, blocked_email, created_at').order('created_at', { ascending: false }),
      ]);

      if (profile) {
        setReceiveInvitations(profile.receive_invitations !== false);
        setAccountEmail(profile.email || user.email || '');
        setAccountName(profile.display_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Account');
      }

      setBlockedEmails((blocklist ?? []) as BlockedEmail[]);
      setLoading(false);
    };

    loadData();
  }, [router]);

  const handleToggleInvitations = async (checked: boolean) => {
    setSavingPreference(true);
    const supabase = createClient();
    const sessionResult = await supabase.auth.getSession();
    const userId = sessionResult.data.session?.user?.id;

    if (!userId) {
      setSavingPreference(false);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ receive_invitations: checked })
      .eq('id', userId);

    setSavingPreference(false);

    if (error) {
      toast.toast({ title: 'Save failed', description: error.message, variant: 'danger' });
      return;
    }

    setReceiveInvitations(checked);
    toast.toast({
      title: checked ? 'Invitations enabled' : 'Invitations disabled',
      description: checked ? 'You will receive installment invitations.' : 'Incoming invitations are now silently rejected.',
      variant: 'success',
    });
  };

  const handleBlock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBlockError(null);

    const email = blockEmail.trim().toLowerCase();
    if (!isValidEmail(email)) {
      setBlockError('Enter a valid email address.');
      return;
    }

    const supabase = createClient();
    const sessionResult = await supabase.auth.getSession();
    const userId = sessionResult.data.session?.user?.id;
    const userEmail = sessionResult.data.session?.user?.email;

    if (!userId) {
      setBlockError('Sign in required.');
      return;
    }

    if (userEmail && email === userEmail.toLowerCase()) {
      setBlockError('You cannot block your own email.');
      return;
    }

    setBlocking(true);
    const { data, error } = await supabase
      .from('blocklist')
      .upsert(
        [{ user_id: userId, blocked_email: email }],
        { onConflict: 'user_id,blocked_email', ignoreDuplicates: true }
      )
      .select('id, blocked_email, created_at')
      .single();

    setBlocking(false);

    if (error) {
      setBlockError(error.message);
      return;
    }

    if (data) {
      setBlockedEmails((current) => [data as BlockedEmail, ...current.filter((row) => row.blocked_email !== email)]);
    }

    setBlockEmail('');
    toast.toast({ title: 'Sender blocked', description: `${email} will no longer reach you.`, variant: 'success' });
  };

  const handleUnblock = async (row: BlockedEmail) => {
    if (!window.confirm(`Unblock ${row.blocked_email}?`)) return;

    setUnblockingId(row.id);
    const supabase = createClient();
    const { error } = await supabase.from('blocklist').delete().eq('id', row.id);
    setUnblockingId(null);

    if (error) {
      toast.toast({ title: 'Unblock failed', description: error.message, variant: 'danger' });
      return;
    }

    setBlockedEmails((current) => current.filter((item) => item.id !== row.id));
    toast.toast({ title: 'Unblocked', description: `${row.blocked_email} can invite you again.`, variant: 'success' });
  };

  const handleDeleteAccount = async () => {
    setDeleteError(null);

    const supabase = createClient();
    const sessionResult = await supabase.auth.getSession();
    const userEmail = sessionResult.data.session?.user?.email;

    if (!userEmail || deleteEmail.trim().toLowerCase() !== userEmail.toLowerCase()) {
      setDeleteError('Type your email to confirm.');
      return;
    }

    setDeleting(true);
    const response = await fetch('/api/account/delete', { method: 'POST' });
    const result = await response.json();
    setDeleting(false);

    if (!response.ok) {
      setDeleteError(result.error || 'Unable to delete account.');
      return;
    }

    await supabase.auth.signOut();
    router.replace('/login');
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setSigningOut(false);
      toast.toast({ title: 'Sign out failed', description: error.message, variant: 'danger' });
      return;
    }
    router.replace('/login');
  };

  const handlePasswordUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 6) {
      setPasswordError('Use at least 6 characters for your password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setSavingPassword(true);
    const { error } = await createClient().auth.updateUser({ password: newPassword });
    setSavingPassword(false);

    if (error) {
      setPasswordError(error.message);
      return;
    }

    setNewPassword('');
    setConfirmPassword('');
    toast.toast({
      title: 'Password saved',
      description: 'You can now sign in with your email and password.',
      variant: 'success',
    });
  };

  return (
    <main className="min-h-screen bg-bg px-4 py-6 text-ink sm:py-10">
      <div className="mx-auto max-w-3xl">
        <BackButton href="/" label="Back to dashboard" />
        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Account</p>
          <h1 className="text-3xl font-semibold sm:text-4xl">Settings</h1>
        </div>

        {loading ? (
          <div className="space-y-6">
            <div className="rounded-3xl border border-line bg-surface p-6 shadow-sm">
              <Skeleton className="h-6 w-48 mb-4" />
              <Skeleton className="h-5 w-72" />
            </div>
            <div className="rounded-3xl border border-line bg-surface p-6 shadow-sm">
              <Skeleton className="h-6 w-48 mb-4" />
              <Skeleton className="h-14 w-full" />
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <section className="rounded-3xl border border-line bg-surface p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-ink-muted">Account information</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-line bg-bg px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Name</p>
                  <p className="mt-1 truncate font-semibold text-ink">{accountName}</p>
                </div>
                <div className="rounded-2xl border border-line bg-bg px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Email</p>
                  <p className="mt-1 truncate font-semibold text-ink">{accountEmail}</p>
                </div>
              </div>
            </section>
            <section className="rounded-3xl border border-line bg-surface p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-ink">Password sign-in</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Set a password to sign in without waiting for an email code. You can update it here at any time.
              </p>
              <form onSubmit={handlePasswordUpdate} className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-ink">
                  New password
                  <div className="relative mt-2">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      autoComplete="new-password"
                      required
                      className="w-full rounded-2xl border border-line bg-bg px-4 py-3 pr-12 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                    />
                    <button type="button" onClick={() => setShowNewPassword((value) => !value)} aria-label={showNewPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-ink-muted transition hover:bg-accent-soft hover:text-ink">
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                      autoComplete="new-password"
                      required
                      className="w-full rounded-2xl border border-line bg-bg px-4 py-3 pr-12 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                    />
                    <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-ink-muted transition hover:bg-accent-soft hover:text-ink">
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>
                {passwordError ? <p className="text-sm text-danger sm:col-span-2">{passwordError}</p> : null}
                <div className="sm:col-span-2">
                  <Button type="submit" variant="secondary" isLoading={savingPassword}>
                    Save password
                  </Button>
                </div>
              </form>
            </section>
            <section className="rounded-3xl border border-line bg-surface p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-ink">Invitation preferences</h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    When off, all incoming installment invitations are silently rejected — no exceptions for specific senders.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={receiveInvitations}
                  onClick={() => handleToggleInvitations(!receiveInvitations)}
                  disabled={savingPreference}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${receiveInvitations ? 'bg-accent' : 'bg-bg border border-line'}`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-surface shadow transition ${receiveInvitations ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-line bg-surface p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <Ban className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-semibold text-ink">Blocklist</h2>
              </div>
              <p className="mt-1 text-sm text-ink-muted">
                Invitations from blocked senders never reach you. Unblocking does not restore invitations that were dropped while blocked.
              </p>

              <form onSubmit={handleBlock} className="mt-5 flex flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  value={blockEmail}
                  onChange={(event) => setBlockEmail(event.target.value)}
                  placeholder="block a sender by email"
                  className="w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                />
                <Button type="submit" variant="secondary" isLoading={blocking} className="shrink-0">
                  Block a sender
                </Button>
              </form>
              {blockError ? <p className="mt-2 text-sm text-danger">{blockError}</p> : null}

              <div className="mt-6">
                {blockedEmails.length === 0 ? (
                  <div className="rounded-2xl border border-line bg-bg px-4 py-6 text-center text-sm text-ink-muted">
                    You have not blocked anyone yet.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {blockedEmails.map((row) => (
                      <li
                        key={row.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-bg px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{row.blocked_email}</p>
                          <p className="text-xs text-ink-muted">Blocked {new Date(row.created_at).toLocaleDateString()}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          isLoading={unblockingId === row.id}
                          onClick={() => handleUnblock(row)}
                          className="shrink-0 text-danger"
                        >
                          Unblock
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-line bg-surface p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-ink">Session</h2>
              <p className="mt-1 text-sm text-ink-muted">Sign out of Trackmoco on this device.</p>
              <Button type="button" variant="secondary" className="mt-4" isLoading={signingOut} onClick={handleSignOut}>
                Sign out
              </Button>
            </section>

            <section className="rounded-3xl border border-danger/30 bg-danger-soft/40 p-6">
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-danger" />
                <h2 className="text-lg font-semibold text-danger">Danger zone</h2>
              </div>
              <p className="mt-1 text-sm text-ink-muted">
                Deleting your account removes your profile and everything you own. This cannot be undone.
              </p>
              <Button type="button" variant="ghost" className="mt-4 border border-danger/30 text-danger" onClick={() => setDeleteOpen(true)}>
                Delete account
              </Button>
            </section>
          </div>
        )}
      </div>

      <Modal
        open={deleteOpen}
        title="Delete account"
        description="This permanently deletes your account and all data you own. Type your email to confirm."
        onClose={() => {
          if (!deleting) {
            setDeleteOpen(false);
            setDeleteEmail('');
            setDeleteError(null);
          }
        }}
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              disabled={deleting}
              onClick={() => {
                setDeleteOpen(false);
                setDeleteEmail('');
                setDeleteError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="ghost"
              isLoading={deleting}
              disabled={deleteEmail.trim().length === 0}
              onClick={handleDeleteAccount}
              className="border border-danger/30 text-danger"
            >
              Delete my account
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <label className="block text-sm font-medium text-ink-muted">
            Type your email to confirm
            <input
              type="email"
              value={deleteEmail}
              onChange={(event) => setDeleteEmail(event.target.value)}
              placeholder="you@example.com"
              autoFocus
              className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
          </label>
          {deleteError ? <p className="text-sm text-danger">{deleteError}</p> : null}
        </div>
      </Modal>
    </main>
  );
}