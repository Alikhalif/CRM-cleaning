-- Bibliothèque de devis Déménagement — 2. Professionnel / complet.
-- « Déménagement complet de bureaux ». À chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Déménagement complet de bureaux', 'forfait', 0, 20, $D$Prestation à réaliser :
Réalisation d'un déménagement professionnel complet de bureaux comprenant la manutention, le chargement, le transport sécurisé et le déchargement de l'ensemble du mobilier de bureau, des équipements professionnels, du matériel informatique, des archives, des fournitures et des autres biens de l'entreprise vers les nouveaux locaux.

Prestations incluses :
- Manutention complète de l'ensemble des biens professionnels.
- Protection du mobilier, des équipements et du matériel durant les opérations de déménagement.
- Chargement organisé du mobilier, des postes de travail, des équipements informatiques, des archives et des fournitures.
- Transport sécurisé jusqu'au nouveau site.
- Déchargement de l'ensemble des biens transportés.
- Mise en place du mobilier et des équipements dans les espaces désignés par le client.
- Utilisation de matériel professionnel adapté aux opérations de manutention et de transport.

Conditions d'intervention :
Le devis est établi sur la base des informations communiquées par le client concernant le volume à déménager, la nature des équipements, les conditions d'accès aux locaux de départ et d'arrivée, les possibilités de stationnement, les distances de portage ainsi que toute contrainte technique particulière.
La présente prestation concerne exclusivement le transfert des biens professionnels. Les opérations de démontage technique, de reconnexion informatique, d'installation électrique ou de remise en service des équipements ne sont pas incluses, sauf mention expresse figurant au devis.
Toute modification des conditions d'intervention, du volume des biens à transporter ou des prestations demandées après validation du devis pourra entraîner une réévaluation de la prestation après accord du client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
