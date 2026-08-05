-- Bibliothèque de devis Déménagement — 1. Particulier / partiel.
-- « Déménagement partiel d'une villa ou d'une propriété ». À chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Déménagement partiel d''une villa ou d''une propriété', 'forfait', 0, 20, $D$Prestation à réaliser :
Réalisation d'un déménagement partiel d'une villa ou d'une propriété comprenant la manutention, le chargement, le transport sécurisé et le déchargement des biens, du mobilier, de l'électroménager et des effets personnels expressément désignés par le client vers la nouvelle adresse.

Prestations incluses :
- Manutention des biens sélectionnés pour le déménagement.
- Protection du mobilier, des équipements et des objets transportés.
- Chargement organisé des biens concernés par la prestation.
- Transport sécurisé jusqu'au lieu de destination.
- Déchargement de l'ensemble des biens transportés.
- Mise en place du mobilier et des cartons dans les pièces indiquées par le client.
- Utilisation de matériel professionnel et de moyens de manutention adaptés aux grandes habitations.

Conditions d'intervention :
Le devis est établi sur la base de la liste des biens communiquée par le client, du volume estimatif à transporter, des accès aux propriétés de départ et d'arrivée, des possibilités de stationnement, des distances de portage, des dépendances concernées ainsi que de toute contrainte technique particulière.
La prestation porte exclusivement sur les biens identifiés lors de l'établissement du devis. Toute modification de la liste des biens, du volume à transporter ou des conditions d'intervention après validation du devis pourra entraîner une réévaluation de la prestation après accord du client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
