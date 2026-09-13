import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Supabase service role key is required for installment deletion.');
}

const serviceSupabase = createServiceClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

export async function POST(request: Request) {
  const serverSupabase = await createServerClient();
  const { data: sessionData } = await serverSupabase.auth.getSession();
  const user = sessionData.session?.user;

  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const body = await request.json();
  const installmentId = typeof body.installment_id === 'string' ? body.installment_id : '';

  if (!installmentId) {
    return NextResponse.json({ error: 'Installment ID is required.' }, { status: 400 });
  }

  const { data: installment, error: installmentError } = await serviceSupabase
    .from('installments')
    .select('id, title, created_by')
    .eq('id', installmentId)
    .maybeSingle();

  if (installmentError) {
    return NextResponse.json({ error: installmentError.message }, { status: 500 });
  }

  if (!installment) {
    return NextResponse.json({ error: 'Installment not found.' }, { status: 404 });
  }

  if (installment.created_by !== user.id) {
    return NextResponse.json({ error: 'Only the installment creator can delete it.' }, { status: 403 });
  }

  const { data: members, error: membersError } = await serviceSupabase
    .from('installment_members')
    .select('user_id')
    .eq('installment_id', installmentId);

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  const notifications = (members ?? []).map((member) => ({
    user_id: member.user_id,
    type: 'reminder' as const,
    payload: {
      installment_id: installmentId,
      title: installment.title,
      deleted: true,
    },
  }));

  if (notifications.length > 0) {
    const { error: notificationError } = await serviceSupabase.from('notifications').insert(notifications);
    if (notificationError) {
      return NextResponse.json({ error: notificationError.message }, { status: 500 });
    }
  }

  const { error: deleteError } = await serviceSupabase
    .from('installments')
    .delete()
    .eq('id', installmentId)
    .eq('created_by', user.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}