"use client";

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BackButton, Select, Skeleton } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';

type Status = 'paid' | 'unpaid';
type InstallmentType = 'daily' | 'weekly' | 'monthly' | 'yearly';

type InstallmentItem = { id: string; status: Status; due_date: string };
type Member = { user_id: string; role: 'owner' | 'editor' | 'viewer' };
type Installment = {
  id: string;
  title: string;
  type: InstallmentType;
  created_by: string;
  installment_items: InstallmentItem[];
  installment_members: Member[];
};

type Tab = 'ongoing' | 'completed' | 'shared';
type SharedFilter = 'all' | 'to-me' | 'by-me';

function isShared(installment: Installment) {
  return installment.installment_members.length > 1;
}

function isSharedToMe(installment: Installment, userId: string) {
  return isShared(installment) && installment.created_by !== userId;
}

function isSharedByMe(installment: Installment, userId: string) {
  return isShared(installment) && installment.created_by === userId;
}

function AllInstallmentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) || 'ongoing');
  const [sharedFilter, setSharedFilter] = useState<SharedFilter>('all');

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData.session?.user?.id;
      if (!currentUserId) {
        router.replace('/login');
        return;
      }
      setUserId(currentUserId);
      const { data, error } = await supabase
        .from('installments')
        .select('id, title, type, created_by, installment_items(id, status, due_date), installment_members(user_id, role)')
        .order('title', { ascending: true });
      if (!error) setInstallments((data ?? []) as Installment[]);
      setLoading(false);
    };
    load();
  }, [router]);

  useEffect(() => {
    const focusId = searchParams.get('focus');
    if (!focusId || loading) return;
    window.requestAnimationFrame(() => {
      document.getElementById(`all-installment-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [loading, searchParams]);

  const visibleInstallments = useMemo(() => installments.filter((installment) => {
    const completed = installment.installment_items.length > 0 && installment.installment_items.every((item) => item.status === 'paid');
    const ongoing = installment.installment_items.some((item) => item.status === 'unpaid');
    if (tab === 'ongoing') return ongoing;
    if (tab === 'completed') return completed;
    if (sharedFilter === 'to-me') return isSharedToMe(installment, userId);
    if (sharedFilter === 'by-me') return isSharedByMe(installment, userId);
    return isShared(installment);
  }), [installments, sharedFilter, tab, userId]);

  const selectTab = (nextTab: Tab) => {
    setTab(nextTab);
    const source = searchParams.get('from');
    router.replace(`/installments/all?tab=${nextTab}${source ? `&from=${source}` : ''}`, { scroll: false });
  };

  return (
    <main className="min-h-screen bg-bg px-4 py-6 text-ink sm:py-10">
      <div className="mx-auto max-w-6xl">
        <BackButton href={searchParams.get('from') === 'dashboard' ? '/?focus=' : '/'} label={searchParams.get('from') === 'dashboard' ? 'Back to dashboard' : 'Back'} />
        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Installment groups</p>
          <h1 className="text-3xl font-semibold sm:text-4xl">All installments</h1>
          <p className="mt-2 text-sm text-ink-muted">Browse every plan you own or share.</p>
        </div>

        <div className="mb-6 border-b border-line pb-3">
          <div className="theme-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
            {(['ongoing', 'completed', 'shared'] as Tab[]).map((option) => (
              <button key={option} type="button" onClick={() => selectTab(option)} className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold capitalize ${tab === option ? 'bg-accent text-ink shadow-sm' : 'bg-surface text-ink-muted hover:bg-accent-soft'}`}>
                {option}
              </button>
            ))}
          </div>
          {tab === 'shared' ? (
            <Select
              value={sharedFilter}
              onChange={(value) => setSharedFilter(value as SharedFilter)}
              options={[{ value: 'all', label: 'All shared' }, { value: 'to-me', label: 'Shared to me' }, { value: 'by-me', label: 'Shared by me' }]}
              className="mt-3 w-full sm:ml-auto sm:w-auto sm:min-w-48"
            />
          ) : null}
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
            {[1, 2, 3, 4, 5, 6].map((item) => <Skeleton key={item} className="h-32 w-full rounded-3xl sm:h-36" />)}
          </div>
        ) : visibleInstallments.length === 0 ? (
          <div className="card p-8 text-center text-sm text-ink-muted sm:p-10">No installment groups in this view.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
            {visibleInstallments.map((installment) => {
              const unpaid = installment.installment_items.filter((item) => item.status === 'unpaid').length;
              return (
                <Link
                  key={installment.id}
                  id={`all-installment-${installment.id}`}
                  href={`/${installment.id}?returnTo=${encodeURIComponent(`/installments/all?tab=${tab}&focus=${installment.id}`)}`}
                  className="card block border-l-4 border-l-accent p-4 transition active:scale-[0.99] hover:border-accent hover:shadow-md sm:border-l sm:border-l-line sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="line-clamp-2 text-base font-semibold sm:text-lg">{installment.title}</h2>
                      <p className="mt-1 text-sm capitalize text-ink-muted">{installment.type} schedule</p>
                    </div>
                    {isShared(installment) ? <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">Shared</span> : null}
                  </div>
                  <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-ink-muted sm:mt-6 sm:text-sm">
                    <span className="rounded-full bg-line px-3 py-1.5">{installment.installment_items.length} items</span>
                    <span className="rounded-full bg-accent-soft px-3 py-1.5 text-accent">{unpaid} unpaid</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function AllInstallmentsFallback() {
  return (
    <main className="min-h-screen bg-bg px-4 py-6 text-ink sm:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
          {[1, 2, 3, 4, 5, 6].map((item) => <Skeleton key={item} className="h-32 w-full rounded-3xl sm:h-36" />)}
        </div>
      </div>
    </main>
  );
}

export default function AllInstallmentsPage() {
  return (
    <Suspense fallback={<AllInstallmentsFallback />}>
      <AllInstallmentsContent />
    </Suspense>
  );
}