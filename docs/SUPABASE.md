# Supabase setup runbook

Infrastructure-only at this stage: the migrations, RLS policies, seed data,
and typed client wrappers are in place, but **no page in `app/` reads from
Supabase yet** — every screen still pulls from `lib/leads-mock.ts`. Wiring
each page is a follow-up.

## Choose your environment

### Option A — Local Docker (recommended for dev)

1. Install the Supabase CLI: <https://supabase.com/docs/guides/cli/getting-started>
2. From the project root:

   ```bash
   supabase init     # creates supabase/config.toml if it doesn't exist
   supabase start    # boots Postgres + Auth + Storage in Docker
   ```

3. Copy the printed `anon key` and `service_role key` into `.env.local`
   (and `API URL`, usually `http://127.0.0.1:54321`):

   ```bash
   cp .env.example .env.local
   # edit .env.local
   ```

4. Apply migrations and seed:

   ```bash
   supabase db reset    # drops + recreates + applies all migrations + runs seed.sql
   ```

5. Generate types:

   ```bash
   npx supabase gen types typescript --local > lib/supabase/database.types.ts
   ```

### Option B — Hosted Supabase project

The Supabase CLI doesn't need to be globally installed — `npx supabase`
works for every command. Substitute `<ref>` with your project ref
(the `xxx` in `https://xxx.supabase.co`).

1. **Create the project** at <https://supabase.com>. Note the project ref.

2. **Copy the credentials** from *Project Settings → API → API keys*
   (or *API Settings* in the new dashboard):

   ```bash
   cp .env.example .env.local
   # then edit .env.local — the three real values go here, not in .env.example
   ```

   - `NEXT_PUBLIC_SUPABASE_URL`        → `https://<ref>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`   → the **anon / publishable** key
     (either the legacy JWT or a new `sb_publishable_…` key works — the
     SDK accepts both)
   - `SUPABASE_SERVICE_ROLE_KEY`       → the **service-role / secret** key
     (legacy JWT or new `sb_secret_…` — server only, never in the bundle)

3. **Authenticate the CLI** (opens a browser tab):

   ```bash
   npx supabase login
   ```

4. **Link the local project to the remote** (writes `supabase/.temp/` — gitignored):

   ```bash
   npx supabase link --project-ref <ref>
   ```

5. **Apply migrations**:

   ```bash
   npx supabase db push
   ```

6. **Load the seed** — `db push` does NOT auto-run `seed.sql` on hosted
   projects, so do it once manually. Easiest path: paste the contents of
   `supabase/seed.sql` into *Dashboard → SQL Editor → run*. Or via psql
   with the connection string from *Settings → Database*:

   ```bash
   psql "<connection-string>" -f supabase/seed.sql
   ```

7. **Regenerate the typed schema**:

   ```bash
   npx supabase gen types typescript --project-id <ref> > lib/supabase/database.types.ts
   ```

After step 7, `lib/supabase/{browser,server}.ts` are typed against your
actual schema.

### Moving to a new project / account (fresh start)

When the business data is throwaway (demo/seed), don't dump-and-restore —
re-run the migrations on the new project. Same as Option B, plus the
account/link specifics:

