-- 20260809_000000_enable_installment_members_rls.sql
-- Enable row level security and policies for installment_members

ALTER TABLE installment_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY installment_members_select_member ON installment_members FOR SELECT USING (
  user_id = auth.uid()
);

CREATE POLICY installment_members_insert_owner_editor ON installment_members FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM installment_members im
    WHERE im.installment_id = installment_id
      AND im.user_id = auth.uid()
      AND im.role IN ('owner','editor')
  )
);

CREATE POLICY installment_members_update_owner_editor ON installment_members FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM installment_members im
    WHERE im.installment_id = installment_members.installment_id
      AND im.user_id = auth.uid()
      AND im.role IN ('owner','editor')
  )
);

CREATE POLICY installment_members_delete_owner ON installment_members FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM installment_members im
    WHERE im.installment_id = installment_members.installment_id
      AND im.user_id = auth.uid()
      AND im.role = 'owner'
  )
);
