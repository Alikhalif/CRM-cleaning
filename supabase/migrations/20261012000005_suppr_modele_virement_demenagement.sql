-- Suppression du modèle e-mail « Mail devis — virement (Déménagement) »
-- (demande client 2026-10-12). Il faisait doublon avec « Mail devis urgent —
-- 100 % prépaiement (Déménagement) », qui demande lui aussi le règlement
-- intégral avant intervention.
--
-- La suppression vise les DEUX libellés : l'original tel que semé par
-- 20260807000022, et celui issu du renommage de 20261012000001. Elle fonctionne
-- donc que cette migration de renommage ait été appliquée ou non.
--
-- La migration de renommage est conservée dans l'historique : on ne réécrit pas
-- des migrations susceptibles d'avoir déjà été appliquées ailleurs.

delete from message_templates
 where name in (
   'Mail devis — virement (Déménagement)',
   'Mail devis — virement (Déménagement) 100% prépaiement'
 );
