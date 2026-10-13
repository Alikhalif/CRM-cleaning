-- Place « Mail devis — virement avec acompte (Déménagement) » en 2e position
-- du groupe DÉMÉNAGEMENT, juste après « Mail devis — virement (Déménagement)
-- 100% » (demande client 2026-10-12). Il était 13e, donc dernier.
--
-- Le sélecteur trie chaque groupe par (sort_order, nom). sort_order = 0 le met
-- dans la même tranche que les deux autres « Mail devis — … », et le tri par
-- nom l'intercale entre « … virement (Déménagement) 100% » et « Mail devis
-- urgent — … » : exactement la 2e place demandée.
--
-- Pas de renumérotation des autres modèles : une seule ligne bouge.
--
-- Idempotent.

update message_templates
   set sort_order = 0
 where name = 'Mail devis — virement avec acompte (Déménagement)';
