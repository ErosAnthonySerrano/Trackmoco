// Minimal TypeScript types that mirror the database schema from SPEC-01

export type InstallmentType = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type ItemStatus = 'unpaid' | 'paid';
export type MemberRole = 'owner' | 'editor' | 'viewer';
export type InvitationStatus = 'pending' | 'accepted' | 'rejected';
export type FileType = 'image' | 'pdf';
export type NotificationType = 'invite' | 'invite_accepted' | 'invite_rejected' | 'reminder';

export interface Profile {
  id: string;
  email: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  receive_invitations: boolean;
  created_at: string;
}

export interface Installment {
  id: string;
  title: string;
  type: InstallmentType;
  start_date: string; // ISO date
  end_date?: string | null;
  total_count: number;
  default_amount?: string | null; // numeric as string from Postgres
  currency: string;
  created_by: string;
  created_at: string;
}

export interface InstallmentItem {
  id: string;
  installment_id: string;
  sequence_index: number;
  label: string;
  due_date: string;
  amount: string;
  status: ItemStatus;
  paid_at?: string | null;
  reminded_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InstallmentMember {
  id: string;
  installment_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
}

export interface Invitation {
  id: string;
  installment_id: string;
  invited_email: string;
  invited_by: string;
  role: MemberRole;
  status: InvitationStatus;
  created_at: string;
  responded_at?: string | null;
}

export interface BlocklistItem {
  id: string;
  user_id: string;
  blocked_email: string;
  created_at: string;
}

export interface ProofFile {
  id: string;
  installment_item_id: string;
  uploaded_by: string;
  file_url: string;
  file_type: FileType;
  uploaded_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  payload?: any;
  read: boolean;
  created_at: string;
}
