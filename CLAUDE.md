# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

@docs/SPEC.md

## Stack

Next.js 16.2.6 (App Router, Turbopack), React 19.2, TypeScript (strict), Sass (SCSS modules). No test runner is configured.

**Heed [AGENTS.md](AGENTS.md):** Next.js 16 and React 19 both have breaking changes vs. older versions. When in doubt, read `node_modules/next/dist/docs/` rather than relying on training data. Concrete example already in this repo: [lib/client-store.ts](lib/client-store.ts) uses `useSyncExternalStore` instead of `useState`+`useEffect` because React 19's `react-hooks/set-state-in-effect` rule flags the older pattern, and `useSyncExternalStore` is also SSR-safe.

## Commands

- `npm run dev` — dev server (Turbopack, default port 3000)
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript)

There is no test command. Don't claim "tests pass" — verify changes by running the dev server and exercising the UI.

## Architecture

**Route layout.** Two layers under `app/`:
- [app/layout.tsx](app/layout.tsx) — root HTML shell, Geist fonts, and an inline pre-paint script that reads `cgk-theme` from localStorage and sets `data-theme` on `<html>` *before* React hydrates. Required to avoid a light→dark flash on reload — do not remove or move it after hydration.
- [app/(app)/layout.tsx](app/(app)/layout.tsx) — route group wrapping all authenticated pages with `<Sidebar>` + `<Topbar>`. Pages live at `app/(app)/{dashboard,pipeline,leads,commerciaux,planification,comptabilite,settings}/page.tsx`. The root [app/page.tsx](app/page.tsx) just `redirect("/dashboard")`.
- New nav entries must be added to [lib/nav.ts](lib/nav.ts) (`NAV_GROUPS`) — it is the single source of truth for the sidebar (and the future ⌘K palette). Add a matching `IconName` + path in [components/Icon/Icon.tsx](components/Icon/Icon.tsx).

**Client state.** [lib/client-store.ts](lib/client-store.ts) is a tiny localStorage pub/sub built on `useSyncExternalStore`. Use `useStoredValue` / `setStoredValue` for any UI flag persisted across reloads (current users: `cgk-theme`, `cgk-sidebar-collapsed`). Use `useClientValue` for client-only reads like `navigator.platform` to keep SSR output deterministic. Do not introduce a heavier state library for these flags.

**Styling.** SCSS modules colocated with components (`*.module.scss`) plus globals in [app/globals.scss](app/globals.scss) and tokens in [app/styles/_tokens.scss](app/styles/_tokens.scss). Tokens are exposed as CSS custom properties so dark mode is a runtime swap on `[data-theme="dark"]` — never hardcode colors; always reference `var(--token)`. The 4-pt spacing scale (`--sp-1`..`--sp-12`) and radii (`--r-sm`..`--r-xl`) are intentional; reuse them.

**Icons.** [components/Icon/Icon.tsx](components/Icon/Icon.tsx) is an inline stroke-based set rendering `currentColor`. Add new glyphs to the `IconName` union and `PATHS` map — do not pull in an icon library.

**Path alias.** `@/*` resolves to the project root (see [tsconfig.json](tsconfig.json)). Prefer `@/lib/...`, `@/components/...` over relative ladders.

**Turbopack root pin.** [next.config.ts](next.config.ts) hard-codes `turbopack.root` to this directory because the user-home machine has multiple lockfiles; Turbopack would otherwise pick the wrong one and resolve the wrong `node_modules`. Don't remove the pin.

## Backend

Supabase infrastructure has been scaffolded but no page reads from it yet — every screen still pulls from [lib/leads-mock.ts](lib/leads-mock.ts). [docs/SUPABASE.md](docs/SUPABASE.md) is the runbook (local Docker or hosted, migrations, seed, type generation, suggested page-migration order). The migrations under [supabase/migrations/](supabase/migrations/) are the schema of record — note that the SQL column names follow CDC §5.2 verbatim (`client_first_name`, `client_email`, …) while the current TS types in `lib/leads.ts` use the simplified shape; reconcile per-page when migrating.

## Domain

Product/business spec lives in [docs/SPEC.md](docs/SPEC.md) (auto-imported above) — six-stage pipeline, role matrix, the four sectors with their deposit %/VAT, multi-entity invoicing, n8n WF1/WF2, and the open conflicts between the CDC and the n8n doc. Treat the CDC ([Cahier-des-charges-CGK-CRM.pdf](Cahier-des-charges-CGK-CRM.pdf)) as the reference when the two PDFs disagree.

UI copy is in French. Sector slugs `urgence | nettoyage | enr | renovation` have stable hues in [app/styles/_tokens.scss](app/styles/_tokens.scss) — never hardcode sector colors elsewhere. Most page bodies are still placeholders (`<PageShell>` from [app/(app)/_shared/PageShell.tsx](app/(app)/_shared/PageShell.tsx)); the scaffold (sidebar, topbar, theme, routing) is what exists today.
