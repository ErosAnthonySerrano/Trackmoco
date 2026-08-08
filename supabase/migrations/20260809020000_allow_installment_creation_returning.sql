-- Allow creators to insert installments, read the row returned by INSERT ... RETURNING,
-- and add the child installment_items rows.

DROP POLICY IF EXISTS installments_insert_authenticated ON public.installments;
DROP POLICY IF EXISTS installments_select_members ON public.installments;

CREATE POLICY installments_insert_authenticated ON public.installments FOR INSERT WITH CHECK (
  created_by = auth.uid()
);

CREATE POLICY installments_select_members ON public.installments FOR SELECT USING (
  created_by = auth.uid()
  OR public.is_installment_member(id)
);

DROP POLICY IF EXISTS items_insert_member ON public.installment_items;

CREATE POLICY items_insert_member ON public.installment_items FOR INSERT WITH CHECK (
  public.is_installment_member(installment_id)
  OR EXISTS (
    SELECT 1
    FROM public.installments i
    WHERE i.id = installment_items.installment_id
      AND i.created_by = auth.uid()
  )
);
