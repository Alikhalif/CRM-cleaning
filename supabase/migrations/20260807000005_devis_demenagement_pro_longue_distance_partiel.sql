-- Bibliothèque de devis Déménagement — 2. Professionnel / partiel.
-- « Déménagement professionnel partiel longue distance ». À chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Déménagement professionnel partiel longue distance', 'forfait', 0, 20, $D$Prestation à réaliser :
Réalisation d'un déménagement professionnel partiel sur longue distance comprenant la manutention, le chargement, le transport sécurisé entre les sites de départ et d'arrivée, le déchargement ainsi que la mise en place du mobilier, des équipements, du matériel professionnel, des archives, des stocks et des autres biens expressément désignés par le client.

Prestations incluses :
- Manutention des biens professionnels sélectionnés pour le déménagement.
- Protection du mobilier, des équipements et du matériel durant les opérations de manutention et de transport.
- Chargement organisé des biens concernés par la prestation.
- Transport sécurisé sur longue distance jusqu'au lieu de destination.
- Déchargement de l'ensemble des biens transportés.
- Mise en place du mobilier et des équipements dans les espaces indiqués par le client.
- Utilisation de matériel professionnel, de véhicules adaptés et de moyens de manutention conformes aux contraintes logistiques de l'intervention.

Conditions d'intervention :
Le devis est établi sur la base de la liste des biens communiquée par le client, du volume estimatif à transporter, de la distance entre les sites, des conditions d'accès, des possibilités de stationnement, des distances de portage ainsi que de toute contrainte technique particulière.
La présente prestation concerne exclusivement les biens identifiés lors de l'établissement du devis. Toute modification de la liste des biens, du volume à transporter, des lieux d'intervention, des conditions d'accès ou des prestations demandées après validation du devis pourra entraîner une réévaluation de la prestation après accord du client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
