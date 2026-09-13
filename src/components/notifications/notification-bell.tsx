"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, ChevronDown, Check, CheckCheck, Mail, MessageCircle, RefreshCw, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button, useToast } from '@/components/ui';
import { Modal } from '@/components/ui/modal';
import { createClient } from '@/lib/supabase/client';

type NotificationPayload = {
  installment_id: string;
  title: string;
  item_count?: number;
  type?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  inviter_name?: string;
  inviter_email?: string;
  invitee_name?: string;
  role?: 'owner' | 'editor' | 'viewer';
  invitation_id?: string;
  item_id?: string;
  label?: string;
  due_date?: string;
  deleted?: boolean;
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
      return `${payload.inviter_name ?? 'Someone'} invited you to ${payload.title}`;
    case 'invite_accepted':
      return `${payload.invitee_name ?? 'Someone'} accepted your invite`;
    case 'invite_rejected':
      return `${payload.invitee_name ?? 'Someone'} declined your invite`;
    case 'reminder':
      return payload.deleted ? `${payload.title} was deleted` : `Reminder: ${payload.label ?? payload.title}`;
    default:
      return payload.title ?? 'Notification';
  }
}

function formatNotificationSubtitle(notification: NotificationRow) {
  const { type, payload } = notification;

  switch (type) {
    case 'invite':
      return `${payload.type ? `${payload.type} schedule · ` : ''}${payload.item_count ?? 0} items · Offered role: ${payload.role ?? 'viewer'}`;
    case 'invite_accepted':
      return `Joined ${payload.title}`;
    case 'invite_rejected':
      return `Declined access to ${payload.title}`;
    case 'reminder':
      return payload.deleted ? 'This installment is no longer available.' : `Due ${payload.due_date ?? payload.label ?? 'soon'}`;
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
          <p className="text-sm text-ink-muted">From</p>
          <p className="mt-1 font-semibold text-ink">{notification.payload.inviter_name ?? notification.payload.inviter_email ?? 'Trackmoco member'}</p>
          <p className="mt-4 text-sm text-ink-muted">Installment</p>
          <p className="mt-1 font-semibold text-ink">{notification.payload.title}</p>
          <p className="mt-1 text-sm capitalize text-ink-muted">
            {notification.payload.type ?? 'installment'} schedule · {notification.payload.item_count ?? 0} items
          </p>
          <p className="mt-4 text-sm text-ink-muted">Offered role</p>
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
  const [unavailableIds, setUnavailableIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channel: any = null;

    const loadNotifications = async () => {
      setIsLoading(true);
      const userResult = await supabase.auth.getUser();
      const user = userResult.data.user;
      const userId = user?.id;
      if (!userId || !user.email) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, payload, read, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Failed to load notifications', error);
        setIsLoading(false);
        return;
      }

      const notificationRows = (data ?? []) as NotificationRow[];
      const { data: pendingInvites } = await supabase
        .from('invitations')
        .select('id, installment_id, invited_by, role, created_at, installments(title, type, total_count), profiles!invitations_invited_by_fkey(display_name, email)')
        .eq('status', 'pending')
        .eq('invited_email', user.email.toLowerCase())
        .order('created_at', { ascending: false })
        .limit(20);

      const existingInvitationIds = new Set(
        notificationRows
          .map((notification) => notification.payload.invitation_id)
          .filter((invitationId): invitationId is string => Boolean(invitationId))
      );
      const invitationRows: NotificationRow[] = (pendingInvites ?? [])
        .filter((invitation) => !existingInvitationIds.has(invitation.id))
        .map((invitation) => {
          const installment = Array.isArray(invitation.installments) ? invitation.installments[0] : invitation.installments;
          const inviter = Array.isArray(invitation.profiles) ? invitation.profiles[0] : invitation.profiles;
          return {
            id: `invitation-${invitation.id}`,
            type: 'invite',
            payload: {
              installment_id: invitation.installment_id,
              title: installment?.title ?? 'Shared installment',
              type: installment?.type,
              item_count: installment?.total_count,
              inviter_name: inviter?.display_name ?? inviter?.email ?? 'A Trackmoco member',
              role: invitation.role,
              invitation_id: invitation.id,
            },
            read: false,
            created_at: invitation.created_at,
          };
        });

      setNotifications([...notificationRows, ...invitationRows].sort((left, right) => (
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
      )).slice(0, 20));
      setUnavailableIds([]);

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
      setIsLoading(false);
    };

    loadNotifications();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [reloadToken, supabase]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount);
  const visibleNotifications = filter === 'unread'
    ? notifications.filter((notification) => !notification.read)
    : notifications;

  const markAllAsRead = async () => {
    const unreadIds = notifications
      .filter((notification) => !notification.read && !notification.id.startsWith('invitation-'))
      .map((notification) => notification.id);

    if (unreadIds.length > 0) {
      const { error } = await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
      if (error) {
        console.error('Failed to mark all notifications as read', error);
        return;
      }
    }

    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
  };

  const refreshNotifications = () => {
    setIsRefreshing(true);
    setReloadToken((current) => current + 1);
    window.setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleRowClick = async (notification: NotificationRow) => {
    setOpen(false);
    if (notification.payload.deleted || unavailableIds.includes(notification.id)) return;

    if (!notification.read && !notification.id.startsWith('invitation-')) {
      setNotifications((current) => current.map((item) => (
        item.id === notification.id ? { ...item, read: true } : item
      )));
      const { error } = await supabase.from('notifications').update({ read: true }).eq('id', notification.id);
      if (error) console.error('Failed to mark notification as read', error);
    }

    // An invitee is not a member until the invitation is accepted, so RLS
    // correctly hides the installment during this part of the flow.
    if (notification.type === 'invite') {
      setSelectedNotification(notification);
      return;
    }

    if (notification.payload.installment_id) {
      const { data } = await supabase
        .from('installments')
        .select('id')
        .eq('id', notification.payload.installment_id)
        .maybeSingle();
      if (!data) {
        setUnavailableIds((current) => [...current, notification.id]);
        return;
      }
    }

    if (notification.payload.installment_id) {
      router.push(`/${notification.payload.installment_id}`);
    }
  };

  const handleInviteAction = () => {
    setNotifications((current) => current.filter((n) => n.id !== selectedNotification?.id));
  };

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        className="relative"
        onClick={() => setOpen((current) => !current)}
      >
        <Bell className="h-5 w-5" />
        <ChevronDown className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger text-[10px] font-semibold text-ink">
            {badgeLabel}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 z-50 mt-3 flex max-h-[min(36rem,calc(100dvh-5rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl">
          <div className="shrink-0 space-y-3 border-b border-line p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">Notifications</p>
                <p className="mt-1 text-xs text-ink-muted">{unreadCount ? `${unreadCount} unread` : 'All caught up'}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Refresh notifications"
                  aria-label="Refresh notifications"
                  onClick={refreshNotifications}
                  className="rounded-xl p-2 text-ink-muted transition hover:bg-accent-soft hover:text-ink"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  title="Mark all as read"
                  aria-label="Mark all as read"
                  onClick={markAllAsRead}
                  disabled={unreadCount === 0}
                  className="rounded-xl p-2 text-ink-muted transition hover:bg-accent-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
                <span className="rounded-full bg-accent-soft px-2 py-1 text-[11px] font-semibold text-accent">
                  {notifications.length}
                </span>
              </div>
            </div>
            <div className="flex rounded-2xl border border-line bg-bg p-1" role="tablist" aria-label="Notification filter">
              {(['all', 'unread'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={filter === option}
                  onClick={() => setFilter(option)}
                  className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold capitalize transition ${filter === option ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}
                >
                  {option} {option === 'unread' ? `(${unreadCount})` : ''}
                </button>
              ))}
            </div>
          </div>
          <div className="theme-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="space-y-2" aria-label="Loading notifications">
                {[1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-3xl bg-bg" />)}
              </div>
            ) : visibleNotifications.length === 0 ? (
              <div className="py-8 text-center">
                <Mail className="mx-auto h-8 w-8 text-ink-muted" />
                <p className="mt-3 text-sm text-ink-muted">{filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {visibleNotifications.map((notification) => {
                  const Icon = getNotificationIcon(notification.type);
                  return (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => handleRowClick(notification)}
                      disabled={unavailableIds.includes(notification.id) || notification.payload.deleted}
                      className="flex w-full items-start gap-3 rounded-3xl border border-line bg-bg p-3 text-left transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-surface text-ink">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-ink">{formatNotificationTitle(notification)}</p>
                        <p className="mt-1 text-xs text-ink-muted">
                          {unavailableIds.includes(notification.id) || notification.payload.deleted
                            ? 'This installment is no longer available.'
                            : formatNotificationSubtitle(notification)}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${notification.read ? 'bg-surface text-ink border border-line' : 'bg-accent text-ink'}`}>
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
