-- Bibliothèque de devis (client 2026-08-05) : les prestations du catalogue
-- peuvent porter une DESCRIPTION détaillée (prestations comprises / conditions).
-- Au choix d'un service dans l'éditeur de devis, cette description se pré-remplit
-- dans les notes du devis. Colonne optionnelle, sans impact sur l'existant.
alter table prestations add column if not exists description text;

-- Remplacement de la biblio déménagement : on DÉSACTIVE les 5 prestations
-- génériques historiques (elles restent en base pour ne pas casser d'anciens
-- devis, mais disparaissent du sélecteur). La nouvelle bibliothèque est ajoutée
-- ensuite, service par service.
update prestations p
  set is_active = false
from activities a
where p.activity_id = a.id
  and a.slug = 'demenagement'
  and p.label in (
    'Déménagement studio / T2 (forfait)',
    'Déménagement T3 / T4 (forfait)',
    'Emballage et fourniture cartons',
    'Location monte-meubles',
    'Main d''œuvre déménageur'
  );
