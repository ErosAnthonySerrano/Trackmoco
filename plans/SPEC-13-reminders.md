# SPEC-13 — Reminders

## Overview
Not in the original spec doc, but flagged during planning as high-value for an installment tracker: notify members before a due date arrives, both in-app (notification bell) and via email.

## Trigger mechanism
- A scheduled job runs once daily, checking for `installment_items` where `status = unpaid` and `due_date` is exactly N days away (default N = 3, see "Configurability" below)
- Implementation option: Vercel Cron Job hitting an internal API route (`/api/cron/reminders`), since the project is already on Vercel — simpler than standing up a separate Supabase Edge Function + pg_cron setup, and keeps the reminder logic in the same codebase as everything else

## What happens on trigger
For each matching item:
1. Create a `notifications` row (`type: reminder`) for every member of that installment
2. Send an email to each member via a transactional email provider — recommend **Resend** (generous free tier, first-class Next.js/Vercel integration, simple API)
3. Avoid duplicate reminders: track `reminded_at` on `installment_items` (add this column) so the same item doesn't trigger twice at the same N-day mark

## Email content
- Subject: "Upcoming payment due: {installment title} — {item label}"
- Body: due date, amount, a link straight to that installment
- Keep it short — this is a nudge, not a newsletter

## Configurability (v1 scope decision)
- Keep it simple for v1: a single global default of 3 days before due, no per-user or per-installment customization
- If this turns out to matter once you're using it day-to-day, a per-user "remind me N days before" setting in Account Settings (SPEC-10) would be the natural place to add it later

## Edge cases
- Item's due date changes after a reminder was already sent for the old date: reset `reminded_at` to null so a new reminder can fire relative to the new date
- Item is marked paid before the reminder job runs: skip it (the query only matches `status = unpaid`)
