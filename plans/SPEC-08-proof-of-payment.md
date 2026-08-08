# SPEC-08 — Proof of Payment

## Overview
Up to 3 files (image or PDF) per installment item, uploadable by any member regardless of role, viewable via a modal from the main table.

## Upload flow (via the Action modal from SPEC-07)
- File picker accepts `.jpg, .jpeg, .png, .webp, .pdf`
- Max 3 files per item — if 3 already exist, uploader must remove one before adding another (show existing files with a remove option, subject to permission: uploader can remove their own; `owner`-role members can remove any)
- Max file size: 5MB per file (client-side validation before upload, plus Storage bucket policy enforcing the same limit)
- On upload: file goes to `proofs/{installment_id}/{installment_item_id}/{uuid}.{ext}` in Supabase Storage, a `proof_files` row is created
- Marking an item as "Paid" can happen independently of uploading proof — they're not forced together, since the original spec allows proof to be added before or after status changes

## Viewing proof (Proof label → modal)
- Modal shows all files for that item as a thumbnail grid (images render as thumbnails; PDFs render a generic PDF icon + filename)
- Clicking a thumbnail opens a larger preview (image: lightbox; PDF: opens in a new tab or embedded viewer)
- Modal shows uploader name + upload date per file (useful in shared installments so members can see who submitted what)

## Permissions recap (from SPEC-01)
- Upload: any member (`owner`, `editor`, `viewer`)
- Delete a proof file: the uploader themself, or an `owner`-role member
- View: any member

## Edge cases
- Upload fails mid-transfer (network drop): show inline error, don't create a partial `proof_files` row (only insert the DB row after Storage confirms success)
- Non-matching file type selected: reject client-side with a clear message before attempting upload
