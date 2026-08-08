# SPEC-14 — Dashboard / Summary View

## Overview
Also not in the original spec — flagged during planning. The main page (SPEC-07) lists installments individually, but there's no single view answering "how am I doing overall right now?" This adds that.

## Placement
Lives at the top of the main page (`/`), above the Ongoing/Completed tabs from SPEC-07 — a compact summary strip, not a separate page, so it doesn't add navigation overhead.

## Content

### Summary cards (row of 3–4 stat cards)
- **Total owed across all ongoing installments** — sum of `amount` for all `unpaid` items across every installment the user is a member of
- **Total paid so far** — sum of `amount` for all `paid` items
- **Due this week** — count + total amount of unpaid items with `due_date` within the next 7 days
- **Overdue** — count of unpaid items with `due_date` in the past (only shown if > 0, styled with the danger token from SPEC-11)

### Upcoming list
- Below the cards: a short list (max 5) of the soonest-due unpaid items across all installments, each showing installment title, item label, due date, amount — clicking one navigates straight to that installment
- "View all" link if there are more than 5 upcoming, scrolling to or filtering the main table

## Data approach
- A single aggregate query (or a Postgres view/RPC function) rather than N separate queries per installment — for a user in many shared installments this avoids a request-per-installment waterfall
- Recommend a Postgres function `get_dashboard_summary(user_id)` returning the four stats + upcoming list in one call, callable via `supabase.rpc(...)`

## Edge cases
- User has zero installments: dashboard strip doesn't render at all, falls straight through to SPEC-07's empty state
- All amounts are in PHP only (per the currency decision), so no currency-mixing concerns in the sums
