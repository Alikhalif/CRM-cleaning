-- Bibliothèque de devis Déménagement — 1. Particulier / partiel.
-- « Déménagement partiel longue distance ». À chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Déménagement partiel longue distance', 'forfait', 0, 20, $D$Prestation à réaliser :
Réalisation d'un déménagement particulier partiel sur longue distance comprenant la manutention, le chargement, le transport sécurisé et le déchargement des biens, du mobilier, de l'électroménager et des effets personnels expressément désignés par le client vers la nouvelle adresse.

Prestations incluses :
- Manutention des biens sélectionnés pour le déménagement.
- Protection du mobilier et des équipements durant les opérations de manutention et de transport.
- Chargement organisé des biens dans le véhicule de déménagement.
- Transport sécurisé sur longue distance jusqu'au lieu de destination.
- Déchargement de l'ensemble des biens transportés.
- Mise en place des biens dans les pièces indiquées par le client.
- Utilisation de matériel professionnel et de véhicules adaptés au volume transporté.

Conditions d'intervention :
Le devis est établi sur la base de la liste des biens communiquée par le client, du volume estimatif à transporter, de la distance entre les deux adresses, des conditions d'accès, des possibilités de stationnement, des distances de portage ainsi que de toute contrainte technique particulière.
La prestation concerne exclusivement les biens mentionnés lors de l'établissement du devis. Toute modification de la liste des biens, du volume, des lieux d'intervention ou des conditions d'accès pourra entraîner une réévaluation de la prestation après validation avec le client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
