"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Banknote, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { Skeleton } from '@/components/ui';

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
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${danger ? 'bg-danger-soft text-danger' : accent ? 'bg-accent-soft text-accent' : 'bg-gray-100 dark:bg-gray-800 text-ink'}`}>
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

async function fetchDashboardSummary(supabase: ReturnType<typeof createClient>, userId: string): Promise<DashboardSummary | null> {
  const { data: membershipData, error: membershipError } = await supabase
    .from('installment_members')
    .select('installment_id')
    .eq('user_id', userId);

  if (membershipError) {
    console.error('Failed to load installment memberships for dashboard summary', membershipError);
    return null;
  }

  const installmentIds = (membershipData ?? []).map((row) => row.installment_id).filter(Boolean);
  if (installmentIds.length === 0) {
    return {
      total_owed: 0,
      total_paid: 0,
      due_this_week: { count: 0, amount: 0 },
      overdue_count: 0,
      upcoming: [],
    };
  }

  const { data: itemData, error: itemError } = await supabase
    .from('installment_items')
    .select('id, label, due_date, amount, status, installment_id, installments(id, title)')
    .in('installment_id', installmentIds)
    .order('due_date', { ascending: true });

  if (itemError) {
    console.error('Failed to load installment items for dashboard summary', itemError);
    return null;
  }

  const items = (itemData ?? []) as unknown as Array<{
    id: string;
    label: string;
    due_date: string;
    amount: string | number;
    status: 'paid' | 'unpaid';
    installment_id: string;
    installments?: Array<{ id: string; title: string }> | null;
  }>;

  const unpaidItems = items.filter((item) => item.status === 'unpaid');
  const paidItems = items.filter((item) => item.status === 'paid');
  const today = new Date();
  const todayTimestamp = today.getTime();
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);

  const dueThisWeekItems = unpaidItems.filter((item) => {
    const due = new Date(item.due_date);
    return due.getTime() >= todayTimestamp && due.getTime() <= weekEnd.getTime();
  });

  const overdueCount = unpaidItems.filter((item) => new Date(item.due_date).getTime() < todayTimestamp).length;

  const upcoming = unpaidItems
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .slice(0, 5)
    .map((item) => ({
      installment_id: item.installment_id,
      installment_title: item.installments?.[0]?.title ?? '',
      item_id: item.id,
      item_label: item.label,
      due_date: item.due_date,
      amount: item.amount,
    }));

  return {
    total_owed: unpaidItems.reduce((sum, item) => sum + Number(item.amount), 0),
    total_paid: paidItems.reduce((sum, item) => sum + Number(item.amount), 0),
    due_this_week: {
      count: dueThisWeekItems.length,
      amount: dueThisWeekItems.reduce((sum, item) => sum + Number(item.amount), 0),
    },
    overdue_count: overdueCount,
    upcoming,
  };
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
          {summary.upcoming.length > 0 ? (
            <Link
              href="/installments"
              className="inline-flex items-center gap-1 text-sm font-semibold text-accent transition hover:underline"
            >
              View all
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
            {summary.upcoming.map((item) => (
              <li key={item.item_id}>
                <Link
                  href={`/${item.installment_id}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-line bg-bg p-4 transition hover:border-accent hover:bg-accent-soft/30"
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
                  <p className="shrink-0 text-sm font-bold text-ink">{formatAmount(item.amount)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}