Supabase migration instructions for Trackmoco

Quick: use the Supabase CLI to push this migration to your project.

Project ref: pyurhbtixxzbsmrahvja

1) Install the CLI (if not installed):

```bash
npm install -g supabase
```

2) Login to Supabase:

```bash
supabase login
```

3) Link the local repo to your project (uses the project ref):

```bash
supabase link --project-ref pyurhbtixxzbsmrahvja
```

4a) Recommended — push DB directly (fast, idempotent):

```bash
supabase db push --file "supabase/migrations/20260808T000000Z_create_schema.sql"
```

4b) Or create a migration via the CLI and copy the SQL into the generated file (repeatable history):

```bash
supabase migration new create_schema
# open the created file under supabase/migrations and paste the contents of supabase/migrations/20260808T000000Z_create_schema.sql
supabase migration apply
```

Alternative: use psql directly with your database connection string (one-off):

```bash
psql "<CONNECTION_STRING>" -f "db/migrations/001_create_schema.sql"
```

Notes:
- The migration file is at `supabase/migrations/20260808T000000Z_create_schema.sql`.
- I added `db/migrations/001_create_schema.sql` earlier as the authoritative copy for your repo.
- I cannot run these commands for you — run them locally where you have access to your Supabase credentials.

Auth email OTP setup:
- In Supabase Dashboard, open Authentication → Email Templates → Magic Link.
- Keep the template as a code email and render `{{ .Token }}` prominently (for example, `Your Trackmoco sign-in code is {{ .Token }}`).
- Do not use only `{{ .ConfirmationURL }}`; that sends a sign-in link while the app is waiting for a 6-digit code.
- Supabase email sending is rate-limited. Trackmoco waits 60 seconds between code requests and resends; configure custom SMTP in Supabase if higher volume is needed.

Auth email/password signup setup:
- Trackmoco uses Supabase's standard `auth.signUp({ email, password })` flow, matching Quentadoz.
- If email confirmation is enabled, Supabase sends the confirmation email and the user must follow the link before signing in.
- In Supabase Dashboard, set the Site URL and redirect URL to include `/auth/callback` for local and production environments.
- Supabase Auth email delivery is configured per Supabase project and is separate from the Resend API used for invitation emails. Configure SMTP under Authentication → SMTP Settings if the built-in sender does not deliver.

Database security warnings:
- Apply `20260913000004_security_function_privileges.sql` and then `20260913000005_move_security_definers_private.sql` after the existing migrations.
- Trigger functions are revoked from `anon` and `authenticated`; they remain executable by the database trigger owner.
- RLS helper functions and the dashboard aggregate RPC expose only `SECURITY INVOKER` wrappers in `public`; their privileged implementations live in the non-exposed `private` schema.
- Enable leaked-password protection in Supabase Dashboard under Authentication → Password Security; this setting is managed by Supabase Auth and is not controlled by a project SQL migration.
