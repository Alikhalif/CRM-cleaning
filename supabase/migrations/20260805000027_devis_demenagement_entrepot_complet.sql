-- Bibliothèque de devis Déménagement — 2. Professionnel / complet.
-- « Déménagement complet d'un entrepôt ». À chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Déménagement complet d''un entrepôt', 'forfait', 0, 20, $D$Prestation à réaliser :
Réalisation d'un déménagement professionnel complet d'un entrepôt comprenant la manutention, le chargement, le transport sécurisé et le déchargement de l'ensemble des marchandises, des rayonnages, des équipements logistiques, du mobilier, du matériel professionnel et des autres biens nécessaires à l'exploitation vers le nouveau site.

Prestations incluses :
- Manutention complète de l'ensemble des biens et équipements professionnels.
- Protection des marchandises, du mobilier et des équipements durant les opérations de déménagement.
- Chargement organisé des rayonnages, des équipements logistiques, des stocks, du matériel et des fournitures.
- Transport sécurisé jusqu'au nouvel entrepôt.
- Déchargement de l'ensemble des biens transportés.
- Mise en place des équipements et des marchandises selon les indications du client.
- Utilisation de matériel professionnel et de moyens de manutention adaptés aux charges, aux volumes et aux contraintes logistiques.

Conditions d'intervention :
Le devis est établi sur la base des informations communiquées par le client concernant le volume à déménager, la nature des marchandises et des équipements, les conditions d'accès aux sites de départ et d'arrivée, les possibilités de stationnement, les distances de portage ainsi que toute contrainte technique particulière.
La présente prestation concerne exclusivement le transfert des biens professionnels. Les opérations de démontage technique, de remontage de structures, de remise en service des installations ou toute autre intervention spécialisée ne sont pas incluses, sauf mention expresse figurant au devis.
Toute modification du volume, des conditions d'intervention, des équipements à transporter ou des prestations demandées après validation du devis pourra entraîner une réévaluation de la prestation après accord du client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
