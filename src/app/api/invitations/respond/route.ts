import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Supabase service role key is required for invitation response route.');
}

const serviceSupabase = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export async function POST(req: Request) {
  const body = await req.json();
  const invitationId = body.invitation_id as string | undefined;
  const action = body.action as 'accept' | 'reject' | 'block_sender' | undefined;

  if (!invitationId || !['accept', 'reject', 'block_sender'].includes(action || '')) {
    return NextResponse.json({ error: 'Invalid response action.' }, { status: 400 });
  }

  const serverSupabase = await createServerClient();
  const sessionResult = await serverSupabase.auth.getSession();
  const user = sessionResult.data.session?.user;

  if (!user?.id || !user.email) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const userEmail = user.email.toLowerCase();

  const { data: invitation, error: invitationError } = await serviceSupabase
    .from('invitations')
    .select('id, installment_id, invited_email, invited_by, role, status')
    .eq('id', invitationId)
    .single();

  if (invitationError || !invitation?.id) {
    return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 });
  }

  if (invitation.status !== 'pending') {
    return NextResponse.json({ error: 'Invitation has already been responded to.' }, { status: 400 });
  }

  if (invitation.invited_email.toLowerCase() !== userEmail) {
    return NextResponse.json({ error: 'Not authorized to respond to this invitation.' }, { status: 403 });
  }

  if (action === 'accept') {
    const { error: memberError } = await serviceSupabase.from('installment_members').upsert(
      [
        {
          installment_id: invitation.installment_id,
          user_id: user.id,
          role: invitation.role,
        },
      ],
      { onConflict: 'installment_id,user_id', ignoreDuplicates: true }
    );

    if (memberError) {
      return NextResponse.json({ error: 'Failed to add you to the installment.' }, { status: 500 });
    }
  }

  // Blocking from within an invitation rejects the invitation AND adds the
  // sender's email to the blocklist in one action (SPEC-10).
  if (action === 'block_sender') {
    const { data: inviterProfile } = await serviceSupabase
      .from('profiles')
      .select('email')
      .eq('id', invitation.invited_by)
      .maybeSingle();

    const inviterEmail = inviterProfile?.email?.toLowerCase();

    if (inviterEmail) {
      const { error: blockError } = await serviceSupabase
        .from('blocklist')
        .upsert(
          [
            {
              user_id: user.id,
              blocked_email: inviterEmail,
            },
          ],
          { onConflict: 'user_id,blocked_email', ignoreDuplicates: true }
        );

      if (blockError) {
        return NextResponse.json({ error: 'Failed to block sender.' }, { status: 500 });
      }
    }
  }

  const { error: updateError } = await serviceSupabase
    .from('invitations')
    .update({ status: action === 'accept' ? 'accepted' : 'rejected' })
    .eq('id', invitationId);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update invitation.' }, { status: 500 });
  }

  const { data: installment, error: installmentError } = await serviceSupabase
    .from('installments')
    .select('id, title')
    .eq('id', invitation.installment_id)
    .single();

  if (installmentError || !installment?.id) {
    return NextResponse.json({ error: 'Installment not found.' }, { status: 404 });
  }

  const payload = {
    installment_id: invitation.installment_id,
    title: installment.title,
    role: invitation.role,
    invitee_name: userEmail,
  };

  const { error: notificationError } = await serviceSupabase.from('notifications').insert([
    {
      user_id: invitation.invited_by,
      type: action === 'accept' ? 'invite_accepted' : 'invite_rejected',
      payload,
    },
  ]);

  if (notificationError) {
    return NextResponse.json({ error: 'Failed to notify inviter.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
