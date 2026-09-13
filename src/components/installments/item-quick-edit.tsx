"use client";

import { ReactNode, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ItemEditModal, type InstallmentItem, type ProofFile } from './item-edit-modal';

type Role = 'owner' | 'editor' | 'viewer';

interface ItemQuickEditProps {
  itemId: string;
  installmentId: string;
  children: ReactNode;
  className?: string;
  onChanged?: (item: InstallmentItem | null) => void;
}

export function ItemQuickEdit({ itemId, installmentId, children, className, onChanged }: ItemQuickEditProps) {
  const [item, setItem] = useState<InstallmentItem | null>(null);
  const [role, setRole] = useState<Role>('viewer');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadItem = async () => {
    if (loading) return;
    setLoading(true);
    const supabase = createClient();
    const sessionResult = await supabase.auth.getSession();
    const userId = sessionResult.data.session?.user?.id;
    if (!userId) {
      setLoading(false);
      return;
    }

    const [{ data: member }, { data: itemData, error }] = await Promise.all([
      supabase
        .from('installment_members')
        .select('role')
        .eq('installment_id', installmentId)
        .eq('user_id', userId)
        .single(),
      supabase
        .from('installment_items')
        .select('id, label, due_date, amount, status, proof_files(id, file_url, file_type, uploaded_at, uploaded_by, original_name, profiles(display_name, email))')
        .eq('id', itemId)
        .single(),
    ]);

    setLoading(false);
    if (error || !itemData) return;

    setRole((member?.role as Role | undefined) ?? 'viewer');
    setItem(itemData as InstallmentItem);
    setOpen(true);
  };

  const updateItem = (updatedItem: InstallmentItem | null) => {
    setItem(updatedItem);
    onChanged?.(updatedItem);
  };

  const updateProofs = (proof: ProofFile) => {
    if (!item) return;
    updateItem({ ...item, proof_files: [...(item.proof_files ?? []), proof] });
  };

  const removeProof = (proofId: string) => {
    if (!item) return;
    updateItem({ ...item, proof_files: (item.proof_files ?? []).filter((proof) => proof.id !== proofId) });
  };

  return (
    <>
      <button type="button" className={className} onClick={loadItem} disabled={loading}>
        {children}
      </button>
      <ItemEditModal
        open={open}
        item={item}
        role={role}
        installmentId={installmentId}
        onClose={() => setOpen(false)}
        onSave={(updatedItem) => updateItem(updatedItem)}
        onDelete={() => {
          updateItem(null);
          setOpen(false);
        }}
        onProofAdded={updateProofs}
        onProofDeleted={removeProof}
      />
    </>
  );
}