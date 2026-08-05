-- Bibliothèque de devis Déménagement — 1. Particulier / complet.
-- « Déménagement complet longue distance ». À chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Déménagement complet longue distance', 'forfait', 0, 20, $D$Prestation à réaliser :
Réalisation d'un déménagement particulier complet sur longue distance comprenant la manutention, le chargement, le transport sécurisé entre le lieu de départ et le lieu de destination, le déchargement ainsi que la mise en place de l'ensemble du mobilier, des effets personnels, des cartons et de l'électroménager dans le nouveau logement.

Prestations incluses :
- Manutention complète de l'ensemble des biens à déménager.
- Protection du mobilier et des équipements durant les opérations de transport.
- Chargement organisé du véhicule de déménagement.
- Transport sécurisé sur longue distance dans le respect des délais convenus.
- Déchargement de l'ensemble des biens à destination.
- Mise en place du mobilier et des cartons dans les pièces désignées par le client.
- Utilisation de matériel professionnel et de véhicules adaptés au volume transporté.

Conditions d'intervention :
Le devis est établi sur la base des informations communiquées par le client concernant le volume à déménager, la distance entre les deux adresses, les conditions d'accès, les possibilités de stationnement, les distances de portage ainsi que toute contrainte technique pouvant avoir une incidence sur le bon déroulement de la prestation.
Toute modification du volume, du lieu d'intervention, des conditions d'accès ou des prestations demandées après l'établissement du devis pourra entraîner une réévaluation de la prestation après validation avec le client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
