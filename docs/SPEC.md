# CGK CRM — product & integration spec

Condensed reference distilled from [Cahier-des-charges-CGK-CRM.pdf](../Cahier-des-charges-CGK-CRM.pdf) (v2.0, the authoritative product brief) and [Documentation_technique_workflows_n8n.pdf](../Documentation_technique_workflows_n8n.pdf) (v1.0, the n8n integration spec). When the two disagree, the CDC wins — the conflicts that exist today are flagged in the last section.

## What the product is

Internal commercial CRM for a French multi-sector services PME (B2B + B2C). Replaces a patchwork of spreadsheets and emails with one platform that:

- ingests leads from paid acquisition (Google Ads, Meta Ads, landing-page forms, phone, referral),
- runs the full commercial cycle through a standard 6-stage pipeline,
- emits quotes, deposit invoices, and final invoices respecting French accounting rules across **multiple legal entities (multi-société)**,
- triggers eIDAS-grade e-signature without friction,
- syncs offline conversions back to Google Ads (Enhanced Conversions for Leads, by GCLID).

Initial team: ~10 users across French cities. Reference volumes: ~150 leads/month, ~80 quotes/month, ~30 signatures/month — must scale 5× without restructure.

## The 6-stage pipeline (Kanban)

`Lead entrant → Devis envoyé → Devis ouvert → Signé → Encaissé`, plus a `Perdu` exit. The Kanban is the spine of the app — drag-and-drop transitions update status; transitions are **monotone** (a webhook can only move forward, never back).

Two **mandatory sub-statuses** appear from "Devis envoyé" onward — a red **"Canal manquant"** badge is shown until both are filled where applicable:

| Category   | Values            | Meaning                                                                  |
| ---------- | ----------------- | ------------------------------------------------------------------------ |
| Envoi      | `mano` / `auto`   | mano = sent manually after a phone agreement; auto = n8n WF2 sequence    |
| Signature  | `sans` / `avec`   | sans = pay on delivery; avec = deposit due → triggers auto deposit invoice |

The Mano/Auto split is load-bearing for analytics (it lets management compare hand-sold vs. sequence-sold performance) — don't quietly drop it.

## Roles, access, and tenancy

