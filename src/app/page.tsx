"use client";

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Moon, Sunrise, Sun, type LucideIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button, Skeleton } from '@/components/ui';
import { DashboardSummary } from '@/components/dashboard/dashboard-summary';
import { getInstallmentDetailsUrl } from '@/lib/utils/installment-url';
import { InstallmentCardPaymentTotals } from '@/components/installments/installment-card-payment-totals';

type InstallmentItem = {
  id: string;
  status: 'paid' | 'unpaid';
  due_date: string;
  amount: string | number;
};

type InstallmentRow = {
  id: string;
  short_id: string;
  title: string;
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  installment_items: InstallmentItem[];
};

type Greeting = {
  label: string;
  Icon: LucideIcon;
};

function getTimeGreeting(date: Date): Greeting {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return { label: 'Good morning', Icon: Sunrise };
  if (hour >= 12 && hour < 17) return { label: 'Good afternoon', Icon: Sun };
  return { label: 'Good evening', Icon: Moon };
}

function getGreetingName(value: string | null | undefined): string | null {
  const name = value?.trim();
  if (!name) return null;
  return name.split(/\s+/).slice(0, 2).join(' ') || null;
}

function HomePageContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [installments, setInstallments] = useState<InstallmentRow[]>([]);
  const [greeting, setGreeting] = useState<Greeting>({ label: 'Welcome', Icon: Sun });
  const [profileName, setProfileName] = useState<string | null>(null);

  useEffect(() => {
    const updateGreeting = () => setGreeting(getTimeGreeting(new Date()));
    updateGreeting();
    const greetingInterval = window.setInterval(updateGreeting, 60_000);

    const fetchData = async () => {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;

      if (!user?.id) {
        router.replace('/login');
        return;
      }

      const [{ data: profile, error: profileError }, { data, error }] = await Promise.all([
        supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
        supabase
          .from('installments')
          .select('id, short_id, title, type, installment_items(id, status, due_date, amount)')
          .order('title', { ascending: true }),
      ]);

      if (profileError) {
        console.error('Failed to load dashboard profile name', profileError);
      }

      const greetingName = getGreetingName(profile?.display_name)
        ?? getGreetingName(user.user_metadata?.full_name)
        ?? getGreetingName(user.user_metadata?.name)
        ?? getGreetingName(user.email?.split('@')[0]);
      setProfileName(greetingName);

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
    return () => window.clearInterval(greetingInterval);
  }, [router]);

  const ongoingInstallments = useMemo(
    () =>
      installments.filter((installment) =>
        installment.installment_items.some((item) => item.status === 'unpaid')
      ),
    [installments]
  );

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

  const GreetingIcon = greeting.Icon;

  return (
    <main className="min-h-screen bg-bg px-4 py-6 text-ink sm:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent shadow-sm sm:h-14 sm:w-14">
              <GreetingIcon className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
            </span>
            <h1 className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-3xl font-semibold leading-tight sm:text-4xl">
              <span className="text-ink">{greeting.label}{profileName ? ',' : ''}</span>
              {profileName ? <span className="break-words text-accent">{profileName}</span> : null}
            </h1>
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
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3">
                  <div>
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="mt-2 h-4 w-24" />
                  </div>
                  <div>
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="mt-2 h-4 w-24" />
                  </div>
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
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-accent-soft px-5 py-2 text-sm font-semibold text-accent">Ongoing {countBadge(ongoingInstallments.length)}</span>
                </div>
                <Link href="/installments/all?from=dashboard" className="text-sm font-semibold text-accent hover:underline">
                  View all installments
                </Link>
            </div>

            <div id="installments" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ongoingInstallments.length === 0 ? (
                <div className="card p-8 text-center text-sm text-ink-muted">
                  No ongoing installments yet. Create a plan to start tracking payments.
                </div>
              ) : (
                ongoingInstallments.map((installment) => {
                  const unpaidCount = installment.installment_items.filter((item) => item.status === 'unpaid').length;
                  const paidCount = installment.installment_items.filter((item) => item.status === 'paid').length;
                  const paidAmount = installment.installment_items.reduce(
                    (total, item) => item.status === 'paid' ? total + Number(item.amount) : total,
                    0
                  );
                  const remainingAmount = installment.installment_items.reduce(
                    (total, item) => item.status === 'unpaid' ? total + Number(item.amount) : total,
                    0
                  );
                  return (
                    <Link
                      key={installment.id}
                      href={getInstallmentDetailsUrl(installment.short_id)}
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
                      <InstallmentCardPaymentTotals
                        paidAmount={paidAmount}
                        remainingAmount={remainingAmount}
                      />
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

function HomePageFallback() {
  return (
    <main className="min-h-screen bg-bg px-4 py-6 text-ink sm:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 space-y-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="space-y-6">
          {[1, 2, 3].map((item) => (
            <div key={item} className="card p-6">
              <Skeleton className="mb-4 h-8 w-48" />
              <Skeleton className="mb-4 h-5 w-32" />
              <div className="grid gap-3 sm:grid-cols-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3">
                <div>
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-2 h-4 w-24" />
                </div>
                <div>
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-2 h-4 w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomePageFallback />}>
      <HomePageContent />
    </Suspense>
  );
}
