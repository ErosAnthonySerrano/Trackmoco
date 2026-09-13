import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'no-reply@trackmoco.app';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Supabase service role key is required for invitation routes.');
}

const serviceSupabase = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const allowedRoles = ['owner', 'editor', 'viewer'] as const;
const REINVITE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

type AllowedRole = (typeof allowedRoles)[number];

type EmailResult = { sent: boolean; reason?: 'missing_configuration' | 'sender_restricted' | 'provider_rejected' };

async function sendInvitationEmail(to: string, title: string, inviterName: string, role: AllowedRole): Promise<EmailResult> {
  if (!RESEND_API_KEY) return { sent: false, reason: 'missing_configuration' };

  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/login`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to,
      subject: `${inviterName} invited you to Trackmoco`,
      html: `<p>Hi,</p>
        <p><strong>${inviterName}</strong> invited you to access the installment <strong>${title}</strong> on Trackmoco as a <strong>${role}</strong>.</p>
        <p>Create or log in to your Trackmoco account using this email address, then open the notification bell to accept the invitation.</p>
        <p><a href="${loginUrl}">Log in to Trackmoco</a></p>`,
    }),
  });

  if (!response.ok) {
    const providerBody = await response.text();
    console.error('Invitation email rejected by Resend', response.status, providerBody);
    return {
      sent: false,
      reason: RESEND_FROM === 'onboarding@resend.dev' ? 'sender_restricted' : 'provider_rejected',
    };
  }

  return { sent: true };
}

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

  if (invitedProfile?.email?.toLowerCase() === inviterEmail || invitedEmail === inviterEmail) {
    return NextResponse.json({ error: 'You cannot invite yourself.' }, { status: 400 });
  }

  if (invitedProfile?.id) {
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

    if (blocked?.id || invitedProfile.receive_invitations === false) {
      return NextResponse.json({ ok: true, ignored: true });
    }
  }

  const { data: previousInvitations, error: previousInvitationsError } = await serviceSupabase
    .from('invitations')
    .select('status, created_at')
    .eq('installment_id', installmentId)
    .eq('invited_by', inviterId)
    .ilike('invited_email', invitedEmail)
    .in('status', ['pending', 'rejected'])
    .order('created_at', { ascending: false })
    .limit(1);

  if (previousInvitationsError) {
    return NextResponse.json({ error: 'Failed to check previous invitations.' }, { status: 500 });
  }

  const previousInvitation = previousInvitations?.[0];
  if (previousInvitation?.status === 'pending') {
    return NextResponse.json(
      { error: 'An invitation is already pending for this email address.' },
      { status: 409 }
    );
  }

  if (previousInvitation?.status === 'rejected') {
    const elapsed = Date.now() - new Date(previousInvitation.created_at).getTime();
    if (elapsed < REINVITE_COOLDOWN_MS) {
      const retryAfterHours = Math.ceil((REINVITE_COOLDOWN_MS - elapsed) / (60 * 60 * 1000));
      return NextResponse.json(
        { error: `Please wait ${retryAfterHours} hour${retryAfterHours === 1 ? '' : 's'} before sending another invitation to this email.` },
        { status: 429 }
      );
    }
  }

  const { data: installment, error: installmentError } = await serviceSupabase
    .from('installments')
    .select('id, title, type, total_count')
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
    type: installment.type,
    item_count: installment.total_count,
    inviter_name: user.user_metadata?.full_name || user.user_metadata?.name || inviterEmail,
    inviter_email: inviterEmail,
    role,
    invitation_id: invitation.id,
  };

  if (invitedProfile?.id) {
    const { error: notificationError } = await serviceSupabase.from('notifications').insert([
      { user_id: invitedProfile.id, type: 'invite', payload },
    ]);

    if (notificationError) {
      return NextResponse.json({ error: 'Failed to send invitation notification.' }, { status: 500 });
    }
  }

  const emailResult = await sendInvitationEmail(
    invitedEmail,
    installment.title,
    payload.inviter_name,
    role
  );

  return NextResponse.json({
    ok: true,
    invitationId: invitation.id,
    emailSent: emailResult.sent,
    emailError: emailResult.reason,
    requiresLogin: !invitedProfile?.id,
  });
}
