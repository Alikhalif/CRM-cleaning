-- Module Superviseur · LOT 1 — périmètre FERMÉ PAR DÉFAUT (« Option A »,
-- validation client du 2026-11-05).
--
-- ⚠️ CETTE MIGRATION INVERSE UNE SÉMANTIQUE.
--
-- 20261015000002 documentait : « listes VIDES = aucune restriction sur cet
-- axe. Un superviseur dont les trois listes sont vides voit tout ». Le client
-- a tranché l'inverse, mot pour mot : « Une absence de configuration signifie
-- zéro accès, jamais un accès global. »
--
-- Conséquence à connaître avant de pousser : un superviseur déjà créé dont le
-- périmètre est vide PERD l'accès au cockpit jusqu'à ce que le Super Admin le
-- configure (/settings/superviseurs). C'est le comportement demandé. Aucune
-- donnée n'est modifiée ni supprimée par cette migration : on ne « rattrape »
-- pas les lignes existantes en leur inventant un périmètre, ce qui serait
-- précisément l'autorisation implicite que le client refuse.
--
-- Le Super Admin, lui, conserve son accès global : il ne passe pas par cette
-- table (voir `getPerimetreSuperviseur()` dans
-- lib/supervision-perimetre-server.ts).

-- ── 1. Les quatre droits d'intervention (§6 de la validation) ─────────
--
-- `can_intervene` existait déjà et portait deux sens à la fois (consulter /
-- ouvrir un dossier). On le GARDE — il est lu par le code en production — et
-- il signifie désormais exactement une chose : ouvrir les dossiers de son
-- périmètre. Les trois autres droits sont nouveaux et fermés par défaut.

alter table supervisor_scopes
  add column if not exists can_request_action boolean not null default false,
  add column if not exists can_reassign      boolean not null default false,
  add column if not exists can_set_priority  boolean not null default false;

comment on column supervisor_scopes.can_intervene is
  'Droit d''intervention : ouvrir les dossiers de son périmètre (lecture de la fiche complète). Sans ce droit, le superviseur n''a que les indicateurs et les alertes.';
comment on column supervisor_scopes.can_request_action is
  'Droit d''intervention : demander une action au commercial. La demande est tracée ; le superviseur n''agit jamais à la place du commercial.';
comment on column supervisor_scopes.can_reassign is
  'Droit d''intervention : réaffecter un lead de son périmètre à un autre commercial de son périmètre.';
comment on column supervisor_scopes.can_set_priority is
  'Droit d''intervention : marquer un dossier de son périmètre comme prioritaire.';

-- ── 2. Les leads NON ATTRIBUÉS sont une autorisation à part ───────────
--
-- Un lead sans commercial ne relève d'aucun commercial : aucune liste de
-- `owner_ids` ne peut le couvrir. Or c'est exactement le dossier qu'il faut
-- surveiller (« aucun lead oublié »). D'où un drapeau explicite, fermé par
-- défaut comme tout le reste.

alter table supervisor_scopes
  add column if not exists include_unassigned boolean not null default false;

comment on column supervisor_scopes.include_unassigned is
  'Autorise ce superviseur à voir les leads SANS commercial attribué (file « À affecter »). Fermé par défaut : aucun owner_id ne peut couvrir un lead non attribué.';

-- ── 3. Intégrité du périmètre pays ───────────────────────────────────
--
-- Cinq pays d'opération (CDC §6/§9 + validation client §1). La contrainte
-- empêche qu'une faute de frappe crée un pays fantôme qui n'autoriserait rien
-- et serait invisible à la relecture.
--
-- NOT VALID : la contrainte s'applique aux écritures FUTURES sans faire
-- échouer la migration sur une ligne historique mal formée. Elle pourra être
-- validée (`validate constraint`) une fois les lignes existantes vérifiées.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'supervisor_scopes_countries_connus'
  ) then
    alter table supervisor_scopes
      add constraint supervisor_scopes_countries_connus
      check (countries <@ array['FR','CH','LU','BE','CA']::text[])
      not valid;
  end if;
end $$;

-- ── 4. La sémantique, écrite là où on la lira ─────────────────────────

comment on table supervisor_scopes is
  'Périmètre d''un superviseur commercial : pays, activités, commerciaux, droits d''intervention. '
  '⚠️ FERMÉ PAR DÉFAUT (décision client 2026-11-05) : une liste VIDE = AUCUN accès sur cet axe, '
  'jamais « tout ». Les trois axes se cumulent — un seul axe vide suffit à ne rien laisser passer. '
  'Le Super Admin ne passe pas par cette table (accès global). '
  'Appliqué CÔTÉ SERVEUR : lib/supervision-perimetre.ts (règles) + lib/supervision-server.ts (filtrage).';

comment on column supervisor_scopes.countries is
  'Pays autorisés (FR/CH/LU/BE/CA). VIDE = aucun pays autorisé, donc aucun dossier visible.';
comment on column supervisor_scopes.activity_ids is
  'Activités autorisées, parmi les deux familles supervisées (nettoyage · déménagement/débarras/transport). VIDE = aucune activité autorisée. Les activités hors familles (dépannage, ENR, rénovation, TCE) sont exclues du module pour tout le monde, même listées ici.';
comment on column supervisor_scopes.owner_ids is
  'Commerciaux supervisés. VIDE = aucun commercial supervisé (seuls les leads non attribués restent possibles, et seulement si include_unassigned est vrai).';

-- ── 5. RLS — inchangée, et c'est volontaire ──────────────────────────
--
-- Les deux politiques de 20261015000002 répondent déjà au besoin :
--   • le titulaire (ou l'admin) LIT le périmètre ;
--   • seul l'admin l'ÉCRIT — un superviseur ne peut pas élargir le sien.
--
-- Rien n'est ajouté ici : la table `leads` ne donne AUCUN accès au rôle
-- superviseur (politique « leads visible to owner / admin / planner »), donc
-- la lecture agrégée passe par le service-role, où le périmètre est appliqué
-- explicitement dans le code. Ajouter une politique RLS « superviseur » sur
-- `leads` serait une autorisation globale — exactement ce que l'Option A
-- interdit.
