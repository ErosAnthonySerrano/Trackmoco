"use client";

import { useState } from 'react';
import { Button } from '@/components/ui';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui';

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

export function ShareModal({ open, onClose, installmentId, installmentTitle }: ShareModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<typeof roles[number]>('viewer');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

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
      toast({
        title: 'Invite not delivered',
        description: 'This user is not receiving invitations.',
      });
    } else {
      toast({
        title: 'Invitation sent',
        description: `${installmentTitle} was shared successfully.`,
        variant: 'success',
      });
    }

    setEmail('');
    setRole('viewer');
    onClose();
  };

  return (
    <Modal open={open} title="Share installment" description="Invite another account to this installment." onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-6">
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
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as typeof roles[number])}
            className="w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
          >
            {roles.map((option) => (
              <option key={option} value={option}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </option>
            ))}
          </select>
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
