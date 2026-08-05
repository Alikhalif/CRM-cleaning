-- Bibliothèque de devis Déménagement — 2. Professionnel / complet.
-- « Déménagement complet d'un commerce ou d'une boutique ». À chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Déménagement complet d''un commerce ou d''une boutique', 'forfait', 0, 20, $D$Prestation à réaliser :
Réalisation d'un déménagement professionnel complet d'un commerce ou d'une boutique comprenant la manutention, le chargement, le transport sécurisé et le déchargement de l'ensemble du mobilier commercial, des présentoirs, des rayonnages, des stocks, des équipements professionnels, du matériel d'encaissement ainsi que des autres biens nécessaires à la poursuite de l'activité vers les nouveaux locaux.

Prestations incluses :
- Manutention complète de l'ensemble des biens professionnels.
- Protection du mobilier commercial, des équipements et des marchandises durant les opérations de déménagement.
- Chargement organisé du mobilier, des rayonnages, des présentoirs, des stocks et des équipements professionnels.
- Transport sécurisé jusqu'au nouveau commerce.
- Déchargement de l'ensemble des biens transportés.
- Mise en place du mobilier et des équipements dans les espaces indiqués par le client.
- Utilisation de matériel professionnel et de moyens de manutention adaptés aux contraintes du commerce.

Conditions d'intervention :
Le devis est établi sur la base des informations communiquées par le client concernant le volume à déménager, la nature des marchandises et des équipements, les conditions d'accès aux locaux de départ et d'arrivée, les possibilités de stationnement, les distances de portage ainsi que toute contrainte technique particulière.
La présente prestation concerne exclusivement le transfert des biens professionnels. Les opérations de démontage technique, de remise en service des équipements, de raccordement des installations ou de réimplantation commerciale ne sont pas incluses, sauf mention expresse figurant au devis.
Toute modification du volume des biens, des conditions d'intervention ou des prestations demandées après validation du devis pourra entraîner une réévaluation de la prestation après accord du client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
