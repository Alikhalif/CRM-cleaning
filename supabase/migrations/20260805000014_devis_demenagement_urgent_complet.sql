-- Bibliothèque de devis Déménagement — 1. Particulier / complet.
-- « Déménagement complet urgent ». À chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Déménagement complet urgent', 'forfait', 0, 20, $D$Prestation à réaliser :
Réalisation d'un déménagement particulier complet en urgence, comprenant la planification prioritaire de l'intervention, la manutention, le chargement, le transport sécurisé, le déchargement ainsi que la mise en place de l'ensemble du mobilier, des effets personnels, des cartons et de l'électroménager vers la nouvelle adresse.

Prestations incluses :
- Organisation prioritaire de l'intervention selon les disponibilités des équipes.
- Manutention complète de l'ensemble des biens à déménager.
- Protection du mobilier et des équipements durant les opérations de transport.
- Chargement organisé du véhicule de déménagement.
- Transport sécurisé jusqu'au lieu de destination.
- Déchargement de l'ensemble des biens.
- Mise en place du mobilier et des cartons dans les pièces indiquées par le client.
- Utilisation de matériel professionnel adapté afin d'assurer une intervention rapide et sécurisée.

Conditions d'intervention :
Le devis est établi sur la base des informations communiquées par le client concernant le volume à déménager, les conditions d'accès, les possibilités de stationnement, les distances de portage ainsi que le délai d'intervention souhaité.
La planification de la prestation est réalisée sous réserve de la disponibilité des équipes et des moyens techniques nécessaires. Toute modification des conditions d'intervention, du volume à transporter ou des informations communiquées lors de l'établissement du devis pourra entraîner une réévaluation de la prestation après validation avec le client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
