---
name: CDC évolutions multi-société/multi-pays (2026-07-25)
description: Roadmap "Cahier des charges fonctionnel – Évolutions CRM CGK" (multi-société, multi-pays, profils commerciaux, routage, recherche, perf) — les 6 lots livrés
metadata:
  type: project
---

Le client a fourni un **Cahier des charges fonctionnel « Évolutions CRM CGK »** (multi-société + multi-pays). Livré en 6 lots, tous commités sur `main` et déployés sur Vercel (`crm-cleaning-one.vercel.app`). Base Supabase `ggdafbqahvugmzixovik`. See [[CGK CRM feature backlog (call 2026-06-10)]].

**Lot 0** — Secteur **Diogène** (7ᵉ, migration `20260725000001`) + **dimension Pays** FR/CH/LU/BE (`leads.country`, `users.countries`, `countryFromPhone`, migration `…000002`). Détection auto par indicatif.

**Lot 1** — **Landing pages registry** (`landing_pages` table, migration `…000003`) : token → pays/société/secteur/source. WF1 résout le token et le lead **hérite** (priorité LP > formulaire > indicatif). `leads.entity_id` + `leads.landing_page_id`. CRUD admin `/settings/landing-pages`. WF1.json/local forwardent `lp`.

**Lot 2** — **Profils commerciaux** (`users.commercial_profiles`, migration `…000004` : appel_entrant, nettoyage, debarras_demenagement, diogene, performant, en_attente) + couverture pays. **Moteur de routage** `resolveByProfile` (secteur+urgence+surface→profil, contrôle pays, round-robin, overflow en_attente) en fallback des `routing_rules`. Seuil surface Performant configurable (`app_settings.performant_surface_threshold`, défaut 100, réglable dans /settings/routing). RoutingInput gagne isUrgent + country.

**Lot 3** — **Leads à affecter** : WF1 laisse `owner_id` null si aucun commercial éligible (plus de fallback admin). Vue admin `/a-affecter` + attribution en masse (`assignLeadsBulk`).

**Lot 4** — **Planification par pays** : un planificateur non-admin ne voit que les interventions de ses pays (`users.countries`) ; filtre pays dans la Planification.

**Lot 5** — **Recherche globale** `/recherche` (tel/nom/email/ville via jsonb/n° doc, RLS-scoped) + filtres avancés Leads (secteur, urgent, surface>100). `Lead.surfaceM2` exposé.

**Lot 6** — **Performance commerciale** `/performance` : KPIs par commercial (reçus/traités/signés/conversion/urgents/>100m²/CA), filtres période+société+pays+secteur+commercial, export CSV Excel-compatible.

**Sociétés à saisir** (Paramètres → Sociétés émettrices) : NP, Extra.net, NPS, Optimiv. **« Paie » = « Pays »** dans les notes du client.

**Why:** ces évolutions transforment le CRM mono-société en plateforme multi-société/multi-pays avec routage par profil. Toutes additives (aucune régression : formulaires sans token, leads sans pays, users sans profil → fallback conservé).

**How to apply / config restante (pas du dev) :**
1. Saisir les 4 sociétés (Paramètres → Sociétés).
2. Cocher **Profils + Pays** de chaque commercial (Paramètres → Utilisateurs) — sinon les pools sont vides et le lead retombe non-attribué.
3. Configurer les **Landing Pages** (token → pays/société/secteur) et réimporter `n8n/WF1.local.json` (forwarde `lp`).
4. Décisions différées (défauts recommandés retenus) : urgence→flag et masquage ENR/Rénovation non faits (restés additifs) ; export xlsx natif = CSV pour l'instant (option A).
