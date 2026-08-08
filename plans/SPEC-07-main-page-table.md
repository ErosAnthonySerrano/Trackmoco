# SPEC-07 — Main Page, Table, Tabs & Pagination

## Overview
There are two distinct tab levels in the original spec that are easy to conflate — this doc separates them clearly.

- **Level 1 (main page `/`)**: tabs across *installments* — "Ongoing" vs "Completed"
- **Level 2 (installment detail `/[id]`)**: tabs across *items within one installment* — "In Progress" vs "Paid"

## Level 1 — Main page (`/`)

### Empty state
If the user has zero installments (owned or shared), show only a centered "Add installment" button — no tabs, no table.

### With installments
Two tabs at the top:
- **Ongoing** — installments with at least one unpaid item. Shown by default.
- **Completed** — installments where every item's status is `paid`. Tab is disabled (grayed, non-clickable) if the count is zero.

Each tab label shows a count badge, e.g. "Ongoing (4)", "Completed (2)".

Below the tabs: a card or row per installment showing title, type, due-soon indicator (if any item is due within 7 days), and item count. Clicking a row opens the installment detail page.

## Level 2 — Installment detail (`/[id]`)

### Tabs
- **In Progress** (left) — items with `status = unpaid`
- **Paid** (right) — items with `status = paid`
- Default view: In Progress
- Items move tabs automatically the moment their status flips to `paid` (via the action modal in SPEC-08/09)

### Table columns
| Column | Content |
|---|---|
| Item | The generated label (Day N / Week N / Month Year / Year) |
| Due date | Formatted date |
| Status | Badge: Unpaid / Paid |
| Proof | Clickable "Proof" label — only rendered if ≥1 proof file exists for that item. Click opens the proof viewer modal (SPEC-08). No label shown if no proof uploaded yet. |
| Action | Opens the edit/upload modal — visible to all members, but fields inside are permission-gated per role (viewers see upload-proof only; editors/owners see full edit) |

### Pagination
- 6 items per page
- Standard prev/next + page number controls beneath the table
- Pagination is scoped per tab (In Progress and Paid paginate independently)

## Loading & responsiveness
- Skeleton rows while fetching (matches feature 7e's loading-state requirement)
- On mobile, the table collapses to stacked cards (one card per item) rather than a horizontally-scrolled table — standard responsive pattern, avoid horizontal scroll on small screens
