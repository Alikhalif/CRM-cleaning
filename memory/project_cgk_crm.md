---
name: CGK CRM project context
description: Core scope, stack, and roadmap for the CGK CRM build (cahier des charges v2.0)
type: project
---

CGK CRM — internal commercial CRM for a French SME (B2B/B2C services). Replaces spreadsheets/email with a unified pipeline: lead capture → quote → e-signature → deposit invoice → planning → final invoice → cash-in. Multi-entité juridique, 4 sectors (Dépannage, Nettoyage, ENR, Rénovation).

**Stack chosen by user (2026-05-09):** Next.js 16.2.6 + React 19.2.4 (App Router, TypeScript) + SCSS. Recommended back: Supabase (Postgres + Auth + Storage + Realtime + RLS). External: n8n (orchestration), Brevo (email), Yousign/DocuSign (eIDAS signature), Google Ads Enhanced Conversions.

**Roles:** Super Admin · Commercial (RLS `mine` only) · Planificateur · Assistant (phase 2). Multi-role with view switcher + read-only preview. Granular `immobTravaux` permission for confidential annotation.

**Pipeline:** 6 columns — Lead entrant → Devis envoyé → Devis ouvert → Signé → Encaissé (+ Perdu). Mandatory sub-statuses: Mano/Auto (send channel), Sans/Avec acompte (signature). "Canal manquant" red badge if missing.

**Roadmap:** Phase 1 MVP (~8w: data model + RLS + auth + Dashboard/Pipeline/Leads + basic devis + signature + n8n flows). Phase 2 (~6w: Comptabilité full, Clients, multi-entity, planning, immobTravaux, Google Ads sync). Phase 3 (~4w: audit, MFA, monitoring).

**Why:** Drives all architectural decisions — RLS is non-negotiable (data isolation at DB level, never UI-only); document numbering DEV/FA/FAC-YYYY-#### must be sequential per French law; IBAN + immobTravaux annotation must be application-encrypted (AES-GCM) on top of RLS; PDFs in private bucket with signed URLs (60min TTL).

**How to apply:** When implementing any feature, check the cahier des charges (Cahier-des-charges-CGK-CRM.pdf at repo root) for exact behavior. Don't invent flows — the spec is authoritative. Sub-statuses, sector defaults (acompte %, TVA), and role matrix are fixed values, not configurable opinions.
