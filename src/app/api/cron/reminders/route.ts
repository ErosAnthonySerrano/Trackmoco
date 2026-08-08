import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const RESEND_API_KEY = process.env.RESEND_API_KEY as string;
const RESEND_FROM = process.env.RESEND_FROM || 'no-reply@trackmoco.app';
const CRON_SECRET = process.env.CRON_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // Fail fast on startup in case env is missing when deployed.
  // Note: Next.js will still build; runtime will error when route is called.
  console.warn('Supabase URL or service role key is not set. Reminders route will fail.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type ReminderItem = {
  id: string;
  installment_id: string;
  label: string;
  due_date: string;
  amount: string | number | null;
};

type MemberRow = {
  user_id: string;
  role: string;
};

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
};

type Member = {
  user_id: string;
  role: string;
  profile: ProfileRow | null;
};

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    // Resend not configured — skip sending in non-production/testing environments.
    return null;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error: ${res.status} ${body}`);
  }
  return res.json();
}

export async function POST(req: NextRequest) {
  try {
    // Optional secret check
    if (CRON_SECRET) {
      const header = req.headers.get('x-cron-secret');
      if (!header || header !== CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Find unpaid items due in exactly 3 days and not yet reminded
    const targetDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const dueDateString = targetDate.toISOString().slice(0, 10);
    const { data: items, error: itemsErr } = await supabase
      .from('installment_items')
      .select('id, installment_id, label, due_date, amount')
      .eq('status', 'unpaid')
      .is('reminded_at', null)
      .eq('due_date', dueDateString);

    if (itemsErr) throw itemsErr;
    if (!items || items.length === 0) {
      return NextResponse.json({ ok: true, processed: 0 });
    }

    let processed = 0;
    for (const item of items as ReminderItem[]) {
      // fetch installment title
      const { data: insts, error: instErr } = await supabase
        .from('installments')
        .select('id, title')
        .eq('id', item.installment_id)
        .single();
      if (instErr) throw instErr;
      const title = insts?.title ?? 'Installment';

      // fetch members for this installment
      const { data: memberRows, error: memberErr } = await supabase
        .from('installment_members')
        .select('user_id, role')
        .eq('installment_id', item.installment_id);

      if (memberErr) throw memberErr;

      const rows = (memberRows ?? []) as MemberRow[];
      const userIds = rows.map((row) => row.user_id);
      let profiles: ProfileRow[] = [];
      if (userIds.length > 0) {
        const { data: profileRows, error: profileErr } = await supabase
          .from('profiles')
          .select('id, email, display_name')
          .in('id', userIds);
        if (profileErr) throw profileErr;
        profiles = (profileRows ?? []) as ProfileRow[];
      }

      const members: Member[] = rows.map((row) => ({
        user_id: row.user_id,
        role: row.role,
        profile: profiles.find((p) => p.id === row.user_id) || null,
      }));

      // Create notifications and send emails
      let allEmailsOk = true;
      for (const member of members) {
        const userId = member.user_id;
        const profile = member.profile;
        const email = profile?.email;

        // insert notification row
        const payload = { installment_id: item.installment_id, title, item_id: item.id, label: item.label };
        const { error: notifErr } = await supabase.from('notifications').insert([{ user_id: userId, type: 'reminder', payload }]);
        if (notifErr) {
          // log and continue
          console.error('Failed to insert notification', notifErr);
        }

        if (email) {
          const subject = `Upcoming payment due: ${title} — ${item.label}`;
          const html = `<p>Hi ${profile?.display_name ?? ''},</p>
            <p>This is a reminder that <strong>${item.label}</strong> for <strong>${title}</strong> is due on <strong>${item.due_date}</strong>.<br/>Amount: ${item.amount}</p>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL || '/'}">Open Trackmoco</a></p>`;
          try {
            await sendEmail(email, subject, html);
          } catch (e) {
            allEmailsOk = false;
            console.error('Failed sending email', e instanceof Error ? e.message : e);
          }
        }
      }

      if (allEmailsOk) {
        // mark reminded_at
        const { error: uErr } = await supabase.from('installment_items').update({ reminded_at: new Date().toISOString() }).eq('id', item.id);
        if (uErr) {
          console.error('Failed to update reminded_at', uErr);
        } else {
          processed += 1;
        }
      }
    }

    return NextResponse.json({ ok: true, processed });
  } catch (err) {
    console.error('Reminders cron error', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}