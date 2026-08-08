# SPEC-16 — Notification Bell (UI Component)

## Overview
SPEC-09 and SPEC-13 both create `notifications` rows, but neither specs the bell component itself. This is that piece — one reusable dropdown used app-wide.

## Placement
Bell icon in the top nav, visible on every authenticated page.

## Badge
- Small count badge on the bell showing unread count (`notifications.read = false` for the current user)
- Updates live via the Supabase Realtime subscription described in SPEC-09 (no polling)
- Badge caps display at "9+" for counts above 9, no need to show exact large numbers

## Dropdown panel
- Opens on click, closes on outside click or Escape
- List sorted newest first, reasonable cap (e.g. most recent 20) with a "View all" link if there are more (view-all target: out of scope for v1, just cap the list for now)
- Each row's content depends on `notifications.type`:

| Type | Row content | Click behavior |
|---|---|---|
| `invite` | "{inviter} invited you to '{title}'" | Opens the invite-response modal from SPEC-09 |
| `invite_accepted` | "{user} accepted your invitation to '{title}'" | Navigates to that installment |
| `invite_rejected` | "{user} declined your invitation to '{title}'" | Navigates to that installment |
| `reminder` | "'{item label}' is due {date} — {title}" | Navigates to that installment |

- Opening the dropdown marks visible unread rows as `read = true` (fire-and-forget update, no per-row "mark as read" button needed for v1)
- Empty state: "No notifications yet" when the list is empty

## Edge cases
- Notification references an installment the user no longer has access to (e.g. it was deleted after the notification was created): row still displays using the `payload.title` snapshot stored on the notification, but click is disabled with a subtle "no longer available" note instead of navigating to a dead page
