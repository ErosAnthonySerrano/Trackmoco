# SPEC-10 — Blocklist & Account Settings

## Overview
Settings page covering invitation preferences, blocklist management, and the account deletion entry point (full deletion flow lives in SPEC-02).

## Settings page (`/settings`)

### Invitation preference
- Toggle: "Receive installment invitations" — bound to `profiles.receive_invitations`
- When off, all incoming invitations are silently rejected server-side (see SPEC-09) — no exception for specific senders

### Blocklist
- List of currently blocked emails (`blocklist` rows for the current user), each with an "Unblock" button
- "Block a sender" — manual entry field to add an email directly (in addition to blocking reactively from an invitation modal, see below)
- Unblocking removes the row; does not retroactively restore any invitations that were silently dropped while blocked

### Blocking from within an invitation
- The invitation-response modal (SPEC-09) includes a secondary "Block this sender" action alongside Accept/Reject — clicking it rejects the invitation AND adds the sender's email to `blocklist` in one action

### Account deletion entry point
- "Delete account" button opens the confirmation flow described in SPEC-02 (type-to-confirm modal, ownership-transfer check)

## Edge cases
- Blocking an email that has no pending invitations: still succeeds, just prevents future ones
- Blocking your own email: block client-side, not meaningful
