# SPEC-02 — Auth

## Overview
Sign-in/sign-up using Supabase's built-in mechanisms only — no custom OTP generation, storage, or expiry logic. Two paths: Google OAuth, and email OTP (code sent to inbox, entered on a verify screen).

## Flow

### Entry screen (`/login`)
- Email input field
- "Send code" button → triggers `supabase.auth.signInWithOtp({ email })`
- Divider
- "Continue with Google" button → `supabase.auth.signInWithOAuth({ provider: 'google' })`

### OTP verify screen (`/login/verify`)
- Shown after "Send code" succeeds
- 6-digit code input
- "Verify" button → `supabase.auth.verifyOtp({ email, token, type: 'email' })`
- "Resend code" link, disabled for 30s after each send (client-side cooldown only — Supabase handles actual rate limiting server-side)
- On success → redirect to `/` (dashboard)

### Google OAuth callback
- Standard Supabase callback route (`/auth/callback`) that exchanges the code for a session, then redirects to `/`

## Profile creation (automatic)
Postgres trigger on `auth.users` insert creates a matching `profiles` row:
- `display_name` = email prefix (before `@`), editable later in Account Settings (not in v1 scope unless requested)
- `avatar_url` = Gravatar URL built from MD5 hash of lowercased, trimmed email — `https://www.gravatar.com/avatar/{hash}?d=404`. App falls back to a bundled default avatar asset if Gravatar returns 404.

## Session & route protection
- `middleware.ts` refreshes the Supabase session cookie on every request (standard `@supabase/ssr` pattern)
- Route group `(dashboard)/*` checks for a valid session server-side; unauthenticated requests redirect to `/login`
- Route group `(auth)/*` (login/verify) redirects to `/` if a session already exists

## Account deletion (feature 7f)
- Settings page → "Delete account" → confirmation modal requiring the user to type their email to confirm (same pattern as installment deletion in SPEC-01/09)
- Before allowing deletion, check: does this user have `created_by` rows in `installments` that still have other active members? If yes, block deletion and show: "You still own N shared installment(s). Delete or transfer them first." This avoids silently orphaning shared data.
- If clear, call a server route using the Supabase `service_role` key to delete the `auth.users` row — cascades to `profiles` via FK, and to owned installments/items/proofs via cascade rules defined in SPEC-01.

## Edge cases
- User closes tab mid-OTP-flow: re-entering email on `/login` just re-triggers `signInWithOtp`, no special state to clean up (Supabase handles token invalidation)
- Google account email doesn't match Supabase Auth's expectations (e.g. workspace-restricted domains): rely on Supabase's default Google provider behavior, no custom handling needed for v1
