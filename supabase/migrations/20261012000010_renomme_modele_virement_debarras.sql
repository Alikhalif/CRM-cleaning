-- Renommage du modèle e-mail « Mail devis — virement (Débarras) » en
-- « Mail devis — virement (Débarras) 100% » (demande client 2026-10-12), pour
-- que le nom dise explicitement ce que fait son corps : le client règle la
-- TOTALITÉ par virement, sans acompte.
--
-- Seul le libellé change dans le sélecteur de la page Devis. Objet, corps et
-- variable {devis.numero} sont inchangés.

update message_templates
   set name = 'Mail devis — virement (Débarras) 100%'
 where name = 'Mail devis — virement (Débarras)';
