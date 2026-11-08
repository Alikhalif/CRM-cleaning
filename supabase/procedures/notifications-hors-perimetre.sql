-- ============================================================================
-- PROCÉDURE — notifications DÉJÀ ENREGISTRÉES visibles hors périmètre (D31)
--
-- Demande du client du 2026-11-09 : « prépare une procédure sécurisée pour
-- traiter celles qui seraient visibles hors périmètre, sans suppression non
-- autorisée. »
--
-- ⚠️ Pas une migration (hors de `supabase/migrations/`) : aucun `db push` ne
-- la joue. Elle s'exécute À LA MAIN, dans l'éditeur SQL, APRÈS la migration
-- 20261109000007 — sur la recette d'abord ; sur la production, avec
-- l'autorisation explicite du client.
--
-- ── CE QU'ELLE FAIT, ET CE QU'ELLE NE FAIT JAMAIS ────────────────────────
--
--   · ÉTAPE 1 (lecture seule) : compte, par type et par destinataire, les
--     notifications du back-office qu'une planificatrice voit hors de son
--     périmètre. Rien n'est écrit.
--   · ÉTAPE 2 : POSE la portée (`pays`, `entite_id`) des notifications
--     back-office qui n'en ont pas. Dès lors, la RLS de …07 les MASQUE à qui
--     n'y a pas droit. AUCUNE ligne n'est supprimée, aucun texte modifié :
--     la notification reste en base, intacte, et redevient visible si le
--     périmètre de la personne s'élargit.
--   · Elle se termine par ROLLBACK. Ne remplacez par COMMIT qu'après avoir
--     relu les comptes de l'étape 2.
-- ============================================================================

-- ── Résolution de la portée d'une notification, selon ce qu'elle désigne ──
-- (même logique que lib/notifications/perimetre-server.ts)
create temp view _portee as
select n.id, n.user_id, n.kind, n.entity_type,
       coalesce(l1.country, l2.country, l3.country, l4.country, l5.country)        as pays,
       coalesce(l1.entity_id, d2.entity_id, l3.entity_id, l4.entity_id, se.entity_id) as entite_id
  from notifications n
  left join leads l1      on n.entity_type = 'lead'     and l1.id = n.entity_id
  left join documents d2  on n.entity_type = 'document' and d2.id = n.entity_id
  left join leads l2      on l2.id = d2.lead_id
  left join dossiers x3   on n.entity_type = 'dossier'  and x3.id = n.entity_id
  left join leads l3      on l3.id = x3.lead_id
  -- `contract.expiring` est enregistré avec entity_type = 'client' et l'id du CONTRAT.
  left join contracts c4  on n.entity_type in ('client', 'contract') and c4.id = n.entity_id
  left join clients k4    on k4.id = c4.client_id
  left join leads l4      on l4.id = k4.source_lead_id
  left join subcontract_contracts s5 on n.entity_type = 'subcontract_contract' and s5.id = n.entity_id
  left join dossiers x5   on x5.id = s5.dossier_id
  left join leads l5      on l5.id = x5.lead_id
  left join docusign_envelopes se on se.contract_id = s5.id
 where n.kind in ('quote.signed', 'email.reply', 'contract.expiring', 'contract.link.renewed',
                  'soustraitance.contrat_signe')
    or n.kind like 'action.%';

-- ═══ ÉTAPE 1 — INVENTAIRE, LECTURE SEULE ═════════════════════════════════
begin transaction read only;

select p.kind,
       count(*)                                                    as notifications_backoffice,
       count(*) filter (where not notification_dans_perimetre(p.user_id, p.pays, p.entite_id)) as hors_perimetre,
       count(*) filter (where p.pays is null)                      as pays_introuvable
  from _portee p
 group by p.kind order by hors_perimetre desc;

-- Le détail par destinataire (adresse, pas le contenu des notifications).
select u.email, p.kind, count(*) as hors_perimetre
  from _portee p join users u on u.id = p.user_id
 where not notification_dans_perimetre(p.user_id, p.pays, p.entite_id)
 group by u.email, p.kind order by 3 desc;

commit;  -- transaction en lecture seule : rien n'a été écrit.

-- ═══ ÉTAPE 2 — POSER LA PORTÉE (masque, ne supprime rien) ════════════════
begin;

-- Avant : combien de notifications back-office sans portée.
select count(*) as sans_portee_avant
  from notifications n join _portee p on p.id = n.id
 where n.pays is null and p.pays is not null;

-- Seules DEUX colonnes sont écrites ; uniquement là où elles sont vides.
-- Les triggers de …07 l'autorisent : l'éditeur SQL n'a pas d'`auth.uid()`.
update notifications n
   set pays = p.pays, entite_id = p.entite_id
  from _portee p
 where p.id = n.id
   and n.pays is null
   and p.pays is not null;

-- Après : ce que chaque destinataire ne verra plus (et qui reste en base).
select p.kind, count(*) as desormais_masquees
  from _portee p join notifications n on n.id = p.id
 where not notification_dans_perimetre(n.user_id, n.pays, n.entite_id)
 group by p.kind;

select count(*) as total_notifications_inchange from notifications;  -- doit égaler le total d'avant

-- ⚠️ Relisez les comptes ci-dessus. Puis, et seulement alors, remplacez la
-- ligne suivante par COMMIT.
rollback;

drop view if exists _portee;
