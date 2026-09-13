-- Complete SPEC-01 permission boundaries.

DROP POLICY IF EXISTS items_update_member ON public.installment_items;
CREATE POLICY items_update_owner_editor ON public.installment_items FOR UPDATE USING (
  public.has_installment_role(installment_id, ARRAY['owner', 'editor']::member_role[])
) WITH CHECK (
  public.has_installment_role(installment_id, ARRAY['owner', 'editor']::member_role[])
);

DROP POLICY IF EXISTS installment_members_select_member ON public.installment_members;
CREATE POLICY installment_members_select_member ON public.installment_members FOR SELECT USING (
  public.is_installment_member(installment_id)
);