"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button, Modal, Skeleton, useToast } from '@/components/ui';

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

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient();
      const sessionResult = await supabase.auth.getSession();
      const userId = sessionResult.data.session?.user?.id;

      if (!userId) {
        router.replace('/login');
        return;
      }

      const [{ data: profile }, { data: blocklist }] = await Promise.all([
        supabase.from('profiles').select('receive_invitations, email').eq('id', userId).maybeSingle(),
        supabase.from('blocklist').select('id, blocked_email, created_at').order('created_at', { ascending: false }),
      ]);

      if (profile) {
        setReceiveInvitations(profile.receive_invitations !== false);
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

  return (
    <main className="min-h-screen bg-bg px-4 py-10 text-ink">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Account</p>
          <h1 className="text-4xl font-semibold">Settings</h1>
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