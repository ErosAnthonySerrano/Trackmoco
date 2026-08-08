-- Fix recursive installment_members RLS policies.

CREATE OR REPLACE FUNCTION public.is_installment_member(
  p_installment_id uuid,
  p_user_id uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.installment_members im
    WHERE im.installment_id = p_installment_id
      AND im.user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_installment_role(
  p_installment_id uuid,
  p_roles member_role[],
  p_user_id uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.installment_members im
    WHERE im.installment_id = p_installment_id
      AND im.user_id = p_user_id
      AND im.role = ANY (p_roles)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_installment_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_installment_role(uuid, member_role[], uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_creator_as_member() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.installment_members (id, installment_id, user_id, role, joined_at)
  VALUES (gen_random_uuid(), NEW.id, NEW.created_by, 'owner', now())
  ON CONFLICT (installment_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS installments_select_members ON public.installments;
DROP POLICY IF EXISTS installments_update_owner_editor ON public.installments;

CREATE POLICY installments_select_members ON public.installments FOR SELECT USING (
  public.is_installment_member(id)
);

CREATE POLICY installments_update_owner_editor ON public.installments FOR UPDATE USING (
  public.has_installment_role(id, ARRAY['owner','editor']::member_role[])
);

DROP POLICY IF EXISTS items_select_member ON public.installment_items;
DROP POLICY IF EXISTS items_update_member ON public.installment_items;
DROP POLICY IF EXISTS items_delete_owner_or_creator ON public.installment_items;

CREATE POLICY items_select_member ON public.installment_items FOR SELECT USING (
  public.is_installment_member(installment_id)
);

CREATE POLICY items_update_member ON public.installment_items FOR UPDATE USING (
  public.is_installment_member(installment_id)
);

CREATE POLICY items_delete_owner_or_creator ON public.installment_items FOR DELETE USING (
  public.has_installment_role(installment_id, ARRAY['owner']::member_role[])
  OR EXISTS (
    SELECT 1
    FROM public.installments i
    WHERE i.id = installment_items.installment_id
      AND i.created_by = auth.uid()
  )
);

ALTER TABLE public.installment_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS installment_members_select_member ON public.installment_members;
DROP POLICY IF EXISTS installment_members_insert_owner_editor ON public.installment_members;
DROP POLICY IF EXISTS installment_members_insert_invited_or_admin ON public.installment_members;
DROP POLICY IF EXISTS installment_members_update_owner_editor ON public.installment_members;
DROP POLICY IF EXISTS installment_members_update_admin ON public.installment_members;
DROP POLICY IF EXISTS installment_members_delete_owner ON public.installment_members;

CREATE POLICY installment_members_select_member ON public.installment_members FOR SELECT USING (
  public.is_installment_member(installment_id)
);

CREATE POLICY installment_members_insert_invited_or_admin ON public.installment_members FOR INSERT WITH CHECK (
  public.has_installment_role(installment_id, ARRAY['owner','editor']::member_role[])
  OR (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.invitations i
      WHERE i.installment_id = installment_members.installment_id
        AND i.invited_email = (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid())
        AND i.status = 'accepted'
    )
  )
);

CREATE POLICY installment_members_update_admin ON public.installment_members FOR UPDATE USING (
  public.has_installment_role(installment_id, ARRAY['owner','editor']::member_role[])
) WITH CHECK (
  public.has_installment_role(installment_id, ARRAY['owner','editor']::member_role[])
);

CREATE POLICY installment_members_delete_owner ON public.installment_members FOR DELETE USING (
  public.has_installment_role(installment_id, ARRAY['owner']::member_role[])
);

DROP POLICY IF EXISTS proof_files_insert_member ON public.proof_files;
DROP POLICY IF EXISTS proof_files_select_member ON public.proof_files;
DROP POLICY IF EXISTS proof_files_delete_uploader_owner ON public.proof_files;

CREATE POLICY proof_files_insert_member ON public.proof_files FOR INSERT WITH CHECK (
  public.is_installment_member((
    SELECT ii.installment_id
    FROM public.installment_items ii
    WHERE ii.id = proof_files.installment_item_id
  ))
);

CREATE POLICY proof_files_select_member ON public.proof_files FOR SELECT USING (
  public.is_installment_member((
    SELECT ii.installment_id
    FROM public.installment_items ii
    WHERE ii.id = proof_files.installment_item_id
  ))
);

CREATE POLICY proof_files_delete_uploader_owner ON public.proof_files FOR DELETE USING (
  uploaded_by = auth.uid()
  OR public.has_installment_role((
    SELECT ii.installment_id
    FROM public.installment_items ii
    WHERE ii.id = proof_files.installment_item_id
  ), ARRAY['owner']::member_role[])
);

DROP POLICY IF EXISTS invitations_insert_owner_editor ON public.invitations;

CREATE POLICY invitations_insert_owner_editor ON public.invitations FOR INSERT WITH CHECK (
  public.has_installment_role(installment_id, ARRAY['owner','editor']::member_role[])
);
