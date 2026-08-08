# SPEC-01 — Architecture & Data Model

## Overview
Defines the full Supabase schema, row-level security (RLS) strategy, storage buckets, and one shared date-math utility reused by SPEC-04/05/06. Every later spec references table/column names from this doc — don't rename things downstream without updating this file.

## Role model (important distinction)
There are two separate concepts that look similar but aren't:
- **`installments.created_by`** — the true creator. Only this person can delete the installment, regardless of anyone's role.
- **`installment_members.role`** — `owner | editor | viewer`, controls day-to-day permissions. A member can hold the `owner` role (full edit rights, can manage other members) without being the creator, and still cannot delete the installment.

This matches the original requirement: roles can be shared generously, but deletion is locked to the creator alone.

## Tables

### `profiles`
Extends `auth.users`. Created automatically via a Postgres trigger on `auth.users` insert.

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | = auth.users.id |
| email | text | |
| display_name | text | nullable, defaults to email prefix |
| avatar_url | text | Gravatar URL derived from email hash, or default asset |
| receive_invitations | boolean | default true |
| created_at | timestamptz | default now() |

### `installments`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| title | text | required |
| type | enum: `daily, weekly, monthly, yearly` | |
| start_date | date | |
| end_date | date | nullable — daily uses this, weekly/monthly/yearly derive end from count |
| total_count | int | number of items generated |
| default_amount | numeric | nullable |
| currency | text | default `'PHP'`, fixed for v1 |
| created_by | uuid, FK profiles.id | true creator, see role model above |
| created_at | timestamptz | |

### `installment_items`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| installment_id | uuid, FK installments.id | |
| sequence_index | int | ordering, 1-based |
| label | text | e.g. "Day 1", "Week 3", "August 2026", "2027" |
| due_date | date | |
| amount | numeric | |
| status | enum: `unpaid, paid` | default `unpaid` |
| paid_at | timestamptz | nullable |
| created_at, updated_at | timestamptz | |

### `installment_members`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| installment_id | uuid, FK | |
| user_id | uuid, FK profiles.id | |
| role | enum: `owner, editor, viewer` | |
| joined_at | timestamptz | |

Unique constraint on `(installment_id, user_id)`.

### `invitations`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| installment_id | uuid, FK | |
| invited_email | text | |
| invited_by | uuid, FK profiles.id | |
| role | enum: `owner, editor, viewer` | role offered |
| status | enum: `pending, accepted, rejected` | |
| created_at, responded_at | timestamptz | |

### `blocklist`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK profiles.id | the blocker |
| blocked_email | text | |
| created_at | timestamptz | |

Unique constraint on `(user_id, blocked_email)`.

### `proof_files`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| installment_item_id | uuid, FK | |
| uploaded_by | uuid, FK profiles.id | |
| file_url | text | Supabase Storage path |
| file_type | enum: `image, pdf` | |
| uploaded_at | timestamptz | |

App-level (or trigger-enforced) cap of 3 rows per `installment_item_id`.

### `notifications`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK profiles.id | recipient |
| type | enum: `invite, invite_accepted, invite_rejected, reminder` | |
| payload | jsonb | e.g. `{ installment_id, invitation_id, title }` |
| read | boolean | default false |
| created_at | timestamptz | |

## Storage buckets
- `proofs/` — path pattern `{installment_id}/{installment_item_id}/{file_id}.{ext}`
- `avatars/` — only used if we later allow custom avatar upload; v1 relies on Gravatar

## RLS strategy (summary — exact policies written during implementation)
- **installments**: SELECT if `auth.uid()` has a row in `installment_members` for that installment. INSERT: any authenticated user (creator auto-added as `owner` member via trigger). UPDATE: members with role `owner` or `editor`. DELETE: only where `created_by = auth.uid()`.
- **installment_items**: SELECT/UPDATE if member of parent installment; `viewer` role is read-only except for proof uploads (enforced at app layer, not just RLS, since the "upload proof" action doesn't touch this table). DELETE: only `owner`-role members or the creator.
- **proof_files**: INSERT allowed for any member regardless of role (owner/editor/viewer can all upload proof). DELETE: uploader themself, or `owner`-role members.
- **invitations**: SELECT if `invited_email` matches the caller's email or `invited_by = auth.uid()`. INSERT: members with role `owner` or `editor` only (viewers cannot invite others).
- **blocklist**: SELECT/INSERT/DELETE only where `user_id = auth.uid()`.
- **notifications**: SELECT/UPDATE only where `user_id = auth.uid()`.

## Shared utility: date interval math

One function, used by SPEC-04 (weekly), SPEC-05 (monthly), and SPEC-06 (yearly), so the "closest valid day" logic only exists once.

```ts
// lib/utils/dateInterval.ts
type Unit = "week" | "month" | "year";

function addIntervalClamped(
  startDate: Date,
  unit: Unit,
  count: number,
  anchorDay?: number // for month/year: desired day-of-month (1-31), ignored for week
): Date {
  // week: simple +7*count days, no clamping needed
  // month/year: move by count units, then clamp to the last valid day
  // of the resulting month if anchorDay exceeds that month's max day
  // (e.g. anchorDay=31 in a 30-day month -> use last day;
  //  anchorDay=29 in non-leap Feb -> use 28)
}
```

Used to generate: weekly auto-fill (+7 days per step), monthly fixed-due-date auto-fill (clamped per month), yearly fixed-due-date auto-fill (clamped per year, accounting for leap-year Feb 29).

## Notes / open questions to confirm during implementation
- Deleting an installment: since only the creator can delete, and members lose access immediately — decide whether to notify members on deletion (recommended: yes, via `notifications`).
- `installment_members` always includes the creator as an `owner`-role row, created automatically — don't rely on `created_by` for permission checks in the UI, only for the delete button.
