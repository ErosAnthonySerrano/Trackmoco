"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Banknote, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { Skeleton } from '@/components/ui';
import { ItemQuickEdit } from '@/components/installments/item-quick-edit';

type UpcomingItem = {
  installment_id: string;
  installment_title: string;
  item_id: string;
  item_label: string;
  due_date: string;
  amount: string | number;
};

type DashboardSummary = {
  total_owed: string | number;
  total_paid: string | number;
  due_this_week: {
    count: number;
    amount: string | number;
  };
  overdue_count: number;
  upcoming_count: number;
  upcoming: UpcomingItem[];
};

type StatCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
  danger?: boolean;
  accent?: boolean;
};

function StatCard({ icon, label, value, sublabel, danger, accent }: StatCardProps) {
  return (
    <div className={`card p-5 ${danger ? 'border-danger/20' : ''}`}>
      <div className="flex items-center gap-3">
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${danger ? 'bg-danger-soft text-danger' : accent ? 'bg-accent-soft text-accent' : 'bg-line text-ink'}`}>
          {icon}
        </span>
        <p className="text-sm font-medium text-ink-muted">{label}</p>
      </div>
      <p className={`mt-4 text-3xl font-bold ${danger ? 'text-danger' : 'text-ink'}`}>
        {value}
      </p>
      {sublabel ? <p className="mt-1 text-xs text-ink-muted">{sublabel}</p> : null}
    </div>
  );
}

function formatAmount(value: string | number) {
  const num = Number(value);
  if (Number.isNaN(num)) return '₱0.00';
  return `₱${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getDueLabel(date: string) {
  const days = differenceInCalendarDays(parseISO(date), new Date());
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, className: 'bg-danger-soft text-danger' };
  if (days === 0) return { label: 'Due today', className: 'bg-danger-soft text-danger' };
  if (days <= 7) return { label: `Due in ${days}d`, className: 'bg-accent-soft text-accent' };
  return { label: format(parseISO(date), 'MMM d, yyyy'), className: 'bg-line text-ink-muted' };
}

async function fetchDashboardSummary(supabase: ReturnType<typeof createClient>, userId: string): Promise<DashboardSummary | null> {
  const { data, error } = await supabase.rpc('get_dashboard_summary', { p_user_id: userId });

  if (error) {
    if (error.code !== 'PGRST202') {
      console.error('Failed to load dashboard summary', error);
      return null;
    }

    // Keep older environments usable until the dashboard RPC migration is applied.
    const { data: memberships, error: membershipError } = await supabase
      .from('installment_members')
      .select('installment_id')
      .eq('user_id', userId);
    if (membershipError) {
      console.error('Failed to load dashboard memberships', membershipError);
      return null;
    }

    const installmentIds = (memberships ?? []).map((membership) => membership.installment_id);
    if (installmentIds.length === 0) {
      return {
        total_owed: 0,
        total_paid: 0,
        due_this_week: { count: 0, amount: 0 },
        overdue_count: 0,
        upcoming_count: 0,
        upcoming: [],
      };
    }

    const { data: items, error: itemError } = await supabase
      .from('installment_items')
      .select('id, label, due_date, amount, status, installment_id, installments(id, title)')
      .in('installment_id', installmentIds)
      .order('due_date', { ascending: true });
    if (itemError) {
      console.error('Failed to load dashboard items', itemError);
      return null;
    }

    const rows = (items ?? []) as unknown as Array<{
      id: string;
      label: string;
      due_date: string;
      amount: string | number;
      status: 'paid' | 'unpaid';
      installment_id: string;
      installments?: Array<{ id: string; title: string }> | null;
    }>;
    const unpaid = rows.filter((item) => item.status === 'unpaid');
    const paid = rows.filter((item) => item.status === 'paid');
    const today = new Date();
    const todayDate = today.toISOString().slice(0, 10);
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);
    const weekEndDate = weekEnd.toISOString().slice(0, 10);
    const dueThisWeek = unpaid.filter((item) => item.due_date >= todayDate && item.due_date <= weekEndDate);
    const upcoming = unpaid.slice(0, 5).map((item) => ({
      installment_id: item.installment_id,
      installment_title: item.installments?.[0]?.title ?? '',
      item_id: item.id,
      item_label: item.label,
      due_date: item.due_date,
      amount: item.amount,
    }));

    return {
      total_owed: unpaid.reduce((sum, item) => sum + Number(item.amount), 0),
      total_paid: paid.reduce((sum, item) => sum + Number(item.amount), 0),
      due_this_week: {
        count: dueThisWeek.length,
        amount: dueThisWeek.reduce((sum, item) => sum + Number(item.amount), 0),
      },
      overdue_count: unpaid.filter((item) => item.due_date < todayDate).length,
      upcoming_count: unpaid.length,
      upcoming,
    };
  }

  return (data ?? null) as DashboardSummary | null;
}

export function DashboardSummary() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSummary = async () => {
      const supabase = createClient();
      const sessionResult = await supabase.auth.getSession();
      const userId = sessionResult.data.session?.user?.id;

      if (!userId) {
        setLoading(false);
        return;
      }

      const summaryData = await fetchDashboardSummary(supabase, userId);
      setSummary(summaryData);
      setLoading(false);
    };

    loadSummary();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
              <Skeleton className="h-5 w-24 mb-3" />
              <Skeleton className="h-8 w-32" />
            </div>
          ))}
        </div>
        <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
          <Skeleton className="h-5 w-32 mb-4" />
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Banknote className="h-4 w-4" />}
          label="Total owed"
          value={formatAmount(summary.total_owed)}
          accent
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Total paid"
          value={formatAmount(summary.total_paid)}
          accent
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Due this week"
          value={formatAmount(summary.due_this_week.amount)}
          sublabel={`${summary.due_this_week.count} item${summary.due_this_week.count === 1 ? '' : 's'} due in the next 7 days`}
          accent
        />
        {summary.overdue_count > 0 ? (
          <StatCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Overdue"
            value={String(summary.overdue_count)}
            sublabel={`${summary.overdue_count === 1 ? 'item' : 'items'} past due`}
            danger
          />
        ) : null}
      </div>

      <div className="card p-5">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Upcoming payments</h2>
          {summary.upcoming_count > 5 ? (
            <Link
              href="/upcoming"
              className="inline-flex items-center gap-1 text-sm font-semibold text-accent transition hover:underline"
            >
              View all upcoming
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>

        {summary.upcoming.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-bg px-4 py-8 text-center text-sm text-ink-muted">
            No upcoming payments &mdash; you are all caught up.
          </p>
        ) : (
          <ul className="space-y-3">
            {summary.upcoming.map((item) => {
              const due = getDueLabel(item.due_date);
              return (
                <li key={item.item_id}>
                  <ItemQuickEdit
                    itemId={item.item_id}
                    installmentId={item.installment_id}
                    onChanged={(updatedItem) => {
                      if (!updatedItem) return;
                      setSummary((current) => current ? {
                        ...current,
                        upcoming: updatedItem.status === 'paid'
                          ? current.upcoming.filter((upcomingItem) => upcomingItem.item_id !== updatedItem.id)
                          : current.upcoming.map((upcomingItem) => upcomingItem.item_id === updatedItem.id
                            ? { ...upcomingItem, due_date: updatedItem.due_date, amount: updatedItem.amount }
                            : upcomingItem),
                        upcoming_count: updatedItem.status === 'paid' ? Math.max(0, current.upcoming_count - 1) : current.upcoming_count,
                      } : current);
                    }}
                    className="flex w-full flex-col gap-3 rounded-xl border border-line bg-bg p-4 text-left transition hover:border-accent hover:bg-accent-soft/30 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {item.installment_title}
                        <span className="font-normal text-ink-muted"> · {item.item_label}</span>
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">
                        Due {format(parseISO(item.due_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${due.className}`}>{due.label}</span>
                      <p className="text-sm font-bold text-ink">{formatAmount(item.amount)}</p>
                    </div>
                  </ItemQuickEdit>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}