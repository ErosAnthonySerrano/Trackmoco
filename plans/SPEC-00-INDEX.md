# Trackmoco — Spec Index

Decisions locked in before these specs were written:
- Currency: PHP only (v1)
- Auth: Supabase built-in email OTP + Google OAuth (no custom OTP flow)
- Installment types in MVP: Daily, Weekly, Monthly, Yearly (all four)
- Sharing/collaboration: included in MVP, not deferred

| Spec | Title | Depends on |
|---|---|---|
| SPEC-01 | Architecture & Data Model | — |
| SPEC-02 | Auth | SPEC-01 |
| SPEC-03 | Installment Creation — Daily | SPEC-01 |
| SPEC-04 | Installment Creation — Weekly | SPEC-01 |
| SPEC-05 | Installment Creation — Monthly | SPEC-01 |
| SPEC-06 | Installment Creation — Yearly | SPEC-01 |
| SPEC-07 | Main Page, Table, Tabs, Pagination | SPEC-01, 03–06 |
| SPEC-08 | Proof of Payment | SPEC-01 |
| SPEC-09 | Sharing & Permissions | SPEC-01, 02 |
| SPEC-10 | Blocklist & Account Settings | SPEC-09 |
| SPEC-11 | Theming | — |
| SPEC-12 | PWA / Favicon / Manifest | SPEC-11 |
| SPEC-13 | Reminders | SPEC-01 |
| SPEC-14 | Dashboard / Summary View | SPEC-01, 07 |
| SPEC-15 | Item Edit & Status Modal | SPEC-01, 07, 08 |
| SPEC-16 | Notification Bell (UI Component) | SPEC-09, 13 |
| SPEC-17 | Global UI Patterns | — (referenced by nearly everything) |

Suggested build order: 01 → 02 → 11 (tokens only, fast) → 17 (patterns, informs everything after) → 03 → 04 → 05 → 06 → 07 → 15 → 08 → 09 → 16 → 10 → 13 → 14 → 12 (PWA polish last).

## Coverage check against the original requirements doc
Every numbered item from the original Trackmoco requirements PDF maps to a spec above:
- Sign-in/Signup → SPEC-02
- Main Page (table/tabs/pagination) → SPEC-07
- Add installment (all 4 types) → SPEC-03–06
- Sharing → SPEC-09
- Account Settings → SPEC-10
- Theme → SPEC-11
- Auto profile image from email → SPEC-02
- Responsive design → SPEC-17
- Favicon/manifest → SPEC-12
- Loading states → SPEC-17
- Delete account → SPEC-02
- Proof of payment (was embedded in Main Page originally, split out) → SPEC-08
- Item-level edit/status actions (was one line in the original "Action" column) → SPEC-15
- Notification bell (was mentioned inline under Sharing) → SPEC-16
- Reminders and Dashboard summary — not in the original doc, added during planning discussion → SPEC-13, SPEC-14