Four roles. A user can hold several; effective permissions are the union. The header has a **Vue (active-role) selector** with two groups: *Mes rôles* (real, write-capable) and *Aperçu (lecture seule)* (read-only preview of roles you don't hold).

| Module        | Super Admin | Commercial      | Planificateur   | Assistant (phase 2) |
| ------------- | ----------- | --------------- | --------------- | ------------------- |
| Dashboard     | full        | mine (perso KPIs) | full (read)   | —                   |
| Pipeline      | full        | mine            | —               | —                   |
| Leads & devis | full        | mine            | readonly        | —                   |
| Commerciaux   | yes         | —               | —               | —                   |
| Planification | yes         | —               | full CRUD       | —                   |
| Comptabilité  | yes         | —               | full CRUD       | —                   |
| Paramètres    | yes         | —               | —               | —                   |

`mine` = strict ownership filter (`access.leads = 'mine'`). **Tenancy is enforced by Supabase RLS, not the UI** — the anon key must never be able to exfiltrate another commercial's leads. Service-role key stays server-side, never in the bundle.

A separate **granular permission `immobTravaux`** controls visibility of one confidential lead annotation (Immobilier/Travaux). It applies *in addition to* role tenancy and is granted only by the Super Admin. The annotation is **encrypted at the application layer** (AES-GCM, key in a vault) — RLS gates access, encryption protects against direct DB access.

## Sectors (activities)

Four initial sectors. Each one drives lead routing, default templates, deposit %, and VAT rate:

| Sector                  | Slug          | Default deposit | VAT  | Quote range €    |
| ----------------------- | ------------- | --------------- | ---- | ---------------- |
| Dépannage urgence       | `urgence`     | 0 %             | 20 % | 200 – 800        |
| Nettoyage               | `nettoyage`   | 20 %            | 20 % | 500 – 3 000      |
| Énergies renouvelables  | `enr`         | 30 %            | 10 % | 8 000 – 25 000   |
| Rénovation bâtiment     | `renovation`  | 40 %            | 10 % | 15 000 – 80 000  |

The colors are already in [app/styles/_tokens.scss](../app/styles/_tokens.scss) as `--sector-*`. Sectors are CRUD-editable in Settings — don't hardcode the list.

## Document numbering

Sequential per type and per year, **with no gaps** (French accounting requirement):

- `DEV-2026-0001` — devis (status: `brouillon|envoye|ouvert|signe|refuse|expire`)
- `FA-2026-0001` — facture d'acompte (`brouillon|envoye|paye|retard`)
- `FAC-2026-0001` — facture finale (same statuses)

The deposit invoice is generated **automatically** the moment a devis transitions to *Signé · Avec acompte*. The final invoice is emitted manually after the intervention is marked `realise`.

## Multi-entity (legal entities)

The CRM supports an unlimited number of `legal_entities` (issuing companies). The mapping `legal_entity_activities (legal_entity_id, activity_id, is_default)` picks which entity issues a document for a given activity by default — there's a **partial unique index** ensuring one default per activity. Quote editor lets the commercial override the default at issue time.

Each legal entity carries: legal name, form (SAS/SARL/EURL/SASU/EI/SCI), SIRET, APE, VAT number, address, contact, **encrypted IBAN/BIC**, default VAT rate, franchise-en-base flag, free-text legal mentions, logo, accent color.

## Document templates

Indexed by **(legal_entity, activity, type)**. Imported as DOCX/PDF or written inline (simple WYSIWYG) with dynamic fields like `{client.nom}`, `{prestation.libelle}`, `{prestation.montant_ht}`, `{tva}`, `{total_ttc}`, `{acompte.montant}`. Default selection follows the mapping; commercial can override.

## n8n workflows

Two workflows live on a self-hosted n8n VPS. The CRM exposes inbound webhooks; outbound calls use a short-lived JWT (5 min) signed by the CRM.

### WF1 — Lead capture (synchronous)

Landing-page forms `POST` to `https://n8n.<internal>/webhook/lead-capture` with header `X-Source-Token` (per-LP token → maps to a `source_lp`). n8n validates, normalises (phone → E.164 `+33…`, email lowercased, names capitalised), checks for duplicates against the CRM, and either creates a new `leads` row in status `lead_entrant` or appends to `leads_history` if a duplicate is found. Dedup key: `(email, phone, source_lp)` over 24 h. The CRM endpoint receiving WF1 is `POST /api/webhooks/leads/inbound` with **HMAC signature in `X-Signature`** + replay-window check on the timestamp.

Synchronous response codes for WF1: `200` (created or duplicate-enriched), `400` (validation), `401` (token), `500`. LPs use an 8 s browser timeout and degrade gracefully.

### WF2 — Quote follow-up (async, 4 emails)

Triggered manually from the Kanban "Lancer séquence" hover button on a card in `Lead entrant` or `Devis envoyé · Mano` not yet signed. CRM calls `POST /webhook/relance-devis` with `{lead_id, commercial_id, quote_template_id}` (Bearer JWT). n8n then:

1. Fetches the lead, generates the e-signature envelope, gets a `signing_url` and `document_id`.
2. Wraps the URL in a tracked redirector at `https://<tracking-domain>/q/{token}` — the token is HMAC-SHA256 signed and encodes `{lead_id, quote_id, email_index}`.
3. Patches the lead to `devis_envoye · auto`.
4. Iterates the 4 Brevo templates with `Wait` nodes between, checking lead status before each send. **Stop conditions**: status becomes `signe` or `perdu`, or `opt_out = true`.

Status transitions driven by webhooks (all with `X-Signature-Hmac` validation, all idempotent — duplicate events return 200 no-op):

| Endpoint                         | Source             | Effect                                      |
| -------------------------------- | ------------------ | ------------------------------------------- |
| `POST /webhook/quote-link-clicked` | tracked redirector | `devis_envoye → devis_ouvert`               |
| `POST /webhook/quote-opened`       | e-sign `viewed`    | confirms `devis_ouvert`, sets `opened_at`   |
| `POST /webhook/quote-signed`       | e-sign `completed` | `→ signe`, stops sequence, notifies sales   |

Tracking is **hybrid** (proprietary tracked link + e-sign `viewed` webhook) — the e-sign event is the fallback when mail clients block tracking pixels.

## External integrations

| Integration         | Purpose                                                                       |
| ------------------- | ----------------------------------------------------------------------------- |
| Supabase            | Postgres + Auth (JWT, MFA TOTP req. for Super Admin) + Storage + Realtime     |
| n8n (self-hosted)   | WF1, WF2, webhook orchestration                                               |
| Brevo               | Transactional email (single sends + the 4-step sequence). No direct SMTP.     |
| Yousign / DocuSign  | eIDAS-advanced e-signature. Evidence pack archived ≥ 10 years.                |
| Google Ads          | Enhanced Conversions for Leads — fires on `signe` and `encaisse` with GCLID + TTC value |

## Data model essentials

Roughly 20 tables. Conventions: UUID v4 PKs (no exposed auto-increment), `timestamptz` UTC (display in Europe/Paris), Postgres ENUMs for state, soft deletes (`deleted_at`/`deleted_by`) except where RGPD erasure mandates a hard delete, append-only `audit_logs`. Document numbers come from a per-type, per-year gapless sequence.

Critical tables: `users`, `roles`, `user_roles` (multi), `user_activities`, `user_permissions`, `activities`, `lead_sources`, `legal_entities`, `legal_entity_activities`, `prestations` (catalogue, 16 seeded), `payment_terms`, `leads`, `clients`, `documents` (devis + factures unified), `document_lines`, `interventions`, `technicians`, `audit_logs`, `document_templates`.

The lead's `external_id` is the idempotency key for WF1 — same lead delivered twice creates one row. Deposit IBAN and the `immob_travaux_annotation` field are **encrypted in the application layer**, not just at rest.

## Performance, security, compliance — non-negotiables

- **RLS on every business table**, versioned in SQL migrations. No exception.
- **No service-role key in the browser bundle.** CI must scan the build artifact.
- Argon2id (or bcrypt cost ≥ 12) for passwords. HaveIBeenPwned check on signup. 12-char min.
- 12 h JWT absolute lifetime, rotated refresh tokens, server-side logout.
- 5-failed-login lockout with exponential backoff. Constant-time login response (no user-enum leak).
- TLS 1.3 + HSTS preload. Headers: CSP, `X-Frame-Options: DENY`, strict referrer.
- Signed URLs for PDFs (TTL ≤ 60 min). Never a permanent public URL on a quote/invoice.
- Audit log entries for: login/logout, role changes, immobTravaux grant/revoke, doc generation, doc emission, encaissement, lead deletion, confidential-field reads, legal-entity edits, template edits. Retention ≥ 5 years.
- p95 targets: Dashboard initial load < 2.5 s, internal nav < 800 ms, filter/sort on 1k leads < 500 ms, PDF generation < 3 s, webhook→visible < 5 s, Kanban drag→DB < 400 ms.
- WCAG 2.1 AA. Lighthouse ≥ 90 on Perf/A11y/Best Practices.
- Desktop-first (≥ 1280×800), tablet (10") fully usable for sales mobility — Kanban must work touch.

## Roadmap (phasing from CDC §10)

- **Phase 1, ~8 wk** — data model + RLS, auth & roles & multi-role view selector, Dashboard (basic), Pipeline + sub-statuses, Leads & devis list, simple devis generation, e-signature, WF1 inbound, WF2 trigger, manual final invoice.
- **Phase 2, ~6 wk** — full Comptabilité (3 tabs + KPIs + filters + Document view + quote editor with catalogue), Clients page, multi-entity + templates, **auto deposit invoice** on `signe·avec`, Planification + acomptes encart, drag-drop scheduling, immobTravaux + encryption, Google Ads conversions, onboarding modal, ⌘K palette, dark mode, read-only preview view.
- **Phase 3, ~4 wk** — full audit logs UI, MFA TOTP enforcement, rate limiting, Sentry + materialised KPI views, Assistant role activation, E2E tests, runbook.

## Conflicts between CDC and n8n doc — to resolve before coding the integration

These are real divergences, not paraphrasing. Flag any of them when you find the code drifting.

1. **Sequence cadence.**
   - CDC §2.3: J+0, J+3, J+7, J+14.
   - n8n doc §3.2 + var `EMAIL_DELAYS = [0, 1, 2, 1]`: J+0, J+1, J+3, J+4.
   The CDC is the reference document; the n8n doc is more recent and was likely aligned with what's actually deployed. **Confirm with the client before implementing.**

2. **`leads.status` enum spelling.**
   - CDC §5.4: `lead | envoye | ouvert | signe | encaisse | perdu`.
   - n8n doc §4.2: `lead_entrant | devis_envoye | devis_ouvert | signe | perdu | nurturing` — adds `nurturing`, drops `encaisse` (it stops at `signe`).
   The CRM owns this enum end-to-end (encaissement is part of the cycle), so go with the CDC's six values. The n8n payload contract must match.

3. **`leads` field naming.**
   - CDC §5.2: `client_first_name`, `client_last_name`, `client_email`, `client_phone`, `client_address` (jsonb), `activity_id`, `owner_id`, `entity_id`.
   - n8n doc §4.2: `first_name`, `last_name`, `email`, `phone`, `project_type`, `assigned_to`.
   The CDC's prefixed naming is the schema-of-record; the WF1 payload normalisation step is responsible for translating LP form fields into the CDC names before `POST /api/webhooks/leads/inbound`.

4. **Pipeline scope.** The n8n doc only models 4 statuses (it ends at `signe`); the CRM owns `encaisse` and the manual-only `perdu` transition. WF2 must never PATCH a status forward past `signe`.
