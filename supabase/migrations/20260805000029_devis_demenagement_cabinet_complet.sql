-- Bibliothèque de devis Déménagement — 2. Professionnel / complet.
-- « Déménagement complet d'un cabinet professionnel ». À chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Déménagement complet d''un cabinet professionnel', 'forfait', 0, 20, $D$Prestation à réaliser :
Réalisation d'un déménagement professionnel complet d'un cabinet professionnel (cabinet médical, dentaire, paramédical, juridique, comptable, d'architecte ou toute autre profession libérale) comprenant la manutention, le chargement, le transport sécurisé et le déchargement du mobilier, des équipements professionnels, des dossiers, des archives, du matériel informatique et des autres biens nécessaires à l'activité vers les nouveaux locaux.

Prestations incluses :
- Manutention complète de l'ensemble des biens professionnels.
- Protection du mobilier, des équipements, des dossiers et du matériel durant les opérations de déménagement.
- Chargement organisé du mobilier, des archives, du matériel informatique, des fournitures et des équipements professionnels.
- Transport sécurisé jusqu'aux nouveaux locaux.
- Déchargement de l'ensemble des biens transportés.
- Mise en place du mobilier et des équipements dans les espaces indiqués par le client.
- Utilisation de matériel professionnel et de moyens de manutention adaptés aux équipements sensibles.

Conditions d'intervention :
Le devis est établi sur la base des informations communiquées par le client concernant le volume à déménager, la nature des équipements et des biens à transporter, les conditions d'accès aux locaux de départ et d'arrivée, les possibilités de stationnement, les distances de portage ainsi que toute contrainte technique particulière.
La présente prestation concerne exclusivement le transfert des biens professionnels. Les opérations de déconnexion, de reconnexion, de paramétrage des équipements informatiques, de remise en service des appareils ou toute intervention technique spécialisée ne sont pas incluses, sauf mention expresse figurant au devis.
Toute modification des conditions d'intervention, du volume à transporter, des équipements concernés ou des prestations demandées après validation du devis pourra entraîner une réévaluation de la prestation après accord du client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
