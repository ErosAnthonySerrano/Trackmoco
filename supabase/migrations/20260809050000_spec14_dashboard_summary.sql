-- SPEC-14 dashboard summary RPC — returns aggregate stats + upcoming list in one call.

CREATE OR REPLACE FUNCTION public.get_dashboard_summary(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_owed numeric;
  v_total_paid numeric;
  v_due_week_count int;
  v_due_week_amount numeric;
  v_overdue_count int;
  v_upcoming jsonb;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Total owed: sum of unpaid item amounts across installments the user is a member of
  SELECT COALESCE(SUM(ii.amount), 0)
  INTO v_total_owed
  FROM public.installment_members im
  JOIN public.installment_items ii ON ii.installment_id = im.installment_id
  WHERE im.user_id = p_user_id
    AND ii.status = 'unpaid';

  -- Total paid: sum of paid item amounts
  SELECT COALESCE(SUM(ii.amount), 0)
  INTO v_total_paid
  FROM public.installment_members im
  JOIN public.installment_items ii ON ii.installment_id = im.installment_id
  WHERE im.user_id = p_user_id
    AND ii.status = 'paid';

  -- Due this week: unpaid items due within the next 7 days (inclusive of today)
  SELECT COUNT(*), COALESCE(SUM(ii.amount), 0)
  INTO v_due_week_count, v_due_week_amount
  FROM public.installment_members im
  JOIN public.installment_items ii ON ii.installment_id = im.installment_id
  WHERE im.user_id = p_user_id
    AND ii.status = 'unpaid'
    AND ii.due_date >= CURRENT_DATE
    AND ii.due_date <= (CURRENT_DATE + INTERVAL '7 days')::date;

  -- Overdue: unpaid items with a due date in the past
  SELECT COUNT(*)
  INTO v_overdue_count
  FROM public.installment_members im
  JOIN public.installment_items ii ON ii.installment_id = im.installment_id
  WHERE im.user_id = p_user_id
    AND ii.status = 'unpaid'
    AND ii.due_date < CURRENT_DATE;

  -- Upcoming: the 5 soonest-due unpaid items, with installment title/label/due_date/amount
  SELECT COALESCE(jsonb_agg(u ORDER BY u.due_date ASC), '[]'::jsonb)
  INTO v_upcoming
  FROM (
    SELECT
      i.id AS installment_id,
      i.title AS installment_title,
      ii.id AS item_id,
      ii.label AS item_label,
      ii.due_date,
      ii.amount
    FROM public.installment_members im
    JOIN public.installments i ON i.id = im.installment_id
    JOIN public.installment_items ii ON ii.installment_id = i.id
    WHERE im.user_id = p_user_id
      AND ii.status = 'unpaid'
    ORDER BY ii.due_date ASC
    LIMIT 5
  ) u;

  RETURN jsonb_build_object(
    'total_owed', v_total_owed,
    'total_paid', v_total_paid,
    'due_this_week', jsonb_build_object(
      'count', v_due_week_count,
      'amount', v_due_week_amount
    ),
    'overdue_count', v_overdue_count,
    'upcoming', v_upcoming
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(uuid) TO authenticated;