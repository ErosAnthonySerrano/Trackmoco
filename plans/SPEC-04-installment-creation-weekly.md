# SPEC-04 — Installment Creation: Weekly

## Overview
User specifies a number of weeks, then sets due dates either via auto-fill (recommended default) or manual sequential entry. Uses the shared `addIntervalClamped` utility from SPEC-01 (though weekly math itself is simple +7 days, no clamping needed).

## Flow
1. **Title**, **Type = Weekly**
2. **Number of weeks** — numeric input (1–104, sane upper bound)
3. Generates N week rows (form list, not yet a table — this is the creation screen, distinct from the main table in SPEC-07): "Week 1" ... "Week N", each with an empty due-date field

### Due date entry — two modes, toggle at the top of the list

**Mode A — Auto-fill (default, recommended)**
- Single date picker: "Week 1 due date"
- Once set, system computes Week 2..N as `week1_date + 7*(n-1) days` and fills every row
- Every row remains individually editable after auto-fill — editing one row does not shift the others

**Mode B — Manual, sequential unlock**
- Toggle off auto-fill
- Only Week 1's date picker is enabled; Weeks 2..N are disabled (grayed out) until Week 1 is set
- Once Week 1 is set, Week 2 unlocks; its date picker defaults to opening on the month following Week 1's date (not necessarily +7 days — just a smart default month so the user isn't stuck clicking "next month" repeatedly), but the user can navigate freely
- Each subsequent week unlocks only after the previous week's date is set, and each one's picker defaults to the month following the previous entry
- This mode exists for cases where due dates don't follow a clean weekly cadence (e.g. paid biweekly on inconsistent days)

4. **Amount** — same pattern as Daily: one default-amount field applied to all weeks, editable individually later via SPEC-07's main table
5. **Save** — creates `installment_items` rows: `label` = "Week N", `due_date`, `amount`, `sequence_index` = N

## Validation
- Number of weeks must be ≥ 1
- All N due dates must be set before saving (whichever mode is used)
- Amount must be positive

## Edge cases
- Switching from Mode A to Mode B after auto-fill already ran: keep existing dates, just unlock manual editing (don't clear them)
- User sets Week 1 date after previously entering later weeks manually, then switches back to auto-fill: auto-fill overwrites all rows from Week 1 onward — show a confirm prompt if any manually-entered dates would be overwritten
