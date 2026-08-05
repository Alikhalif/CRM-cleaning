-- Bibliothèque de devis Déménagement — 1. Particulier / partiel.
-- « Déménagement partiel urgent ». À chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Déménagement partiel urgent', 'forfait', 0, 20, $D$Prestation à réaliser :
Réalisation d'un déménagement particulier partiel en urgence comprenant la manutention, le chargement, le transport sécurisé et le déchargement des biens, du mobilier, de l'électroménager et des effets personnels expressément désignés par le client vers la nouvelle adresse.

Prestations incluses :
- Organisation prioritaire de l'intervention selon les disponibilités des équipes.
- Manutention des biens sélectionnés pour le déménagement.
- Protection du mobilier et des équipements durant les opérations de manutention et de transport.
- Chargement organisé des biens concernés par la prestation.
- Transport sécurisé jusqu'au lieu de destination.
- Déchargement de l'ensemble des biens transportés.
- Mise en place des biens dans les pièces indiquées par le client.
- Utilisation de matériel professionnel adapté afin d'assurer une intervention rapide et sécurisée.

Conditions d'intervention :
Le devis est établi sur la base de la liste des biens communiquée par le client, du volume estimatif à transporter, des conditions d'accès, des possibilités de stationnement, des distances de portage ainsi que du délai d'intervention souhaité.
La planification de la prestation est réalisée sous réserve de la disponibilité des équipes et des moyens techniques nécessaires. Toute modification des biens à transporter, des conditions d'intervention ou des informations communiquées lors de l'établissement du devis pourra entraîner une réévaluation de la prestation après validation avec le client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
