// scripts/test-reminders.js
// Inserts seed data (idempotent), calls local cron route, and verifies notifications + reminded_at

// Use CommonJS to avoid forcing module type in package.json. Explicitly load .env.local first.
try {
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  require('dotenv').config({ path: '.env.local' });
  require('dotenv').config();
} catch (e) {
  // dotenv not installed — assume env vars are set externally
}

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const PROFILE_ID = '00000000-0000-0000-0000-000000000001';
const INSTALLMENT_ID = '00000000-0000-0000-0000-000000000002';
const ITEM_SOON_ID = '00000000-0000-0000-0000-000000000003';

async function seed() {
  // upsert profile
  await supabase.from('profiles').upsert([{
    id: PROFILE_ID,
    email: 'test+local@trackmoco.test',
    display_name: 'Local Test',
    receive_invitations: true,
  }], { onConflict: 'id' });

  // upsert installment
  await supabase.from('installments').upsert([{
    id: INSTALLMENT_ID,
    title: 'Test Installment',
    type: 'monthly',
    start_date: new Date().toISOString().slice(0,10),
    total_count: 2,
    default_amount: '1000.00',
    currency: 'PHP',
    created_by: PROFILE_ID,
  }], { onConflict: 'id' });

  // upsert items
  const dueSoon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0,10);
  const dueLater = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0,10);

  await supabase.from('installment_items').upsert([{ id: ITEM_SOON_ID, installment_id: INSTALLMENT_ID, sequence_index: 1, label: 'Month 1', due_date: dueSoon, amount: '1000.00', status: 'unpaid' }], { onConflict: 'id' });
  await supabase.from('installment_items').upsert([{ installment_id: INSTALLMENT_ID, sequence_index: 2, label: 'Month 2', due_date: dueLater, amount: '1000.00', status: 'unpaid' }], { onConflict: ['installment_id','sequence_index'] });

  // upsert member
  await supabase.from('installment_members').upsert([{
    id: '00000000-0000-0000-0000-000000000005',
    installment_id: INSTALLMENT_ID,
    user_id: PROFILE_ID,
    role: 'owner'
  }], { onConflict: ['installment_id','user_id'] });

  // cleanup old notifications for this user and installment
  await supabase.from('notifications').delete().match({ user_id: PROFILE_ID });
}

async function runCron() {
  const url = `${APP_URL}/api/cron/reminders`;
  const headers = { 'Content-Type': 'application/json' };
  if (CRON_SECRET) headers['x-cron-secret'] = CRON_SECRET;
  const res = await fetch(url, { method: 'POST', headers });
  const body = await res.text();
  console.log('Cron response status', res.status, body);
  if (!res.ok) throw new Error('Cron route failed');
}

async function verify() {
  // check notifications
  const { data: notifs, error: nErr } = await supabase.from('notifications').select('*').eq('user_id', PROFILE_ID);
  if (nErr) throw nErr;
  console.log('Notifications found:', Array.isArray(notifs) ? notifs.length : 0);

  // check reminded_at
  const { data: item, error: iErr } = await supabase.from('installment_items').select('id, reminded_at').eq('id', ITEM_SOON_ID).single();
  if (iErr) throw iErr;
  console.log('Item reminded_at:', item.reminded_at);

  if (!notifs || notifs.length === 0) throw new Error('No notifications created');
  if (!item.reminded_at) throw new Error('reminded_at not set on item');
}

async function main() {
  try {
    await seed();
    console.log('Seed complete');
    await runCron();
    // wait a moment for DB writes
    await new Promise(r => setTimeout(r, 1000));
    await verify();
    console.log('Reminders test passed');
    process.exit(0);
  } catch (e) {
    console.error('Test failed', e);
    process.exit(1);
  }
}

main();
