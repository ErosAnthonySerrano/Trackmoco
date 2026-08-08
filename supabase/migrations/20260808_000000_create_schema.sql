-- 20260808_000000_create_schema.sql
-- Supabase migration for Trackmoco (SPEC-01) — digits-only timestamp for CLI
-- Generated from db/migrations/001_create_schema.sql

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum types
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'installment_type') THEN
        CREATE TYPE installment_type AS ENUM ('daily','weekly','monthly','yearly');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_status') THEN
        CREATE TYPE item_status AS ENUM ('unpaid','paid');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'member_role') THEN
        CREATE TYPE member_role AS ENUM ('owner','editor','viewer');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invitation_status') THEN
        CREATE TYPE invitation_status AS ENUM ('pending','accepted','rejected');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'file_type') THEN
        CREATE TYPE file_type AS ENUM ('image','pdf');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        CREATE TYPE notification_type AS ENUM ('invite','invite_accepted','invite_rejected','reminder');
    END IF;
END$$;

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY,
  email text,
  display_name text,
  avatar_url text,
  receive_invitations boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Installments
CREATE TABLE IF NOT EXISTS installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type installment_type NOT NULL,
  start_date date NOT NULL,
  end_date date,
  total_count int NOT NULL,
  default_amount numeric,
  currency text NOT NULL DEFAULT 'PHP',
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Installment items
CREATE TABLE IF NOT EXISTS installment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id uuid NOT NULL REFERENCES installments(id) ON DELETE CASCADE,
  sequence_index int NOT NULL,
  label text NOT NULL,
  due_date date NOT NULL,
  amount numeric NOT NULL,
  status item_status NOT NULL DEFAULT 'unpaid',
  paid_at timestamptz,
  reminded_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Installment members
CREATE TABLE IF NOT EXISTS installment_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id uuid NOT NULL REFERENCES installments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role member_role NOT NULL,
  joined_at timestamptz DEFAULT now(),
  CONSTRAINT unique_member UNIQUE (installment_id, user_id)
);

-- Invitations
CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id uuid NOT NULL REFERENCES installments(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  invited_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role member_role NOT NULL,
  status invitation_status NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  responded_at timestamptz
);

-- Blocklist
CREATE TABLE IF NOT EXISTS blocklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_email text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_block UNIQUE (user_id, blocked_email)
);

-- Proof files
CREATE TABLE IF NOT EXISTS proof_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_item_id uuid NOT NULL REFERENCES installment_items(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_type file_type NOT NULL,
  uploaded_at timestamptz DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  payload jsonb,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Trigger: when an installment is created, add the creator as an owner member
CREATE OR REPLACE FUNCTION add_creator_as_member() RETURNS trigger AS $$
BEGIN
  INSERT INTO installment_members (id, installment_id, user_id, role, joined_at)
  VALUES (gen_random_uuid(), NEW.id, NEW.created_by, 'owner', now())
  ON CONFLICT (installment_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_add_creator_member ON installments;
CREATE TRIGGER trg_add_creator_member
  AFTER INSERT ON installments
  FOR EACH ROW EXECUTE PROCEDURE add_creator_as_member();

-- Row level security policies

ALTER TABLE installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY installments_select_members ON installments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM installment_members im WHERE im.installment_id = installments.id AND im.user_id = auth.uid()
  )
);
CREATE POLICY installments_insert_authenticated ON installments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY installments_update_owner_editor ON installments FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM installment_members im WHERE im.installment_id = installments.id AND im.user_id = auth.uid() AND im.role IN ('owner','editor')
  )
);
CREATE POLICY installments_delete_creator ON installments FOR DELETE USING (created_by = auth.uid());

ALTER TABLE installment_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY items_select_member ON installment_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM installment_members im WHERE im.installment_id = installment_items.installment_id AND im.user_id = auth.uid()
  )
);
CREATE POLICY items_update_member ON installment_items FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM installment_members im WHERE im.installment_id = installment_items.installment_id AND im.user_id = auth.uid()
  )
);
CREATE POLICY items_delete_owner_or_creator ON installment_items FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM installment_members im WHERE im.installment_id = installment_items.installment_id AND im.user_id = auth.uid() AND im.role = 'owner'
  )
  OR EXISTS (
    SELECT 1 FROM installments i WHERE i.id = installment_items.installment_id AND i.created_by = auth.uid()
  )
);

ALTER TABLE installment_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY installment_members_select_member ON installment_members FOR SELECT USING (
  user_id = auth.uid()
);
CREATE POLICY installment_members_insert_invited_or_admin ON installment_members FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM installment_members im WHERE im.installment_id = NEW.installment_id AND im.user_id = auth.uid() AND im.role IN ('owner','editor')
  )
  OR (
    NEW.user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM invitations i
      WHERE i.installment_id = NEW.installment_id
        AND i.invited_email = (SELECT email FROM profiles WHERE id = auth.uid())
        AND i.status = 'accepted'
    )
  )
);
CREATE POLICY installment_members_update_admin ON installment_members FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM installment_members im WHERE im.installment_id = installment_members.installment_id AND im.user_id = auth.uid() AND im.role IN ('owner','editor')
  )
);
CREATE POLICY installment_members_delete_owner ON installment_members FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM installment_members im WHERE im.installment_id = installment_members.installment_id AND im.user_id = auth.uid() AND im.role = 'owner'
  )
);

ALTER TABLE proof_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY proof_files_insert_member ON proof_files FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM installment_members im
    WHERE im.installment_id = (
      SELECT installment_id FROM installment_items WHERE id = installment_item_id
    )
    AND im.user_id = auth.uid()
  )
);
CREATE POLICY proof_files_select_member ON proof_files FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM installment_members im
    WHERE im.installment_id = (
      SELECT installment_id FROM installment_items WHERE id = proof_files.installment_item_id
    )
    AND im.user_id = auth.uid()
  )
);
CREATE POLICY proof_files_delete_uploader_owner ON proof_files FOR DELETE USING (
  uploaded_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM installment_members im
    WHERE im.installment_id = (
      SELECT installment_id FROM installment_items WHERE id = proof_files.installment_item_id
    )
    AND im.user_id = auth.uid() AND im.role = 'owner'
  )
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY invitations_select ON invitations FOR SELECT USING (
  invited_by = auth.uid()
  OR invited_email = (SELECT email FROM profiles WHERE id = auth.uid())
);
CREATE POLICY invitations_insert_owner_editor ON invitations FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM installment_members im WHERE im.installment_id = installment_id AND im.user_id = auth.uid() AND im.role IN ('owner','editor')
  )
);

ALTER TABLE blocklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY blocklist_owner_only ON blocklist FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_owner_only ON notifications FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select_public ON profiles FOR SELECT USING (true);
CREATE POLICY profiles_update_own ON profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- End of migration
