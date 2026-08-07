-- Bibliothèque de devis Déménagement — 2. Professionnel / partiel.
-- « Déménagement partiel d'un entrepôt ». À chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Déménagement partiel d''un entrepôt', 'forfait', 0, 20, $D$Prestation à réaliser :
Réalisation d'un déménagement professionnel partiel d'un entrepôt comprenant la manutention, le chargement, le transport sécurisé et le déchargement des marchandises, des rayonnages, des équipements logistiques, du mobilier, du matériel professionnel et des autres biens expressément désignés par le client vers le nouveau site.

Prestations incluses :
- Manutention des biens professionnels sélectionnés pour le déménagement.
- Protection des marchandises, des rayonnages, du mobilier et des équipements durant les opérations de manutention et de transport.
- Chargement organisé des marchandises, des équipements logistiques, des rayonnages et des biens concernés par la prestation.
- Transport sécurisé jusqu'au nouveau site.
- Déchargement de l'ensemble des biens transportés.
- Mise en place des équipements et des marchandises dans les espaces indiqués par le client.
- Utilisation de matériel professionnel et de moyens de manutention adaptés aux charges, aux volumes et aux contraintes logistiques.

Conditions d'intervention :
Le devis est établi sur la base de la liste des biens communiquée par le client, du volume estimatif à transporter, des conditions d'accès aux sites de départ et d'arrivée, des possibilités de stationnement, des distances de portage ainsi que de toute contrainte technique particulière.
La présente prestation concerne exclusivement les biens identifiés lors de l'établissement du devis. Toute modification de la liste des biens, du volume à transporter, des conditions d'intervention ou des prestations demandées après validation du devis pourra entraîner une réévaluation de la prestation après accord du client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
