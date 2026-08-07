-- Bibliothèque de devis Déménagement — 2. Professionnel / partiel.
-- « Déménagement professionnel partiel urgent ». À chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Déménagement professionnel partiel urgent', 'forfait', 0, 20, $D$Prestation à réaliser :
Réalisation d'un déménagement professionnel partiel en urgence comprenant l'organisation prioritaire de l'intervention, la manutention, le chargement, le transport sécurisé et le déchargement du mobilier, des équipements, du matériel professionnel, des archives, des stocks et des autres biens expressément désignés par le client vers le nouveau site.

Prestations incluses :
- Organisation prioritaire de l'intervention selon les disponibilités des équipes.
- Manutention des biens professionnels sélectionnés pour le déménagement.
- Protection du mobilier, des équipements et du matériel durant les opérations de manutention et de transport.
- Chargement organisé des biens concernés par la prestation.
- Transport sécurisé jusqu'au lieu de destination.
- Déchargement de l'ensemble des biens transportés.
- Mise en place du mobilier et des équipements dans les espaces indiqués par le client.
- Utilisation de matériel professionnel et de moyens de manutention adaptés afin d'assurer une intervention rapide, efficace et sécurisée.

Conditions d'intervention :
Le devis est établi sur la base de la liste des biens communiquée par le client, du volume estimatif à transporter, des conditions d'accès aux sites de départ et d'arrivée, des possibilités de stationnement, des distances de portage, des contraintes techniques ainsi que du délai d'intervention souhaité.
La planification de la prestation est réalisée sous réserve de la disponibilité des équipes, des véhicules et des moyens techniques nécessaires. Toute modification de la liste des biens, du volume à transporter, des conditions d'intervention ou des prestations demandées après validation du devis pourra entraîner une réévaluation de la prestation après accord du client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
