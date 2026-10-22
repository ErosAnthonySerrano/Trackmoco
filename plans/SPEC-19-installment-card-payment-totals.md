# SPEC-19 — Installment Card Payment Totals

## Overview
Extend installment cards on the dashboard and the All Installments page with two quick-reference amounts:
- **Total paid** — total amount of items whose status is `paid`
- **Remaining balance** — total amount of items whose status is `unpaid`

These card-level totals are scoped to the individual installment, unlike the account-wide dashboard summary in SPEC-14.

## Placement and visual hierarchy
- Keep the installment title and repayment type at the top of each card.
- Keep the dashboard's existing paid/unpaid counts in their current count row. On the All Installments page, show separate paid and unpaid count badges in the existing count row instead of total-items and unpaid badges.
- Add a compact footer beneath the existing content, separated by a subtle top border and spacing.
- Arrange the footer as two equal-width columns: Total paid on the left and Remaining balance on the right.
- Use small muted labels and a clearly readable, currency-formatted value below each label. Use the existing success token for Total paid and the standard ink token for Remaining balance.
- Preserve existing card click behavior, spacing, and responsive grid. The footer must wrap or scale within the card rather than cause horizontal overflow.
- Keep dashboard and All Installments card footer styling consistent.

## Calculations and data
- Amount paid = sum of `installment_items.amount` where `status = paid`.
- Remaining balance = sum of `installment_items.amount` where `status = unpaid`.
- Use the PHP currency format consistent with the dashboard's existing amount display.
- Fetch each item's amount along with its status in the existing installment-list query; do not make a separate request for each card.

## Edge cases
- A category with no items displays ₱0.00.
- An installment with no items displays ₱0.00 for both amounts.
- Item status and amount are the source of truth. These cards show values from the list's loaded data and update when that list data is reloaded.
- Count paid and unpaid rows directly from item status; their sum equals the installment's item count.

## Affected surfaces
- Main dashboard (`/`) ongoing installment cards.
- All Installments (`/installments/all`) cards in each tab/filter.

The account-wide summary cards at the top of the dashboard (SPEC-14), upcoming payment rows, and installment detail summary (SPEC-18) are separate surfaces and are not changed by this spec.
