# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

@docs/SPEC.md

## Stack

Next.js 16.2.6 (App Router, Turbopack), React 19.2, TypeScript (strict), Sass (SCSS modules). Backend is Supabase (Postgres + Auth + Realtime) via `@supabase/ssr`; PDFs render with `@react-pdf/renderer`. No test runner is configured.

**Heed [AGENTS.md](AGENTS.md):** Next.js 16 and React 19 both have breaking changes vs. older versions. When in doubt, read `node_modules/next/dist/docs/` rather than relying on training data. Concrete example already in this repo: [lib/client-store.ts](lib/client-store.ts) uses `useSyncExternalStore` instead of `useState`+`useEffect` because React 19's `react-hooks/set-state-in-effect` rule flags the older pattern, and `useSyncExternalStore` is also SSR-safe.

## Commands

- `npm run dev` — dev server (Turbopack, default port 3000)
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript)

There is no test command. Don't claim "tests pass" — verify changes by running the dev server and exercising the UI.

## Architecture

**Route layout.** Three groups under `app/`:
- [app/layout.tsx](app/layout.tsx) — root HTML shell, Geist fonts, and an inline pre-paint script that reads `cgk-theme` from localStorage and sets `data-theme` on `<html>` *before* React hydrates. Required to avoid a light→dark flash on reload — do not remove or move it after hydration.
- [app/(app)/layout.tsx](app/(app)/layout.tsx) — route group wrapping all authenticated pages with `<Sidebar>` + `<Topbar>`. Pages live at `app/(app)/{dashboard,pipeline,leads,clients,devis,factures,commerciaux,planification,comptabilite,notifications,settings}/`. The root [app/page.tsx](app/page.tsx) just `redirect("/dashboard")`.
- `app/(auth)/` — public `login` / `signup` pages (+ Google OAuth via `GoogleSignInButton`); `app/auth/callback/route.ts` completes the OAuth code exchange.
- [proxy.ts](proxy.ts) is the auth gate (Next 16 renamed `middleware.ts` → `proxy.ts`, export `proxy` not `middleware`). It validates the session with `getUser()` and redirects unauthenticated users to `/login`; `/api/*`, `/login`, `/signup`, `/auth/callback` are the public paths.
- New nav entries must be added to [lib/nav.ts](lib/nav.ts) (`NAV_GROUPS`) — it is the single source of truth for the sidebar and the ⌘K palette ([components/CommandPalette](components/CommandPalette)). Add a matching `IconName` + path in [components/Icon/Icon.tsx](components/Icon/Icon.tsx).

**Client state.** [lib/client-store.ts](lib/client-store.ts) is a tiny localStorage pub/sub built on `useSyncExternalStore`. Use `useStoredValue` / `setStoredValue` for any UI flag persisted across reloads (current users: `cgk-theme`, `cgk-sidebar-collapsed`). Use `useClientValue` for client-only reads like `navigator.platform` to keep SSR output deterministic. Do not introduce a heavier state library for these flags.

**Styling.** SCSS modules colocated with components (`*.module.scss`) plus globals in [app/globals.scss](app/globals.scss) and tokens in [app/styles/_tokens.scss](app/styles/_tokens.scss). Tokens are exposed as CSS custom properties so dark mode is a runtime swap on `[data-theme="dark"]` — never hardcode colors; always reference `var(--token)`. The 4-pt spacing scale (`--sp-1`..`--sp-12`) and radii (`--r-sm`..`--r-xl`) are intentional; reuse them.

**Icons.** [components/Icon/Icon.tsx](components/Icon/Icon.tsx) is an inline stroke-based set rendering `currentColor`. Add new glyphs to the `IconName` union and `PATHS` map — do not pull in an icon library.

**Path alias.** `@/*` resolves to the project root (see [tsconfig.json](tsconfig.json)). Prefer `@/lib/...`, `@/components/...` over relative ladders.

**Turbopack root pin.** [next.config.ts](next.config.ts) hard-codes `turbopack.root` to this directory because the user-home machine has multiple lockfiles; Turbopack would otherwise pick the wrong one and resolve the wrong `node_modules`. Don't remove the pin.

