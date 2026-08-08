# SPEC-15 — Item Edit & Status Modal

## Overview
This is the "Action" modal referenced from SPEC-07's table and SPEC-08's proof upload — this doc is where its full field-by-field behavior and permission gating actually live.

## Trigger
Clicking "Action" on any row in the installment detail table (SPEC-07) opens this modal for that specific `installment_item`.

## Fields and permission gating

| Field | Viewer | Editor | Owner (role) |
|---|---|---|---|
| Due date | read-only | editable | editable |
| Amount | read-only | editable | editable |
| Status (Unpaid/Paid toggle) | read-only | editable | editable |
| Proof upload | editable (can upload) | editable | editable |
| Delete this item | hidden | hidden | visible |

Viewers see the modal in a read-only state except for the proof-upload section, which stays active per the original requirement that proof uploads are open to all roles.

## Status toggle behavior
- Switching Unpaid → Paid sets `status = 'paid'` and `paid_at = now()`; the item immediately moves from the "In Progress" tab to "Paid" tab in SPEC-07's table
- Switching Paid → Unpaid (allowed, e.g. correcting a mistake) clears `paid_at` back to null and moves it back to "In Progress" — no special confirmation needed, this is a low-stakes toggle
- Marking paid does **not** require proof to already be uploaded — they're independent, matching the original requirement that proof can be added before or after

## Deleting a single item
- Only `owner`-role members can delete an individual item (not the whole installment — that's SPEC-09's creator-only flow)
- Confirmation: a simple "Delete this item?" prompt is enough here (lighter than the type-to-confirm pattern used for whole-installment or account deletion, since this is a much lower-stakes action — see SPEC-17 for when each confirmation weight applies)
- Deleting an item does not renumber the `sequence_index`/labels of the remaining items (e.g. deleting "Week 3" doesn't rename "Week 4" to "Week 3") — labels stay tied to their original position for historical clarity

## Editing installment-level metadata (title, etc.)
Not part of the original requirements and not built in v1 — the title is set once at creation (SPEC-03–06) and isn't editable afterward. Flagging this here in case it turns out to matter once you're using the app; would be a small addition to this modal's parent page if requested later.

## Validation
- Amount must remain a positive number
- Due date has no forward/backward restriction on edit (user might legitimately need to move a date)
