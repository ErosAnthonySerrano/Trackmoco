# SPEC-09 — Sharing & Permissions

## Overview
Owners and editors can invite other users by email, choosing a role (owner/editor/viewer). Recipients respond via a notification-bell modal. Blocked senders' invitations never reach the recipient.

## Inviting
- From an installment detail page, a member with role `owner` or `editor` clicks "Share" → enters an email + selects a role (`owner`, `editor`, or `viewer`)
- Server-side check before creating the invitation:
  1. Does the invited email belong to an existing account? (v1 requires the invitee already has a Trackmoco account — no "invite by email to sign up" flow, keeps scope smaller)
  2. Has that recipient blocked the inviter's email? If yes, silently succeed on the inviter's side (no error shown, avoids revealing the block — same privacy pattern most apps use) but do not create the invitation or notification
  3. Has the recipient turned off `receive_invitations` in their settings? If yes, same silent no-op
  4. Otherwise, create the `invitations` row (`status = pending`) and a `notifications` row for the recipient

## Responding (notification bell)
- Bell icon shows unread count (`notifications.read = false`)
- Clicking an invite notification opens a modal: installment title, type, item count, inviter's name, offered role
- **Accept** → creates `installment_members` row with the offered role, updates `invitations.status = accepted`, creates a `notifications` row for the inviter ("X accepted your invitation")
- **Reject** → updates `invitations.status = rejected`, creates a `notifications` row for the inviter ("X declined your invitation"). Inviter may send a new invitation later (new `invitations` row) — a prior rejection doesn't block re-inviting.

## Real-time updates
- Supabase Realtime subscription on `notifications` filtered to `user_id = auth.uid()` so the bell badge updates live without polling

## Deletion (recap from SPEC-01)
- Only `installments.created_by` can delete, regardless of role
- Deletion requires typing a confirmation word/phrase in a modal (e.g. the installment title) before the delete button activates
- On delete, all members lose access immediately; consider firing a `notifications` row to each removed member ("This installment was deleted")

## Edge cases
- Inviting someone already a member: block with inline validation ("Already has access")
- Inviting the installment's own creator: block, not meaningful
- Role change for an existing member (not just at invite time): out of scope for v1 unless requested — note as a possible SPEC-09b later
