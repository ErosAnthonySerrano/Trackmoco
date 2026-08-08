# SPEC-06 — Installment Creation: Yearly

## Overview
Same pattern as Monthly (SPEC-05), one level up — user sets how many years and a starting year, then optionally a fixed month+day that auto-fills using the shared clamping utility.

## Flow
1. **Title**, **Type = Yearly**
2. **Number of years** — numeric input
3. **Start year** — year picker. Generates N sequential year rows: "2026", "2027", ... up to N years
4. **Fixed due date (optional, recommended default: on)**
   - "Set the same due date every year" toggle
   - Month selector + day-of-month selector (1–31)
   - Auto-fills every row's `due_date` at that month/day for each generated year, using `addIntervalClamped`
     - Handles Feb 29 specifically: if the chosen day is 29 and the target year is not a leap year, clamp to Feb 28
   - Every row remains individually editable after auto-fill
   - If toggle off, user manually sets each year's due date (no sequential lock, same reasoning as Monthly)
5. **Amount** — default-amount field applied to all years, editable individually later
6. **Save** — creates `installment_items`: `label` = year as text ("2026"), `due_date`, `amount`, `sequence_index` = N

## Validation
- Number of years ≥ 1
- All N due dates must be set before saving
- Amount must be positive

## Edge cases
- Fixed date = Feb 29, spanning both leap and non-leap years in the range → each year's row is clamped independently, so 2028 (leap) gets the 29th, 2029 gets the 28th, etc.
- Toggling fixed-date on after manual edits → confirm before overwrite, same pattern as SPEC-04/05
