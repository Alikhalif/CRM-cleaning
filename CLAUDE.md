# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

@docs/SPEC.md

## Stack

Next.js 16.2.6 (App Router, Turbopack), React 19.2, TypeScript (strict), Sass (SCSS modules). Backend is Supabase (Postgres + Auth + Storage + Realtime) via `@supabase/ssr`. Two PDF engines (see **PDF generation**). Transactional email via Brevo, telephony via Ringover. No test runner is configured.

**Heed [AGENTS.md](AGENTS.md):** Next.js 16 and React 19 both have breaking changes vs. older versions. When in doubt, read `node_modules/next/dist/docs/` rather than relying on training data. Concrete example already in this repo: [lib/client-store.ts](lib/client-store.ts) uses `useSyncExternalStore` instead of `useState`+`useEffect` because React 19's `react-hooks/set-state-in-effect` rule flags the older pattern, and `useSyncExternalStore` is also SSR-safe.

## Commands

- `npm run dev` — dev server (Turbopack, default port 3000)
- `npm run build` — production build (`output: "standalone"`)
- `npm run start` — serve the production build
- `npm run lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript)
- `npx supabase db push` — apply migrations to the linked project (see [docs/SUPABASE.md](docs/SUPABASE.md))
- `npx supabase gen types typescript --linked > lib/supabase/database.types.ts` — regenerate DB types after a migration

There is no test command. Don't claim "tests pass" — verify changes by running the dev server and exercising the UI.

`lagny-sur-marne/` is a **separate, untracked Next.js project** (a landing page) nested in this repo with its own `package.json` and `node_modules`. Never build, lint, or edit it as part of CRM work — and note it is exactly why the Turbopack root pin below exists.

## Architecture

### Route layout

Three groups under `app/`, plus public token-gated pages:

- [app/layout.tsx](app/layout.tsx) — root HTML shell, Geist fonts, and an inline pre-paint script that reads `cgk-theme` from localStorage and sets `data-theme` on `<html>` *before* React hydrates. Required to avoid a light→dark flash on reload — do not remove or move it after hydration.
- [app/(app)/layout.tsx](<app/(app)/layout.tsx>) — route group wrapping all authenticated pages. It is an async RSC that resolves the current user once and conditionally mounts the global chrome: `<Sidebar>`, `<Topbar>`, `<CommandPalette>`, `<MobileTabBar>`, `<RealtimeNotifications>`, `<PresenceHeartbeat>`, and — only for phone-capable profiles — `<RingoverPhone>` + `<CallScreenPop>`. ~23 page directories live under it.
- `app/(auth)/` — public `login` / `signup` / `forgot-password` / `reset-password`; `app/auth/callback/route.ts` completes the OAuth code exchange.
- `app/sign/[token]/` and `app/devis-signer/[token]/` — **unauthenticated** client-facing e-signature pages. Access is proven by the token alone, so these are whitelisted in the proxy; see **E-signature**.

[proxy.ts](proxy.ts) is the auth gate (Next 16 renamed `middleware.ts` → `proxy.ts`, export `proxy` not `middleware`). It validates the session with `getUser()` (not `getSession()`) and redirects unauthenticated users to `/login`. The public-path regex is **anchored** — `/login` and `/login/…` match, `/login-xxx` does not. Public: auth pages, `/auth/callback`, `/sign`, `/devis-signer`, `/api/*`, `/_next/*`, `/email-signatures/*`, `/favicon.ico`.

New nav entries must be added to [lib/nav.ts](lib/nav.ts) (`NAV_GROUPS`) — it is the single source of truth for the sidebar and the ⌘K palette ([components/CommandPalette](components/CommandPalette)). Add a matching `IconName` + path in [components/Icon/Icon.tsx](components/Icon/Icon.tsx). `superAdminOnly: true` hides an entry from both surfaces — that is a UI filter only, never the access control itself (see **Authorization**).

### Supabase client tiers

Pick by execution context, never mix:

- [lib/supabase/browser.ts](lib/supabase/browser.ts) `supabaseBrowser()` — `"use client"` code, anon key, RLS-enforced.
- [lib/supabase/server.ts](lib/supabase/server.ts) `supabaseServer()` — RSC / route handlers / server actions, reads the session cookie (Next 16's `cookies()` is async — awaited inside). Still anon key + RLS, but as the logged-in user.
- [lib/supabase/service.ts](lib/supabase/service.ts) `supabaseServiceRole()` — **bypasses RLS**, service-role key. Guarded by `import "server-only"` so adding it to a client component is a compile error. Only webhooks / cron / signed-URL minting / gapless-numbering RPCs / other sessionless server code may use it. CDC §8.2: this key must never reach the browser bundle.

### Data-layer split

Per domain there are two modules: `lib/<domain>-server.ts` (starts with `import "server-only"`, does the Supabase I/O, returns UI-shaped types) and `lib/<domain>-shared.ts` (pure helpers with no I/O — labels, timeline building — safe to import from client components). Keep server-only Supabase calls out of `-shared.ts`. Larger subsystems get a folder instead (`lib/devis/`, `lib/documents/`, `lib/presence/`, `lib/commercial-actions/`, `lib/cert-hotte/`, `lib/crypto/`, `lib/pdf/`).

SQL column names follow CDC §5.2 verbatim (`client_first_name`, `client_email`, …) while the UI-facing TS types in [lib/leads.ts](lib/leads.ts) use a simplified camelCase shape; the `*-server.ts` mappers bridge the two (see the `SOURCE_DB_TO_UI` maps). The migrations under [supabase/migrations/](supabase/migrations/) (134 and counting) are the schema of record.

Mutations are overwhelmingly **server actions** in colocated `actions.ts` files next to the page, not API routes. API routes exist only for machine callers (webhooks, cron, PDF streams, tracking redirectors).

### Authorization model

Three layers, and they are not interchangeable:

1. **RLS in Postgres** is the real boundary. `mine` tenancy (a commercial sees only their own leads) is enforced there; the anon key must never be able to exfiltrate another commercial's rows. Several past bugs were "the UI filtered it but RLS didn't" — when you add a table or a column, add the policy in the same migration.
2. **Module scope** — [lib/access-shared.ts](lib/access-shared.ts) is the single source of truth for *which roles see which modules*. `RESTRICTED_MODULES` maps a route prefix to a scope (`backOffice` = admin + planification, `admin` = Super Admin); everything unlisted is open to any authenticated user and relies on RLS for row scoping. The same mapping drives the sidebar, the ⌘K palette, and the server-side route guards, so they cannot drift. **To put a new module out of the commercial's reach, add its prefix there and drop a `layout.tsx` calling `requireBackOffice()` / `requireAdmin()` from [lib/access-server.ts](lib/access-server.ts)** — guarding in the layout covers every current and future sub-route, and an out-of-scope URL renders a 404 rather than a "forbidden" panel. Hiding an entry from `NAV_GROUPS` is never protection on its own.
3. **Derived capabilities** — `profileCapabilities()` in [lib/leads.ts](lib/leads.ts) maps commercial profiles to `canUseRingover` / `canAddLead`. Capabilities follow the profile automatically; there is deliberately no per-user toggle.

The business rule behind the scoping: **the signature is the boundary.** A commercial owns the dossier from lead to signature (lead → contact → découverte → infos/photos → devis → relance → négociation → signature) and keeps read-only visibility on their own sales history and KPIs. Everything after the signature — planification, sous-traitance, comptabilité, documents & contrats internes, paramétrage — belongs to the back-office. Server actions in those modules call `assertBackOffice()`; `getCurrentUserProfile()` is wrapped in React `cache()` so stacking these guards costs no extra queries.

Role **preview** ([lib/role-preview.ts](lib/role-preview.ts)) is cosmetic: `cgk-active-role` only changes the "Vue ·" label and the home screen, and `cgk-preview-role` renders the app `inert` for an admin previewing another role. Neither grants or removes permissions — effective permissions stay the union of real roles.

### Confidential fields

[lib/crypto/field-encryption.ts](lib/crypto/field-encryption.ts) does AES-256-GCM application-layer encryption, because RLS protects *rows* but a lead's legitimate owner could still read a column they lack permission for. It covers the Immobilier/Travaux annotation **and** marketing provenance (`source_url`, `utm_*`, `gclid` — a commercial must never see where a lead came from; admin and planification may). Envelope format is `encv1:<iv>:<tag>:<ciphertext>`; values without the prefix are treated as legacy plaintext and re-encrypted on next write. With `FIELD_ENCRYPTION_KEY` unset everything stays plaintext — so the key is mandatory in prod and must never be lost.

### PDF generation

Two engines coexist on purpose; pick by what you're rendering:

- **`@react-pdf/renderer`** ([lib/pdf/](lib/pdf/)) — the generic devis/facture/contract/attestation documents. [DocumentPdf.tsx](lib/pdf/DocumentPdf.tsx) carries two themes selected by the lead's sector.
- **`pdfkit`** ([lib/devis/render.ts](lib/devis/render.ts), [lib/cert-hotte/](lib/cert-hotte/)) — the OPTIMIVV devis and the certificat de hotte. These are **pixel-ports of a reportlab Python original; the layout is frozen**. Positions, colors, fonts and block order are copied verbatim — a layout difference is a bug, not a restyle. [scripts/devis-compare/](scripts/devis-compare/) renders and diffs against the reference.

Both read fonts/images from disk at runtime, so [next.config.ts](next.config.ts) lists them in `serverExternalPackages` and ships their assets via `outputFileTracingIncludes`. Touching `public/fonts/` or `public/devis-assets/` means checking that config.

Document numbers are **gapless per type and per year** (French accounting). Allocation goes through `SECURITY DEFINER` RPCs with a row lock ([lib/devis/numero.ts](lib/devis/numero.ts)) and a number is consumed only at real emission — never on preview.

### E-signature

[lib/signature-server.ts](lib/signature-server.ts) is a self-hosted flow, not a third-party eIDAS provider. A random 256-bit token is handed out; only its SHA-256 hash is stored. The client opens `/sign/[token]` (or `/devis-signer/[token]` for OPTIMIVV), and on completion the server composes the signed PDF plus an attestation and a certificate, hashes it, and stores it in the private `signed-documents` bucket. Signing also creates the downstream dossier for planification and records whether the signature mode was `logiciel` or `planificateur`.

Storage buckets are private; the UI always gets **signed URLs with a ≤60 min TTL** minted server-side (`lead-media` for photos/videos in [lib/media-server.ts](lib/media-server.ts), `signed-documents` for signatures). Never expose a permanent public URL for a quote, invoice, or client media.

### Background engine (cron) — load-bearing

`POST /api/presence/evaluate`, authenticated by the `x-cron-secret` header against `PRESENCE_CRON_SECRET`, must be called **every 1–2 minutes**. It runs three isolated passes (each in its own try/catch): presence & alerts → commercial actions/relances → document & contract alerts. Without it, `/ma-journee`, the relance engine, photo alerts, presence alerts and contract-expiry alerts simply never fire on their own. [docs/CRON.md](docs/CRON.md) is the runbook. The admin "Rafraîchir" button on `/presence` is a manual fallback, not a substitute.

The commercial-actions engine ([lib/commercial-actions/engine-server.ts](lib/commercial-actions/engine-server.ts)) *reconciles* from `audit_logs` and is idempotent — which is why audit writes must never silently fail (see below).

### Audit log

[lib/audit.ts](lib/audit.ts) is append-only and **writes via the service role**. It used to write through the session, so every machine-triggered event (webhooks, public signatures, n8n callbacks) was silently dropped and the actions engine starved. The current user is still resolved best-effort to fill `user_id`, but the write doesn't depend on a session. Audit writes are best-effort and never fail the user's action. The action-name namespace is documented in a comment block at the top of that file — follow it rather than inventing names.

### API routes

Under `app/api/`:

- `webhooks/leads/inbound` — WF1 lead capture. Open endpoint (the proxy whitelists `/api/*`); authenticity is HMAC over the body against `LEADS_INBOUND_SECRET` (skipped with a warning in dev if unset). `external_id` is the idempotency key. Owner assignment runs through [lib/routing.ts](lib/routing.ts).
- `webhooks/brevo/inbound` + `webhooks/brevo/events` (email replies and opens/clicks), `webhooks/ringover` (call events) — service-role writes + audit log.
- `leads/[id]` and `leads/[id]/status` — lead read/update + monotone status transitions.
- `devis/*` — OPTIMIVV quote PDF, email dispatch, and `devis/track/[token]` (the tracked-link redirector that moves `envoye → ouvert`).
- `certificat-hotte/*`, `documents/[id]/preview-pdf` — other PDF streams.
- `presence/{heartbeat,offline,evaluate}` — presence pings and the cron entry point.
- `geo/distance`, `palette-index` — helpers for technician geo-matching and the ⌘K palette.

All webhooks go through [lib/webhook-dedup.ts](lib/webhook-dedup.ts): an insert into `webhook_events` whose unique-violation (`23505`) means "already processed → 200 no-op". In **dev** a missing secret makes a webhook accept unsigned requests; in **prod** every secret in `.env.example` must be set or those endpoints stay open.

### Runtime config

Feature flags live in the `app_settings` **table**, not in env — [lib/app-settings.ts](lib/app-settings.ts), flipped from `/settings/integrations` without a redeploy (e.g. `n8n_sequence_enabled`). Env is for secrets and infrastructure only. [.env.example](.env.example) is the documented list; keep it current when adding a variable.

### Deployment

Docker multi-stage build ([Dockerfile](Dockerfile)) producing a `node:22-slim` runner from `.next/standalone`. `NEXT_PUBLIC_*` are inlined at build time and passed as build-args; server secrets arrive at runtime via `--env-file`. It runs on a VPS behind a Traefik reverse proxy at `crmoptimum.com`, which is why `experimental.serverActions.allowedOrigins` lists that domain — without it, Next's CSRF check breaks post-login navigation. `bodySizeLimit` is raised to 110 MB for media uploads. Security headers (HSTS, `X-Frame-Options: DENY`, CSP `frame-ancestors 'none'`) are set in `next.config.ts`; a full content CSP is still outstanding.

**Turbopack root pin.** `next.config.ts` hard-codes `turbopack.root` to this directory because the machine has multiple lockfiles (including `lagny-sur-marne/`); Turbopack would otherwise resolve the wrong `node_modules`. Don't remove the pin.

## Styling

SCSS modules colocated with components (`*.module.scss`) plus globals in [app/globals.scss](app/globals.scss) and tokens in [app/styles/_tokens.scss](app/styles/_tokens.scss). Tokens are exposed as CSS custom properties so dark mode is a runtime swap on `[data-theme="dark"]` — never hardcode colors; always reference `var(--token)`. The 4-pt spacing scale (`--sp-1`..`--sp-12`) and radii (`--r-sm`..`--r-xl`) are intentional; reuse them.

**Responsive conventions** (desktop-first, ≥1025px is the untouched baseline):
- ≤768px switches to the mobile shell — `<MobileTabBar>` plus the sidebar as a drawer.
- Tables become cards at ≤1024px via `data-label` attributes on cells, with the rule scoped under `.table` so it can't leak.
- 640–1024px uses a 2-column grid.

**Icons.** [components/Icon/Icon.tsx](components/Icon/Icon.tsx) is an inline stroke-based set rendering `currentColor`. Add new glyphs to the `IconName` union and `PATHS` map — do not pull in an icon library.

**Client state.** [lib/client-store.ts](lib/client-store.ts) is a tiny localStorage pub/sub built on `useSyncExternalStore`. Use `useStoredValue` / `setStoredValue` for any UI flag persisted across reloads (`cgk-theme`, `cgk-sidebar-collapsed`, `cgk-active-role`, `cgk-preview-role`). Use `useClientValue` for client-only reads like `navigator.platform` to keep SSR output deterministic. Do not introduce a heavier state library for these flags.

**Path alias.** `@/*` resolves to the project root (see [tsconfig.json](tsconfig.json)). Prefer `@/lib/...`, `@/components/...` over relative ladders.

## Domain

UI copy and most code comments are in **French** — match that. Product/business spec is in [docs/SPEC.md](docs/SPEC.md) (auto-imported above) and the CDC ([Cahier-des-charges-CGK-CRM.pdf](Cahier-des-charges-CGK-CRM.pdf)) is the reference when documents disagree.

**The code has outgrown parts of SPEC.md — trust the code, and say so when you notice drift.** Notably:

- **Sectors are now eight**, not four: `urgence | nettoyage | nettoyage_difficile | enr | renovation | debarras | demenagement | diogene`. Each has a stable hue in [app/styles/_tokens.scss](app/styles/_tokens.scss) — never hardcode sector colors elsewhere.
- **Multi-country**: `FR | CH | LU | BE | CA`, with country inferred from the landing page, then the form, then the phone prefix (`countryFromPhone`).
- **Commercial profiles** (`appel_entrant`, `emission_appel`, `divers`, `debarras_demenagement`, `diogene`, `performant`, `en_attente`) drive both routing pools ([lib/routing-shared.ts](lib/routing-shared.ts) `targetProfiles()`) and capabilities. This whole concept postdates the SPEC.
- Whole modules exist that the SPEC doesn't mention: présence & actions commerciales, sous-traitants, documents & contrats, découverte guidée, chiffrage, médias par dossier, recherche globale, Ringover webphone.
- [docs/SUPABASE.md](docs/SUPABASE.md) still opens by claiming no page reads from Supabase. That is long obsolete — every page does. Its CLI procedures are still correct.

[lib/leads.ts](lib/leads.ts) is the domain vocabulary hub: statuses (`lead | envoye | ouvert | signe | encaisse | perdu` — CDC spelling), sub-statuses (`mano/auto`, `sans/avec`), document statuses, deposit percentages and payment terms per sector, discovery enums. Read it before inventing a label or an enum.

Other reference docs: [docs/MANUEL_COMPLET.md](docs/MANUEL_COMPLET.md) (user manual), [docs/RECETTE-CRM-2026-09-24.md](docs/RECETTE-CRM-2026-09-24.md) (latest QA audit and its P1 findings), [docs/carte-grise/](docs/carte-grise/) (official architecture dossier), [n8n/README.md](n8n/README.md) (WF1/WF2 wiring). WF2 must never PATCH a lead's status past `signe` (SPEC conflict #4).