1. **Create the project** on the *new* account. Note the ref + DB password.
2. **Update `.env.local`** with the new `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
3. **Re-login the CLI as the new account** — `npx supabase login` (a stale
   session still points at the old org).
4. **Re-link** — `npx supabase link --project-ref <new-ref>`. This overwrites
   `supabase/.temp/`, which still holds the previous ref.
5. **`npx supabase db push`** — applies *all* migrations in order.
6. **Run `supabase/seed.sql`** in *Dashboard → SQL Editor*. `db push` never
   runs the seed on a hosted project. Do not skip it: the legal entities,
   roles, payment terms and the entity↔activity defaults all come from here.
7. **Regenerate the types** (step 7 above). Worth doing: the newer columns
   (`leads.discovery_*`, `leads.is_extreme`, `users.is_extreme`,
   `technicians.base_postal_code`…) are not in the committed
   `database.types.ts`, which is why a few writes still cast `as never`.
   Regenerating lets those casts go away.
8. **Bootstrap the first account**: sign up through the app. The auth trigger
   (`20260517000001`) makes the *first ever* user an `admin`; everyone after
   defaults to `commercial`. Then invite the rest from
   *Paramètres → Utilisateurs*.

The old project can then be left to auto-pause or deleted.

## What's in the migrations

| File                                  | Contents                                                  |
| ------------------------------------- | --------------------------------------------------------- |
| `20260515000001_init_enums.sql`       | All Postgres ENUMs (lead_status, document_type, …)        |
| `20260515000002_init_tables.sql`      | 19 tables with CDC §5.2 column names + checks             |
| `20260515000003_indexes.sql`          | btree indexes on FKs + hot query columns                  |
| `20260515000004_init_functions.sql`   | `set_updated_at` trigger + `next_doc_num(type, year)`     |
| `20260515000005_init_rls.sql`         | RLS policies on every business table (CDC §8.2)           |

The RLS policies reference `auth.uid()` and small helper functions
(`is_admin()`, `is_planificateur()`, `has_permission()`). Before auth is
wired, `auth.uid()` is NULL → every policy denies → unauthenticated reads
fail. That's the right default; the seed script bypasses RLS via the
service-role connection.

## Schema notes

- **Column naming follows CDC §5.2 verbatim** (`client_first_name`,
  `client_email`, `client_address`, etc.) — not the simplified names
  currently used in `lib/leads.ts`. When pages are swapped onto Supabase
  reads, the TypeScript types will be regenerated and the page code
  updated to match.
- **The dossier model uses the product-owner spec** (`a_planifier →
  planifie → finalise → solde` + a separate `payment_status`), overriding
  the CDC's `intervention_status` enum.
- **Document numbering** is gap-resilient via `next_doc_num(type, year)`
  + a `doc_counters` table. Call it at *emission* time (status → envoye),
  not at draft creation, to comply with French legal sequence rules
  (CDC §5).
- **IBANs and the immobTravaux annotation** are stored as plain text
  today. They become application-level encrypted (pgsodium or app-layer
  AES-GCM) when auth is wired — CDC §8.5.

## Working in the app

Two client factories live in `lib/supabase/`:

- `supabaseBrowser()` — for `"use client"` code. Reads the anon key.
- `supabaseServer()` — for RSC, route handlers, server actions. Reads
  cookies for session.
- `supabaseAdmin()` — for server-only code that needs to bypass RLS
  (seed scripts, webhook handlers, scheduled jobs). **Never import this
  in a client component.** A runtime guard throws if you try.

Example usage in a server component once a page is migrated:

```tsx
import { supabaseServer } from "@/lib/supabase/server";

export default async function LeadsPage() {
  const sb = await supabaseServer();
  const { data: leads, error } = await sb
    .from("leads")
    .select("*, source:lead_sources(*), activity:activities(*)")
    .is("deleted_at", null)
    .order("received_at", { ascending: false });
  if (error) throw error;
  return <LeadsTable leads={leads ?? []} />;
}
```

## Order of operations going forward

1. Provision the DB (Option A or B above).
2. Run `npx supabase gen types typescript ... > lib/supabase/database.types.ts`
   so the wrappers' generic types are real.
3. Wire pages onto Supabase one at a time. Suggested order — smallest
   blast radius first:
   1. Lead detail (`/leads/[id]`) — single-row read
   2. Leads table (`/leads`) — list read
   3. Pipeline Kanban — same data plus mutation on drag
   4. Comptabilité — joined reads with KPIs
   5. Quote editor + document view — INSERT path
   6. Planification — dossiers + status mutations
   7. Dashboard — aggregations (consider materialised views)
4. Add auth at the cut-over moment for the first page that needs to
   write. Until then, public read of the seeded data via the anon key
   plus broadened SELECT policies is fine for the demo.
