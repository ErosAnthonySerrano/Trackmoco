# SPEC-03 — Installment Creation: Daily

## Overview
The most flexible of the four types — user picks a date range, then can freely deselect individual days within it (skip days) before saving.

## Flow
1. **Title** — required text field
2. **Type** — user selects "Daily"
3. **Date range** — Start date and End date pickers
4. **Day selection list** — once both dates are set, generate every calendar day in the range as a checklist (checked = included, unchecked = skipped). Default: all days checked.
   - User can uncheck individual days (e.g. skip weekends, skip July 6 & 7) without changing the range
   - List should be scrollable, grouped by month for readability if the range spans multiple months
5. **Amount** — single "default amount" field, applied to every included day. No per-day override at creation time (amount is editable later from the main table, per SPEC-07).
6. **Save** — creates one `installment_items` row per checked day:
   - `label` = "Day N" where N is the sequence among *included* days (not calendar day number — skipped days don't break the numbering)
   - `due_date` = that calendar date
   - `amount` = default amount
   - `sequence_index` = N

## Validation
- End date must be after start date
- At least one day must remain checked to save
- Amount must be a positive number

## Edge cases
- Very long ranges (e.g. a full year of daily payments) — no hard cap in v1, but consider a soft warning above ~180 days ("This will create N items — continue?") to avoid accidental huge tables
- All days unchecked — save button disabled, inline message: "Select at least one day"
