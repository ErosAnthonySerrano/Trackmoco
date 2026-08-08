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
