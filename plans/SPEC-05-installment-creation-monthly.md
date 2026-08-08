# SPEC-05 — Installment Creation: Monthly

## Overview
User specifies a number of months and a starting month, then optionally sets one fixed day-of-month that auto-fills every due date using the shared clamping utility (SPEC-01) to handle short months and February.

## Flow
1. **Title**, **Type = Monthly**
2. **Number of months** — numeric input
3. **Start month** — month/year picker (e.g. "August 2026"). System generates N sequential month rows starting there: "August 2026", "September 2026", ... up to N months
4. **Fixed due day (optional, recommended default: on)**
   - "Set the same due day every month" toggle
   - Day-of-month selector: 1–31, plus a special option **"Last day of the month"**
   - On selection, auto-fill every row's `due_date` using `addIntervalClamped`:
     - If the chosen day exists in that month, use it directly
     - If not (e.g. 31 in a 30-day month, or 29/30/31 in February), use the closest earlier valid day in that month
     - If "Last day of the month" is chosen, always use that month's actual last day
   - Every row remains individually editable after auto-fill
   - If toggle is off, user manually sets each month's due date (no sequential lock here, unlike Weekly's Mode B — monthly rows are few enough that a lock isn't needed)
5. **Amount** — default-amount field applied to all months, editable individually later
6. **Save** — creates `installment_items`: `label` = "August 2026" style (Month Name + Year), `due_date`, `amount`, `sequence_index` = N

## Validation
- Number of months ≥ 1
- All N due dates must be set before saving
- Amount must be positive

## Edge cases
- Fixed day = 29, and one of the generated months is February in a non-leap year → clamps to 28th (per shared utility). Leap year → uses 29th correctly.
- Fixed day = 31 across months with 30 days → clamps to 30th automatically
- User toggles fixed-day auto-fill on after already manually editing some rows → confirm before overwriting, same pattern as SPEC-04
