"use client";

import { useEffect, useState } from 'react';
import { Button, Select } from '@/components/ui';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';

const roles = ['owner', 'editor', 'viewer'] as const;

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  installmentId: string;
  installmentTitle: string;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

type InvitationRecord = {
  id: string;
  invited_email: string;
  role: typeof roles[number];
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
};

function formatInvitationDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

export function ShareModal({ open, onClose, installmentId, installmentTitle }: ShareModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<typeof roles[number]>('viewer');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;

    const loadInvitations = async () => {
      setIsLoadingInvitations(true);
      const supabase = createClient();
      const { data, error: invitationError } = await supabase
        .from('invitations')
        .select('id, invited_email, role, status, created_at')
        .eq('installment_id', installmentId)
        .order('created_at', { ascending: false });

      if (invitationError) {
        console.error('Failed to load sent invitations', invitationError);
      } else {
        const latestByEmail = new Map<string, InvitationRecord>();
        for (const invitation of (data ?? []) as InvitationRecord[]) {
          const email = invitation.invited_email.toLowerCase();
          if (!latestByEmail.has(email)) latestByEmail.set(email, invitation);
        }
        setInvitations(Array.from(latestByEmail.values()));
      }
      setIsLoadingInvitations(false);
    };

    loadInvitations();
  }, [installmentId, open]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!isValidEmail(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }

    setIsSaving(true);

    const response = await fetch('/api/invitations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        installment_id: installmentId,
        invited_email: email.trim().toLowerCase(),
        role,
      }),
    });

    const result = await response.json();
    setIsSaving(false);

    if (!response.ok) {
      setError(result.error || 'Unable to send invitation.');
      return;
    }

    if (result.ignored) {
      setEmail('');
      setRole('viewer');
      onClose();
      return;
    } else if (result.requiresLogin) {
      const emailDescription = result.emailError === 'missing_configuration'
        ? 'The invitation was saved, but email configuration is missing. Add RESEND_API_KEY and restart the server.'
        : result.emailError === 'sender_restricted'
          ? 'The invitation was saved, but the Resend test sender can only deliver to your Resend account email. Verify a domain and set RESEND_FROM to an address on that domain.'
        : result.emailError === 'provider_rejected'
          ? 'The invitation was saved, but Resend rejected the email. Verify RESEND_FROM and your Resend domain.'
          : 'They can log in with this email to accept the invitation from the notification bell.';
      toast({
        title: result.emailSent === false ? 'Invitation saved' : 'Invitation email sent',
        description: result.emailSent === false ? emailDescription : 'They can log in with this email to accept the invitation from the notification bell.',
        variant: result.emailSent === false ? 'danger' : 'success',
      });
    } else {
      toast({
        title: 'Invitation sent',
        description: `${installmentTitle} was shared successfully.`,
        variant: 'success',
      });
    }

    setInvitations((current) => [
      {
        id: result.invitationId || `local-${Date.now()}`,
        invited_email: email.trim().toLowerCase(),
        role,
        status: 'pending',
        created_at: new Date().toISOString(),
      },
      ...current.filter((invitation) => invitation.invited_email.toLowerCase() !== email.trim().toLowerCase()),
    ]);

    setEmail('');
    setRole('viewer');
    onClose();
  };

  return (
    <Modal open={open} title="Share installment" description="Invite another account to this installment." onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-ink">Sent invitations</h3>
              <p className="mt-1 text-xs text-ink-muted">One pending invitation per email. Rejected invitations can be retried after 24 hours.</p>
            </div>
          </div>
          {isLoadingInvitations ? (
            <div className="h-16 animate-pulse rounded-2xl bg-bg" />
          ) : invitations.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-ink-muted">No invitations sent yet.</p>
          ) : (
            <div className="theme-scrollbar max-h-52 space-y-2 overflow-y-auto pr-1">
              {invitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-bg px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{invitation.invited_email}</p>
                    <p className="mt-1 text-xs capitalize text-ink-muted">{invitation.role} · {formatInvitationDate(invitation.created_at)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold capitalize ${invitation.status === 'accepted' ? 'bg-success-soft text-success' : invitation.status === 'rejected' ? 'bg-danger-soft text-danger' : 'bg-accent-soft text-accent'}`}>
                    {invitation.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-ink-muted">Recipient email</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
            placeholder="example@mail.com"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-ink-muted">Role</label>
          <Select
            value={role}
            onChange={(value) => setRole(value as typeof roles[number])}
            options={roles.map((option) => ({
              value: option,
              label: option.charAt(0).toUpperCase() + option.slice(1),
            }))}
          />
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            Send invite
          </Button>
        </div>
      </form>
    </Modal>
  );
}
