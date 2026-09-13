-- Security hardening for SECURITY DEFINER functions.
-- Trigger functions and internal RLS helpers must not be callable anonymously.

-- Remove the default PUBLIC/anon execution privilege from every flagged function.
REVOKE ALL ON FUNCTION public.add_creator_as_member() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_installment_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_installment_role(uuid, member_role[], uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_dashboard_summary(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.is_installment_member(
	p_installment_id uuid,
	p_user_id uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
	SELECT p_user_id = auth.uid()
		AND EXISTS (
			SELECT 1
			FROM public.installment_members im
			WHERE im.installment_id = p_installment_id
				AND im.user_id = auth.uid()
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
	SELECT p_user_id = auth.uid()
		AND EXISTS (
			SELECT 1
			FROM public.installment_members im
			WHERE im.installment_id = p_installment_id
				AND im.user_id = auth.uid()
				AND im.role = ANY (p_roles)
		);
$$;

-- These functions are invoked only by database triggers, never by the API.
REVOKE ALL ON FUNCTION public.add_creator_as_member() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM anon, authenticated;

-- RLS policies invoke these helpers while evaluating authenticated queries.
-- They remain authenticated-only and cannot be called by anonymous clients.
GRANT EXECUTE ON FUNCTION public.is_installment_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_installment_role(uuid, member_role[], uuid) TO authenticated;

-- The dashboard calls this RPC directly after verifying the requested user id
-- matches auth.uid() inside the function.
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(uuid) TO authenticated;
