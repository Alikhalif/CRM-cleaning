-- Renommage du secteur « Urgence / Dépannage urgence » → « Dépannage »
-- (client 2026-08-03). Le slug reste 'urgence' (identifiant stable) ; seul le
-- libellé d'affichage change.
update activities set label = 'Dépannage' where slug = 'urgence';
