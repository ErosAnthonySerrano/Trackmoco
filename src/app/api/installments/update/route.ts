import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { addIntervalClamped } from '@/lib/utils/dateInterval';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Supabase service role key is required for installment updates.');
}

const serviceSupabase = createServiceClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const scheduleTypes = ['daily', 'weekly', 'monthly', 'yearly'] as const;
type ScheduleType = (typeof scheduleTypes)[number];

type UpdateBody = {
  installment_id?: unknown;
  title?: unknown;
  total_amount?: unknown;
  schedule_type?: unknown;
  schedule_start?: unknown;
  schedule_end?: unknown;
  schedule_count?: unknown;
  due_day?: unknown;
};

type UnpaidItem = {
  id: string;
  sequence_index: number;
  label?: string;
  due_date: string;
  amount: string | number;
  status: 'paid' | 'unpaid';
};

function getScheduleDate(start: Date, type: ScheduleType, index: number, dueDay: number) {
  if (type === 'daily') return format(addDays(start, index), 'yyyy-MM-dd');
  if (type === 'weekly') return format(addIntervalClamped(start, 'week', index), 'yyyy-MM-dd');
  if (type === 'monthly') return format(addIntervalClamped(start, 'month', index, dueDay), 'yyyy-MM-dd');
  return format(addIntervalClamped(start, 'year', index, dueDay), 'yyyy-MM-dd');
}

function getScheduleLabel(type: ScheduleType, date: string, sequenceIndex: number) {
  if (type === 'daily') return `Day ${sequenceIndex}`;
  if (type === 'weekly') return `Week ${sequenceIndex}`;
  if (type === 'monthly') return format(parseISO(date), 'MMMM yyyy');
  return format(parseISO(date), 'yyyy');
}

