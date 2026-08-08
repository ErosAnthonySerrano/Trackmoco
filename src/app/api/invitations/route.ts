import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Supabase service role key is required for invitation routes.');
}

const serviceSupabase = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const allowedRoles = ['owner', 'editor', 'viewer'] as const;

type AllowedRole = (typeof allowedRoles)[number];

export async function POST(req: Request) {
  const body = await req.json();
  const installmentId = body.installment_id as string | undefined;
  const invitedEmail = body.invited_email?.toLowerCase() as string | undefined;
  const role = body.role as AllowedRole | undefined;

  if (!installmentId || !invitedEmail || !role || !allowedRoles.includes(role)) {
    return NextResponse.json({ error: 'Missing or invalid invite payload.' }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invitedEmail)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const serverSupabase = await createServerClient();
  const sessionResult = await serverSupabase.auth.getSession();
  const user = sessionResult.data.session?.user;

  if (!user?.id || !user.email) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const inviterId = user.id;
  const inviterEmail = user.email.toLowerCase();

  const { data: memberData } = await serviceSupabase
    .from('installment_members')
    .select('role')
    .eq('installment_id', installmentId)
    .eq('user_id', inviterId)
    .maybeSingle();

  if (!memberData || !['owner', 'editor'].includes(memberData.role)) {
    return NextResponse.json({ error: 'Only owners and editors can invite.' }, { status: 403 });
  }

  const { data: invitedProfile } = await serviceSupabase
    .from('profiles')
    .select('id, email, receive_invitations')
    .eq('email', invitedEmail)
    .maybeSingle();

  if (!invitedProfile?.id) {
    return NextResponse.json({ error: 'The recipient must have an account.' }, { status: 400 });
  }

  if (invitedProfile.email?.toLowerCase() === inviterEmail) {
    return NextResponse.json({ error: 'You cannot invite yourself.' }, { status: 400 });
  }

  const { data: existingMember } = await serviceSupabase
    .from('installment_members')
    .select('id')
    .eq('installment_id', installmentId)
    .eq('user_id', invitedProfile.id)
    .maybeSingle();

  if (existingMember?.id) {
    return NextResponse.json({ error: 'This user already has access.' }, { status: 400 });
  }

  const { data: blocked } = await serviceSupabase
    .from('blocklist')
    .select('id')
    .eq('user_id', invitedProfile.id)
    .eq('blocked_email', inviterEmail)
    .maybeSingle();

  if (blocked?.id) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (invitedProfile.receive_invitations === false) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const { data: installment, error: installmentError } = await serviceSupabase
    .from('installments')
    .select('id, title, total_count')
    .eq('id', installmentId)
    .single();

  if (installmentError || !installment?.id) {
    return NextResponse.json({ error: 'Installment not found.' }, { status: 404 });
  }

  const { data: invitation, error: invitationError } = await serviceSupabase
    .from('invitations')
    .insert([
      {
        installment_id: installmentId,
        invited_email: invitedEmail,
        invited_by: inviterId,
        role,
        status: 'pending',
      },
    ])
    .select('id')
    .single();

  if (invitationError || !invitation?.id) {
    return NextResponse.json({ error: invitationError?.message || 'Failed to create invitation.' }, { status: 500 });
  }

  const payload = {
    installment_id: installmentId,
    title: installment.title,
    item_count: installment.total_count,
    inviter_name: inviterEmail,
    inviter_email: inviterEmail,
    role,
    invitation_id: invitation.id,
  };

  const { error: notificationError } = await serviceSupabase.from('notifications').insert([
    {
      user_id: invitedProfile.id,
      type: 'invite',
      payload,
    },
  ]);

  if (notificationError) {
    return NextResponse.json({ error: 'Failed to send invitation notification.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
