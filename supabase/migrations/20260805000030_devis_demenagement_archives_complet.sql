-- Bibliothèque de devis Déménagement — 2. Professionnel / complet.
-- « Déménagement complet d'archives et de matériel professionnel ». À chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Déménagement complet d''archives et de matériel professionnel', 'forfait', 0, 20, $D$Prestation à réaliser :
Réalisation d'un déménagement professionnel complet d'archives et de matériel professionnel comprenant la manutention, le chargement, le transport sécurisé et le déchargement des archives, documents, dossiers, équipements professionnels, matériel informatique, fournitures, mobilier associé et autres biens nécessaires au fonctionnement de l'activité vers le nouveau site.

Prestations incluses :
- Manutention complète des archives, documents et équipements professionnels.
- Protection des archives, du matériel et du mobilier durant les opérations de manutention et de transport.
- Chargement organisé des archives, des équipements, du mobilier et des fournitures.
- Transport sécurisé jusqu'au lieu de destination.
- Déchargement de l'ensemble des biens transportés.
- Mise en place des archives, du mobilier et des équipements selon les indications du client.
- Utilisation de matériel professionnel adapté afin de garantir un transport sécurisé des biens et documents.

Conditions d'intervention :
Le devis est établi sur la base des informations communiquées par le client concernant le volume à transporter, la nature des archives et des équipements, les conditions d'accès aux sites de départ et d'arrivée, les possibilités de stationnement, les distances de portage ainsi que toute contrainte technique particulière.
La présente prestation concerne exclusivement le transfert des archives et du matériel professionnel. Les opérations de classement, d'indexation, de numérisation, de destruction d'archives, de reconnexion des équipements informatiques ou toute autre intervention spécialisée ne sont pas incluses, sauf mention expresse figurant au devis.
Toute modification du volume, des conditions d'intervention, des équipements concernés ou des prestations demandées après validation du devis pourra entraîner une réévaluation de la prestation après accord du client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
