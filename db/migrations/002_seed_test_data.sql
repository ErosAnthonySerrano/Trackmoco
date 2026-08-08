-- 002_seed_test_data.sql
-- Seed data for local testing of reminders

-- Fixed UUIDs for deterministic testing
-- profile
INSERT INTO profiles (id, email, display_name, receive_invitations, created_at)
VALUES ('00000000-0000-0000-0000-000000000001','test+local@trackmoco.test','Local Test', true, now())
ON CONFLICT (id) DO NOTHING;

-- installment
INSERT INTO installments (id, title, type, start_date, end_date, total_count, default_amount, currency, created_by, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Test Installment',
  'monthly',
  CURRENT_DATE,
  NULL,
  2,
  1000.00,
  'PHP',
  '00000000-0000-0000-0000-000000000001',
  now()
)
ON CONFLICT (id) DO NOTHING;

-- installment items: one due in 3 days, one due later
INSERT INTO installment_items (id, installment_id, sequence_index, label, due_date, amount, status, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002',1,'Month 1', CURRENT_DATE + INTERVAL '3 days', 1000.00, 'unpaid', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO installment_items (id, installment_id, sequence_index, label, due_date, amount, status, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002',2,'Month 2', CURRENT_DATE + INTERVAL '10 days', 1000.00, 'unpaid', now(), now())
ON CONFLICT (id) DO NOTHING;

-- member (creator as owner)
INSERT INTO installment_members (id, installment_id, user_id, role, joined_at)
VALUES ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','owner', now())
ON CONFLICT (installment_id, user_id) DO NOTHING;
