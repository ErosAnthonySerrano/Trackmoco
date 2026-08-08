"use client";

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, FileText, Trash2, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui';
import { Button, Modal } from '@/components/ui';

type Role = 'owner' | 'editor' | 'viewer';

type ProfileSummary = {
  display_name: string | null;
  email: string | null;
};

export type ProofFile = {
  id: string;
  file_url: string;
  file_type: 'image' | 'pdf';
  uploaded_at: string;
  uploaded_by: string;
  original_name: string | null;
  profiles?: ProfileSummary | ProfileSummary[] | null;
};

export type InstallmentItem = {
  id: string;
  label: string;
  due_date: string;
  amount: string;
  status: 'paid' | 'unpaid';
  proof_files?: ProofFile[];
};

interface ItemEditModalProps {
  open: boolean;
  item: InstallmentItem | null;
  role: Role;
  installmentId: string;
  onClose: () => void;
  onSave: (updatedItem: InstallmentItem) => void;
  onDelete: (itemId: string) => void;
  onProofAdded: (proof: ProofFile) => void;
  onProofDeleted: (proofId: string) => void;
}

interface ProofViewerModalProps {
  open: boolean;
  item: InstallmentItem | null;
  role: Role;
  currentUserId: string | null;
  onClose: () => void;
  onProofDeleted: (proofId: string) => void;
}

const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function getUploaderName(proof: ProofFile) {
  const profile = Array.isArray(proof.profiles) ? proof.profiles[0] : proof.profiles;
  return profile?.display_name || profile?.email || 'Unknown uploader';
}

function getFileName(proof: ProofFile) {
  return proof.original_name || proof.file_url.split('/').pop() || 'Proof file';
}

function canDeleteProof(proof: ProofFile, role: Role, currentUserId: string | null) {
  return role === 'owner' || proof.uploaded_by === currentUserId;
}

