-- Bibliothèque de devis Déménagement — 2. Professionnel / partiel.
-- « Déménagement partiel d'un atelier ». À chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Déménagement partiel d''un atelier', 'forfait', 0, 20, $D$Prestation à réaliser :
Réalisation d'un déménagement professionnel partiel d'un atelier comprenant la manutention, le chargement, le transport sécurisé et le déchargement des machines, de l'outillage, des établis, des équipements professionnels, des stocks, des fournitures et des autres biens expressément désignés par le client vers le nouveau site.

Prestations incluses :
- Manutention des biens professionnels sélectionnés pour le déménagement.
- Protection des machines, de l'outillage, des équipements et du mobilier durant les opérations de manutention et de transport.
- Chargement organisé des machines, des établis, des rayonnages, des équipements, des fournitures et des biens concernés par la prestation.
- Transport sécurisé jusqu'au nouveau site.
- Déchargement de l'ensemble des biens transportés.
- Mise en place des équipements et du mobilier dans les espaces indiqués par le client.
- Utilisation de matériel professionnel et de moyens de manutention adaptés aux charges lourdes et aux équipements spécifiques.

Conditions d'intervention :
Le devis est établi sur la base de la liste des biens communiquée par le client, du volume estimatif à transporter, de la nature des machines et des équipements, des conditions d'accès aux sites de départ et d'arrivée, des possibilités de stationnement, des distances de portage ainsi que de toute contrainte technique particulière.
La présente prestation concerne exclusivement les biens identifiés lors de l'établissement du devis. Les opérations de démontage technique des machines, de déconnexion, de reconnexion, de calibration ou de remise en service ne sont pas incluses, sauf mention expresse figurant au devis.
Toute modification de la liste des biens, du volume à transporter, des conditions d'intervention ou des prestations demandées après validation du devis pourra entraîner une réévaluation de la prestation après accord du client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