export async function POST(request: Request) {
  const serverSupabase = await createServerClient();
  const { data: sessionData } = await serverSupabase.auth.getSession();
  const user = sessionData.session?.user;

  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: UpdateBody;
  try {
    body = await request.json() as UpdateBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const installmentId = typeof body.installment_id === 'string' ? body.installment_id : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const totalAmount = typeof body.total_amount === 'number' ? body.total_amount : Number(body.total_amount);
  const scheduleType = body.schedule_type as ScheduleType;
  const scheduleStart = typeof body.schedule_start === 'string' ? body.schedule_start : '';
  const scheduleEnd = typeof body.schedule_end === 'string' ? body.schedule_end : '';
  const scheduleCount = typeof body.schedule_count === 'number' ? body.schedule_count : Number(body.schedule_count);
  const dueDay = typeof body.due_day === 'number' ? body.due_day : Number(body.due_day);

  if (!installmentId || !title) {
    return NextResponse.json({ error: 'Installment ID and name are required.' }, { status: 400 });
  }
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return NextResponse.json({ error: 'Amount must be a positive number.' }, { status: 400 });
  }
  if (!scheduleTypes.includes(scheduleType) || Number.isNaN(Date.parse(scheduleStart))) {
    return NextResponse.json({ error: 'Schedule settings are invalid.' }, { status: 400 });
  }
  if (scheduleType === 'monthly' && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 32)) {
    return NextResponse.json({ error: 'Monthly due day must be between 1 and 31, or last day of month.' }, { status: 400 });
  }
  if (scheduleType === 'yearly' && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) {
    return NextResponse.json({ error: 'Yearly due day must be between 1 and 31.' }, { status: 400 });
  }
  if (scheduleType === 'daily' && (!scheduleEnd || Number.isNaN(Date.parse(scheduleEnd)) || scheduleEnd < scheduleStart)) {
    return NextResponse.json({ error: 'Daily ending date must be on or after the starting date.' }, { status: 400 });
  }
  if (scheduleType === 'weekly' && (!Number.isInteger(scheduleCount) || scheduleCount < 1 || scheduleCount > 500)) {
    return NextResponse.json({ error: 'Number of weeks must be between 1 and 500.' }, { status: 400 });
  }

  const { data: member, error: memberError } = await serviceSupabase
    .from('installment_members')
    .select('role')
    .eq('installment_id', installmentId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }
  if (!member || !['owner', 'editor'].includes(member.role)) {
    return NextResponse.json({ error: 'Only owners and editors can edit an installment.' }, { status: 403 });
  }

  const { data: installment, error: installmentError } = await serviceSupabase
    .from('installments')
    .select('id, title, default_amount, type')
    .eq('id', installmentId)
    .maybeSingle();

  if (installmentError) {
    return NextResponse.json({ error: installmentError.message }, { status: 500 });
  }
  if (!installment) {
    return NextResponse.json({ error: 'Installment not found.' }, { status: 404 });
  }

  const { data: unpaidItems, error: itemsError } = await serviceSupabase
    .from('installment_items')
    .select('id, sequence_index, due_date, amount, status')
    .eq('installment_id', installmentId)
    .order('sequence_index', { ascending: true });

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  const allItems = (unpaidItems ?? []) as UnpaidItem[];
  const unpaidRows = allItems.filter((item) => item.status === 'unpaid');
  const targetCount = scheduleType === 'daily'
    ? differenceInCalendarDays(parseISO(scheduleEnd), parseISO(scheduleStart)) + 1
    : scheduleType === 'weekly' || scheduleType === 'monthly' || scheduleType === 'yearly'
      ? scheduleCount
      : unpaidRows.length;
  const paidCount = allItems.filter((item) => item.status === 'paid').length;
  const totalCents = Math.round(totalAmount * 100);
  const baseCents = targetCount > 0 ? Math.floor(totalCents / targetCount) : 0;
  const remainderCents = targetCount > 0 ? totalCents % targetCount : 0;
  const unpaidAmounts = Array.from({ length: targetCount }, (_, index) => (
    (baseCents + (index < remainderCents ? 1 : 0)) / 100
  ));
  const calculatedDefaultAmount = unpaidAmounts[0] ?? totalAmount;
  const { error: updateInstallmentError } = await serviceSupabase
    .from('installments')
    .update({
      title,
      type: scheduleType,
      start_date: scheduleStart,
      end_date: scheduleType === 'daily' ? scheduleEnd : null,
      total_count: paidCount + targetCount,
      default_amount: calculatedDefaultAmount,
    })
    .eq('id', installmentId);

  if (updateInstallmentError) {
    return NextResponse.json({ error: updateInstallmentError.message }, { status: 500 });
  }

  if (targetCount < unpaidRows.length) {
    const itemsToDelete = unpaidRows.slice(targetCount).map((item) => item.id);
    const { error: deleteError } = await serviceSupabase
      .from('installment_items')
      .delete()
      .in('id', itemsToDelete);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
  }

  const updatedItems: UnpaidItem[] = [];
  const start = parseISO(scheduleStart);
  const itemsToUpdate = unpaidRows.slice(0, targetCount);
  for (const [unpaidIndex, item] of itemsToUpdate.entries()) {
    const dueDate = getScheduleDate(start, scheduleType, unpaidIndex, dueDay);
    const update = {
      amount: unpaidAmounts[unpaidIndex],
      due_date: dueDate,
      label: getScheduleLabel(scheduleType, dueDate, item.sequence_index),
      ...(dueDate !== item.due_date ? { reminded_at: null } : {}),
    };
    const { data: updatedItem, error: updateItemError } = await serviceSupabase
      .from('installment_items')
      .update(update)
      .eq('id', item.id)
      .eq('status', 'unpaid')
      .select('id, sequence_index, label, due_date, amount, status')
      .single();

    if (updateItemError || !updatedItem) {
      return NextResponse.json({ error: updateItemError?.message || 'Unable to update payment items.' }, { status: 500 });
    }
    updatedItems.push(updatedItem as UnpaidItem);
  }

  if (targetCount > unpaidRows.length) {
    const highestSequence = Math.max(0, ...allItems.map((item) => item.sequence_index));
    const newRows = Array.from({ length: targetCount - unpaidRows.length }, (_, index) => {
      const unpaidIndex = unpaidRows.length + index;
      const sequenceIndex = highestSequence + index + 1;
      const dueDate = getScheduleDate(start, scheduleType, unpaidIndex, dueDay);
      return {
        installment_id: installmentId,
        sequence_index: sequenceIndex,
        label: getScheduleLabel(scheduleType, dueDate, sequenceIndex),
        due_date: dueDate,
        amount: unpaidAmounts[unpaidIndex],
        status: 'unpaid' as const,
      };
    });
    const { data: insertedItems, error: insertError } = await serviceSupabase
      .from('installment_items')
      .insert(newRows)
      .select('id, sequence_index, label, due_date, amount, status');
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    updatedItems.push(...(insertedItems ?? []) as UnpaidItem[]);
  }

  return NextResponse.json({
    ok: true,
    installment: { title, type: scheduleType, default_amount: calculatedDefaultAmount },
    items: updatedItems,
  });
}
