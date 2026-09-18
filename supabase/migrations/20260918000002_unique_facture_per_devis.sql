-- Recette 2026-09-18 · Correctif A04 (P1, intégrité comptable)
--
-- La facture d'acompte (et la facture finale) est générée après un contrôle
-- « lire puis insérer » NON atomique. Deux signatures concurrentes (ex.
-- « Marquer signé » manuel + signature en ligne, ou double soumission) peuvent
-- toutes deux franchir le garde applicatif et créer DEUX factures d'acompte
-- (deux numéros FA-) pour le même devis — violation de la numérotation
-- comptable française.
--
-- On formalise en base la règle métier déjà supposée par le code
-- (document-actions.ts : « (related_devis_id, type='acompte') is effectively
-- unique ») via des index uniques partiels. Le 2e INSERT concurrent échoue
-- proprement ; le code traite désormais cette course comme un succès idempotent
-- (renvoie la facture gagnante).
--
-- Partiel : ignore les documents supprimés (soft-delete) pour permettre une
-- régénération après annulation. Additif, non destructif.
--
-- NB : si des doublons existaient déjà en base, la création d'index échouerait ;
-- au 2026-09-18 les migrations factures ne sont pas encore appliquées en prod,
-- donc aucun doublon possible.

create unique index if not exists uq_one_acompte_per_devis
  on documents (related_devis_id)
  where type = 'acompte' and deleted_at is null;

create unique index if not exists uq_one_finale_per_devis
  on documents (related_devis_id)
  where type = 'finale' and deleted_at is null;
