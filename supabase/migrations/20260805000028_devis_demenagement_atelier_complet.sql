-- Bibliothèque de devis Déménagement — 2. Professionnel / complet.
-- « Déménagement complet d'un atelier ». À chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Déménagement complet d''un atelier', 'forfait', 0, 20, $D$Prestation à réaliser :
Réalisation d'un déménagement professionnel complet d'un atelier comprenant la manutention, le chargement, le transport sécurisé et le déchargement de l'ensemble du mobilier, des machines, de l'outillage, des équipements professionnels, des stocks, des fournitures et des autres biens nécessaires à l'activité vers le nouveau site.

Prestations incluses :
- Manutention complète de l'ensemble des biens professionnels.
- Protection des machines, de l'outillage, des équipements et du mobilier durant les opérations de déménagement.
- Chargement organisé des équipements, des machines, des établis, des rayonnages, des fournitures et des stocks.
- Transport sécurisé jusqu'au nouveau site.
- Déchargement de l'ensemble des biens transportés.
- Mise en place des équipements et du mobilier dans les espaces indiqués par le client.
- Utilisation de matériel professionnel et de moyens de manutention adaptés aux charges lourdes et aux équipements spécifiques.

Conditions d'intervention :
Le devis est établi sur la base des informations communiquées par le client concernant le volume à déménager, la nature des machines et des équipements, les conditions d'accès aux sites de départ et d'arrivée, les possibilités de stationnement, les distances de portage ainsi que toute contrainte technique particulière.
La présente prestation concerne exclusivement le transfert des biens professionnels. Les opérations de démontage technique des machines, de déconnexion, de reconnexion, de calibration, de remise en service ou toute intervention spécialisée ne sont pas incluses, sauf mention expresse figurant au devis.
Toute modification des conditions d'intervention, du volume à transporter, des équipements concernés ou des prestations demandées après validation du devis pourra entraîner une réévaluation de la prestation après accord du client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
