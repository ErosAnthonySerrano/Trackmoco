import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Supabase service role key is required for account deletion.');
}

const serviceSupabase = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export async function POST() {
  const serverSupabase = await createServerClient();
  const sessionResult = await serverSupabase.auth.getSession();
  const user = sessionResult.data.session?.user;

  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const userId = user.id;

  // Check if the user still owns shared installments with other active members.
  // If so, block deletion to avoid silently orphaning shared data.
  const { data: ownedShared, error: ownedError } = await serviceSupabase
    .from('installments')
    .select('id, installment_members!inner(user_id)')
    .eq('created_by', userId)
    .neq('installment_members.user_id', userId);

  if (ownedError) {
    return NextResponse.json({ error: 'Failed to check owned installments.' }, { status: 500 });
  }

  if (ownedShared && ownedShared.length > 0) {
    return NextResponse.json(
      {
        error: `You still own ${ownedShared.length} shared installment(s). Delete or transfer them first.`,
        ownedCount: ownedShared.length,
      },
      { status: 409 }
    );
  }

  // Delete the Supabase auth user — cascades to profiles via FK, and to
  // owned installments/items/proofs via the cascade rules in SPEC-01.
  const { error: deleteError } = await serviceSupabase.auth.admin.deleteUser(userId);

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to delete account.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}