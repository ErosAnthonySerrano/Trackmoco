# SPEC-18 — Installment Detail Summary & URL

## Overview
This spec captures two requested changes to the installment detail page:
- Show a summary widget for the total amount paid and the remaining amount to pay for that installment.
- Replace or shorten the full installment ID currently shown in the detail-page URL.

Implementation decisions:
- Sum paid item amounts for **Total paid** and unpaid item amounts for **Remaining to pay**.
- Place the two-card summary below the installment heading and before the item tabs.
- Use an eight-character, randomly generated short ID stored uniquely on each installment, in the route `/installment-details/[id]`.
- Permanently redirect legacy `/{uuid}` URLs to the new path, dropping legacy query parameters.

## Installment summary widget

### Requested content
Show two amounts for the installment currently open:
- **Total amount paid**
- **Remaining amount to pay**

Use the existing PHP currency convention and the project’s token-based UI patterns (SPEC-11, SPEC-17).

The existing detail-page item query already loads each item's required `amount` and `status`; the totals are calculated from those rows. When there are no items in a category, that total displays as PHP 0.00. No additional totals are included.

The widget reflects item status changes, amount edits, and item deletions immediately. An installment with no items displays PHP 0.00 for both totals; all-paid and all-unpaid installments display PHP 0.00 for the corresponding empty category.

## Installment detail URL

### Current behavior
The detail page currently uses `/{installment_id}`, where the path segment is the full installment UUID. The UUID is used to load the installment and is included in navigation links from the main installment list, all-installments page, upcoming list, notification bell, and reminder email.

### Requested change
The user requested that the full ID be removed from the visible route path or replaced with a shorter identifier. The selected route shape is `/installment-details/[id]`.

The short ID is generated from random bytes, validated and uniquely indexed in the database, and persisted for the lifetime of the installment. It is an address, not an authorization mechanism; existing authentication, membership checks, and RLS remain responsible for access control. Existing installments receive IDs when the migration is applied; new installments receive them from a database trigger.

### Route and link coverage
Keep all links to installment details consistent, including:
- Main installment list and all-installments page
- Upcoming list
- Notification actions that navigate to an installment
- Reminder email links
- Back-navigation and `returnTo` flows where they include or refer to an installment URL

Old `/{uuid}` links and bookmarks, as well as links using the previously deployed 22-character reversible encoding, permanently redirect to the new path, dropping legacy query parameters. Detail destinations from the main list, all-installments page, upcoming list, notification actions, and reminder emails use the new route. New detail links omit the previous `returnTo` and `focus` query parameters; returning from a detail page goes to the dashboard without a focus query.

## Related specifications
- SPEC-01 — Architecture & Data Model
- SPEC-07 — Main Page, Table, Tabs & Pagination
- SPEC-09 — Sharing & Permissions
- SPEC-13 — Reminders
- SPEC-14 — Dashboard / Summary View
- SPEC-15 — Item Edit & Status Modal
- SPEC-16 — Notification Bell
- SPEC-17 — Global UI Patterns
