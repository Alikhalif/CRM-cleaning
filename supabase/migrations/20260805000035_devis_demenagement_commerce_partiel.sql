-- Bibliothèque de devis Déménagement — 2. Professionnel / partiel.
-- « Déménagement partiel d'un commerce ou d'une boutique ». À chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Déménagement partiel d''un commerce ou d''une boutique', 'forfait', 0, 20, $D$Prestation à réaliser :
Réalisation d'un déménagement professionnel partiel d'un commerce ou d'une boutique comprenant la manutention, le chargement, le transport sécurisé et le déchargement du mobilier commercial, des présentoirs, des rayonnages, des marchandises, des équipements professionnels, du matériel d'encaissement et des autres biens expressément désignés par le client vers les nouveaux locaux.

Prestations incluses :
- Manutention des biens professionnels sélectionnés pour le déménagement.
- Protection du mobilier commercial, des équipements et des marchandises durant les opérations de manutention et de transport.
- Chargement organisé du mobilier, des rayonnages, des présentoirs, des marchandises et des équipements concernés par la prestation.
- Transport sécurisé jusqu'au nouveau commerce.
- Déchargement de l'ensemble des biens transportés.
- Mise en place du mobilier, des équipements et des marchandises dans les espaces indiqués par le client.
- Utilisation de matériel professionnel et de moyens de manutention adaptés aux contraintes de l'intervention.

Conditions d'intervention :
Le devis est établi sur la base de la liste des biens communiquée par le client, du volume estimatif à transporter, des conditions d'accès aux locaux de départ et d'arrivée, des possibilités de stationnement, des distances de portage ainsi que de toute contrainte technique particulière.
La présente prestation concerne exclusivement les biens identifiés lors de l'établissement du devis. Toute modification de la liste des biens, du volume à transporter, des conditions d'intervention ou des prestations demandées après validation du devis pourra entraîner une réévaluation de la prestation après accord du client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
