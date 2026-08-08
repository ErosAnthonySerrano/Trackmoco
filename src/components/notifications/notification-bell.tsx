"use client";

import { useEffect, useMemo, useState } from 'react';
import { Bell, ChevronDown, Check, Mail, MessageCircle, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button, useToast } from '@/components/ui';
import { Modal } from '@/components/ui/modal';
import { createClient } from '@/lib/supabase/client';

type NotificationPayload = {
  installment_id: string;
  title: string;
  item_count?: number;
  inviter_name?: string;
  inviter_email?: string;
  role?: 'owner' | 'editor' | 'viewer';
  invitation_id?: string;
  item_id?: string;
  label?: string;
};

type NotificationRow = {
  id: string;
  type: 'invite' | 'invite_accepted' | 'invite_rejected' | 'reminder';
  payload: NotificationPayload;
  read: boolean;
  created_at: string;
};

function formatNotificationTitle(notification: NotificationRow) {
  const { type, payload } = notification;

  switch (type) {
    case 'invite':
      return `Invite to ${payload.title}`;
    case 'invite_accepted':
      return `${payload.inviter_name ?? 'Someone'} accepted your invite`;
    case 'invite_rejected':
      return `${payload.inviter_name ?? 'Someone'} declined your invite`;
    case 'reminder':
      return `Reminder: ${payload.label ?? payload.title}`;
    default:
      return payload.title ?? 'Notification';
  }
}

function formatNotificationSubtitle(notification: NotificationRow) {
  const { type, payload } = notification;

  switch (type) {
    case 'invite':
      return `Offered role: ${payload.role ?? 'viewer'}`;
    case 'invite_accepted':
      return `Joined ${payload.title}`;
    case 'invite_rejected':
      return `Declined access to ${payload.title}`;
    case 'reminder':
      return `Due ${payload.label}`;
    default:
      return '';
  }
}

function getNotificationIcon(type: NotificationRow['type']) {
  switch (type) {
    case 'invite':
      return UserPlus;
    case 'invite_accepted':
      return Check;
    case 'invite_rejected':
      return Mail;
    case 'reminder':
      return MessageCircle;
    default:
      return Mail;
  }
}

interface InviteResponseModalProps {
  open: boolean;
  notification: NotificationRow | null;
  onClose: () => void;
  onAction: () => void;
}

function InviteResponseModal({ open, notification, onClose, onAction }: InviteResponseModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleResponse = async (action: 'accept' | 'reject' | 'block_sender') => {
    if (!notification?.payload?.invitation_id) return;
    setError(null);
    setIsSaving(true);

    const response = await fetch('/api/invitations/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitation_id: notification.payload.invitation_id, action }),
    });

    const result = await response.json();
    setIsSaving(false);

    if (!response.ok) {
      setError(result.error || 'Unable to update invitation.');
      return;
    }

    toast({
      title:
        action === 'accept'
          ? 'Invitation accepted'
          : action === 'block_sender'
            ? 'Invitation rejected & sender blocked'
            : 'Invitation rejected',
      variant: 'success',
    });
    onAction();
    onClose();
  };

  if (!notification) return null;

  return (
    <Modal
      open={open}
      title="Respond to invite"
      description={`Respond to the invitation for ${notification.payload.title}.`}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="rounded-3xl border border-line bg-bg p-4">
          <p className="text-sm text-ink-muted">Offered role</p>
          <p className="mt-2 text-lg font-semibold text-ink">
            {notification.payload.role ? notification.payload.role.charAt(0).toUpperCase() + notification.payload.role.slice(1) : 'Viewer'}
          </p>
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" isLoading={isSaving} onClick={() => handleResponse('accept')}>
              Accept
            </Button>
            <Button type="button" variant="secondary" isLoading={isSaving} onClick={() => handleResponse('reject')}>
              Reject
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            isLoading={isSaving}
            onClick={() => handleResponse('block_sender')}
            className="text-danger"
          >
            Block this sender
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function NotificationBell() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<NotificationRow | null>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channel: any = null;

    const loadNotifications = async () => {
      const sessionResult = await supabase.auth.getSession();
      const userId = sessionResult.data.session?.user?.id;
      if (!userId) return;

      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, payload, read, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Failed to load notifications', error);
        return;
      }

      setNotifications((data ?? []) as NotificationRow[]);

      const channelName = `notifications-${userId}-${Date.now()}`;
      channel = supabase.channel(channelName);
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const row = payload.new as NotificationRow;
          setNotifications((current) => [row, ...current.filter((n) => n.id !== row.id)].slice(0, 20));
        }
      );

      await channel.subscribe();
    };

    loadNotifications();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [supabase]);

  useEffect(() => {
    if (!open) return;
    const unreadIds = notifications.filter((notification) => !notification.read).map((notification) => notification.id);
    if (unreadIds.length === 0) return;

    supabase.from('notifications').update({ read: true }).in('id', unreadIds).then(({ error }) => {
      if (error) {
        console.error('Failed to mark notifications as read', error);
        return;
      }
      setNotifications((current) => current.map((notification) => (unreadIds.includes(notification.id) ? { ...notification, read: true } : notification)));
    });
  }, [open, notifications, supabase]);

  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount);

  const handleRowClick = (notification: NotificationRow) => {
    setOpen(false);
    if (notification.type === 'invite') {
      setSelectedNotification(notification);
      return;
    }

    if (notification.payload.installment_id) {
      router.push(`/${notification.payload.installment_id}`);
    }
  };

  const handleInviteAction = () => {
    setNotifications((current) => current.filter((n) => n.id !== selectedNotification?.id));
  };

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        className="relative"
        onClick={() => setOpen((current) => !current)}
      >
        <Bell className="h-5 w-5" />
        <ChevronDown className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-danger text-[10px] font-semibold text-white">
            {badgeLabel}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 z-50 mt-3 w-[340px] rounded-3xl border border-line bg-surface shadow-2xl">
          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">Notifications</p>
              <span className="rounded-full bg-accent-soft px-2 py-1 text-[11px] font-semibold text-accent">
                {notifications.length}
              </span>
            </div>
            {notifications.length === 0 ? (
              <p className="text-sm text-ink-muted">No new notifications.</p>
            ) : (
              <div className="space-y-2">
                {notifications.map((notification) => {
                  const Icon = getNotificationIcon(notification.type);
                  return (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => handleRowClick(notification)}
                      className="flex w-full items-start gap-3 rounded-3xl border border-line bg-bg p-3 text-left transition hover:bg-accent-soft"
                    >
                      <span className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-surface text-ink">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-ink">{formatNotificationTitle(notification)}</p>
                        <p className="mt-1 text-xs text-ink-muted">{formatNotificationSubtitle(notification)}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${notification.read ? 'bg-surface text-ink border border-line' : 'bg-accent text-white'}`}>
                        {notification.read ? 'Read' : 'New'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}

      <InviteResponseModal
        open={Boolean(selectedNotification)}
        notification={selectedNotification}
        onClose={() => setSelectedNotification(null)}
        onAction={handleInviteAction}
      />
    </div>
  );
}
