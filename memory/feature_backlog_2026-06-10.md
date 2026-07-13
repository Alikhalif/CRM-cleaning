---
name: CGK CRM feature backlog (call 2026-06-10)
description: Client-requested features from the 2026-06-10 call to finish the CRM — routing, Débarras sector, geo technicians, multi-société quotes, refusal flow, NRP, planner email, premium UI
type: project
---

Feature requests captured from the client on **2026-06-10** to "finir le CRM". Cross-references current code state (full audit run 2026-07-08). See [[CGK CRM project context]].

**Progress (as of 2026-07-13):** DONE — Débarras 5th sector (migration `20260708000001`, all hardcoded Sector maps/enums updated, clients sector filter), multi-société refusal + cheaper re-quote flow (`getDevisPrefill` + `/devis/new?from=`, société column + refusal motif + "Renvoyer moins cher" on lead detail & DocumentActions), geo technicians (migration `20260708000002`, `lib/geo.ts` département-centroid proximity, PlanifyDossierModal distance ranking ≤100km + widen), planner confirmation email, NRP. Both new migrations still need to be APPLIED to the DB. `document_lines` read-path bug fixed too.

**Re-sent & expanded on 2026-07-11 — still TODO:**
- **🚨 Rubrique Découverte — DONE (2026-07-13).** Modelled as lead attributes (migration `20260713000001`: announced_price, discovery_outcome ok/refus/ok_plus, discovery_done_at, photos_requested_at, is_extreme). `recordDiscovery` (Ok→ready / Ok voir +→photos / Refus→perdu) + `requestPhotos` (email/SMS via Brevo) actions in pipeline/actions.ts. `DiscoveryCard` encart on lead detail (prix annoncé + 3 outcome buttons + photo email/SMS). `/decouverte` nav page = relance list of leads without découverte + coverage KPI + "en attente photos" (OK voir +). SMS via new `sendBrevoSms` (BREVO_SMS_SENDER). Chosen: lead-attribute model, Ok/Refus→perdu/Ok+→photos semantics, Brevo SMS.
- **Templates emails/SMS — DONE.** photo-request (mail + SMS) in `lib/templates.ts`; **facture finale accompagnement** now wired: `buildFinalInvoiceMessage` pre-fills SendEmailModal when doc.type === "finale" (editable, PDF attached). Intervention-confirmation mail already DONE.
- **Commercial extrême = routing tier — DONE (2026-07-13).** Migration `20260713000002` adds `users.is_extreme` (mirrors is_premium pool). routing.ts: `isExtreme` input + `is_extreme` condition + `assign_to_extreme` action (round-robin over the extreme pool). RoutingRuleModal exposes "Demande extrême" condition + "pool extrême" action. Lead capture flags it: NewLeadModal checkbox + createLead + WF1 webhook payload (`is_extreme`) → routed + persisted on `leads.is_extreme`.
- **"Commercial extrême pour demande extrême"** — now framed as a tier for *extreme/urgent demands* (still needs exact definition: routing tier? a flag on the lead?).
- **Telephony:** Ringover **or "withallo"/Wildix** as an alternative provider — API ↔ CRM.
- **Menu déroulant des sociétés** (dropdown to pick issuing société — exists in QuoteEditor; may want it more prominent).
- **User management — PARTIAL DONE (2026-07-13).** `/settings/users` (admin-gated): list users, assign/remove roles, toggle is_premium / is_extreme pool flags (admin-guarded actions + audit user.role.assign/remove, user.premium/extreme.set). This unblocks the premium/extrême routing tiers (previously no UI flagged users into the pools). STILL TODO: **pro access-invite emails** (Supabase admin invite API + Brevo) to create/onboard a new user by role.
- Still MISSING from before: superficie>80m² routing rule exposed as a preset, inbound-call→commercial-by-activity, premium/client-premium finalisation, Withallo/Wildix telephony, premium UI polish.

**Routing & rôles commerciaux:**
- Envoi des leads par filtre **superficie > 80 m²** (routing rule on surface — `lib/routing.ts` already supports a surface condition).
- **Commercial premium → client premium** (premium round-robin exists in `resolveOwner`; needs the "client premium" flag/definition finalised).
- **Appel entrant par activité → commercial entrant de cette activité** (route inbound calls by activity to the on-duty commercial).
- "**Commercial extrême**" — term used by client, meaning UNCONFIRMED (a third tier above premium?). Must clarify before building.
- **Commerciaux spécial Débarras** — dedicated commercials for the Débarras sector.

**Secteur Débarras (NEW):** `Sector` is currently a hardcoded TS union (`urgence|nettoyage|enr|renovation`) in `lib/leads.ts` + token colors + VAT/acompte maps + FALLBACK_PRESTATIONS. Adding Débarras touches all of these OR requires making sectors data-driven (sectors CRUD is currently MISSING in Settings). Need its acompte %, TVA, fourchette €, couleur. Then: filter all **clients débarras / devis débarras / CA débarras** (mostly falls out of existing filters once the sector exists).

**Intervenants géolocalisés (NEW):** technician assigned to the geographic sector nearest the client, **rayon 100 km**, with a search that widens the radius if none found. Needs a geo strategy (geocoding API vs. postal-code/département proximity vs. manual zones per technician).

**Multi-société / processus parallèles (NEW, big):**
- **4 lignes de processus** possibles + possibilité d'ajouter des sociétés supplémentaires (legal_entities CRUD already exists).
- Pour un **même client**, envoyer **plusieurs devis de différentes sociétés** et suivre chaque processus indépendamment.
- Ajouter au processus un état **REFUS** avec **motif + prix visible**, pour renvoyer un autre devis à **prix inférieur**. (`documents.refusal_reason` + `markDocumentRefused` already exist; the parallel-process tracking + visible-price re-quote flow is new.)
- **Menu des sociétés** dans l'UI.

**Comms & accès:**
- **Préparation mails pro** avec authentification vers accès CRM selon le rôle (= gestion/invitation utilisateurs — user CRUD currently MISSING).
- **Ringover** téléphonie API ↔ CRM (already DONE, fake-mode until creds).
- **Planificatrice → email de confirmation passage technicien — DONE (verified 2026-07-08).** Fully built and wired: `sendInterventionConfirmation` action (Brevo + audit `dossier.confirmation_email`), `ConfirmInterventionModal` (prefills recipient/date/technician/duration in FR), gated button "Envoyer confirmation client" on `status='planifie' && lead.email && plannedAt`.

**NRP — DONE (verified 2026-07-08).** `setLeadNrp` toggle action (+ audit `lead.nrp.set`), "Marquer/Retirer NRP" button in lead detail (`LeadActions`), "NRP uniquement" filter chip in `LeadsTable` (RLS scopes to the commercial's own leads → retrieval of all their NRP works). Possible future polish only: URL-addressable `?nrp=1` deep-link / a "mes relances" shortcut.

**UI:** front design **très professionnel et premium**, "mieux que les exemples" — full visual polish pass across the app.

**Why:** these are direct client asks that define "done" for the CRM; several are net-new data-model work (Débarras sector, geo assignment, multi-société parallel quotes with refusal+re-quote), others finish partial features.

**How to apply:** confirm the four blocking unknowns before building — Débarras (new sector vs tag + its business values), geo method, multi-société process model, and "Commercial extrême" definition. Sequence after the doc_lines fix (done 2026-07-08). Spec PDF stays authoritative where it overlaps.
