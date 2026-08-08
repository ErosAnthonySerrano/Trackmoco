"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { Button, Skeleton } from '@/components/ui';
import { DashboardSummary } from '@/components/dashboard/dashboard-summary';

type InstallmentItem = {
  id: string;
  status: 'paid' | 'unpaid';
  due_date: string;
};

type InstallmentRow = {
  id: string;
  title: string;
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  installment_items: InstallmentItem[];
};

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [installments, setInstallments] = useState<InstallmentRow[]>([]);
  const [activeTab, setActiveTab] = useState<'ongoing' | 'completed'>('ongoing');
  const [signOutLoading, setSignOutLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;

      if (!userId) {
        router.replace('/login');
        return;
      }

      const { data, error } = await supabase
        .from('installments')
        .select('id, title, type, installment_items(id, status, due_date)')
        .order('title', { ascending: true });

      if (error) {
        console.error('Failed to load installments', error);
        setInstallments([]);
        setLoading(false);
        return;
      }

      setInstallments((data ?? []) as InstallmentRow[]);
      setLoading(false);
    };

    fetchData();
  }, [router]);

  const ongoingInstallments = useMemo(
    () =>
      installments.filter((installment) =>
        installment.installment_items.some((item) => item.status === 'unpaid')
      ),
    [installments]
  );

  const completedInstallments = useMemo(
    () =>
      installments.filter((installment) =>
        installment.installment_items.every((item) => item.status === 'paid')
      ),
    [installments]
  );

  const activeInstallments = activeTab === 'ongoing' ? ongoingInstallments : completedInstallments;

  const countBadge = (count: number) => (
    <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
      {count}
    </span>
  );

  const getStatusLabel = (installment: InstallmentRow) => {
    const unpaidItems = installment.installment_items.filter((item) => item.status === 'unpaid');
    if (unpaidItems.length === 0) return null;

    const dueSoon = unpaidItems.some((item) => {
      const due = parseISO(item.due_date);
      const delta = differenceInCalendarDays(due, new Date());
      return delta >= 0 && delta <= 7;
    });

    if (dueSoon) {
      return (
        <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">Due soon</span>
      );
    }

    return null;
  };

  const handleSignOut = async () => {
    setSignOutLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    setSignOutLoading(false);
    if (error) {
      console.error('Sign out failed', error);
      return;
    }
    router.replace('/login');
  };

  return (
    <main className="min-h-screen bg-bg px-4 py-10 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Installments</p>
            <h1 className="text-4xl font-semibold">Your plans</h1>
          </div>
        </div>

        {loading ? (
          <div className="space-y-6">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="card p-6">
                <Skeleton className="h-8 w-48 mb-4" />
                <Skeleton className="h-5 w-32 mb-4" />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : installments.length === 0 ? (
          <div className="flex min-h-[60vh] items-center justify-center card p-10 text-center shadow-md">
            <div className="max-w-lg">
              <h2 className="mb-4 text-3xl font-semibold text-ink">No installments yet</h2>
              <p className="mb-6 text-sm leading-7 text-ink-muted">
                Create your first plan to start tracking due dates, payments, and reminders in one place.
              </p>
              <Link href="/installments">
                <Button type="button">Add installment</Button>
              </Link>
            </div>
          </div>
        ) : (
            <div className="space-y-6">
              <DashboardSummary />
              <div className="flex flex-wrap gap-2 border-b border-line pb-3">
              <button
                type="button"
                onClick={() => setActiveTab('ongoing')}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition ${activeTab === 'ongoing' ? 'bg-accent text-white' : 'bg-surface text-ink border border-line hover:bg-gray-100 dark:hover:bg-gray-800'}`}
              >
                Ongoing {countBadge(ongoingInstallments.length)}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('completed')}
                disabled={completedInstallments.length === 0}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition ${activeTab === 'completed' ? 'bg-accent text-white' : 'bg-surface text-ink border border-line hover:bg-gray-100 dark:hover:bg-gray-800'} ${completedInstallments.length === 0 ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                Completed {countBadge(completedInstallments.length)}
              </button>
            </div>

            <div className="grid gap-4">
              {activeInstallments.length === 0 ? (
                <div className="card p-8 text-center text-sm text-ink-muted">
                  {activeTab === 'ongoing'
                    ? 'No ongoing installments yet. Mark one of your plans as in progress by adding an unpaid item.'
                    : 'No completed installments yet.'}
                </div>
              ) : (
                activeInstallments.map((installment) => {
                  const unpaidCount = installment.installment_items.filter((item) => item.status === 'unpaid').length;
                  const paidCount = installment.installment_items.filter((item) => item.status === 'paid').length;
                  return (
                    <Link
                      key={installment.id}
                      href={`/${installment.id}`}
                      className="group block card p-6 transition hover:shadow-md hover:border-accent"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-xl font-semibold text-ink">{installment.title}</h3>
                          <p className="mt-2 text-sm text-ink-muted capitalize">{installment.type} schedule</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {getStatusLabel(installment)}
                          <span className="rounded-2xl bg-surface px-3 py-2 text-xs font-semibold text-ink border border-line">
                            {paidCount} paid · {unpaidCount} unpaid
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

