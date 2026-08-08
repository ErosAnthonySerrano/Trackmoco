# SPEC-17 — Global UI Patterns

## Overview
Cross-cutting rules referenced by nearly every other spec (SPEC-07 mentions loading/responsive briefly; this is where the actual rules live, defined once instead of repeated per feature).

## Responsive breakpoints
Standard Tailwind breakpoints, no custom scale needed:
- Mobile: < 640px
- Tablet: 640–1024px
- Desktop: > 1024px

### Key responsive behaviors
- Main page installment list (SPEC-07): grid of cards on tablet/desktop, single column on mobile
- Installment detail table (SPEC-07): full table on tablet/desktop; collapses to stacked cards (one per item) on mobile — no horizontal table scrolling
- Modals (SPEC-08, 09, 15): full-screen sheet on mobile, centered dialog on tablet/desktop
- Nav: standard top bar with bell (SPEC-16) collapses non-essential nav into a hamburger/menu on mobile if needed once the nav has more than a couple of items

## Loading states
- Skeleton placeholders (not spinners) for the installment list, the detail table, and the dashboard summary cards (SPEC-14) — matches the shape of the real content so layout doesn't jump once data arrives
- Buttons that trigger async actions (save, invite, delete, upload) show an inline spinner in the button itself and disable during the request, rather than blocking the whole page

## Empty states
Every list-like view has an explicit empty state rather than just rendering nothing:
- No installments at all → SPEC-07's "Add installment" CTA
- Completed tab with zero items → tab is disabled entirely (SPEC-07), not an empty message
- No proof files on an item → no "Proof" label rendered at all (SPEC-08), not an empty modal
- No notifications → "No notifications yet" (SPEC-16)
- No blocked emails → "You haven't blocked anyone" (SPEC-10)

## Confirmation modal weight
Not every destructive action deserves the same friction. Two tiers:

**Light confirmation** — simple "Are you sure?" dialog with Cancel/Confirm buttons:
- Deleting a single installment item (SPEC-15)
- Unblocking an email (SPEC-10)
- Rejecting an invitation (SPEC-09)

**Heavy confirmation** — type-to-confirm (must type the installment title, or the account email) before the confirm button activates:
- Deleting an entire installment (SPEC-09)
- Deleting the account (SPEC-02)

Rule of thumb applied throughout: if the action destroys data belonging to *other people* (shared installment, all its items and proof files) or is irreversible at the account level, use heavy confirmation. If it only affects the current user's own view or a single low-stakes record, light confirmation is enough.

## Error handling pattern
- Toast notifications (top-right, auto-dismiss) for transient errors (failed upload, failed save)
- Inline field errors for validation issues (e.g. "Amount must be positive") rather than toasts, so the error sits next to the field that caused it