## Backend

Pages read from Supabase now (the old `lib/leads-mock.ts` is gone). [docs/SUPABASE.md](docs/SUPABASE.md) is the runbook (local Docker or hosted, migrations, seed, type generation). The migrations under [supabase/migrations/](supabase/migrations/) are the schema of record — SQL column names follow CDC §5.2 verbatim (`client_first_name`, `client_email`, …) while the UI-facing TS types in [lib/leads.ts](lib/leads.ts) use a simplified camelCase shape; the `*-server.ts` mappers bridge the two (see the `SOURCE_DB_TO_UI` maps).

**Three Supabase client tiers** — pick by execution context, never mix:
- [lib/supabase/browser.ts](lib/supabase/browser.ts) `supabaseBrowser()` — `"use client"` code, anon key, RLS-enforced.
- [lib/supabase/server.ts](lib/supabase/server.ts) `supabaseServer()` — RSC / route handlers / server actions, reads the session cookie (Next 16's `cookies()` is async — awaited inside). Still anon key + RLS, but as the logged-in user.
- [lib/supabase/service.ts](lib/supabase/service.ts) `supabaseServiceRole()` — **bypasses RLS**, service-role key. Guarded by `import "server-only"` so adding it to a client component is a compile error. Only webhooks / cron / other sessionless server code may use it. CDC §8.2: this key must never reach the browser bundle.

**Data-layer split.** Per domain there are two modules: `lib/<domain>-server.ts` (starts with `import "server-only"`, does the Supabase I/O, returns UI-shaped types) and `lib/<domain>-shared.ts` (pure helpers with no I/O — labels, timeline building — safe to import from client components). Keep server-only Supabase calls out of `-shared.ts`. Domains: leads, clients, commerciaux, dashboard, devis, documents, planification, palette, users; plus [lib/audit.ts](lib/audit.ts), [lib/notifications.ts](lib/notifications.ts), [lib/routing.ts](lib/routing.ts), [lib/brevo.ts](lib/brevo.ts), [lib/ringover.ts](lib/ringover.ts).

**API routes** under `app/api/`:
- `webhooks/leads/inbound` — WF1 lead capture. Open endpoint (proxy whitelists `/api/*`); authenticity is HMAC over the body against `LEADS_INBOUND_SECRET` (skipped with a warning in dev if unset). `external_id` is the idempotency key. Owner assignment runs through [lib/routing.ts](lib/routing.ts).
- `webhooks/brevo/inbound` (email replies), `webhooks/ringover` (call events) — both service-role writes + audit log.
- `leads/[id]` and `leads/[id]/status` — lead read/update + monotone status transitions.
- `documents/[id]/preview-pdf` — renders the `@react-pdf/renderer` document from [lib/pdf/DocumentPdf.tsx](lib/pdf/DocumentPdf.tsx).

**n8n.** [n8n/WF2.json](n8n/WF2.json) is the importable quote-follow-up workflow; [n8n/README.md](n8n/README.md) documents wiring. WF2 must never PATCH a lead's status past `signe` (see SPEC conflict #4).

## Domain

Product/business spec lives in [docs/SPEC.md](docs/SPEC.md) (auto-imported above) — six-stage pipeline, role matrix, the four sectors with their deposit %/VAT, multi-entity invoicing, n8n WF1/WF2, and the open conflicts between the CDC and the n8n doc. Treat the CDC ([Cahier-des-charges-CGK-CRM.pdf](Cahier-des-charges-CGK-CRM.pdf)) as the reference when the two PDFs disagree.

UI copy is in French. Sector slugs `urgence | nettoyage | enr | renovation` have stable hues in [app/styles/_tokens.scss](app/styles/_tokens.scss) — never hardcode sector colors elsewhere. Most pages are now real screens backed by Supabase; only a few (e.g. Settings) still use the placeholder `<PageShell>` from [app/(app)/_shared/PageShell.tsx](app/(app)/_shared/PageShell.tsx).
