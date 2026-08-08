"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { format, parseISO } from 'date-fns';
import { Button, Skeleton } from '@/components/ui';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { ThemeToggle } from '@/components/theme-toggle';
import { ItemEditModal, ProofFile, ProofViewerModal } from '@/components/installments/item-edit-modal';
import { ShareModal } from '@/components/installments/share-modal';

type InstallmentItem = {
  id: string;
  label: string;
  due_date: string;
  amount: string;
  status: 'paid' | 'unpaid';
  proof_files?: ProofFile[];
};

type Installment = {
  id: string;
  title: string;
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  installment_items: InstallmentItem[];
};

export default function InstallmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const installmentId = params?.id as string;
  const [installment, setInstallment] = useState<Installment | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'owner' | 'editor' | 'viewer'>('viewer');
  const [activeTab, setActiveTab] = useState<'in-progress' | 'paid'>('in-progress');
  const [pageInProgress, setPageInProgress] = useState(1);
  const [pagePaid, setPagePaid] = useState(1);
  const [openItem, setOpenItem] = useState<InstallmentItem | null>(null);
  const [proofItem, setProofItem] = useState<InstallmentItem | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!installmentId) return;

    const fetchInstallment = async () => {
      const supabase = createClient();
      const sessionResult = await supabase.auth.getSession();
      const userId = sessionResult.data.session?.user?.id;
      if (!userId) {
        router.replace('/login');
        return;
      }
      setCurrentUserId(userId);

      const [{ data: memberData, error: memberError }, { data: installmentData, error: installmentError }] = await Promise.all([
        supabase
          .from('installment_members')
          .select('role')
          .eq('installment_id', installmentId)
          .eq('user_id', userId)
          .single(),
        supabase
          .from('installments')
          .select('id, title, type, installment_items(id, label, due_date, amount, status, proof_files(id, file_url, file_type, uploaded_at, uploaded_by, original_name, profiles(display_name, email)))')
          .eq('id', installmentId)
          .single(),
      ]);

      if (memberError || installmentError || !installmentData) {
        console.error('Failed to load installment', memberError ?? installmentError);
        router.replace('/');
        return;
      }

      setUserRole(memberData?.role ?? 'viewer');
      setInstallment(installmentData as Installment);
      setLoading(false);
    };

    fetchInstallment();
  }, [installmentId, router]);

  const items = useMemo(() => installment?.installment_items ?? [], [installment?.installment_items]);
  const inProgress = useMemo(() => items.filter((item) => item.status === 'unpaid'), [items]);
  const paidItems = useMemo(() => items.filter((item) => item.status === 'paid'), [items]);

  const pageSize = 6;
  const activeItems = activeTab === 'in-progress'
    ? inProgress.slice((pageInProgress - 1) * pageSize, pageInProgress * pageSize)
    : paidItems.slice((pagePaid - 1) * pageSize, pagePaid * pageSize);

  const pageCount = activeTab === 'in-progress'
    ? Math.max(1, Math.ceil(inProgress.length / pageSize))
    : Math.max(1, Math.ceil(paidItems.length / pageSize));

  const formatDate = (value: string) => format(parseISO(value), 'MMM d, yyyy');

  return (
    <main className="min-h-screen bg-bg px-4 py-10 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Installment details</p>
            <h1 className="text-4xl font-semibold">{installment?.title ?? 'Loading...'}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <NotificationBell />
            <ThemeToggle />
            {userRole !== 'viewer' ? (
              <Button type="button" variant="secondary" onClick={() => setShareOpen(true)}>
                Share
              </Button>
            ) : null}
            <Button type="button" onClick={() => router.push('/')}>
              Back to plans
            </Button>
          </div>
        </div>

        <ShareModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          installmentId={installmentId}
          installmentTitle={installment?.title ?? ''}
        />

        {loading ? (
          <div className="space-y-6">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="rounded-3xl border border-line bg-surface p-6 shadow-sm">
                <Skeleton className="h-8 w-48 mb-4" />
                <Skeleton className="h-5 w-32 mb-4" />
                <Skeleton className="h-14 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex flex-wrap gap-3 border-b border-line pb-3">
              <button
                type="button"
                onClick={() => setActiveTab('in-progress')}
                className={`rounded-3xl px-4 py-3 text-sm font-semibold transition ${activeTab === 'in-progress' ? 'bg-accent-soft text-accent' : 'bg-surface text-ink border border-line'}`}
              >
                In Progress ({inProgress.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('paid')}
                className={`rounded-3xl px-4 py-3 text-sm font-semibold transition ${activeTab === 'paid' ? 'bg-accent-soft text-accent' : 'bg-surface text-ink border border-line'}`}
              >
                Paid ({paidItems.length})
              </button>
            </div>

            {activeItems.length === 0 ? (
              <div className="rounded-3xl border border-line bg-surface p-10 text-center text-sm text-ink-muted">
                {activeTab === 'in-progress'
                  ? 'No unpaid items yet.'
                  : 'No paid items yet.'}
              </div>
            ) : (
              <>
                <div className="hidden sm:block rounded-3xl border border-line bg-surface overflow-hidden">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-bg">
                      <tr>
                        <th className="border-b border-line px-4 py-4">Item</th>
                        <th className="border-b border-line px-4 py-4">Due date</th>
                        <th className="border-b border-line px-4 py-4">Status</th>
                        <th className="border-b border-line px-4 py-4">Proof</th>
                        <th className="border-b border-line px-4 py-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeItems.map((item) => (
                        <tr key={item.id} className="border-b border-line last:border-b-0 hover:bg-accent-soft/60 transition">
                          <td className="px-4 py-4 align-top text-ink">{item.label}</td>
                          <td className="px-4 py-4 align-top text-ink-muted">{formatDate(item.due_date)}</td>
                          <td className="px-4 py-4 align-top">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.status === 'paid' ? 'bg-success-soft text-success' : 'bg-surface text-ink border border-line'}`}>
                              {item.status === 'paid' ? 'Paid' : 'Unpaid'}
                            </span>
                          </td>
                          <td className="px-4 py-4 align-top">
                            {item.proof_files && item.proof_files.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => setProofItem(item)}
                                className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent"
                              >
                                Proof ({item.proof_files.length})
                              </button>
                            ) : (
                              <span className="text-sm text-ink-muted">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4 align-top">
                            <Button type="button" variant="secondary" onClick={() => setOpenItem(item)}>
                              Edit
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-4 sm:hidden">
                  {activeItems.map((item) => (
                    <div key={item.id} className="rounded-3xl border border-line bg-surface p-5">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-ink">{item.label}</p>
                          <p className="mt-1 text-sm text-ink-muted">Due {formatDate(item.due_date)}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.status === 'paid' ? 'bg-success-soft text-success' : 'bg-surface text-ink border border-line'}`}>
                          {item.status === 'paid' ? 'Paid' : 'Unpaid'}
                        </span>
                      </div>
                      <div className="flex flex-col gap-3">
                        {item.proof_files && item.proof_files.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setProofItem(item)}
                            className="rounded-2xl bg-accent-soft px-4 py-3 text-sm font-semibold text-accent"
                          >
                            Proof ({item.proof_files.length})
                          </button>
                        ) : null}
                        <Button type="button" variant="secondary" onClick={() => setOpenItem(item)}>
                          Action
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-line bg-surface px-4 py-4">
                  <p className="text-sm text-ink-muted">
                    Page {activeTab === 'in-progress' ? pageInProgress : pagePaid} of {pageCount}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        if (activeTab === 'in-progress') {
                          setPageInProgress((current) => Math.max(1, current - 1));
                        } else {
                          setPagePaid((current) => Math.max(1, current - 1));
                        }
                      }}
                      disabled={activeTab === 'in-progress' ? pageInProgress === 1 : pagePaid === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        if (activeTab === 'in-progress') {
                          setPageInProgress((current) => Math.min(pageCount, current + 1));
                        } else {
                          setPagePaid((current) => Math.min(pageCount, current + 1));
                        }
                      }}
                      disabled={activeTab === 'in-progress' ? pageInProgress === pageCount : pagePaid === pageCount}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <ItemEditModal
        open={Boolean(openItem)}
        item={openItem}
        role={userRole}
        installmentId={installmentId}
        onClose={() => setOpenItem(null)}
        onSave={(updatedItem) => {
          setInstallment((current) => {
            if (!current) return current;
            return {
              ...current,
              installment_items: current.installment_items.map((item) =>
                item.id === updatedItem.id ? { ...item, ...updatedItem } : item
              ),
            };
          });
          setOpenItem(updatedItem);
        }}
        onDelete={(itemId) => {
          setInstallment((current) => {
            if (!current) return current;
            return {
              ...current,
              installment_items: current.installment_items.filter((item) => item.id !== itemId),
            };
          });
          setOpenItem(null);
        }}
        onProofAdded={(proof) => {
          setInstallment((current) => {
            if (!current || !openItem) return current;
            return {
              ...current,
              installment_items: current.installment_items.map((item) =>
                item.id === openItem.id
                  ? { ...item, proof_files: [...(item.proof_files ?? []), proof] }
                  : item
              ),
            };
          });
          setOpenItem((current) => current ? { ...current, proof_files: [...(current.proof_files ?? []), proof] } : current);
        }}
        onProofDeleted={(proofId) => {
          setInstallment((current) => {
            if (!current) return current;
            return {
              ...current,
              installment_items: current.installment_items.map((item) => ({
                ...item,
                proof_files: item.proof_files?.filter((proof) => proof.id !== proofId) ?? [],
              })),
            };
          });
          setOpenItem((current) => current ? { ...current, proof_files: current.proof_files?.filter((proof) => proof.id !== proofId) ?? [] } : current);
          setProofItem((current) => current ? { ...current, proof_files: current.proof_files?.filter((proof) => proof.id !== proofId) ?? [] } : current);
        }}
      />
      <ProofViewerModal
        open={Boolean(proofItem)}
        item={proofItem}
        role={userRole}
        currentUserId={currentUserId}
        onClose={() => setProofItem(null)}
        onProofDeleted={(proofId) => {
          setInstallment((current) => {
            if (!current) return current;
            return {
              ...current,
              installment_items: current.installment_items.map((item) => ({
                ...item,
                proof_files: item.proof_files?.filter((proof) => proof.id !== proofId) ?? [],
              })),
            };
          });
          setProofItem((current) => current ? { ...current, proof_files: current.proof_files?.filter((proof) => proof.id !== proofId) ?? [] } : current);
          setOpenItem((current) => current ? { ...current, proof_files: current.proof_files?.filter((proof) => proof.id !== proofId) ?? [] } : current);
        }}
      />
    </main>
  );
}