function ProofGrid({
  proofs,
  role,
  currentUserId,
  onDeleted,
}: {
  proofs: ProofFile[];
  role: Role;
  currentUserId: string | null;
  onDeleted: (proofId: string) => void;
}) {
  const { toast } = useToast();
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [previewProof, setPreviewProof] = useState<ProofFile | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    const loadSignedUrls = async () => {
      const entries = await Promise.all(
        proofs.map(async (proof) => {
          const { data, error } = await supabase.storage.from('proofs').createSignedUrl(proof.file_url, 60 * 10);
          return [proof.id, error ? '' : data.signedUrl] as const;
        })
      );

      if (!cancelled) {
        setSignedUrls(Object.fromEntries(entries));
      }
    };

    if (proofs.length > 0) {
      loadSignedUrls();
    }

    return () => {
      cancelled = true;
    };
  }, [proofs]);

  const handleDeleteProof = async (proof: ProofFile) => {
    if (!canDeleteProof(proof, role, currentUserId)) return;
    if (!window.confirm('Remove this proof file?')) return;

    setDeletingId(proof.id);
    const supabase = createClient();
    const { error: storageError } = await supabase.storage.from('proofs').remove([proof.file_url]);

    if (storageError) {
      setDeletingId(null);
      toast({ title: 'Remove failed', description: storageError.message, variant: 'danger' });
      return;
    }

    const { error: deleteError } = await supabase.from('proof_files').delete().eq('id', proof.id);
    setDeletingId(null);

    if (deleteError) {
      toast({ title: 'Record remove failed', description: deleteError.message, variant: 'danger' });
      return;
    }

    onDeleted(proof.id);
    toast({ title: 'Removed', description: 'Proof file removed.', variant: 'success' });
  };

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        {proofs.map((proof) => {
          const signedUrl = signedUrls[proof.id];
          const fileName = getFileName(proof);
          return (
            <div key={proof.id} className="overflow-hidden rounded-2xl border border-line bg-bg">
              <button
                type="button"
                onClick={() => proof.file_type === 'image' ? setPreviewProof(proof) : signedUrl ? window.open(signedUrl, '_blank', 'noopener,noreferrer') : null}
                className="flex aspect-[4/3] w-full items-center justify-center bg-surface text-ink"
              >
                {proof.file_type === 'image' && signedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={signedUrl} alt={fileName} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center gap-2 text-sm font-semibold text-ink-muted">
                    <FileText className="h-8 w-8" />
                    PDF
                  </span>
                )}
              </button>
              <div className="space-y-2 p-3">
                <p className="truncate text-sm font-semibold text-ink" title={fileName}>{fileName}</p>
                <p className="text-xs text-ink-muted">
                  {getUploaderName(proof)}
                  <br />
                  {new Date(proof.uploaded_at).toLocaleDateString()}
                </p>
                <div className="flex items-center gap-2">
                  {signedUrl ? (
                    <a
                      href={signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-xl border border-line bg-surface p-2 text-ink transition hover:bg-accent-soft"
                      title="Open proof"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span className="sr-only">Open proof</span>
                    </a>
                  ) : null}
                  {canDeleteProof(proof, role, currentUserId) ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteProof(proof)}
                      disabled={deletingId === proof.id}
                      className="inline-flex rounded-xl border border-line bg-surface p-2 text-danger transition hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-60"
                      title="Remove proof"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Remove proof</span>
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={Boolean(previewProof)}
        title={previewProof ? getFileName(previewProof) : ''}
        onClose={() => setPreviewProof(null)}
      >
        {previewProof ? (
          <div className="overflow-hidden rounded-2xl border border-line bg-bg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={signedUrls[previewProof.id]} alt={getFileName(previewProof)} className="max-h-[70vh] w-full object-contain" />
          </div>
        ) : null}
      </Modal>
    </>
  );
}

export function ProofViewerModal({ open, item, role, currentUserId, onClose, onProofDeleted }: ProofViewerModalProps) {
  const proofs = item?.proof_files ?? [];

  return (
    <Modal open={open} title={item ? `${item.label} proof` : 'Proof'} onClose={onClose}>
      {proofs.length > 0 ? (
        <ProofGrid proofs={proofs} role={role} currentUserId={currentUserId} onDeleted={onProofDeleted} />
      ) : (
        <p className="text-sm text-ink-muted">No proof files uploaded yet.</p>
      )}
    </Modal>
  );
}

export function ItemEditModal({
  open,
  item,
  role,
  installmentId,
  onClose,
  onSave,
  onDelete,
  onProofAdded,
  onProofDeleted,
}: ItemEditModalProps) {
  const { toast } = useToast();
  const [draftItemId, setDraftItemId] = useState<string | null>(null);
  const [dueDateDraft, setDueDateDraft] = useState('');
  const [amountDraft, setAmountDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState<'paid' | 'unpaid'>('unpaid');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setCurrentUserId(data.session?.user.id ?? null);
    });
  }, []);

  const proofFiles = useMemo(() => item?.proof_files ?? [], [item]);
  const canEdit = role === 'owner' || role === 'editor';
  const canDelete = role === 'owner';
  const proofCount = proofFiles.length;
  const canAddProof = proofCount < 3;
  const hasDraft = Boolean(item && draftItemId === item.id);
  const dueDate = hasDraft ? dueDateDraft : item?.due_date ?? '';
  const amount = hasDraft ? amountDraft : item?.amount ?? '';
  const status = hasDraft ? statusDraft : item?.status ?? 'unpaid';

  const updateDraft = (updates: Partial<{ dueDate: string; amount: string; status: 'paid' | 'unpaid' }>) => {
    if (!item) return;
    setDraftItemId(item.id);
    setDueDateDraft(updates.dueDate ?? dueDate);
    setAmountDraft(updates.amount ?? amount);
    setStatusDraft(updates.status ?? status);
  };

  const handleClose = () => {
    setDraftItemId(null);
    onClose();
  };

  const handleSave = async () => {
    if (!item) return;
    if (!canEdit) {
      onClose();
      return;
    }

    const parsedAmount = Number(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({ title: 'Invalid amount', description: 'Amount must be a positive number.', variant: 'danger' });
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const updates: Record<string, string | number | null> = {
      due_date: dueDate,
      amount: parsedAmount,
      status,
      paid_at: status === 'paid' ? new Date().toISOString() : null,
    };

    // If the due date changed after a reminder already fired, reset reminded_at
    // so a new reminder can fire relative to the new date (SPEC-13 edge case).
    if (dueDate !== item.due_date) {
      updates.reminded_at = null;
    }

    const { error } = await supabase.from('installment_items').update(updates).eq('id', item.id);
    setSaving(false);

    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'danger' });
      return;
    }

    setDraftItemId(null);
    onSave({ ...item, due_date: dueDate, amount, status });
    toast({ title: 'Saved', description: 'Item updated successfully.', variant: 'success' });
  };

  const handleDelete = async () => {
    if (!item) return;
    if (!window.confirm('Delete this item?')) return;

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('installment_items').delete().eq('id', item.id);
    setSaving(false);

    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'danger' });
      return;
    }

    onDelete(item.id);
    handleClose();
    toast({ title: 'Deleted', description: 'Item removed.', variant: 'success' });
  };

  const handleProofUpload = async (files: FileList | null) => {
    if (!item || !files || files.length === 0) return;
    const file = files[0];

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast({ title: 'Unsupported file', description: 'Upload JPG, PNG, WEBP, or PDF only.', variant: 'danger' });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: 'File too large', description: 'Each file must be 5MB or smaller.', variant: 'danger' });
      return;
    }
    if (!canAddProof) {
      toast({ title: 'Upload limit reached', description: 'Maximum 3 proof files allowed per item.', variant: 'danger' });
      return;
    }

    const supabase = createClient();
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user?.id;
    if (!userId) {
      toast({ title: 'Sign in required', description: 'Please sign in again before uploading proof.', variant: 'danger' });
      return;
    }

    setUploading(true);
    const extension = file.name.split('.').pop()?.toLowerCase() ?? 'file';
    const storagePath = `${installmentId}/${item.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('proofs').upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      setUploading(false);
      toast({ title: 'Upload failed', description: uploadError.message, variant: 'danger' });
      return;
    }

    const fileType: ProofFile['file_type'] = file.type === 'application/pdf' ? 'pdf' : 'image';
    const { data: proof, error: insertError } = await supabase
      .from('proof_files')
      .insert([
        {
          installment_item_id: item.id,
          uploaded_by: userId,
          file_url: storagePath,
          file_type: fileType,
          original_name: file.name,
        },
      ])
      .select('id, file_url, file_type, uploaded_at, uploaded_by, original_name, profiles(display_name, email)')
      .single();

    setUploading(false);

    if (insertError || !proof) {
      await supabase.storage.from('proofs').remove([storagePath]);
      toast({ title: 'Record failed', description: insertError?.message ?? 'Unable to save proof record.', variant: 'danger' });
      return;
    }

    onProofAdded(proof as ProofFile);
    toast({ title: 'Uploaded', description: 'Proof file added successfully.', variant: 'success' });
  };

  return (
    <Modal
      open={open}
      title={item?.label ?? ''}
      description="Edit item details, upload proof, or remove the item if you own the installment."
      onClose={handleClose}
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          {canDelete ? (
            <Button type="button" variant="ghost" onClick={handleDelete} disabled={saving || uploading}>
              Delete item
            </Button>
          ) : null}
          <Button type="button" onClick={handleSave} isLoading={saving} disabled={!canEdit || uploading}>
            Save changes
          </Button>
        </div>
      }
    >
      {item ? (
        <div className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block text-sm font-medium text-ink-muted">
              Due date
              <input
                type="date"
                value={dueDate}
                onChange={(event) => updateDraft({ dueDate: event.target.value })}
                disabled={!canEdit}
                className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            <label className="block text-sm font-medium text-ink-muted">
              Amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => updateDraft({ amount: event.target.value })}
                disabled={!canEdit}
                className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-ink-muted">
            Status
            <select
              value={status}
              onChange={(event) => updateDraft({ status: event.target.value as 'paid' | 'unpaid' })}
              disabled={!canEdit}
              className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
            </select>
          </label>

          <div className="rounded-3xl border border-line bg-surface p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">Proof of payment</p>
                <p className="mt-1 text-sm text-ink-muted">Upload JPG, PNG, WEBP, or PDF files up to 5MB.</p>
              </div>
              <span className="text-sm text-ink-muted">{proofCount}/3</span>
            </div>
            <div className="space-y-4">
              {proofFiles.length > 0 ? (
                <ProofGrid proofs={proofFiles} role={role} currentUserId={currentUserId} onDeleted={onProofDeleted} />
              ) : (
                <p className="rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink-muted">No proof files uploaded yet.</p>
              )}
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-line bg-bg px-4 py-3 text-sm font-semibold text-ink transition hover:bg-accent-soft has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                <Upload className="h-4 w-4" />
                {uploading ? 'Uploading...' : canAddProof ? 'Upload proof' : 'Upload limit reached'}
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  disabled={!canAddProof || uploading}
                  onChange={(event) => {
                    handleProofUpload(event.target.files);
                    event.currentTarget.value = '';
                  }}
                  className="sr-only"
                />
              </label>
              {!canAddProof ? <p className="text-sm text-danger">Remove a proof file before uploading another.</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
