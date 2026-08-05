-- Bibliothèque de devis Déménagement — 2. Professionnel / complet.
-- « Déménagement professionnel complet urgent ». À chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Déménagement professionnel complet urgent', 'forfait', 0, 20, $D$Prestation à réaliser :
Réalisation d'un déménagement professionnel complet en urgence comprenant l'organisation prioritaire de l'intervention, la manutention, le chargement, le transport sécurisé, le déchargement ainsi que la mise en place du mobilier, des équipements, du matériel professionnel, des archives, des stocks et des autres biens nécessaires à la poursuite de l'activité.

Prestations incluses :
- Planification prioritaire de l'intervention selon les disponibilités des équipes.
- Manutention complète de l'ensemble des biens professionnels.
- Protection du mobilier, des équipements et du matériel durant les opérations de déménagement.
- Chargement organisé des biens professionnels.
- Transport sécurisé jusqu'au nouveau site.
- Déchargement de l'ensemble des biens transportés.
- Mise en place du mobilier et des équipements dans les espaces indiqués par le client.
- Utilisation de matériel professionnel et de moyens de manutention adaptés afin d'assurer une intervention rapide, efficace et sécurisée.

Conditions d'intervention :
Le devis est établi sur la base des informations communiquées par le client concernant le volume à déménager, les conditions d'accès aux sites de départ et d'arrivée, les possibilités de stationnement, les distances de portage, les contraintes techniques ainsi que le délai d'intervention souhaité.
La planification de la prestation est réalisée sous réserve de la disponibilité des équipes, des véhicules et des moyens techniques nécessaires. Toute modification des conditions d'intervention, du volume des biens à transporter ou des prestations demandées après validation du devis pourra entraîner une réévaluation de la prestation après accord du client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
