"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { format, parseISO } from 'date-fns';
import { BackButton, Button, Modal, Skeleton } from '@/components/ui';
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
  created_by: string;
  installment_items: InstallmentItem[];
};

export default function InstallmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);

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
          .select('id, title, type, created_by, installment_items(id, label, due_date, amount, status, proof_files(id, file_url, file_type, uploaded_at, uploaded_by, original_name, profiles(display_name, email)))')
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
  const returnTo = searchParams.get('returnTo') || '/';

  const handleDeleteInstallment = async () => {
    if (!installment || deleteConfirmation !== installment.title) return;

    setDeleting(true);
    const response = await fetch('/api/installments/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installment_id: installment.id }),
    });
    setDeleting(false);

    if (!response.ok) return;
    router.replace('/');
  };

  return (
    <main className="min-h-screen bg-bg px-4 py-6 text-ink sm:py-10">
      <div className="mx-auto max-w-6xl">
        <BackButton href={returnTo} label={returnTo.startsWith('/installments/all') ? 'Back to all installments' : 'Back to dashboard'} />
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Installment details</p>
            <h1 className="max-w-full break-words text-3xl font-semibold sm:text-4xl">{installment?.title ?? 'Loading...'}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {userRole !== 'viewer' ? (
              <Button type="button" variant="secondary" onClick={() => setShareOpen(true)}>
                Share
              </Button>
            ) : null}
            {installment?.created_by === currentUserId ? (
              <Button type="button" variant="ghost" className="text-danger" onClick={() => setDeleteOpen(true)}>
                Delete installment
              </Button>
            ) : null}
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
                        <div className="flex flex-wrap gap-2 border-b border-line pb-3">
              <button
                type="button"
                onClick={() => setActiveTab('in-progress')}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition ${activeTab === 'in-progress' ? 'bg-accent text-ink' : 'bg-surface text-ink border border-line hover:bg-accent-soft'}`}
              >
                In Progress ({inProgress.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('paid')}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition ${activeTab === 'paid' ? 'bg-accent text-ink' : 'bg-surface text-ink border border-line hover:bg-accent-soft'}`}
              >
                Paid ({paidItems.length})
              </button>
            </div>

            {activeItems.length === 0 ? (
              <div className="card p-10 text-center text-sm text-ink-muted">
                {activeTab === 'in-progress'
                  ? 'No unpaid items yet.'
                  : 'No paid items yet.'}
              </div>
            ) : (
              <>
                <div className="hidden sm:block card overflow-hidden">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-bg text-ink-muted">
                      <tr>
                        <th className="px-6 py-4 font-medium">Item</th>
                        <th className="px-6 py-4 font-medium">Due date</th>
                        <th className="px-6 py-4 font-medium">Status</th>
                        <th className="px-6 py-4 font-medium">Proof</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {activeItems.map((item) => (
                        <tr
                          key={item.id}
                          tabIndex={0}
                          onClick={() => setOpenItem(item)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') setOpenItem(item);
                          }}
                          className="cursor-pointer hover:bg-accent-soft transition"
                        >
                          <td className="px-6 py-4 text-ink font-medium">{item.label}</td>
                          <td className="px-6 py-4 text-ink-muted">{formatDate(item.due_date)}</td>
                                                    <td className="px-6 py-4">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${item.status === 'paid' ? 'bg-success/10 text-success' : 'bg-line text-ink-muted'}`}>
                              {item.status === 'paid' ? 'Paid' : 'Unpaid'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {item.proof_files && item.proof_files.length > 0 ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setProofItem(item);
                                }}
                                className="text-accent font-medium hover:underline"
                              >
                                {item.proof_files.length} file{item.proof_files.length > 1 ? 's' : ''}
                              </button>
                            ) : (
                              <span className="text-ink-muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-4 sm:hidden">
                  {activeItems.map((item) => (
                    <div
                      key={item.id}
                      className="card cursor-pointer p-5"
                      role="button"
                      tabIndex={0}
                      onClick={() => setOpenItem(item)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') setOpenItem(item);
                      }}
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{item.label}</p>
                          <p className="mt-1 text-sm text-ink-muted">Due {formatDate(item.due_date)}</p>
                        </div>
                                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${item.status === 'paid' ? 'bg-success/10 text-success' : 'bg-line text-ink-muted'}`}>
                          {item.status === 'paid' ? 'Paid' : 'Unpaid'}
                        </span>
                      </div>
                      <div className="flex flex-col gap-3">
                        {item.proof_files && item.proof_files.length > 0 ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setProofItem(item);
                            }}
                            className="rounded-xl bg-accent-soft p-3 text-sm font-semibold text-accent text-center"
                          >
                            View Proof ({item.proof_files.length})
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 card px-6 py-4">
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
                    {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => {
                      const activePage = activeTab === 'in-progress' ? pageInProgress : pagePaid;
                      return (
                        <Button
                          key={page}
                          type="button"
                          variant={page === activePage ? 'primary' : 'ghost'}
                          onClick={() => activeTab === 'in-progress' ? setPageInProgress(page) : setPagePaid(page)}
                        >
                          {page}
                        </Button>
                      );
                    })}
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
      <Modal
        open={deleteOpen}
        title="Delete installment"
        description="This permanently deletes the installment, its items, and proof files for everyone. Type the installment title to confirm."
        onClose={() => {
          if (!deleting) {
            setDeleteOpen(false);
            setDeleteConfirmation('');
          }
        }}
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" disabled={deleting} onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="border border-danger/30 text-danger"
              isLoading={deleting}
              disabled={deleteConfirmation !== installment?.title}
              onClick={handleDeleteInstallment}
            >
              Delete permanently
            </Button>
          </div>
        }
      >
        <label className="block text-sm font-medium text-ink-muted">
          Type <span className="font-semibold text-ink">{installment?.title}</span> to confirm
          <input
            type="text"
            value={deleteConfirmation}
            onChange={(event) => setDeleteConfirmation(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
            autoFocus
          />
        </label>
      </Modal>
    </main>
  );
}

