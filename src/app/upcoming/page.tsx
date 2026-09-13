"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { ArrowRight, CalendarClock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { BackButton, Skeleton } from '@/components/ui';
import { ItemQuickEdit } from '@/components/installments/item-quick-edit';

type InstallmentSummary = {
  id: string;
  title: string;
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
};

type UpcomingRow = {
  id: string;
  label: string;
  due_date: string;
  amount: string | number;
  installment_id: string;
  installments: InstallmentSummary | InstallmentSummary[] | null;
};

type UpcomingGroup = {
  installment: InstallmentSummary;
  items: UpcomingRow[];
};

function getInstallment(value: UpcomingRow['installments'], installmentId: string): InstallmentSummary {
  const installment = Array.isArray(value) ? value[0] : value;
  return installment ?? { id: installmentId, title: 'Installment', type: 'monthly' };
}

function formatAmount(value: string | number) {
  const amount = Number(value);
  return `PHP ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getDueLabel(date: string) {
  const days = differenceInCalendarDays(parseISO(date), new Date());
  if (days < 0) return { label: `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`, className: 'bg-danger-soft text-danger' };
  if (days === 0) return { label: 'Due today', className: 'bg-danger-soft text-danger' };
  if (days <= 7) return { label: `Due in ${days} day${days === 1 ? '' : 's'}`, className: 'bg-accent-soft text-accent' };
  return { label: format(parseISO(date), 'MMM d, yyyy'), className: 'bg-line text-ink-muted' };
}

export default function UpcomingPage() {
  const router = useRouter();
  const [rows, setRows] = useState<UpcomingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUpcoming = async () => {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
        router.replace('/login');
        return;
      }

      const { data, error } = await supabase
        .from('installment_items')
        .select('id, label, due_date, amount, installment_id, installments(id, title, type)')
        .eq('status', 'unpaid')
        .order('due_date', { ascending: true });

      if (error) {
        console.error('Failed to load upcoming payments', error);
        setRows([]);
      } else {
        setRows((data ?? []) as UpcomingRow[]);
      }
      setLoading(false);
    };

    loadUpcoming();
  }, [router]);

  const groups = useMemo<UpcomingGroup[]>(() => {
    const grouped = new Map<string, UpcomingGroup>();
    rows.forEach((row) => {
      const installment = getInstallment(row.installments, row.installment_id);
      const group = grouped.get(row.installment_id) ?? { installment, items: [] };
      group.items.push(row);
      grouped.set(row.installment_id, group);
    });
    return Array.from(grouped.values());
  }, [rows]);

  return (
    <main className="min-h-screen bg-bg px-4 py-6 text-ink sm:py-10">
      <div className="mx-auto max-w-5xl">
        <BackButton href="/" label="Back to dashboard" />
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Payment schedule</p>
            <h1 className="text-3xl font-semibold sm:text-4xl">Upcoming payments</h1>
            <p className="mt-2 text-sm text-ink-muted">Every unpaid item, organized by installment plan.</p>
          </div>
          {!loading ? <p className="text-sm font-semibold text-ink-muted">{rows.length} item{rows.length === 1 ? '' : 's'}</p> : null}
        </div>

        {loading ? (
          <div className="space-y-5">
            {[1, 2, 3].map((group) => (
              <section key={group} className="card p-5">
                <Skeleton className="h-6 w-48" />
                <div className="mt-5 space-y-3">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              </section>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="card p-10 text-center">
            <CalendarClock className="mx-auto h-10 w-10 text-success" />
            <h2 className="mt-4 text-xl font-semibold">You are all caught up</h2>
            <p className="mt-2 text-sm text-ink-muted">There are no unpaid payments across your installment plans.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <section key={group.installment.id} className="card overflow-hidden">
                <div className="flex flex-col gap-2 border-b border-line bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{group.installment.title}</h2>
                    <p className="text-sm capitalize text-ink-muted">{group.installment.type} schedule · {group.items.length} unpaid item{group.items.length === 1 ? '' : 's'}</p>
                  </div>
                  <Link href={`/${group.installment.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
                    Open installment
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="divide-y divide-line">
                  {group.items.map((item) => {
                    const due = getDueLabel(item.due_date);
                    return (
                      <ItemQuickEdit
                        key={item.id}
                        itemId={item.id}
                        installmentId={item.installment_id}
                        onChanged={(updatedItem) => {
                          if (!updatedItem || updatedItem.status === 'paid') {
                            setRows((current) => current.filter((row) => row.id !== item.id));
                            return;
                          }
                          setRows((current) => current.map((row) => row.id === updatedItem.id
                            ? { ...row, due_date: updatedItem.due_date, amount: updatedItem.amount }
                            : row));
                        }}
                        className="flex w-full flex-col gap-3 px-5 py-4 text-left transition hover:bg-accent-soft sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <CalendarClock className="h-5 w-5 shrink-0 text-accent" />
                          <div>
                            <p className="font-semibold">{item.label}</p>
                            <p className="text-sm text-ink-muted">Due {format(parseISO(item.due_date), 'MMM d, yyyy')}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-4 sm:justify-end">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${due.className}`}>{due.label}</span>
                          <span className="text-sm font-semibold">{formatAmount(item.amount)}</span>
                        </div>
                      </ItemQuickEdit>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}